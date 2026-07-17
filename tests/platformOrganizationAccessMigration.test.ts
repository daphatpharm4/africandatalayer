import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260718_platform_organization_access.sql", import.meta.url);

test("company access migration adds reversible, attributable suspension state", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /access_status text not null default 'active'/i);
  assert.match(sql, /access_status in \('active', 'suspended'\)/i);
  assert.match(sql, /suspension_reason text/i);
  assert.match(sql, /suspended_at timestamptz/i);
  assert.match(sql, /suspended_by text references public\.user_profiles\(id\)/i);
  assert.match(sql, /access_status = 'active'[\s\S]*suspension_reason is null/i);
  assert.match(sql, /access_status = 'suspended'[\s\S]*char_length\(suspension_reason\) between 3 and 500/i);
});
