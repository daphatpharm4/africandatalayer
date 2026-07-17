import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260717_platform_records.sql", import.meta.url);

test("platform records are tenant, project, schema, contributor, and idempotency scoped", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create table if not exists public\.platform_records/i);
  assert.match(sql, /organization_id uuid not null/i);
  assert.match(sql, /project_id uuid not null/i);
  assert.match(sql, /schema_version_id uuid not null/i);
  assert.match(sql, /captured_by text not null/i);
  assert.match(sql, /unique \(project_id, captured_by, idempotency_key\)/i);
  assert.match(sql, /request_hash text not null/i);
});
