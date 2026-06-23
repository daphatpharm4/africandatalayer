import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260624_point_operator_accounts.sql",
  import.meta.url,
);
const priorAuditMigrationPath = new URL(
  "../supabase/migrations/20260429_admin_account_creation_audit.sql",
  import.meta.url,
);

function normalizeSql(sql: string): string {
  return sql.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractAuditEventTypes(sql: string): string[] {
  const constraint = sql.match(
    /security_audit_log_event_type_check\s+check\s*\(\s*event_type\s+in\s*\(([\s\S]*?)\)\s*\)/i,
  );
  assert.ok(constraint, "security audit event constraint must exist");
  return [...constraint[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

test("point operator migration defines the exact role and assignment schema", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const normalized = normalizeSql(sql);

  assert.match(normalized, /check \(role in \('agent', 'admin', 'client', 'point_operator'\)\)/);
  assert.match(normalized, /must_change_password boolean not null default false/);
  assert.match(normalized, /create table if not exists public\.point_operator_assignments \(/);
  assert.match(normalized, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(
    normalized,
    /operator_user_id text not null references public\.user_profiles\(id\)/,
  );
  assert.match(normalized, /point_id text not null/);
  assert.match(
    normalized,
    /status text not null default 'active' check \(status in \('active', 'revoked'\)\)/,
  );
  assert.match(normalized, /granted_by text not null references public\.user_profiles\(id\)/);
  assert.match(normalized, /granted_at timestamptz not null default now\(\)/);
  assert.match(normalized, /revoked_by text references public\.user_profiles\(id\)/);
  assert.match(normalized, /revoked_at timestamptz/);
  assert.match(normalized, /revoke_reason text/);
});

test("point operator migration enforces assignment lifecycle and index targets", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const normalized = normalizeSql(sql);

  assert.match(
    normalized,
    /status = 'active' and revoked_by is null and revoked_at is null and revoke_reason is null/,
  );
  assert.match(
    normalized,
    /status = 'revoked' and revoked_by is not null and revoked_at is not null/,
  );
  assert.match(
    normalized,
    /create unique index if not exists point_operator_one_active_per_user on public\.point_operator_assignments\(operator_user_id\) where status = 'active'/,
  );
  assert.match(
    normalized,
    /create unique index if not exists point_operator_one_active_per_point on public\.point_operator_assignments\(point_id\) where status = 'active'/,
  );
  assert.match(
    normalized,
    /create index if not exists point_operator_assignments_point_history on public\.point_operator_assignments\(point_id, granted_at desc\)/,
  );
});

test("point operator audit constraint preserves prior values and adds new events", async () => {
  const [sql, priorAuditSql] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(priorAuditMigrationPath, "utf8"),
  ]);
  const currentEventTypes = new Set(extractAuditEventTypes(sql));
  const priorEventTypes = extractAuditEventTypes(priorAuditSql);

  for (const eventType of priorEventTypes) {
    assert.ok(currentEventTypes.has(eventType), `audit constraint must preserve '${eventType}'`);
  }

  for (const eventType of [
    "point_operator_account_created",
    "point_operator_assignment_granted",
    "point_operator_assignment_revoked",
    "point_operator_assignment_replaced",
    "point_operator_password_changed",
  ]) {
    assert.ok(currentEventTypes.has(eventType), `audit constraint must add '${eventType}'`);
  }
});
