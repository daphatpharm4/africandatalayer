import assert from "node:assert/strict";
import test from "node:test";
import { Screen } from "../types.ts";
import {
  defaultScreenForRole,
  resolveOperatorSignalLabel,
  routesForRole,
} from "../lib/client/pointOperatorUi.ts";

test("point operator routes are limited to status and profile", () => {
  assert.deepEqual(routesForRole("point_operator"), [
    Screen.POINT_OPERATOR_STATUS,
    Screen.POINT_OPERATOR_PROFILE,
  ]);
  assert.equal(defaultScreenForRole("point_operator"), Screen.POINT_OPERATOR_STATUS);
});

test("existing role routes stay unchanged", () => {
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
  assert.deepEqual(routesForRole("agent"), [
    Screen.HOME,
    Screen.CONTRIBUTE,
    Screen.ANALYTICS,
    Screen.PROFILE,
  ]);
  assert.equal(defaultScreenForRole("admin"), Screen.ADMIN);
  assert.equal(defaultScreenForRole("client"), Screen.DELTA_DASHBOARD);
  assert.equal(defaultScreenForRole("agent"), Screen.HOME);
});

test("operator signal labels treat null and expired values as unknown", () => {
  assert.equal(resolveOperatorSignalLabel(null), "unknown");
  assert.equal(resolveOperatorSignalLabel({ value: null, isExpired: false }), "unknown");
  assert.equal(resolveOperatorSignalLabel({ value: true, isExpired: true }), "unknown");
  assert.equal(resolveOperatorSignalLabel({ value: true, isExpired: false }), "on");
  assert.equal(resolveOperatorSignalLabel({ value: false, isExpired: false }), "off");
});
