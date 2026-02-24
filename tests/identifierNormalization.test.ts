import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, normalizeIdentifier, normalizePhone } from '../lib/shared/identifier.js';

test('normalizes local Cameroon phone to E.164 with +237', () => {
  assert.equal(normalizePhone('677 12 34 56'), '+237677123456');
});

test('keeps valid E.164 phone unchanged', () => {
  assert.equal(normalizePhone('+237677123456'), '+237677123456');
});

test('normalizes email in lowercase', () => {
  assert.equal(normalizeEmail(' USER@Example.COM '), 'user@example.com');
});

test('normalizeIdentifier detects phone and email', () => {
  assert.deepEqual(normalizeIdentifier('655001122'), { type: 'phone', value: '+237655001122' });
  assert.deepEqual(normalizeIdentifier('Agent@One.org'), { type: 'email', value: 'agent@one.org' });
});
