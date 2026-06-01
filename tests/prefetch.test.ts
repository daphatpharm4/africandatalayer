import assert from "node:assert/strict";
import test from "node:test";
import { createPrefetchCache } from "../lib/client/prefetch.ts";

test("prefetch stores and serves a fetched value once", async () => {
  let calls = 0;
  const cache = createPrefetchCache<{ id: string }>({ ttlMs: 10_000, nowFn: () => 1000 });
  const fetcher = async (id: string) => { calls++; return { id }; };

  cache.prefetch("p1", fetcher);
  await cache.prefetch("p1", fetcher); // de-dupes in-flight / fresh
  const value = await cache.take("p1");
  assert.deepEqual(value, { id: "p1" });
  assert.equal(calls, 1);
});

test("take returns null for unknown id", async () => {
  const cache = createPrefetchCache<{ id: string }>({ ttlMs: 10_000 });
  assert.equal(await cache.take("missing"), null);
});

test("expired prefetch is discarded", async () => {
  let clock = 1000;
  const cache = createPrefetchCache<{ id: string }>({ ttlMs: 1000, nowFn: () => clock });
  await cache.prefetch("p2", async (id) => ({ id }));
  clock += 2000;
  assert.equal(await cache.take("p2"), null);
});

test("failed prefetch does not poison the cache", async () => {
  const cache = createPrefetchCache<{ id: string }>({ ttlMs: 10_000 });
  await cache.prefetch("p3", async () => { throw new Error("boom"); });
  assert.equal(await cache.take("p3"), null);
});
