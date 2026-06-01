import assert from "node:assert/strict";
import test from "node:test";
import { hashRequestPayload, resolveIdempotency, type IdempotencyStore } from "../lib/server/idempotencyGeneric.ts";

function memStore(): IdempotencyStore {
  const rows = new Map<string, { requestHash: string; responseJson: unknown; responseStatus: number }>();
  return {
    async find(s, u, k) { return rows.get(`${s}:${u}:${k}`) ?? null; },
    async insert(s, u, k, h) { rows.set(`${s}:${u}:${k}`, { requestHash: h, responseJson: null, responseStatus: 0 }); },
    async complete(s, u, k, j, st) { const e = rows.get(`${s}:${u}:${k}`)!; rows.set(`${s}:${u}:${k}`, { requestHash: e.requestHash, responseJson: j, responseStatus: st }); },
  };
}

test("duplicate user PUT with same key+body replays the first response", async () => {
  const store = memStore();
  const body = { occupation: "vendor" };
  const hash = hashRequestPayload(body);
  const first = await resolveIdempotency(store, { scope: "user:put", userId: "u9", idempotencyKey: "abc", requestHash: hash });
  assert.equal(first.status, "reserved");
  await store.complete("user:put", "u9", "abc", { occupation: "vendor", saved: true }, 200);
  const second = await resolveIdempotency(store, { scope: "user:put", userId: "u9", idempotencyKey: "abc", requestHash: hash });
  assert.equal(second.status, "replay");
});

test("reused key with different body conflicts", async () => {
  const store = memStore();
  await resolveIdempotency(store, { scope: "user:put", userId: "u9", idempotencyKey: "abc", requestHash: hashRequestPayload({ occupation: "vendor" }) });
  const r = await resolveIdempotency(store, { scope: "user:put", userId: "u9", idempotencyKey: "abc", requestHash: hashRequestPayload({ occupation: "driver" }) });
  assert.equal(r.status, "conflict");
});
