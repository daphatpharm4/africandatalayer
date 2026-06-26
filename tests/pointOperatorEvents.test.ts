import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPointOperatorSignalEvent,
  buildPointOperatorPhotoEvent,
  classifyPointOperatorSignal,
} from "../lib/server/pointOperatorService.js";
import type { PointEvent } from "../shared/types.js";

// ─── buildPointOperatorSignalEvent ───────────────────────────────────────────

test("operator status becomes a single-field enrich event", () => {
  const event = buildPointOperatorSignalEvent({
    eventId: "00000000-0000-4000-8000-000000000001",
    operatorUserId: "op@example.com",
    point: {
      pointId: "pharmacy-s16gdp-a1",
      category: "pharmacy",
      location: { latitude: 4.08, longitude: 9.74 },
    },
    field: "isOpenNow",
    value: true,
    reportedAt: new Date("2026-06-24T08:00:00.000Z"),
    reviewState: "auto_approved",
  });

  assert.equal(event.eventType, "ENRICH_EVENT");
  assert.equal(event.source, "point_operator");
  assert.deepEqual(event.details.isOpenNow, true);
  assert.equal(event.details.operatorSignal?.field, "isOpenNow");
  // isOpenNow TTL = 6h: 08:00Z + 6h = 14:00Z
  assert.equal(event.details.operatorSignal?.expiresAt, "2026-06-24T14:00:00.000Z");
  assert.equal(event.details.operatorSignal?.reviewState, "auto_approved");
  assert.equal(event.details.xpAwarded, 0);
  assert.equal(event.details.reviewStatus, "auto_approved");
});

test("pending_review signal sets reviewStatus=pending_review", () => {
  const event = buildPointOperatorSignalEvent({
    eventId: "00000000-0000-4000-8000-000000000002",
    operatorUserId: "op@example.com",
    point: {
      pointId: "pharmacy-s16gdp-a1",
      category: "pharmacy",
      location: { latitude: 4.08, longitude: 9.74 },
    },
    field: "isOpenNow",
    value: false,
    reportedAt: new Date("2026-06-24T08:00:00.000Z"),
    reviewState: "pending_review",
  });

  assert.equal(event.details.reviewStatus, "pending_review");
  assert.equal(event.details.operatorSignal?.reviewState, "pending_review");
  assert.equal(event.details.xpAwarded, 0);
});

test("signal event has correct pointId, category, location, userId", () => {
  const event = buildPointOperatorSignalEvent({
    eventId: "00000000-0000-4000-8000-000000000003",
    operatorUserId: "op@example.com",
    point: {
      pointId: "fuel-abc-1",
      category: "fuel_station",
      location: { latitude: 4.1, longitude: 9.75 },
    },
    field: "hasFuelAvailable",
    value: true,
    reportedAt: new Date("2026-06-24T10:00:00.000Z"),
    reviewState: "auto_approved",
  });

  assert.equal(event.pointId, "fuel-abc-1");
  assert.equal(event.category, "fuel_station");
  assert.equal(event.userId, "op@example.com");
  assert.equal(event.location.latitude, 4.1);
  assert.equal(event.id, "00000000-0000-4000-8000-000000000003");
});

test("signal event stores reportedAt in operatorSignal metadata", () => {
  const reportedAt = new Date("2026-06-24T08:00:00.000Z");
  const event = buildPointOperatorSignalEvent({
    eventId: "ev-1",
    operatorUserId: "op@example.com",
    point: {
      pointId: "pharmacy-1",
      category: "pharmacy",
      location: { latitude: 4.08, longitude: 9.74 },
    },
    field: "isOpenNow",
    value: true,
    reportedAt,
    reviewState: "auto_approved",
  });

  assert.equal(event.details.operatorSignal?.reportedAt, "2026-06-24T08:00:00.000Z");
});

// ─── buildPointOperatorPhotoEvent ────────────────────────────────────────────

test("photo event has xpAwarded=0, operatorPhotoUpdate=true, reviewStatus=pending_review", () => {
  const event = buildPointOperatorPhotoEvent({
    eventId: "photo-ev-1",
    operatorUserId: "op@example.com",
    point: {
      pointId: "pharmacy-1",
      category: "pharmacy",
      location: { latitude: 4.08, longitude: 9.74 },
    },
    photoUrl: "https://cdn.example.com/photo.jpg",
    reportedAt: new Date("2026-06-24T10:00:00.000Z"),
  });

  assert.equal(event.eventType, "ENRICH_EVENT");
  assert.equal(event.source, "point_operator");
  assert.equal(event.photoUrl, "https://cdn.example.com/photo.jpg");
  assert.equal(event.details.operatorPhotoUpdate, true);
  assert.equal(event.details.reviewStatus, "pending_review");
  assert.equal(event.details.xpAwarded, 0);
});

// ─── classifyPointOperatorSignal ─────────────────────────────────────────────

test("classifier returns auto_approved when no anomalies", () => {
  const result = classifyPointOperatorSignal({
    field: "isOpenNow",
    recentSameFieldEvents: [],
    value: true,
    capturedAt: new Date("2026-06-24T08:00:00.000Z"),
  });
  assert.equal(result, "auto_approved");
});

test("classifier returns pending_review when lastHour >= 6 events", () => {
  const capturedAt = new Date("2026-06-24T08:00:00.000Z");
  const recentSameFieldEvents: PointEvent[] = Array.from({ length: 6 }, (_, i) => ({
    id: `ev-${i}`,
    pointId: "pharmacy-1",
    eventType: "ENRICH_EVENT" as const,
    userId: "op@example.com",
    category: "pharmacy" as const,
    location: { latitude: 4.08, longitude: 9.74 },
    details: { isOpenNow: true },
    createdAt: new Date(capturedAt.getTime() - (i + 1) * 5 * 60 * 1000).toISOString(), // within last hour
    source: "point_operator",
  }));

  const result = classifyPointOperatorSignal({
    field: "isOpenNow",
    recentSameFieldEvents,
    value: true,
    capturedAt,
  });
  assert.equal(result, "pending_review");
});

test("classifier returns pending_review when flips >= 3 in last hour", () => {
  const capturedAt = new Date("2026-06-24T08:00:00.000Z");
  // 3 events with opposite value (flips)
  const recentSameFieldEvents: PointEvent[] = Array.from({ length: 3 }, (_, i) => ({
    id: `flip-${i}`,
    pointId: "pharmacy-1",
    eventType: "ENRICH_EVENT" as const,
    userId: "op@example.com",
    category: "pharmacy" as const,
    location: { latitude: 4.08, longitude: 9.74 },
    details: { isOpenNow: false }, // opposite of value=true
    createdAt: new Date(capturedAt.getTime() - (i + 1) * 5 * 60 * 1000).toISOString(),
    source: "point_operator",
  }));

  const result = classifyPointOperatorSignal({
    field: "isOpenNow",
    recentSameFieldEvents,
    value: true, // differs from above (false)
    capturedAt,
  });
  assert.equal(result, "pending_review");
});

test("classifier returns pending_review when disagreeing with recent verified agent", () => {
  const result = classifyPointOperatorSignal({
    field: "isOpenNow",
    recentSameFieldEvents: [],
    value: true,
    capturedAt: new Date("2026-06-24T08:00:00.000Z"),
    recentVerifiedAgentValue: false, // disagrees
  });
  assert.equal(result, "pending_review");
});

test("classifier returns auto_approved when agreeing with recent verified agent", () => {
  const result = classifyPointOperatorSignal({
    field: "isOpenNow",
    recentSameFieldEvents: [],
    value: true,
    capturedAt: new Date("2026-06-24T08:00:00.000Z"),
    recentVerifiedAgentValue: true, // agrees
  });
  assert.equal(result, "auto_approved");
});

test("classifier ignores events older than 1 hour for threshold check", () => {
  const capturedAt = new Date("2026-06-24T08:00:00.000Z");
  // 8 events, but all older than 1h
  const recentSameFieldEvents: PointEvent[] = Array.from({ length: 8 }, (_, i) => ({
    id: `old-${i}`,
    pointId: "pharmacy-1",
    eventType: "ENRICH_EVENT" as const,
    userId: "op@example.com",
    category: "pharmacy" as const,
    location: { latitude: 4.08, longitude: 9.74 },
    details: { isOpenNow: true },
    createdAt: new Date(capturedAt.getTime() - (70 + i) * 60 * 1000).toISOString(), // 70+ min ago
    source: "point_operator",
  }));

  const result = classifyPointOperatorSignal({
    field: "isOpenNow",
    recentSameFieldEvents,
    value: true,
    capturedAt,
  });
  assert.equal(result, "auto_approved");
});
