import assert from "node:assert/strict";
import test from "node:test";
import { answerAnalyticsQuestion } from "../lib/server/ai/analyticsAssistant.js";

test("answerAnalyticsQuestion cites source facts and caveats", async () => {
  const result = await answerAnalyticsQuestion(
    {
      question: "What changed in fuel?",
      facts: [{ label: "New points", value: 3, source: "snapshot_deltas" }],
    },
    async (input) => ({
      json: {
        answer: "Fuel station coverage added 3 publishable new points.",
        facts: [{ label: "New points", value: 3, source: "snapshot_deltas" }],
        caveats: ["Only publishable deltas included."],
        suggestedNextValidations: ["Verify high-change cells."],
        confidence: 0.82,
      },
      metadata: { provider: "test", model: "mock", modelVersion: null, promptVersion: input.promptVersion, confidence: 0.82 },
    }),
  );

  assert.equal(result.facts[0]?.source, "snapshot_deltas");
  assert.equal(result.caveats.length, 1);
});
