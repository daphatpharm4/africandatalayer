import assert from "node:assert/strict";
import test from "node:test";
import { matchPoiCandidate } from "../lib/server/poi/candidateMatcher.js";
import type { ProjectedPoint } from "../shared/types.js";

const existing: ProjectedPoint = {
  id: "p1",
  pointId: "p1",
  category: "pharmacy",
  location: { latitude: 4.071, longitude: 9.736 },
  details: { name: "Pharmacie Lumiere" },
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
  gaps: [],
  eventsCount: 1,
  eventIds: ["e1"],
};

test("matchPoiCandidate marks close same-name POI as existing match", () => {
  const result = matchPoiCandidate(
    {
      source: "osm",
      sourceLicense: "ODbL-1.0",
      sourceAttribution: "OpenStreetMap contributors",
      externalId: "node/123",
      raw: {},
      normalized: { name: "Pharmacie Lumiere" },
      category: "pharmacy",
      location: { latitude: 4.07101, longitude: 9.73601 },
      name: "Pharmacie Lumiere",
      confidence: 0.8,
    },
    [existing],
  );

  assert.equal(result.matchStatus, "matched_to_existing");
  assert.equal(result.matchedPointId, "p1");
  assert.ok(result.matchScore >= 0.85);
});

test("matchPoiCandidate sends unmatched POI to field verification", () => {
  const result = matchPoiCandidate(
    {
      source: "osm",
      sourceLicense: "ODbL-1.0",
      sourceAttribution: "OpenStreetMap contributors",
      externalId: "node/124",
      raw: {},
      normalized: { name: "New Pharmacy" },
      category: "pharmacy",
      location: { latitude: 4.09, longitude: 9.75 },
      name: "New Pharmacy",
      confidence: 0.8,
    },
    [existing],
  );

  assert.equal(result.matchStatus, "needs_field_verification");
  assert.equal(result.matchedPointId, null);
});
