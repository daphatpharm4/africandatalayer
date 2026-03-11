import { createHash } from "node:crypto";
import { query } from "./db.js";
import { haversineKm, computePhotoFreshnessScore, detectPhotoManipulation } from "./submissionFraud.js";
import { validateGps } from "./gpsValidation.js";
import type {
  ClientDeviceInfo,
  GpsIntegrityReport,
  PointEventType,
  SubmissionCategory,
  SubmissionDetails,
  SubmissionLocation,
} from "../../shared/types.js";

const USER_VELOCITY_FLAG_THRESHOLD = Number(process.env.FRAUD_USER_VELOCITY_FLAG ?? "5") || 5;
const USER_VELOCITY_BLOCK_THRESHOLD = Number(process.env.FRAUD_USER_VELOCITY_BLOCK ?? "15") || 15;
const DEVICE_VELOCITY_FLAG_THRESHOLD = Number(process.env.FRAUD_DEVICE_VELOCITY_FLAG ?? "8") || 8;
const IP_VELOCITY_FLAG_THRESHOLD = Number(process.env.FRAUD_IP_VELOCITY_FLAG ?? "12") || 12;
const VELOCITY_WINDOW_MINUTES = Number(process.env.FRAUD_VELOCITY_WINDOW_MINUTES ?? "15") || 15;

const IMPOSSIBLE_TRAVEL_FLAG_KMH = Number(process.env.FRAUD_TRAVEL_FLAG_KMH ?? "80") || 80;
const IMPOSSIBLE_TRAVEL_BLOCK_KMH = Number(process.env.FRAUD_TRAVEL_BLOCK_KMH ?? "200") || 200;

const EXIF_TRUST_FLAG_THRESHOLD = Number(process.env.FRAUD_EXIF_TRUST_FLAG_THRESHOLD ?? "70") || 70;
const REVIEW_RISK_THRESHOLD = Number(process.env.FRAUD_REVIEW_RISK_THRESHOLD ?? "40") || 40;

const FUEL_PRICE_RANGE_XAF: Record<string, { min: number; max: number }> = {
  super: { min: 500, max: 1000 },
  gasoil: { min: 450, max: 900 },
  diesel: { min: 450, max: 900 },
  kerosene: { min: 400, max: 800 },
};

const HASH_DETAIL_OMIT_KEYS = new Set([
  "fraudCheck",
  "clientDevice",
  "confidenceScore",
  "lastSeenAt",
  "reviewFlags",
  "reviewStatus",
  "riskScore",
  "riskComponents",
  "xpAwarded",
  "imageSha256",
  "contentHash",
  "ipHash",
]);

export type ReviewStatus = "auto_approved" | "pending_review";

export interface RiskComponents {
  locationRisk: number;
  photoRisk: number;
  temporalRisk: number;
  userRisk: number;
  behavioralRisk: number;
}

export interface SubmissionRiskInput {
  userId: string;
  isAdmin: boolean;
  pointId: string;
  eventType: PointEventType;
  category: SubmissionCategory;
  details: SubmissionDetails;
  finalLocation: SubmissionLocation;
  submissionLocation: SubmissionLocation | null;
  ipLocation: SubmissionLocation | null;
  photoMetadata: {
    gps: SubmissionLocation | null;
    capturedAt: string | null;
    deviceMake: string | null;
    deviceModel: string | null;
  };
  clientDevice: ClientDeviceInfo | null;
  imageBuffer: Buffer;
  ipHash: string | null;
  ipReputation: {
    asn: string | null;
    org: string | null;
    isDatacenter: boolean;
    isVpn: boolean;
    isTor: boolean;
  } | null;
  hasSecondaryPhoto: boolean;
  gpsIntegrity: GpsIntegrityReport | null;
  photoExifExtra?: {
    software?: string | null;
    imageWidth?: number | null;
    imageHeight?: number | null;
    fileSize?: number | null;
  } | null;
}

export type XpAction = "award" | "escrow" | "deny";

export interface SubmissionRiskEvaluation {
  shouldBlock: boolean;
  blockCode: string | null;
  blockReason: string | null;
  imageHash: string;
  contentHash: string;
  reviewStatus: ReviewStatus;
  reviewFlags: string[];
  riskScore: number;
  exifTrustScore: number;
  xpAction: XpAction;
  velocity: {
    user15m: number;
    device15m: number | null;
    ip15m: number | null;
    deviceDistinctUsers15m: number | null;
    ipDistinctUsers15m: number | null;
  };
  impossibleTravelSpeedKmh: number | null;
  riskComponents: RiskComponents;
}

export interface PersistSubmissionRiskInput {
  eventId: string;
  pointId: string;
  userId: string;
  imageHash: string;
  contentHash: string;
  reviewStatus: ReviewStatus;
  reviewFlags: string[];
  riskScore: number;
  riskComponents: RiskComponents;
  clientDevice: ClientDeviceInfo | null;
  perceptualHash?: string | null;
  imageBuffer?: Buffer;
}

function toNumber(input: unknown, fallback = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toInt(input: unknown, fallback = 0): number {
  return Math.max(0, Math.round(toNumber(input, fallback)));
}

function normalizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toLowerCase();
}

function isMissingDbObjectError(error: unknown): boolean {
  const pg = error as { code?: unknown; message?: unknown } | null;
  const code = typeof pg?.code === "string" ? pg.code : "";
  if (code === "42P01" || code === "42703") return true;
  const message = typeof pg?.message === "string" ? pg.message.toLowerCase() : "";
  return message.includes("does not exist") || message.includes("undefined column") || message.includes("undefined table");
}

function isUniqueViolationError(error: unknown): boolean {
  const pg = error as { code?: unknown } | null;
  return pg?.code === "23505";
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const out: Record<string, unknown> = {};
  for (const [key, nextValue] of entries) {
    out[key] = stableSort(nextValue);
  }
  return out;
}

function sanitizeDetailsForContentHash(details: SubmissionDetails): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    if (HASH_DETAIL_OMIT_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

function hashText(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function computeImageSha256(imageBuffer: Buffer): string {
  return createHash("sha256").update(imageBuffer).digest("hex");
}

export async function computePerceptualHash(imageBuffer: Buffer): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(imageBuffer)
      .resize(8, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = Array.from(data);
    const mean = pixels.reduce((sum, v) => sum + v, 0) / pixels.length;
    let hash = "";
    for (const pixel of pixels) {
      hash += pixel >= mean ? "1" : "0";
    }
    // Convert binary string to hex
    let hex = "";
    for (let i = 0; i < hash.length; i += 4) {
      hex += parseInt(hash.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length);
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const aBits = parseInt(a[i]!, 16).toString(2).padStart(4, "0");
    const bBits = parseInt(b[i]!, 16).toString(2).padStart(4, "0");
    for (let j = 0; j < 4; j++) {
      if (aBits[j] !== bBits[j]) distance++;
    }
  }
  return distance;
}

export function computeEventContentHash(input: {
  pointId: string;
  category: SubmissionCategory;
  eventType: PointEventType;
  location: SubmissionLocation;
  details: SubmissionDetails;
}): string {
  const stablePayload = {
    pointId: input.pointId,
    category: input.category,
    eventType: input.eventType,
    latitude: Number(input.location.latitude.toFixed(6)),
    longitude: Number(input.location.longitude.toFixed(6)),
    details: sanitizeDetailsForContentHash(input.details),
  };
  return hashText(JSON.stringify(stableSort(stablePayload)));
}

export function hashIpIdentifier(ip: string): string {
  return createHash("sha256").update(ip.trim()).digest("hex").slice(0, 32);
}

export function computeExifTrustScore(input: {
  gps: SubmissionLocation | null;
  capturedAt: string | null;
  deviceMake: string | null;
  deviceModel: string | null;
  isLowEnd: boolean;
}): number {
  let score = 100;
  if (!input.gps) score -= 30;
  if (!input.capturedAt) score -= 20;
  if (!input.deviceMake) score -= 15;
  if (!input.deviceModel) score -= 15;
  if (input.isLowEnd && score < 50) {
    score = Math.min(score + 20, 50);
  }
  return Math.max(0, score);
}

function buildRiskScore(components: RiskComponents): number {
  const weighted =
    0.25 * components.locationRisk +
    0.25 * components.photoRisk +
    0.15 * components.temporalRisk +
    0.20 * components.userRisk +
    0.15 * components.behavioralRisk;
  return Math.round(weighted);
}

async function getUserVelocityCount(userId: string): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM point_events
     WHERE user_id = $1
       AND created_at > NOW() - make_interval(mins => $2::int)`,
    [userId, VELOCITY_WINDOW_MINUTES],
  );
  return toInt(result.rows[0]?.count, 0);
}

async function getDeviceVelocityStats(deviceId: string): Promise<{ count: number; distinctUsers: number }> {
  try {
    const result = await query<{ count: number; distinct_users: number }>(
      `SELECT
         COUNT(*)::int AS count,
         COUNT(DISTINCT user_id)::int AS distinct_users
       FROM point_events
       WHERE details #>> '{clientDevice,deviceId}' = $1
         AND created_at > NOW() - make_interval(mins => $2::int)`,
      [deviceId, VELOCITY_WINDOW_MINUTES],
    );
    return {
      count: toInt(result.rows[0]?.count, 0),
      distinctUsers: toInt(result.rows[0]?.distinct_users, 0),
    };
  } catch (error) {
    if (isMissingDbObjectError(error)) return { count: 0, distinctUsers: 0 };
    throw error;
  }
}

async function getIpVelocityStats(ipHash: string): Promise<{ count: number; distinctUsers: number }> {
  try {
    const result = await query<{ count: number; distinct_users: number }>(
      `SELECT
         COUNT(*)::int AS count,
         COUNT(DISTINCT user_id)::int AS distinct_users
       FROM point_events
       WHERE details->>'ipHash' = $1
         AND created_at > NOW() - make_interval(mins => $2::int)`,
      [ipHash, VELOCITY_WINDOW_MINUTES],
    );
    return {
      count: toInt(result.rows[0]?.count, 0),
      distinctUsers: toInt(result.rows[0]?.distinct_users, 0),
    };
  } catch (error) {
    if (isMissingDbObjectError(error)) return { count: 0, distinctUsers: 0 };
    throw error;
  }
}

async function getLastSubmissionByUser(userId: string): Promise<{ location: SubmissionLocation; createdAt: string } | null> {
  const result = await query<{ latitude: number; longitude: number; created_at: string }>(
    `SELECT latitude, longitude, created_at
     FROM point_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    location: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
    createdAt: row.created_at,
  };
}

async function getDuplicateImageMatches(imageHash: string): Promise<Array<{ eventId: string; pointId: string; userId: string }>> {
  try {
    const result = await query<{ event_id: string; point_id: string; user_id: string }>(
      `SELECT event_id::text, point_id, user_id
       FROM submission_image_hashes
       WHERE sha256_hash = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [imageHash],
    );
    return result.rows.map((row) => ({ eventId: row.event_id, pointId: row.point_id, userId: row.user_id }));
  } catch (error) {
    if (isMissingDbObjectError(error)) return [];
    throw error;
  }
}

async function getPerceptualHashMatches(perceptualHash: string): Promise<Array<{ eventId: string; pointId: string; hash: string }>> {
  try {
    const result = await query<{ event_id: string; point_id: string; perceptual_hash: string }>(
      `SELECT event_id::text, point_id, perceptual_hash
       FROM submission_image_hashes
       WHERE perceptual_hash IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    return result.rows
      .filter((row) => hammingDistance(row.perceptual_hash, perceptualHash) <= 5)
      .map((row) => ({ eventId: row.event_id, pointId: row.point_id, hash: row.perceptual_hash }));
  } catch (error) {
    if (isMissingDbObjectError(error)) return [];
    throw error;
  }
}

async function getUserRiskStats(userId: string): Promise<{ accountAgeDays: number; totalSubmissions: number; priorFraudFlags: number }> {
  let accountAgeDays = 0;
  try {
    const accountResult = await query<{ account_age_days: number }>(
      `SELECT EXTRACT(EPOCH FROM (NOW() - COALESCE(created_at, NOW()))) / 86400.0 AS account_age_days
       FROM user_profiles
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );
    accountAgeDays = toNumber(accountResult.rows[0]?.account_age_days, 0);
  } catch (error) {
    if (!isMissingDbObjectError(error)) throw error;
  }

  const totalResult = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM point_events WHERE user_id = $1`,
    [userId],
  );
  const totalSubmissions = toInt(totalResult.rows[0]?.total, 0);

  let priorFraudFlags = 0;
  try {
    const fraudResult = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM fraud_audit_log
       WHERE user_id = $1
         AND action IN ('flagged', 'blocked')`,
      [userId],
    );
    priorFraudFlags = toInt(fraudResult.rows[0]?.total, 0);
  } catch (error) {
    if (!isMissingDbObjectError(error)) throw error;
  }

  return { accountAgeDays, totalSubmissions, priorFraudFlags };
}

async function getSelfEnrichmentStats(userId: string, pointId: string): Promise<{ recentSelfEnrichments: number; ownsPoint: boolean }> {
  const result = await query<{ recent_self_enrichments: number; owns_point: boolean }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE event_type = 'ENRICH_EVENT'
           AND user_id = $1
           AND created_at > NOW() - INTERVAL '24 hours'
       )::int AS recent_self_enrichments,
       BOOL_OR(event_type = 'CREATE_EVENT' AND user_id = $1) AS owns_point
     FROM point_events
     WHERE point_id = $2`,
    [userId, pointId],
  );
  return {
    recentSelfEnrichments: toInt(result.rows[0]?.recent_self_enrichments, 0),
    ownsPoint: result.rows[0]?.owns_point === true,
  };
}

function evaluateFieldPlausibility(category: SubmissionCategory, details: SubmissionDetails): { block: string | null; flags: string[] } {
  if (category !== "fuel_station") return { block: null, flags: [] };
  const flags: string[] = [];

  const pricesByFuel = details.pricesByFuel;
  if (!pricesByFuel || typeof pricesByFuel !== "object") return { block: null, flags };

  for (const [fuelTypeRaw, value] of Object.entries(pricesByFuel as Record<string, unknown>)) {
    const fuelType = normalizeText(fuelTypeRaw);
    const numeric = toNumber(value, NaN);
    if (!Number.isFinite(numeric)) continue;
    if (numeric <= 0 || numeric > 10_000) {
      return { block: `invalid_fuel_price_${fuelType || "unknown"}`, flags };
    }
    const range = FUEL_PRICE_RANGE_XAF[fuelType];
    if (!range) continue;
    if (numeric < range.min * 0.5 || numeric > range.max * 2) {
      flags.push("implausible_fuel_price");
    }
  }

  return { block: null, flags: Array.from(new Set(flags)) };
}

function blockDetailsForCode(code: string): { reason: string; status: number } {
  if (code === "duplicate_photo") {
    return { reason: "This photo has already been used for another submission", status: 409 };
  }
  if (code === "velocity_limit") {
    return { reason: "Submission rate too high. Please wait and retry.", status: 429 };
  }
  if (code === "impossible_travel") {
    return { reason: "Submission blocked due to impossible travel pattern", status: 409 };
  }
  if (code === "tor_exit_ip") {
    return { reason: "Submission blocked from Tor exit node", status: 403 };
  }
  if (code.startsWith("invalid_fuel_price")) {
    return { reason: "Invalid fuel price value", status: 400 };
  }
  return { reason: "Submission blocked by fraud controls", status: 400 };
}

export async function evaluateSubmissionRisk(input: SubmissionRiskInput): Promise<SubmissionRiskEvaluation> {
  const imageHash = computeImageSha256(input.imageBuffer);
  const contentHash = computeEventContentHash({
    pointId: input.pointId,
    category: input.category,
    eventType: input.eventType,
    location: input.finalLocation,
    details: input.details,
  });

  const [
    userVelocity,
    lastSubmission,
    duplicateMatches,
    userRiskStats,
    selfEnrichment,
    deviceVelocity,
    ipVelocity,
  ] = await Promise.all([
    getUserVelocityCount(input.userId),
    getLastSubmissionByUser(input.userId),
    getDuplicateImageMatches(imageHash),
    getUserRiskStats(input.userId),
    getSelfEnrichmentStats(input.userId, input.pointId),
    input.clientDevice?.deviceId ? getDeviceVelocityStats(input.clientDevice.deviceId) : Promise.resolve({ count: 0, distinctUsers: 0 }),
    input.ipHash ? getIpVelocityStats(input.ipHash) : Promise.resolve({ count: 0, distinctUsers: 0 }),
  ]);

  const reviewFlags = new Set<string>();
  const blockingCodes = new Set<string>();

  let locationRisk = 0;
  if (!input.submissionLocation) locationRisk += 15;
  if (!input.photoMetadata.gps) locationRisk += 20;
  if (!input.ipLocation) locationRisk += 10;

  if (input.submissionLocation && input.photoMetadata.gps) {
    const distance = haversineKm(input.submissionLocation, input.photoMetadata.gps);
    if (distance > 1) {
      locationRisk += 40;
      reviewFlags.add("gps_mismatch");
    } else if (distance > 0.5) {
      locationRisk += 15;
      reviewFlags.add("gps_marginal_match");
    }
  }

  if (input.ipLocation && input.photoMetadata.gps) {
    const ipDistance = haversineKm(input.ipLocation, input.photoMetadata.gps);
    if (ipDistance > 50) {
      locationRisk += 30;
      reviewFlags.add("ip_photo_mismatch");
    } else if (ipDistance > 20) {
      locationRisk += 10;
      reviewFlags.add("ip_photo_marginal_match");
    }
  }

  if (input.ipReputation?.isDatacenter || input.ipReputation?.isVpn) {
    locationRisk += 10;
    reviewFlags.add("suspicious_ip_org");
  }
  if (input.ipReputation?.isTor) {
    locationRisk += 40;
    blockingCodes.add("tor_exit_ip");
  }
  // 6A: GPS validation integration
  const gpsValidation = validateGps({
    submissionLocation: input.submissionLocation,
    photoLocation: input.photoMetadata.gps,
    gpsIntegrity: input.gpsIntegrity,
  });
  if (gpsValidation.score < 50) {
    locationRisk += Math.round((100 - gpsValidation.score) * 0.3);
    for (const flag of gpsValidation.flags) reviewFlags.add(`gps_${flag}`);
  }
  if (gpsValidation.mockDetected) {
    reviewFlags.add("gps_mock_detected");
  }
  locationRisk = Math.min(100, locationRisk);

  let photoRisk = 0;
  if (!input.photoMetadata.gps) photoRisk += 15;
  if (!input.photoMetadata.capturedAt) photoRisk += 10;
  if (!input.photoMetadata.deviceMake) photoRisk += 10;
  if (!input.photoMetadata.deviceModel) photoRisk += 10;

  const duplicateForDifferentPoint = duplicateMatches.some((row) => row.pointId !== input.pointId);
  if (duplicateForDifferentPoint) {
    photoRisk += 80;
    blockingCodes.add("duplicate_photo");
  }
  const duplicateForSamePoint = duplicateMatches.some((row) => row.pointId === input.pointId);
  if (duplicateForSamePoint) {
    reviewFlags.add("duplicate_photo_same_point");
    photoRisk += 25;
  }

  // 6B: Photo freshness scoring
  const freshnessScore = computePhotoFreshnessScore(
    input.photoMetadata.capturedAt,
    new Date().toISOString(),
  );
  if (freshnessScore < 30) {
    photoRisk += 20;
    reviewFlags.add("stale_photo");
  } else if (freshnessScore < 60) {
    photoRisk += 10;
    reviewFlags.add("aging_photo");
  }

  // 6C: Screenshot & editing detection
  const manipulation = detectPhotoManipulation({
    gps: input.photoMetadata.gps,
    capturedAt: input.photoMetadata.capturedAt,
    deviceMake: input.photoMetadata.deviceMake,
    deviceModel: input.photoMetadata.deviceModel,
    software: input.photoExifExtra?.software ?? null,
    imageWidth: input.photoExifExtra?.imageWidth ?? null,
    imageHeight: input.photoExifExtra?.imageHeight ?? null,
    fileSize: input.photoExifExtra?.fileSize ?? null,
  });
  if (manipulation.isScreenshot) {
    photoRisk += 25;
    reviewFlags.add("screenshot_detected");
  }
  if (manipulation.isEdited) {
    photoRisk += 20;
    reviewFlags.add("editing_software_detected");
  }
  if (manipulation.isDownloaded) {
    photoRisk += 15;
    reviewFlags.add("downloaded_image_detected");
  }

  if (input.clientDevice?.isLowEnd && photoRisk > 0 && photoRisk <= 35) {
    photoRisk = Math.max(0, photoRisk - 10);
  }
  photoRisk = Math.min(100, photoRisk);

  let temporalRisk = 0;
  if (userVelocity >= USER_VELOCITY_BLOCK_THRESHOLD) {
    temporalRisk += 60;
    blockingCodes.add("velocity_limit");
  } else if (userVelocity >= USER_VELOCITY_FLAG_THRESHOLD) {
    temporalRisk += 30;
    reviewFlags.add("high_user_velocity");
  } else if (userVelocity >= 3) {
    temporalRisk += 10;
  }

  if (deviceVelocity.count >= DEVICE_VELOCITY_FLAG_THRESHOLD) {
    temporalRisk += 15;
    reviewFlags.add("high_device_velocity");
  }
  if (deviceVelocity.distinctUsers >= 2) {
    temporalRisk += 10;
    reviewFlags.add("shared_device");
  }

  if (ipVelocity.count >= IP_VELOCITY_FLAG_THRESHOLD) {
    temporalRisk += 10;
    reviewFlags.add("high_ip_velocity");
  }
  if (ipVelocity.distinctUsers >= 3) {
    temporalRisk += 10;
    reviewFlags.add("shared_ip");
  }

  let impossibleTravelSpeedKmh: number | null = null;
  if (lastSubmission) {
    const distanceKm = haversineKm(lastSubmission.location, input.finalLocation);
    const elapsedHours =
      (Date.now() - new Date(lastSubmission.createdAt).getTime()) / (1000 * 60 * 60);
    if (elapsedHours > 0) {
      impossibleTravelSpeedKmh = distanceKm / elapsedHours;
      if (impossibleTravelSpeedKmh > IMPOSSIBLE_TRAVEL_BLOCK_KMH) {
        temporalRisk += 50;
        blockingCodes.add("impossible_travel");
      } else if (impossibleTravelSpeedKmh > IMPOSSIBLE_TRAVEL_FLAG_KMH) {
        temporalRisk += 25;
        reviewFlags.add("impossible_travel");
      }
    }
  }
  temporalRisk = Math.min(100, temporalRisk);

  let userRisk = 0;
  if (userRiskStats.accountAgeDays < 1) userRisk += 25;
  else if (userRiskStats.accountAgeDays < 7) userRisk += 15;
  else if (userRiskStats.accountAgeDays < 30) userRisk += 5;

  if (userRiskStats.totalSubmissions === 0) userRisk += 15;
  else if (userRiskStats.totalSubmissions < 5) userRisk += 8;

  if (userRiskStats.priorFraudFlags >= 5) {
    userRisk += 40;
    reviewFlags.add("repeat_fraud_pattern");
  } else if (userRiskStats.priorFraudFlags >= 1) {
    userRisk += 20;
    reviewFlags.add("historical_fraud_flags");
  }
  userRisk = Math.min(100, userRisk);

  let behavioralRisk = 0;
  if (input.eventType === "ENRICH_EVENT" && selfEnrichment.ownsPoint) {
    behavioralRisk += 20;
    reviewFlags.add("self_enrichment");
    if (selfEnrichment.recentSelfEnrichments >= 3) {
      behavioralRisk += 25;
      reviewFlags.add("self_enrichment_loop");
    }
    if (selfEnrichment.recentSelfEnrichments >= 5) {
      blockingCodes.add("velocity_limit");
    }
  }

  const plausibility = evaluateFieldPlausibility(input.category, input.details);
  if (plausibility.block) {
    blockingCodes.add(plausibility.block);
  }
  for (const flag of plausibility.flags) reviewFlags.add(flag);

  const exifTrustScore = computeExifTrustScore({
    gps: input.photoMetadata.gps,
    capturedAt: input.photoMetadata.capturedAt,
    deviceMake: input.photoMetadata.deviceMake,
    deviceModel: input.photoMetadata.deviceModel,
    isLowEnd: input.clientDevice?.isLowEnd === true,
  });

  if (exifTrustScore < EXIF_TRUST_FLAG_THRESHOLD) {
    reviewFlags.add("low_exif_trust");
    behavioralRisk += exifTrustScore < 40 ? 25 : 10;
    if (exifTrustScore < 40 && !input.hasSecondaryPhoto) {
      reviewFlags.add("secondary_photo_recommended");
    }
  }

  behavioralRisk = Math.min(100, behavioralRisk);

  const riskComponents: RiskComponents = {
    locationRisk,
    photoRisk,
    temporalRisk,
    userRisk,
    behavioralRisk,
  };

  const riskScore = buildRiskScore(riskComponents);
  const shouldReview = reviewFlags.size > 0 || riskScore >= REVIEW_RISK_THRESHOLD;

  if (input.isAdmin && blockingCodes.size > 0) {
    for (const code of blockingCodes) {
      reviewFlags.add(`admin_bypass_${code}`);
    }
    reviewFlags.add("admin_bypass");
    blockingCodes.clear();
  }

  // 6D: Perceptual hash duplicate detection
  try {
    const perceptualHash = await computePerceptualHash(input.imageBuffer);
    if (perceptualHash) {
      const perceptualMatches = await getPerceptualHashMatches(perceptualHash);
      const nearDuplicate = perceptualMatches.some((row) => row.pointId !== input.pointId);
      if (nearDuplicate) {
        photoRisk = Math.min(100, photoRisk + 30);
        reviewFlags.add("perceptual_near_duplicate");
      }
    }
  } catch {
    // Perceptual hashing is best-effort; don't block submissions if sharp fails
  }

  const firstBlockCode = blockingCodes.values().next().value ?? null;
  const block = firstBlockCode ? blockDetailsForCode(firstBlockCode) : null;

  // 6E: XP escrow logic
  let xpAction: XpAction;
  if (firstBlockCode) {
    xpAction = "deny";
  } else if (riskScore > 75) {
    xpAction = "deny";
  } else if (riskScore > 50) {
    xpAction = "escrow";
  } else {
    xpAction = "award";
  }

  return {
    shouldBlock: Boolean(firstBlockCode),
    blockCode: firstBlockCode,
    blockReason: block?.reason ?? null,
    imageHash,
    contentHash,
    reviewStatus: shouldReview ? "pending_review" : "auto_approved",
    reviewFlags: Array.from(reviewFlags),
    riskScore,
    exifTrustScore,
    xpAction,
    velocity: {
      user15m: userVelocity,
      device15m: input.clientDevice?.deviceId ? deviceVelocity.count : null,
      ip15m: input.ipHash ? ipVelocity.count : null,
      deviceDistinctUsers15m: input.clientDevice?.deviceId ? deviceVelocity.distinctUsers : null,
      ipDistinctUsers15m: input.ipHash ? ipVelocity.distinctUsers : null,
    },
    impossibleTravelSpeedKmh,
    riskComponents,
  };
}

async function persistContentHash(eventId: string, contentHash: string): Promise<void> {
  try {
    await query(
      `UPDATE point_events
       SET content_hash = $2
       WHERE id = $1::uuid`,
      [eventId, contentHash],
    );
  } catch (error) {
    if (isMissingDbObjectError(error)) return;
    throw error;
  }
}

async function insertImageHashRecord(input: PersistSubmissionRiskInput): Promise<void> {
  try {
    let perceptualHash = input.perceptualHash ?? null;
    if (!perceptualHash && input.imageBuffer) {
      try {
        perceptualHash = await computePerceptualHash(input.imageBuffer);
      } catch {
        // Best-effort perceptual hash computation
      }
    }
    await query(
      `INSERT INTO submission_image_hashes (event_id, point_id, user_id, sha256_hash, perceptual_hash)
       VALUES ($1::uuid, $2, $3, $4, $5)
       ON CONFLICT (event_id) DO NOTHING`,
      [input.eventId, input.pointId, input.userId, input.imageHash, perceptualHash],
    );
  } catch (error) {
    if (isMissingDbObjectError(error) || isUniqueViolationError(error)) return;
    throw error;
  }
}

async function upsertDeviceUsage(userId: string, clientDevice: ClientDeviceInfo | null): Promise<void> {
  if (!clientDevice?.deviceId) return;
  try {
    await query(
      `INSERT INTO device_user_map (device_id, user_id, first_seen, last_seen, submission_count)
       VALUES ($1, $2, NOW(), NOW(), 1)
       ON CONFLICT (device_id, user_id) DO UPDATE SET
         last_seen = NOW(),
         submission_count = device_user_map.submission_count + 1`,
      [clientDevice.deviceId, userId],
    );
  } catch (error) {
    if (isMissingDbObjectError(error)) return;
    throw error;
  }
}

async function insertFraudAudit(input: {
  eventId: string | null;
  userId: string;
  action: "flagged" | "blocked" | "approved";
  riskScore: number | null;
  riskComponents: RiskComponents | null;
  rule: string | null;
  notes: string | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO fraud_audit_log (
         event_id,
         user_id,
         action,
         risk_score,
         risk_components,
         rule_triggered,
         notes
       )
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        input.eventId,
        input.userId,
        input.action,
        input.riskScore,
        input.riskComponents ? JSON.stringify(input.riskComponents) : null,
        input.rule,
        input.notes,
      ],
    );
  } catch (error) {
    if (isMissingDbObjectError(error)) return;
    throw error;
  }
}

export async function persistSubmissionRiskArtifacts(input: PersistSubmissionRiskInput): Promise<void> {
  await Promise.all([
    persistContentHash(input.eventId, input.contentHash),
    insertImageHashRecord(input),
    upsertDeviceUsage(input.userId, input.clientDevice),
  ]);

  if (input.reviewStatus === "pending_review") {
    await insertFraudAudit({
      eventId: input.eventId,
      userId: input.userId,
      action: "flagged",
      riskScore: input.riskScore,
      riskComponents: input.riskComponents,
      rule: input.reviewFlags[0] ?? "risk_score",
      notes: input.reviewFlags.length ? `flags=${input.reviewFlags.join(",")}` : null,
    });
  }
}

export async function logBlockedSubmission(input: {
  userId: string;
  blockCode: string;
  riskScore: number;
  riskComponents: RiskComponents;
  notes?: string | null;
}): Promise<void> {
  await insertFraudAudit({
    eventId: null,
    userId: input.userId,
    action: "blocked",
    riskScore: input.riskScore,
    riskComponents: input.riskComponents,
    rule: input.blockCode,
    notes: input.notes ?? null,
  });
}

export function blockStatusFromCode(code: string | null): number {
  if (code === "velocity_limit") return 429;
  if (code === "tor_exit_ip") return 403;
  if (code === "duplicate_photo") return 409;
  if (code?.startsWith("invalid_fuel_price")) return 400;
  return 400;
}

