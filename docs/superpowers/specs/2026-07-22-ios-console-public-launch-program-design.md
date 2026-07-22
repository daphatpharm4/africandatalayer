# ADL Console Public Launch Program Design

**Status:** Approved design

**Date:** 2026-07-22

**Source:** `docs/audits/2026-07-22-ios-console-system-design-audit.docx`

**Tracking:** `africandatalayer-axx`, discovered from `africandatalayer-9h9`

## Purpose

This program turns the system-design audit into a production implementation portfolio for the native SwiftUI app under `ios-console/`. The goal is an invitation-only, iPhone-only public App Store release that presents collector, reviewer, and administrator workflows with equal weight while treating collector data integrity as the reliability floor.

The program uses a foundation-first sequence. It improves the existing native application and `ConsoleCore` packages; it does not rewrite the product and does not change backend or platform API contracts.

## Approved product decisions

| Decision | Approved direction |
|---|---|
| Distribution | Public App Store after internal and external TestFlight gates |
| Positioning | Balanced collector, reviewer, and administrator data-operations product |
| Account lifecycle | Invitation-only; no public account or organization creation in v1 |
| Device family | iPhone-only public v1 |
| Storefronts | App Store-supported African countries whose principal product language is English or French |
| Localization | English and French UI, metadata, screenshots, review instructions, support, and privacy material |
| Offline authorization | A previously verified collector may create local records for 72 hours; privileged reviewer/admin mutations remain online-only |
| Failed data retention | Blocked, rejected, and retrying records are never automatically deleted |
| Acknowledged media | Remove protected local originals after verified server acknowledgement; keep a non-sensitive receipt and checksum |
| Backend scope | No backend or platform API changes |
| Persistence | GRDB over SQLite plus protected media files |
| Legacy queue | Atomic one-time migration with a rollback backup and verification |
| Observability | Apple-native `OSLog`, signposts, MetricKit, TestFlight diagnostics, and App Store Connect Analytics |
| Delivery policy | Reliability feature freeze through M2; unrelated feature work does not merge |

## Program outcomes

The program is complete when:

1. A captured record and every required photo are durable before any network request begins.
2. No retry, timeout, validation failure, authorization failure, age limit, or retry count silently deletes a record or its evidence.
3. A collector with a session verified within the previous 72 hours can relaunch offline, open the cached authorized workspace, and create records.
4. Reviewer and administrator cached content is visibly stale and read-only while offline; their mutations fail closed.
5. The application reports observed states such as Offline, Connecting, Pending, Syncing, Blocked, and Up to date instead of a cosmetic Connected label.
6. XcodeGen configuration, signing, endpoint selection, device family, documentation, and generated project files have one deterministic source of truth.
7. CI and release candidates prove unit, integration, migration, resilience, accessibility, performance, energy, archive, and static compliance gates.
8. App Review can sign in to a seeded organization and complete documented collector, reviewer, and administrator journeys.
9. The English and French product pages accurately describe the invitation-only product and show all three role journeys.

## Non-goals

- Backend endpoints, response schemas, authentication mechanisms, server-side media storage, and idempotency behavior are not changed.
- Public self-service registration, organization creation, password reset, and in-app account creation are excluded.
- iPad optimization and iPad App Store distribution are excluded from public v1.
- Multi-device conflict merging is excluded beyond the server's existing idempotent record-create behavior.
- Third-party analytics, advertising, attribution, tracking, and crash-reporting SDKs are excluded.
- Full offline reviewer and administrator mutations are excluded.
- Unrelated product features and broad UI refactors are excluded during the reliability freeze.

## Portfolio decomposition

### Subproject 1: Capture Integrity Foundation

Creates the GRDB record ledger, protected media vault, real schema-photo capture, existing-payload submission adapter, lossless state machine, recovery UI, and atomic legacy JSON migration.

Design: `docs/superpowers/specs/2026-07-22-ios-console-capture-integrity-design.md`

Tracks: `africandatalayer-c1l`, `africandatalayer-c0k`

### Subproject 2: Offline Runtime

Creates cached authorization and workspace snapshots, the 72-hour role policy, connectivity monitoring, lifecycle-driven synchronization, truthful shell status, and sign-out locking behavior.

Design: `docs/superpowers/specs/2026-07-22-ios-console-offline-runtime-design.md`

Tracks: `africandatalayer-60t`

### Subproject 3: Release Configuration

Makes XcodeGen authoritative, introduces explicit build environments, removes hard-coded production configuration and stale documentation, selects iPhone-only distribution, and adds drift/archive checks.

Design: `docs/superpowers/specs/2026-07-22-ios-console-release-configuration-design.md`

Tracks: `africandatalayer-61m`

### Subproject 4: Operational Readiness

Adds privacy-safe telemetry, MetricKit diagnostics, CI, live-contract smoke tests, resilience tests, UI tests, and measurable performance, memory, energy, accessibility, reliability, and sync gates.

Design: `docs/superpowers/specs/2026-07-22-ios-console-operational-readiness-design.md`

Tracks: `africandatalayer-x0p`

### Subproject 5: Public App Store Launch

Builds the invitation-only onboarding and review path, localized balanced product pages, screenshots, privacy/support material, review accounts, TestFlight pilot, storefront configuration, and release decision runbook.

Design: `docs/superpowers/specs/2026-07-22-ios-console-public-app-store-launch-design.md`

Tracks: `africandatalayer-crw`

## Dependency and delivery order

```text
Capture Integrity Foundation
          |
          v
    Offline Runtime ------------------+
          |                           |
          v                           v
    Internal TestFlight        Operational Readiness
          |                           ^
          +------ Release Configuration
          |
          v
    Public App Store Launch
```

Capture Integrity defines the durable record and media contracts consumed by Offline Runtime. Release Configuration may begin after those contracts are named, but it must not alter in-progress user source changes outside its declared files. Operational Readiness instruments the approved repositories and SyncEngine rather than temporary queue code. Public launch work begins after M0 and M1 behavior is stable so screenshots and claims reflect real functionality.

## Shared architecture

### Role surfaces

SwiftUI screens render observable state and send user intent. They do not own persistence, authorization expiry, connectivity inference, retry scheduling, or API error classification.

The public product contains three role surfaces:

- Collector: map, capture, evidence, pending work, recovery, and submission status.
- Reviewer: review queue, evidence inspection, and online authorization for decisions.
- Administrator: projects, schemas, members, organization settings, and online authorization for mutations.

### Feature and repository boundaries

The design introduces or formalizes these responsibilities:

- `AppEnvironment`: validated build channel, HTTPS base URL, timeout policy, feature switches, and release identity.
- `SessionRepository`: Auth.js cookie-session lifecycle and explicit online, offline-authorized, expired, and signed-out states.
- `WorkspaceRepository`: owner-scoped organization, role, project, schema, and bounded read snapshots.
- `CaptureCoordinator`: capture validation, media acquisition, durable commit, and user-facing submit state.
- `RecordLedger`: GRDB-backed record state, attempts, errors, acknowledgements, discard receipts, and migration journal.
- `CaptureMediaStore`: protected prepared media files, checksums, metadata, lookup, and acknowledgement cleanup.
- `SyncEngine`: an actor that schedules and serializes due submissions, classifies results, and publishes progress.
- `ConnectivityMonitor`: `NWPathMonitor`-backed path hints combined with API and session outcomes.
- `TelemetryClient`: privacy-safe structured logs, signposts, and MetricKit integration.

Each boundary is protocol-driven where tests or previews need substitution. App-specific Apple framework adapters stay in the application target; portable record, state, and API contracts stay in `ConsoleCore`.

### Existing backend boundary

`NetworkAuthService` remains the Auth.js cookie implementation. `PlatformAPIClient.createPlatformRecord` remains the record-create boundary with its existing JSON body, photo strings, and `Idempotency-Key` header.

The client stores prepared photo bytes as protected files. Only when a send begins does a submission adapter resolve local attachment IDs, produce the existing data-URL strings for schema-photo values and record evidence, and call `createPlatformRecord`. Hydrated data URLs are transient and are not written back into GRDB.

## Shared invariants

1. Persistence completes before the first network side effect.
2. A record or attachment is removed only after verified acknowledgement or explicit confirmed discard.
3. The original idempotency key survives retry, relaunch, migration, and app upgrade.
4. Schema version, record type, organization, project, user, role, and capture timestamp travel with the local record.
5. Network reachability is a scheduling hint; the last API/session outcome determines server and authorization state.
6. A background opportunity may accelerate synchronization but is never the only path to delivery.
7. Signing out immediately clears local auth while retaining and locking pending evidence to its original user and organization.
8. Telemetry never records field values, notes, coordinates, photos, cookies, passwords, email addresses, or access tokens.
9. English and French behavior is tested at the product boundary; translations are product content, not developer comments.
10. Public metadata and screenshots never claim behavior that has not passed its release gate.

## Milestones and gates

| Milestone | Deliverable | Exit evidence |
|---|---|---|
| M0 — Integrity | Real photos, GRDB ledger, media vault, migration, blocked recovery | Zero silent-loss paths; all terminal records recoverable or explicitly discarded; legacy migration rollback verified |
| M1 — Offline runtime | Workspace snapshot, 72-hour policy, connectivity status, SyncEngine | Cold-start offline collector flow passes; reconnect sends with stable idempotency; role matrix enforced |
| M2 — Release system | Environments, iPhone-only configuration, CI, telemetry, device budgets | Deterministic XcodeGen; validated Release archive; required automated and device gates pass |
| M3 — TestFlight | Seeded demo organization, internal and external invited pilots, support runbook | Seven consecutive pilot days without a Sev-1 or Sev-2 integrity defect; recovery and rollback drills pass |
| M4 — Public launch | EN/FR balanced listing and public availability in the approved African storefront set | App Review passes; review walkthrough succeeds; privacy/support links are live; owner signs release gate |

## Program-level quality targets

- Zero known record or evidence loss defects.
- One hundred percent of terminal records are recoverable, exportable, or explicitly user-discarded.
- At least 95% of pending records are acknowledged within five minutes after connectivity returns, excluding records visibly blocked on user action.
- More than 99.5% crash-free sessions during the external TestFlight gate.
- Cold-launch p95 under three seconds to an actionable cached shell on the oldest supported test device.
- Typical active memory below 100 MB during the capture-map-review loop.
- Active field-session energy use below 5% battery per hour under the defined test script.
- No critical VoiceOver, Dynamic Type, contrast, reduced-motion, or 44-point target failures in English or French.

These are release targets to be measured by the Operational Readiness subproject; they are not claims about the current build.

## Ownership and review

- Mobile engineering owns repository contracts, GRDB, media, SyncEngine, SwiftUI integration, and device budgets.
- Backend/platform owns staging availability and confirmation that the unchanged API contract remains live during tests and review; no implementation change is requested.
- Product owns role priorities, explicit discard behavior, invitation-only copy, supported storefronts, and milestone promotion.
- Design/ASO owns balanced screenshots, English/French metadata, accessibility review, and product-page experiments after launch.
- QA/release owns CI evidence, TestFlight cohorts, archive validation, review credentials, runbooks, and rollback drills.

## Change-management rules

- The working tree already contains user-owned changes in authentication, capture, app state, and related tests. Implementers must inspect and preserve those changes; plans must never assume a clean checkout or overwrite them.
- Each subproject uses its linked Beads issue for status and discovered work.
- Each implementation task ends with a focused test cycle and a small commit.
- A milestone is promoted only from evidence recorded in the relevant Beads issue or release runbook.
- Reliability feature freeze ends only after the M2 owner gate passes.

## Approval record

The user approved the foundation-first portfolio, component boundaries, lossless state machine, 72-hour offline policy, role capability matrix, quality budgets, balanced public positioning, and six-document specification package during the brainstorming session on 2026-07-22.
