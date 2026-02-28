import exifr from "exifr";
import type { SubmissionFraudCheck, SubmissionLocation, SubmissionPhotoMetadata } from "../../shared/types.js";

export const DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM = 1;

const EARTH_RADIUS_KM = 6371;
const KM_PRECISION = 3;
const REMOTE_FETCH_TIMEOUT_MS = Number(process.env.ADMIN_FORENSICS_FETCH_TIMEOUT_MS ?? "4000") || 4000;
const MAX_REMOTE_METADATA_BYTES = Number(process.env.ADMIN_FORENSICS_MAX_IMAGE_BYTES ?? "8388608") || 8388608;
const EXIF_DATE_TIME_REGEX = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/;

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
  if (typeof input === "string") {
    const value = input.trim();
    if (!value) return null;
    const exifMatch = value.match(EXIF_DATE_TIME_REGEX);
    if (exifMatch) {
      const year = Number(exifMatch[1]);
      const month = Number(exifMatch[2]);
      const day = Number(exifMatch[3]);
      const hour = Number(exifMatch[4]);
      const minute = Number(exifMatch[5]);
      const second = Number(exifMatch[6]);
      const millisRaw = exifMatch[7] ?? "0";
      const millis = Number(millisRaw.slice(0, 3).padEnd(3, "0"));
      const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millis));
      if (!Number.isNaN(utcDate.getTime())) return utcDate.toISOString();
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }
  if (typeof input === "number") {
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }
  if (typeof input === "object") {
    const value = input as {
      toDate?: () => unknown;
      toISOString?: () => string;
      value?: unknown;
      rawValue?: unknown;
      year?: unknown;
      month?: unknown;
      day?: unknown;
      hour?: unknown;
      minute?: unknown;
      second?: unknown;
      millisecond?: unknown;
    };
    if (typeof value.toDate === "function") {
      try {
        const converted = value.toDate();
        const parsed = parseDateIso(converted);
        if (parsed) return parsed;
      } catch {
        // fall through
      }
    }
    if (typeof value.toISOString === "function") {
      try {
        const iso = value.toISOString();
        const parsed = parseDateIso(iso);
        if (parsed) return parsed;
      } catch {
        // fall through
      }
    }
    const fromValue = parseDateIso(value.value ?? value.rawValue);
    if (fromValue) return fromValue;

    const year = Number(value.year);
    const month = Number(value.month);
    const day = Number(value.day);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const hour = Number(value.hour);
      const minute = Number(value.minute);
      const second = Number(value.second);
      const millisecond = Number(value.millisecond);
      const utcDate = new Date(
        Date.UTC(
          year,
          month - 1,
          day,
          Number.isFinite(hour) ? hour : 0,
          Number.isFinite(minute) ? minute : 0,
          Number.isFinite(second) ? second : 0,
          Number.isFinite(millisecond) ? millisecond : 0,
        ),
      );
      if (!Number.isNaN(utcDate.getTime())) return utcDate.toISOString();
    }
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

function toFiniteNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input.trim());
    if (Number.isFinite(parsed)) return parsed;
    return null;
  }
  return null;
}

function toRationalNumber(input: unknown): number | null {
  const direct = toFiniteNumber(input);
  if (direct !== null) return direct;
  if (!input || typeof input !== "object") return null;

  const rational = input as {
    numerator?: unknown;
    denominator?: unknown;
    num?: unknown;
    den?: unknown;
    value?: unknown;
  };
  const numerator = toFiniteNumber(rational.numerator ?? rational.num);
  const denominator = toFiniteNumber(rational.denominator ?? rational.den);
  if (numerator !== null && denominator !== null && denominator !== 0) {
    return numerator / denominator;
  }
  if ("value" in rational) return toRationalNumber(rational.value);
  return null;
}

function parseDmsCoordinate(input: unknown): number | null {
  const direct = toRationalNumber(input);
  if (direct !== null) return direct;
  if (!Array.isArray(input) || input.length === 0) return null;
  const degrees = toRationalNumber(input[0]);
  if (degrees === null) return null;
  const minutes = toRationalNumber(input[1]) ?? 0;
  const seconds = toRationalNumber(input[2]) ?? 0;
  return degrees + minutes / 60 + seconds / 3600;
}

function applyHemisphere(value: number, ref: unknown, negativeChar: "S" | "W"): number {
  if (typeof ref !== "string") return value;
  const normalized = ref.trim().toUpperCase();
  if (!normalized) return value;
  if (normalized.startsWith(negativeChar)) return -Math.abs(value);
  return Math.abs(value);
}

function toGpsLocation(latInput: unknown, lonInput: unknown): SubmissionLocation | null {
  const latitude = toFiniteNumber(latInput);
  const longitude = toFiniteNumber(lonInput);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function extractGps(parsed: Record<string, unknown>): SubmissionLocation | null {
  const direct =
    toGpsLocation(parsed.latitude, parsed.longitude) ??
    toGpsLocation(parsed.lat, parsed.lon) ??
    toGpsLocation(parsed.lat, parsed.lng);
  if (direct) return direct;

  const gpsContainer = parsed.gps && typeof parsed.gps === "object" ? (parsed.gps as Record<string, unknown>) : null;
  if (gpsContainer) {
    const nested =
      toGpsLocation(gpsContainer.latitude, gpsContainer.longitude) ??
      toGpsLocation(gpsContainer.lat, gpsContainer.lon) ??
      toGpsLocation(gpsContainer.lat, gpsContainer.lng);
    if (nested) return nested;
  }

  const rawLatitude = parseDmsCoordinate(parsed.GPSLatitude ?? gpsContainer?.GPSLatitude);
  const rawLongitude = parseDmsCoordinate(parsed.GPSLongitude ?? gpsContainer?.GPSLongitude);
  if (rawLatitude === null || rawLongitude === null) return null;

  const latitude = applyHemisphere(rawLatitude, parsed.GPSLatitudeRef ?? gpsContainer?.GPSLatitudeRef, "S");
  const longitude = applyHemisphere(rawLongitude, parsed.GPSLongitudeRef ?? gpsContainer?.GPSLongitudeRef, "W");
  return { latitude, longitude };
}

async function safeParseExif(
  imageBuffer: Buffer,
  options: Parameters<typeof exifr.parse>[1],
): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await exifr.parse(imageBuffer, options);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function safeParseGps(imageBuffer: Buffer): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await exifr.gps(imageBuffer);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
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
  const parsed = await safeParseExif(imageBuffer, {
    gps: true,
    exif: true,
    tiff: true,
    pick: [
      "latitude",
      "longitude",
      "lat",
      "lon",
      "lng",
      "gps",
      "GPSLatitude",
      "GPSLongitude",
      "GPSLatitudeRef",
      "GPSLongitudeRef",
      "DateTimeOriginal",
      "DateTimeDigitized",
      "CreateDate",
      "ModifyDate",
      "Make",
      "Model",
    ],
  });
  const gpsOnly = await safeParseGps(imageBuffer);
  const merged = {
    ...(parsed ?? {}),
    ...(gpsOnly ?? {}),
  };

  if (!Object.keys(merged).length) {
    return {
      gps: null,
      capturedAt: null,
      deviceMake: null,
      deviceModel: null,
    };
  }
  const gps = extractGps(merged);

  const capturedAt =
    parseDateIso(merged.DateTimeOriginal) ??
    parseDateIso(merged.DateTimeDigitized) ??
    parseDateIso(merged.CreateDate) ??
    parseDateIso(merged.ModifyDate);

  return {
    gps,
    capturedAt,
    deviceMake: normalizeString(merged.Make),
    deviceModel: normalizeString(merged.Model),
  };
}

function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

export async function extractPhotoMetadataFromUrl(photoUrl: string): Promise<ExtractedPhotoMetadata | null> {
  if (!photoUrl || !isHttpUrl(photoUrl)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(photoUrl, { signal: controller.signal });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer.byteLength || arrayBuffer.byteLength > MAX_REMOTE_METADATA_BYTES) return null;
    return await extractPhotoMetadata(Buffer.from(arrayBuffer));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
