import assert from "node:assert/strict";
import test from "node:test";
import {
  __resetMapPointsCacheForTest,
  readCachedMapPoints,
  writeCachedMapPoints,
} from "../lib/client/mapPointsCache.ts";
import type { ProjectedPoint } from "../shared/types.ts";

function point(id: string): ProjectedPoint {
  return {
    id,
    pointId: id,
    category: "pharmacy",
    location: { latitude: 4.08, longitude: 9.74 },
    details: { siteName: "Pharmacy" },
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    gaps: [],
    eventsCount: 1,
    eventIds: [id],
  };
}

function fakeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test("map points cache returns fresh scoped points immediately", () => {
  __resetMapPointsCacheForTest();
  const storage = fakeStorage();
  writeCachedMapPoints("global", [point("p1")], {
    authKey: "auth:admin",
    now: () => 1000,
    storage,
  });

  const cached = readCachedMapPoints("global", {
    authKey: "auth:admin",
    now: () => 1200,
    storage,
  });

  assert.equal(cached?.[0]?.pointId, "p1");
});

test("map points cache is separated by scope and auth key", () => {
  __resetMapPointsCacheForTest();
  const storage = fakeStorage();
  writeCachedMapPoints("global", [point("global")], { authKey: "auth:admin", now: () => 1000, storage });
  writeCachedMapPoints("bonamoussadi", [point("local")], { authKey: "auth:agent", now: () => 1000, storage });

  assert.equal(readCachedMapPoints("global", { authKey: "auth:agent", now: () => 1100, storage }), null);
  assert.equal(readCachedMapPoints("bonamoussadi", { authKey: "auth:agent", now: () => 1100, storage })?.[0]?.pointId, "local");
});

test("map points cache expires stale data", () => {
  __resetMapPointsCacheForTest();
  const storage = fakeStorage();
  writeCachedMapPoints("cameroon", [point("old")], { authKey: "auth:admin", now: () => 1000, storage });

  assert.equal(
    readCachedMapPoints("cameroon", {
      authKey: "auth:admin",
      now: () => 10_000,
      storage,
      ttlMs: 100,
    }),
    null,
  );
});
