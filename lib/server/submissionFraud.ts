import exifr from "exifr";
import type { SubmissionFraudCheck, SubmissionLocation, SubmissionPhotoMetadata } from "../../shared/types.js";

export const DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM = 1;

const EARTH_RADIUS_KM = 6371;
const KM_PRECISION = 3;

export interface ExtractedPhotoMetadata {
  gps: SubmissionLocation | null;
  capturedAt: string | null;
  deviceMake: string | null;
  deviceModel: string | null;
}

type BuildPhotoFraudMetadataParams = {
  extracted: ExtractedPhotoMetadata | null;
  submissionLocation: SubmissionLocation | null;
  ipLocation: SubmissionLocation | null;
  submissionMatchThresholdKm: number;
  ipMatchThresholdKm: number;
};

type BuildSubmissionFraudCheckParams = {
  submissionLocation: SubmissionLocation | null;
  effectiveLocation: SubmissionLocation;
  ipLocation: SubmissionLocation | null;
  primaryPhoto: SubmissionPhotoMetadata | null;
  secondaryPhoto: SubmissionPhotoMetadata | null;
  submissionMatchThresholdKm: number;
  ipMatchThresholdKm: number;
};

function normalizeString(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value || null;
}

function parseDateIso(input: unknown): string | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return input.toISOString();
  }
  if (typeof input === "string" || typeof input === "number") {
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }
  return null;
}

function parseLocation(input: unknown): SubmissionLocation | null {
  if (!input || typeof input !== "object") return null;
  const location = input as { latitude?: unknown; longitude?: unknown };
  const latitude = typeof location.latitude === "number" ? location.latitude : Number(location.latitude);
  const longitude = typeof location.longitude === "number" ? location.longitude : Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function parseOptionalNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseOptionalBoolean(input: unknown): boolean | null {
  if (typeof input === "boolean") return input;
  return null;
}

function roundKm(input: number): number {
  return Number(input.toFixed(KM_PRECISION));
}

export function haversineKm(a: SubmissionLocation, b: SubmissionLocation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function extractPhotoMetadata(imageBuffer: Buffer): Promise<ExtractedPhotoMetadata> {
  const parsed = (await exifr.parse(imageBuffer, {
    gps: true,
    exif: true,
    tiff: true,
  })) as Record<string, unknown> | null;

  if (!parsed) {
    return {
      gps: null,
      capturedAt: null,
      deviceMake: null,
      deviceModel: null,
    };
  }

  const latitude = typeof parsed.latitude === "number" ? parsed.latitude : Number(parsed.latitude);
  const longitude = typeof parsed.longitude === "number" ? parsed.longitude : Number(parsed.longitude);
  const gps = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;

  const capturedAt =
    parseDateIso(parsed.DateTimeOriginal) ??
    parseDateIso(parsed.DateTimeDigitized) ??
    parseDateIso(parsed.CreateDate) ??
    parseDateIso(parsed.ModifyDate);

  return {
    gps,
    capturedAt,
    deviceMake: normalizeString(parsed.Make),
    deviceModel: normalizeString(parsed.Model),
  };
}

export function buildPhotoFraudMetadata(params: BuildPhotoFraudMetadataParams): SubmissionPhotoMetadata | null {
  if (!params.extracted) return null;

  const { extracted, submissionLocation, ipLocation, submissionMatchThresholdKm, ipMatchThresholdKm } = params;
  const gps = extracted.gps;

  const submissionDistanceRaw = gps && submissionLocation ? haversineKm(submissionLocation, gps) : null;
  const ipDistanceRaw = gps && ipLocation ? haversineKm(ipLocation, gps) : null;

  const submissionDistanceKm = submissionDistanceRaw === null ? null : roundKm(submissionDistanceRaw);
  const ipDistanceKm = ipDistanceRaw === null ? null : roundKm(ipDistanceRaw);

  return {
    gps,
    capturedAt: extracted.capturedAt,
    deviceMake: extracted.deviceMake,
    deviceModel: extracted.deviceModel,
    submissionDistanceKm,
    submissionGpsMatch: submissionDistanceKm === null ? null : submissionDistanceKm <= submissionMatchThresholdKm,
    ipDistanceKm,
    ipGpsMatch: ipDistanceKm === null ? null : ipDistanceKm <= ipMatchThresholdKm,
  };
}

export function buildSubmissionFraudCheck(params: BuildSubmissionFraudCheckParams): SubmissionFraudCheck {
  return {
    submissionLocation: params.submissionLocation,
    effectiveLocation: params.effectiveLocation,
    ipLocation: params.ipLocation,
    primaryPhoto: params.primaryPhoto,
    secondaryPhoto: params.secondaryPhoto,
    submissionMatchThresholdKm: params.submissionMatchThresholdKm,
    ipMatchThresholdKm: params.ipMatchThresholdKm,
  };
}

function parsePhotoFraudMetadata(input: unknown): SubmissionPhotoMetadata | null {
  if (!input || typeof input !== "object") return null;
  const metadata = input as Record<string, unknown>;

  return {
    gps: parseLocation(metadata.gps),
    capturedAt: parseDateIso(metadata.capturedAt),
    deviceMake: normalizeString(metadata.deviceMake),
    deviceModel: normalizeString(metadata.deviceModel),
    submissionDistanceKm: parseOptionalNumber(metadata.submissionDistanceKm),
    submissionGpsMatch: parseOptionalBoolean(metadata.submissionGpsMatch),
    ipDistanceKm: parseOptionalNumber(metadata.ipDistanceKm),
    ipGpsMatch: parseOptionalBoolean(metadata.ipGpsMatch),
  };
}

export function parseSubmissionFraudCheck(input: unknown): SubmissionFraudCheck | null {
  if (!input || typeof input !== "object") return null;
  const fraudCheck = input as Record<string, unknown>;
  const effectiveLocation = parseLocation(fraudCheck.effectiveLocation);
  if (!effectiveLocation) return null;

  const submissionMatchThresholdKm =
    parseOptionalNumber(fraudCheck.submissionMatchThresholdKm) ?? DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM;
  const ipMatchThresholdKm = parseOptionalNumber(fraudCheck.ipMatchThresholdKm) ?? 50;

  return {
    submissionLocation: parseLocation(fraudCheck.submissionLocation),
    effectiveLocation,
    ipLocation: parseLocation(fraudCheck.ipLocation),
    primaryPhoto: parsePhotoFraudMetadata(fraudCheck.primaryPhoto),
    secondaryPhoto: parsePhotoFraudMetadata(fraudCheck.secondaryPhoto),
    submissionMatchThresholdKm,
    ipMatchThresholdKm,
  };
}
