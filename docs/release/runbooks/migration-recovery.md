# Migration Recovery Runbook

**Trigger:** Legacy queue migration fails during app launch.
**Severity:** Sev-2
**Owner:** iOS Console Lead
**Immediate containment:** App shows configuration error — no data loss (records remain in legacy JSON).
**Commands:** Check `queue_migrations` table in SQLite. Inspect legacy JSON at `Application Support/ConsoleOfflineCache/`.
**Recovery:** Delete the last migration row, fix the migration, rebuild.
