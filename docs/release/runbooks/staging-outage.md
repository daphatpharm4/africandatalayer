# Staging Outage Runbook

**Trigger:** Staging smoke test fails or staging API returns 5xx.
**Severity:** Sev-1 (blocks release)
**Owner:** Platform Engineering
**Recovery:** Check staging deployment status. Roll back to last known good build if needed.
