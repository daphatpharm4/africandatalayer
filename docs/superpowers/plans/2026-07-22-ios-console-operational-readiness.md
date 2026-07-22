# ADL Console Operational Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce privacy-safe, repeatable evidence that the exact iPhone release candidate meets integrity, sync, reliability, performance, energy, accessibility, configuration, and compliance gates.

**Architecture:** Application boundaries emit semantic events through `TelemetryClient`; production maps them to OSLog/signposts and MetricKit while tests record them in memory. Repository scripts and macOS CI run deterministic fast, resilience, UI, staging-contract, compliance, and archive gates; physical-device results are recorded in release evidence.

**Tech Stack:** Swift 6, OSLog, MetricKit, XCTest/XCUITest, Instruments/xctrace, GitHub Actions, XcodeGen, Greenlight, TestFlight/App Store diagnostics.

**Spec:** `docs/superpowers/specs/2026-07-22-ios-console-operational-readiness-design.md`

## Global Constraints

- Depends on final Capture Integrity, Offline Runtime, and Release Configuration interfaces.
- Tracking issue: `africandatalayer-x0p`.
- Never log email, names, organization names, free text, schema/field values, coordinates, addresses, media/metadata, data URLs, sensitive paths, cookies, CSRF tokens, passwords, access tokens, or response bodies.
- No third-party analytics or crash SDK.
- Release budgets: zero known silent loss; 95% acknowledged within five minutes after reconnect excluding visible blocks; >99.5% crash-free; cold launch p50 <2s/p95 <3s; typical active memory <100 MB; field script <5% battery/hour; zero critical accessibility failures.
- A target that cannot be measured blocks release; it is not silently waived.

---

### Task 1: Add privacy-safe semantic telemetry

**Files:**
- Create: `ios-console/ADLConsole/Telemetry/TelemetryClient.swift`
- Create: `ios-console/ADLConsole/Telemetry/OSLogTelemetryClient.swift`
- Create: `ios-console/ADLConsoleTests/TelemetryPrivacyTests.swift`
- Modify: `ios-console/ADLConsole/State/AppState.swift`
- Modify: `ios-console/ADLConsole/Runtime/SyncEngine.swift`
- Modify: `ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/RecordLedger.swift`

**Interfaces:**
- Produces: `TelemetryEvent`, `TelemetryValue`, `TelemetryClient.emit/measure`, and `InMemoryTelemetryClient`.

- [ ] **Step 1: Write failing privacy tests**

```swift
func testEventRejectsProhibitedKeysAndValues() {
    XCTAssertThrowsError(try TelemetryEvent(name: "capture", fields: ["email": .string("a@b.com")]))
    XCTAssertThrowsError(try TelemetryEvent(name: "sync", fields: ["coordinates": .string("4.0,9.7")]))
    XCTAssertNoThrow(try TelemetryEvent(name: "sync.attempt", fields: ["result": .string("network"), "count": .integer(2)]))
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole-Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/TelemetryPrivacyTests`
Expected: FAIL because telemetry types are undefined.

- [ ] **Step 3: Implement allowlisted events/fields**

```swift
enum TelemetryValue: Equatable, Sendable { case string(String), integer(Int), durationMilliseconds(Int), byteBucket(String) }
struct TelemetryEvent: Equatable, Sendable {
    let name: String
    let fields: [String: TelemetryValue]
    init(name: String, fields: [String: TelemetryValue]) throws {
        let allowed = Set(["result", "class", "trigger", "state", "count", "attempt", "duration_ms", "byte_bucket", "channel", "version"])
        guard Set(fields.keys).isSubset(of: allowed) else { throw TelemetryError.prohibitedField }
        self.name = name; self.fields = fields
    }
}
protocol TelemetryClient: Sendable { func emit(_ event: TelemetryEvent); func begin(_ name: String) -> TelemetryInterval }
```

Map lifecycle/auth/capture/sync/storage/API events from the spec to fixed names and allowlisted enums/counts. OSLog uses subsystem from `AppEnvironment.telemetryPrefix`, private-by-default interpolation, and signposts for launch, durable commit, API, and drain latency.

- [ ] **Step 4: Run privacy and boundary tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole-Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/TelemetryPrivacyTests -only-testing:ADLConsoleTests/SyncEngineTests`
Expected: pass; representative secret/content fixtures never appear in rendered test output.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Telemetry ios-console/ADLConsole/State/AppState.swift ios-console/ADLConsole/Runtime/SyncEngine.swift ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/RecordLedger.swift ios-console/ADLConsoleTests/TelemetryPrivacyTests.swift
git commit -m "feat: add privacy safe ios telemetry"
```

---

### Task 2: Process MetricKit diagnostics off the launch path

**Files:**
- Create: `ios-console/ADLConsole/Telemetry/MetricKitReporter.swift`
- Create: `ios-console/ADLConsole/Telemetry/MetricSummaryStore.swift`
- Create: `ios-console/ADLConsoleTests/MetricKitReporterTests.swift`
- Modify: `ios-console/ADLConsole/ADLConsoleApp.swift`

**Interfaces:**
- Produces: `MetricSummary`, `MetricSummaryStoring`, and one `MXMetricManagerSubscriber`.

- [ ] **Step 1: Write failing payload-summary test**

```swift
func testProcessorStoresOnlyBoundedSummary() async throws {
    await reporter.process(TestMetricPayload.crashAndLaunch)
    let summary = try await store.latest()
    XCTAssertEqual(summary?.crashCount, 1)
    XCTAssertNotNil(summary?.launchHistogram)
    XCTAssertLessThan(try JSONEncoder().encode(summary).count, 64_000)
    XCTAssertFalse(String(data: try JSONEncoder().encode(summary), encoding: .utf8)!.contains("payloadRepresentation"))
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole-Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/MetricKitReporterTests`
Expected: FAIL because reporter types are undefined.

- [ ] **Step 3: Implement bounded summaries**

```swift
struct MetricSummary: Codable, Equatable, Sendable {
    let periodStart: Date
    let periodEnd: Date
    let crashCount: Int
    let hangCount: Int
    let peakMemoryMB: Double?
    let cumulativeCPUSeconds: Double?
    let cumulativeEnergy: Double?
    let launchHistogram: [String: Int]?
}
```

Register once after the cached shell is ready, process payloads on a utility task, retain the newest 10 summaries under Application Support with data protection, and never store raw payload JSON in the ledger or block launch.

- [ ] **Step 4: Run tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole-Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/MetricKitReporterTests`
Expected: summary, retention, malformed payload, and non-blocking registration tests pass.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Telemetry/MetricKitReporter.swift ios-console/ADLConsole/Telemetry/MetricSummaryStore.swift ios-console/ADLConsole/ADLConsoleApp.swift ios-console/ADLConsoleTests/MetricKitReporterTests.swift
git commit -m "feat: summarize ios metrickit diagnostics"
```

---

### Task 3: Add deterministic resilience and live-contract suites

**Files:**
- Create: `ios-console/ADLConsoleTests/Support/FaultInjectors.swift`
- Create: `ios-console/ADLConsoleTests/CaptureResilienceTests.swift`
- Create: `ios-console/ADLConsoleTests/StagingContractSmokeTests.swift`
- Create: `ios-console/Scripts/run_resilience_gate.sh`
- Create: `ios-console/Scripts/run_staging_smoke.sh`

**Interfaces:**
- Produces: deterministic failure points and secret-gated live Staging smoke.

- [ ] **Step 1: Write the no-loss chaos matrix**

```swift
func testEveryCrashPointRetainsOrAcknowledgesRecord() async throws {
    for point in FailurePoint.allCases {
        let system = try TestCaptureSystem(failurePoint: point)
        await system.runOneCaptureAndRelaunch()
        let record = try await system.ledger.record(localID: "r1")
        XCTAssertNotNil(record, "lost at \(point)")
        XCTAssertTrue(record!.state == .acknowledged || record!.state.isRecoverable)
    }
}
```

- [ ] **Step 2: Run and verify at least one unsupported failure point fails**

Run: `bash ios-console/Scripts/run_resilience_gate.sh`
Expected: FAIL before all fault injectors and recovery assertions exist.

- [ ] **Step 3: Implement exact fault set and staging smoke guard**

```swift
enum FailurePoint: CaseIterable { case afterMediaWrite, afterLedgerCommit, duringSend, afterResponse, beforeAcknowledgement, diskFull, unreadableMedia, checksumMismatch, migrationInterrupted, clockRollback }
```

The resilience script runs ledger/migration/media/sync suites with queue sizes 1 and 75. The staging script requires `ADL_STAGING_EMAIL`, `ADL_STAGING_PASSWORD`, and `ADL_STAGING_ORG_ID`; it signs in, restores session, creates one fixture record with a unique idempotency key, confirms the response, signs out, redacts command output, and exits 77 when secrets are intentionally unavailable locally.

- [ ] **Step 4: Run resilience and an authorized staging smoke**

Run: `bash ios-console/Scripts/run_resilience_gate.sh && bash ios-console/Scripts/run_staging_smoke.sh`
Expected: resilience exits 0; staging exits 0 on authorized release CI or 77 on a developer machine without secrets.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsoleTests/Support ios-console/ADLConsoleTests/CaptureResilienceTests.swift ios-console/ADLConsoleTests/StagingContractSmokeTests.swift ios-console/Scripts/run_resilience_gate.sh ios-console/Scripts/run_staging_smoke.sh
git commit -m "test: add ios resilience and staging gates"
```

---

### Task 4: Add role, offline, permission, localization, and accessibility UI gates

**Files:**
- Create: `ios-console/ADLConsoleUITests/RoleJourneyUITests.swift`
- Create: `ios-console/ADLConsoleUITests/RecoveryAccessibilityUITests.swift`
- Create: `ios-console/ADLConsoleUITests/PermissionUITests.swift`
- Create: `ios-console/ADLConsoleUITests/Support/UITestSeed.swift`
- Modify: `ios-console/project.yml`
- Create: `ios-console/Scripts/run_ui_gate.sh`

**Interfaces:**
- Produces: deterministic launch arguments `-uiTestRole`, `-uiTestLocale`, `-uiTestConnectivity`, and `-uiTestSeed` available only in UI-test builds.

- [ ] **Step 1: Write the required journey test**

```swift
func testFrenchOfflineCollectorCanRecoverBlockedRecordAtAccessibilitySize() {
    let app = XCUIApplication()
    app.launchArguments = ["-uiTestRole", "collector", "-uiTestLocale", "fr", "-uiTestConnectivity", "offline", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
    app.launch()
    XCTAssertTrue(app.staticTexts["Hors ligne"].waitForExistence(timeout: 3))
    app.buttons["Travail en attente"].tap()
    XCTAssertTrue(app.buttons["Exporter"].isHittable)
    XCTAssertTrue(app.buttons["Supprimer"].isHittable)
}
```

- [ ] **Step 2: Run and verify failure**

Run: `bash ios-console/Scripts/run_ui_gate.sh`
Expected: FAIL until the UI-test target/seeds and stable accessibility identifiers exist.

- [ ] **Step 3: Implement deterministic UI-test wiring**

Add `ADLConsoleUITests` to XcodeGen; seed collector/reviewer/admin, pending/blocked states, permission grant/deny/cancel, offline/connecting/syncing, and EN/FR only under `-uiTesting YES`. Tests assert 44-point hit regions, VoiceOver labels/order, accessibility text sizes, reduced motion, and all critical recovery controls.

- [ ] **Step 4: Run UI gate**

Run: `bash ios-console/Scripts/run_ui_gate.sh`
Expected: every role, permission, status, EN/FR, Dynamic Type, VoiceOver-label, and reduced-motion scenario passes.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsoleUITests ios-console/project.yml ios-console/ADLConsole.xcodeproj ios-console/Scripts/run_ui_gate.sh
git commit -m "test: gate ios role and accessibility journeys"
```

---

### Task 5: Measure launch, memory, sync, and energy budgets

**Files:**
- Create: `ios-console/ADLConsoleTests/PerformanceBudgetTests.swift`
- Create: `ios-console/Scripts/run_performance_gate.sh`
- Create: `ios-console/Scripts/run_energy_protocol.sh`
- Create: `docs/release/device-quality-protocol.md`

**Interfaces:**
- Produces: `.xcresult`, Instruments traces, and machine-readable budget summary.

- [ ] **Step 1: Add failing launch/memory metric tests**

```swift
func testColdLaunchToCachedShell() throws {
    measure(metrics: [XCTApplicationLaunchMetric(waitUntilResponsive: true)]) { XCUIApplication().launch() }
}

func testSeventyFiveRecordDrainMemory() throws {
    measure(metrics: [XCTMemoryMetric(), XCTClockMetric()]) { try fixture.drain(recordCount: 75) }
}
```

- [ ] **Step 2: Run the performance gate and capture baseline failure**

Run: `bash ios-console/Scripts/run_performance_gate.sh`
Expected: script records measurements and fails any budget currently exceeded.

- [ ] **Step 3: Implement scripts and protocol**

The performance script runs five iterations, exports `.xcresult`, and fails p50 launch >=2s, p95 >=3s, or median active memory >=100 MB. The physical-device protocol names the device/OS/battery health, fixtures, airplane/network profile, one-hour field sequence, Instruments template, thermal start/end, and requires battery decrease <5 percentage points.

- [ ] **Step 4: Run on simulator and two physical-device classes**

Run: `bash ios-console/Scripts/run_performance_gate.sh && bash ios-console/Scripts/run_energy_protocol.sh --device oldest-supported && bash ios-console/Scripts/run_energy_protocol.sh --device current-reference`
Expected: scripts exit 0 and write dated results under `docs/release/evidence/device/`.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsoleTests/PerformanceBudgetTests.swift ios-console/Scripts/run_performance_gate.sh ios-console/Scripts/run_energy_protocol.sh docs/release/device-quality-protocol.md docs/release/evidence/device
git commit -m "test: enforce ios device quality budgets"
```

---

### Task 6: Assemble CI, runbooks, and the release gate

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `ios-console/Scripts/release_gate.sh`
- Create: `docs/release/runbooks/migration-recovery.md`
- Create: `docs/release/runbooks/blocked-record.md`
- Create: `docs/release/runbooks/staging-outage.md`
- Create: `docs/release/runbooks/diagnostics-triage.md`
- Create: `docs/release/runbooks/rollback.md`
- Create: `docs/release/runbooks/privacy-incident.md`

**Interfaces:**
- Produces: PR/release-candidate jobs, Sev-1/Sev-2 decision gates, and executable recovery ownership.

- [ ] **Step 1: Write release-gate script assertions**

```bash
#!/usr/bin/env bash
set -euo pipefail
configuration="Release"
evidence="docs/release/evidence/m2-release-system.md"
while (( $# )); do
  case "$1" in
    --configuration) configuration="$2"; shift 2 ;;
    --evidence) evidence="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
bash ios-console/Scripts/check_xcodegen_drift.sh
swift test --package-path ios-console/Packages/ConsoleCore
bash ios-console/Scripts/run_resilience_gate.sh
bash ios-console/Scripts/run_ui_gate.sh
bash ios-console/Scripts/run_performance_gate.sh
plutil -lint ios-console/ADLConsole/PrivacyInfo.xcprivacy
greenlight preflight ios-console --exit-code
xcodebuild build -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -configuration "$configuration" -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO
mkdir -p "$(dirname "$evidence")"
test -f "$evidence"
rg -q '^Owner decision: GO$' "$evidence"
```

- [ ] **Step 2: Run and verify any missing gate fails**

Run: `bash ios-console/Scripts/release_gate.sh --configuration Release --evidence docs/release/evidence/m2-release-system.md`
Expected: FAIL until every preceding script/evidence input exists.

- [ ] **Step 3: Add CI stages and exact runbook structure**

PR CI runs generation, packages, simulator, focused resilience, Release compile, privacy, and Greenlight. Main/release CI additionally runs staging smoke, full chaos/UI, archives `.xcresult`, and leaves signed archive/TestFlight promotion to the authorized release machine. Every runbook contains `Trigger`, `Severity`, `Owner`, `Immediate containment`, `Commands`, `Evidence`, `Recovery validation`, and `Beads link`.

- [ ] **Step 4: Execute the complete M2 gate**

Run: `bash ios-console/Scripts/release_gate.sh --configuration Release --evidence docs/release/evidence/m2-release-system.md`
Expected: exit 0 and evidence includes `Owner decision: GO`; any Sev-1 or Sev-2 produces exit 1.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml ios-console/Scripts/release_gate.sh docs/release/runbooks docs/release/evidence/m2-release-system.md
git commit -m "ci: establish ios release evidence gate"
```
