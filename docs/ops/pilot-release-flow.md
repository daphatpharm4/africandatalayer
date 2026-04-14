# Pilot Release Flow

## Branch Model
- `main`: production-ready code only.
- `feature/capacitor-base`: shared Capacitor/mobile foundation branch.
- `feature/ios-distribution`: iOS-specific native work and release prep.
- `feature/android-distribution`: Android-specific native work and release prep.
- `codex/*` or other feature branches: short-lived delivery branches merged into the correct long-lived parent branch.

## Current Operating Note

As of `2026-04-14`, the repo has four active long-lived branches:

- `main`
- `feature/capacitor-base`
- `feature/ios-distribution`
- `feature/android-distribution`

There is no active `staging` branch in the current branch topology. If a `staging` branch is reintroduced later, place it between `feature/capacitor-base` and `main`.

## Environment Matrix

| Environment | Branch | Vercel | Database | Blob | Sentry |
| --- | --- | --- | --- | --- | --- |
| Local | any | `vercel dev` or Vite proxy | local `.env` target | shared test token only | optional |
| Branch preview | `feature/capacitor-base`, `feature/ios-distribution`, `feature/android-distribution`, `codex/*` | preview deployment if configured | non-production target via env vars | non-production prefix | non-production DSN/project |
| Production | `main` | production deployment | production Postgres / Supabase target via env vars | production prefix (`production/...`) | production DSN/project |

## Required Variables
- Shared: `AUTH_SECRET`, `AUTH_URL`, `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING`, `BLOB_READ_WRITE_TOKEN`
- Auth/OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- AI/search: `GEMINI_API_KEY`
- Security: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SENTRY_DSN`, `VITE_SENTRY_DSN`
- Fraud and ops: `FRAUD_ALERT_WEBHOOK_URL`, `QUEUE_MAX_ITEMS`, `QUEUE_MAX_RETRY_COUNT`, `QUEUE_MAX_ITEM_AGE_HOURS`

## Promotion Flow
1. Merge shared feature work into `feature/capacitor-base`.
2. Validate `npm run test:ci` locally or in CI.
3. Run manual pre-release checks on the candidate branch:
   - `/api/health` returns `200`
   - admin review flow works
   - consent capture and privacy export/erase flow work
   - offline queue sync works after reconnect
   - native API base resolution works from a mobile shell build if the change touches Capacitor code
4. Sync `feature/capacitor-base` into `feature/ios-distribution` and `feature/android-distribution` if the change affects mobile builds.
5. Merge any durable platform-specific release fixes back into `feature/capacitor-base`.
6. Open a release PR from `feature/capacitor-base` to `main`.
7. Apply pending production migrations immediately before deploy if required.
8. Confirm production `/api/health` and Sentry are green.

## Mobile Release Track
1. Land shared mobile changes on `feature/capacitor-base`.
2. Let `.github/workflows/merge-base-to-platforms.yml` open sync PRs into `feature/ios-distribution` and `feature/android-distribution`.
3. Validate the platform branch workflows:
   - `.github/workflows/ios-build.yml`
   - `.github/workflows/android-build.yml`
4. Run `npm run cap:sync:ios` or `npm run cap:sync:android` before store submission builds.
5. Complete store signing, screenshots, privacy metadata, and staged rollout from the platform branch.
6. Merge platform-specific release changes back into `feature/capacitor-base`, then promote into `main` after release validation.

## Production Hotfix Flow
1. Branch from `main` using `hotfix/*`.
2. Merge the hotfix back into `main` after review and validation.
3. Immediately back-merge `main` into `feature/capacitor-base`.
4. Sync `feature/capacitor-base` forward into the platform branches if the hotfix affects shared app behavior or mobile builds.

## Rollback Flow
1. Re-point traffic by redeploying the last known-good Vercel production build.
2. If the issue is schema-related, restore the last verified Postgres backup to a fresh database and rebind the production env vars.
3. If the issue is mobile-specific, pull the affected build from TestFlight / Play testing or halt staged rollout while keeping web production stable.
4. Disable field capture if fraud or privacy protections are degraded.
5. Post an incident note in the shared response channel and start the incident checklist in [backup-restore-runbook.md](/Users/charlesvictormahouve/Documents/GitHub/africandatalayer/docs/ops/backup-restore-runbook.md).
