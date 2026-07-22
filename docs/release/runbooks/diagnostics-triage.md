# Diagnostics Triage Runbook

**Trigger:** MetricKit report shows elevated crash rate, hang rate, or memory.
**Severity:** Sev-1 if crash-free < 99.5%
**Owner:** iOS Console Lead
**Evidence:** MetricKit payloads stored in `MetricSummaryStore`. Export via `docs/release/evidence/`.
