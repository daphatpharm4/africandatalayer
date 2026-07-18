import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260721_account_privacy_erasure_pgcrypto_path.sql', import.meta.url);

test('privacy erasure resolves pgcrypto without widening the security-definer path', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions/i);
  assert.match(sql, /ALTER FUNCTION public\.adl_anonymize_user_account\(text\)/i);
  assert.match(sql, /SET search_path = public, extensions, pg_temp/i);
});
