# Pilot Release Flow

## Branch Model
- `main`: production-ready code only.
- `staging`: pre-production validation branch wired to a Vercel preview deployment and staging environment variables.
- `feature/capacitor-base`: shared Capacitor/mobile foundation branch.
- `feature/ios-distribution`: iOS-specific native work and release prep.
- `feature/android-distribution`: Android-specific native work and release prep.
- `codex/*` or other feature branches: short-lived delivery branches merged into `staging` first.

## Environment Matrix

| Environment | Branch | Vercel | Database | Blob | Sentry |
| --- | --- | --- | --- | --- | --- |
| Local | any | `vercel dev` or Vite proxy | local `.env` target | shared test token only | optional |
| Staging | `staging` | preview deployment | staging Postgres / Supabase target via env vars | staging prefix (`staging/...`) | staging DSN/project |
| Production | `main` | production deployment | production Postgres / Supabase target via env vars | production prefix (`production/...`) | production DSN/project |

## Required Variables
- Shared: `AUTH_SECRET`, `AUTH_URL`, `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING`, `BLOB_READ_WRITE_TOKEN`
- Auth/OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- AI/search: `GEMINI_API_KEY`
- Security: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SENTRY_DSN`, `VITE_SENTRY_DSN`
- Fraud and ops: `FRAUD_ALERT_WEBHOOK_URL`, `QUEUE_MAX_ITEMS`, `QUEUE_MAX_RETRY_COUNT`, `QUEUE_MAX_ITEM_AGE_HOURS`

## Promotion Flow
1. Merge feature work into `staging`.
2. Apply pending SQL migrations to the staging database target.
3. Validate `npm run test:ci` locally or in CI.
4. Run manual staging checks:
   - `/api/health` returns `200`
   - admin review flow works
   - consent capture and privacy export/erase flow work
   - offline queue sync works after reconnect
   - native API base resolution works from a mobile shell build if the change touches Capacitor code
5. Promote `staging` to `main`.
6. Apply the same migration set to production immediately before deploy.
7. Confirm production `/api/health` and Sentry are green.

## Mobile Release Track
1. Land shared mobile changes on `feature/capacitor-base`.
2. Let `.github/workflows/merge-base-to-platforms.yml` open sync PRs into `feature/ios-distribution` and `feature/android-distribution`.
3. Validate the platform branch workflows:
   - `.github/workflows/ios-build.yml`
   - `.github/workflows/android-build.yml`
4. Run `npm run cap:sync:ios` or `npm run cap:sync:android` before store submission builds.
5. Complete store signing, screenshots, privacy metadata, and staged rollout from the platform branch.
6. Merge platform-specific release changes back into `feature/capacitor-base`, then forward into `staging` and `main` after release validation.

## Rollback Flow
1. Re-point traffic by redeploying the last known-good Vercel production build.
2. If the issue is schema-related, restore the last verified Postgres backup to a fresh database and rebind the production env vars.
3. If the issue is mobile-specific, pull the affected build from TestFlight / Play testing or halt staged rollout while keeping web production stable.
4. Disable field capture if fraud or privacy protections are degraded.
5. Post an incident note in the shared response channel and start the incident checklist in [backup-restore-runbook.md](/Users/charlesvictormahouve/Documents/GitHub/africandatalayer/docs/ops/backup-restore-runbook.md).
