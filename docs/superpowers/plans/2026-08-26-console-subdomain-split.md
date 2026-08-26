# Console Subdomain Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the ADL Console at `console.africandatalayer.com` from a second Vercel project on the same repo, completely separated from the field app at `app.africandatalayer.com`.

**Architecture:** Env-driven single-entry Vite builds (`ADL_BUILD_TARGET`) so each deployment ships only its own frontend bundle; the console build renames `dist/console.html` → `dist/index.html` so the console serves at its domain root through the existing SPA catch-all rewrite. The `/console` rewrites are removed from `vercel.json`. Both projects deploy the same 12 API functions; the console project simply omits `CRON_SECRET` so cron invocations there are rejected (verified: `api/analytics/index.ts` requires `Boolean(cronSecret && …)`).

**Tech Stack:** Vite 6, Vercel (two projects, Hobby), Node test runner (`node --import tsx --test`), Auth.js.

**Spec:** `docs/superpowers/specs/2026-08-26-console-subdomain-split-design.md`

## Global Constraints

- Vercel Hobby function limit: 12 per deployment; current count is exactly 12 (`npm run check:function-budget` must stay green).
- No `/console` path may remain routable or referenced on the app site.
- No redirect or link from either site to the other.
- Console auth is credentials-only; Google/Apple provider env vars are NOT set in the console project (handler already skips providers when creds are absent — `lib/server/auth/handler.ts:348`).
- Local dev workflow must stay unchanged (`vite` dev server serves both `index.html` and `console.html`; e2e smoke specs navigate to `/console.html`).
- Test command for a single file: `node --import tsx --test tests/<file>.test.ts`.

---

### Task 1: Env-driven Vite build target

**Files:**
- Modify: `vite.config.ts:25-32` (the `build.rollupOptions.input` block)
- Test: `tests/viteBuildTargets.test.ts` (create)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: env var contract `ADL_BUILD_TARGET` — when set to the string `console`, the production build emits only the console entry; otherwise only the app entry. Task 2's `build:console` script relies on this exact variable name and on the emitted file being `dist/console.html`.

- [ ] **Step 1: Write the failing test**

Create `tests/viteBuildTargets.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import viteConfigFactory from "../vite.config";

type FactoryResult = {
  build?: { rollupOptions?: { input?: Record<string, string> } };
};

async function resolveInput(
  target: string | undefined,
): Promise<Record<string, string>> {
  const previous = process.env.ADL_BUILD_TARGET;
  if (target === undefined) delete process.env.ADL_BUILD_TARGET;
  else process.env.ADL_BUILD_TARGET = target;
  try {
    const config = (await (viteConfigFactory as unknown as (env: {
      mode: string;
      command: string;
    }) => FactoryResult | Promise<FactoryResult>)({
      mode: "production",
      command: "build",
    })) as FactoryResult;
    return (config.build?.rollupOptions?.input ?? {}) as Record<string, string>;
  } finally {
    if (previous === undefined) delete process.env.ADL_BUILD_TARGET;
    else process.env.ADL_BUILD_TARGET = previous;
  }
}

test("default build emits only the field app entry", async () => {
  const input = await resolveInput(undefined);
  assert.deepEqual(Object.keys(input), ["main"]);
  assert.ok(input.main.endsWith("index.html"));
});

test("console build emits only the console entry", async () => {
  const input = await resolveInput("console");
  assert.deepEqual(Object.keys(input), ["console"]);
  assert.ok(input.console.endsWith("console.html"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/viteBuildTargets.test.ts`
Expected: FAIL — both tests, because the current config always emits both entries (`Object.keys` is `["main", "console"]`).

- [ ] **Step 3: Implement the input switch**

In `vite.config.ts`, replace the `build` block:

```ts
      build: {
        rollupOptions: {
          input:
            process.env.ADL_BUILD_TARGET === 'console'
              ? { console: path.resolve(__dirname, 'console.html') }
              : { main: path.resolve(__dirname, 'index.html') },
        },
      },
```

Leave `server`, `plugins`, and `resolve` untouched. Note: this deliberately reads `process.env` (build-machine env), not `loadEnv`, because the target is set by the Vercel project's build command, not by `.env` files.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/viteBuildTargets.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify dev server still serves both entries**

Run: `npm run dev &` then `curl -s http://localhost:5173/console.html | grep -c ADL` and `curl -s http://localhost:5173/ | grep -c root`; kill the dev server afterwards.
Expected: both curls return non-zero counts (dev mode ignores `rollupOptions.input`, so both pages serve). If port 5173 is busy, use the port vite prints.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts tests/viteBuildTargets.test.ts
git commit -m "feat(build): select single vite entry via ADL_BUILD_TARGET"
```

---

### Task 2: Console build script and CI coverage

**Files:**
- Create: `scripts/rename-console-entry.mjs`
- Modify: `package.json` (scripts block — add `build:console`, extend `test:ci`)

**Interfaces:**
- Consumes: `ADL_BUILD_TARGET=console` contract from Task 1 (console-only build emitting `dist/console.html`).
- Produces: npm script `build:console` — the exact build command the console Vercel project uses (Task 4 runbook references it verbatim). After it runs, `dist/index.html` is the console page and no app bundle exists in `dist/`.

- [ ] **Step 1: Write the rename script**

Create `scripts/rename-console-entry.mjs`:

```js
// Finalizes a console-only build: the console entry must serve at the domain
// root of console.africandatalayer.com, where the SPA fallback rewrite
// ("/(.*)" -> /index.html) expects an index.html.
import { existsSync, renameSync } from "node:fs";

const from = "dist/console.html";
const to = "dist/index.html";

if (!existsSync(from)) {
  console.error(
    `[console-build] ${from} not found — was the build run with ADL_BUILD_TARGET=console?`,
  );
  process.exit(1);
}
if (existsSync(to)) {
  console.error(
    `[console-build] ${to} already exists — refusing to overwrite an app build. Run a clean console build.`,
  );
  process.exit(1);
}
renameSync(from, to);
console.log(`[console-build] renamed ${from} -> ${to}`);
```

- [ ] **Step 2: Add the npm scripts**

In `package.json`, next to the existing `"build"` script, add:

```json
"build:console": "npm run check:function-budget && ADL_BUILD_TARGET=console vite build && node scripts/rename-console-entry.mjs",
```

and change `test:ci` from:

```json
"test:ci": "npm run lint && npm run typecheck && npm run test && npm run test:publisher && npm run build",
```

to:

```json
"test:ci": "npm run lint && npm run typecheck && npm run test && npm run test:publisher && npm run build && npm run build:console",
```

(`build:console` runs after `build`; the second build wipes `dist/` via Vite's default `emptyOutDir`, so the guard in the rename script never sees a stale app `index.html`.)

- [ ] **Step 3: Verify the app build ships no console code**

Run: `npm run build && ls dist/*.html`
Expected: `dist/index.html` only — no `dist/console.html`. Also run `grep -l "ADL Console" dist/index.html || echo clean`; expected output `clean` (the app page does not carry the console title).

- [ ] **Step 4: Verify the console build serves at root**

Run: `npm run build:console && ls dist/*.html && grep -c "ADL Console" dist/index.html`
Expected: `dist/index.html` only, and grep count ≥ 1 (the renamed console page). No `dist/console.html` remains.

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: PASS (no regressions from the script/config changes).

- [ ] **Step 6: Commit**

```bash
git add scripts/rename-console-entry.mjs package.json
git commit -m "feat(build): add console-only build script and CI coverage"
```

---

### Task 3: Remove /console routing from vercel.json

**Files:**
- Modify: `vercel.json:158-159` (the two `/console` rewrites)
- Modify: `tests/vercelConfig.test.ts:47-76` (replace the console-rewrite test)
- Modify: `e2e/smoke/accessibility.smoke.spec.ts:145-146` (stale comment only)

**Interfaces:**
- Consumes: nothing.
- Produces: an app deployment where `/console` falls into the SPA catch-all (`/(.*)` → `/index.html`) like any unknown route. Task 4's runbook documents this behavior.

- [ ] **Step 1: Rewrite the failing test first**

In `tests/vercelConfig.test.ts`, replace the entire second test (`"vercel serves the console entry before the field app fallback"`, lines 47–76) with:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/vercelConfig.test.ts`
Expected: FAIL — the new test finds the two `/console` rewrites still present.

- [ ] **Step 3: Remove the rewrites**

In `vercel.json`, delete these two lines (currently 158–159):

```json
    { "source": "/console", "destination": "/console.html" },
    { "source": "/console/", "destination": "/console.html" },
```

The catch-all `{ "source": "/(.*)", "destination": "/index.html" }` stays. The `crons` block stays as-is (both projects register the crons; only the app project holds `CRON_SECRET`, so console cron hits are 401-rejected by `api/analytics/index.ts`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/vercelConfig.test.ts`
Expected: PASS (both tests — auth rewrites test untouched).

- [ ] **Step 5: Fix the stale e2e comment**

In `e2e/smoke/accessibility.smoke.spec.ts`, replace lines 145–146:

```ts
  // Vite's multi-page dev server exposes the console entry as console.html;
  // production rewrites /console to the same file in vercel.json.
```

with:

```ts
  // Vite's multi-page dev server exposes the console entry as console.html;
  // in production the console is its own site (console.africandatalayer.com).
```

No behavioral change — the spec still navigates to `/console.html` against the dev server.

- [ ] **Step 6: Sanity-check config validity and budget**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('valid')" && npm run check:function-budget`
Expected: `valid`, then budget report `projected deployment functions: 12` within limit 12.

- [ ] **Step 7: Commit**

```bash
git add vercel.json tests/vercelConfig.test.ts e2e/smoke/accessibility.smoke.spec.ts
git commit -m "feat(routing): drop /console rewrites — console moves to its own domain"
```

---

### Task 4: Deployment runbook and env documentation

**Files:**
- Create: `docs/ops/console-deployment.md`
- Modify: `.env.example` (append console-project note at end of file)

**Interfaces:**
- Consumes: `build:console` script name from Task 2; routing behavior from Task 3.
- Produces: the manual cutover checklist a human follows in the Vercel dashboard. No code depends on this task.

- [ ] **Step 1: Write the runbook**

Create `docs/ops/console-deployment.md`:

```markdown
# Console Deployment — console.africandatalayer.com

The console is a separate Vercel project (`adl-console`) built from this same
repo. The only differences from the app project are the build command and the
environment variables. Spec:
`docs/superpowers/specs/2026-08-26-console-subdomain-split-design.md`.

## Project settings (Vercel dashboard)

| Setting | Value |
|---|---|
| Project name | `adl-console` |
| Git repository | same repo as the app project |
| Root directory | `.` (repo root) |
| Framework preset | Vite |
| Build command | `npm run build:console` |
| Output directory | `dist` |
| Domain | `console.africandatalayer.com` |

## Environment variables

Copy every server-side variable from the app project, **except** the omit
list below. Then apply the overrides.

**Omit (must NOT be set in adl-console):**

- `CRON_SECRET` — its absence makes the cron handler reject the duplicate
  cron invocations this project registers (401 by design; expected log noise).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`,
  `APPLE_CLIENT_SECRET` — console auth is credentials-only; the auth handler
  skips these providers when unset.
- `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO`,
  `RESEND_WEBHOOK_SIGNING_SECRET`, `RESEND_WEBHOOK_SECRET`, `APP_BASE_URL`,
  `EMAIL_CAMPAIGN_MAX_RECIPIENTS`, `EMAIL_DRAIN_BATCH_SIZE` — email sending
  stays on the app project only.
- `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID`, `AT_USE_SANDBOX`,
  `AT_INBOUND_SECRET`, `SMS_CAMPAIGN_MAX_RECIPIENTS`, `SMS_DRAIN_BATCH_SIZE`,
  `CAMPAIGN_DRAIN_MAX_CAMPAIGNS` — SMS stays on the app project only.
- `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCP_SERVICE_ACCOUNT_KEY`,
  `GCP_ACCESS_TOKEN`, `IMAGE_EMBEDDING_ENABLED`, `IMAGE_CRON_BUDGET_MS`,
  `IMAGE_EMBEDDING_MAX_ATTEMPTS`, `IMAGE_EMBEDDING_PROCESSING_STALE_MINUTES`,
  `IMAGE_EMBEDDING_REVIEW_UPGRADE_ENABLED` — image-similarity pipeline runs
  from the app project's cron only.
- `AUTOMATION_SECRET` — N8N intake targets the app domain only.

**Override:**

- `AUTH_URL=https://console.africandatalayer.com` (required at boot;
  `trustHost: true` in the auth handler).
- `AUTH_SECRET=<fresh value>` — generate with `openssl rand -base64 32`.
  A distinct secret keeps console sessions cryptographically isolated from
  app sessions. Same user database — same credentials log in on both sites,
  but cookies never transfer.

Everything else (Postgres, Edge Config, Blob, Sentry, Gemini/AI, fraud and
queue thresholds, Upstash, `PLATFORM_ENRICH_MAX_DISTANCE_M`,
`MAX_SUBMISSION_IMAGE_BYTES`, `VITE_*`) is copied unchanged.

## Cutover verification checklist

1. `https://console.africandatalayer.com/` loads the console sign-in screen
   at the root path (no `/console` anywhere in the URL).
2. Credentials sign-in works and organization data loads (platform API calls
   go same-origin to `console.africandatalayer.com/api/...`).
3. `https://app.africandatalayer.com/console` renders the field app's
   unknown-route behavior — no console content, no redirect.
4. The app site is unchanged: sign-in, map, contribution flow all work.
5. Console project logs: cron invocations of `/api/analytics` return 401.
   App project crons keep returning 200.
6. No email/SMS is dispatched from the console project (omit list applied).

## Constraints to remember

- Both projects deploy the same 12 API functions — the Hobby limit is 12.
  `npm run check:function-budget` guards this; a new API route breaks BOTH
  deployments.
- Keep env vars in sync when server code gains new required variables; this
  file's omit list is the source of truth for what console must not have.
```

- [ ] **Step 2: Append the note to `.env.example`**

Add at the end of `.env.example`:

```bash

# ── Console project (adl-console / console.africandatalayer.com) ─────────────
# The console runs as a second Vercel project from this same repo.
# It copies the app project's server vars EXCEPT cron, email/SMS, OAuth, and
# image-embedding vars, and overrides AUTH_URL + AUTH_SECRET.
# Full omit list and cutover checklist: docs/ops/console-deployment.md
```

- [ ] **Step 3: Verify docs don't break tooling**

Run: `npm test`
Expected: PASS (doc-only change; confirms nothing parses `.env.example` strictly).

- [ ] **Step 4: Commit**

```bash
git add docs/ops/console-deployment.md .env.example
git commit -m "docs(ops): add console deployment runbook and env guidance"
```

---

### Task 5: Full verification pass

**Files:**
- None created or modified (verification only; fixes loop back into the owning task).

**Interfaces:**
- Consumes: all prior tasks.
- Produces: green CI evidence before the manual Vercel cutover.

- [ ] **Step 1: Run the complete CI pipeline**

Run: `npm run test:ci`
Expected: lint, typecheck, unit tests, publisher tests, app build, and console build all pass. This exercises both build targets end to end.

- [ ] **Step 2: Grep for leftover console coupling**

Run: `grep -rn "app.africandatalayer.com/console" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" . | grep -v node_modules | grep -v docs/superpowers`
Expected: no matches outside historical docs. Any hit in live code/config is a bug — fix in the task that owns that file.

- [ ] **Step 3: Push**

```bash
git pull --rebase && git push && git status
```

Expected: `up to date with origin`.

- [ ] **Step 4: Hand off to manual cutover**

The remaining work is dashboard-only and follows `docs/ops/console-deployment.md`: create the `adl-console` project, set build command/output, attach the domain, load env vars, deploy, then walk the cutover verification checklist.
