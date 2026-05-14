import assert from "node:assert/strict";
import test from "node:test";
import {
  aiAnalyticsQueryRequestSchema,
  aiExtractionRequestSchema,
  aiReviewSummaryRequestSchema,
  poiCandidatePatchSchema,
} from "../lib/server/validation.js";

test("aiExtractionRequestSchema accepts a minimal image extraction request", () => {
  const result = aiExtractionRequestSchema.safeParse({
    category: "pharmacy",
    imageData: "data:image/jpeg;base64,abcd",
    location: { latitude: 4.071, longitude: 9.736 },
    language: "en",
    draftDetails: { name: "Pharmacie Test" },
  });

  assert.equal(result.success, true);
});

test("aiReviewSummaryRequestSchema requires an event id", () => {
  const result = aiReviewSummaryRequestSchema.safeParse({});
  assert.equal(result.success, false);
});

test("aiAnalyticsQueryRequestSchema accepts aggregate-only client query", () => {
  const result = aiAnalyticsQueryRequestSchema.safeParse({
    question: "What changed in fuel this week?",
    vertical: "fuel_station",
    zone: "bonamoussadi",
    dateRange: { from: "2026-05-01", to: "2026-05-14" },
  });

  assert.equal(result.success, true);
});

test("poiCandidatePatchSchema rejects invalid status", () => {
  const result = poiCandidatePatchSchema.safeParse({ matchStatus: "trusted" });
  assert.equal(result.success, false);
});
