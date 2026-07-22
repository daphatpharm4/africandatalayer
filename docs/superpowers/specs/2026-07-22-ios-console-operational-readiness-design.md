# ADL Console Operational Readiness Design

**Status:** Approved subproject design

**Program:** `docs/superpowers/specs/2026-07-22-ios-console-public-launch-program-design.md`

**Depends on:** Capture Integrity contracts, Offline Runtime state, and Release Configuration channels

**Tracking:** `africandatalayer-x0p`

## Objective

Create privacy-safe evidence that the iPhone application meets its data-integrity, synchronization, reliability, performance, energy, accessibility, configuration, and App Store gates. The system uses Apple-native diagnostics and repository-owned CI; it adds no third-party analytics or crash SDK.

## Scope

This subproject delivers:

- Structured `OSLog` categories and signposts behind a testable telemetry interface.
- MetricKit payload collection and privacy-safe diagnostic summaries.
- CI for XcodeGen drift, ConsoleCore, iOS simulator, migration/resilience, UI/accessibility, Release compile, and Greenlight.
- Live Staging contract smoke tests for Auth.js and the unchanged record-create request.
- Launch, memory, image/media, map, queue, and energy performance scripts.
- Release dashboards/runbooks using TestFlight diagnostics and App Store Connect Analytics.
- Formal Sev-1/Sev-2 definitions, triage ownership, recovery drills, and milestone evidence.

It does not collect behavioral profiles, raw user content, precise location, photo data, cookies, credentials, or third-party device identifiers.

## Telemetry architecture

### TelemetryClient

Application code emits semantic events through a small `TelemetryClient` protocol. Production uses Apple unified logging and signposts; tests use an in-memory recorder.

Required event families:

- App lifecycle: launch start, cached shell ready, online verification ready, foreground refresh, background expiration.
- Authentication: restore outcome class, sign-in outcome class, sign-out, offline authorization entry/expiry; no email or cookie values.
- Capture: validation outcome, attachment preparation outcome, durable commit latency, discard confirmation; no field values or media.
- Synchronization: trigger class, claimed count, attempt result class, retry delay bucket, blocked class, acknowledgement latency.
- Storage: migration version/outcome, record/media counts, byte buckets, corruption/quarantine class, cleanup outcome.
- API: endpoint operation name, method, status class, latency, timeout/transport class; no URL query/body or response content.
- UI quality: role surface, accessibility test build flag, notification opt-in outcome; no interaction-level tracking in production.

### Privacy rules

Logs may contain generated local diagnostic IDs only when they cannot be correlated outside the device. They may contain counts, durations, byte-size buckets, state enums, build/channel, and stable error classes.

Logs must not contain:

- Email addresses, names, organization names, or free text.
- Record field keys paired with values, notes, or schema content.
- Coordinates, addresses, map positions, or photo metadata.
- Data URLs, file paths containing user data, cookies, CSRF tokens, passwords, or access tokens.
- Complete server error bodies when they may echo submitted content.

Privacy tests inspect representative log output and fail on prohibited fixtures.

### MetricKit

The application registers one `MXMetricManagerSubscriber` and stores only processed summaries needed for triage. It supports crash, hang, CPU, memory, disk-write, launch, and energy review where the OS supplies those payloads.

MetricKit processing must not block launch or write large raw payloads into the capture ledger. Diagnostics are routed to the release support workflow using Apple-provided TestFlight/App Store mechanisms and locally exportable summaries when required.

## CI design

### Pull request gate

The macOS CI job performs:

1. Dependency resolution with versions locked in `Package.resolved`.
2. XcodeGen generation and generated-project diff check.
3. `swift test` for `ios-console/Packages/ConsoleCore`.
4. `xcodebuild test` for `ADLConsole` on the pinned available iPhone simulator.
5. Focused migration, RecordLedger, media, session, and SyncEngine suites.
6. Release configuration compile with signing disabled.
7. Privacy manifest lint and Greenlight preflight.

No App Store credential is available to pull-request jobs.

### Main/release-candidate gate

In addition to the pull-request gate:

- Run live Staging Auth.js login/session/sign-out and record-create smoke with a dedicated non-production organization.
- Run a migration fixture matrix and queue chaos suite.
- Run UI tests for role routing, offline cold start, pending recovery, permission denial, English/French, and Dynamic Type.
- Produce an `.xcresult` bundle and human-readable release summary.
- Build a signed archive on the authorized release machine, validate it, and promote the exact build to TestFlight.

Staging credentials are stored in the CI secret store and never printed. The smoke organization is isolated from production data.

## Test layers

### Unit and contract

The existing 349-test baseline remains the fast layer. New tests cover all repository protocols, database migrations, state transitions, error classification, payload hydration, session availability, workspace expiry, and operational-status derivation.

Existing `PlatformAPIClientTests` continue to prove the unchanged body and `Idempotency-Key` header.

### Resilience and chaos

Deterministic fault injectors cover:

- App termination after media write, after database commit, during sending, after response receipt, and before acknowledgement commit.
- Disk full, unreadable media, checksum mismatch, malformed legacy JSON, one malformed item, and interrupted migration.
- Offline/online flapping, timeouts, 5xx sequences, 401, 403, 422, delayed responses, and idempotent replay.
- Device clock forward/backward changes around the 72-hour boundary.
- Queue size 75 with maximum permitted attachments and concurrent UI refreshes.

Every scenario asserts that no non-acknowledged record or recoverable attachment disappears.

### UI and accessibility

Automated and manual checks cover:

- Collector, reviewer, and administrator landing/navigation.
- Onboarding and invitation-only sign-in explanation.
- Camera and PhotosPicker permission grant, denial, cancellation, and limited selection.
- Offline, Connecting, Pending, Syncing, Blocked, Up to date, and Reauthentication required states.
- Blocked record recovery, export, and destructive discard confirmation.
- English and French layouts at accessibility text sizes.
- VoiceOver labels/order, 44-point targets, contrast, reduced motion, and daylight readability.

### Performance and energy

Device scripts run on the oldest supported test iPhone available to the team and a current reference iPhone. Each script uses a documented data fixture and measures repeated runs.

Scenarios:

- Cold launch to cached actionable shell.
- Warm launch and foreground session verification.
- Capture with maximum schema fields, GPS, and maximum permitted photos.
- RecordLedger with 75 queued records and media.
- Offline-to-online drain under constrained network.
- Map browse with representative pin/image density.
- Capture-map-review navigation loop and memory warning.
- One-hour active field session with map, GPS fixes, camera preparation, and periodic sync.

## Quality budgets

| Signal | Required target | Measurement |
|---|---|---|
| Record integrity | Zero known silent loss; 100% terminal records recoverable or explicitly discarded | Chaos suite and recovery drill |
| Sync | At least 95% acknowledged within five minutes after reconnect, excluding visibly blocked records | Staging/TestFlight telemetry summary |
| Crash-free | More than 99.5% crash-free sessions | TestFlight/App Store diagnostics |
| Cold launch | p50 below two seconds and p95 below three seconds to actionable cached shell | XCTest metric/signposts on supported devices |
| Memory | Typical active footprint below 100 MB with no unbounded map/image/ledger growth | Instruments/XCTest metric |
| Energy | Active field script below 5% battery per hour | Physical-device energy run |
| Accessibility | No critical VoiceOver, Dynamic Type, contrast, reduced-motion, or target-size failures | Automated audit and EN/FR device walkthrough |
| Configuration | XcodeGen produces no unexpected diff | CI regeneration gate |
| Compliance | Greenlight, privacy lint, archive validation, and review-account smoke pass | Release-candidate evidence |

If a target cannot be measured reliably on the available hardware, the release remains blocked until the measurement method is agreed and documented; the target is not silently waived.

## Severity and release policy

### Sev-1

- Lost or inaccessible non-acknowledged record/evidence.
- Cross-user or cross-organization data exposure.
- Duplicate server records caused by client idempotency regression.
- Production build targeting a non-production or unapproved endpoint.
- App cannot launch or authenticated users cannot reach any role surface.

Any Sev-1 stops TestFlight promotion and public release.

### Sev-2

- Offline capture unavailable within the valid 72-hour window.
- Blocked records cannot be recovered/exported/discarded.
- Reviewer/admin mutation occurs without fresh online authorization.
- Persistent crash/hang in a core role journey.
- App Review demo journey or required privacy/support link fails.

M3 requires seven consecutive pilot days without an open or newly reproduced Sev-1/Sev-2 integrity defect.

## Runbooks

The release repository contains concise runbooks for:

- Migration failure and legacy backup recovery.
- Record blocked on authentication, authorization, validation, or storage.
- Staging/backend outage during TestFlight or App Review.
- Crash/hang triage from MetricKit/TestFlight.
- Build disable, phased-release pause, and rollback to the prior approved version.
- Privacy incident escalation without copying sensitive evidence into tickets or logs.

Runbooks reference Beads issue IDs for tracking and contain commands/evidence locations, not duplicate task lists.

## Acceptance gates

The subproject is complete when:

- Pull requests run deterministic configuration, package, simulator, focused resilience, Release compile, privacy, and Greenlight gates.
- Release candidates run the live Staging contract smoke and produce reviewable results.
- Telemetry emits required state/latency/error evidence without prohibited data.
- MetricKit diagnostics are registered, processed, and covered by tests.
- The full quality-budget script has been executed on physical devices and results recorded.
- Severity definitions, owners, recovery drills, and rollback procedures are exercised before external TestFlight.
- The external TestFlight gate sustains the required seven-day stability window.

## Dependencies and handoff

Operational Readiness instruments the final Capture Integrity and Offline Runtime boundaries and consumes Release Configuration's Staging/Release channels. It produces the evidence package required by Public App Store Launch.
