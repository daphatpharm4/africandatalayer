import assert from "node:assert/strict";
import test from "node:test";
import { extractSubmissionFields } from "../lib/server/ai/extractSubmissionFields.js";

test("extractSubmissionFields validates model output and preserves metadata", async () => {
  const result = await extractSubmissionFields(
    {
      category: "pharmacy",
      location: { latitude: 4.071, longitude: 9.736 },
      language: "en",
      draftDetails: { name: "Pharmacie Lumiere", phone: "+237699000000" },
    },
    async (input) => ({
      json: {
        detectedCategory: "pharmacy",
        fieldSuggestions: [
          { field: "name", value: "Pharmacie Lumiere", confidence: 0.9, evidence: "Visible sign" },
        ],
        qualityWarnings: [],
        confidence: 0.9,
      },
      metadata: {
        provider: "test",
        model: "mock",
        modelVersion: null,
        promptVersion: input.promptVersion,
        confidence: 0.9,
      },
    }),
  );

  assert.equal(result.detectedCategory, "pharmacy");
  assert.equal(result.fieldSuggestions[0]?.field, "name");
  assert.equal(result.modelMetadata.provider, "test");
});
