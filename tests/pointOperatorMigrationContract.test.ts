import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260624_point_operator_accounts.sql",
  import.meta.url,
);

test("point operator migration defines role, password gate, and active uniqueness", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /point_operator/);
  assert.match(sql, /must_change_password boolean not null default false/i);
  assert.match(sql, /create table if not exists public\.point_operator_assignments/i);
  assert.match(sql, /where status = 'active'/i);
  assert.match(sql, /operator_user_id/);
  assert.match(sql, /point_id/);
});
