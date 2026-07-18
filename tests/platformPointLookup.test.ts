import assert from "node:assert/strict";
import test from "node:test";
import { findOrgPoint, listNearbyOrgPoints } from "../lib/server/platform/pointLookup.js";
import type { PlatformRecord } from "../shared/platformTypes.js";

const ORG = "org-1";
const ORIGIN = { latitude: 45.7375, longitude: 4.8832 };

function record(overrides: Partial<PlatformRecord>): PlatformRecord {
  return {
    id: "rec-base",
    projectId: "proj-1",
    organizationId: ORG,
    schemaVersionId: "schema-1",
    recordTypeKey: "waste_bin",
    data: {},
    evidence: { photos: [] },
    status: "approved",
    capturedBy: "collector@acme.test",
    createdAt: "2026-07-01T00:00:00.000Z",
    pointId: null,
    ...overrides,
  };
}

// ~100 m north of ORIGIN.
const ROOT_RECORD = record({
  id: "rec-root",
  data: { name: "Poubelle officielle" },
  evidence: { gps: { latitude: 45.7384, longitude: 4.8832 }, photos: [] },
  createdAt: "2026-07-01T00:00:00.000Z",
});

// Later survey chained to the root (same physical point).
const CHAINED_RECORD = record({
  id: "rec-chained",
  pointId: "rec-root",
  data: { note: "still there" },
  evidence: { gps: { latitude: 45.73841, longitude: 4.88321 }, photos: [] },
  createdAt: "2026-07-10T00:00:00.000Z",
});

// ~10 km away — separate point.
const FAR_RECORD = record({
  id: "rec-far",
  data: { name: "Bac lointain" },
  evidence: { gps: { latitude: 45.8275, longitude: 4.8832 }, photos: [] },
  createdAt: "2026-07-05T00:00:00.000Z",
});

// No GPS at all — must never become a point.
const NO_GPS_RECORD = record({ id: "rec-nogps", data: { name: "Sans GPS" } });

function fakeListRecordsFn(records: PlatformRecord[]) {
  const calls: unknown[] = [];
  const fn = async (input: unknown) => {
    calls.push(input);
    return records;
  };
  return { fn: fn as any, calls };
}

test("listNearbyOrgPoints groups chained records into one point with latest freshness", async () => {
  const { fn, calls } = fakeListRecordsFn([ROOT_RECORD, CHAINED_RECORD, FAR_RECORD, NO_GPS_RECORD]);
  const points = await listNearbyOrgPoints(
    { organizationId: ORG, latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, radiusMeters: 2000, limit: 10 },
    { listRecordsFn: fn },
  );

  assert.equal(points.length, 1);
  assert.equal(points[0]?.pointId, "rec-root");
  assert.equal(points[0]?.eventsCount, 2);
  assert.equal(points[0]?.updatedAt, CHAINED_RECORD.createdAt);
  assert.equal(points[0]?.createdAt, ROOT_RECORD.createdAt);
  // Anchor is the newest locatable record; name falls back through the chain.
  assert.equal(points[0]?.name, "Poubelle officielle");
  assert.ok(Math.abs(points[0]!.distanceMeters - 100) <= 30, `expected ~100m, got ${points[0]?.distanceMeters}`);
  assert.deepEqual(calls[0], { organizationId: ORG, status: "approved", limit: 200 });
});

test("listNearbyOrgPoints includes far points only with a wide radius, sorted ascending", async () => {
  const { fn } = fakeListRecordsFn([ROOT_RECORD, FAR_RECORD]);
  const points = await listNearbyOrgPoints(
    { organizationId: ORG, latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, radiusMeters: 20_000, limit: 10 },
    { listRecordsFn: fn },
  );
  assert.equal(points.length, 2);
  assert.equal(points[0]?.pointId, "rec-root");
  assert.equal(points[1]?.pointId, "rec-far");
  assert.ok(points[0]!.distanceMeters < points[1]!.distanceMeters);
});

test("findOrgPoint resolves a chain root to its latest locatable position", async () => {
  const { fn } = fakeListRecordsFn([ROOT_RECORD, CHAINED_RECORD]);
  const point = await findOrgPoint({ organizationId: ORG, pointId: "rec-root" }, { listRecordsFn: fn });
  assert.equal(point?.pointId, "rec-root");
  // Latest chain member's GPS wins.
  assert.equal(point?.location.latitude, 45.73841);
});

test("findOrgPoint returns null for unknown ids and for GPS-less chains", async () => {
  const { fn } = fakeListRecordsFn([NO_GPS_RECORD]);
  assert.equal(await findOrgPoint({ organizationId: ORG, pointId: "rec-unknown" }, { listRecordsFn: fn }), null);
  assert.equal(await findOrgPoint({ organizationId: ORG, pointId: "rec-nogps" }, { listRecordsFn: fn }), null);
});
