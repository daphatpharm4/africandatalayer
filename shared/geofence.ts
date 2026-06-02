import type { SubmissionLocation } from "./types.js";

export const BONAMOUSSADI_BOUNDS = {
  south: 4.0755,
  west: 9.7185,
  north: 4.0999,
  east: 9.7602,
} as const;

export const CAMEROON_BOUNDS = {
  south: 1.65,
  west: 8.45,
  north: 13.1,
  east: 16.2,
} as const;

export const BONAMOUSSADI_CENTER = {
  latitude: 4.0877,
  longitude: 9.7394,
} as const;

export const CAMEROON_CENTER = {
  latitude: 7.3697,
  longitude: 12.3547,
} as const;

/**
 * Bounding box for a map scope, in the shape the point_events read path uses to
 * push a spatial filter down to Postgres. Returns null for "global" (admin-only,
 * unbounded) so callers omit the WHERE and fall back to a full scan deliberately.
 */
export function mapScopeBbox(
  scope: "bonamoussadi" | "cameroon" | "global",
): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  if (scope === "global") return null;
  const b = scope === "cameroon" ? CAMEROON_BOUNDS : BONAMOUSSADI_BOUNDS;
  return { minLat: b.south, maxLat: b.north, minLng: b.west, maxLng: b.east };
}

export function isWithinBonamoussadi(location: SubmissionLocation | null | undefined): boolean {
  if (!location) return false;
  return (
    location.latitude >= BONAMOUSSADI_BOUNDS.south &&
    location.latitude <= BONAMOUSSADI_BOUNDS.north &&
    location.longitude >= BONAMOUSSADI_BOUNDS.west &&
    location.longitude <= BONAMOUSSADI_BOUNDS.east
  );
}

export function isWithinCameroon(location: SubmissionLocation | null | undefined): boolean {
  if (!location) return false;
  return (
    location.latitude >= CAMEROON_BOUNDS.south &&
    location.latitude <= CAMEROON_BOUNDS.north &&
    location.longitude >= CAMEROON_BOUNDS.west &&
    location.longitude <= CAMEROON_BOUNDS.east
  );
}

export function bonamoussadiLeafletBounds(): [[number, number], [number, number]] {
  return [
    [BONAMOUSSADI_BOUNDS.south, BONAMOUSSADI_BOUNDS.west],
    [BONAMOUSSADI_BOUNDS.north, BONAMOUSSADI_BOUNDS.east],
  ];
}

export function cameroonLeafletBounds(): [[number, number], [number, number]] {
  return [
    [CAMEROON_BOUNDS.south, CAMEROON_BOUNDS.west],
    [CAMEROON_BOUNDS.north, CAMEROON_BOUNDS.east],
  ];
}
