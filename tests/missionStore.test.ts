// tests/missionStore.test.ts
// Store-level tests for lib/server/platform/missionStore.ts — pure lifecycle
// logic, daily-upsert idempotency, and the mission-reward XP award-once
// guarantee. Same fakeQuery(rowsPerCall) harness as tests/platformOrgStore.test.ts.
import assert from "node:assert/strict";
import test from "node:test";
import {
  missionProgressFraction,
  computeMissionAssignmentState,
  missionPeriodStart,
  upsertDailyMissionDefinition,
  updateAssignmentProgress,
  getMissionRewardXpTotalForUser,
} from "../lib/server/platform/missionStore.js";

function fakeQuery(rowsPerCall: Array<{ rows: any[] }>) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  let index = 0;
  const queryFn = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    const result = rowsPerCall[Math.min(index, rowsPerCall.length - 1)] ?? { rows: [] };
    index += 1;
    return { rows: result.rows, rowCount: result.rows.length };
  };
  return { queryFn, calls };
}

// ─── missionProgressFraction ────────────────────────────────────────────────

test("missionProgressFraction: 0%, 50%, 100%, and over-quota capped at 100%", () => {
  assert.equal(missionProgressFraction(0, 10), 0);
  assert.equal(missionProgressFraction(5, 10), 0.5);
  assert.equal(missionProgressFraction(10, 10), 1);
  assert.equal(missionProgressFraction(15, 10), 1);
});

test("missionProgressFraction: a non-positive quota never progresses", () => {
  assert.equal(missionProgressFraction(5, 0), 0);
  assert.equal(missionProgressFraction(5, -1), 0);
});

// ─── computeMissionAssignmentState (lifecycle transitions) ─────────────────

test("computeMissionAssignmentState: pending before any progress and before the deadline", () => {
  const state = computeMissionAssignmentState({
    current: 0, quota: 10, deadline: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(state, "pending");
});

test("computeMissionAssignmentState: in_progress with partial progress before the deadline", () => {
  const state = computeMissionAssignmentState({
    current: 3, quota: 10, deadline: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(state, "in_progress");
});

test("computeMissionAssignmentState: completed once quota is reached", () => {
  const state = computeMissionAssignmentState({
    current: 10, quota: 10, deadline: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(state, "completed");
});

test("computeMissionAssignmentState: completed wins even past the deadline", () => {
  const state = computeMissionAssignmentState({
    current: 10, quota: 10, deadline: new Date(Date.now() - 60_000).toISOString(),
  });
  assert.equal(state, "completed");
});

test("computeMissionAssignmentState: expired when the deadline passed without reaching quota", () => {
  const state = computeMissionAssignmentState({
    current: 3, quota: 10, deadline: new Date(Date.now() - 60_000).toISOString(),
  });
  assert.equal(state, "expired");
});

test("computeMissionAssignmentState: a null deadline (daily mission) never expires", () => {
  const state = computeMissionAssignmentState({ current: 3, quota: 10, deadline: null });
  assert.equal(state, "in_progress");
});

// ─── missionPeriodStart ─────────────────────────────────────────────────────

test("missionPeriodStart: daily period starts at today's UTC midnight", () => {
  const now = new Date("2026-07-24T15:32:00.000Z");
  assert.equal(missionPeriodStart("daily", now).toISOString(), "2026-07-24T00:00:00.000Z");
});

test("missionPeriodStart: weekly period starts at this week's Monday UTC midnight", () => {
  // 2026-07-24 is a Friday; the preceding Monday is 2026-07-20.
  const now = new Date("2026-07-24T15:32:00.000Z");
  assert.equal(missionPeriodStart("weekly", now).toISOString(), "2026-07-20T00:00:00.000Z");
});

// ─── Daily upsert idempotency ───────────────────────────────────────────────

const DEFINITION_ROW = {
  id: "mission-1", organization_id: "org-1", period: "daily",
  title_en: "Daily submissions", title_fr: "Soumissions quotidiennes",
  quota: 5, deadline: null, reward_xp: 10, project_id: null, category: null,
  notes_en: null, notes_fr: null, created_by: null,
  created_at: "2026-07-24T00:00:00.000Z", updated_at: "2026-07-24T00:00:00.000Z",
};

test("upsertDailyMissionDefinition: first call for the org+day inserts and returns created:true", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [DEFINITION_ROW] }]);
  const result = await upsertDailyMissionDefinition(
    { organizationId: "org-1", quota: 5, rewardXp: 10, titleEn: "Daily submissions", titleFr: "Soumissions quotidiennes" },
    { queryFn },
  );
  assert.equal(result.created, true);
  assert.equal(result.mission.id, "mission-1");
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /on conflict/i);
});

test("upsertDailyMissionDefinition: a re-run for the same org+day is a no-op that returns the EXISTING row (no duplicate)", async () => {
  // First query (INSERT ... ON CONFLICT DO NOTHING) returns no row -> conflict
  // hit; second query (SELECT existing) returns the already-created row.
  const { queryFn, calls } = fakeQuery([{ rows: [] }, { rows: [DEFINITION_ROW] }]);
  const result = await upsertDailyMissionDefinition(
    { organizationId: "org-1", quota: 5, rewardXp: 10, titleEn: "Daily submissions", titleFr: "Soumissions quotidiennes" },
    { queryFn },
  );
  assert.equal(result.created, false);
  assert.equal(result.mission.id, "mission-1");
  assert.equal(calls.length, 2);
  assert.match(calls[1].text, /select/i);
});

// ─── XP award-once ──────────────────────────────────────────────────────────

const ASSIGNMENT_ROW_NOT_STARTED = {
  id: "assign-1", mission_id: "mission-1", user_id: "collector-1",
  state: "in_progress", current: 4, completed_at: null, xp_awarded: false,
  created_at: "2026-07-24T00:00:00.000Z", updated_at: "2026-07-24T00:00:00.000Z",
};

test("updateAssignmentProgress: justCompleted is true and xp_awarded flips true on the FIRST completion only", async () => {
  const completedRow = { ...ASSIGNMENT_ROW_NOT_STARTED, current: 5, state: "completed", xp_awarded: true, completed_at: "2026-07-24T01:00:00.000Z" };

  const { queryFn: firstCallQuery } = fakeQuery([
    { rows: [ASSIGNMENT_ROW_NOT_STARTED] }, // getAssignment: existing, not yet completed
    { rows: [completedRow] },               // UPDATE ... RETURNING
  ]);
  const first = await updateAssignmentProgress(
    { missionId: "mission-1", userId: "collector-1", current: 5, quota: 5, deadline: null },
    { queryFn: firstCallQuery },
  );
  assert.equal(first.justCompleted, true);
  assert.equal(first.assignment.xpAwarded, true);
  assert.equal(first.assignment.state, "completed");

  // A later recompute (e.g. current pushed further past quota by more
  // submissions) must NOT re-award — the ledger flag is sticky.
  const { queryFn: secondCallQuery } = fakeQuery([
    { rows: [completedRow] },                          // getAssignment: already completed + xp_awarded
    { rows: [{ ...completedRow, current: 7 }] },        // UPDATE ... RETURNING
  ]);
  const second = await updateAssignmentProgress(
    { missionId: "mission-1", userId: "collector-1", current: 7, quota: 5, deadline: null },
    { queryFn: secondCallQuery },
  );
  assert.equal(second.justCompleted, false);
  assert.equal(second.assignment.xpAwarded, true);
});

test("updateAssignmentProgress: throws when the assignment does not exist", async () => {
  const { queryFn } = fakeQuery([{ rows: [] }]);
  await assert.rejects(
    () => updateAssignmentProgress({ missionId: "mission-1", userId: "ghost", current: 1, quota: 5, deadline: null }, { queryFn }),
    /not found/i,
  );
});

test("getMissionRewardXpTotalForUser sums reward_xp only across xp_awarded rows", async () => {
  const { queryFn, calls } = fakeQuery([{ rows: [{ total: 60 }] }]);
  const total = await getMissionRewardXpTotalForUser("collector-1", { queryFn });
  assert.equal(total, 60);
  assert.match(calls[0].text, /xp_awarded = true/i);
});
