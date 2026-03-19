import assert from "node:assert/strict";
import test from "node:test";
import { getCronDispatchSchedule } from "../api/analytics/index.js";

function utc(value: string): Date {
  return new Date(value);
}

test("getCronDispatchSchedule enables weekly snapshot on Monday at daily cron time", () => {
  const schedule = getCronDispatchSchedule(utc("2026-03-02T06:00:00.000Z"));
  assert.deepEqual(schedule, {
    weeklySnapshot: true,
    monthlyRollup: false,
    dailyRoadSnapshot: true,
    dailyTrustDecay: true,
    dailyGpsAnomaly: true,
  });
});

test("getCronDispatchSchedule enables monthly rollup on day 1 at daily cron time", () => {
  const schedule = getCronDispatchSchedule(utc("2026-04-01T06:00:00.000Z"));
  assert.deepEqual(schedule, {
    weeklySnapshot: false,
    monthlyRollup: true,
    dailyRoadSnapshot: true,
    dailyTrustDecay: true,
    dailyGpsAnomaly: true,
  });
});

test("getCronDispatchSchedule enables daily jobs anywhere in the 06:XX hour", () => {
  // Exact minute 0
  const atZero = getCronDispatchSchedule(utc("2026-03-17T06:00:00.000Z"));
  assert.deepEqual(atZero, {
    weeklySnapshot: false,
    monthlyRollup: false,
    dailyRoadSnapshot: true,
    dailyTrustDecay: true,
    dailyGpsAnomaly: true,
  });

  // Vercel cron jitter: a few minutes late
  const atThree = getCronDispatchSchedule(utc("2026-03-17T06:03:00.000Z"));
  assert.deepEqual(atThree, {
    weeklySnapshot: false,
    monthlyRollup: false,
    dailyRoadSnapshot: true,
    dailyTrustDecay: true,
    dailyGpsAnomaly: true,
  });
});

test("getCronDispatchSchedule handles non-matching hours", () => {
  const monthBoundary = getCronDispatchSchedule(utc("2026-04-01T05:00:00.000Z"));
  assert.deepEqual(monthBoundary, {
    weeklySnapshot: false,
    monthlyRollup: false,
    dailyRoadSnapshot: false,
    dailyTrustDecay: false,
    dailyGpsAnomaly: false,
  });

  const nonMatchingHour = getCronDispatchSchedule(utc("2026-03-02T05:00:00.000Z"));
  assert.deepEqual(nonMatchingHour, {
    weeklySnapshot: false,
    monthlyRollup: false,
    dailyRoadSnapshot: false,
    dailyTrustDecay: false,
    dailyGpsAnomaly: false,
  });
});

test("getCronDispatchSchedule does not trigger outside the 06:XX hour", () => {
  const schedule = getCronDispatchSchedule(utc("2026-03-17T07:00:00.000Z"));
  assert.deepEqual(schedule, {
    weeklySnapshot: false,
    monthlyRollup: false,
    dailyRoadSnapshot: false,
    dailyTrustDecay: false,
    dailyGpsAnomaly: false,
  });
});

test("getCronDispatchSchedule prioritizes the configured UTC hours on combined calendar edge", () => {
  const schedule = getCronDispatchSchedule(utc("2027-02-01T06:00:00.000Z"));
  assert.deepEqual(schedule, {
    weeklySnapshot: true,
    monthlyRollup: true,
    dailyRoadSnapshot: true,
    dailyTrustDecay: true,
    dailyGpsAnomaly: true,
  });
});
