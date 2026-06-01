import assert from "node:assert/strict";
import test from "node:test";
import { resolveIdempotency, type IdempotencyStore } from "../lib/server/idempotencyGeneric.ts";

function fakeStore(): IdempotencyStore {
  const rows = new Map<string, { requestHash: string; responseJson: unknown; responseStatus: number }>();
  return {
    async find(scope, userId, key) {
      return rows.get(`${scope}:${userId}:${key}`) ?? null;
    },
    async insert(scope, userId, key, requestHash) {
      rows.set(`${scope}:${userId}:${key}`, { requestHash, responseJson: null, responseStatus: 0 });
    },
    async complete(scope, userId, key, responseJson, responseStatus) {
      const existing = rows.get(`${scope}:${userId}:${key}`)!;
      rows.set(`${scope}:${userId}:${key}`, { requestHash: existing.requestHash, responseJson, responseStatus });
    },
  };
}

test("first call reserves the key", async () => {
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

test("reserved-but-incomplete replay returns reserved", async () => {
  const store = fakeStore();
  await resolveIdempotency(store, { scope: "user:put", userId: "u1", idempotencyKey: "k", requestHash: "h1" });
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
