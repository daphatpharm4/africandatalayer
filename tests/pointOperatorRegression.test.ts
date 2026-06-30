import assert from "node:assert/strict";
import test from "node:test";
import { routesForRole } from "../lib/client/pointOperatorUi.ts";
import { canPerformAction } from "../lib/server/submissionAccess.ts";
import { getEffectiveEventXp } from "../shared/xp.ts";
import { Screen } from "../types.ts";

test("existing roles retain their current navigation", () => {
  assert.deepEqual(routesForRole("agent"), [
    Screen.HOME,
    Screen.CONTRIBUTE,
    Screen.ANALYTICS,
    Screen.PROFILE,
  ]);
  assert.deepEqual(routesForRole("admin"), [
    Screen.ADMIN,
    Screen.HOME,
    Screen.DELTA_DASHBOARD,
    Screen.AGENT_PERFORMANCE,
    Screen.PROFILE,
  ]);
  assert.deepEqual(routesForRole("client"), [
    Screen.DELTA_DASHBOARD,
    Screen.INVESTOR_DASHBOARD,
    Screen.HOME,
    Screen.CLIENT_INSIGHTS,
    Screen.PROFILE,
  ]);
});

test("operator events never count as XP contributions", () => {
  assert.equal(
    getEffectiveEventXp({
      source: "point_operator",
      details: { xpAwarded: 50, reviewStatus: "approved" },
    }),
    0,
  );
});

test("unknown role has no permissions", () => {
  assert.equal(canPerformAction("unknown", "read"), false);
});
