import assert from 'node:assert/strict';
import test from 'node:test';
import { anonymizeUserAccount, getAccountDeletionRequirements } from '../lib/server/accountDeletion.ts';

test('account deletion requirements demand password reauthentication and report last-owner protection', async () => {
  const calls: string[] = [];
  const requirements = await getAccountDeletionRequirements('owner@example.com', {
    queryFn: (async (text: string) => {
      calls.push(text);
      if (text.includes('FROM public.user_profiles') && text.includes('password_hash')) {
        return { rows: [{ password_hash: '$2b$hash', role: 'agent', is_admin: false }], rowCount: 1 };
      }
      return { rows: [{ name: 'Meridian' }], rowCount: 1 };
    }) as any,
  });
  assert.deepEqual(requirements, {
    requiresPassword: true,
    blockers: [{ code: 'last_organization_owner', label: 'Meridian' }],
  });
  assert.equal(calls.length, 2);
});

test('account deletion requirements protect the final ADL administrator', async () => {
  let call = 0;
  const requirements = await getAccountDeletionRequirements('admin@example.com', {
    queryFn: (async () => {
      call += 1;
      if (call === 1) return { rows: [{ password_hash: null, role: 'admin', is_admin: true }], rowCount: 1 };
      if (call === 2) return { rows: [], rowCount: 0 };
      return { rows: [{ count: 0 }], rowCount: 1 };
    }) as any,
  });
  assert.deepEqual(requirements, {
    requiresPassword: false,
    blockers: [{ code: 'last_adl_admin', label: 'African Data Layer' }],
  });
});

test('account anonymization delegates to the atomic database function', async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const tombstone = await anonymizeUserAccount('person@example.com', {
    queryFn: (async (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      return { rows: [{ tombstone: 'deleted-00000000-0000-4000-8000-000000000001' }], rowCount: 1 };
    }) as any,
  });
  assert.equal(tombstone, 'deleted-00000000-0000-4000-8000-000000000001');
  assert.match(calls[0].text, /adl_anonymize_user_account/i);
  assert.deepEqual(calls[0].values, ['person@example.com']);
});
