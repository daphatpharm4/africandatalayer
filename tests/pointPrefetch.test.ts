import assert from "node:assert/strict";
import test from "node:test";
import { __resetPointPrefetchForTest, prefetchPoint, takePrefetchedPoint } from "../lib/client/pointPrefetch.ts";

test("prefetchPoint then takePrefetchedPoint returns the value", async () => {
  __resetPointPrefetchForTest();
  let calls = 0;
  const fetcher = async (id: string) => { calls++; return { id, name: "Pharmacie" }; };
  prefetchPoint("pt-1", fetcher);
  const value = await takePrefetchedPoint<{ id: string; name: string }>("pt-1");
  assert.deepEqual(value, { id: "pt-1", name: "Pharmacie" });
  assert.equal(calls, 1);
});

test("takePrefetchedPoint returns null for unknown id", async () => {
  __resetPointPrefetchForTest();
  assert.equal(await takePrefetchedPoint("nope"), null);
});
