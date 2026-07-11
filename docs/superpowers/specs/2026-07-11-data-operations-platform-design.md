# Configurable Data Operations Platform — Design Specification

**Date:** 2026-07-11

**Status:** Design approved; written-spec review pending

**Working name:** ADL Data Operations Platform

**Primary strategy:** Validation before new platform implementation

## 1. Summary

African Data Layer will continue building and selling trusted African datasets. In parallel, the company may productize its existing field-data infrastructure as a configurable platform for organizations that need to collect, verify, review, and use their own real-world data.

The new offer is not a generic survey builder and is not a separate bespoke application for each customer. It is one configurable data-operations platform with optional managed field services. A customer can use its own collectors, ADL collectors, or a combined team. The customer controls its workspace, project configuration, records, and outputs.

The platform reuses ADL's proven strengths: offline mobile capture, GPS and photo evidence, assignments, fraud and quality checks, human review, maps, dashboards, and exports. New work concentrates on multi-tenant isolation, dynamic project schemas, dynamic forms, client roles, and project-level configuration.

No new platform implementation begins until customer discovery validates the problem and produces a credible design partner, paid pilot, or equivalent commercial commitment.

## 2. Product Boundary

The company will operate two related products on a shared technical foundation:

1. **African Data Layer data products:** ADL defines collection programs, operates the data network, owns the resulting datasets, and sells trusted data or insights.
2. **Configurable Data Operations Platform:** a client defines what must be collected and owns the resulting project dataset. ADL supplies software infrastructure and, when contracted, setup, training, review, or field operations.

Client project data does not automatically enter ADL-owned datasets. Any cross-use requires explicit contractual authorization defining purpose, rights, retention, and permitted outputs.

The final platform brand may differ from African Data Layer. Branding must not cause a code fork or alter the product boundary.

## 3. Goals

- Capitalize on infrastructure already built for ADL.
- Reach market quickly through problem-specific demonstrations and paid pilots.
- Support many field-data use cases without hard-coding one industry.
- Differentiate through trusted operational evidence rather than basic form submission.
- Serve low-connectivity, low-end Android field conditions from the beginning.
- Create recurring platform revenue plus optional service revenue.
- Preserve ADL's core dataset strategy and product roadmap.

## 4. Non-goals

- Competing as a general-purpose form builder with KoboToolbox, ODK, or SurveyCTO.
- Building a custom white-label application for every client.
- Developing a HYSACAM-specific product without a contract or validated design partnership.
- Building route optimization, live vehicle tracking, workflow automation, billing automation, or a template marketplace in the first release.
- Creating a dedicated physical database for every MVP customer.
- Allowing AI to make unreviewed operational or enforcement decisions.
- Starting platform implementation before customer validation reaches the gate in Section 8.

## 5. Users and Roles

Each organization workspace supports these roles:

- **Owner:** controls organization settings, contracts, data policies, and membership.
- **Project manager:** configures projects, schemas, zones, targets, and assignments.
- **Reviewer:** evaluates submitted evidence and approves, rejects, or requests correction.
- **Collector:** downloads assignments and submits field records.
- **Viewer:** reads approved datasets, maps, dashboards, and permitted exports.

Permissions are organization- and project-scoped. A user may have different roles in different projects.

## 6. Operating Modes

All three modes use the same platform:

- **Self-operated:** client supplies and manages collectors.
- **Assisted:** client supplies collectors; ADL configures the project, trains the team, or reviews quality.
- **Managed:** ADL supplies the platform, collectors, and quality operation.

This hybrid model lets customers begin with operational help and adopt more self-service over time. Services must use standard platform configuration wherever possible. Customer-specific software development is separately scoped and priced.

## 7. Customer Journey

1. Client and ADL define the decision the field data must support.
2. Client selects a validated solution pack or starts an empty project.
3. Project manager defines record types, fields, evidence requirements, geography, targets, and review policy.
4. Platform validates and publishes a versioned project schema.
5. Project manager assigns client collectors, ADL collectors, or both.
6. Collectors download schema, zones, and assignments before fieldwork.
7. Collectors capture records offline with required GPS, photos, timestamps, and structured fields.
8. Server applies evidence, integrity, duplicate, and risk checks after synchronization.
9. Automated policy accepts low-risk records or sends them to a human review queue.
10. Approved records become available in the client dataset, map, dashboard, export, and permitted API.
11. Client monitors coverage, quality, status, and changes over repeated collection rounds.

## 8. Validation-first Delivery

### 8.1 Phase 0: customer validation

No new configurable-platform code is required in this phase. The team uses existing ADL capabilities, synthetic data, diagrams, and a neutral demonstration to test demand.

The first neutral demonstration may show urban waste mapping, retail verification, infrastructure monitoring, or another prospect-relevant workflow. It must not use a prospect's brand, imply a partnership, or rely on prospect data without authorization.

Discovery must determine:

- Current operational decision and data gap.
- Existing tools, databases, and manual processes.
- Required record types, fields, evidence, and update frequency.
- Collector ownership, training, supervision, and review model.
- Required maps, dashboards, exports, APIs, and reports.
- Security, retention, residency, and integration requirements.
- Decision-maker, budget owner, procurement path, and buying timeline.
- Pilot geography, record target, acceptance criteria, and willingness to pay.

### 8.2 Validation gate

Implementation planning begins only after discovery produces:

- 10 relevant customer conversations.
- 3 qualified organizations willing to act as design partners.
- At least 1 paid pilot, signed letter of intent, or equivalent written commercial commitment.
- Repeated core requirements across at least 2 organizations.

If the repeated need is only industry-specific, the team designs a bounded vertical product instead of prematurely building a horizontal platform.

### 8.3 Post-validation MVP

The MVP is an empty configurable workspace, not a HYSACAM or waste-specific application. The first contracted use case may become the first reusable solution pack after delivery proves that its configuration generalizes.

## 9. MVP Scope

### 9.1 Included

- Organization workspaces and membership.
- Project-scoped roles.
- Empty project creation.
- Configurable record types, fields, validation, and evidence requirements.
- Immutable published schema versions.
- Geographic zones and collector assignments.
- Dynamic mobile forms.
- Offline drafts, queueing, retry, and synchronization.
- GPS, photo, timestamp, duplicate, and integrity checks.
- Human review queue and review decisions.
- Approved-record dataset.
- Coverage and quality dashboard.
- Map, CSV, and GeoJSON outputs.
- Tenant-scoped read API.
- English and French interfaces.
- Audit log.

### 9.2 Excluded

- Route optimization and live fleet tracking.
- Per-customer branded mobile applications.
- General drag-and-drop workflow automation.
- Automated subscriptions, invoicing, or usage billing.
- Public template marketplace.
- Dedicated database deployment per customer.
- AI-generated decisions without human verification.
- Complex client-defined analytics formulas beyond validated common metrics.

## 10. Architecture

The MVP remains in the existing ADL codebase and infrastructure. It adds a tenant-aware configuration layer around reusable collection capabilities rather than building a second application from zero.

### 10.1 Configuration plane

Responsibilities:

- Organizations and memberships.
- Projects and project roles.
- Draft and published schema versions.
- Record definitions and evidence rules.
- Zones, targets, assignments, and review policies.

Project configuration must be understandable without reading platform internals. Publishing performs complete validation and produces an immutable schema version consumed by field clients.

### 10.2 Collection plane

Responsibilities:

- Render forms from published schemas.
- Reuse camera, GPS, device context, offline queue, and sync behavior.
- Preserve assignment and schema version with every draft and submission.
- Keep the field experience daylight-readable, bilingual, one-handed, and usable on low-end Android devices.
- Maintain 48-pixel minimum touch targets and reduced-motion support.

### 10.3 Trust plane

Responsibilities:

- Reuse idempotent submission handling.
- Apply EXIF, GPS, velocity, duplicate, and risk checks when relevant.
- Evaluate project-specific evidence rules.
- Route records according to published review policy.
- Preserve reviewer decisions, reasons, and evidence history.

Trust controls must remain configurable within safe bounds. A client cannot disable platform-level tenant isolation, audit logging, or evidence provenance.

### 10.4 Client data plane

Responsibilities:

- Tenant-scoped record views.
- Maps and coverage views.
- Status and quality dashboards.
- CSV and GeoJSON exports.
- Tenant-scoped API access.
- Retention, deletion, and audit operations.

The MVP uses shared PostgreSQL and storage infrastructure with strict logical isolation. Dedicated infrastructure remains an enterprise option after demand justifies it.

## 11. Conceptual Data Model

Core entities:

- `organizations`
- `organization_members`
- `projects`
- `project_members`
- `project_schema_versions`
- `project_record_types`
- `project_field_definitions`
- `project_evidence_rules`
- `project_zones`
- `project_assignments`
- `record_events`
- `record_media`
- `record_quality_signals`
- `record_review_decisions`
- `export_jobs`
- `audit_events`

Operational records remain event-oriented. Corrections and enrichments append events instead of silently overwriting original field evidence. Projections provide the current approved state for dashboards and exports.

Every tenant-owned entity carries `organization_id`; project entities also carry `project_id`. Every record event carries the published `schema_version_id` used during capture.

## 12. Data Flow

1. Project manager publishes validated schema version.
2. Collector downloads authorized project configuration and assignments.
3. Collector creates local draft against one schema version.
4. Offline queue preserves payload and media until acknowledgement.
5. Submission API authenticates membership, project access, schema version, and idempotency key.
6. Server stores original event and media provenance.
7. Trust plane produces quality signals and review route.
8. Reviewer records a decision when policy requires human review.
9. Projector updates current approved record state.
10. Tenant-scoped queries feed maps, dashboards, exports, and API consumers.

No analytics query, export job, background task, media lookup, or record projection may operate without an explicit organization scope.

## 13. Solution Packs

A solution pack is versioned configuration plus guidance, not a separate application. It may include:

- Record types and fields.
- Evidence requirements.
- Review rules.
- Suggested assignments and collection frequency.
- Common dashboards and exports.
- Training and operating guidance.

Candidate packs include waste infrastructure, retail distribution, agriculture, roads and public infrastructure, water and sanitation, health-facility verification, and development-project monitoring.

No candidate pack enters implementation solely because it appears commercially attractive. A signed pilot or repeated validated demand selects the first pack.

## 14. Go-to-market

### 14.1 Initial customer profile

Target organizations need reliable visibility over distributed physical assets, locations, or field activity. Likely segments include environmental operators, FMCG distributors, telecom and mobile-money networks, development programs, agricultural organizations, municipalities, infrastructure operators, and market-research firms.

### 14.2 Sales motion

1. Warm introduction or focused outreach.
2. Problem and workflow discovery.
3. Data-gap diagnosis.
4. Configured demonstration with synthetic data.
5. Small paid field pilot with fixed geography, record target, deliverables, and completion date.
6. Results presentation tied to the client's operational decision.
7. Recurring platform, assisted, or managed-service agreement.

The sales message leads with the operational outcome. Platform features support the claim but do not replace it.

### 14.3 Commercial structure

The first contract is a fixed-scope paid pilot. Recurring commercial components may include:

- Platform subscription.
- Project setup and training.
- Active collector, project, or record usage.
- Quality-review service.
- Managed field-operation service.
- Enterprise API, dedicated infrastructure, and support upgrades.

Discovery may be free. Client-specific configuration, fieldwork, integration, and software development are paid.

## 15. Reliability and Failure Handling

- Drafts and submissions persist locally until server acknowledgement.
- Idempotency keys prevent duplicate events after retries.
- Existing drafts remain pinned to their schema version.
- Removed fields remain readable in historical records.
- Configuration changes apply only after a validated refresh.
- Invalid configuration cannot publish.
- Required evidence failures block submission or route it to review according to policy.
- Sync conflicts preserve original evidence and resolution history.
- Background jobs retry safely and enter a visible failed state after the retry limit.
- Dashboard and export surfaces show last-updated time, pending counts, rejected counts, failed sync counts, and incomplete-data warnings.
- Field capture continues during backend outages within offline queue capacity.

## 16. Security, Privacy, and Ownership

- Central authorization validates organization membership and project role for every operation.
- Database policies provide defense-in-depth tenant isolation.
- Media access uses protected authorization rather than globally public URLs.
- Exports require explicit permission and create audit events.
- Configuration changes and review decisions create audit events.
- Background jobs carry immutable organization and project scope.
- Retention, deletion, and export policies are configurable within contractual and legal requirements.
- Client data is not used for ADL products, model training, benchmarking, or cross-client analytics without explicit permission.
- Sensitive enterprise projects may later use dedicated database and storage infrastructure.

The highest-priority security invariant is: one organization can never access another organization's configuration, records, media, analytics, or exports.

## 17. Testing Strategy

### 17.1 Unit tests

- Schema definition and publishing validation.
- Dynamic field rendering and local validation.
- Evidence-rule evaluation.
- Role and permission decisions.
- Schema-version compatibility.

### 17.2 Integration tests

- Organization and project isolation.
- Submission, review, projection, and export lifecycle.
- Idempotent retry behavior.
- Protected media access.
- Tenant-scoped analytics and background jobs.

### 17.3 Offline tests

- Interrupted submission and photo upload.
- Reconnect and bounded retry.
- Queue capacity and permanent-failure behavior.
- Configuration refresh with existing drafts.
- Low-bandwidth synchronization.

### 17.4 End-to-end tests

- Owner creates organization and project.
- Manager publishes schema and assignment.
- Collector captures offline and synchronizes.
- Reviewer decides record.
- Viewer sees approved map record and exports it.
- Cross-tenant access attempts fail for records, media, dashboards, and exports.

### 17.5 Field acceptance

- Mid-range and low-end Android devices.
- Bright-sunlight readability.
- One-handed use and 48-pixel touch targets.
- English and French schemas and validation messages.
- Intermittent connectivity and device restart during collection.

## 18. Success Measures

### Validation phase

- Relevant customer conversations completed.
- Qualified design partners engaged.
- Written commercial commitment obtained.
- Repeated requirements identified across organizations.
- Paid-pilot decision cycle and objections documented.

### Pilot phase

- Time from signed scope to published collection project.
- Collector training time.
- Successful offline synchronization rate.
- Record completion and evidence-quality rate.
- Review turnaround time.
- Client acceptance of delivered dataset and outputs.
- Conversion from pilot to recurring agreement.

### Platform phase

- Time to configure a new project without code changes.
- Share of requirements satisfied through configuration.
- Active organizations and recurring revenue.
- Gross margin by self-operated, assisted, and managed mode.
- Tenant-isolation incidents: target zero.

## 19. Implementation Decision Gate

This specification authorizes customer validation work and preparation of neutral sales demonstrations. It does not authorize configurable-platform implementation before the validation gate in Section 8 is satisfied.

After written-spec approval, the next planning artifact must focus on **Phase 0 customer validation**, including interview assets, neutral demonstration scope, prospect tracking in `bd`, validation evidence, and the explicit decision checkpoint. A later implementation plan may cover the platform MVP only after commercial validation.
