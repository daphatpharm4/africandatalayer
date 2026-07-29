// tests/orgScopedLeaderboard.test.ts
// Tests for the org-scoped GET /api/leaderboard?organizationId= extension —
// omitting the param preserves the existing global (cross-org) leaderboard;
// providing it filters to members of that organization. Uses
// createLeaderboardHandler(deps) (mirrors createPlatformHandler(deps)) so no
// real database is touched.
import assert from "node:assert/strict";
import test from "node:test";
import { createLeaderboardHandler } from "../api/leaderboard/index.js";
import type { PointEvent } from "../shared/types.js";

const LEADERBOARD_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=300";

function makeEvent(userId: string, xp: number): PointEvent {
  return {
    id: `event-${userId}-${xp}`,
    pointId: `point-${userId}`,
    eventType: "CREATE_EVENT",
    userId,
    category: "pharmacy",
    location: { latitude: 4.05, longitude: 9.7 },
    details: { xpAwarded: xp },
    createdAt: "2026-07-20T00:00:00.000Z",
  };
}

const ALICE = "alice@acme.com";
const BOB = "bob@other.com";
const EVENTS = [makeEvent(ALICE, 40), makeEvent(BOB, 90)];

function baseDeps(overrides: Record<string, unknown> = {}) {
  return {
    buildContributionEventsFn: async () => EVENTS,
    getUserProfilesBatchFn: async () => new Map(),
    ...overrides,
  };
}

test("omitting organizationId returns the existing global leaderboard (all users)", async () => {
  const handler = createLeaderboardHandler(baseDeps());
  const response = await handler(new Request("https://x.test/api/leaderboard"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), LEADERBOARD_CACHE_CONTROL);

  const body = await response.json();
  const userIds = body.map((entry: any) => entry.userId);
  // Public entries are redacted, but count + relative order (higher xp first) still verify both are present.
  assert.equal(body.length, 2);
  assert.equal(body[0].xp, 90);
  assert.equal(body[1].xp, 40);
  assert.ok(userIds.every((id: string) => typeof id === "string"));
});

test("organizationId filters the leaderboard to members of that organization only", async () => {
  let listMembersCalledWith: string | null = null;
  const handler = createLeaderboardHandler(baseDeps({
    listMembersFn: async (organizationId: string) => {
      listMembersCalledWith = organizationId;
      return [{ organizationId, userId: ALICE, role: "collector" as const, createdAt: "" }];
    },
  }));

  const response = await handler(new Request("https://x.test/api/leaderboard?organizationId=org-1"));
  assert.equal(response.status, 200);
  assert.equal(listMembersCalledWith, "org-1");

  const body = await response.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].xp, 40); // alice's total, bob (not a member) excluded
});

test("org-scoped requests keep the same cache-control header as the global leaderboard", async () => {
  const handler = createLeaderboardHandler(baseDeps({
    listMembersFn: async (organizationId: string) => [{ organizationId, userId: ALICE, role: "collector" as const, createdAt: "" }],
  }));
  const response = await handler(new Request("https://x.test/api/leaderboard?organizationId=org-1"));
  assert.equal(response.headers.get("cache-control"), LEADERBOARD_CACHE_CONTROL);
});

test("an organizationId with no matching members returns an empty leaderboard, not the global one", async () => {
  const handler = createLeaderboardHandler(baseDeps({
    listMembersFn: async () => [],
  }));
  const response = await handler(new Request("https://x.test/api/leaderboard?organizationId=org-empty"));
  const body = await response.json();
  assert.deepEqual(body, []);
});
