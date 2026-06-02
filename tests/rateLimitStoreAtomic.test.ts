import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryBucketStore } from "../lib/server/rateLimit/store.ts";

test("consumeTokenBucket allows a burst up to capacity then denies with retry-after", async () => {
  const store = createInMemoryBucketStore();
  const now = 1_000_000;
  const params = { capacity: 3, refillPerSec: 1, nowMs: now, ttlSeconds: 10 };
  for (let i = 0; i < 3; i++) {
    const r = await store.consumeTokenBucket("k", params);
    assert.equal(r.allowed, true, `burst ${i}`);
  }
  const denied = await store.consumeTokenBucket("k", params);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);
});

test("consumeTokenBucket refills tokens over elapsed time", async () => {
  const store = createInMemoryBucketStore();
  const start = 5_000_000;
  const params = { capacity: 2, refillPerSec: 1, nowMs: start, ttlSeconds: 10 };
  await store.consumeTokenBucket("k", params);
  await store.consumeTokenBucket("k", params); // drained
  assert.equal((await store.consumeTokenBucket("k", params)).allowed, false);
  // 2s later → 2 tokens refilled
  const later = await store.consumeTokenBucket("k", { ...params, nowMs: start + 2000 });
  assert.equal(later.allowed, true);
});

test("consumeTokenBucket isolates keys", async () => {
  const store = createInMemoryBucketStore();
  const params = { capacity: 1, refillPerSec: 1, nowMs: 7_000_000, ttlSeconds: 10 };
  assert.equal((await store.consumeTokenBucket("a", params)).allowed, true);
  assert.equal((await store.consumeTokenBucket("b", params)).allowed, true);
  assert.equal((await store.consumeTokenBucket("a", params)).allowed, false);
});

test("consumeTokenBucket runs without an await before the write (atomic per-process)", async () => {
  // Interleave two consumes started before either is awaited. Because the
  // in-memory consume does its read+write synchronously (no internal await),
  // the second must observe the first's decrement — capacity 1 → exactly one allowed.
  const store = createInMemoryBucketStore();
  const params = { capacity: 1, refillPerSec: 1, nowMs: 9_000_000, ttlSeconds: 10 };
  const [a, b] = await Promise.all([
    store.consumeTokenBucket("race", params),
    store.consumeTokenBucket("race", params),
  ]);
  assert.equal([a.allowed, b.allowed].filter(Boolean).length, 1);
});
