import assert from "node:assert/strict";
import test from "node:test";
import { cachedJsonResponse, computeWeakEtag } from "../lib/server/http.ts";

test("sets public CDN cache-control with s-maxage and stale-while-revalidate", () => {
  const res = cachedJsonResponse({ ok: true }, { sMaxAge: 300, staleWhileRevalidate: 600 });
  assert.equal(
    res.headers.get("cache-control"),
    "public, s-maxage=300, stale-while-revalidate=600",
  );
});

test("emits a weak ETag and returns 304 when If-None-Match matches", () => {
  const body = { value: 42 };
  const etag = computeWeakEtag(body);
  const res = cachedJsonResponse(body, { sMaxAge: 60, etag, ifNoneMatch: etag });
  assert.equal(res.status, 304);
  assert.equal(res.headers.get("etag"), etag);
});

test("returns 200 with body when If-None-Match differs", async () => {
  const body = { value: 42 };
  const etag = computeWeakEtag(body);
  const res = cachedJsonResponse(body, { sMaxAge: 60, etag, ifNoneMatch: '"stale"' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), body);
});

test("computeWeakEtag is stable and weak-formatted", () => {
  const a = computeWeakEtag({ x: 1, y: 2 });
  const b = computeWeakEtag({ x: 1, y: 2 });
  assert.equal(a, b);
  assert.ok(a.startsWith('W/"'));
});
