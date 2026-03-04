import test from "node:test";
import assert from "node:assert/strict";
import { computeConfidenceFactors, computeConfidenceScore } from "../lib/server/confidenceScore.js";
import type { ProjectedPoint } from "../shared/types.js";

function makePoint(overrides: Partial<ProjectedPoint> = {}): ProjectedPoint {
  return {
    id: "pharmacy-s16gdp-a1b2c3d4",
    pointId: "pharmacy-s16gdp-a1b2c3d4",
    category: "pharmacy",
    location: { latitude: 4.086, longitude: 9.735 },
    details: {
      name: "Pharmacie Makepe",
      isOpenNow: true,
      openingHours: "08:00-20:00",
      isOnDuty: false,
      hasPhoto: true,
      reviewerApproved: true,
      fraudCheck: {
        submissionLocation: { latitude: 4.086, longitude: 9.735 },
        effectiveLocation: { latitude: 4.086, longitude: 9.735 },
        ipLocation: { latitude: 4.086, longitude: 9.735 },
        primaryPhoto: {
          gps: { latitude: 4.086, longitude: 9.735 },
          capturedAt: "2026-03-01T09:30:00.000Z",
          deviceMake: "Apple",
          deviceModel: "iPhone",
          submissionDistanceKm: 0.01,
          submissionGpsMatch: true,
          ipDistanceKm: 0.01,
          ipGpsMatch: true,
          exifStatus: "ok",
          exifReason: null,
          exifSource: "upload_buffer",
        },
        secondaryPhoto: null,
        submissionMatchThresholdKm: 0.5,
        ipMatchThresholdKm: 50,
      },
    },
    photoUrl: "https://example.com/photo.jpg",
    createdAt: "2026-03-01T09:30:00.000Z",
    updatedAt: "2026-03-01T09:30:00.000Z",
    source: "field_agent",
    externalId: undefined,
    gaps: [],
    eventsCount: 3,
    eventIds: ["event-1", "event-2", "event-3"],
    ...overrides,
  };
}

test("computeConfidenceFactors returns weighted buckets", () => {
  const point = makePoint();
  const factors = computeConfidenceFactors(point, new Date("2026-03-04T00:00:00.000Z"));
  assert.equal(factors.recency, 25);
  assert.equal(factors.sourceCount, 15);
  assert.equal(factors.photoEvidence, 15);
  assert.equal(factors.gpsAccuracy, 15);
  assert.equal(factors.reviewerApproval, 10);
});

test("computeConfidenceScore decays for stale points", () => {
  const fresh = computeConfidenceScore(makePoint(), new Date("2026-03-04T00:00:00.000Z"));
  const stale = computeConfidenceScore(
    makePoint({ updatedAt: "2025-01-01T00:00:00.000Z" }),
    new Date("2026-03-04T00:00:00.000Z"),
  );
  assert.ok(fresh > stale);
  assert.ok(stale >= 0 && stale <= 100);
});
