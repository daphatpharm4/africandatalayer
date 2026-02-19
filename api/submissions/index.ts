import exifr from "exifr";
import { put } from "@vercel/blob";
import { requireUser } from "../../lib/auth.js";
import { getPointEvents, getSubmissions, getUserProfile, setPointEvents, setUserProfile } from "../../lib/edgeConfig.js";
import {
  isEnrichFieldAllowed,
  listCreateMissingFields,
  mergePointEventsWithLegacy,
  normalizeEnrichPayload,
  projectPointsFromEvents,
} from "../../lib/server/pointProjection.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { BONAMOUSSADI_BOUNDS, isWithinBonamoussadi, isWithinCameroon } from "../../shared/geofence.js";
import { BONAMOUSSADI_CURATED_SEED_EVENTS } from "../../shared/bonamoussadiSeedEvents.js";
import type {
  MapScope,
  PointEvent,
  PointEventType,
  SubmissionCategory,
  SubmissionDetails,
  SubmissionInput,
  SubmissionLocation,
} from "../../shared/types.js";

const allowedCategories: SubmissionCategory[] = ["pharmacy", "fuel_station", "mobile_money"];
const allowedEventTypes: PointEventType[] = ["CREATE_EVENT", "ENRICH_EVENT"];
const IP_PHOTO_MATCH_KM = Number(process.env.IP_PHOTO_MATCH_KM ?? "50") || 50;
const INLINE_PHOTO_PREFIX = "data:image/";
const MAX_IMAGE_BYTES = Number(process.env.MAX_SUBMISSION_IMAGE_BYTES ?? "8388608") || 8388608;
const MAX_EDGE_CONFIG_EVENTS_BYTES = Number(process.env.MAX_EDGE_CONFIG_EVENTS_BYTES ?? "1800000") || 1800000;
const INLINE_IMAGE_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,/i;
const allowedImageMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const BASE_EVENT_XP = 5;
const allowedMapScopes: ReadonlySet<MapScope> = new Set(["bonamoussadi", "cameroon", "global"]);

function parseLocation(input: unknown): SubmissionLocation | null {
  if (!input || typeof input !== "object") return null;
  const location = input as { latitude?: unknown; longitude?: unknown };
  const latitude = typeof location.latitude === "string" ? Number(location.latitude) : (location.latitude as number);
  const longitude = typeof location.longitude === "string" ? Number(location.longitude) : (location.longitude as number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function hasValue(input: unknown): boolean {
  if (typeof input === "string") return Boolean(input.trim());
  if (typeof input === "boolean") return true;
  if (typeof input === "number") return Number.isFinite(input);
  if (Array.isArray(input)) return input.length > 0;
  if (input && typeof input === "object") return Object.keys(input as object).length > 0;
  return false;
}

function normalizeCategory(input: string | undefined): SubmissionCategory | null {
  if (!input) return null;
  const raw = input.trim();
  if (raw === "FUEL") return "fuel_station";
  if (raw === "MOBILE_MONEY" || raw === "KIOSK") return "mobile_money";
  if (raw === "PHARMACY") return "pharmacy";
  if (raw === "fuel_station" || raw === "mobile_money" || raw === "pharmacy") return raw;
  return null;
}

function normalizeEventType(input: unknown): PointEventType {
  if (typeof input === "string" && allowedEventTypes.includes(input as PointEventType)) {
    return input as PointEventType;
  }
  return "CREATE_EVENT";
}

function normalizeMapScope(input: string | null): MapScope {
  if (!input) return "bonamoussadi";
  const normalized = input.trim().toLowerCase();
  if (!allowedMapScopes.has(normalized as MapScope)) return "bonamoussadi";
  return normalized as MapScope;
}

function hasAdminToken(auth: Awaited<ReturnType<typeof requireUser>>): boolean {
  if (!auth) return false;
  return Boolean((auth.token as { isAdmin?: boolean }).isAdmin);
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

function isInlinePhotoData(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(INLINE_PHOTO_PREFIX);
}

function stripInlinePhotoData(event: PointEvent): PointEvent {
  if (!isInlinePhotoData(event.photoUrl)) return event;
  const { photoUrl: _photoUrl, ...rest } = event;
  const details = { ...(event.details ?? {}), hasPhoto: true };
  return { ...rest, details };
}

function estimateJsonBytes(input: unknown): number {
  return Buffer.byteLength(JSON.stringify(input), "utf8");
}

function compactEventsForStorage(events: PointEvent[]): PointEvent[] {
  if (estimateJsonBytes(events) <= MAX_EDGE_CONFIG_EVENTS_BYTES) return events;
  const sorted = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  while (sorted.length > 0 && estimateJsonBytes(sorted) > MAX_EDGE_CONFIG_EVENTS_BYTES) {
    sorted.pop();
  }
  return sorted;
}

function mimeToExtension(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

function parseImagePayload(imageBase64: string): { imageBuffer: Buffer; mime: string; ext: string } | null {
  const match = imageBase64.match(INLINE_IMAGE_REGEX);
  if (!match) return null;

  const mime = match[1]?.toLowerCase() ?? "";
  if (!allowedImageMime.has(mime)) return null;

  const base64 = stripBase64Prefix(imageBase64);
  const imageBuffer = Buffer.from(base64, "base64");
  if (!imageBuffer.length) return null;

  return { imageBuffer, mime, ext: mimeToExtension(mime) };
}

async function uploadSubmissionPhoto(
  eventId: string,
  imageBuffer: Buffer,
  mime: string,
  ext: string,
): Promise<string> {
  const pathname = `submissions/${eventId}-${Date.now()}.${ext}`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const uploaded = await put(pathname, imageBuffer, {
    access: "public",
    contentType: mime,
    addRandomSuffix: false,
    token: token || undefined,
  });
  return uploaded.url;
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

function validateCreatePayload(category: SubmissionCategory, details: SubmissionDetails): string | null {
  const missing = listCreateMissingFields(category, details);
  if (missing.length > 0) return `Missing required fields: ${missing.join(", ")}`;
  return null;
}

async function buildCombinedEvents(): Promise<PointEvent[]> {
  const pointEvents = (await getPointEvents()).map(stripInlinePhotoData);
  const legacySubmissions = await getSubmissions();
  const merged = mergePointEventsWithLegacy(pointEvents, legacySubmissions);
  const seenExternalIds = new Set(
    merged
      .map((event) => (typeof event.externalId === "string" ? event.externalId.trim() : ""))
      .filter((value) => value.length > 0),
  );
  const seenPointIds = new Set(merged.map((event) => event.pointId));
  for (const seedEvent of BONAMOUSSADI_CURATED_SEED_EVENTS) {
    const externalId = typeof seedEvent.externalId === "string" ? seedEvent.externalId.trim() : "";
    if (externalId && seenExternalIds.has(externalId)) continue;
    if (seenPointIds.has(seedEvent.pointId)) continue;
    merged.push(seedEvent);
    if (externalId) seenExternalIds.add(externalId);
    seenPointIds.add(seedEvent.pointId);
  }
  return merged;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const radius = url.searchParams.get("radius");
  const requestedScope = normalizeMapScope(url.searchParams.get("scope"));
  const canUseExpandedScope = requestedScope !== "bonamoussadi";
  if (canUseExpandedScope && !auth) return errorResponse("Unauthorized", 401);
  if (canUseExpandedScope && !hasAdminToken(auth)) return errorResponse("Forbidden", 403);
  const effectiveScope = canUseExpandedScope ? requestedScope : "bonamoussadi";

  const allEvents = await buildCombinedEvents();
  const scopedEvents = allEvents.filter((event) => {
    if (effectiveScope === "global") return true;
    if (effectiveScope === "cameroon") return isWithinCameroon(event.location);
    return isWithinBonamoussadi(event.location);
  });

  if (view === "events") {
    const responseEvents = auth
      ? scopedEvents
      : scopedEvents.map(({ userId: _userId, ...rest }) => rest as Omit<PointEvent, "userId">);
    return jsonResponse(responseEvents, { status: 200 });
  }

  let projected = projectPointsFromEvents(scopedEvents);

  if (lat && lng && radius) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    const radiusKm = Number(radius);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(radiusKm)) {
      projected = projected.filter((point) => haversineKm(point.location, { latitude, longitude }) <= radiusKm);
    }
  }

  return jsonResponse(projected, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  let body: SubmissionInput;
  try {
    body = (await request.json()) as SubmissionInput;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const category = normalizeCategory(body?.category as string | undefined);
  if (!category || !allowedCategories.includes(category)) {
    return errorResponse("Invalid category", 400);
  }

  const eventType = normalizeEventType(body?.eventType);
  const location = parseLocation(body?.location);
  const details = normalizeEnrichPayload(
    category,
    body?.details && typeof body.details === "object" ? ({ ...(body.details as SubmissionDetails) } as SubmissionDetails) : {},
  );

  const imageBase64 = body?.imageBase64 as string | undefined;
  if (!imageBase64) return errorResponse("Photo is required", 400);
  const parsedPhoto = parseImagePayload(imageBase64);
  if (!parsedPhoto) return errorResponse("Invalid photo format", 400);
  if (parsedPhoto.imageBuffer.byteLength > MAX_IMAGE_BYTES) {
    return errorResponse(`Photo exceeds maximum size of ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB`, 400);
  }

  const ipLocation = await getIpLocation(request);
  let photoLocation: SubmissionLocation | null = null;

  try {
    const gps = await exifr.gps(parsedPhoto.imageBuffer);
    const latitude = gps?.latitude;
    const longitude = gps?.longitude;
    if (latitude && longitude) {
      photoLocation = { latitude, longitude };
      if (location) {
        const distance = haversineKm(location, photoLocation);
        if (distance > 1) return errorResponse("Photo GPS coordinates do not match submission location", 400);
      }
      if (ipLocation) {
        const distance = haversineKm(ipLocation, photoLocation);
        if (distance > IP_PHOTO_MATCH_KM) return errorResponse("Photo location does not match IP location", 400);
      }
    } else if (!location && !ipLocation) {
      return errorResponse("Photo is missing GPS metadata", 400);
    }
  } catch {
    if (!location && !ipLocation) {
      return errorResponse("Unable to read photo GPS metadata", 400);
    }
  }

  const finalLocation = photoLocation ?? location ?? ipLocation;
  if (!finalLocation) return errorResponse("Missing or invalid location", 400);
  if (!isWithinBonamoussadi(finalLocation)) {
    return errorResponse(
      `Location outside Bonamoussadi bounds (${BONAMOUSSADI_BOUNDS.south},${BONAMOUSSADI_BOUNDS.west})-(${BONAMOUSSADI_BOUNDS.north},${BONAMOUSSADI_BOUNDS.east})`,
      400,
    );
  }

  const existingEvents = await buildCombinedEvents();
  const projectedExisting = projectPointsFromEvents(existingEvents);
  let pointId = typeof body.pointId === "string" && body.pointId.trim() ? body.pointId.trim() : crypto.randomUUID();

  if (eventType === "CREATE_EVENT") {
    const createError = validateCreatePayload(category, details);
    if (createError) return errorResponse(createError, 400);
  } else {
    if (!body.pointId || typeof body.pointId !== "string" || !body.pointId.trim()) {
      return errorResponse("pointId is required for ENRICH_EVENT", 400);
    }
    pointId = body.pointId.trim();
    const target = projectedExisting.find((point) => point.pointId === pointId);
    if (!target) return errorResponse("Target point not found", 404);
    if (target.category !== category) return errorResponse("Category mismatch for target point", 400);

    const submittedEntries = Object.entries(details).filter(([, value]) => hasValue(value));
    const allowedGaps = new Set(target.gaps);
    const filteredEntries = submittedEntries.filter(([field]) => {
      const canonical = field === "hours" ? "openingHours" : field === "merchantId" ? "merchantIdByProvider" : field;
      return isEnrichFieldAllowed(category, canonical) && allowedGaps.has(canonical);
    });
    if (!filteredEntries.length) {
      return errorResponse("ENRICH_EVENT must include at least one currently missing field", 400);
    }
    const filteredDetails: SubmissionDetails = {};
    for (const [key, value] of filteredEntries) {
      filteredDetails[key] = value;
    }
    Object.assign(details, filteredDetails);
    for (const key of Object.keys(details)) {
      if (!Object.prototype.hasOwnProperty.call(filteredDetails, key)) {
        delete details[key];
      }
    }
  }

  const eventId = crypto.randomUUID();
  let photoUrl: string | undefined;
  try {
    photoUrl = await uploadSubmissionPhoto(eventId, parsedPhoto.imageBuffer, parsedPhoto.mime, parsedPhoto.ext);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();
    if (lower.includes("blob") && lower.includes("token")) return errorResponse("Blob storage is not configured", 500);
    return errorResponse("Unable to store photo", 500);
  }
  details.hasPhoto = true;

  const secondImageBase64 = body?.secondImageBase64 as string | undefined;
  if (secondImageBase64) {
    const parsedSecondPhoto = parseImagePayload(secondImageBase64);
    if (!parsedSecondPhoto) return errorResponse("Invalid photo format", 400);
    if (parsedSecondPhoto.imageBuffer.byteLength > MAX_IMAGE_BYTES) {
      return errorResponse(`Photo exceeds maximum size of ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB`, 400);
    }
    try {
      const secondPhotoUrl = await uploadSubmissionPhoto(
        `${eventId}-second`,
        parsedSecondPhoto.imageBuffer,
        parsedSecondPhoto.mime,
        parsedSecondPhoto.ext,
      );
      details.secondPhotoUrl = secondPhotoUrl;
      details.hasSecondaryPhoto = true;
    } catch {
      return errorResponse("Unable to store photo", 500);
    }
  }

  const now = new Date().toISOString();
  const newEvent: PointEvent = {
    id: eventId,
    pointId,
    eventType,
    userId: auth.id,
    category,
    location: finalLocation,
    details,
    photoUrl,
    createdAt: now,
    source: typeof details.source === "string" ? details.source : undefined,
    externalId: typeof details.externalId === "string" ? details.externalId : undefined,
  };

  const rawStoredEvents = await getPointEvents();
  rawStoredEvents.push(newEvent);
  await setPointEvents(compactEventsForStorage(rawStoredEvents));

  const profile = await getUserProfile(auth.id);
  if (profile) {
    profile.XP = (profile.XP ?? 0) + BASE_EVENT_XP;
    await setUserProfile(auth.id, profile);
  }

  return jsonResponse(newEvent, { status: 201 });
}
