import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTokenBucket, type TokenBucketState } from "../lib/server/rateLimit/tokenBucket.ts";

test("first request on empty state is allowed and consumes one token", () => {
  const now = 1_000_000;
  const result = evaluateTokenBucket(null, { capacity: 5, refillPerSec: 1 }, now);
  assert.equal(result.allowed, true);
  assert.equal(result.state.tokens, 4);
  assert.equal(result.state.lastRefillMs, now);
  assert.equal(result.retryAfterSeconds, 0);
});

test("burst up to capacity then denial", () => {
  const opts = { capacity: 3, refillPerSec: 1 };
  let state: TokenBucketState | null = null;
  const now = 2_000_000;
  for (let i = 0; i < 3; i++) {
    const r = evaluateTokenBucket(state, opts, now);
    assert.equal(r.allowed, true, `req ${i} should pass`);
    state = r.state;
  }
  const denied = evaluateTokenBucket(state, opts, now);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);
});

test("tokens refill over elapsed time, capped at capacity", () => {
  const opts = { capacity: 10, refillPerSec: 2 };
  const start = 5_000_000;
  const drained = evaluateTokenBucket({ tokens: 0, lastRefillMs: start }, opts, start);
  assert.equal(drained.allowed, false);
  const later = evaluateTokenBucket({ tokens: 0, lastRefillMs: start }, opts, start + 3000);
  assert.equal(later.allowed, true);
  assert.equal(later.state.tokens, 5);
  const capped = evaluateTokenBucket({ tokens: 0, lastRefillMs: start }, opts, start + 1_000_000);
  assert.equal(capped.state.tokens, 9);
});
