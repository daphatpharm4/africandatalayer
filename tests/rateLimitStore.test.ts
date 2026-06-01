import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryBucketStore } from "../lib/server/rateLimit/store.ts";

test("in-memory store returns null for unseen key", async () => {
  const store = createInMemoryBucketStore();
  assert.equal(await store.get("missing"), null);
});

test("in-memory store round-trips state", async () => {
  const store = createInMemoryBucketStore();
  await store.set("k1", { a: 1, b: 2 }, 60);
  assert.deepEqual(await store.get("k1"), { a: 1, b: 2 });
});

test("in-memory store expires entries past ttl", async () => {
  let clock = 1000;
  const store = createInMemoryBucketStore(() => clock);
  await store.set("k2", { x: 1 }, 1);
  clock += 2000;
  assert.equal(await store.get("k2"), null);
});
