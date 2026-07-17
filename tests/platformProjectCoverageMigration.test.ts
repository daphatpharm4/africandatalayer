import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../supabase/migrations/20260717_platform_project_coverage_scope.sql", import.meta.url),
  "utf8",
);

test("platform project coverage migration is repeatable and defaults old projects to worldwide", () => {
  assert.match(sql, /add column if not exists coverage_scope/i);
  assert.match(sql, /default 'worldwide'/i);
  assert.match(sql, /town.*country.*worldwide/is);
  assert.match(sql, /coverage_label/i);
});
