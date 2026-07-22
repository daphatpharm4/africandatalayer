# Blocked Record Runbook

**Trigger:** Record enters `blockedValidation`, `blockedAuthentication`, or `blockedStorage` state.
**Severity:** Sev-2
**Owner:** Field Support
**Immediate containment:** Collector sees "blocked" status in Pending Work view. No data loss.
**Recovery:** For blocked validation: check schema compatibility. For blocked auth: reauthenticate. For blocked storage: clear device space.
