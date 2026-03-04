import type { ZoneBounds } from "./types.js";

export interface CollectionZone {
  id: string;
  label: string;
  bounds: ZoneBounds;
}

export const BONAMOUSSADI_COLLECTION_ZONES: CollectionZone[] = [
  {
    id: "bona-zone-a",
    label: "Zone A (West)",
    bounds: { south: 4.0755, west: 9.7185, north: 4.0999, east: 9.7350 },
  },
  {
    id: "bona-zone-b",
    label: "Zone B (Central)",
    bounds: { south: 4.0755, west: 9.7350, north: 4.0999, east: 9.7480 },
  },
  {
    id: "bona-zone-c",
    label: "Zone C (East)",
    bounds: { south: 4.0755, west: 9.7480, north: 4.0999, east: 9.7602 },
  },
];

const ZONE_BY_ID = new Map(BONAMOUSSADI_COLLECTION_ZONES.map((zone) => [zone.id, zone]));

export function getCollectionZone(zoneId: string): CollectionZone | null {
  return ZONE_BY_ID.get(zoneId) ?? null;
}
