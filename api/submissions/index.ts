import exifr from "exifr";
import { requireUser } from "../../lib/auth.js";
import { getSubmissions, getUserProfile, setSubmissions, setUserProfile } from "../../lib/edgeConfig.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import type { Submission, SubmissionCategory, SubmissionLocation } from "../../shared/types.js";

const allowedCategories: SubmissionCategory[] = ["fuel_station", "mobile_money"];
const IP_PHOTO_MATCH_KM = Number(process.env.IP_PHOTO_MATCH_KM ?? "50") || 50;

function parseLocation(input: unknown): SubmissionLocation | null {
  if (!input || typeof input !== "object") return null;
  const location = input as { latitude?: unknown; longitude?: unknown };
  const latitude = typeof location.latitude === "string" ? Number(location.latitude) : (location.latitude as number);
  const longitude = typeof location.longitude === "string" ? Number(location.longitude) : (location.longitude as number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function parseNumeric(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function haversineKm(a: SubmissionLocation, b: SubmissionLocation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * 6371 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function stripBase64Prefix(imageBase64: string): string {
  const commaIndex = imageBase64.indexOf(",");
  return commaIndex === -1 ? imageBase64 : imageBase64.slice(commaIndex + 1);
}

function normalizeIp(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  if (!first) return null;
  const cleaned = first.replace(/^\[|\]$/g, "");
  if (cleaned.startsWith("::ffff:")) return cleaned.slice(7);
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(cleaned)) return cleaned.split(":")[0] ?? null;
  return cleaned;
}

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe80:")) return true;
  return false;
}

async function fetchIpLocation(ip: string): Promise<SubmissionLocation | null> {
  const target = `https://ipapi.co/${ip}/json/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(target, { signal: controller.signal });
    if (!res.ok) return null;
    const data: any = await res.json();
    const latitude = Number(data?.latitude);
    const longitude = Number(data?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getIpLocation(request: Request): Promise<SubmissionLocation | null> {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  const ip = normalizeIp(vercelIp ?? forwarded ?? realIp);
  if (!ip || isPrivateIp(ip)) return null;
  return await fetchIpLocation(ip);
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);

  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const radius = url.searchParams.get("radius");

  let submissions = await getSubmissions();

  if (lat && lng && radius) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    const radiusKm = Number(radius);

    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(radiusKm)) {
      submissions = submissions.filter((submission) =>
        haversineKm(submission.location, { latitude, longitude }) <= radiusKm
      );
    }
  }

  if (!auth) {
    const publicSubmissions = submissions.map(({ userId, ...rest }) => rest);
    return jsonResponse(publicSubmissions, { status: 200 });
  }

  return jsonResponse(submissions, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const rawCategory = body?.category as string | undefined;
  const normalizedCategory =
    rawCategory === "FUEL"
      ? "fuel_station"
      : rawCategory === "MOBILE_MONEY"
        ? "mobile_money"
        : rawCategory;
  const category = normalizedCategory as SubmissionCategory;
  if (!allowedCategories.includes(category)) {
    return errorResponse("Invalid category", 400);
  }

  const location = parseLocation(body?.location);
  const rawDetails = body?.details && typeof body.details === "object" ? { ...(body.details as Record<string, unknown>) } : {};

  if (category === "fuel_station") {
    const parsedFuelPrice = parseNumeric(rawDetails.fuelPrice ?? rawDetails.price);
    if (parsedFuelPrice === null) {
      return errorResponse("Invalid fuel price", 400);
    }
    const rawFuelType = rawDetails.fuelType;
    if (typeof rawFuelType === "string" && rawFuelType.trim()) {
      rawDetails.fuelType = rawFuelType.trim();
    }
    rawDetails.price = parsedFuelPrice;
    rawDetails.fuelPrice = parsedFuelPrice;
  }

  const newSubmission: Submission = {
    id: crypto.randomUUID(),
    userId: auth.id,
    category,
    location: location ?? { latitude: 0, longitude: 0 },
    details: rawDetails,
    createdAt: new Date().toISOString(),
  };

  const ipLocation = await getIpLocation(request);

  const imageBase64 = body?.imageBase64 as string | undefined;
  if (!imageBase64) {
    return errorResponse("Photo is required", 400);
  }

  let photoLocation: SubmissionLocation | null = null;
  if (imageBase64) {
    const base64 = stripBase64Prefix(imageBase64);
    const imageBuffer = Buffer.from(base64, "base64");

    try {
      const gps = await exifr.gps(imageBuffer);
      const latitude = gps?.latitude;
      const longitude = gps?.longitude;
      if (latitude && longitude) {
        photoLocation = { latitude, longitude };

        if (location) {
          const distance = haversineKm(location, photoLocation);
          if (distance > 1) {
            return errorResponse("Photo GPS coordinates do not match submission location", 400);
          }
        }

        if (ipLocation) {
          const distance = haversineKm(ipLocation, photoLocation);
          if (distance > IP_PHOTO_MATCH_KM) {
            return errorResponse("Photo location does not match IP location", 400);
          }
        }
      } else {
        // iOS Safari capture can strip EXIF GPS metadata even with location enabled.
        // Fall back to browser GPS/IP checks instead of hard-failing on metadata absence.
        if (!location && !ipLocation) {
          return errorResponse("Photo is missing GPS metadata", 400);
        }
        if (location && ipLocation) {
          const distance = haversineKm(location, ipLocation);
          if (distance > IP_PHOTO_MATCH_KM) {
            return errorResponse("Device location does not match IP location", 400);
          }
        }
      }
    } catch (error) {
      if (!location && !ipLocation) {
        return errorResponse("Unable to read photo GPS metadata", 400);
      }
      if (location && ipLocation) {
        const distance = haversineKm(location, ipLocation);
        if (distance > IP_PHOTO_MATCH_KM) {
          return errorResponse("Device location does not match IP location", 400);
        }
      }
    }

    newSubmission.photoUrl = imageBase64;
  }

  if (photoLocation) {
    newSubmission.location = photoLocation;
  } else if (location) {
    newSubmission.location = location;
  } else if (ipLocation) {
    newSubmission.location = ipLocation;
  } else {
    return errorResponse("Missing or invalid location", 400);
  }

  const submissions = await getSubmissions();
  submissions.push(newSubmission);
  await setSubmissions(submissions);

  const profile = await getUserProfile(auth.id);
  if (profile) {
    profile.XP = (profile.XP ?? 0) + 10;
    await setUserProfile(auth.id, profile);
  }

  return jsonResponse(newSubmission, { status: 201 });
}
