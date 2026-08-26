# Console Subdomain Split — Design

**Date:** 2026-08-26
**Status:** Approved
**Goal:** Serve the ADL Console at `console.africandatalayer.com` as a completely separate site from the agent app at `app.africandatalayer.com`. No URL cross-links, no shared session, no console code shipped to the app domain (and vice versa).

## Context

Today the console is a second Vite entry (`console.html` → `components/Console/ConsoleApp.tsx`) built into the same deployment as the app and served at `app.africandatalayer.com/console` via two rewrites in `vercel.json`. It calls the platform API same-origin (`/api/user?view=platform_*`) with cookie auth. The DNS record for `console.africandatalayer.com` already exists.

Decisions made during brainstorming:

- **Separation depth:** second Vercel project, same repo (user choice).
- **Old URL behavior:** `app.africandatalayer.com/console` becomes a dead path — no redirect, no reference to the console domain.
- **Config mechanism:** keep static `vercel.json`; differentiate projects via build command and env vars, not dynamic config.

## Architecture

### 1. Projects & domains

- Existing Vercel project keeps `app.africandatalayer.com`.
- New Vercel project (`adl-console`) linked to the same GitHub repo, with `console.africandatalayer.com` attached.
- The only differences between the two projects are the **build command** and **environment variables**.

### 2. Build split

`vite.config.ts` selects the Rollup input from an env var (`ADL_BUILD_TARGET`):

- Default / `app`: input = `index.html` only. The console bundle is **not emitted at all** — console code never ships to the app domain.
- `console`: input = `console.html` only, followed by a rename of `dist/console.html` → `dist/index.html` so the console serves at the domain root.

`package.json` scripts:

- `build` — app build (unchanged behavior apart from dropping the console entry).
- `build:console` — sets `ADL_BUILD_TARGET=console`, runs `vite build`, renames the output HTML (use a small Node script or `node -e`, not `mv`, for portability).

The console Vercel project's build command is `npm run build:console`; the app project keeps `npm run build`.

Local development is unchanged: `vite dev` serves both entries.

### 3. `vercel.json`

Remove the two console rewrites:

```json
{ "source": "/console", "destination": "/console.html" },
{ "source": "/console/", "destination": "/console.html" }
```

Nothing else changes. Consequences:

- **Console project:** the existing SPA catch-all `/(.*) → /index.html` serves the console at the root. No host-conditioned rules needed.
- **App project:** `/console` falls into the SPA catch-all like any unknown path — it renders the app shell with no console trace. This is not a literal HTTP 404; it is identical to visiting any nonexistent app route. Accepted.
- **Crons:** the two cron entries register in both projects. The cron handler rejects requests unless `CRON_SECRET` is set and matches (`api/analytics/index.ts` — `Boolean(cronSecret && authHeader === …)`). The console project does **not** set `CRON_SECRET`, so its cron invocations 401 and no work runs twice. The GitHub Actions campaign drain targets the app URL only and is unaffected.

### 4. Console project environment variables

- Copy server vars from the app project: database, Sentry, blob read access, fraud thresholds, and the rest of the server-side list — enumerate concretely from `.env.example` during implementation.
- **Exclude:** `CRON_SECRET` and email-campaign send vars.
- **Set:** `AUTH_URL=https://console.africandatalayer.com` (the auth handler requires `AUTH_URL` and uses `trustHost: true` — `lib/server/auth/handler.ts`).
- **Fresh `AUTH_SECRET`** — sessions are cryptographically isolated between domains. Console auth is credentials-only (`ConsoleAuthScreen` uses `signInWithCredentials`); the same user database backs both sites, so the same logins work, but each domain has its own independent cookie/session.
- **Verify during implementation:** the auth handler tolerates missing Google OAuth creds (console does not use Google sign-in). If it does not, copy the Google vars too (harmless — no console UI path triggers them).

### 5. Separation guarantees

- No `/console` links exist in the app UI (verified by repo grep).
- Cookies are per-domain with distinct secrets — no shared session, no SSO between the sites.
- Each deployment contains only its own frontend bundle.

### 6. Testing & CI

- CI (`test:ci`) builds **both** targets so a change breaking either bundle fails the pipeline.
- `check:function-budget` continues to guard the Vercel Hobby function limit. Both projects deploy the same 12 API functions — currently exactly at the limit of 12.
- Existing console tests (`tests/consoleShell.test.tsx`, etc.) are unaffected; the component tree does not change.

## Error handling

- Console cron invocations return 401 by design; this is expected noise in the console project's logs, not a fault.
- A user hitting `app.africandatalayer.com/console` sees the app's unknown-route behavior.
- Auth failures on the console domain surface through the existing `ConsoleAuthScreen` error paths — no new handling needed.

## Risks

1. **Function budget at 12/12, now ×2 projects.** Any future API route breaks both deployments. The budget check script guards this, but headroom is zero.
2. **Env drift between the two projects.** Mitigation: a note in `.env.example` documenting which vars belong to which project.
3. **Google OAuth env absent in the console project** may make the auth handler throw at module load. Must be verified (and if needed, the vars copied) before cutover.

## Out of scope

- iOS console app (`ios-console/`) — talks to the API directly; unaffected.
- True HTTP 404 on `/console` for the app project.
- Dark mode, design changes, or any console feature work.
- SSO between the two domains (explicitly unwanted).
