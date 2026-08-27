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

test("vercel has no console routing (console is its own site)", () => {
  const vercelConfig = JSON.parse(
    readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
  ) as { rewrites?: RewriteRule[] };

  const rewrites = vercelConfig.rewrites ?? [];
  const consoleRules = rewrites.filter(
    (rule) =>
      (typeof rule.source === "string" && rule.source.startsWith("/console")) ||
      rule.destination === "/console.html",
  );
  assert.deepEqual(
    consoleRules,
    [],
    "No /console rewrites allowed — the console is served by the adl-console Vercel project",
  );

  const fallbackIndex = rewrites.findIndex(
    (rule) => rule.source === "/(.*)" && rule.destination === "/index.html",
  );
  assert.notEqual(fallbackIndex, -1, "Missing SPA fallback rewrite");
});

test("vercel buildCommand routes through the target dispatcher, not a raw app build", () => {
  const vercelConfig = JSON.parse(
    readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
  ) as { buildCommand?: unknown };

  assert.equal(
    vercelConfig.buildCommand,
    "node scripts/vercel-build.mjs",
    "vercel.json's buildCommand takes precedence over BOTH Vercel projects' " +
      "dashboard build command settings. A raw \"npm run build\" here would " +
      "make the adl-console project deploy the field app instead of the " +
      "console — it must delegate to scripts/vercel-build.mjs, which picks " +
      "the right target from ADL_BUILD_TARGET.",
  );
});
