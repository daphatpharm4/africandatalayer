import assert from "node:assert/strict";
import test from "node:test";
import {
  getPointOperatorControls,
  resolvePointOperatorExpiry,
} from "../lib/server/pointOperatorConfig.js";

test("every vertical exposes between one and three operator controls", () => {
  for (const vertical of [
    "pharmacy",
    "mobile_money",
    "fuel_station",
    "alcohol_outlet",
    "billboard",
    "transport_road",
    "census_proxy",
  ] as const) {
    const controls = getPointOperatorControls(vertical);
    assert.ok(controls.length >= 1);
    assert.ok(controls.length <= 3);
    assert.equal(new Set(controls.map((control) => control.field)).size, controls.length);
  }
});

test("pharmacy open-now expires six hours after report time", () => {
  const expiry = resolvePointOperatorExpiry(
    "pharmacy",
    "isOpenNow",
    new Date("2026-06-24T08:00:00.000Z"),
  );
  assert.equal(expiry.toISOString(), "2026-06-24T14:00:00.000Z");
});

test("unsupported controls fail closed", () => {
  assert.throws(
    () => resolvePointOperatorExpiry("pharmacy", "hasFuelAvailable", new Date()),
    /not allowed/,
  );
});
