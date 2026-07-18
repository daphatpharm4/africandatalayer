import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260719_platform_record_review_forensics.sql', import.meta.url);

test('company record review migration preserves reviewer, timestamp and notes', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /reviewed_by text references public\.user_profiles\(id\)/i);
  assert.match(sql, /reviewed_at timestamptz/i);
  assert.match(sql, /review_notes text/i);
});
