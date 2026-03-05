# ADL Features To Implement - Code-Validated Backlog

**Date:** 2026-03-05  
**Source:** Cross-check of `research/` + `docs/team/` action items against the current codebase.

---

## 1. Scope and Method

This document tracks implementation status by checking the repository code and migrations directly.

- Status values:
  - `IMPLEMENTED`: End-to-end behavior exists in code.
  - `PARTIAL`: Some pieces exist, but key requirements are missing.
  - `MISSING`: No production-grade implementation found in code.
- Important limit:
  - Dashboard/env operations (secret rotation, Vercel/Supabase settings) are not verifiable from code alone and remain operational tasks.

---

## 2. Executive Summary

| Bucket | Count | Notes |
|---|---:|---|
| Implemented | 12 | Major progress on fraud, analytics, workflow, assignments |
| Partial | 4 | Idempotency/rate-limit still incomplete |
| Missing | 18 | Security hardening and platform ops still high priority |

Top priority remains **P0 security hardening** before broader feature expansion.

---

## 3. Already Implemented (Code-Verified)

| ID | Item | Status | Evidence |
|---|---|---|---|
| I-01 | Gemini moved server-side | IMPLEMENTED | `api/ai/search.ts`, `lib/server/geminiSearch.ts`, `vite.config.ts` |
| I-02 | Fraud risk scoring + blocking + flags | IMPLEMENTED | `api/submissions/index.ts`, `lib/server/submissionRisk.ts` |
| I-03 | Fraud audit persistence | IMPLEMENTED | `supabase/migrations/20260305_fraud_analytics_foundation.sql` (`fraud_audit_log`) |
| I-04 | Admin review workflow table + API | IMPLEMENTED | `admin_reviews` migration + `api/submissions/[id].ts` PATCH review |
| I-05 | Dedup candidate flow (API + client) | IMPLEMENTED | `lib/server/dedup.ts`, `api/submissions/index.ts`, `components/Screens/ContributionFlow.tsx` |
| I-06 | Geohash point ID generation | IMPLEMENTED | `lib/shared/pointId.ts` |
| I-07 | New verticals (`transport_road`, `census_proxy`) | IMPLEMENTED | `shared/verticals.ts`, `20260306_enforce_active_category_constraint.sql` |
| I-08 | Collection assignments data model | IMPLEMENTED | `20260304_system_design_collection_workflow.sql` |
| I-09 | Collection assignments API + admin/agent UI | IMPLEMENTED | `api/user/index.ts`, `lib/server/collectionAssignments.ts`, `AdminQueue.tsx`, `Profile.tsx` |
| I-10 | Snapshot delta significance + publishability flags | IMPLEMENTED | migration + `lib/server/snapshotEngine.ts` |
| I-11 | Monthly rollup + daily road snapshot jobs | IMPLEMENTED | `lib/server/snapshotEngine.ts`, `api/analytics/index.ts`, `vercel.json` cron dispatch |
| I-12 | Core `point_events` indexes exist | IMPLEMENTED | `20260219_init_adl.sql` indexes on created/point/user |

---

## 4. Partially Implemented

| ID | Item | Status | Gap |
|---|---|---|---|
| P-01 | Submission velocity protection | PARTIAL | Fraud velocity checks exist, but no general API/auth route limiter middleware |
| P-02 | Idempotency for offline queue | PARTIAL | Client sends `X-Idempotency-Key`; server does not enforce key replay cache |
| P-03 | Admin review queue indicators | PARTIAL | Risk/exif signals exist, but broader admin action audit logging remains incomplete |
| P-04 | Offline sync resilience | PARTIAL | Backoff exists, but no hard max retries/queue size/staleness caps |

---

## 5. Missing Backlog (Prioritized)

## 5.1 P0 - Must Do Now (Security / Data Integrity)

| Priority | Task | Why | Primary Files |
|---|---|---|---|
| P0 | Remove plaintext `ADMIN_PASSWORD` fallback | Critical auth risk | `lib/server/auth/handler.ts` |
| P0 | Replace `bcrypt.compareSync` with async compare | Event-loop safety | `lib/server/auth/handler.ts` |
| P0 | Set explicit session expiry policy | Reduce long-lived token exposure | `lib/server/auth/handler.ts` |
| P0 | Remove `trustHost: true`; enforce explicit `AUTH_URL` | Host header hardening | `lib/server/auth/handler.ts` |
| P0 | Strip `passwordHash` from `/api/user` responses | Sensitive data leak | `api/user/index.ts`, `lib/server/storage/postgresStore.ts` |
| P0 | Redact public leaderboard user identifiers | Privacy leak | `api/leaderboard/index.ts` |
| P0 | Add server-side idempotency store/check | Duplicate event prevention | `api/submissions/index.ts`, new migration/table |
| P0 | Add auth + submission + global API rate limiting | Abuse protection | new `middleware.ts`, auth + submission routes |
| P0 | Harden `PUT /api/submissions/[id]` ownership/admin checks | Privilege escalation prevention | `api/submissions/[id].ts` |
| P0 | Remove/validate raw `photoUrl` in PUT payload | Data integrity + injection surface | `api/submissions/[id].ts` |
| P0 | Add security headers + CORS policy | Baseline web security controls | `vercel.json` |

## 5.2 P1 - Next (Security + Reliability Hardening)

| Priority | Task | Why | Primary Files |
|---|---|---|---|
| P1 | Prevent user enumeration in registration | Account probing risk | `api/auth/register.ts` |
| P1 | Increase bcrypt cost factor to 12 | Password security hardening | `api/auth/register.ts` |
| P1 | Add password complexity requirements | Credential quality | `api/auth/register.ts` |
| P1 | Add request body validation (`zod`) across API routes | Input hardening consistency | `api/*`, shared validators |
| P1 | Add magic-byte file validation for uploads | File spoofing mitigation | `api/submissions/index.ts` |
| P1 | Remove `POSTGRES_SSL_NO_VERIFY` compatibility path | TLS integrity | `lib/server/db.ts`, `.env.example` |
| P1 | Add failed-login monitoring/alerting | Detection and response | new `lib/server/securityEvents.ts` + auth paths |
| P1 | Add pagination for event retrieval path | Scale + performance | `lib/server/storage/postgresStore.ts`, related APIs |
| P1 | Add offline queue limits (size/retry/stale) | Prevent unbounded client queues | `lib/client/offlineQueue.ts` |

## 5.3 P2 - Platform Maturity (Ops / Delivery)

| Priority | Task | Why | Primary Files |
|---|---|---|---|
| P2 | Create CI pipeline (lint/type/test/build/audit) | Deployment safety | `.github/workflows/*`, `package.json` |
| P2 | Add lint/test scripts and tooling | Engineering hygiene | `package.json`, ESLint/Prettier config |
| P2 | Add staging environment workflow docs/config | Safer releases | docs + deployment config |
| P2 | Add automated backup workflow + verification runbook | Recovery readiness | scripts + docs |
| P2 | Implement API key-protected `/api/data/*` endpoints | Monetization/data client readiness | new `api/data/*`, `api_keys` usage |

---

## 6. Operational Tasks (Not Code-Verifiable)

These remain open until manually executed and confirmed:

1. Rotate all potentially exposed secrets.
2. Verify Vercel/Supabase env var correctness post-rotation.
3. Confirm PITR and backup retention settings in Supabase.
4. Confirm incident-response contacts and notification paths.

---

## 7. Recommended Execution Order

1. **Security hardening sprint (P0)**
   - Complete all auth, idempotency, rate-limiting, response redaction, and headers/CORS tasks.
2. **Reliability hardening sprint (P1)**
   - Validation, TLS strictness, queue limits, pagination, monitoring.
3. **Delivery maturity sprint (P2)**
   - CI/CD, staging discipline, automated backups, external API readiness.

---

## 8. Definition of Done for This Backlog

A task can move to `DONE` only when:

1. Code change merged to `main`.
2. Relevant tests added or updated.
3. Security-sensitive behavior validated with a negative test.
4. Docs/runbook updated if operational impact exists.
5. If config-only (dashboard) work: screenshot or audit note linked in changelog/issue.

