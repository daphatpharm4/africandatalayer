import assert from "node:assert/strict";
import test from "node:test";
import type { LegacySubmission, PointEvent } from "../shared/types.js";
import { findReadableProjectedPoint } from "../lib/server/submissionEvents.js";

function pointEvent(overrides: Partial<PointEvent> = {}): PointEvent {
  return {
    id: "event-1",
    pointId: "point-1",
    eventType: "CREATE_EVENT",
    userId: "agent@example.com",
    category: "pharmacy",
    location: { latitude: 4.08, longitude: 9.73 },
    details: { name: "Database Pharmacy" },
    createdAt: "2026-06-24T07:00:00.000Z",
    ...overrides,
  };
}

function legacySubmission(overrides: Partial<LegacySubmission> = {}): LegacySubmission {
  return {
    id: "legacy-1",
    userId: "legacy@example.com",
    category: "mobile_money",
    location: { latitude: 4.09, longitude: 9.74 },
    details: { name: "Legacy Kiosk", providers: ["MTN"] },
    createdAt: "2026-06-20T07:00:00.000Z",
    ...overrides,
  };
}

test("findReadableProjectedPoint requests only the target point and prefers point events", async () => {
  let receivedFilter: unknown;
  const result = await findReadableProjectedPoint(" point-1 ", {
    getPointEventsFn: async (filter) => {
      receivedFilter = filter;
      return [pointEvent()];
    },
    getLegacySubmissionsFn: async () => [
      legacySubmission({ id: "point-1", details: { name: "Legacy duplicate", providers: ["Orange"] } }),
    ],
    seedEvents: [
      pointEvent({
        id: "seed-event-1",
        pointId: "point-1",
        userId: "seed_import",
        details: { name: "Seed duplicate" },
      }),
    ],
  });

  assert.deepEqual(receivedFilter, { pointId: "point-1" });
  assert.equal(result?.point.details.name, "Database Pharmacy");
  assert.deepEqual(result?.source, { kind: "point_event" });
});

test("findReadableProjectedPoint returns explicit legacy provenance", async () => {
  const result = await findReadableProjectedPoint("legacy-1", {
    getPointEventsFn: async () => [],
    getLegacySubmissionsFn: async () => [legacySubmission()],
    seedEvents: [],
  });

  assert.equal(result?.point.pointId, "legacy-1");
  assert.deepEqual(result?.source, {
    kind: "legacy_submission",
    submissionId: "legacy-1",
  });
});

test("findReadableProjectedPoint returns explicit curated seed provenance", async () => {
  const result = await findReadableProjectedPoint("seed-point-1", {
    getPointEventsFn: async () => [],
    getLegacySubmissionsFn: async () => [],
    seedEvents: [
      pointEvent({
        id: "seed-event-1",
        pointId: "seed-point-1",
        userId: "seed_import",
        details: { name: "Curated Pharmacy" },
      }),
    ],
  });

  assert.equal(result?.point.details.name, "Curated Pharmacy");
  assert.deepEqual(result?.source, {
    kind: "curated_seed",
    eventId: "seed-event-1",
  });
});
