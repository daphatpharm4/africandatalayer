import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSpatialIntelligenceCells,
  buildSpatialIntelligenceNarrative,
  type SpatialDeltaPointRow,
  type SpatialSnapshotRow,
} from "../lib/server/spatialIntelligence.js";

test("buildSpatialIntelligenceCells ranks high-signal cells and surfaces caveats", () => {
  const snapshots: SpatialSnapshotRow[] = [
    {
      pointId: "pharmacy-s10tg6-a1111111",
      latitude: 4.0842,
      longitude: 9.7351,
      details: { confidenceScore: 84, lastSeenAt: "2026-04-10T10:00:00.000Z", brand: "A" },
      gaps: [],
      eventsCount: 3,
      photoUrl: "https://example.com/a.jpg",
    },
    {
      pointId: "pharmacy-s10tg6-b2222222",
      latitude: 4.08425,
      longitude: 9.73515,
      details: { confidenceScore: 78, lastSeenAt: "2026-04-11T08:00:00.000Z", operator: "B" },
      gaps: [],
      eventsCount: 2,
      photoUrl: "https://example.com/b.jpg",
    },
    {
      pointId: "pharmacy-s10tg6-c3333333",
      latitude: 4.0843,
      longitude: 9.7352,
      details: { confidenceScore: 72, lastSeenAt: "2026-04-09T08:00:00.000Z", providers: ["C"] },
      gaps: [],
      eventsCount: 2,
      photoUrl: "https://example.com/c.jpg",
    },
    {
      pointId: "pharmacy-s10tg7-d4444444",
      latitude: 4.086,
      longitude: 9.737,
      details: { confidenceScore: 34, lastSeenAt: "2026-03-20T08:00:00.000Z" },
      gaps: ["openingHours", "isOpenNow"],
      eventsCount: 1,
      photoUrl: null,
    },
    {
      pointId: "pharmacy-s10tg7-e5555555",
      latitude: 4.0861,
      longitude: 9.7371,
      details: { confidenceScore: 41, lastSeenAt: "2026-03-18T08:00:00.000Z" },
      gaps: ["openingHours"],
      eventsCount: 1,
      photoUrl: null,
    },
    {
      pointId: "pharmacy-s10tg8-f6666666",
      latitude: 4.09,
      longitude: 9.74,
      details: { confidenceScore: 63, lastSeenAt: "2026-04-08T08:00:00.000Z", brand: "Solo" },
      gaps: [],
      eventsCount: 2,
      photoUrl: "https://example.com/f.jpg",
    },
  ];

  const deltas: SpatialDeltaPointRow[] = [
    { pointId: "pharmacy-s10tg6-a1111111", hasPublishable: true, hasNew: false, hasRemoved: false, hasChanged: true },
    { pointId: "pharmacy-s10tg6-b2222222", hasPublishable: true, hasNew: true, hasRemoved: false, hasChanged: false },
    { pointId: "pharmacy-s10tg7-d4444444", hasPublishable: false, hasNew: false, hasRemoved: false, hasChanged: true },
    { pointId: "pharmacy-s10tg8-f6666666", hasPublishable: true, hasNew: false, hasRemoved: false, hasChanged: true },
  ];

  const cells = buildSpatialIntelligenceCells({
    snapshotDate: "2026-04-11",
    verticalId: "pharmacy",
    snapshots,
    deltas,
  }).sort((a, b) => a.cellId.localeCompare(b.cellId));

  assert.equal(cells.length, 3);

  const strongest = cells.find((cell) => cell.cellId === "s10tg6");
  assert.ok(strongest);
  assert.equal(strongest.totalPoints, 3);
  assert.equal(strongest.publishableChangeCount, 2);
  assert.ok(strongest.opportunityScore > 70);
  assert.ok(strongest.drivers.some((driver) => driver.label === "Above-average density"));
  assert.ok(strongest.summary.includes("Strongest signals"));

  const weakest = cells.find((cell) => cell.cellId === "s10tg7");
  assert.ok(weakest);
  assert.ok(weakest.coverageGapScore > strongest.coverageGapScore);
  assert.ok(weakest.caveats.some((caveat) => caveat.includes("Average confidence is low")));
  assert.ok(weakest.caveats.some((caveat) => caveat.includes("Photo coverage is limited")));
});

test("buildSpatialIntelligenceNarrative names top opportunity and evidence-gap cells", () => {
  const cells = [
    {
      cellId: "s10tg6",
      verticalId: "pharmacy",
      snapshotDate: "2026-04-11",
      center: { latitude: 4.0842, longitude: 9.7351 },
      totalPoints: 3,
      completedPoints: 3,
      completionRate: 1,
      avgConfidenceScore: 80,
      photoCoverageRate: 1,
      recentActivityRate: 1,
      medianFreshnessDays: 1,
      publishableChangeCount: 2,
      newCount: 1,
      removedCount: 0,
      changedCount: 1,
      operatorDiversity: 3,
      marketSignalScore: 90,
      opportunityScore: 88,
      coverageGapScore: 8,
      changeSignalScore: 85,
      drivers: [],
      caveats: [],
      summary: "top",
    },
    {
      cellId: "s10tg7",
      verticalId: "pharmacy",
      snapshotDate: "2026-04-11",
      center: { latitude: 4.086, longitude: 9.737 },
      totalPoints: 2,
      completedPoints: 0,
      completionRate: 0,
      avgConfidenceScore: 35,
      photoCoverageRate: 0,
      recentActivityRate: 0,
      medianFreshnessDays: 20,
      publishableChangeCount: 0,
      newCount: 0,
      removedCount: 0,
      changedCount: 1,
      operatorDiversity: 0,
      marketSignalScore: 20,
      opportunityScore: 18,
      coverageGapScore: 92,
      changeSignalScore: 15,
      drivers: [],
      caveats: [],
      summary: "gap",
    },
  ];

  const narrative = buildSpatialIntelligenceNarrative({
    verticalId: "pharmacy",
    snapshotDate: "2026-04-11",
    cells,
  });

  assert.ok(narrative.includes("s10tg6"));
  assert.ok(narrative.includes("s10tg7"));
  assert.ok(narrative.includes("2026-04-11"));
});
