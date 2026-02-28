import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import exifr from "exifr";
import pg from "pg";

const { Pool } = pg;

const DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM = 1;
const DEFAULT_IP_MATCH_THRESHOLD_KM = 50;
const REMOTE_FETCH_TIMEOUT_MS = Number(process.env.ADMIN_FORENSICS_FETCH_TIMEOUT_MS ?? "4000") || 4000;
const MAX_REMOTE_METADATA_BYTES = Number(process.env.ADMIN_FORENSICS_MAX_IMAGE_BYTES ?? "8388608") || 8388608;

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^"(.*)"$/, "$1");
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    write: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--write") {
      args.write = true;
      args.dryRun = false;
      continue;
    }
    if (token === "--dry-run") {
      args.write = false;
      args.dryRun = true;
    }
  }
  return args;
}

function resolvePostgresUrl() {
  return process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? "";
}

function normalizeString(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value || null;
}

function parseLocation(input) {
  if (!input || typeof input !== "object") return null;
  const latitude = typeof input.latitude === "number" ? input.latitude : Number(input.latitude);
  const longitude = typeof input.longitude === "number" ? input.longitude : Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function parseOptionalNumber(input) {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseOptionalBoolean(input) {
  if (typeof input === "boolean") return input;
  return null;
}

function parseExifStatus(input) {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (
    normalized === "ok" ||
    normalized === "missing" ||
    normalized === "parse_error" ||
    normalized === "unsupported_format" ||
    normalized === "fallback_recovered"
  ) {
    return normalized;
  }
  return null;
}

function parseExifSource(input) {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase();
  if (normalized === "upload_buffer" || normalized === "remote_url" || normalized === "none") return normalized;
  return null;
}

function parsePhotoFraudMetadata(input) {
  if (!input || typeof input !== "object") return null;
  const metadata = input;
  const parsed = {
    gps: parseLocation(metadata.gps),
    capturedAt: normalizeString(metadata.capturedAt),
    deviceMake: normalizeString(metadata.deviceMake),
    deviceModel: normalizeString(metadata.deviceModel),
    submissionDistanceKm: parseOptionalNumber(metadata.submissionDistanceKm),
    submissionGpsMatch: parseOptionalBoolean(metadata.submissionGpsMatch),
    ipDistanceKm: parseOptionalNumber(metadata.ipDistanceKm),
    ipGpsMatch: parseOptionalBoolean(metadata.ipGpsMatch),
    exifStatus: parseExifStatus(metadata.exifStatus) ?? "missing",
    exifReason: normalizeString(metadata.exifReason),
    exifSource: parseExifSource(metadata.exifSource) ?? "none",
  };
  if (!parsed.gps && !parsed.capturedAt && !parsed.deviceMake && !parsed.deviceModel && parsed.exifStatus === "missing") {
    parsed.exifSource = parsed.exifSource ?? "none";
  }
  return parsed;
}

function parseFraudCheck(input, fallbackLocation) {
  if (!input || typeof input !== "object") return null;
  const fraudCheck = input;
  const effectiveLocation = parseLocation(fraudCheck.effectiveLocation) ?? fallbackLocation;
  if (!effectiveLocation) return null;
  const submissionLocation = parseLocation(fraudCheck.submissionLocation) ?? fallbackLocation;
  return {
    submissionLocation,
    effectiveLocation,
    ipLocation: parseLocation(fraudCheck.ipLocation),
    primaryPhoto: parsePhotoFraudMetadata(fraudCheck.primaryPhoto),
    secondaryPhoto: parsePhotoFraudMetadata(fraudCheck.secondaryPhoto),
    submissionMatchThresholdKm: parseOptionalNumber(fraudCheck.submissionMatchThresholdKm) ?? DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM,
    ipMatchThresholdKm: parseOptionalNumber(fraudCheck.ipMatchThresholdKm) ?? DEFAULT_IP_MATCH_THRESHOLD_KM,
  };
}

function isPhotoMetadataEffectivelyEmpty(metadata) {
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

function parseDateIso(input) {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toFiniteNumber(input) {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function detectImageFormat(buffer, mime, ext) {
  const normalizedMime = normalizeString(mime)?.toLowerCase() ?? "";
  const normalizedExt = normalizeString(ext)?.toLowerCase() ?? "";
  if (normalizedMime.includes("heic") || normalizedMime.includes("heif")) return "heif";
  if (normalizedExt === "heic" || normalizedExt === "heif") return "heif";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand === "heif" || brand === "mif1" || brand === "msf1") {
      return "heif";
    }
  }
  return "unknown";
}

function metadataContext({ mime, ext, byteLength }) {
  const parts = [];
  const normalizedMime = normalizeString(mime);
  const normalizedExt = normalizeString(ext);
  if (normalizedMime) parts.push(`mime=${normalizedMime}`);
  if (normalizedExt) parts.push(`ext=${normalizedExt}`);
  if (typeof byteLength === "number" && Number.isFinite(byteLength) && byteLength > 0) parts.push(`bytes=${Math.round(byteLength)}`);
  return parts.join("; ");
}

function withContext(reason, context) {
  if (!context) return reason;
  return `${reason} (${context}).`;
}

function extractDate(parsed) {
  return (
    parseDateIso(parsed.DateTimeOriginal) ??
    parseDateIso(parsed.DateTimeDigitized) ??
    parseDateIso(parsed.CreateDate) ??
    parseDateIso(parsed.ModifyDate)
  );
}

async function extractPhotoMetadataFromUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const mime = normalizeString(response.headers.get("content-type"));
    const ext = (() => {
      try {
        const parsed = new URL(url);
        const dot = parsed.pathname.lastIndexOf(".");
        if (dot === -1) return null;
        return parsed.pathname.slice(dot + 1).toLowerCase();
      } catch {
        return null;
      }
    })();
    if (!response.ok) {
      return {
        gps: null,
        capturedAt: null,
        deviceMake: null,
        deviceModel: null,
        exifStatus: "parse_error",
        exifReason: withContext(`Unable to fetch remote photo (HTTP ${response.status})`, metadataContext({ mime, ext })),
        exifSource: "remote_url",
      };
    }
    const arrayBuffer = await response.arrayBuffer();
    const byteLength = arrayBuffer.byteLength;
    if (!byteLength) {
      return {
        gps: null,
        capturedAt: null,
        deviceMake: null,
        deviceModel: null,
        exifStatus: "missing",
        exifReason: withContext("Remote photo is empty", metadataContext({ mime, ext, byteLength })),
        exifSource: "remote_url",
      };
    }
    if (byteLength > MAX_REMOTE_METADATA_BYTES) {
      return {
        gps: null,
        capturedAt: null,
        deviceMake: null,
        deviceModel: null,
        exifStatus: "parse_error",
        exifReason: withContext(
          `Remote photo exceeds EXIF fetch limit (${MAX_REMOTE_METADATA_BYTES} bytes)`,
          metadataContext({ mime, ext, byteLength }),
        ),
        exifSource: "remote_url",
      };
    }

    const buffer = Buffer.from(arrayBuffer);
    let parsed = null;
    try {
      parsed = await exifr.parse(buffer, { gps: true, exif: true, tiff: true });
    } catch {
      parsed = null;
    }
    const latitude = toFiniteNumber(parsed?.latitude);
    const longitude = toFiniteNumber(parsed?.longitude);
    const gps = latitude !== null && longitude !== null ? { latitude, longitude } : null;
    const capturedAt = parsed ? extractDate(parsed) : null;
    const deviceMake = normalizeString(parsed?.Make);
    const deviceModel = normalizeString(parsed?.Model);
    const hasSignal = Boolean(gps || capturedAt || deviceMake || deviceModel);
    const context = metadataContext({ mime, ext, byteLength });
    if (hasSignal) {
      return {
        gps,
        capturedAt,
        deviceMake,
        deviceModel,
        exifStatus: "fallback_recovered",
        exifReason: withContext("Recovered EXIF metadata from stored photo URL", context),
        exifSource: "remote_url",
      };
    }

    const format = detectImageFormat(buffer, mime, ext);
    if (format === "heif") {
      return {
        gps: null,
        capturedAt: null,
        deviceMake: null,
        deviceModel: null,
        exifStatus: "unsupported_format",
        exifReason: withContext(
          "Likely HEIC/HEIF metadata stripping or unsupported format. Enable iOS Camera Location and Most Compatible format",
          context,
        ),
        exifSource: "remote_url",
      };
    }
    return {
      gps: null,
      capturedAt: null,
      deviceMake: null,
      deviceModel: null,
      exifStatus: "missing",
      exifReason: withContext("No EXIF metadata found in stored photo bytes", context),
      exifSource: "remote_url",
    };
  } catch (error) {
    const timeout = error instanceof Error && error.name === "AbortError";
    return {
      gps: null,
      capturedAt: null,
      deviceMake: null,
      deviceModel: null,
      exifStatus: "parse_error",
      exifReason: timeout ? `Timed out fetching remote photo after ${REMOTE_FETCH_TIMEOUT_MS}ms` : "Unable to fetch remote photo for EXIF recovery",
      exifSource: "remote_url",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * 6371 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function roundKm(input) {
  return Number(input.toFixed(3));
}

function buildPhotoFraudMetadata({ extracted, submissionLocation, ipLocation, submissionMatchThresholdKm, ipMatchThresholdKm }) {
  if (!extracted) return null;
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

function mergePhotoMetadata(existing, recovered, hasUrl) {
  if (!hasUrl) return existing ?? null;
  if (existing && !isPhotoMetadataEffectivelyEmpty(existing)) return existing;
  if (recovered) return recovered;
  return existing ?? null;
}

function buildFraudCheck({ location, existingFraudCheck, primaryPhoto, secondaryPhoto }) {
  return {
    submissionLocation: existingFraudCheck?.submissionLocation ?? location,
    effectiveLocation: existingFraudCheck?.effectiveLocation ?? location,
    ipLocation: existingFraudCheck?.ipLocation ?? null,
    primaryPhoto,
    secondaryPhoto,
    submissionMatchThresholdKm: existingFraudCheck?.submissionMatchThresholdKm ?? DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM,
    ipMatchThresholdKm: existingFraudCheck?.ipMatchThresholdKm ?? DEFAULT_IP_MATCH_THRESHOLD_KM,
  };
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const postgresUrl = resolvePostgresUrl();
  if (!postgresUrl) {
    throw new Error("POSTGRES_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING) is required");
  }
  if (args.write) {
    const driver = (process.env.DATA_STORE_DRIVER ?? "").trim().toLowerCase();
    if (driver !== "postgres") {
      throw new Error("Write mode is only allowed when DATA_STORE_DRIVER=postgres");
    }
  }

  const pool = new Pool({
    connectionString: postgresUrl,
    ssl: process.env.POSTGRES_SSL_NO_VERIFY === "true" ? { rejectUnauthorized: false } : undefined,
  });

  const stats = {
    scanned: 0,
    recoverable: 0,
    recovered: 0,
    unchanged: 0,
    parseFailures: 0,
    unsupportedFormat: 0,
  };
  const recoveredIds = [];

  try {
    const result = await pool.query(
      `
        select id, latitude, longitude, details, photo_url
        from point_events
        order by created_at asc
      `,
    );

    for (const row of result.rows) {
      stats.scanned += 1;
      const details = row.details && typeof row.details === "object" ? row.details : {};
      const location = {
        latitude: typeof row.latitude === "number" ? row.latitude : Number(row.latitude),
        longitude: typeof row.longitude === "number" ? row.longitude : Number(row.longitude),
      };
      if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        stats.unchanged += 1;
        continue;
      }

      const primaryUrl = typeof row.photo_url === "string" ? row.photo_url.trim() : "";
      const secondaryUrl = typeof details.secondPhotoUrl === "string" ? details.secondPhotoUrl.trim() : "";
      const existingFraudCheck = parseFraudCheck(details.fraudCheck, location);

      const needsPrimary = Boolean(primaryUrl) && isPhotoMetadataEffectivelyEmpty(existingFraudCheck?.primaryPhoto);
      const needsSecondary = Boolean(secondaryUrl) && isPhotoMetadataEffectivelyEmpty(existingFraudCheck?.secondaryPhoto);
      if (!needsPrimary && !needsSecondary) {
        stats.unchanged += 1;
        continue;
      }

      stats.recoverable += 1;

      const primaryExtracted = needsPrimary ? await extractPhotoMetadataFromUrl(primaryUrl) : null;
      const secondaryExtracted = needsSecondary ? await extractPhotoMetadataFromUrl(secondaryUrl) : null;

      if (primaryExtracted?.exifStatus === "parse_error") stats.parseFailures += 1;
      if (secondaryExtracted?.exifStatus === "parse_error") stats.parseFailures += 1;
      if (primaryExtracted?.exifStatus === "unsupported_format") stats.unsupportedFormat += 1;
      if (secondaryExtracted?.exifStatus === "unsupported_format") stats.unsupportedFormat += 1;

      const recoveredPrimary = buildPhotoFraudMetadata({
        extracted: primaryExtracted,
        submissionLocation: location,
        ipLocation: existingFraudCheck?.ipLocation ?? null,
        submissionMatchThresholdKm: existingFraudCheck?.submissionMatchThresholdKm ?? DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM,
        ipMatchThresholdKm: existingFraudCheck?.ipMatchThresholdKm ?? DEFAULT_IP_MATCH_THRESHOLD_KM,
      });
      const recoveredSecondary = buildPhotoFraudMetadata({
        extracted: secondaryExtracted,
        submissionLocation: location,
        ipLocation: existingFraudCheck?.ipLocation ?? null,
        submissionMatchThresholdKm: existingFraudCheck?.submissionMatchThresholdKm ?? DEFAULT_SUBMISSION_GPS_MATCH_THRESHOLD_KM,
        ipMatchThresholdKm: existingFraudCheck?.ipMatchThresholdKm ?? DEFAULT_IP_MATCH_THRESHOLD_KM,
      });

      const primaryPhoto = mergePhotoMetadata(existingFraudCheck?.primaryPhoto ?? null, recoveredPrimary, Boolean(primaryUrl));
      const secondaryPhoto = mergePhotoMetadata(existingFraudCheck?.secondaryPhoto ?? null, recoveredSecondary, Boolean(secondaryUrl));
      const nextFraudCheck = buildFraudCheck({
        location,
        existingFraudCheck,
        primaryPhoto,
        secondaryPhoto,
      });

      const existingSerialized = JSON.stringify(details.fraudCheck ?? null);
      const nextSerialized = JSON.stringify(nextFraudCheck);
      if (existingSerialized === nextSerialized) {
        stats.unchanged += 1;
        continue;
      }

      stats.recovered += 1;
      if (recoveredIds.length < 20) recoveredIds.push(row.id);

      if (args.write) {
        const nextDetails = { ...details, fraudCheck: nextFraudCheck };
        await pool.query(
          `
            update point_events
            set details = $2::jsonb
            where id = $1::uuid
          `,
          [row.id, JSON.stringify(nextDetails)],
        );
      }
    }
  } finally {
    await pool.end();
  }

  console.info("EXIF Backfill Summary");
  console.info(`mode: ${args.write ? "write" : "dry-run"}`);
  console.info(`scanned: ${stats.scanned}`);
  console.info(`recoverable: ${stats.recoverable}`);
  console.info(`recovered: ${stats.recovered}`);
  console.info(`unchanged: ${stats.unchanged}`);
  console.info(`parse_failures: ${stats.parseFailures}`);
  console.info(`unsupported_format: ${stats.unsupportedFormat}`);
  if (recoveredIds.length > 0) {
    console.info(`sample_recovered_ids: ${recoveredIds.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
