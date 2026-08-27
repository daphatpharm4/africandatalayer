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
| Build command | Comes from `vercel.json` (`node scripts/vercel-build.mjs`) — **must be left at default in the dashboard.** Do not override it with `npm run build:console`; `vercel.json`'s `buildCommand` takes precedence over the dashboard setting for both projects, and the dispatcher picks the console build only via the `ADL_BUILD_TARGET` env var below. |
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
- `RESEND_WEBHOOK_SIGNING_SECRET`, `RESEND_WEBHOOK_SECRET`, `APP_BASE_URL`,
  `EMAIL_CAMPAIGN_MAX_RECIPIENTS`, `EMAIL_DRAIN_BATCH_SIZE` — webhooks and
  campaign links stay app-side; campaign email cannot run from the console
  project because the campaign drain is gated behind `CRON_SECRET`, which is
  omitted above.
- `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID`, `AT_USE_SANDBOX`,
  `AT_INBOUND_SECRET`, `SMS_CAMPAIGN_MAX_RECIPIENTS`, `SMS_DRAIN_BATCH_SIZE`,
  `CAMPAIGN_DRAIN_MAX_CAMPAIGNS` — SMS stays on the app project only.
- `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCP_SERVICE_ACCOUNT_KEY`,
  `GCP_ACCESS_TOKEN`, `IMAGE_EMBEDDING_ENABLED`, `IMAGE_CRON_BUDGET_MS`,
  `IMAGE_EMBEDDING_MAX_ATTEMPTS`, `IMAGE_EMBEDDING_PROCESSING_STALE_MINUTES`,
  `IMAGE_EMBEDDING_REVIEW_UPGRADE_ENABLED` — image-similarity pipeline runs
  from the app project's cron only.
- `AUTOMATION_SECRET` — N8N intake targets the app domain only.

**Copied (needed on adl-console, unlike the rest of the omit-listed email
vars above):**

- `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` — the console's member
  invite flow sends transactional email (`lib/server/platform/api.ts`
  `handleInviteCreate` → `sendInviteEmailFn`) from the console project's own
  serverless function, so these must be set on adl-console too. Campaign
  email (bulk marketing sends) cannot run there — that path is gated behind
  `CRON_SECRET`, which is intentionally omitted above.

**Override:**

- `AUTH_URL=https://console.africandatalayer.com` (required at boot;
  `trustHost: true` in the auth handler).
- `AUTH_SECRET=<fresh value>` — generate with `openssl rand -base64 32`.
  A distinct secret keeps console sessions cryptographically isolated from
  app sessions. Same user database — same credentials log in on both sites,
  but cookies never transfer.
- `ADL_BUILD_TARGET=console` — **required** so `scripts/vercel-build.mjs`
  runs `npm run build:console` instead of the field app build. The app
  project must NOT set `ADL_BUILD_TARGET` (leave it unset there — the
  dispatcher's default path is the app build).

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
6. No CAMPAIGN email/SMS is dispatched from the console project (omit list
   applied — `CRON_SECRET`, SMS vars, and campaign-only email vars absent).
   Transactional invite email DOES dispatch from the console project — see
   item 8.
7. adl-console's first deploy build logs show `build:console` ran (look for
   `[vercel-build] ADL_BUILD_TARGET=console -> running "npm run
   build:console"`), and the deployed page's `<title>` is `ADL Console`.
8. Send a test member invite from the console and confirm the email arrives
   with a working join link (`https://console.africandatalayer.com/#/join?
   token=...`).
9. After the console domain is live, revoke every outstanding pending invite
   that was sent before cutover and re-send it from the console. Those old
   emails link to `app.africandatalayer.com/console#/join?...`, which stops
   routing to the console once cutover completes — the field app renders its
   unknown-route behavior for that path instead, and no redirect is provided
   for it deliberately.

## Constraints to remember

- Both projects deploy the same 12 API functions — the Hobby limit is 12.
  `npm run check:function-budget` guards this; a new API route breaks BOTH
  deployments.
- Keep env vars in sync when server code gains new required variables; this
  file's omit list is the source of truth for what console must not have.
