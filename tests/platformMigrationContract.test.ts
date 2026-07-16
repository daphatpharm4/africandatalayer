import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260716_platform_tenancy.sql", import.meta.url);

test("platform tenancy migration defines all tenant tables with organization scope", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create table if not exists public\.platform_organizations/i);
  assert.match(sql, /create table if not exists public\.platform_organization_members/i);
  assert.match(sql, /create table if not exists public\.platform_organization_invites/i);
  assert.match(sql, /create table if not exists public\.platform_projects/i);
  assert.match(sql, /create table if not exists public\.platform_project_members/i);
  assert.match(sql, /create table if not exists public\.platform_project_schema_versions/i);
  assert.match(sql, /create table if not exists public\.platform_audit_events/i);
  // every tenant table after organizations must carry organization_id
  const tenantTables = sql.split(/create table if not exists/i).slice(2);
  for (const block of tenantTables) {
    assert.match(block, /organization_id uuid not null/i);
  }
});

test("platform roles, invite hashing, and schema versioning are constrained", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /'owner', 'manager', 'reviewer', 'collector', 'viewer'/);
  assert.match(sql, /token_hash text not null unique/i);
  assert.match(sql, /unique \(project_id, version\)/i);
  assert.match(sql, /where status = 'draft'/i); // one draft per project
});
