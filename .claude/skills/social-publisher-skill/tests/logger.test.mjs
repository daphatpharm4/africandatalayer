import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, createLogger } from '../scripts/logger.mjs';

test('redacts token-like keys in objects', () => {
  const input = { access_token: 'AQX12345', user: 'bob' };
  const out = redact(input);
  assert.equal(out.access_token, '[REDACTED]');
  assert.equal(out.user, 'bob');
});

test('redacts page_token and refresh_token', () => {
  const out = redact({ page_token: 'x', refresh_token: 'y', name: 'z' });
  assert.equal(out.page_token, '[REDACTED]');
  assert.equal(out.refresh_token, '[REDACTED]');
  assert.equal(out.name, 'z');
});

test('redacts urn:li: values in strings', () => {
  const out = redact({ author: 'urn:li:organization:12345', other: 'plain' });
  assert.equal(out.author, '[REDACTED-URN]');
  assert.equal(out.other, 'plain');
});

test('redacts nested objects', () => {
  const out = redact({ data: { secret: 'shh', ok: true } });
  assert.equal(out.data.secret, '[REDACTED]');
  assert.equal(out.data.ok, true);
});

test('createLogger writes JSON lines to provided sink', () => {
  const lines = [];
  const log = createLogger({ sink: (line) => lines.push(line) });
  log.info('hello', { token: 'AQ', n: 1 });
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.level, 'info');
  assert.equal(parsed.msg, 'hello');
  assert.equal(parsed.token, '[REDACTED]');
  assert.equal(parsed.n, 1);
  assert.ok(parsed.ts);
});

test('logger error includes stack', () => {
  const lines = [];
  const log = createLogger({ sink: (line) => lines.push(line) });
  log.error('boom', new Error('explode'));
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.level, 'error');
  assert.match(parsed.error, /explode/);
  assert.ok(parsed.stack);
});
