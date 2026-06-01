import assert from "node:assert/strict";
import test from "node:test";
import { consumeBucket } from "../lib/server/rateLimit.ts";
import { createInMemoryBucketStore } from "../lib/server/rateLimit/store.ts";

test("ai search burst policy: 5 immediate then throttle", async () => {
  const store = createInMemoryBucketStore();
  const now = 9_000_000;
  const cfg = {
    store, route: "ai:search", key: "ip:1.2.3.4", strategy: "token" as const,
    capacity: 5, refillPerSec: 1, nowFn: () => now,
  };
  for (let i = 0; i < 5; i++) {
    assert.equal((await consumeBucket(cfg)).allowed, true, `burst ${i}`);
  }
  const sixth = await consumeBucket(cfg);
  assert.equal(sixth.allowed, false);
  assert.ok(sixth.retryAfterSeconds >= 1);
});
