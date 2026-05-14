import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../scripts/retry.mjs';

test('withRetry retries on 5xx and eventually succeeds', async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) {
        const err = new Error('upstream');
        err.status = 503;
        throw err;
      }
      return 'ok';
    },
    { delaysMs: [1, 2, 4] }
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('withRetry does not retry on 401 auth error', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        const err = new Error('auth');
        err.status = 401;
        throw err;
      },
      { delaysMs: [1, 2] }
    ),
    /auth/
  );
  assert.equal(calls, 1);
});

test('withRetry exhausts attempts and re-throws last error', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        const err = new Error('still down');
        err.status = 502;
        throw err;
      },
      { delaysMs: [1, 1, 1] }
    ),
    /still down/
  );
  assert.equal(calls, 4);
});
