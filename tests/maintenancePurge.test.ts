import assert from "node:assert/strict";
import test from "node:test";
import { resolveRetentionDays } from "../lib/server/maintenance.ts";

test("uses the fallback when the env value is unset", () => {
  assert.equal(resolveRetentionDays(undefined, 7), 7);
});

test("parses a valid positive integer env value", () => {
  assert.equal(resolveRetentionDays("14", 7), 14);
});

test("floors fractional values", () => {
  assert.equal(resolveRetentionDays("3.9", 7), 3);
});

test("rejects zero, negative, and non-numeric values → fallback", () => {
  assert.equal(resolveRetentionDays("0", 7), 7);
  assert.equal(resolveRetentionDays("-5", 7), 7);
  assert.equal(resolveRetentionDays("abc", 7), 7);
  assert.equal(resolveRetentionDays("", 7), 7);
});
