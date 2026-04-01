import assert from "node:assert/strict";
import test from "node:test";
import { filterPublicSubmissionDetails, toPublicProjectedPoint } from "../lib/server/privacy.js";
import type { ProjectedPoint } from "../shared/types.js";

test("filterPublicSubmissionDetails keeps display metadata and strips sensitive internals", () => {
  const filtered = filterPublicSubmissionDetails({
    name: "Pharmacie du Centre",
    openingHours: "24/7",
    providers: ["Orange Money"],
    phone: "+237655001122",
    merchantId: "merchant-123",
    fraudCheck: {
      submissionLocation: null,
      effectiveLocation: { latitude: 4.06, longitude: 9.74 },
      ipLocation: null,
      primaryPhoto: null,
      secondaryPhoto: null,
      submissionMatchThresholdKm: 1,
      ipMatchThresholdKm: 50,
    },
    clientDevice: { deviceId: "device-1" },
    gpsIntegrity: {
      mockLocationDetected: true,
      mockLocationMethod: null,
      hasAccelerometerData: false,
      hasGyroscopeData: false,
      accelerometerSampleCount: 0,
      motionDetectedDuringCapture: false,
      gpsAccuracyMeters: null,
      networkType: null,
      gpsTimestamp: null,
      deviceTimestamp: Date.now(),
      timeDeltaMs: null,
    },
    reviewStatus: "pending_review",
    riskScore: 98,
  });

  assert.deepEqual(filtered, {
    name: "Pharmacie du Centre",
    openingHours: "24/7",
    providers: ["Orange Money"],
  });
});

test("toPublicProjectedPoint removes traversal metadata and photo access", () => {
  const point: ProjectedPoint = {
    id: "point-1",
    pointId: "point-1",
    category: "pharmacy",
    location: { latitude: 4.06, longitude: 9.74 },
    details: {
      name: "Pharmacie du Centre",
      provider: "Orange Money",
      merchantId: "merchant-123",
      photoEvidenceSha256: "a".repeat(64),
    },
    photoUrl: "https://example.com/photo.jpg",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-02T10:00:00.000Z",
    source: "field_agent",
    externalId: "ext-1",
    gaps: [],
    eventsCount: 3,
    eventIds: ["evt-1", "evt-2", "evt-3"],
  };

  const sanitized = toPublicProjectedPoint(point);
  assert.equal(sanitized.photoUrl, undefined);
  assert.equal(sanitized.source, undefined);
  assert.equal(sanitized.externalId, undefined);
  assert.deepEqual(sanitized.eventIds, []);
  assert.deepEqual(sanitized.details, {
    name: "Pharmacie du Centre",
    provider: "Orange Money",
  });
});
