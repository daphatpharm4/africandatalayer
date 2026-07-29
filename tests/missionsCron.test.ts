// tests/missionsCron.test.ts
// Tests for lib/server/platform/missionsCron.ts's daily auto-generation run —
// one upsert + collector-only assignment + progress refresh per active org,
// and that one org's failure never aborts the rest of the run.
import assert from "node:assert/strict";
import test from "node:test";
import { runDailyMissionGenerationCron } from "../lib/server/platform/missionsCron.js";

const NOW = new Date("2026-07-24T06:10:00.000Z");

function fakeDefinition(organizationId: string) {
  return {
    id: `mission-${organizationId}`,
    organizationId,
    period: "daily" as const,
    titleEn: "Daily submissions",
    titleFr: "Soumissions quotidiennes",
    quota: 5,
    deadline: null,
    rewardXp: 10,
    projectId: null,
    category: null,
    notesEn: null,
    notesFr: null,
    createdBy: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

test("runDailyMissionGenerationCron upserts one daily mission per active org and assigns only collectors", async () => {
  const upsertCalls: any[] = [];
  const assignCalls: any[] = [];
  const refreshCalls: any[] = [];

  const summary = await runDailyMissionGenerationCron({
    listActiveOrganizationIdsFn: async () => ["org-1"],
    listMembersFn: async (organizationId: string) => [
      { organizationId, userId: "collector-1", role: "collector", createdAt: "" },
      { organizationId, userId: "collector-2", role: "collector", createdAt: "" },
      { organizationId, userId: "manager-1", role: "manager", createdAt: "" },
      { organizationId, userId: "viewer-1", role: "viewer", createdAt: "" },
    ],
    upsertDailyMissionDefinitionFn: async (input: any) => {
      upsertCalls.push(input);
      return { mission: fakeDefinition(input.organizationId), created: true };
    },
    assignMissionToUsersFn: async (input: any) => { assignCalls.push(input); },
    refreshAssignmentProgressFn: async (input: any) => {
      refreshCalls.push(input);
      return { assignment: { id: "a", missionId: input.mission.id, userId: input.userId, state: "pending", current: 0, completedAt: null, xpAwarded: false, createdAt: "", updatedAt: "" }, justCompleted: false };
    },
  }, NOW);

  assert.equal(summary.hasFailures, false);
  assert.equal(summary.organizations.length, 1);
  assert.equal(summary.organizations[0].collectorsAssigned, 2);

  assert.equal(upsertCalls.length, 1);
  assert.equal(upsertCalls[0].organizationId, "org-1");

  assert.equal(assignCalls.length, 1);
  assert.deepEqual([...assignCalls[0].userIds].sort(), ["collector-1", "collector-2"]);

  assert.equal(refreshCalls.length, 2);
  assert.deepEqual(refreshCalls.map((c) => c.userId).sort(), ["collector-1", "collector-2"]);
});

test("runDailyMissionGenerationCron: one org failing does not abort the rest of the run", async () => {
  const summary = await runDailyMissionGenerationCron({
    listActiveOrganizationIdsFn: async () => ["org-broken", "org-ok"],
    listMembersFn: async (organizationId: string) => [
      { organizationId, userId: "collector-1", role: "collector", createdAt: "" },
    ],
    upsertDailyMissionDefinitionFn: async (input: any) => {
      if (input.organizationId === "org-broken") throw new Error("simulated db failure");
      return { mission: fakeDefinition(input.organizationId), created: true };
    },
    assignMissionToUsersFn: async () => {},
    refreshAssignmentProgressFn: async (input: any) => ({
      assignment: { id: "a", missionId: input.mission.id, userId: input.userId, state: "pending", current: 0, completedAt: null, xpAwarded: false, createdAt: "", updatedAt: "" },
      justCompleted: false,
    }),
  }, NOW);

  assert.equal(summary.hasFailures, true);
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].organizationId, "org-broken");
  assert.equal(summary.organizations.length, 1);
  assert.equal(summary.organizations[0].organizationId, "org-ok");
});

test("runDailyMissionGenerationCron: re-running the same day is idempotent (created:false surfaces from the store's upsert)", async () => {
  const summary = await runDailyMissionGenerationCron({
    listActiveOrganizationIdsFn: async () => ["org-1"],
    listMembersFn: async () => [],
    upsertDailyMissionDefinitionFn: async (input: any) => ({ mission: fakeDefinition(input.organizationId), created: false }),
    assignMissionToUsersFn: async () => {},
    refreshAssignmentProgressFn: async () => { throw new Error("should not be called with no collectors"); },
  }, NOW);

  assert.equal(summary.organizations[0].created, false);
  assert.equal(summary.organizations[0].missionId, "mission-org-1");
});
