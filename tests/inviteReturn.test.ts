import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearConsoleInviteReturn,
  consoleInvitePath,
  readConsoleInviteReturn,
  saveConsoleInviteReturn,
} from '../lib/client/inviteReturn.ts';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

test('invite return accepts only a server-shaped console invite path', () => {
  const token = 'a'.repeat(64);
  assert.equal(consoleInvitePath(token), `/console#/join?token=${token}`);
  assert.equal(consoleInvitePath('short'), null);
  assert.equal(consoleInvitePath(`${'a'.repeat(63)}g`), null);
});

test('invite return survives auth navigation and can be cleared after acceptance', () => {
  const storage = memoryStorage();
  const token = 'b'.repeat(64);
  assert.equal(saveConsoleInviteReturn(token, storage), true);
  assert.equal(readConsoleInviteReturn(storage), `/console#/join?token=${token}`);
  clearConsoleInviteReturn(storage);
  assert.equal(readConsoleInviteReturn(storage), null);
});

test('invite return rejects a tampered external destination', () => {
  const storage = memoryStorage();
  storage.setItem('adl_console_invite_return', `https://evil.test/console#/join?token=${'c'.repeat(64)}`);
  assert.equal(readConsoleInviteReturn(storage), null);
});
