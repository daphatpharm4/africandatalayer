# Backup And Restore Runbook

## Automated Backup
- Workflow: `.github/workflows/weekly-backup.yml`
- Script: `scripts/backup-postgres-to-blob.mjs`
- Schedule: every Sunday at 03:00 UTC
- Output: private Vercel Blob object under `african-data-layer/weekly/`

## Required Secrets
- `POSTGRES_BACKUP_URL` or one of `ADL_POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL`
- `BLOB_READ_WRITE_TOKEN`

## Restore Drill Checklist
1. Download the latest `.dump` backup from Blob.
2. Provision a fresh Postgres database instance.
3. Restore with `pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$RESTORE_URL" backup.dump`.
4. Run the latest migrations if the target instance was created from an older snapshot baseline.
5. Check:
   - `SELECT COUNT(*) FROM point_events`
   - `SELECT COUNT(*) FROM user_profiles`
   - `/api/health`
   - admin login
   - submission create and review flow
6. Record restore time, row counts, and operator in the incident log.

## Incident Rollback Checklist
1. Freeze writes if the production dataset is suspected to be corrupted.
2. Export logs and Sentry event IDs before rollback.
3. Restore into a fresh database, not over the damaged primary.
4. Switch application env vars to the restored database.
5. Smoke test auth, submissions, privacy actions, and analytics rollups.
6. Resume field operations only after the smoke test passes.
