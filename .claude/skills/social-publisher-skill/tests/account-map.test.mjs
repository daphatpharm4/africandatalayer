import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccount, listRequiredEnvKeys } from '../scripts/account-map.mjs';

test('resolves IG account from env', () => {
  const env = {
    IG_ACCESS_TOKEN_ADL_MAIN: 'tok',
    IG_USER_ID_ADL_MAIN: '17841',
  };
  const result = resolveAccount('adl_main', env);
  assert.equal(result.ok, true);
  assert.equal(result.value.platform, 'instagram');
  assert.equal(result.value.credentials.accessToken, 'tok');
  assert.equal(result.value.credentials.userId, '17841');
});

test('resolves LinkedIn account from env', () => {
  const env = {
    LI_ACCESS_TOKEN_ADL_ORG: 'AQX',
    LI_REFRESH_TOKEN_ADL_ORG: 'AQY',
    LI_ORG_URN_ADL_ORG: 'urn:li:organization:12345',
    LI_TOKEN_EXPIRES_AT_ADL_ORG: '2026-07-13T00:00:00Z',
  };
  const result = resolveAccount('adl_org', env);
  assert.equal(result.ok, true);
  assert.equal(result.value.credentials.orgUrn, 'urn:li:organization:12345');
});

test('missing env keys produce explicit error listing each missing key', () => {
  const result = resolveAccount('adl_main', { IG_ACCESS_TOKEN_ADL_MAIN: 'tok' });
  assert.equal(result.ok, false);
  assert.match(result.error, /IG_USER_ID_ADL_MAIN/);
});

test('unknown account name produces error', () => {
  const result = resolveAccount('nonexistent', {});
  assert.equal(result.ok, false);
  assert.match(result.error, /unknown account/i);
});

test('listRequiredEnvKeys returns all env vars for a target set', () => {
  const keys = listRequiredEnvKeys(['adl_main', 'adl_org']);
  assert.ok(keys.includes('IG_ACCESS_TOKEN_ADL_MAIN'));
  assert.ok(keys.includes('LI_ACCESS_TOKEN_ADL_ORG'));
  assert.equal(keys.length, 6);
});
