// tests/reconcileMissionXp.test.ts
// Verifies lib/server/xp.ts's reconcileUserProfileXp adds the mission-reward
// XP ledger total (getMissionRewardXpTotalForUser, injected here as
// missionRewardXpFn) on top of submission-derived XP, as a DISTINCT source —
// not derived from getEffectiveEventXp — per the "mission_reward" xpAction
// design (docs/superpowers/specs/2026-07-24-ios-console-missions-gamification-design.md,
// Risk: "XP double-counted on mission completion + normal submission XP").
import assert from "node:assert/strict";
import test from "node:test";
import { reconcileUserProfileXp } from "../lib/server/xp.js";
import type { PointEvent, UserProfile } from "../shared/types.js";

const USER_ID = "collector-1";

function makeEvent(xp: number): PointEvent {
  return {
    id: `event-${xp}`,
    pointId: "point-1",
    eventType: "CREATE_EVENT",
    userId: USER_ID,
    category: "pharmacy",
    location: { latitude: 4.05, longitude: 9.7 },
    details: { xpAwarded: xp },
    createdAt: "2026-07-20T00:00:00.000Z",
  };
}

function makeProfile(xp: number): UserProfile {
  return {
    id: USER_ID,
    name: "Collector One",
    email: USER_ID,
    XP: xp,
    role: "agent",
  };
}

test("reconcileUserProfileXp sums submission XP + mission-reward XP without touching storage when already reconciled", async () => {
  const events = [makeEvent(20)]; // submission XP total = 20
  let missionRewardCalledWith: string | null = null;
  const missionRewardXpFn = async (userId: string) => {
    missionRewardCalledWith = userId;
    return 15; // mission-reward ledger total
  };

  // Profile.XP is PRE-SET to 20 + 15 = 35. If the implementation only summed
  // submission XP (ignoring the mission-reward ledger), nextXp would compute
  // to 20 !== 35 and the function would fall through to the real
  // upsertUserProfile (a live DB/edge-config write not available in this
  // test environment) — so a passing assertion here proves the mission
  // reward total IS included in the reconciled total.
  const profile = makeProfile(35);
  const result = await reconcileUserProfileXp(USER_ID, { events, profile, missionRewardXpFn });

  assert.equal(missionRewardCalledWith, USER_ID);
  assert.equal(result?.XP, 35);
  // No-op path returns the SAME profile reference — confirms no write occurred.
  assert.equal(result, profile);
});

test("reconcileUserProfileXp: calling it twice with the same events + mission reward total is idempotent (no re-summing / no double count)", async () => {
  const events = [makeEvent(20)];
  const missionRewardXpFn = async () => 15;
  const profile = makeProfile(35);

  const first = await reconcileUserProfileXp(USER_ID, { events, profile, missionRewardXpFn });
  const second = await reconcileUserProfileXp(USER_ID, { events, profile: first ?? profile, missionRewardXpFn });

  assert.equal(first?.XP, 35);
  assert.equal(second?.XP, 35);
});

test("reconcileUserProfileXp returns null when no profile exists (missionRewardXpFn is never consulted)", async () => {
  let called = false;
  const result = await reconcileUserProfileXp(USER_ID, {
    events: [],
    profile: null,
    missionRewardXpFn: async () => { called = true; return 0; },
  });
  assert.equal(result, null);
  assert.equal(called, false);
});
