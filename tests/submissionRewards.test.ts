import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSubmissionRewardBreakdown,
  computeCompletionSummary,
  prioritizeMissingFields,
} from "../shared/submissionRewards.ts";

test("create events keep the base XP only", () => {
  const result = calculateSubmissionRewardBreakdown({
    eventType: "CREATE_EVENT",
    previousGaps: ["openingHours", "isLicensed"],
    nextGaps: ["openingHours", "isLicensed"],
    previousScore: 0,
    nextScore: 52,
  });

  assert.equal(result.baseXp, 5);
  assert.equal(result.totalXp, 5);
  assert.equal(result.fieldBonus, 0);
  assert.equal(result.comboBonus, 0);
  assert.equal(result.verificationBonus, 0);
});

test("enrichment rewards filled gaps, combo completion, and score thresholds", () => {
  const result = calculateSubmissionRewardBreakdown({
    eventType: "ENRICH_EVENT",
    previousGaps: ["openingHours", "isLicensed", "medicineCategories"],
    nextGaps: [],
    previousScore: 65,
    nextScore: 88,
  });

  assert.equal(result.baseXp, 5);
  assert.equal(result.fieldBonus, 7);
  assert.equal(result.comboBonus, 5);
  assert.equal(result.verificationBonus, 10);
  assert.equal(result.thresholdBonus, 10);
  assert.deepEqual(result.thresholdsCrossed, [70, 85]);
  assert.equal(result.totalXp, 37);
});

test("completion summary and prioritized fields follow the vertical enrichable model", () => {
  const completion = computeCompletionSummary("pharmacy", {
    openingHours: "08:00 - 20:00",
    isOpenNow: true,
  });

  assert.equal(completion.total, 6);
  assert.equal(completion.filled, 2);
  assert.deepEqual(
    prioritizeMissingFields("pharmacy", completion.missing, 3),
    ["isLicensed", "medicineCategories", "isOnDuty"],
  );
});
