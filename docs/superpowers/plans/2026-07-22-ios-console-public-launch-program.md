# ADL Console Public Launch Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an invitation-only, iPhone-only public App Store release of ADL Console through the approved M0–M4 reliability gates.

**Architecture:** Execute five bounded plans in dependency order: Capture Integrity establishes durable records/media, Offline Runtime consumes those contracts, Release Configuration makes builds deterministic, Operational Readiness proves M0–M2, and Public App Store Launch promotes the exact proven build. The backend and `PlatformAPIClient.createPlatformRecord` contract remain unchanged.

**Tech Stack:** Swift 6, SwiftUI, iOS 17+, GRDB 7.10.0/SQLite, XCTest/XCUITest, XcodeGen, OSLog, MetricKit, GitHub Actions, Greenlight, App Store Connect, TestFlight.

**Spec:** `docs/superpowers/specs/2026-07-22-ios-console-public-launch-program-design.md`

## Global Constraints

- Public v1 is iPhone-only, portrait, iOS 17.0 or later, invitation-only, and balanced across collector, reviewer, and administrator roles.
- The API hostname, Auth.js handshake, request/response schemas, and `PlatformAPIClient.createPlatformRecord` body/header contract do not change.
- Persist a record and its prepared attachments before the first network side effect.
- Never automatically delete non-acknowledged records or recoverable media because of age, retry count, validation, authentication, authorization, storage, or unknown failure.
- Previously verified collectors may create local records offline for 72 hours; reviewer and administrator mutations require fresh online authorization.
- Use only one new production dependency: `https://github.com/groue/GRDB.swift.git` pinned to exact version `7.10.0`.
- Observability is Apple-native; do not add analytics, attribution, advertising, tracking, or crash-reporting SDKs.
- UI, accessibility, metadata, screenshots, support, privacy, and review instructions ship in English and French.
- Preserve all user-owned working-tree edits. Before each task, inspect `git status --short` and `git diff -- <listed paths>`; never restore or overwrite an existing edit.
- Track work only in Beads. Claim the linked issue before implementation and link discovered work with `discovered-from:<issue-id>`.
- Reliability feature freeze remains in force until the M2 owner gate passes.

---

### Task 1: Establish the execution baseline

**Files:**
- Read: `docs/superpowers/specs/2026-07-22-ios-console-*-design.md`
- Read: `docs/superpowers/plans/2026-07-22-ios-console-*.md`
- Evidence: Beads issues `africandatalayer-c1l`, `africandatalayer-c0k`, `africandatalayer-60t`, `africandatalayer-61m`, `africandatalayer-x0p`, `africandatalayer-crw`

**Interfaces:**
- Consumes: approved six-spec design portfolio at commit `814a6e4`.
- Produces: a claimed, dependency-ordered execution portfolio with a recorded clean baseline.

- [ ] **Step 1: Confirm the approved specification commit is present**

Run: `git merge-base --is-ancestor 814a6e4 HEAD`
Expected: exit 0 with no output.

- [ ] **Step 2: Record and preserve current user changes**

Run: `git status --short && git diff --stat`
Expected: existing edits are listed; no cleanup, restore, or reset is performed.

- [ ] **Step 3: Confirm all six delivery issues exist**

Run: `for id in c1l c0k 60t 61m x0p crw; do bd show "africandatalayer-$id" --json >/dev/null || exit 1; done`
Expected: exit 0.

- [ ] **Step 4: Capture the baseline tests**

Run: `cd ios-console/Packages/ConsoleCore && swift test`
Expected: all existing ConsoleCore tests pass before M0 work begins.

- [ ] **Step 5: Record baseline evidence**

Run: `bd update africandatalayer-c0k --claim --notes "Baseline captured from commit $(git rev-parse --short HEAD); existing working-tree edits inspected and preserved; ConsoleCore baseline green." --json`
Expected: issue status is `in_progress` and owned by the current user.

---

### Task 2: Deliver M0 — Capture Integrity

**Files:**
- Execute: `docs/superpowers/plans/2026-07-22-ios-console-capture-integrity.md`
- Evidence: `docs/release/evidence/m0-integrity.md`

**Interfaces:**
- Consumes: existing capture, queue, Auth.js, and record-create behavior.
- Produces: `RecordLedger`, `CaptureMediaStore`, `CaptureCoordinator`, `ExistingPayloadSubmissionAdapter`, migration receipts, and `RecordLedgerSnapshot`.

- [ ] **Step 1: Execute every Capture Integrity task in order**

Run: `rg -n '^### Task|^- \[ \]' docs/superpowers/plans/2026-07-22-ios-console-capture-integrity.md`
Expected: task checklist is visible before execution begins.

- [ ] **Step 2: Run the package integrity suite**

Run: `cd ios-console/Packages/ConsoleCore && swift test --filter 'RecordLedger|LegacyQueueMigration|RecordSubmissionAdapter'`
Expected: all focused M0 package tests pass.

- [ ] **Step 3: Run app capture and recovery tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/CaptureCoordinatorTests -only-testing:ADLConsoleTests/CaptureMediaStoreTests -only-testing:ADLConsoleTests/PendingWorkViewModelTests`
Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 4: Write M0 evidence**

Create `docs/release/evidence/m0-integrity.md` with the exact headings `Build`, `Ledger transitions`, `Migration fixtures`, `Media cleanup ordering`, `Recovery drill`, and `Open defects`; populate each with command output locations and Beads IDs, using `None` rather than an empty section.

- [ ] **Step 5: Close both M0 Beads only after the gate passes**

Run: `for id in africandatalayer-c1l africandatalayer-c0k; do bd close "$id" --reason "M0 passed: real photos, durable GRDB ledger/media, verified migration rollback, and no silent-loss transition." --json || exit 1; done`
Expected: both issues are closed.

---

### Task 3: Deliver M1 — Offline Runtime

**Files:**
- Execute: `docs/superpowers/plans/2026-07-22-ios-console-offline-runtime.md`
- Evidence: `docs/release/evidence/m1-offline-runtime.md`

**Interfaces:**
- Consumes: M0 ledger, media, adapter, and snapshot contracts.
- Produces: `SessionRepository`, `WorkspaceRepository`, `ConnectivityMonitor`, `SyncEngine`, and `OperationalStatusModel`.

- [ ] **Step 1: Claim the offline runtime issue**

Run: `bd update africandatalayer-60t --claim --json`
Expected: issue status is `in_progress`.

- [ ] **Step 2: Execute the Offline Runtime plan task-by-task**

Run: `rg -n '^### Task|^- \[ \]' docs/superpowers/plans/2026-07-22-ios-console-offline-runtime.md`
Expected: the complete checklist is visible.

- [ ] **Step 3: Prove the role/expiry matrix**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/SessionRepositoryTests -only-testing:ADLConsoleTests/OfflineRolePolicyTests -only-testing:ADLConsoleTests/SyncEngineTests`
Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 4: Record the cold-start/reconnect evidence**

Create `docs/release/evidence/m1-offline-runtime.md` with `72-hour authorization`, `Cold-start collector`, `Reviewer/admin fail-closed`, `Reconnect/idempotency`, `Sign-out lock`, and `Open defects` sections.

- [ ] **Step 5: Close the M1 issue**

Run: `bd close africandatalayer-60t --reason "M1 passed: 72-hour collector offline flow, privileged fail-closed policy, lifecycle sync, truthful status, and owner lock verified." --json`
Expected: issue is closed.

---

### Task 4: Deliver M2 — deterministic release system and evidence

**Files:**
- Execute: `docs/superpowers/plans/2026-07-22-ios-console-release-configuration.md`
- Execute: `docs/superpowers/plans/2026-07-22-ios-console-operational-readiness.md`
- Evidence: `docs/release/evidence/m2-release-system.md`

**Interfaces:**
- Consumes: stable M0/M1 runtime boundaries.
- Produces: deterministic environments/project generation, privacy-safe diagnostics, CI, staging smoke, resilience evidence, and device budgets.

- [ ] **Step 1: Claim both M2 issues**

Run: `bd update africandatalayer-61m --claim --json && bd update africandatalayer-x0p --claim --json`
Expected: both issues are `in_progress`.

- [ ] **Step 2: Execute Release Configuration before instrumentation wiring**

Run: `rg -n '^### Task|^- \[ \]' docs/superpowers/plans/2026-07-22-ios-console-release-configuration.md`
Expected: all release-configuration tasks are completed and separately committed.

- [ ] **Step 3: Execute Operational Readiness against final boundaries**

Run: `rg -n '^### Task|^- \[ \]' docs/superpowers/plans/2026-07-22-ios-console-operational-readiness.md`
Expected: telemetry and gates instrument `RecordLedger`, `SessionRepository`, and `SyncEngine`, not the legacy JSON queue.

- [ ] **Step 4: Run the M2 release gate**

Run: `bash ios-console/Scripts/release_gate.sh --configuration Release --evidence docs/release/evidence/m2-release-system.md`
Expected: exit 0; the evidence file records deterministic generation, tests, privacy lint, Greenlight, Release compile, and device-budget results.

- [ ] **Step 5: Close M2 and end the feature freeze only with owner sign-off**

Run: `for id in africandatalayer-61m africandatalayer-x0p; do bd close "$id" --reason "M2 passed and owner-approved: deterministic archive inputs, CI, telemetry privacy, resilience, accessibility, and device budgets recorded." --json || exit 1; done`
Expected: both issues close only after the evidence document contains `Owner decision: GO`.

---

### Task 5: Deliver M3/M4 — TestFlight and public launch

**Files:**
- Execute: `docs/superpowers/plans/2026-07-22-ios-console-public-app-store-launch.md`
- Evidence: `docs/release/evidence/m3-testflight.md`
- Evidence: `docs/release/evidence/m4-public-launch.md`

**Interfaces:**
- Consumes: the exact M2-approved archive and evidence package.
- Produces: EN/FR listing, review environment, invited pilots, App Review submission, manual phased public release, and measurement baseline.

- [ ] **Step 1: Claim the launch issue and execute its plan**

Run: `bd update africandatalayer-crw --claim --json && rg -n '^### Task|^- \[ \]' docs/superpowers/plans/2026-07-22-ios-console-public-app-store-launch.md`
Expected: issue is in progress and the complete launch checklist is visible.

- [ ] **Step 2: Record internal and external pilot evidence**

Create `docs/release/evidence/m3-testflight.md` with exact build/version, cohort counts by role, seven dated daily checks, migration/recovery drills, crash-free percentage, Sev-1/Sev-2 ledger, and `M3 decision: GO|NO-GO`.

- [ ] **Step 3: Submit the exact proven build for review**

Run: `git rev-parse HEAD && shasum -a 256 build/ADLConsole.xcarchive/Products/Applications/ADLConsole.app/ADLConsole`
Expected: commit and binary checksum match the M2/M3 evidence; no rebuild occurs after screenshot/review smoke.

- [ ] **Step 4: Record the manual public-release decision**

Create `docs/release/evidence/m4-public-launch.md` with App Review result, selected storefront export, privacy/support URL checks, phased-release state, rollback owner, baseline App Store metrics date, and `Owner decision: RELEASE|HOLD`.

- [ ] **Step 5: Close the portfolio**

Run: `bd close africandatalayer-crw --reason "M4 passed: approved build manually released to the selected EN/FR African storefronts with monitoring and rollback ownership active." --json`
Expected: launch issue is closed and `git status --branch --short` shows the branch synchronized with origin after the final documentation commit.

## Execution stop conditions

Stop promotion immediately for any open Sev-1, reproducible Sev-2 in a core role journey, unexplained generated-project drift, failed privacy/Greenlight/archive validation, missing review credentials, non-live support/privacy link, or metadata claim not demonstrated by the exact build. Record the stop in the active Beads issue; do not waive a gate by editing its target.
