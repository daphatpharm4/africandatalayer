import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthRequestBaseUrl, withAbsoluteUrl } from "../lib/server/auth/requestUrl.js";

test("resolveAuthRequestBaseUrl prefers forwarded host and protocol over fallback env URL", () => {
  const headers = new Headers({
    "x-forwarded-host": "africandatalayer.vercel.app",
    "x-forwarded-proto": "https",
    host: "stale-preview.vercel.app",
  });

  const baseUrl = resolveAuthRequestBaseUrl(headers, {
    fallbackUrl: "https://old-deployment.vercel.app",
    defaultProtocol: "http",
  });

  assert.equal(baseUrl, "https://africandatalayer.vercel.app");
});

test("withAbsoluteUrl rebuilds relative auth requests using forwarded headers", async () => {
  const request = new Request("http://localhost/placeholder", {
    method: "GET",
    headers: {
      "x-forwarded-host": "africandatalayer.vercel.app",
      "x-forwarded-proto": "https",
    },
  });

  Object.defineProperty(request, "url", {
    configurable: true,
    value: "/api/auth/callback/google?code=test&state=state-123",
  });

  const normalized = await withAbsoluteUrl(request, "https://old-deployment.vercel.app");

  assert.equal(
    normalized.url,
    "https://africandatalayer.vercel.app/api/auth/callback/google?code=test&state=state-123"
  );
});
