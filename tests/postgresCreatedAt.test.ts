import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCreatedAt } from "../lib/server/storage/createdAt.ts";

test("normalizeCreatedAt preserves ISO strings", () => {
  assert.equal(normalizeCreatedAt("2026-03-10T09:45:12.000Z"), "2026-03-10T09:45:12.000Z");
});

test("normalizeCreatedAt preserves Date instances from pg timestamptz parsing", () => {
  const createdAt = new Date("2026-03-10T09:45:12.000Z");
  assert.equal(normalizeCreatedAt(createdAt), "2026-03-10T09:45:12.000Z");
});

test("normalizeCreatedAt falls back to a current ISO timestamp for invalid values", () => {
  const before = Date.now();
  const normalized = normalizeCreatedAt("not-a-date");
  const after = Date.now();
  const parsed = new Date(normalized).getTime();

  assert.equal(Number.isNaN(parsed), false);
  assert.ok(parsed >= before && parsed <= after);
});

test("normalizeCreatedAt falls back to a current ISO timestamp for missing values", () => {
  const before = Date.now();
  const normalized = normalizeCreatedAt(undefined);
  const after = Date.now();
  const parsed = new Date(normalized).getTime();

  assert.equal(Number.isNaN(parsed), false);
  assert.ok(parsed >= before && parsed <= after);
});
