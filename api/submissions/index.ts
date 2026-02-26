import { put } from "@vercel/blob";
import { requireUser } from "../../lib/auth.js";
import {
  getLegacySubmissions,
  getPointEvents,
  getUserProfile,
  insertPointEvent,
  isStorageUnavailableError,
  upsertUserProfile,
} from "../../lib/server/storage/index.js";
import {
  isEnrichFieldAllowed,
  listCreateMissingFields,
  mergePointEventsWithLegacy,
  normalizeEnrichPayload,
  projectPointsFromEvents,
} from "../../lib/server/pointProjection.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import {
  filterEventsForViewer,
  redactEventUserIds,
  resolveAdminViewAccess,
  toSubmissionAuthContext,
  normalizeActorId,
} from "../../lib/server/submissionAccess.js";
import {
  DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM,
  buildPhotoFraudMetadata,
  buildSubmissionFraudCheck,
  extractPhotoMetadata,
  extractPhotoMetadataFromUrl,
  haversineKm,
  parseSubmissionFraudCheck,
} from "../../lib/server/submissionFraud.js";
import { BONAMOUSSADI_BOUNDS, isWithinBonamoussadi, isWithinCameroon } from "../../shared/geofence.js";
import { BONAMOUSSADI_CURATED_SEED_EVENTS } from "../../shared/bonamoussadiSeedEvents.js";
import type {
  AdminSubmissionEvent,
  ClientDeviceInfo,
  MapScope,
  PointEvent,
  PointEventType,
  SubmissionCategory,
  SubmissionDetails,
  SubmissionFraudCheck,
  SubmissionInput,
  SubmissionLocation,
} from "../../shared/types.js";

const allowedCategories: SubmissionCategory[] = ["pharmacy", "fuel_station", "mobile_money"];
const allowedEventTypes: PointEventType[] = ["CREATE_EVENT", "ENRICH_EVENT"];
const IP_PHOTO_MATCH_KM = Number(process.env.IP_PHOTO_MATCH_KM ?? "50") || 50;
const SUBMISSION_PHOTO_MATCH_KM = DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM;
const MAX_FORENSICS_FALLBACK_LOOKUPS = Number(process.env.ADMIN_FORENSICS_FALLBACK_LIMIT ?? "25") || 25;
const INLINE_PHOTO_PREFIX = "data:image/";
const MAX_IMAGE_BYTES = Number(process.env.MAX_SUBMISSION_IMAGE_BYTES ?? "8388608") || 8388608;
const INLINE_IMAGE_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,/i;
const allowedImageMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const BASE_EVENT_XP = 5;
const allowedMapScopes: ReadonlySet<MapScope> = new Set(["bonamoussadi", "cameroon", "global"]);
const PUBLIC_READ_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=300";

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

function trimString(input: unknown, maxLen = 256): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  return value.slice(0, maxLen);
}

function sanitizeClientDevice(input: unknown): ClientDeviceInfo | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const deviceId = trimString(raw.deviceId, 128);
  if (!deviceId) return null;
  const platform = trimString(raw.platform, 64);
  const userAgent = trimString(raw.userAgent, 256);
  const memory = typeof raw.deviceMemoryGb === "number" && Number.isFinite(raw.deviceMemoryGb) ? raw.deviceMemoryGb : null;
  const cpu = typeof raw.hardwareConcurrency === "number" && Number.isFinite(raw.hardwareConcurrency) ? raw.hardwareConcurrency : null;
  const isLowEnd = raw.isLowEnd === true;

  return {
    deviceId,
    platform: platform ?? undefined,
    userAgent: userAgent ?? undefined,
    deviceMemoryGb: memory,
    hardwareConcurrency: cpu,
    isLowEnd,
  };
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

function getUserDisplayName(userId: string, name: string | null, email: string | null): string {
  if (name && name.trim()) return name.trim();
  if (email) {
    const atIndex = email.indexOf("@");
    if (atIndex > 0) return email.slice(0, atIndex);
    return email;
  }
  return userId || "Contributor";
}

function getEventFraudCheck(event: PointEvent): SubmissionFraudCheck | null {
  const details = event.details as Record<string, unknown> | undefined;
  return parseSubmissionFraudCheck(details?.fraudCheck);
}

function getSecondaryPhotoUrl(event: PointEvent): string | null {
  const details = event.details as Record<string, unknown> | undefined;
  const secondPhotoUrl = details?.secondPhotoUrl;
  if (typeof secondPhotoUrl !== "string") return null;
  const normalized = secondPhotoUrl.trim();
  return normalized || null;
}

async function buildFallbackFraudCheck(event: PointEvent): Promise<SubmissionFraudCheck | null> {
  const primaryUrl = typeof event.photoUrl === "string" ? event.photoUrl.trim() : "";
  const secondaryUrl = getSecondaryPhotoUrl(event);
  if (!primaryUrl && !secondaryUrl) return null;

  const primaryExtracted = primaryUrl ? await extractPhotoMetadataFromUrl(primaryUrl) : null;
  const secondaryExtracted = secondaryUrl ? await extractPhotoMetadataFromUrl(secondaryUrl) : null;
  const primaryPhoto = buildPhotoFraudMetadata({
    extracted: primaryExtracted,
    submissionLocation: event.location,
    ipLocation: null,
    submissionMatchThresholdKm: SUBMISSION_PHOTO_MATCH_KM,
    ipMatchThresholdKm: IP_PHOTO_MATCH_KM,
  });
  const secondaryPhoto = buildPhotoFraudMetadata({
    extracted: secondaryExtracted,
    submissionLocation: event.location,
    ipLocation: null,
    submissionMatchThresholdKm: SUBMISSION_PHOTO_MATCH_KM,
    ipMatchThresholdKm: IP_PHOTO_MATCH_KM,
  });
  if (!primaryPhoto && !secondaryPhoto) return null;

  return buildSubmissionFraudCheck({
    submissionLocation: event.location,
    effectiveLocation: event.location,
    ipLocation: null,
    primaryPhoto,
    secondaryPhoto,
    submissionMatchThresholdKm: SUBMISSION_PHOTO_MATCH_KM,
    ipMatchThresholdKm: IP_PHOTO_MATCH_KM,
  });
}

async function buildAdminSubmissionEvents(events: PointEvent[]): Promise<AdminSubmissionEvent[]> {
  const sortedEvents = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const userIds = Array.from(
    new Set(
      sortedEvents
        .map((event) => normalizeActorId(event.userId))
        .filter((value) => value.length > 0),
    ),
  );

  const profileEntries = await Promise.all(
    userIds.map(async (userId) => [userId, await getUserProfile(userId)] as const),
  );
  const profileByUserId = new Map(profileEntries);
  const output: AdminSubmissionEvent[] = [];
  let fallbackLookups = 0;

  for (const event of sortedEvents) {
    const normalizedUserId = normalizeActorId(event.userId);
    const profile = profileByUserId.get(normalizedUserId) ?? null;
    const emailFromProfile = typeof profile?.email === "string" ? profile.email.trim().toLowerCase() : "";
    const email = emailFromProfile || (normalizedUserId.includes("@") ? normalizedUserId : null);
    const name = getUserDisplayName(normalizedUserId, profile?.name ?? null, email);
    let fraudCheck = getEventFraudCheck(event);
    if (!fraudCheck && fallbackLookups < MAX_FORENSICS_FALLBACK_LOOKUPS) {
      fallbackLookups += 1;
      try {
        fraudCheck = await buildFallbackFraudCheck(event);
      } catch {
        fraudCheck = null;
      }
    }

    output.push({
      event,
      user: {
        id: normalizedUserId || event.userId,
        name,
        email,
      },
      fraudCheck,
    });
  }

  return output;
}

async function buildCombinedEvents(): Promise<PointEvent[]> {
  const pointEvents = (await getPointEvents()).map(stripInlinePhotoData);
  const legacySubmissions = await getLegacySubmissions();
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
  const authContext = toSubmissionAuthContext(auth);
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const radius = url.searchParams.get("radius");
  const requestedScope = normalizeMapScope(url.searchParams.get("scope"));
  const canUseExpandedScope = requestedScope !== "bonamoussadi";
  if (canUseExpandedScope && !authContext) return errorResponse("Unauthorized", 401);
  if (canUseExpandedScope && !authContext.isAdmin) return errorResponse("Forbidden", 403);
  const effectiveScope = canUseExpandedScope ? requestedScope : "bonamoussadi";
  const canUsePublicCache = !authContext && !canUseExpandedScope;

  try {
    const allEvents = await buildCombinedEvents();
    const scopedEvents = allEvents.filter((event) => {
      if (effectiveScope === "global") return true;
      if (effectiveScope === "cameroon") return isWithinCameroon(event.location);
      return isWithinBonamoussadi(event.location);
    });

    if (view === "events") {
      if (!authContext) {
        return jsonResponse(redactEventUserIds(scopedEvents), {
          status: 200,
          headers: {
            "cache-control": PUBLIC_READ_CACHE_CONTROL,
          },
        });
      }
      const responseEvents = filterEventsForViewer(scopedEvents, authContext);
      return jsonResponse(responseEvents, { status: 200 });
    }

    if (view === "admin_events") {
      const adminAccess = resolveAdminViewAccess(authContext);
      if (adminAccess === "unauthorized") return errorResponse("Unauthorized", 401);
      if (adminAccess === "forbidden") return errorResponse("Forbidden", 403);
      const adminEvents = await buildAdminSubmissionEvents(scopedEvents);
      return jsonResponse(adminEvents, { status: 200 });
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

    return jsonResponse(projected, {
      status: 200,
      headers: canUsePublicCache
        ? {
            "cache-control": PUBLIC_READ_CACHE_CONTROL,
          }
        : undefined,
    });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth) return errorResponse("Unauthorized", 401);
  const authContext = toSubmissionAuthContext(auth);
  const isAdminUser = authContext?.isAdmin === true;

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
  const requestUserAgent = trimString(request.headers.get("user-agent"), 256);
  const clientDevice = sanitizeClientDevice((details as Record<string, unknown>).clientDevice);
  if (clientDevice) {
    if (!clientDevice.userAgent && requestUserAgent) clientDevice.userAgent = requestUserAgent;
    details.clientDevice = clientDevice;
  } else if ("clientDevice" in details) {
    delete details.clientDevice;
  }

  const imageBase64 = body?.imageBase64 as string | undefined;
  if (!imageBase64) return errorResponse("Photo is required", 400);
  const parsedPhoto = parseImagePayload(imageBase64);
  if (!parsedPhoto) return errorResponse("Invalid photo format", 400);
  if (parsedPhoto.imageBuffer.byteLength > MAX_IMAGE_BYTES) {
    return errorResponse(`Photo exceeds maximum size of ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB`, 400);
  }

  const ipLocation = await getIpLocation(request);
  let photoLocation: SubmissionLocation | null = null;
  let primaryPhotoMetadata: Awaited<ReturnType<typeof extractPhotoMetadata>> | null = null;

  try {
    primaryPhotoMetadata = await extractPhotoMetadata(parsedPhoto.imageBuffer);
    if (primaryPhotoMetadata.gps) {
      photoLocation = primaryPhotoMetadata.gps;
      if (location) {
        const distance = haversineKm(location, photoLocation);
        if (distance > SUBMISSION_PHOTO_MATCH_KM) return errorResponse("Photo GPS coordinates do not match submission location", 400);
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
  if (!isAdminUser && !isWithinBonamoussadi(finalLocation)) {
    return errorResponse(
      `Location outside Bonamoussadi bounds (${BONAMOUSSADI_BOUNDS.south},${BONAMOUSSADI_BOUNDS.west})-(${BONAMOUSSADI_BOUNDS.north},${BONAMOUSSADI_BOUNDS.east})`,
      400,
    );
  }

  try {
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
        const canonical =
          field === "hours"
            ? "openingHours"
            : field === "merchantId"
              ? "merchantIdByProvider"
              : field === "hasCashAvailable"
                ? "hasMin50000XafAvailable"
                : field;
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
      if (clientDevice) {
        details.clientDevice = clientDevice;
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

    let secondaryPhotoMetadata: Awaited<ReturnType<typeof extractPhotoMetadata>> | null = null;
    const secondImageBase64 = body?.secondImageBase64 as string | undefined;
    if (secondImageBase64) {
      const parsedSecondPhoto = parseImagePayload(secondImageBase64);
      if (!parsedSecondPhoto) return errorResponse("Invalid photo format", 400);
      if (parsedSecondPhoto.imageBuffer.byteLength > MAX_IMAGE_BYTES) {
        return errorResponse(`Photo exceeds maximum size of ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB`, 400);
      }

      try {
        secondaryPhotoMetadata = await extractPhotoMetadata(parsedSecondPhoto.imageBuffer);
      } catch {
        secondaryPhotoMetadata = null;
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

    const primaryPhotoFraud = buildPhotoFraudMetadata({
      extracted: primaryPhotoMetadata,
      submissionLocation: location,
      ipLocation,
      submissionMatchThresholdKm: SUBMISSION_PHOTO_MATCH_KM,
      ipMatchThresholdKm: IP_PHOTO_MATCH_KM,
    });
    const secondaryPhotoFraud = buildPhotoFraudMetadata({
      extracted: secondaryPhotoMetadata,
      submissionLocation: location,
      ipLocation,
      submissionMatchThresholdKm: SUBMISSION_PHOTO_MATCH_KM,
      ipMatchThresholdKm: IP_PHOTO_MATCH_KM,
    });
    details.fraudCheck = buildSubmissionFraudCheck({
      submissionLocation: location,
      effectiveLocation: finalLocation,
      ipLocation,
      primaryPhoto: primaryPhotoFraud,
      secondaryPhoto: secondaryPhotoFraud,
      submissionMatchThresholdKm: SUBMISSION_PHOTO_MATCH_KM,
      ipMatchThresholdKm: IP_PHOTO_MATCH_KM,
    });

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

    await insertPointEvent(newEvent);

    const exifDeviceMake = primaryPhotoMetadata?.deviceMake ?? null;
    const exifDeviceModel = primaryPhotoMetadata?.deviceModel ?? null;
    const logPayload = {
      eventId,
      userId: auth.id,
      category,
      deviceId: clientDevice?.deviceId ?? null,
      clientPlatform: clientDevice?.platform ?? null,
      clientUserAgent: clientDevice?.userAgent ?? requestUserAgent ?? null,
      clientMemoryGb: clientDevice?.deviceMemoryGb ?? null,
      clientCpuCores: clientDevice?.hardwareConcurrency ?? null,
      clientIsLowEnd: clientDevice?.isLowEnd ?? null,
      exifDeviceMake,
      exifDeviceModel,
    };
    console.info("[SUBMISSION_DEVICE]", JSON.stringify(logPayload));

    const profile = await getUserProfile(auth.id);
    if (profile) {
      profile.XP = (profile.XP ?? 0) + BASE_EVENT_XP;
      await upsertUserProfile(auth.id, profile);
    }

    return jsonResponse(newEvent, { status: 201 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}
