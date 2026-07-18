// Read-side lookup of an organization's own points for the tenant platform.
// A "point" is a chain of the org's APPROVED records sharing a root id:
// a record with no point_id starts a chain (root = its own id); records
// attached to it carry point_id = root. Org-private by construction —
// public projected points are never exposed here.
import type { PlatformNearbyPoint, PlatformRecord } from "../../../shared/platformTypes.js";
import * as recordStore from "./recordStore.js";
import { haversineKm } from "../submissionFraud.js";

export interface PointLookupDeps {
  listRecordsFn?: typeof recordStore.listRecords;
}

const CANDIDATE_RECORD_LIMIT = 200;
const NAME_KEYS = ["name", "nom", "title", "titre", "label"];

function recordLocation(record: PlatformRecord): { latitude: number; longitude: number } | null {
  const gps = record.evidence?.gps;
  if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
    return { latitude: gps.latitude, longitude: gps.longitude };
  }
  return null;
}

function recordName(record: PlatformRecord): string | null {
  const data = record.data ?? {};
  for (const key of NAME_KEYS) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function anyStringValue(record: PlatformRecord): string | null {
  for (const value of Object.values(record.data ?? {})) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function rootId(record: PlatformRecord): string {
  return record.pointId ?? record.id;
}

function groupByRoot(records: PlatformRecord[]): Map<string, PlatformRecord[]> {
  const groups = new Map<string, PlatformRecord[]>();
  for (const record of records) {
    const root = rootId(record);
    const group = groups.get(root);
    if (group) group.push(record);
    else groups.set(root, [record]);
  }
  return groups;
}

async function loadApprovedRecords(
  organizationId: string,
  deps: PointLookupDeps,
): Promise<PlatformRecord[]> {
  const listRecords = deps.listRecordsFn ?? recordStore.listRecords;
  return listRecords({ organizationId, status: "approved", limit: CANDIDATE_RECORD_LIMIT });
}

// Resolve one of the org's points by root id, for the enrich gates.
// Returns the chain's most recent locatable record's position.
export async function findOrgPoint(
  input: { organizationId: string; pointId: string },
  deps: PointLookupDeps = {},
): Promise<{ pointId: string; location: { latitude: number; longitude: number } } | null> {
  const records = await loadApprovedRecords(input.organizationId, deps);
  const members = records
    .filter((record) => rootId(record) === input.pointId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const member of members) {
    const location = recordLocation(member);
    if (location) return { pointId: input.pointId, location };
  }
  return null;
}

export async function listNearbyOrgPoints(
  input: { organizationId: string; latitude: number; longitude: number; radiusMeters: number; limit: number },
  deps: PointLookupDeps = {},
): Promise<PlatformNearbyPoint[]> {
  const records = await loadApprovedRecords(input.organizationId, deps);
  const origin = { latitude: input.latitude, longitude: input.longitude };
  const points: PlatformNearbyPoint[] = [];
  for (const [root, group] of groupByRoot(records)) {
    const byNewest = [...group].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const anchor = byNewest.find((record) => recordLocation(record) !== null);
    if (!anchor) continue;
    const location = recordLocation(anchor)!;
    const name = byNewest.map(recordName).find((value) => value !== null)
      ?? byNewest.map(anyStringValue).find((value) => value !== null)
      ?? null;
    points.push({
      pointId: root,
      category: anchor.recordTypeKey,
      name,
      location,
      details: name ? { name } : {},
      createdAt: byNewest[byNewest.length - 1].createdAt,
      updatedAt: byNewest[0].createdAt,
      gaps: [],
      eventsCount: group.length,
      distanceMeters: Math.round(haversineKm(origin, location) * 1000),
    });
  }
  return points
    .filter((point) => point.distanceMeters <= input.radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, input.limit);
}
