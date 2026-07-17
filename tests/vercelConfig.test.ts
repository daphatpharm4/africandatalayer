import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

type RewriteRule = {
  source?: unknown;
  destination?: unknown;
};

test("vercel auth rewrites route Auth.js endpoints to the catch-all auth handler", () => {
  const vercelConfig = JSON.parse(
    readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
  ) as { rewrites?: RewriteRule[] };

  const rewriteMap = new Map<string, string>(
    (vercelConfig.rewrites ?? [])
      .filter(
        (rule): rule is { source: string; destination: string } =>
          typeof rule.source === "string" &&
          typeof rule.destination === "string",
      )
      .map((rule) => [rule.source, rule.destination]),
  );

  const expectedSources = [
    "/api/auth/csrf",
    "/api/auth/session",
    "/api/auth/signin",
    "/api/auth/signin/:path*",
    "/api/auth/callback/:path*",
    "/api/auth/signout",
    "/api/auth/providers",
    "/api/auth/error",
    "/api/auth/verify-request",
  ];

  for (const source of expectedSources) {
    assert.equal(
      rewriteMap.get(source),
      "/api/auth/[...auth]",
      `Missing auth rewrite for ${source}`,
    );
  }
});

test("vercel serves the console entry before the field app fallback", () => {
  const vercelConfig = JSON.parse(
    readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
  ) as { rewrites?: RewriteRule[] };

  const rewrites = vercelConfig.rewrites ?? [];
  const consoleRewriteIndexes = ["/console", "/console/"].map((source) =>
    rewrites.findIndex(
      (rule) =>
        rule.source === source && rule.destination === "/console.html",
    ),
  );
  const fallbackIndex = rewrites.findIndex(
    (rule) =>
      rule.source === "/(.*)" && rule.destination === "/index.html",
  );

  assert.notEqual(fallbackIndex, -1, "Missing field app fallback rewrite");
  for (const [pathIndex, routeIndex] of consoleRewriteIndexes.entries()) {
    assert.notEqual(
      routeIndex,
      -1,
      `Missing ${pathIndex === 0 ? "/console" : "/console/"} rewrite to the built console entry`,
    );
    assert.ok(
      routeIndex < fallbackIndex,
      "Console rewrites must run before the field app fallback",
    );
  }
});
