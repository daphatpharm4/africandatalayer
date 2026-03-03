import assert from "node:assert/strict";
import test from "node:test";
import { createAiSearchHandler, validateSearchBody } from "../api/ai/search.js";
import { GeminiConfigError, GeminiUpstreamError } from "../lib/server/geminiSearch.js";

function makeJsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("validateSearchBody rejects missing query", () => {
  const result = validateSearchBody({});
  assert.equal("error" in result, true);
  if ("error" in result) {
    assert.equal(result.error, "query is required");
  }
});

test("validateSearchBody requires lat/lng together", () => {
  const result = validateSearchBody({ query: "pharmacy", lat: 4.06 });
  assert.equal("error" in result, true);
  if ("error" in result) {
    assert.equal(result.error, "lat and lng must be provided together");
  }
});

test("validateSearchBody accepts complete payload", () => {
  const result = validateSearchBody({ query: "pharmacy", lat: 4.06, lng: 9.74 });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, { query: "pharmacy", lat: 4.06, lng: 9.74 });
  }
});

test("POST /api/ai/search returns 401 for unauthenticated requests", async () => {
  const handler = createAiSearchHandler({
    requireUserFn: async () => null,
  });

  const response = await handler(makeJsonRequest({ query: "pharmacy" }));
  assert.equal(response.status, 401);
});

test("POST /api/ai/search returns 400 for invalid JSON", async () => {
  const handler = createAiSearchHandler({
    requireUserFn: async () => ({ id: "user-1", token: {} }),
  });

  const request = new Request("http://localhost/api/ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid",
  });
  const response = await handler(request);
  assert.equal(response.status, 400);
});

test("POST /api/ai/search returns 400 for invalid query payload", async () => {
  const handler = createAiSearchHandler({
    requireUserFn: async () => ({ id: "user-1", token: {} }),
  });

  const response = await handler(makeJsonRequest({ query: "   " }));
  assert.equal(response.status, 400);
});

test("POST /api/ai/search maps Gemini config errors to 503", async () => {
  const handler = createAiSearchHandler({
    requireUserFn: async () => ({ id: "user-1", token: {} }),
    searchFn: async () => {
      throw new GeminiConfigError("missing key");
    },
  });

  const response = await handler(makeJsonRequest({ query: "pharmacy" }));
  assert.equal(response.status, 503);
  const body = (await response.json()) as { code?: string };
  assert.equal(body.code, "gemini_unconfigured");
});

test("POST /api/ai/search maps Gemini upstream errors to 503", async () => {
  const handler = createAiSearchHandler({
    requireUserFn: async () => ({ id: "user-1", token: {} }),
    searchFn: async () => {
      throw new GeminiUpstreamError("upstream");
    },
  });

  const response = await handler(makeJsonRequest({ query: "pharmacy" }));
  assert.equal(response.status, 503);
  const body = (await response.json()) as { code?: string };
  assert.equal(body.code, "gemini_unavailable");
});

test("POST /api/ai/search returns 200 and response payload for valid requests", async () => {
  let captured: { query?: string; lat?: number; lng?: number } | null = null;
  const handler = createAiSearchHandler({
    requireUserFn: async () => ({ id: "user-1", token: {} }),
    searchFn: async (query, lat, lng) => {
      captured = { query, lat, lng };
      return { text: "ok", grounding: [{ source: "maps" }] };
    },
  });

  const response = await handler(makeJsonRequest({ query: "pharmacy", lat: 4.06, lng: 9.74 }));
  assert.equal(response.status, 200);
  assert.deepEqual(captured, { query: "pharmacy", lat: 4.06, lng: 9.74 });

  const body = (await response.json()) as { text: string; grounding: unknown[] };
  assert.equal(body.text, "ok");
  assert.ok(Array.isArray(body.grounding));
});
