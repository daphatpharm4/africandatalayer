import exifr from "exifr";
import type {
  SubmissionExifSource,
  SubmissionExifStatus,
  SubmissionFraudCheck,
  SubmissionLocation,
  SubmissionPhotoMetadata,
} from "../../shared/types.js";

export const DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM = 1;

const EARTH_RADIUS_KM = 6371;
const KM_PRECISION = 3;
const REMOTE_FETCH_TIMEOUT_MS = Number(process.env.ADMIN_FORENSICS_FETCH_TIMEOUT_MS ?? "4000") || 4000;
const MAX_REMOTE_METADATA_BYTES = Number(process.env.ADMIN_FORENSICS_MAX_IMAGE_BYTES ?? "8388608") || 8388608;
const EXIF_DATE_TIME_REGEX = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/;

const EXIF_STATUSES: ReadonlySet<SubmissionExifStatus> = new Set([
  "ok",
  "missing",
  "parse_error",
  "unsupported_format",
  "fallback_recovered",
]);
const EXIF_SOURCES: ReadonlySet<SubmissionExifSource> = new Set(["upload_buffer", "remote_url", "none"]);

type ExtractPhotoMetadataSource = Exclude<SubmissionExifSource, "none">;

export type ExtractPhotoMetadataOptions = {
  source?: ExtractPhotoMetadataSource;
  mime?: string | null;
  ext?: string | null;
  byteLength?: number | null;
};

export interface ExtractedPhotoMetadata {
  gps: SubmissionLocation | null;
  capturedAt: string | null;
  deviceMake: string | null;
  deviceModel: string | null;
  exifStatus: SubmissionExifStatus;
  exifReason: string | null;
  exifSource: SubmissionExifSource;
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

type ParseAttempt = {
  parsed: Record<string, unknown> | null;
  error: Error | null;
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

function parseExifStatus(input: unknown): SubmissionExifStatus | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase() as SubmissionExifStatus;
  if (!EXIF_STATUSES.has(normalized)) return null;
  return normalized;
}

function parseExifSource(input: unknown): SubmissionExifSource | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase() as SubmissionExifSource;
  if (!EXIF_SOURCES.has(normalized)) return null;
  return normalized;
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

function detectImageFormat(imageBuffer: Buffer): "jpeg" | "png" | "webp" | "heic" | "heif" | "unknown" {
  if (imageBuffer.length >= 3 && imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    imageBuffer.length >= 8 &&
    imageBuffer[0] === 0x89 &&
    imageBuffer[1] === 0x50 &&
    imageBuffer[2] === 0x4e &&
    imageBuffer[3] === 0x47
  ) {
    return "png";
  }
  if (imageBuffer.length >= 12) {
    const riff = imageBuffer.subarray(0, 4).toString("ascii");
    const webp = imageBuffer.subarray(8, 12).toString("ascii");
    if (riff === "RIFF" && webp === "WEBP") return "webp";
  }
  if (imageBuffer.length >= 12 && imageBuffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = imageBuffer.subarray(8, 12).toString("ascii").toLowerCase();
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("hevc") || brand.startsWith("hevx")) {
      return "heic";
    }
    if (brand === "heif" || brand === "mif1" || brand === "msf1") {
      return "heif";
    }
  }
  return "unknown";
}

function isUnsupportedExifFormat(format: string): boolean {
  return format === "heic" || format === "heif";
}

function hasExifSignal(metadata: {
  gps: SubmissionLocation | null;
  capturedAt: string | null;
  deviceMake: string | null;
  deviceModel: string | null;
}): boolean {
  return Boolean(metadata.gps || metadata.capturedAt || metadata.deviceMake || metadata.deviceModel);
}

function metadataContext(options: ExtractPhotoMetadataOptions): string {
  const parts: string[] = [];
  const mime = normalizeString(options.mime);
  const ext = normalizeString(options.ext);
  if (mime) parts.push(`mime=${mime}`);
  if (ext) parts.push(`ext=${ext}`);
  if (typeof options.byteLength === "number" && Number.isFinite(options.byteLength) && options.byteLength > 0) {
    parts.push(`bytes=${Math.round(options.byteLength)}`);
  }
  return parts.join("; ");
}

function withContext(reason: string, options: ExtractPhotoMetadataOptions): string {
  const context = metadataContext(options);
  if (!context) return reason;
  return `${reason} (${context}).`;
}

function createExtractedPhotoMetadata(
  status: SubmissionExifStatus,
  reason: string | null,
  source: SubmissionExifSource,
): ExtractedPhotoMetadata {
  return {
    gps: null,
    capturedAt: null,
    deviceMake: null,
    deviceModel: null,
    exifStatus: status,
    exifReason: reason,
    exifSource: source,
  };
}

async function safeParseExif(
  imageBuffer: Buffer,
  options: Parameters<typeof exifr.parse>[1],
): Promise<ParseAttempt> {
  try {
    const parsed = await exifr.parse(imageBuffer, options);
    if (!parsed || typeof parsed !== "object") return { parsed: null, error: null };
    return { parsed: parsed as Record<string, unknown>, error: null };
  } catch (error) {
    return { parsed: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

async function safeParseGps(imageBuffer: Buffer): Promise<ParseAttempt> {
  try {
    const parsed = await exifr.gps(imageBuffer);
    if (!parsed || typeof parsed !== "object") return { parsed: null, error: null };
    return { parsed: parsed as unknown as Record<string, unknown>, error: null };
  } catch (error) {
    return { parsed: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

function inferRemoteExt(photoUrl: string): string | null {
  try {
    const parsed = new URL(photoUrl);
    const pathname = parsed.pathname;
    const dotIndex = pathname.lastIndexOf(".");
    if (dotIndex === -1) return null;
    const ext = pathname.slice(dotIndex + 1).toLowerCase().trim();
    if (!ext || ext.length > 12) return null;
    return ext;
  } catch {
    return null;
  }
}

export function isPhotoMetadataEffectivelyEmpty(metadata: SubmissionPhotoMetadata | null | undefined): boolean {
  if (!metadata) return true;
  return (
    metadata.gps === null &&
    metadata.capturedAt === null &&
    metadata.deviceMake === null &&
    metadata.deviceModel === null &&
    metadata.submissionDistanceKm === null &&
    metadata.submissionGpsMatch === null &&
    metadata.ipDistanceKm === null &&
    metadata.ipGpsMatch === null
  );
}

export function isFraudCheckEffectivelyEmpty(fraudCheck: SubmissionFraudCheck | null | undefined): boolean {
  if (!fraudCheck) return true;
  return isPhotoMetadataEffectivelyEmpty(fraudCheck.primaryPhoto) && isPhotoMetadataEffectivelyEmpty(fraudCheck.secondaryPhoto);
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

export async function extractPhotoMetadata(
  imageBuffer: Buffer,
  options: ExtractPhotoMetadataOptions = {},
): Promise<ExtractedPhotoMetadata> {
  const source: ExtractPhotoMetadataSource = options.source ?? "upload_buffer";
  const exifAttempt = await safeParseExif(imageBuffer, {
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
  const gpsAttempt = await safeParseGps(imageBuffer);
  const merged = {
    ...(exifAttempt.parsed ?? {}),
    ...(gpsAttempt.parsed ?? {}),
  };

  const gps = extractGps(merged);
  const capturedAt =
    parseDateIso(merged.DateTimeOriginal) ??
    parseDateIso(merged.DateTimeDigitized) ??
    parseDateIso(merged.CreateDate) ??
    parseDateIso(merged.ModifyDate);
  const deviceMake = normalizeString(merged.Make);
  const deviceModel = normalizeString(merged.Model);

  if (hasExifSignal({ gps, capturedAt, deviceMake, deviceModel })) {
    const exifStatus: SubmissionExifStatus = source === "remote_url" ? "fallback_recovered" : "ok";
    const exifReason = withContext(
      source === "remote_url" ? "Recovered EXIF metadata from stored photo URL" : "EXIF metadata parsed successfully",
      options,
    );
    return {
      gps,
      capturedAt,
      deviceMake,
      deviceModel,
      exifStatus,
      exifReason,
      exifSource: source,
    };
  }

  const format = detectImageFormat(imageBuffer);
  const hasParseError = Boolean(exifAttempt.error || gpsAttempt.error);
  if (isUnsupportedExifFormat(format)) {
    return createExtractedPhotoMetadata(
      "unsupported_format",
      withContext(
        "Likely HEIC/HEIF metadata stripping or unsupported format. Enable iOS Camera Location and Most Compatible format",
        options,
      ),
      source,
    );
  }
  if (hasParseError) {
    return createExtractedPhotoMetadata(
      "parse_error",
      withContext("Unable to parse EXIF metadata from image bytes", options),
      source,
    );
  }
  return createExtractedPhotoMetadata(
    "missing",
    withContext(
      source === "remote_url" ? "No EXIF metadata found in stored photo bytes" : "No EXIF metadata found in uploaded file",
      options,
    ),
    source,
  );
}

function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

export async function extractPhotoMetadataFromUrl(photoUrl: string): Promise<ExtractedPhotoMetadata | null> {
  if (!photoUrl || !isHttpUrl(photoUrl)) return null;

  const source: ExtractPhotoMetadataSource = "remote_url";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(photoUrl, { signal: controller.signal });
    const mime = normalizeString(response.headers.get("content-type"));
    const ext = inferRemoteExt(photoUrl);
    if (!response.ok) {
      return createExtractedPhotoMetadata(
        "parse_error",
        withContext(`Unable to fetch remote photo for EXIF recovery (HTTP ${response.status})`, { source, mime, ext }),
        source,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const byteLength = arrayBuffer.byteLength;
    if (!byteLength) {
      return createExtractedPhotoMetadata(
        "missing",
        withContext("Remote photo is empty; EXIF recovery skipped", { source, mime, ext, byteLength }),
        source,
      );
    }
    if (byteLength > MAX_REMOTE_METADATA_BYTES) {
      return createExtractedPhotoMetadata(
        "parse_error",
        withContext(`Remote photo exceeds EXIF fetch limit (${MAX_REMOTE_METADATA_BYTES} bytes)`, {
          source,
          mime,
          ext,
          byteLength,
        }),
        source,
      );
    }
    return await extractPhotoMetadata(Buffer.from(arrayBuffer), { source, mime, ext, byteLength });
  } catch (error) {
    const timeoutMessage = error instanceof Error && error.name === "AbortError";
    const reason = timeoutMessage
      ? `Timed out fetching remote photo after ${REMOTE_FETCH_TIMEOUT_MS}ms`
      : "Unable to fetch remote photo for EXIF recovery";
    return createExtractedPhotoMetadata("parse_error", withContext(reason, { source, ext: inferRemoteExt(photoUrl) }), source);
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
    exifStatus: extracted.exifStatus,
    exifReason: extracted.exifReason,
    exifSource: extracted.exifSource,
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

  const parsed: SubmissionPhotoMetadata = {
    gps: parseLocation(metadata.gps),
    capturedAt: parseDateIso(metadata.capturedAt),
    deviceMake: normalizeString(metadata.deviceMake),
    deviceModel: normalizeString(metadata.deviceModel),
    submissionDistanceKm: parseOptionalNumber(metadata.submissionDistanceKm),
    submissionGpsMatch: parseOptionalBoolean(metadata.submissionGpsMatch),
    ipDistanceKm: parseOptionalNumber(metadata.ipDistanceKm),
    ipGpsMatch: parseOptionalBoolean(metadata.ipGpsMatch),
    exifStatus: "missing",
    exifReason: normalizeString(metadata.exifReason),
    exifSource: parseExifSource(metadata.exifSource) ?? "none",
  };

  const explicitStatus = parseExifStatus(metadata.exifStatus);
  if (explicitStatus) {
    parsed.exifStatus = explicitStatus;
  } else if (hasExifSignal(parsed)) {
    parsed.exifStatus = "ok";
  } else {
    parsed.exifStatus = "missing";
  }

  return parsed;
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
