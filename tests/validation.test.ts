import assert from "node:assert/strict";
import test from "node:test";
import {
  consentStatusSchema,
  reviewBodySchema,
  submissionInputSchema,
  userUpdateSchema,
  userStatusPatchSchema,
} from "../lib/server/validation.ts";

test("consentStatusSchema accepts the pilot consent states", () => {
  assert.equal(consentStatusSchema.parse("obtained"), "obtained");
  assert.equal(consentStatusSchema.parse("refused_pii_only"), "refused_pii_only");
  assert.equal(consentStatusSchema.parse("not_required"), "not_required");
  assert.equal(consentStatusSchema.parse("withdrawn"), "withdrawn");
});

test("submissionInputSchema accepts enriched pilot fraud signals", () => {
  const parsed = submissionInputSchema.parse({
    category: "pharmacy",
    details: { siteName: "Pharmacie de la Paix" },
    imageBase64: "data:image/jpeg;base64,abc123",
    consentStatus: "obtained",
    consentRecordedAt: "2026-03-10T10:00:00.000Z",
    gpsIntegrity: {
      mockLocationDetected: false,
      mockLocationMethod: null,
      hasAccelerometerData: true,
      hasGyroscopeData: true,
      accelerometerSampleCount: 8,
      motionDetectedDuringCapture: true,
      gpsAccuracyMeters: 6.3,
      networkType: "4g",
      gpsTimestamp: 1741600800000,
      deviceTimestamp: 1741600802000,
      timeDeltaMs: 2000,
    },
    photoEvidenceSha256: "a".repeat(64),
  });

  assert.equal(parsed.consentStatus, "obtained");
  assert.equal(parsed.gpsIntegrity?.networkType, "4g");
});

test("submissionInputSchema rejects unexpected fields and malformed hashes", () => {
  assert.throws(
    () =>
      submissionInputSchema.parse({
        category: "pharmacy",
        imageBase64: "data:image/jpeg;base64,abc123",
        photoEvidenceSha256: "bad-hash",
        injected: true,
      }),
    /Invalid string|Unrecognized key/,
  );
});

test("reviewBodySchema and userStatusPatchSchema enforce pilot review controls", () => {
  assert.deepEqual(reviewBodySchema.parse({ decision: "flagged", notes: "Needs field audit" }), {
    decision: "flagged",
    notes: "Needs field audit",
  });

  assert.deepEqual(
    userStatusPatchSchema.parse({
      userId: "agent-1",
      trustScore: 20,
      suspendedUntil: "2026-03-17T00:00:00.000Z",
      wipeRequested: true,
    }),
    {
      userId: "agent-1",
      trustScore: 20,
      suspendedUntil: "2026-03-17T00:00:00.000Z",
      wipeRequested: true,
    },
  );
});

test("userUpdateSchema accepts only built-in avatar presets", () => {
  assert.deepEqual(
    userUpdateSchema.parse({
      avatarPreset: "lagoon",
      occupation: "Field agent",
    }),
    {
      avatarPreset: "lagoon",
      occupation: "Field agent",
    },
  );

  assert.throws(() => userUpdateSchema.parse({ avatarPreset: "remote-url" }), /Invalid option/);
});
