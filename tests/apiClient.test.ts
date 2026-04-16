import assert from "node:assert/strict";
import test from "node:test";
import { apiJson } from "../lib/client/api.ts";

test("apiJson reports HTML fallback clearly for auth endpoints", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response("<!DOCTYPE html><html><body>fallback</body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

  try {
    await assert.rejects(
      () => apiJson("/api/auth/csrf"),
      /Expected JSON from \/api\/auth\/csrf but received HTML/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
