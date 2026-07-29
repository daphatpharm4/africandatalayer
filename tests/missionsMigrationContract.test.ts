import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260729_missions.sql", import.meta.url);

test("mission_definitions is org-scoped with period/quota/reward checks and a daily-once-per-org index", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create table if not exists public\.mission_definitions/i);
  assert.match(sql, /organization_id uuid not null references public\.platform_organizations\(id\)/i);
  assert.match(sql, /period text not null check \(period in \('daily', 'weekly'\)\)/i);
  assert.match(sql, /quota integer not null check \(quota between 1 and 100\)/i);
  assert.match(sql, /reward_xp integer not null default 10/i);
  assert.match(sql, /deadline timestamptz/i);
  assert.match(sql, /project_id uuid references public\.platform_projects\(id\)/i);
  assert.match(sql, /created_by text references public\.user_profiles\(id\)/i);
  assert.match(sql, /create index if not exists mission_definitions_by_org_period/i);
  assert.match(sql, /create unique index if not exists mission_definitions_daily_once_per_org/i);
  assert.match(sql, /where period = 'daily'/i);
});

test("mission_assignments is mission/user scoped with a state machine and a per-mission-per-user uniqueness guard", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create table if not exists public\.mission_assignments/i);
  assert.match(sql, /mission_id uuid not null references public\.mission_definitions\(id\) on delete cascade/i);
  assert.match(sql, /user_id text not null references public\.user_profiles\(id\)/i);
  assert.match(sql, /state text not null default 'pending' check \(state in \('pending', 'in_progress', 'completed', 'expired'\)\)/i);
  assert.match(sql, /current integer not null default 0/i);
  assert.match(sql, /completed_at timestamptz/i);
  assert.match(sql, /xp_awarded boolean not null default false/i);
  assert.match(sql, /unique \(mission_id, user_id\)/i);
  assert.match(sql, /create index if not exists mission_assignments_by_mission/i);
  assert.match(sql, /create index if not exists mission_assignments_by_user/i);
});
