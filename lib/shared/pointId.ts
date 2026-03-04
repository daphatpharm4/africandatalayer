import { randomUUID } from "node:crypto";
import type { SubmissionCategory } from "../../shared/types.js";

const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const GEOHASH_6_PATTERN = /^[0123456789bcdefghjkmnpqrstuvwxyz]{6}$/;

function sanitizeSegment(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function sanitizeExternalId(input: string): string {
  const normalized = input
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._:-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "unknown";
}

export function encodeGeohash(latitude: number, longitude: number, precision = 6): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Latitude/longitude must be finite numbers");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Latitude/longitude are out of range");
  }

  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  let isEvenBit = true;
  let bit = 0;
  let character = 0;
  let geohash = "";

  while (geohash.length < precision) {
    if (isEvenBit) {
      const midpoint = (lonMin + lonMax) / 2;
      if (longitude >= midpoint) {
        character = (character << 1) + 1;
        lonMin = midpoint;
      } else {
        character <<= 1;
        lonMax = midpoint;
      }
    } else {
      const midpoint = (latMin + latMax) / 2;
      if (latitude >= midpoint) {
        character = (character << 1) + 1;
        latMin = midpoint;
      } else {
        character <<= 1;
        latMax = midpoint;
      }
    }

    isEvenBit = !isEvenBit;
    bit += 1;

    if (bit === 5) {
      geohash += GEOHASH_BASE32[character];
      bit = 0;
      character = 0;
    }
  }

  return geohash;
}

export function generatePointId(
  category: SubmissionCategory,
  latitude: number,
  longitude: number,
): string {
  const geohash6 = encodeGeohash(latitude, longitude, 6);
  const shortUuid = randomUUID().replace(/-/g, "").slice(0, 8);
  return `${sanitizeSegment(category, "point")}-${geohash6}-${shortUuid}`;
}

export function generateImportPointId(source: string, externalId: string): string {
  const sourceSegment = sanitizeSegment(source, "source");
  const externalSegment = sanitizeExternalId(externalId);
  return `ext-${sourceSegment}-${externalSegment}`;
}

export function extractGeohash(pointId: string): string | null {
  if (typeof pointId !== "string") return null;
  const parts = pointId.trim().split("-");
  if (parts.length < 3) return null;
  const candidate = parts[parts.length - 2]?.toLowerCase() ?? "";
  if (!GEOHASH_6_PATTERN.test(candidate)) return null;
  return candidate;
}
