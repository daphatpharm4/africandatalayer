import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260721_platform_record_point_link.sql", "utf8");

test("platform record point link migration adds nullable point columns", () => {
  assert.match(sql, /ALTER TABLE public\.platform_records\s+ADD COLUMN IF NOT EXISTS point_id text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS capture_lat double precision/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS capture_lng double precision/);
  assert.doesNotMatch(sql, /point_id text NOT NULL/);
});

test("platform record point link migration indexes the org point overlay", () => {
  assert.match(sql, /CREATE INDEX IF NOT EXISTS platform_records_point_overlay/);
  assert.match(sql, /ON public\.platform_records\s*\(organization_id, point_id, status\)/);
});
