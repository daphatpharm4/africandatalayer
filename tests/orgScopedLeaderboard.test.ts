// tests/orgScopedLeaderboard.test.ts
// Tenant-isolation tests for GET /api/leaderboard.
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
    requireUserFn: async () => ({ id: ALICE, token: {}, role: "agent" as const }),
    getMembershipFn: async (_organizationId: string, userId: string) => ({
      organizationId: "org-1", userId, role: "collector" as const, createdAt: "",
    }),
    getOrganizationAccessStateFn: async () => "active" as const,
    listOrganizationsForUserFn: async () => [],
    listOrganizationLeaderboardFn: async () => [{
      rank: 1,
      userId: "al***",
      name: "al***",
      xp: 10,
      contributions: 1,
      lastContributionAt: "2026-07-20T00:00:00.000Z",
      lastLocation: "Company records",
      averageQualityScore: 100,
      rankingScore: 100,
      verticalBreakdown: { pharmacy: 1 },
    }],
    ...overrides,
  };
}

test("ADL field agents without a company membership can use the global leaderboard", async () => {
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
  let scopedOrganizationId: string | null = null;
  let globalEventsLoaded = false;
  const handler = createLeaderboardHandler(baseDeps({
    buildContributionEventsFn: async () => {
      globalEventsLoaded = true;
      return EVENTS;
    },
    listOrganizationLeaderboardFn: async (organizationId: string) => {
      scopedOrganizationId = organizationId;
      return [{
        rank: 1, userId: "al***", name: "al***", xp: 10, contributions: 1,
        lastContributionAt: null, lastLocation: "Company records",
        averageQualityScore: 100, rankingScore: 100, verticalBreakdown: { pharmacy: 1 },
      }];
    },
  }));

  const response = await handler(new Request("https://x.test/api/leaderboard?organizationId=org-1"));
  assert.equal(response.status, 200);
  assert.equal(scopedOrganizationId, "org-1");
  assert.equal(globalEventsLoaded, false);

  const body = await response.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].contributions, 1);
});

test("org-scoped requests are private and never shared through the public cache", async () => {
  const handler = createLeaderboardHandler(baseDeps({
    listMembersFn: async (organizationId: string) => [{ organizationId, userId: ALICE, role: "collector" as const, createdAt: "" }],
  }));
  const response = await handler(new Request("https://x.test/api/leaderboard?organizationId=org-1"));
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("company members cannot omit organizationId and fall through to ADL-wide rankings", async () => {
  const handler = createLeaderboardHandler(baseDeps({
    listOrganizationsForUserFn: async () => [{ id: "org-1" }],
  }));
  const response = await handler(new Request("https://x.test/api/leaderboard"));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "organization_scope_required");
});

test("cross-company leaderboard access is denied before member data is loaded", async () => {
  let listed = false;
  const handler = createLeaderboardHandler(baseDeps({
    getMembershipFn: async () => null,
    listOrganizationLeaderboardFn: async () => {
      listed = true;
      return [];
    },
  }));
  const response = await handler(new Request("https://x.test/api/leaderboard?organizationId=other-org"));
  assert.equal(response.status, 403);
  assert.equal(listed, false);
});

test("an organizationId with no matching members returns an empty leaderboard, not the global one", async () => {
  const handler = createLeaderboardHandler(baseDeps({
    listOrganizationLeaderboardFn: async () => [],
  }));
  const response = await handler(new Request("https://x.test/api/leaderboard?organizationId=org-empty"));
  const body = await response.json();
  assert.deepEqual(body, []);
});
