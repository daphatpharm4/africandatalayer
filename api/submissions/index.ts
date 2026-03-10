import { put } from "@vercel/blob";
import { requireUser } from "../../lib/auth.js";
import {
  getUserProfile,
  insertPointEvent,
  isStorageUnavailableError,
} from "../../lib/server/storage/index.js";
import {
  filterEnrichDetails,
  listCreateMissingFields,
  normalizeEnrichPayload,
  projectPointsFromEvents,
} from "../../lib/server/pointProjection.js";
import { computeConfidenceScore } from "../../lib/server/confidenceScore.js";
import { buildDedupCandidates } from "../../lib/server/dedup.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { query } from "../../lib/server/db.js";
import { diffCategorySets, parseConstraintCategories } from "../../lib/server/schemaGuard.js";
import { incrementAssignmentsForEvent } from "../../lib/server/collectionAssignments.js";
import { completeIdempotencyKey, hashIdempotencyPayload, reserveIdempotencyKey } from "../../lib/server/idempotency.js";
import { stripPiiDetails } from "../../lib/server/privacy.js";
import { consumeRateLimit } from "../../lib/server/rateLimit.js";
import { logSecurityEvent } from "../../lib/server/securityAudit.js";
import { captureServerException } from "../../lib/server/sentry.js";
import {
  blockStatusFromCode,
  computeEventContentHash,
  computeImageSha256,
  evaluateSubmissionRisk,
  hashIpIdentifier,
  logBlockedSubmission,
  persistSubmissionRiskArtifacts,
} from "../../lib/server/submissionRisk.js";
import {
  filterEventsForViewer,
  redactEventUserIds,
  resolveAdminViewAccess,
  toSubmissionAuthContext,
  normalizeActorId,
} from "../../lib/server/submissionAccess.js";
import { buildReadableEvents } from "../../lib/server/submissionEvents.js";
import { reconcileUserProfileXp } from "../../lib/server/xp.js";
import {
  DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM,
  applyClientExifFallback,
  buildPhotoFraudMetadata,
  buildSubmissionFraudCheck,
  extractPhotoMetadata,
  extractPhotoMetadataFromUrl,
  haversineKm,
  isPhotoMetadataEffectivelyEmpty,
  parseSubmissionFraudCheck,
} from "../../lib/server/submissionFraud.js";
import { createFraudAlert } from "../../lib/server/fraudAlerts.js";
import { getTrustTier } from "../../lib/server/userTrust.js";
import { submissionInputSchema } from "../../lib/server/validation.js";
import { BONAMOUSSADI_BOUNDS, isWithinBonamoussadi, isWithinCameroon } from "../../shared/geofence.js";
import type {
  AdminSubmissionEvent,
  ClientDeviceInfo,
  ClientExifData,
  ConsentStatus,
  GpsIntegrityReport,
  MapScope,
  PointEvent,
  PointEventType,
  SubmissionCategory,
  DedupDecision,
  SubmissionDetails,
  SubmissionFraudCheck,
  SubmissionInput,
  SubmissionLocation,
} from "../../shared/types.js";
import { VERTICAL_IDS, isValidCategory, normalizeCategoryAlias } from "../../shared/verticals.js";
import { BASE_EVENT_XP } from "../../shared/xp.js";
import { generatePointId } from "../../lib/shared/pointId.js";
const allowedEventTypes: PointEventType[] = ["CREATE_EVENT", "ENRICH_EVENT"];
const IP_PHOTO_MATCH_KM = Number(process.env.IP_PHOTO_MATCH_KM ?? "50") || 50;
const SUBMISSION_PHOTO_MATCH_KM = DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM;
const MAX_FORENSICS_FALLBACK_LOOKUPS = Number(process.env.ADMIN_FORENSICS_FALLBACK_LIMIT ?? "25") || 25;
const MAX_IMAGE_BYTES = Number(process.env.MAX_SUBMISSION_IMAGE_BYTES ?? "8388608") || 8388608;
const INLINE_IMAGE_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,/i;
const allowedImageMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const allowedMapScopes: ReadonlySet<MapScope> = new Set(["bonamoussadi", "cameroon", "global"]);
const PUBLIC_READ_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=300";
const EXPECTED_SUBMISSION_CATEGORIES = [...VERTICAL_IDS].sort((a, b) => a.localeCompare(b));
const SUBMISSION_RATE_LIMIT_PER_HOUR = Number(process.env.SUBMISSION_RATE_LIMIT_PER_HOUR ?? "60") || 60;
const SUBMISSION_IP_RATE_LIMIT_PER_HOUR = Number(process.env.SUBMISSION_IP_RATE_LIMIT_PER_HOUR ?? "120") || 120;

function parseLocation(input: unknown): SubmissionLocation | null {
  if (!input || typeof input !== "object") return null;
  const location = input as { latitude?: unknown; longitude?: unknown };
  const latitude = typeof location.latitude === "string" ? Number(location.latitude) : (location.latitude as number);
  const longitude = typeof location.longitude === "string" ? Number(location.longitude) : (location.longitude as number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
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
  const resolved = normalizeCategoryAlias(raw);
  if (resolved && isValidCategory(resolved)) return resolved as SubmissionCategory;
  return null;
}

function normalizeEventType(input: unknown): PointEventType {
  if (typeof input === "string" && allowedEventTypes.includes(input as PointEventType)) {
    return input as PointEventType;
  }
  return "CREATE_EVENT";
}

function normalizeDedupDecision(input: unknown): DedupDecision | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (normalized === "allow_create" || normalized === "use_existing") return normalized;
  return null;
}

function normalizeMapScope(input: string | null): MapScope {
  if (!input) return "bonamoussadi";
  const normalized = input.trim().toLowerCase();
  if (!allowedMapScopes.has(normalized as MapScope)) return "bonamoussadi";
  return normalized as MapScope;
}

function normalizeConsentStatus(input: unknown): ConsentStatus | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (
    normalized === "obtained" ||
    normalized === "refused_pii_only" ||
    normalized === "not_required" ||
    normalized === "withdrawn"
  ) {
    return normalized;
  }
  return null;
}

function sanitizeGpsIntegrity(input: unknown): GpsIntegrityReport | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const gpsAccuracyMeters =
    typeof raw.gpsAccuracyMeters === "number" && Number.isFinite(raw.gpsAccuracyMeters) ? raw.gpsAccuracyMeters : null;
  const gpsTimestamp = typeof raw.gpsTimestamp === "number" && Number.isFinite(raw.gpsTimestamp) ? raw.gpsTimestamp : null;
  const timeDeltaMs = typeof raw.timeDeltaMs === "number" && Number.isFinite(raw.timeDeltaMs) ? raw.timeDeltaMs : null;
  const networkType = trimString(raw.networkType, 32);

  return {
    mockLocationDetected: raw.mockLocationDetected === true,
    mockLocationMethod: trimString(raw.mockLocationMethod, 160),
    hasAccelerometerData: raw.hasAccelerometerData === true,
    hasGyroscopeData: raw.hasGyroscopeData === true,
    accelerometerSampleCount:
      typeof raw.accelerometerSampleCount === "number" && Number.isFinite(raw.accelerometerSampleCount)
        ? Math.max(0, Math.round(raw.accelerometerSampleCount))
        : 0,
    motionDetectedDuringCapture: raw.motionDetectedDuringCapture === true,
    gpsAccuracyMeters,
    networkType,
    gpsTimestamp,
    deviceTimestamp:
      typeof raw.deviceTimestamp === "number" && Number.isFinite(raw.deviceTimestamp) ? raw.deviceTimestamp : Date.now(),
    timeDeltaMs,
  };
}

function stripBase64Prefix(imageBase64: string): string {
  const commaIndex = imageBase64.indexOf(",");
  return commaIndex === -1 ? imageBase64 : imageBase64.slice(commaIndex + 1);
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

interface IpApiResponse {
  latitude?: unknown;
  longitude?: unknown;
  asn?: unknown;
  org?: unknown;
}

interface IpLookupResult {
  ip: string;
  location: SubmissionLocation | null;
  asn: string | null;
  org: string | null;
  isDatacenter: boolean;
  isVpn: boolean;
  isTor: boolean;
}

function toLowerText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toLowerCase();
}

function classifyIpOrg(orgRaw: string): { isDatacenter: boolean; isVpn: boolean; isTor: boolean } {
  const org = orgRaw.toLowerCase();
  const isDatacenter =
    org.includes("hosting") ||
    org.includes("cloud") ||
    org.includes("digitalocean") ||
    org.includes("aws") ||
    org.includes("amazon") ||
    org.includes("google cloud") ||
    org.includes("azure") ||
    org.includes("linode") ||
    org.includes("ovh");
  const isVpn =
    org.includes("vpn") ||
    org.includes("private internet") ||
    org.includes("nord") ||
    org.includes("expressvpn") ||
    org.includes("surfshark") ||
    org.includes("proxy");
  const isTor = org.includes("tor");
  return { isDatacenter, isVpn, isTor };
}

async function fetchIpInfo(ip: string): Promise<IpLookupResult> {
  const target = `https://ipapi.co/${ip}/json/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(target, { signal: controller.signal });
    if (!res.ok) {
      return {
        ip,
        location: null,
        asn: null,
        org: null,
        isDatacenter: false,
        isVpn: false,
        isTor: false,
      };
    }
    const data = (await res.json()) as IpApiResponse;
    const latitude = Number(data?.latitude);
    const longitude = Number(data?.longitude);
    const org = toLowerText(data?.org) || null;
    const asn = typeof data?.asn === "string" && data.asn.trim() ? data.asn.trim().toLowerCase() : null;
    const classification = classifyIpOrg(org ?? "");
    return {
      ip,
      location: Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null,
      asn,
      org,
      isDatacenter: classification.isDatacenter,
      isVpn: classification.isVpn,
      isTor: classification.isTor,
    };
  } catch {
    return {
      ip,
      location: null,
      asn: null,
      org: null,
      isDatacenter: false,
      isVpn: false,
      isTor: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getIpInfo(request: Request): Promise<IpLookupResult | null> {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  const ip = normalizeIp(vercelIp ?? forwarded ?? realIp);
  if (!ip || isPrivateIp(ip)) return null;
  return await fetchIpInfo(ip);
}

function currentRequestIp(request: Request): string | null {
  return normalizeIp(
    request.headers.get("x-vercel-forwarded-for") ??
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip"),
  );
}

function validateCreatePayload(category: SubmissionCategory, details: SubmissionDetails): string | null {
  const missing = listCreateMissingFields(category, details);
  if (missing.length > 0) return `Missing required fields: ${missing.join(", ")}`;
  return null;
}

function withReviewFlags(existing: string[], additions: string[]): string[] {
  return Array.from(new Set([...existing, ...additions].filter((value) => value.length > 0)));
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

function getReviewStatus(event: PointEvent): string {
  const details = event.details as Record<string, unknown> | undefined;
  const status = typeof details?.reviewStatus === "string" ? details.reviewStatus.trim().toLowerCase() : "";
  return status || "auto_approved";
}

function getReviewFlags(event: PointEvent): string[] {
  const details = event.details as Record<string, unknown> | undefined;
  const raw = details?.reviewFlags;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
}

function isPendingReview(event: PointEvent): boolean {
  if (getReviewStatus(event) === "pending_review") return true;
  return getReviewFlags(event).length > 0;
}

function shouldRunFallbackFraudCheck(event: PointEvent, fraudCheck: SubmissionFraudCheck | null): boolean {
  const primaryUrl = typeof event.photoUrl === "string" ? event.photoUrl.trim() : "";
  const secondaryUrl = getSecondaryPhotoUrl(event);
  if (!fraudCheck) return Boolean(primaryUrl || secondaryUrl);
  if (primaryUrl && isPhotoMetadataEffectivelyEmpty(fraudCheck.primaryPhoto)) return true;
  if (secondaryUrl && isPhotoMetadataEffectivelyEmpty(fraudCheck.secondaryPhoto)) return true;
  return false;
}

function mergePhotoFraudMetadata(
  existing: SubmissionFraudCheck["primaryPhoto"],
  recovered: SubmissionFraudCheck["primaryPhoto"],
  hasPhotoUrl: boolean,
): SubmissionFraudCheck["primaryPhoto"] {
  if (!hasPhotoUrl) return existing ?? null;
  if (existing && !isPhotoMetadataEffectivelyEmpty(existing)) return existing;
  if (recovered) return recovered;
  return existing ?? null;
}

async function buildFallbackFraudCheck(
  event: PointEvent,
  existingFraudCheck: SubmissionFraudCheck | null,
): Promise<SubmissionFraudCheck | null> {
  const primaryUrl = typeof event.photoUrl === "string" ? event.photoUrl.trim() : "";
  const secondaryUrl = getSecondaryPhotoUrl(event);
  if (!primaryUrl && !secondaryUrl) return existingFraudCheck;

  const needsPrimaryRecovery = Boolean(primaryUrl) && isPhotoMetadataEffectivelyEmpty(existingFraudCheck?.primaryPhoto);
  const needsSecondaryRecovery = Boolean(secondaryUrl) && isPhotoMetadataEffectivelyEmpty(existingFraudCheck?.secondaryPhoto);
  const primaryExtracted = needsPrimaryRecovery ? await extractPhotoMetadataFromUrl(primaryUrl) : null;
  const secondaryExtracted = needsSecondaryRecovery ? await extractPhotoMetadataFromUrl(secondaryUrl) : null;
  const recoveredPrimaryPhoto = buildPhotoFraudMetadata({
    extracted: primaryExtracted,
    submissionLocation: event.location,
    ipLocation: null,
    submissionMatchThresholdKm: SUBMISSION_PHOTO_MATCH_KM,
    ipMatchThresholdKm: IP_PHOTO_MATCH_KM,
  });
  const recoveredSecondaryPhoto = buildPhotoFraudMetadata({
    extracted: secondaryExtracted,
    submissionLocation: event.location,
    ipLocation: null,
    submissionMatchThresholdKm: SUBMISSION_PHOTO_MATCH_KM,
    ipMatchThresholdKm: IP_PHOTO_MATCH_KM,
  });
  const primaryPhoto = mergePhotoFraudMetadata(existingFraudCheck?.primaryPhoto ?? null, recoveredPrimaryPhoto, Boolean(primaryUrl));
  const secondaryPhoto = mergePhotoFraudMetadata(
    existingFraudCheck?.secondaryPhoto ?? null,
    recoveredSecondaryPhoto,
    Boolean(secondaryUrl),
  );
  if (!primaryPhoto && !secondaryPhoto) return null;

  return buildSubmissionFraudCheck({
    submissionLocation: existingFraudCheck?.submissionLocation ?? event.location,
    effectiveLocation: existingFraudCheck?.effectiveLocation ?? event.location,
    ipLocation: existingFraudCheck?.ipLocation ?? null,
    primaryPhoto,
    secondaryPhoto,
    submissionMatchThresholdKm: existingFraudCheck?.submissionMatchThresholdKm ?? SUBMISSION_PHOTO_MATCH_KM,
    ipMatchThresholdKm: existingFraudCheck?.ipMatchThresholdKm ?? IP_PHOTO_MATCH_KM,
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
    if (shouldRunFallbackFraudCheck(event, fraudCheck) && fallbackLookups < MAX_FORENSICS_FALLBACK_LOOKUPS) {
      fallbackLookups += 1;
      try {
        fraudCheck = await buildFallbackFraudCheck(event, fraudCheck);
      } catch {
        fraudCheck = fraudCheck ?? null;
      }
    }

    output.push({
      event,
      user: {
        id: normalizedUserId || event.userId,
        name,
        email,
        trustScore: profile?.trustScore ?? 50,
        trustTier: profile?.trustTier ?? "standard",
        suspendedUntil: profile?.suspendedUntil ?? null,
      },
      fraudCheck,
    });
  }

  return output;
}

type SchemaGuardView = {
  ok: boolean | null;
  expected: string[];
  actual: string[];
  missing: string[];
  extra: string[];
  reason?: string;
};

async function buildSchemaGuardView(): Promise<SchemaGuardView> {
  const fallback: SchemaGuardView = {
    ok: null,
    expected: EXPECTED_SUBMISSION_CATEGORIES,
    actual: [],
    missing: EXPECTED_SUBMISSION_CATEGORIES,
    extra: [],
  };

  try {
    const result = await query<{ constraint_definition: string | null }>(
      `
        SELECT pg_get_constraintdef(c.oid) AS constraint_definition
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE ns.nspname = 'public'
          AND rel.relname = 'point_events'
          AND c.conname = 'point_events_category_check'
        LIMIT 1
      `,
    );
    const definition = result.rows[0]?.constraint_definition ?? null;
    if (!definition) {
      return { ...fallback, reason: "constraint_not_found" };
    }
    const actual = parseConstraintCategories(definition);
    const diff = diffCategorySets(EXPECTED_SUBMISSION_CATEGORIES, actual);
    return {
      ok: diff.ok,
      expected: diff.expected,
      actual: diff.actual,
      missing: diff.missing,
      extra: diff.extra,
    };
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return { ...fallback, reason: "storage_unavailable" };
    }
    return { ...fallback, reason: "query_failed" };
  }
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
    if (view === "schema_guard") {
      const adminAccess = resolveAdminViewAccess(authContext);
      if (adminAccess === "unauthorized") return errorResponse("Unauthorized", 401);
      if (adminAccess === "forbidden") return errorResponse("Forbidden", 403);
      return jsonResponse(await buildSchemaGuardView(), { status: 200 });
    }

    const allEvents = await buildReadableEvents();
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

    if (view === "review_queue") {
      const adminAccess = resolveAdminViewAccess(authContext);
      if (adminAccess === "unauthorized") return errorResponse("Unauthorized", 401);
      if (adminAccess === "forbidden") return errorResponse("Forbidden", 403);
      const pending = scopedEvents.filter((event) => isPendingReview(event));
      const adminEvents = await buildAdminSubmissionEvents(pending);
      return jsonResponse(adminEvents, { status: 200 });
    }

    let projected = projectPointsFromEvents(scopedEvents);

    if (view === "dedup_candidates") {
      if (!authContext) return errorResponse("Unauthorized", 401);
      const category = normalizeCategory(url.searchParams.get("category") ?? undefined);
      if (!category) return errorResponse("Invalid category", 400);
      const latitude = Number(url.searchParams.get("lat"));
      const longitude = Number(url.searchParams.get("lng"));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return errorResponse("lat and lng are required", 400);
      }
      const name = trimString(url.searchParams.get("name"), 160);
      const probeDetails: SubmissionDetails = {};
      if (name) {
        probeDetails.name = name;
        probeDetails.siteName = name;
        probeDetails.roadName = name;
      }
      const result = buildDedupCandidates(
        category,
        { latitude, longitude },
        probeDetails,
        projected,
      );
      return jsonResponse(result);
    }

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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = submissionInputSchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid submission payload", 400);
  }

  const body = validation.data as SubmissionInput;
  const category = normalizeCategory(body?.category as string | undefined);
  if (!category) {
    return errorResponse("Invalid category", 400);
  }

  const userProfile = await getUserProfile(auth.id);
  if (userProfile?.suspendedUntil && new Date(userProfile.suspendedUntil).getTime() > Date.now()) {
    return errorResponse("Your account is temporarily suspended from submitting data", 403);
  }

  const userRate = await consumeRateLimit({
    route: "POST /api/submissions",
    key: auth.id,
    windowSeconds: 60 * 60,
    max: SUBMISSION_RATE_LIMIT_PER_HOUR,
    request,
    userId: auth.id,
  });
  if (!userRate.allowed) {
    return jsonResponse(
      { error: "Submission rate limit exceeded. Please try again later.", code: "rate_limited" },
      { status: 429, headers: { "retry-after": String(userRate.retryAfterSeconds) } },
    );
  }

  const requestIp = currentRequestIp(request);
  if (requestIp) {
    const ipRate = await consumeRateLimit({
      route: "POST /api/submissions:ip",
      key: requestIp,
      windowSeconds: 60 * 60,
      max: SUBMISSION_IP_RATE_LIMIT_PER_HOUR,
      request,
      userId: auth.id,
    });
    if (!ipRate.allowed) {
      return jsonResponse(
        { error: "Submission rate limit exceeded for this network. Please try again later.", code: "rate_limited" },
        { status: 429, headers: { "retry-after": String(ipRate.retryAfterSeconds) } },
      );
    }
  }

  const eventType = normalizeEventType(body?.eventType);
  const submissionBody = body as unknown as Record<string, unknown>;
  const dedupDecision = normalizeDedupDecision(submissionBody?.dedupDecision);
  const dedupTargetPointId =
    typeof submissionBody?.dedupTargetPointId === "string"
      ? (submissionBody.dedupTargetPointId as string).trim()
      : "";
  const location = parseLocation(body?.location);
  const consentStatus = normalizeConsentStatus(body.consentStatus) ?? "not_required";
  const consentRecordedAt = body.consentRecordedAt ?? new Date().toISOString();
  let details = normalizeEnrichPayload(
    category,
    body?.details && typeof body.details === "object" ? ({ ...(body.details as SubmissionDetails) } as SubmissionDetails) : {},
  );
  if (consentStatus === "refused_pii_only") {
    details = {
      ...stripPiiDetails(details),
      consentStatus,
      consentRecordedAt,
    };
  }
  const requestUserAgent = trimString(request.headers.get("user-agent"), 256);
  const clientDevice = sanitizeClientDevice((details as Record<string, unknown>).clientDevice);
  if (clientDevice) {
    if (!clientDevice.userAgent && requestUserAgent) clientDevice.userAgent = requestUserAgent;
    details.clientDevice = clientDevice;
  } else if ("clientDevice" in details) {
    delete details.clientDevice;
  }
  const gpsIntegrity = sanitizeGpsIntegrity(body.gpsIntegrity);
  if (gpsIntegrity) {
    details.gpsIntegrity = gpsIntegrity;
  }
  if (consentStatus) {
    details.consentStatus = consentStatus;
    details.consentRecordedAt = consentRecordedAt;
  }

  const imageBase64 = body?.imageBase64 as string | undefined;
  if (!imageBase64) return errorResponse("Photo is required", 400);
  const parsedPhoto = parseImagePayload(imageBase64);
  if (!parsedPhoto) return errorResponse("Invalid photo format", 400);
  if (parsedPhoto.imageBuffer.byteLength > MAX_IMAGE_BYTES) {
    return errorResponse(`Photo exceeds maximum size of ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB`, 400);
  }

  const ipInfo = await getIpInfo(request);
  const ipLocation = ipInfo?.location ?? null;
  const ipHash = ipInfo?.ip ? hashIpIdentifier(ipInfo.ip) : null;
  const clientExif = (body as unknown as Record<string, unknown>)?.clientExif as ClientExifData | null | undefined;
  const clientPhotoEvidenceSha256 =
    typeof body.photoEvidenceSha256 === "string" && body.photoEvidenceSha256.trim() ? body.photoEvidenceSha256.trim() : null;
  let photoLocation: SubmissionLocation | null = null;
  let primaryPhotoMetadata: Awaited<ReturnType<typeof extractPhotoMetadata>> | null;

  try {
    primaryPhotoMetadata = await extractPhotoMetadata(parsedPhoto.imageBuffer, {
      source: "upload_buffer",
      mime: parsedPhoto.mime,
      ext: parsedPhoto.ext,
      byteLength: parsedPhoto.imageBuffer.byteLength,
    });
    primaryPhotoMetadata = applyClientExifFallback(primaryPhotoMetadata, clientExif);
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
    primaryPhotoMetadata = {
      gps: null,
      capturedAt: null,
      deviceMake: null,
      deviceModel: null,
      exifStatus: "parse_error",
      exifReason: `Unexpected EXIF extraction failure (mime=${parsedPhoto.mime}; ext=${parsedPhoto.ext}; bytes=${parsedPhoto.imageBuffer.byteLength})`,
      exifSource: "upload_buffer",
    };
    primaryPhotoMetadata = applyClientExifFallback(primaryPhotoMetadata, clientExif);
    if (!primaryPhotoMetadata.gps && !location && !ipLocation) {
      return errorResponse("Unable to read photo GPS metadata", 400);
    }
    if (primaryPhotoMetadata.gps) {
      photoLocation = primaryPhotoMetadata.gps;
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

  const idempotencyKey = trimString(request.headers.get("x-idempotency-key"), 160);
  if (idempotencyKey) {
    const requestHash = hashIdempotencyPayload(body);
    const reservation = await reserveIdempotencyKey({
      userId: auth.id,
      idempotencyKey,
      requestHash,
    });
    if (reservation.status === "conflict") {
      await logSecurityEvent({
        eventType: "idempotency_conflict",
        userId: auth.id,
        request,
        details: { idempotencyKey },
      });
      return errorResponse("This idempotency key was already used for a different submission", 409, {
        code: "idempotency_conflict",
      });
    }
    if (reservation.status === "replay" && reservation.eventId) {
      const replayEvent = (await buildReadableEvents()).find((event) => event.id === reservation.eventId);
      if (replayEvent) {
        return jsonResponse(replayEvent, { status: reservation.responseStatus });
      }
    }
  }

  try {
    const existingEvents = await buildReadableEvents();
    const projectedExisting = projectPointsFromEvents(existingEvents);
    let pointId = typeof body.pointId === "string" && body.pointId.trim()
      ? body.pointId.trim()
      : generatePointId(category, finalLocation.latitude, finalLocation.longitude);
    let effectiveEventType: PointEventType = eventType;
    let allowGaplessEnrich = false;
    const dedupResult = eventType === "CREATE_EVENT"
      ? buildDedupCandidates(category, finalLocation, details, projectedExisting)
      : null;

    if (eventType === "CREATE_EVENT" && dedupDecision === "use_existing") {
      const chosenPointId = dedupTargetPointId || dedupResult?.bestCandidatePointId;
      if (!chosenPointId) {
        return errorResponse("dedupTargetPointId is required when dedupDecision=use_existing", 400);
      }
      const candidate = dedupResult?.candidates.find((item) => item.pointId === chosenPointId);
      if (!candidate) {
        return errorResponse("dedupTargetPointId is not a valid nearby candidate", 400);
      }
      const target = projectedExisting.find((point) => point.pointId === chosenPointId);
      if (!target) return errorResponse("Target point not found", 404);
      if (target.category !== category) return errorResponse("Category mismatch for target point", 400);
      pointId = chosenPointId;
      effectiveEventType = "ENRICH_EVENT";
      allowGaplessEnrich = true;
      details.dedupResolution = "use_existing";
      details.dedupMatchScore = candidate.matchScore;
      details.dedupDistanceMeters = candidate.distanceMeters;
    }

    if (eventType === "CREATE_EVENT" && dedupDecision !== "allow_create" && dedupDecision !== "use_existing") {
      if (dedupResult?.shouldPrompt && dedupResult.candidates.length > 0) {
        const topCandidate = dedupResult.candidates[0];
        const topLabel = topCandidate?.siteName || topCandidate?.pointId || "nearby point";
        return jsonResponse(
          {
            error: `Potential duplicate detected near ${topLabel}`,
            code: "dedup_candidate",
            dedup: dedupResult,
          },
          { status: 409 },
        );
      }
    }

    if (effectiveEventType === "CREATE_EVENT") {
      const createError = validateCreatePayload(category, details);
      if (createError) return errorResponse(createError, 400);
    } else {
      if (!allowGaplessEnrich) {
        if (!body.pointId || typeof body.pointId !== "string" || !body.pointId.trim()) {
          return errorResponse("pointId is required for ENRICH_EVENT", 400);
        }
        pointId = body.pointId.trim();
      }

      const target = projectedExisting.find((point) => point.pointId === pointId);
      if (!target) return errorResponse("Target point not found", 404);
      if (target.category !== category) return errorResponse("Category mismatch for target point", 400);

      const filteredDetails = filterEnrichDetails(category, details);
      if (!Object.keys(filteredDetails).length && !allowGaplessEnrich) {
        return errorResponse("ENRICH_EVENT must include at least one enrichable field", 400);
      }
      if (allowGaplessEnrich) {
        filteredDetails.dedupResolution = "use_existing";
        filteredDetails.dedupTargetPointId = pointId;
        filteredDetails.dedupReviewedAt = new Date().toISOString();
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

    let riskEvaluation;
    try {
      riskEvaluation = await evaluateSubmissionRisk({
        userId: auth.id,
        isAdmin: isAdminUser,
        pointId,
        eventType: effectiveEventType,
        category,
        details,
        finalLocation,
        submissionLocation: location,
        ipLocation,
        photoMetadata: {
          gps: primaryPhotoMetadata?.gps ?? null,
          capturedAt: primaryPhotoMetadata?.capturedAt ?? null,
          deviceMake: primaryPhotoMetadata?.deviceMake ?? null,
          deviceModel: primaryPhotoMetadata?.deviceModel ?? null,
        },
        clientDevice,
        imageBuffer: parsedPhoto.imageBuffer,
        ipHash,
        ipReputation: ipInfo
          ? {
              asn: ipInfo.asn,
              org: ipInfo.org,
              isDatacenter: ipInfo.isDatacenter,
              isVpn: ipInfo.isVpn,
              isTor: ipInfo.isTor,
            }
          : null,
        hasSecondaryPhoto: Boolean(body?.secondImageBase64),
      });
    } catch (riskError) {
      console.warn("Submission risk engine fallback activated", riskError);
      riskEvaluation = {
        shouldBlock: false,
        blockCode: null,
        blockReason: null,
        imageHash: computeImageSha256(parsedPhoto.imageBuffer),
        contentHash: computeEventContentHash({
          pointId,
          category,
          eventType: effectiveEventType,
          location: finalLocation,
          details,
        }),
        reviewStatus: "pending_review",
        reviewFlags: ["risk_engine_unavailable"],
        riskScore: 55,
        exifTrustScore: 0,
        velocity: {
          user15m: 0,
          device15m: null,
          ip15m: null,
          deviceDistinctUsers15m: null,
          ipDistinctUsers15m: null,
        },
        impossibleTravelSpeedKmh: null,
        riskComponents: {
          locationRisk: 0,
          photoRisk: 0,
          temporalRisk: 0,
          userRisk: 0,
          behavioralRisk: 0,
        },
      };
    }

    const supplementalReviewFlags: string[] = [];
    let effectiveReviewStatus = riskEvaluation.reviewStatus;
    let effectiveRiskScore = riskEvaluation.riskScore;

    if (clientPhotoEvidenceSha256 && clientPhotoEvidenceSha256 !== riskEvaluation.imageHash) {
      supplementalReviewFlags.push("client_photo_hash_mismatch");
      effectiveRiskScore = Math.max(effectiveRiskScore, 70);
      effectiveReviewStatus = "pending_review";
    }

    if (gpsIntegrity?.mockLocationDetected) {
      supplementalReviewFlags.push("mock_location_detected");
      effectiveRiskScore = Math.max(effectiveRiskScore, 75);
      effectiveReviewStatus = "pending_review";
    }
    if (gpsIntegrity?.gpsAccuracyMeters !== null && gpsIntegrity?.gpsAccuracyMeters !== undefined && gpsIntegrity.gpsAccuracyMeters > 75) {
      supplementalReviewFlags.push("poor_gps_accuracy");
      effectiveRiskScore = Math.max(effectiveRiskScore, 45);
      effectiveReviewStatus = "pending_review";
    }
    if ((userProfile?.trustScore ?? 50) <= 20) {
      supplementalReviewFlags.push("restricted_agent");
      effectiveRiskScore = Math.max(effectiveRiskScore, 65);
      effectiveReviewStatus = "pending_review";
    }
    if (consentStatus === "refused_pii_only") {
      supplementalReviewFlags.push("consent_refused_pii_only");
    }

    riskEvaluation.reviewFlags = withReviewFlags(riskEvaluation.reviewFlags, supplementalReviewFlags);
    riskEvaluation.reviewStatus = effectiveReviewStatus;
    riskEvaluation.riskScore = effectiveRiskScore;

    if (riskEvaluation.shouldBlock) {
      const blockCode = riskEvaluation.blockCode ?? "blocked";
      try {
        await logBlockedSubmission({
          userId: auth.id,
          blockCode,
          riskScore: riskEvaluation.riskScore,
          riskComponents: riskEvaluation.riskComponents,
          notes: riskEvaluation.blockReason,
        });
      } catch (auditError) {
        console.warn("Unable to write blocked submission audit log", auditError);
      }
      await createFraudAlert({
        userId: auth.id,
        alertCode: blockCode,
        severity: "high",
        payload: {
          reason: riskEvaluation.blockReason,
          riskScore: riskEvaluation.riskScore,
          reviewFlags: riskEvaluation.reviewFlags,
        },
      });
      return errorResponse(
        riskEvaluation.blockReason ?? "Submission blocked by fraud controls",
        blockStatusFromCode(blockCode),
      );
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
        secondaryPhotoMetadata = await extractPhotoMetadata(parsedSecondPhoto.imageBuffer, {
          source: "upload_buffer",
          mime: parsedSecondPhoto.mime,
          ext: parsedSecondPhoto.ext,
          byteLength: parsedSecondPhoto.imageBuffer.byteLength,
        });
      } catch {
        secondaryPhotoMetadata = {
          gps: null,
          capturedAt: null,
          deviceMake: null,
          deviceModel: null,
          exifStatus: "parse_error",
          exifReason: `Unexpected EXIF extraction failure (mime=${parsedSecondPhoto.mime}; ext=${parsedSecondPhoto.ext}; bytes=${parsedSecondPhoto.imageBuffer.byteLength})`,
          exifSource: "upload_buffer",
        };
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
    details.imageSha256 = riskEvaluation.imageHash;
    details.contentHash = riskEvaluation.contentHash;
    details.reviewStatus = riskEvaluation.reviewStatus;
    details.reviewFlags = riskEvaluation.reviewFlags;
    details.riskScore = riskEvaluation.riskScore;
    details.riskComponents = riskEvaluation.riskComponents as unknown as Record<string, unknown>;
    details.exifTrustScore = riskEvaluation.exifTrustScore;
    details.velocitySignals = riskEvaluation.velocity as unknown as Record<string, unknown>;
    details.consentStatus = consentStatus;
    details.consentRecordedAt = consentRecordedAt;
    if (gpsIntegrity) details.gpsIntegrity = gpsIntegrity;
    if (clientPhotoEvidenceSha256) details.photoEvidenceSha256 = clientPhotoEvidenceSha256;
    if (userProfile?.trustScore !== undefined) {
      details.agentTrustScore = userProfile.trustScore;
      details.agentTrustTier = getTrustTier(userProfile.trustScore);
    }
    details.ipHash = ipHash ?? undefined;
    if (ipInfo) {
      details.ipReputation = {
        asn: ipInfo.asn,
        org: ipInfo.org,
        isDatacenter: ipInfo.isDatacenter,
        isVpn: ipInfo.isVpn,
        isTor: ipInfo.isTor,
      };
    }

    const xpAwarded = riskEvaluation.reviewStatus === "auto_approved" ? BASE_EVENT_XP : 0;
    details.xpAwarded = xpAwarded;

    const now = new Date().toISOString();
    const newEvent: PointEvent = {
      id: eventId,
      pointId,
      eventType: effectiveEventType,
      userId: auth.id,
      category,
      location: finalLocation,
      details,
      photoUrl,
      createdAt: now,
      source: typeof details.source === "string" ? details.source : undefined,
      externalId: typeof details.externalId === "string" ? details.externalId : undefined,
      consentStatus,
      consentRecordedAt,
    };

    const projectedWithNewEvent = projectPointsFromEvents([...existingEvents, newEvent]);
    const projectedPoint = projectedWithNewEvent.find((point) => point.pointId === pointId);
    if (projectedPoint) {
      const confidenceScore = computeConfidenceScore(projectedPoint, new Date(now));
      newEvent.details = { ...newEvent.details, confidenceScore, lastSeenAt: now };
    }

    await insertPointEvent(newEvent);
    if (idempotencyKey) {
      await completeIdempotencyKey({
        userId: auth.id,
        idempotencyKey,
        eventId,
      });
    }
    try {
      await incrementAssignmentsForEvent(newEvent);
    } catch (assignmentError) {
      console.warn("Unable to update assignment progress from submission", assignmentError);
    }
    try {
      await persistSubmissionRiskArtifacts({
        eventId,
        pointId,
        userId: auth.id,
        imageHash: riskEvaluation.imageHash,
        contentHash: riskEvaluation.contentHash,
        reviewStatus: riskEvaluation.reviewStatus,
        reviewFlags: riskEvaluation.reviewFlags,
        riskScore: riskEvaluation.riskScore,
        riskComponents: riskEvaluation.riskComponents,
        clientDevice,
      });
    } catch (riskPersistError) {
      console.warn("Unable to persist submission risk artifacts", riskPersistError);
    }
    if (riskEvaluation.reviewStatus === "pending_review" || riskEvaluation.reviewFlags.length > 0) {
      await createFraudAlert({
        eventId,
        userId: auth.id,
        alertCode: "submission_pending_review",
        severity: riskEvaluation.riskScore >= 70 ? "high" : "medium",
        payload: {
          category,
          riskScore: riskEvaluation.riskScore,
          reviewFlags: riskEvaluation.reviewFlags,
        },
      });
      await logSecurityEvent({
        eventType: "submission_flagged",
        userId: auth.id,
        request,
        details: {
          eventId,
          riskScore: riskEvaluation.riskScore,
          reviewFlags: riskEvaluation.reviewFlags,
        },
      });
    }

    const exifDeviceMake = primaryPhotoMetadata?.deviceMake ?? null;
    const exifDeviceModel = primaryPhotoMetadata?.deviceModel ?? null;
    const logPayload = {
      eventId,
      userId: auth.id,
      category,
      reviewStatus: riskEvaluation.reviewStatus,
      reviewFlags: riskEvaluation.reviewFlags,
      riskScore: riskEvaluation.riskScore,
      deviceId: clientDevice?.deviceId ?? null,
      clientPlatform: clientDevice?.platform ?? null,
      clientUserAgent: clientDevice?.userAgent ?? requestUserAgent ?? null,
      clientMemoryGb: clientDevice?.deviceMemoryGb ?? null,
      clientCpuCores: clientDevice?.hardwareConcurrency ?? null,
      clientIsLowEnd: clientDevice?.isLowEnd ?? null,
      exifDeviceMake,
      exifDeviceModel,
    };
    if (process.env.NODE_ENV !== "production") {
      console.info("[SUBMISSION_DEVICE]", JSON.stringify(logPayload));
    }

    const profile = await getUserProfile(auth.id);
    if (profile) {
      await reconcileUserProfileXp(auth.id, { profile });
    }

    return jsonResponse(newEvent, { status: 201 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    captureServerException(error, { route: "submissions_post", userId: auth.id });
    throw error;
  }
}
