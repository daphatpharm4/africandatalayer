# Pilot Release Flow

## Branch Model
- `main`: production-ready code only.
- `staging`: pre-production validation branch wired to Vercel preview and a Neon staging branch.
- `codex/*` or feature branches: short-lived delivery branches merged into `staging` first.

## Environment Matrix

| Environment | Branch | Vercel | Database | Blob | Sentry |
| --- | --- | --- | --- | --- | --- |
| Local | any | `vercel dev` or Vite proxy | local `.env` target | shared test token only | optional |
| Staging | `staging` | preview deployment | Neon staging branch | staging prefix (`staging/...`) | staging DSN/project |
| Production | `main` | production deployment | Neon production branch | production prefix (`postgres/...`) | production DSN/project |

## Required Variables
- Shared: `AUTH_SECRET`, `AUTH_URL`, `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING`, `BLOB_READ_WRITE_TOKEN`
- Security: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SENTRY_DSN`, `VITE_SENTRY_DSN`
- Fraud and ops: `FRAUD_ALERT_WEBHOOK_URL`, `QUEUE_MAX_ITEMS`, `QUEUE_MAX_RETRY_COUNT`, `QUEUE_MAX_ITEM_AGE_HOURS`

## Promotion Flow
1. Merge feature work into `staging`.
2. Apply pending SQL migrations to the Neon staging branch.
3. Validate `npm run test:ci` locally or in CI.
4. Run manual staging checks:
   - `/api/health` returns `200`
   - admin review flow works
   - consent capture and privacy export/erase flow work
   - remote wipe clears a test device
5. Promote `staging` to `main`.
6. Apply the same migration set to production immediately before deploy.
7. Confirm production `/api/health` and Sentry are green.

## Rollback Flow
1. Re-point traffic by redeploying the last known-good Vercel production build.
2. If the issue is schema-related, restore the last verified Postgres backup to a fresh database and rebind the production env vars.
3. Disable field capture if fraud or privacy protections are degraded.
4. Post an incident note in the shared response channel and start the incident checklist in [backup-restore-runbook.md](/Users/charlesvictormahouve/Documents/GitHub/africandatalayer/docs/ops/backup-restore-runbook.md).
