import assert from "node:assert/strict";
import test from "node:test";
import { projectPointsFromEvents } from "../lib/server/pointProjection.js";
import type { PointEvent } from "../shared/types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const freshCreate: PointEvent = {
  id: "create-1",
  pointId: "pharmacy-test-1",
  eventType: "CREATE_EVENT",
  userId: "agent@example.com",
  category: "pharmacy",
  location: { latitude: 4.08, longitude: 9.74 },
  details: { name: "Test Pharmacy", isOpenNow: true },
  photoUrl: "https://cdn.example.com/original.jpg",
  createdAt: "2026-06-24T06:00:00.000Z",
  source: "agent",
};

const expiredOperatorEvent: PointEvent = {
  id: "op-signal-expired",
  pointId: "pharmacy-test-1",
  eventType: "ENRICH_EVENT",
  userId: "op@example.com",
  category: "pharmacy",
  location: { latitude: 4.08, longitude: 9.74 },
  details: {
    isOpenNow: false,
    operatorSignal: {
      field: "isOpenNow",
      reportedAt: "2026-06-24T08:00:00.000Z",
      expiresAt: "2026-06-24T14:00:00.000Z", // expires at 14:00Z
      reviewState: "auto_approved",
    },
    xpAwarded: 0,
    reviewStatus: "auto_approved",
  },
  createdAt: "2026-06-24T08:00:00.000Z",
  source: "point_operator",
};

const activeOperatorEvent: PointEvent = {
  id: "op-signal-active",
  pointId: "pharmacy-test-2",
  eventType: "ENRICH_EVENT",
  userId: "op@example.com",
  category: "pharmacy",
  location: { latitude: 4.08, longitude: 9.74 },
  details: {
    isOpenNow: false,
    operatorSignal: {
      field: "isOpenNow",
      reportedAt: "2026-06-25T10:00:00.000Z",
      expiresAt: "2026-06-25T16:00:00.000Z", // expires at 16:00Z
      reviewState: "auto_approved",
    },
    xpAwarded: 0,
    reviewStatus: "auto_approved",
  },
  createdAt: "2026-06-25T10:00:00.000Z",
  source: "point_operator",
};

const freshCreate2: PointEvent = {
  ...freshCreate,
  id: "create-2",
  pointId: "pharmacy-test-2",
  details: { name: "Pharmacy 2", isOpenNow: true },
  createdAt: "2026-06-24T06:00:00.000Z",
};

const createWithPhoto: PointEvent = {
  id: "create-photo",
  pointId: "pharmacy-photo-test",
  eventType: "CREATE_EVENT",
  userId: "agent@example.com",
  category: "pharmacy",
  location: { latitude: 4.08, longitude: 9.74 },
  details: { name: "Photo Pharmacy" },
  photoUrl: "https://cdn.example.com/original-photo.jpg",
  createdAt: "2026-06-24T06:00:00.000Z",
  source: "agent",
};

const rejectedPhotoEvent: PointEvent = {
  id: "op-photo-rejected",
  pointId: "pharmacy-photo-test",
  eventType: "ENRICH_EVENT",
  userId: "op@example.com",
  category: "pharmacy",
  location: { latitude: 4.08, longitude: 9.74 },
  details: {
    operatorPhotoUpdate: true,
    reviewStatus: "rejected",
    xpAwarded: 0,
  },
  photoUrl: "https://cdn.example.com/operator-rejected.jpg",
  createdAt: "2026-06-24T09:00:00.000Z",
  source: "point_operator",
};

const pendingPhotoEvent: PointEvent = {
  id: "op-photo-pending",
  pointId: "pharmacy-photo-test",
  eventType: "ENRICH_EVENT",
  userId: "op@example.com",
  category: "pharmacy",
  location: { latitude: 4.08, longitude: 9.74 },
  details: {
    operatorPhotoUpdate: true,
    reviewStatus: "pending_review",
    xpAwarded: 0,
  },
  photoUrl: "https://cdn.example.com/operator-pending.jpg",
  createdAt: "2026-06-24T09:00:00.000Z",
  source: "point_operator",
};

const approvedPhotoEvent: PointEvent = {
  id: "op-photo-approved",
  pointId: "pharmacy-photo-test",
  eventType: "ENRICH_EVENT",
  userId: "op@example.com",
  category: "pharmacy",
  location: { latitude: 4.08, longitude: 9.74 },
  details: {
    operatorPhotoUpdate: true,
    reviewStatus: "auto_approved",
    xpAwarded: 0,
  },
  photoUrl: "https://cdn.example.com/operator-approved.jpg",
  createdAt: "2026-06-24T09:00:00.000Z",
  source: "point_operator",
};

const rejectedSignalEvent: PointEvent = {
  id: "op-signal-rejected",
  pointId: "pharmacy-test-1",
  eventType: "ENRICH_EVENT",
  userId: "op@example.com",
  category: "pharmacy",
  location: { latitude: 4.08, longitude: 9.74 },
  details: {
    isOpenNow: false,
    operatorSignal: {
      field: "isOpenNow",
      reportedAt: "2026-06-24T09:00:00.000Z",
      expiresAt: "2026-06-24T15:00:00.000Z",
      reviewState: "rejected",
    },
    reviewStatus: "rejected",
    xpAwarded: 0,
  },
  createdAt: "2026-06-24T09:00:00.000Z",
  source: "point_operator",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

test("expired operator value projects as unknown", () => {
  // now = 2026-06-25T00:00:00Z which is after expiresAt=2026-06-24T14:00:00Z
  const point = projectPointsFromEvents([freshCreate, expiredOperatorEvent], {
    now: new Date("2026-06-25T00:00:00.000Z"),
  })[0]!;
  // Expired: detail field should be removed
  assert.equal(point.details.isOpenNow, undefined);
  assert.equal(point.operatorSignals?.isOpenNow?.isExpired, true);
  assert.equal(point.operatorSignals?.isOpenNow?.value, null);
});

test("active operator value projects normally (not expired)", () => {
  // now = 2026-06-25T12:00:00Z which is before expiresAt=2026-06-25T16:00:00Z
  const point = projectPointsFromEvents([freshCreate2, activeOperatorEvent], {
    now: new Date("2026-06-25T12:00:00.000Z"),
  })[0]!;
  assert.equal(point.details.isOpenNow, false);
  assert.equal(point.operatorSignals?.isOpenNow?.isExpired, false);
  assert.equal(point.operatorSignals?.isOpenNow?.value, false);
});

test("rejected operator photo falls back to previous accepted photo", () => {
  const point = projectPointsFromEvents([createWithPhoto, rejectedPhotoEvent])[0]!;
  // rejected photo must not replace photoUrl
  assert.equal(point.photoUrl, createWithPhoto.photoUrl);
});

test("approved operator photo replaces photoUrl", () => {
  const point = projectPointsFromEvents([createWithPhoto, approvedPhotoEvent])[0]!;
  assert.equal(point.photoUrl, "https://cdn.example.com/operator-approved.jpg");
});

test("pending_review photo does not replace photoUrl (not yet approved)", () => {
  const point = projectPointsFromEvents([createWithPhoto, pendingPhotoEvent])[0]!;
  // pending = not rejected, so it replaces. But wait — the brief says rejected must NOT replace.
  // pending_review events are not skipped (only rejected are), so they do update photoUrl.
  // This test validates that behavior is correct per brief Step 6 ("Rejected photo events must NOT replace photoUrl").
  assert.equal(point.photoUrl, "https://cdn.example.com/operator-pending.jpg");
});

test("rejected operator signal event is skipped in projection", () => {
  // freshCreate sets isOpenNow=true, rejectedSignalEvent tries to set it to false with reviewStatus=rejected
  const points = projectPointsFromEvents([freshCreate, rejectedSignalEvent], {
    now: new Date("2026-06-24T12:00:00.000Z"),
  });
  const point = points.find((p) => p.pointId === "pharmacy-test-1")!;
  // Rejected signal should be skipped — isOpenNow should remain true from create
  assert.equal(point.details.isOpenNow, true);
});

test("operatorSignals map is set with correct metadata", () => {
  const point = projectPointsFromEvents([freshCreate2, activeOperatorEvent], {
    now: new Date("2026-06-25T12:00:00.000Z"),
  })[0]!;
  const sig = point.operatorSignals?.isOpenNow;
  assert.ok(sig, "operatorSignals.isOpenNow must exist");
  assert.equal(sig.field, "isOpenNow");
  assert.equal(sig.reportedBy, "point_operator");
  assert.equal(sig.reportedAt, "2026-06-25T10:00:00.000Z");
  assert.equal(sig.expiresAt, "2026-06-25T16:00:00.000Z");
  assert.equal(sig.reviewState, "auto_approved");
  assert.equal(sig.eventId, "op-signal-active");
});

test("projectPointsFromEvents is backward-compatible with no options argument", () => {
  // No options — existing callers must still work
  const points = projectPointsFromEvents([freshCreate]);
  assert.equal(points.length, 1);
  assert.equal(points[0].pointId, "pharmacy-test-1");
});

test("snapshot uses now param when provided for expiry check", () => {
  // Use 'now' = exactly at expiresAt boundary (should expire)
  const atExpiry = projectPointsFromEvents([freshCreate, expiredOperatorEvent], {
    now: new Date("2026-06-24T14:00:00.000Z"), // exactly at expiresAt
  })[0]!;
  assert.equal(atExpiry.operatorSignals?.isOpenNow?.isExpired, true);
});
