# Data Retention Policy

| Data Class | Default Retention | Notes |
| --- | --- | --- |
| User profiles | duration of active pilot + 12 months | remove or anonymize inactive pilot users after closeout |
| Point events and review history | 24 months | earlier erasure when a valid privacy request applies |
| Security audit log | 24 months | maintain for fraud investigation and incident review |
| Privacy requests | 36 months | retain request trail and fulfillment evidence |
| Fraud alerts | 24 months | used for trust-score and abuse investigations |
| Weekly Postgres backups | 90 days rolling | verify restore before deleting older backups |
| Sentry events | 30 days | PII scrubbing enabled by default |

## Operational Rules
- `refused_pii_only` and `withdrawn` consent states trigger PII stripping in downstream handling.
- Photos and personal fields removed through an erasure request must be marked in `point_events.erased_at`, `erased_by`, and `erasure_reason`.
- Production data exports must be admin-only and logged in `security_audit_log`.
