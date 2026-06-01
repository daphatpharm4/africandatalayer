import assert from "node:assert/strict";
import test from "node:test";
import { consumeBucket } from "../lib/server/rateLimit.ts";
import { createInMemoryBucketStore } from "../lib/server/rateLimit/store.ts";

test("token strategy allows burst then denies", async () => {
  const store = createInMemoryBucketStore();
  const now = 1_000_000;
  const base = {
    store,
    route: "test:token",
    key: "user-1",
    strategy: "token" as const,
    capacity: 2,
    refillPerSec: 1,
    nowFn: () => now,
  };
  assert.equal((await consumeBucket(base)).allowed, true);
  assert.equal((await consumeBucket(base)).allowed, true);
  const denied = await consumeBucket(base);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);
});

test("leaky strategy admits after leak window", async () => {
  const store = createInMemoryBucketStore();
  let now = 2_000_000;
  const base = {
    store,
    route: "test:leaky",
    key: "user-2",
    strategy: "leaky" as const,
    capacity: 1,
    leakPerSec: 1,
    nowFn: () => now,
  };
  assert.equal((await consumeBucket(base)).allowed, true);
  assert.equal((await consumeBucket(base)).allowed, false);
  now += 1000;
  assert.equal((await consumeBucket(base)).allowed, true);
});

test("different keys use independent buckets", async () => {
  const store = createInMemoryBucketStore();
  const now = 3_000_000;
  const make = (key: string) => ({
    store, route: "test:iso", key, strategy: "token" as const,
    capacity: 1, refillPerSec: 1, nowFn: () => now,
  });
  assert.equal((await consumeBucket(make("a"))).allowed, true);
  assert.equal((await consumeBucket(make("b"))).allowed, true);
  assert.equal((await consumeBucket(make("a"))).allowed, false);
});
