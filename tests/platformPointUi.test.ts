import assert from "node:assert/strict";
import test from "node:test";
import { formatDistanceMeters, pointStaleness, stalenessLabel } from "../lib/client/platformPointUi.js";

const NOW = new Date("2026-07-18T12:00:00.000Z");

test("formatDistanceMeters renders meters below 1km and km above", () => {
  assert.equal(formatDistanceMeters(120, "en"), "120 m");
  assert.equal(formatDistanceMeters(1400, "en"), "1.4 km");
});

test("pointStaleness flags points older than 30 days", () => {
  assert.deepEqual(pointStaleness("2026-07-17T12:00:00.000Z", NOW), { days: 1, stale: false });
  assert.equal(pointStaleness("2026-06-01T12:00:00.000Z", NOW).stale, true);
});

test("stalenessLabel is bilingual and handles today", () => {
  assert.equal(stalenessLabel("2026-07-18T09:00:00.000Z", NOW, "en"), "updated today");
  assert.equal(stalenessLabel("2026-06-03T12:00:00.000Z", NOW, "fr"), "mis à jour il y a 45 jours");
});
