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
  assert.match(sql, /must_change_password boolean not null default false/);
  assert.match(sql, /create table if not exists public\.point_operator_assignments/);
  assert.match(sql, /where status = 'active'/);
  assert.match(sql, /operator_user_id/);
  assert.match(sql, /point_id/);
});

test("point operator migration preserves assignment lifecycle and audit contracts", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /status text not null default 'active' check \(status in \('active', 'revoked'\)\)/);
  assert.match(sql, /status = 'active'\s+and revoked_by is null\s+and revoked_at is null/);
  assert.match(sql, /status = 'revoked'\s+and revoked_by is not null\s+and revoked_at is not null/);
  assert.match(sql, /point_operator_one_active_per_user/);
  assert.match(sql, /point_operator_one_active_per_point/);
  assert.match(sql, /point_operator_assignments_point_history/);
  assert.match(sql, /point_id, granted_at desc/);

  for (const eventType of [
    "point_operator_account_created",
    "point_operator_assignment_granted",
    "point_operator_assignment_revoked",
    "point_operator_assignment_replaced",
    "point_operator_password_changed",
  ]) {
    assert.match(sql, new RegExp(`'${eventType}'`));
  }
});
