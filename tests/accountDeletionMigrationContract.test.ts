import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260720_account_privacy_erasure.sql', import.meta.url);

test('privacy erasure migration anonymizes identities and protects critical ownership', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /add column if not exists deleted_at/i);
  assert.match(sql, /on update cascade/i);
  assert.match(sql, /last_organization_owner/i);
  assert.match(sql, /last_adl_admin/i);
  assert.match(sql, /session_version\s*=\s*coalesce\(session_version, 0\) \+ 1/i);
  assert.match(sql, /password_hash\s*=\s*null/i);
  assert.match(sql, /email\s*=\s*null/i);
  assert.match(sql, /set search_path = public, extensions, pg_temp/i);
  assert.match(sql, /revoke all on function/i);
});
