import assert from "node:assert/strict";
import test from "node:test";
import { findActivePoint, listNearbyPoints } from "../lib/server/platform/pointLookup.js";
import type { PointEvent } from "../shared/types.js";

const ORIGIN = { latitude: 4.05, longitude: 9.7 };

// ~100 m north of ORIGIN (1 deg latitude ~= 111.19 km at this radius).
const NEAR_EVENT: PointEvent = {
  id: "evt-near",
  pointId: "point-near",
  eventType: "CREATE_EVENT",
  userId: "u-1",
  category: "pharmacy",
  location: { latitude: 4.0509, longitude: 9.7 },
  details: { name: "Pharmacie du Coin" },
  createdAt: "2026-07-01T00:00:00.000Z",
};

// ~10 km north of ORIGIN.
const FAR_EVENT: PointEvent = {
  id: "evt-far",
  pointId: "point-far",
  eventType: "CREATE_EVENT",
  userId: "u-2",
  category: "pharmacy",
  location: { latitude: 4.14, longitude: 9.7 },
  details: { name: "Pharmacie Lointaine" },
  createdAt: "2026-07-01T00:00:00.000Z",
};

function fakeLoadEventsFn(): () => Promise<PointEvent[]> {
  return async () => [NEAR_EVENT, FAR_EVENT];
}

test("listNearbyPoints filters points outside the radius and sorts ascending by distance", async () => {
  const points = await listNearbyPoints(
    { latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, radiusMeters: 2000, limit: 10 },
    { loadEventsFn: fakeLoadEventsFn() },
  );

  assert.equal(points.length, 1);
  assert.equal(points[0]?.pointId, "point-near");
  assert.equal(points[0]?.name, "Pharmacie du Coin");
  assert.ok(Math.abs(points[0]!.distanceMeters - 100) <= 30, `expected ~100m, got ${points[0]?.distanceMeters}`);
});

test("listNearbyPoints includes all points within a wide-enough radius, near first", async () => {
  const points = await listNearbyPoints(
    { latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, radiusMeters: 20_000, limit: 10 },
    { loadEventsFn: fakeLoadEventsFn() },
  );

  assert.equal(points.length, 2);
  assert.equal(points[0]?.pointId, "point-near");
  assert.equal(points[1]?.pointId, "point-far");
  assert.ok(points[0]!.distanceMeters < points[1]!.distanceMeters);
});

test("findActivePoint returns the projected point for a known id", async () => {
  const point = await findActivePoint("point-near", { loadEventsFn: fakeLoadEventsFn() });
  assert.equal(point?.pointId, "point-near");
  assert.equal(point?.category, "pharmacy");
});

test("findActivePoint returns null for an unknown id", async () => {
  const point = await findActivePoint("point-unknown", { loadEventsFn: fakeLoadEventsFn() });
  assert.equal(point, null);
});
