import assert from "node:assert/strict";
import test from "node:test";
import { buildReviewSummary } from "../lib/server/ai/reviewAssistant.js";

test("buildReviewSummary returns human-readable drivers and metadata", async () => {
  const result = await buildReviewSummary(
    {
      eventId: "event-1",
      pointId: "point-1",
      riskScore: 72,
      reviewFlags: ["gps_integrity_mock_location", "high_velocity"],
      riskComponents: { locationRisk: 30, photoRisk: 10, temporalRisk: 20, userRisk: 5, behavioralRisk: 7 },
    },
    async (input) => ({
      json: {
        summary: "High risk because GPS integrity and velocity signals need review.",
        recommendedChecks: ["Check GPS path", "Review photo metadata"],
        riskDrivers: ["Mock location signal", "High velocity"],
        supportingEvidence: ["riskScore=72"],
        caveats: ["AI does not make the final decision"],
        agentFeedbackDraft: { en: "Retake with GPS enabled.", fr: "Reprenez avec le GPS actif." },
        confidence: 0.8,
      },
      metadata: { provider: "test", model: "mock", modelVersion: null, promptVersion: input.promptVersion, confidence: 0.8 },
    }),
  );

  assert.equal(result.riskDrivers.length, 2);
  assert.equal(result.modelMetadata.provider, "test");
});
