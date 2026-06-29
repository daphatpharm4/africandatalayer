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

test("apiJson preserves status and retryable metadata for permanent HTTP errors", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      headers: { "Content-Type": "text/plain" },
    });

  try {
    await assert.rejects(
      () => apiJson("/api/user?view=po_status"),
      (error) => {
        const typed = error as Error & { status?: number; retryable?: boolean };
        assert.equal(typed.message, "Forbidden");
        assert.equal(typed.status, 403);
        assert.equal(typed.retryable, false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
