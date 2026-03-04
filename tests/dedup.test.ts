import test from "node:test";
import assert from "node:assert/strict";
import { buildDedupCandidates } from "../lib/server/dedup.js";
import type { ProjectedPoint, SubmissionCategory } from "../shared/types.js";

function point(category: SubmissionCategory, pointId: string, latitude: number, longitude: number, name: string): ProjectedPoint {
  return {
    id: pointId,
    pointId,
    category,
    location: { latitude, longitude },
    details: { name, siteName: name },
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    gaps: [],
    eventsCount: 1,
    eventIds: [`evt-${pointId}`],
  };
}

test("buildDedupCandidates flags close and similar points", () => {
  const points: ProjectedPoint[] = [
    point("pharmacy", "pharmacy-s16gdp-aaaa1111", 4.0862, 9.7354, "Pharmacie de Bonamoussadi"),
    point("pharmacy", "pharmacy-s16gdp-bbbb2222", 4.0890, 9.7378, "Pharmacie de Makepe"),
  ];

  const result = buildDedupCandidates(
    "pharmacy",
    { latitude: 4.08623, longitude: 9.73542 },
    { name: "Pharmacie de Bonamoussadi" },
    points,
  );

  assert.equal(result.shouldPrompt, true);
  assert.equal(result.candidates[0]?.pointId, "pharmacy-s16gdp-aaaa1111");
  assert.ok((result.candidates[0]?.similarityScore ?? 0) >= 0.7);
});

test("buildDedupCandidates returns no candidates outside radius", () => {
  const points: ProjectedPoint[] = [
    point("pharmacy", "pharmacy-s16gdp-aaaa1111", 4.0900, 9.7500, "Far pharmacy"),
  ];

  const result = buildDedupCandidates(
    "pharmacy",
    { latitude: 4.0862, longitude: 9.7354 },
    { name: "Pharmacie de Bonamoussadi" },
    points,
  );

  assert.equal(result.candidates.length, 0);
  assert.equal(result.shouldPrompt, false);
});
