// tests/platformMissionApi.test.ts
// API-view tests for mission_list / mission_create / mission_assign /
// mission_progress — same createPlatformHandler(deps) harness pattern as
// tests/platformBatchReview.test.ts.
import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformHandler } from "../lib/server/platform/api.js";

const OWNER = { id: "owner@acme.com", token: {}, role: "agent" as const };
const ORG_ID = "5a2f8f18-0000-4000-8000-000000000001";
const MISSION_ID = "5a2f8f18-0000-4000-8000-000000000099";
const FUTURE_DEADLINE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

function jsonPost(view: string, body: unknown): Request {
  return new Request(`https://x.test/api/user?view=platform_${view}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function jsonGet(view: string, params: Record<string, string>): Request {
  const url = new URL(`https://x.test/api/user`);
  url.searchParams.set("view", `platform_${view}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Request(url, { method: "GET" });
}

function baseDeps(role: "owner" | "manager" | "reviewer" | "collector" | "viewer", overrides: Record<string, unknown> = {}) {
  return {
    requireUserFn: async () => OWNER,
    getMembershipFn: async () => ({ organizationId: ORG_ID, userId: OWNER.id, role, createdAt: "" }),
    getOrganizationAccessStateFn: async () => "active" as const,
    writeAuditFn: async () => {},
    ...overrides,
  };
}

function fakeDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: MISSION_ID,
    organizationId: ORG_ID,
    period: "weekly" as const,
    titleEn: "Collect 10 pharmacies",
    titleFr: "Collecter 10 pharmacies",
    quota: 10,
    deadline: FUTURE_DEADLINE,
    rewardXp: 50,
    projectId: null,
    category: null,
    notesEn: null,
    notesFr: null,
    createdBy: OWNER.id,
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

// ─── mission_create ─────────────────────────────────────────────────────────

test("mission_create succeeds for a manager and always creates a weekly mission", async () => {
  const created: any[] = [];
  const handler = createPlatformHandler(baseDeps("manager", {
    createMissionDefinitionFn: async (input: any) => {
      created.push(input);
      return fakeDefinition({ ...input });
    },
  }));

  const response = await handler(jsonPost("mission_create", {
    organizationId: ORG_ID,
    titleEn: "Collect 10 pharmacies",
    titleFr: "Collecter 10 pharmacies",
    quota: 10,
    deadline: FUTURE_DEADLINE,
    rewardXp: 50,
  }));

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.mission.quota, 10);
  assert.equal(body.mission.state, "pending");
  assert.equal(body.mission.current, 0);
  assert.equal(created[0].period, "weekly");
  assert.equal(created[0].createdBy, OWNER.id);
});

test("mission_create returns 403 for a collector (non-manager)", async () => {
  const handler = createPlatformHandler(baseDeps("collector"));
  const response = await handler(jsonPost("mission_create", {
    organizationId: ORG_ID,
    titleEn: "Collect 10 pharmacies",
    titleFr: "",
    quota: 10,
    deadline: FUTURE_DEADLINE,
    rewardXp: 50,
  }));
  assert.equal(response.status, 403);
});

test("mission_create returns 403 for a reviewer (below manager)", async () => {
  const handler = createPlatformHandler(baseDeps("reviewer"));
  const response = await handler(jsonPost("mission_create", {
    organizationId: ORG_ID,
    titleEn: "Collect 10 pharmacies",
    titleFr: "",
    quota: 10,
    deadline: FUTURE_DEADLINE,
    rewardXp: 50,
  }));
  assert.equal(response.status, 403);
});

test("mission_create rejects quota below 1 or above 100", async () => {
  const handler = createPlatformHandler(baseDeps("manager"));
  const tooLow = await handler(jsonPost("mission_create", {
    organizationId: ORG_ID, titleEn: "X", titleFr: "", quota: 0, deadline: FUTURE_DEADLINE, rewardXp: 10,
  }));
  assert.equal(tooLow.status, 400);

  const tooHigh = await handler(jsonPost("mission_create", {
    organizationId: ORG_ID, titleEn: "X", titleFr: "", quota: 101, deadline: FUTURE_DEADLINE, rewardXp: 10,
  }));
  assert.equal(tooHigh.status, 400);
});

test("mission_create rejects a deadline that is not in the future", async () => {
  const handler = createPlatformHandler(baseDeps("manager"));
  const response = await handler(jsonPost("mission_create", {
    organizationId: ORG_ID,
    titleEn: "X",
    titleFr: "",
    quota: 10,
    deadline: new Date(Date.now() - 60_000).toISOString(),
    rewardXp: 10,
  }));
  assert.equal(response.status, 400);
});

test("mission_create rejects a title empty in both languages", async () => {
  const handler = createPlatformHandler(baseDeps("manager"));
  const response = await handler(jsonPost("mission_create", {
    organizationId: ORG_ID,
    titleEn: "",
    titleFr: "",
    quota: 10,
    deadline: FUTURE_DEADLINE,
    rewardXp: 10,
  }));
  assert.equal(response.status, 400);
});

test("mission_create accepts a title present in only one language", async () => {
  const handler = createPlatformHandler(baseDeps("manager", {
    createMissionDefinitionFn: async (input: any) => fakeDefinition({ ...input }),
  }));
  const response = await handler(jsonPost("mission_create", {
    organizationId: ORG_ID,
    titleEn: "",
    titleFr: "Collecter 10 pharmacies",
    quota: 10,
    deadline: FUTURE_DEADLINE,
    rewardXp: 10,
  }));
  assert.equal(response.status, 201);
});

// ─── mission_assign ─────────────────────────────────────────────────────────

test("mission_assign succeeds when every target id is a current collector, and dedupes", async () => {
  const assignCalls: any[] = [];
  const handler = createPlatformHandler(baseDeps("manager", {
    getMissionDefinitionFn: async () => fakeDefinition(),
    listMembersFn: async () => ([
      { organizationId: ORG_ID, userId: "collector-1", role: "collector", createdAt: "" },
      { organizationId: ORG_ID, userId: "collector-2", role: "collector", createdAt: "" },
      { organizationId: ORG_ID, userId: OWNER.id, role: "manager", createdAt: "" },
    ]),
    assignMissionToUsersFn: async (input: any) => { assignCalls.push(input); },
  }));

  const response = await handler(jsonPost("mission_assign", {
    missionId: MISSION_ID,
    targetUserIds: ["collector-1", "collector-2", "collector-1"],
  }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual([...body.targetUserIds].sort(), ["collector-1", "collector-2"]);
  assert.equal(assignCalls.length, 1);
  assert.deepEqual([...assignCalls[0].userIds].sort(), ["collector-1", "collector-2"]);
});

test("mission_assign rejects a target id that is not a current org collector", async () => {
  const handler = createPlatformHandler(baseDeps("manager", {
    getMissionDefinitionFn: async () => fakeDefinition(),
    listMembersFn: async () => ([
      { organizationId: ORG_ID, userId: "collector-1", role: "collector", createdAt: "" },
      { organizationId: ORG_ID, userId: "viewer-1", role: "viewer", createdAt: "" },
    ]),
  }));

  const response = await handler(jsonPost("mission_assign", {
    missionId: MISSION_ID,
    targetUserIds: ["collector-1", "viewer-1", "ghost-user"],
  }));

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.deepEqual([...body.invalidUserIds].sort(), ["ghost-user", "viewer-1"]);
});

test("mission_assign returns 403 for a non-manager", async () => {
  const handler = createPlatformHandler(baseDeps("collector", {
    getMissionDefinitionFn: async () => fakeDefinition(),
  }));
  const response = await handler(jsonPost("mission_assign", {
    missionId: MISSION_ID,
    targetUserIds: ["collector-1"],
  }));
  assert.equal(response.status, 403);
});

test("mission_assign returns 404 when the mission does not exist", async () => {
  const handler = createPlatformHandler(baseDeps("manager", {
    getMissionDefinitionFn: async () => null,
  }));
  const response = await handler(jsonPost("mission_assign", {
    missionId: MISSION_ID,
    targetUserIds: ["collector-1"],
  }));
  assert.equal(response.status, 404);
});

test("mission_assign rejects an empty targetUserIds array", async () => {
  const handler = createPlatformHandler(baseDeps("manager"));
  const response = await handler(jsonPost("mission_assign", {
    missionId: MISSION_ID,
    targetUserIds: [],
  }));
  assert.equal(response.status, 400);
});

// ─── mission_list ───────────────────────────────────────────────────────────

test("mission_list returns the org-wide rollup for a manager", async () => {
  const handler = createPlatformHandler(baseDeps("manager", {
    listMissionsForManagerFn: async () => [{ id: MISSION_ID, organizationId: ORG_ID } as any],
  }));
  const response = await handler(jsonGet("mission_list", { organizationId: ORG_ID }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.missions.length, 1);
});

test("mission_list returns only the caller's assigned missions for a collector", async () => {
  let calledWith: any = null;
  const handler = createPlatformHandler(baseDeps("collector", {
    listMissionsForCollectorFn: async (input: any) => { calledWith = input; return []; },
  }));
  const response = await handler(jsonGet("mission_list", { organizationId: ORG_ID }));
  assert.equal(response.status, 200);
  assert.equal(calledWith.userId, OWNER.id);
  assert.equal(calledWith.organizationId, ORG_ID);
});

test("mission_list is visible to a viewer (lowest role)", async () => {
  const handler = createPlatformHandler(baseDeps("viewer", {
    listMissionsForCollectorFn: async () => [],
  }));
  const response = await handler(jsonGet("mission_list", { organizationId: ORG_ID }));
  assert.equal(response.status, 200);
});

// ─── mission_progress ───────────────────────────────────────────────────────

test("mission_progress returns per-user progress plus an org rollup mission summary", async () => {
  const handler = createPlatformHandler(baseDeps("manager", {
    getMissionDefinitionFn: async () => fakeDefinition({ quota: 10 }),
    listMissionProgressFn: async () => ([
      { userId: "collector-1", current: 10, state: "completed" as const },
      { userId: "collector-2", current: 4, state: "in_progress" as const },
    ]),
  }));
  const response = await handler(jsonGet("mission_progress", { organizationId: ORG_ID, missionId: MISSION_ID }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.progress.length, 2);
  assert.equal(body.mission.current, 14);
  assert.deepEqual(body.mission.assignedUserIds, ["collector-1", "collector-2"]);
});

test("mission_progress returns 403 for a non-manager", async () => {
  const handler = createPlatformHandler(baseDeps("collector"));
  const response = await handler(jsonGet("mission_progress", { organizationId: ORG_ID, missionId: MISSION_ID }));
  assert.equal(response.status, 403);
});

test("mission_progress returns 404 when the mission belongs to a different org", async () => {
  const handler = createPlatformHandler(baseDeps("manager", {
    getMissionDefinitionFn: async () => fakeDefinition({ organizationId: "some-other-org" }),
  }));
  const response = await handler(jsonGet("mission_progress", { organizationId: ORG_ID, missionId: MISSION_ID }));
  assert.equal(response.status, 404);
});
