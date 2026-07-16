# ADL Data Operations Platform — MVP Design Specification

**Date:** 2026-07-16

**Status:** Design approved in brainstorming session; written-spec review pending

**Supersedes in part:** `2026-07-11-data-operations-platform-design.md` (strategy spec). That document required completed customer validation before any platform implementation. The founder has decided on a **staged build**: construct the configurable platform core and a sellable synthetic-data demonstration in parallel with customer validation, because the demo must run on the real configuration engine to prove the product. All other principles from the strategy spec remain in force.

## 1. Summary

Build the Configurable Data Operations Platform MVP inside the existing `africandatalayer` repository. Organizations create isolated workspaces, define their own record types ("verticals"), configure evidence rules, invite their teams, collect offline through dynamic mobile forms, review submissions, and export their own datasets. The configurability is the product: clients create their own verticals rather than choosing from ADL's hard-coded seven.

The MVP ships with a proper SaaS shell modeled on established SaaS practice (Slack/Notion/Linear patterns): workspace creation with onboarding wizard, workspace branding (name, logo, accent color), email invites with role management. Billing is explicitly v2; first contracts are fixed-price pilots invoiced manually.

A neutral "Urban Waste Mapping — Douala" demo organization, seeded with synthetic data on the real engine, plus a discovery deck, make the platform sellable for Phase 0 customer conversations.

## 2. Decisions locked during brainstorming

| Decision | Choice |
|----------|--------|
| Build now vs validate first | Both, staged — demo + platform core in parallel with validation |
| Repository | Existing ADL repo (one shared engine; reuse offline queue, fraud, review, maps) |
| Demo form | Both: in-app demo organization **and** discovery deck |
| Demo engine | Real configurable schema engine — NOT hard-coded verticals; self-created verticals are the product |
| SaaS shell v1 | Workspace branding, member invites + roles, onboarding wizard |
| Billing | v2 — excluded from MVP |
| UI placement | Two surfaces, one repo: existing mobile field app (collectors) + new desktop console entry (org admins) |

## 3. Product boundary

Two products, one engine, one repo:

1. **African Data Layer** — existing app and dataset business, untouched. Existing agent/admin/client flows continue as-is.
2. **Data Operations Platform** — tenant layer + console + dynamic collection added around the shared engine.

Strict data boundary: client organization data never enters ADL datasets, ADL analytics, benchmarking, or model training without explicit contractual permission. A future separate brand must not fork the codebase.

## 4. Architecture: two surfaces, one repo

```
africandatalayer repo
├─ index.html        → field app (collectors, mobile, existing App.tsx shell)
├─ console.html      → SaaS console (org admins, desktop, new entry)
├─ api/              → shared serverless functions (new /api/platform/* routes)
├─ lib/server/       → shared engine (new tenancy.ts, platform* modules)
└─ shared/           → shared types + platform schema definitions
```

- **Console** (`console.html`, second Vite entry): desktop-first React SPA for owners/managers/reviewers/viewers. Same design system tokens (navy/terra/forest/gold), client emotional register (premium, data-forward).
- **Field app** (existing entry): gains org-aware collection. Collector sees assigned platform projects; dynamic form renderer replaces hard-coded vertical forms for platform projects. Existing ADL agent experience unchanged.
- Both surfaces call the same `api/` functions and share `lib/server/` and `shared/`.

## 5. Data model (new Postgres migrations, shared database, strict logical isolation)

- `organizations` — name, slug, `logo_url` (Vercel Blob), `accent_color`, settings JSONB
- `organization_members` — user_id, organization_id, role: `owner | manager | reviewer | collector | viewer`
- `organization_invites` — email, role, token, expires_at; delivered via Resend
- `projects` — organization_id, name, status
- `project_members` — project-scoped role overrides (user may hold different roles per project)
- `project_schema_versions` — draft rows editable; **publish produces an immutable JSONB snapshot** (record types, field definitions, validation rules, evidence rules). Field clients consume published versions only. Invalid configuration cannot publish.
- `project_zones` — geographic zones (GeoJSON polygons)
- `project_assignments` — collector ↔ zone/target assignments
- `platform_record_events` — organization_id, project_id, schema_version_id, assignment_id, payload JSONB, idempotency_key, device/GPS/timestamp provenance. **Append-only**: corrections and enrichments append events; original field evidence is never overwritten. A projection provides current approved state.
- `platform_record_media` — protected media references (no globally public URLs)
- `platform_record_review_decisions` — reviewer, decision (approve/reject/request-correction), reason, timestamps
- `audit_events` — configuration changes, exports, review decisions, membership changes

Invariants:

- Every tenant-owned row carries `organization_id`; project entities also carry `project_id`.
- Every record event carries the `schema_version_id` used at capture.
- No query, export job, background task, media lookup, or projection may run without explicit organization scope.

## 6. Auth and tenancy guard

- Reuse existing Auth.js (credentials + Google OAuth, account lockout).
- New `lib/server/tenancy.ts` exposing `requireOrgRole(session, organizationId, minimumRole)` and a project-level variant — the **single chokepoint** every `/api/platform/*` handler calls before any data access.
- Role hierarchy: owner > manager > reviewer > collector > viewer; project membership can narrow or grant per-project.
- Audit events written for configuration changes, exports, review decisions, and membership/invite changes.
- Cross-tenant denial tests are mandatory and blocking (see Testing).

Highest-priority security invariant: one organization can never access another organization's configuration, records, media, analytics, or exports.

## 7. Console features (MVP)

1. **Onboarding wizard** — guided first run: create organization → create project → define first record type → invite team. Modeled on mainstream SaaS setup flows.
2. **Schema builder** — record types with field types: text, number, select, multi-select, date, boolean, photo, GPS (auto-captured). Per-field validation (required, ranges, options). Evidence rules: GPS required + accuracy threshold, minimum photo count, timestamp, notes. Validate → publish immutable schema version.
3. **Members page** — email invites (Resend), pending invite management, role assignment, removal.
4. **Branding settings** — organization name, logo upload (Vercel Blob), accent color; applied to console header and export headers.
5. **Review queue** — reuse AdminQueue patterns: evidence display, risk signals, approve/reject/request-correction with reasons.
6. **Records + map** — tenant-scoped records table, Leaflet map of approved records, coverage view against zones.
7. **Exports** — CSV and GeoJSON, permission-checked, audit-logged.
8. **Dashboard** — coverage, submission volume, quality/review KPIs; reuse `KpiTile`, `WeeklyBarChart`.
9. **Bilingual** — EN/FR via existing `t(en, fr)` pattern, including schema labels (bilingual field labels supported in schema definition).

## 8. Field app changes (MVP)

- Collector with platform project membership sees assigned platform projects (alongside ADL verticals when the same user also works for ADL; platform-only users see only their projects).
- Downloads published schema version + zones + assignments before fieldwork; cached for offline use.
- **Dynamic form renderer**: renders capture form from published schema JSON — field inputs, validation, evidence enforcement (GPS accuracy, photo count) client-side before queueing.
- Reuses existing offline queue (IndexedDB), camera capture, GPS, device context, idempotency keys, retry/sync behavior.
- Drafts pinned to their schema version; new published versions apply only after a validated refresh; existing drafts remain valid against their pinned version.
- Field UX constraints preserved: sunlight-readable, ≥44px touch targets, low-end Android, reduced-motion support.

## 9. Trust plane

- Existing EXIF, GPS, velocity, and duplicate checks parametrized by project evidence rules.
- Per-project review policy: auto-accept low-risk records or route all/high-risk to human review queue.
- Clients cannot disable tenant isolation, audit logging, or evidence provenance.
- Reviewer decisions, reasons, and evidence history preserved append-only.

## 10. Demo and deck

- Seed script creates the **"Urban Waste Mapping — Douala"** demo organization on the real configuration engine: waste-bin and dumping-point record types, synthetic geolocated records, coverage gaps, review examples. Proves the actual product, not a mock.
- No HYSACAM branding, no implied partnership, no prospect data.
- Discovery deck for customer conversations: problem framing, workflow demonstration, pilot proposal structure (fixed geography, record target, outputs, completion date).
- Demo org flag-gated / clearly marked synthetic.

## 11. Build stages

1. **Tenancy core + console shell** — migrations, tenancy guard, console entry, onboarding wizard, schema builder (draft + publish), branding settings, invites + members.
2. **Collection loop** — dynamic mobile forms, offline capture + sync, platform submission API, trust checks, review queue.
3. **Outputs + demo** — records table, map, CSV/GeoJSON exports, dashboard, demo seed script, discovery deck. Platform becomes sellable.

Each stage lands green (typecheck, lint, tests, build) before the next begins. Customer validation conversations proceed in parallel throughout; validation evidence tracked in `bd`.

## 12. Testing

Node native test runner + tsx (existing setup), `/tests` directory.

- **Unit:** schema draft validation and publish rules; evidence-rule evaluation; role/permission decisions; dynamic form validation logic; schema-version compatibility.
- **Integration:** **tenant isolation (highest priority — cross-tenant reads/writes/media/exports must fail)**; submission → trust checks → review → projection → export lifecycle; idempotent retry produces no duplicates; invite/join flow; audit event emission.
- **Offline:** interrupted submission and photo upload; reconnect with bounded retry; drafts pinned across schema republish.
- **E2E (smoke):** owner creates org via wizard → manager publishes schema + assignment → collector captures offline and syncs → reviewer approves → viewer sees map record and exports → cross-tenant access attempts fail.

## 13. Excluded from MVP (v2+)

- Billing/Stripe, subscriptions, plan limits (first contracts: fixed-price pilots, manual invoicing).
- Route optimization, live fleet/vehicle tracking.
- Per-customer branded (white-label) mobile apps.
- Drag-and-drop workflow automation.
- Public template marketplace.
- Dedicated database/storage per customer (enterprise option later).
- AI-made decisions without human verification.
- Migrating ADL's seven existing verticals onto the config engine (candidate later milestone; they may become the first solution packs).

## 14. Success measures

- Time to configure and publish a new project without code changes.
- Demo org fully functional end-to-end on the config engine.
- Zero tenant-isolation incidents; cross-tenant test suite green.
- Offline sync success rate on low-end Android.
- Phase 0 validation evidence recorded in parallel (conversations, design partners, paid commitment) per strategy spec gate.
