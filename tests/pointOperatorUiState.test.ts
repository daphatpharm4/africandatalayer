import assert from "node:assert/strict";
import test from "node:test";
import { Screen } from "../types.ts";
import {
  defaultScreenForRole,
  resolveOperatorSignalLabel,
  routesForRole,
  summarizePointOperatorQueue,
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

test("operator queue summary separates photo uploads from status updates", () => {
  const summary = summarizePointOperatorQueue([
    {
      id: "photo-1",
      idempotencyKey: "idem-photo",
      mutation: { kind: "photo", imageData: "data:image/jpeg;base64,abc", capturedAt: "2026-06-30T12:00:00.000Z" },
      status: "pending",
      retryCount: 0,
      createdAt: "2026-06-30T12:00:00.000Z",
    },
    {
      id: "signal-1",
      idempotencyKey: "idem-signal",
      mutation: { kind: "signal", field: "isOpenNow", value: true, capturedAt: "2026-06-30T12:01:00.000Z" },
      status: "failed",
      retryCount: 1,
      lastError: "Network unavailable",
      createdAt: "2026-06-30T12:01:00.000Z",
    },
  ]);

  assert.deepEqual(summary, {
    total: 2,
    photos: 1,
    signals: 1,
    pending: 1,
    syncing: 0,
    failed: 1,
    lastError: "Network unavailable",
  });
});
