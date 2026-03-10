import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAverageQualityForToday,
  computeContributionSummary,
  formatContributionHistoryDate,
  mapQueuedItemsToContributionActivities,
} from "../lib/shared/contributionMetrics.ts";

process.env.TZ = "Africa/Nairobi";

const REFERENCE_DATE = "2026-03-11T09:00:00+03:00";

test("daily summary separates create and enrich events and aligns the streak grid to Monday-Sunday", () => {
  const summary = computeContributionSummary(
    [
      { createdAt: "2026-03-11T05:30:00.000Z", eventType: "CREATE_EVENT" },
      { createdAt: "2026-03-11T06:15:00.000Z", eventType: "ENRICH_EVENT" },
      { createdAt: "2026-03-10T08:00:00.000Z", eventType: "CREATE_EVENT" },
      { createdAt: "2026-03-09T11:45:00.000Z", eventType: "ENRICH_EVENT" },
    ],
    { referenceDate: REFERENCE_DATE },
  );

  assert.equal(summary.submissionsToday, 1);
  assert.equal(summary.enrichmentsToday, 1);
  assert.equal(summary.streakDays, 3);
  assert.deepEqual(summary.activeWeekdays, [true, true, true, false, false, false, false]);
});

test("average quality only uses synced activities that already have a real confidence score", () => {
  const average = computeAverageQualityForToday(
    [
      { createdAt: "2026-03-11T05:30:00.000Z", eventType: "CREATE_EVENT", details: { confidenceScore: 60 } },
      { createdAt: "2026-03-11T06:15:00.000Z", eventType: "ENRICH_EVENT", details: { confidenceScore: 80 } },
      { createdAt: "2026-03-11T06:45:00.000Z", eventType: "CREATE_EVENT", details: {} },
    ],
    { referenceDate: REFERENCE_DATE },
  );

  assert.equal(average, 70);
});

test("queued contributions update the daily summary immediately and remain stable after sync reconciliation", () => {
  const serverActivities = [
    { createdAt: "2026-03-10T08:00:00.000Z", eventType: "CREATE_EVENT" as const },
    { createdAt: "2026-03-11T05:30:00.000Z", eventType: "CREATE_EVENT" as const },
  ];
  const queuedItems = [
    {
      createdAt: "2026-03-11T06:15:00.000Z",
      status: "pending",
      payload: { eventType: "ENRICH_EVENT" as const, details: {} },
    },
    {
      createdAt: "2026-03-11T06:45:00.000Z",
      status: "synced",
      payload: { eventType: "CREATE_EVENT" as const, details: {} },
    },
  ];

  const optimisticSummary = computeContributionSummary(
    [...serverActivities, ...mapQueuedItemsToContributionActivities(queuedItems)],
    { referenceDate: REFERENCE_DATE },
  );
  const reconciledSummary = computeContributionSummary(
    [...serverActivities, { createdAt: "2026-03-11T06:15:00.000Z", eventType: "ENRICH_EVENT" as const }],
    { referenceDate: REFERENCE_DATE },
  );

  assert.equal(optimisticSummary.submissionsToday, 1);
  assert.equal(optimisticSummary.enrichmentsToday, 1);
  assert.deepEqual(optimisticSummary, reconciledSummary);
});

test("history formatting preserves distinct local times for same-day contributions", () => {
  const first = formatContributionHistoryDate("2026-03-11T05:15:00.000Z", "en", { referenceDate: REFERENCE_DATE });
  const second = formatContributionHistoryDate("2026-03-11T07:45:00.000Z", "en", { referenceDate: REFERENCE_DATE });

  assert.match(first, /^Today • /);
  assert.match(second, /^Today • /);
  assert.match(first, /08:15/);
  assert.match(second, /10:45/);
  assert.notEqual(first, second);
});
