# Incident Response Kit

## Severity Levels
- `SEV-1`: active breach, mass fraud abuse, or prolonged production outage
- `SEV-2`: major feature degradation, isolated privacy exposure, or failed backup/restore
- `SEV-3`: recoverable defect with low user impact

## First 60 Minutes
1. Open the incident channel and assign an incident lead.
2. Record the exact detection time, reporter, and affected system.
3. Freeze destructive actions and preserve logs, audit records, and Sentry links.
4. Decide whether field capture or admin review must be paused.

## First 24 Hours
1. Identify scope: accounts, records, systems, and processors affected.
2. Contain the issue: revoke credentials, suspend agents, or trigger remote wipe if needed.
3. Validate backup integrity if rollback is possible.
4. Prepare notification drafts for internal stakeholders and, if required, data subjects or regulators.

## Minimum Incident Record
- Detection timestamp
- Incident owner
- Systems affected
- Approximate number of users or records affected
- Containment steps
- Recovery steps
- Follow-up actions and deadlines

## Breach Notice Skeleton
- What happened
- What data was involved
- What containment actions were taken
- What users should do next
- Contact point for follow-up
