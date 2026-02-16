import type { SubmissionLocation } from "./types.js";

export const BONAMOUSSADI_BOUNDS = {
  south: 4.0755,
  west: 9.7185,
  north: 4.0999,
  east: 9.7602,
} as const;

export const BONAMOUSSADI_CENTER = {
  latitude: 4.0877,
  longitude: 9.7394,
} as const;

export function isWithinBonamoussadi(location: SubmissionLocation | null | undefined): boolean {
  if (!location) return false;
  return (
    location.latitude >= BONAMOUSSADI_BOUNDS.south &&
    location.latitude <= BONAMOUSSADI_BOUNDS.north &&
    location.longitude >= BONAMOUSSADI_BOUNDS.west &&
    location.longitude <= BONAMOUSSADI_BOUNDS.east
  );
}

export function bonamoussadiLeafletBounds(): [[number, number], [number, number]] {
  return [
    [BONAMOUSSADI_BOUNDS.south, BONAMOUSSADI_BOUNDS.west],
    [BONAMOUSSADI_BOUNDS.north, BONAMOUSSADI_BOUNDS.east],
  ];
}
