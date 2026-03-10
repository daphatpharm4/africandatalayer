import assert from "node:assert/strict";
import test from "node:test";
import { SESSION_CONFIG, getAuthBaseUrl, getSessionCookieName } from "../lib/auth.ts";
import { resolveAuthRequestBaseUrl } from "../lib/server/auth/requestUrl.ts";

test("session configuration matches pilot security defaults", () => {
  assert.deepEqual(SESSION_CONFIG, {
    maxAge: 8 * 60 * 60,
    updateAge: 30 * 60,
  });
});

test("getAuthBaseUrl prefers AUTH_URL and trims whitespace", () => {
  const previousAuthUrl = process.env.AUTH_URL;
  const previousNextAuthUrl = process.env.NEXTAUTH_URL;

  process.env.AUTH_URL = " https://pilot.africandatalayer.com ";
  process.env.NEXTAUTH_URL = "https://fallback.example.com";

  assert.equal(getAuthBaseUrl(), "https://pilot.africandatalayer.com");

  process.env.AUTH_URL = "";
  assert.equal(getAuthBaseUrl(), "https://fallback.example.com");

  if (previousAuthUrl === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = previousAuthUrl;

  if (previousNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = previousNextAuthUrl;
});

test("resolveAuthRequestBaseUrl prefers explicit fallback over forwarded headers", () => {
  const headers = new Headers({
    host: "internal.example.com",
    "x-forwarded-host": "preview.example.com",
    "x-forwarded-proto": "http",
  });

  assert.equal(
    resolveAuthRequestBaseUrl(headers, { fallbackUrl: "https://pilot.africandatalayer.com" }),
    "https://pilot.africandatalayer.com",
  );
});

test("secure auth cookie name is derived from AUTH_URL", () => {
  const previousAuthUrl = process.env.AUTH_URL;
  const previousNodeEnv = process.env.NODE_ENV;

  process.env.NODE_ENV = "development";
  process.env.AUTH_URL = "https://pilot.africandatalayer.com";
  assert.equal(getSessionCookieName(), "__Secure-authjs.session-token");

  process.env.AUTH_URL = "http://localhost:3000";
  assert.equal(getSessionCookieName(), "authjs.session-token");

  if (previousAuthUrl === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = previousAuthUrl;

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});
