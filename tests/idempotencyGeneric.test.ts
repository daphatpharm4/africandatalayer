import assert from "node:assert/strict";
import test from "node:test";
import { resolveIdempotency, type IdempotencyStore } from "../lib/server/idempotencyGeneric.ts";
import { DEFAULT_RESERVATION_TTL_MS } from "../lib/server/idempotencyCore.ts";

interface Row {
  requestHash: string;
  responseJson: unknown;
  responseStatus: number;
  createdAtMs: number;
}

function fakeStore(): IdempotencyStore & { rows: Map<string, Row> } {
  const rows = new Map<string, Row>();
  const k = (s: string, u: string, key: string) => `${s}:${u}:${key}`;
  return {
    rows,
    async find(scope, userId, key) {
      return rows.get(k(scope, userId, key)) ?? null;
    },
    async insert(scope, userId, key, requestHash) {
      const id = k(scope, userId, key);
      if (rows.has(id)) return false; // lost the race
      rows.set(id, { requestHash, responseJson: null, responseStatus: 0, createdAtMs: Date.now() });
      return true;
    },
    async reclaim(scope, userId, key, requestHash) {
      rows.set(k(scope, userId, key), { requestHash, responseJson: null, responseStatus: 0, createdAtMs: Date.now() });
    },
    async complete(scope, userId, key, responseJson, responseStatus) {
      const existing = rows.get(k(scope, userId, key))!;
      rows.set(k(scope, userId, key), { ...existing, responseJson, responseStatus });
    },
  };
}

test("first call reserves the key (caller is executor)", async () => {
  const store = fakeStore();
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  assert.equal(r.status, "reserved");
});

test("replay returns stored response", async () => {
  const store = fakeStore();
  await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  await store.complete("user:put", "u1", "k", { ok: true }, 200);
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  assert.equal(r.status, "replay");
  if (r.status === "replay") {
    assert.deepEqual(r.responseJson, { ok: true });
    assert.equal(r.responseStatus, 200);
  }
});

test("same key with different body is a conflict", async () => {
  const store = fakeStore();
  await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "DIFFERENT" });
  assert.equal(r.status, "conflict");
});

test("single-flight: a fresh duplicate while the first is still executing is in_flight, not reserved", async () => {
  const store = fakeStore();
  await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  assert.equal(r.status, "in_flight");
});

test("orphaned reservation (crashed before complete) is reclaimed so a retry can proceed", async () => {
  const store = fakeStore();
  await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  // Simulate the original request crashing long ago: age the reservation past TTL.
  const row = store.rows.get("user:put:u1:k")!;
  row.createdAtMs = Date.now() - DEFAULT_RESERVATION_TTL_MS - 1;
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
  assert.equal(r.status, "reserved");
});

test("hashRequestPayload is stable across key order", async () => {
  const { hashRequestPayload } = await import("../lib/server/idempotencyGeneric.ts");
  assert.equal(
    hashRequestPayload({ a: 1, b: { c: 2, d: 3 } }),
    hashRequestPayload({ b: { d: 3, c: 2 }, a: 1 }),
  );
});
