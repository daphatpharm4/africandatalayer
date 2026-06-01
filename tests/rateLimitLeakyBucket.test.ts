import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLeakyBucket, type LeakyBucketState } from "../lib/server/rateLimit/leakyBucket.ts";

test("first drop is admitted into an empty bucket", () => {
  const now = 1_000_000;
  const r = evaluateLeakyBucket(null, { capacity: 5, leakPerSec: 1 }, now);
  assert.equal(r.allowed, true);
  assert.equal(r.state.level, 1);
  assert.equal(r.state.lastLeakMs, now);
});

test("bucket overflows when filled beyond capacity", () => {
  const opts = { capacity: 2, leakPerSec: 1 };
  const now = 3_000_000;
  let state: LeakyBucketState | null = null;
  for (let i = 0; i < 2; i++) {
    const r = evaluateLeakyBucket(state, opts, now);
    assert.equal(r.allowed, true);
    state = r.state;
  }
  const overflow = evaluateLeakyBucket(state, opts, now);
  assert.equal(overflow.allowed, false);
  assert.equal(overflow.retryAfterSeconds, 1);
  assert.equal(overflow.state.level, 2);
});

test("level leaks down over elapsed time", () => {
  const opts = { capacity: 10, leakPerSec: 2 };
  const start = 7_000_000;
  const r = evaluateLeakyBucket({ level: 6, lastLeakMs: start }, opts, start + 2500);
  assert.equal(r.allowed, true);
  assert.equal(r.state.level, 2);
});
