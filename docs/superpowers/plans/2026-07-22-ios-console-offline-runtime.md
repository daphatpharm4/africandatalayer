# ADL Console Offline Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a previously verified collector relaunch and capture in the correct cached workspace for 72 hours offline while privileged mutations fail closed and durable work synchronizes from lifecycle/connectivity triggers.

**Architecture:** A typed auth restore result feeds `SessionRepository`; owner/org-scoped GRDB snapshots feed `WorkspaceRepository`; `ConnectivityMonitor` supplies only reachability hints; a single-drain `SyncEngine` owns submission scheduling. `AppState` composes these repositories and publishes one derived operational status to role surfaces.

**Tech Stack:** Swift 6, SwiftUI, GRDB/SQLite, Network.framework, BackgroundTasks, UserNotifications, XCTest/XCUITest.

**Spec:** `docs/superpowers/specs/2026-07-22-ios-console-offline-runtime-design.md`

## Global Constraints

- Depends on the completed Capture Integrity plan and its exact `RecordLedgerProtocol`, `RecordSubmitting`, and media contracts.
- Tracking issue: `africandatalayer-60t`.
- Offline authorization lasts exactly 72 hours from successful server session plus membership verification; clock rollback cannot extend it.
- Collector may create locally within the window; after expiry only inspect/export existing work. Reviewer/admin cached reads are visibly stale and all their mutations are disabled offline.
- `NWPathMonitor` is a scheduling hint and never independently means Connected or Up to date.
- Background execution is opportunistic; foreground and reconnect remain sufficient for correctness.
- Sign-out clears local cookies/capability synchronously and owner-locks snapshots/records/media without deletion.
- Do not request notification authorization at launch; default notification setting is off.

---

### Task 1: Preserve auth restore failure meaning

**Files:**
- Modify: `ios-console/ADLConsole/Auth/AuthService.swift`
- Modify: `ios-console/ADLConsole/Auth/NetworkAuthService.swift`
- Modify: `ios-console/ADLConsoleTests/NetworkAuthServiceTests.swift`
- Modify: `ios-console/ADLConsoleTests/MockAuthService.swift`

**Interfaces:**
- Produces: `AuthSessionRestoreResult` and `AuthSessionRestoring.restoreSession() async -> AuthSessionRestoreResult`.

- [ ] **Step 1: Write failing result-classification tests**

```swift
func testRestoreDistinguishesNoSessionFromTransportFailure() async {
    transport.enqueue(status: 200, json: #"{}"#)
    XCTAssertEqual(await service.restoreSession(), .noSession)
    transport.enqueue(error: URLError(.notConnectedToInternet))
    guard case .unavailable(.transport) = await service.restoreSession() else {
        return XCTFail("Expected transport unavailability")
    }
}

func testRestoreClassifiesServerAndUnauthorized() async {
    transport.enqueue(status: 503, json: #"{}"#)
    XCTAssertEqual(await service.restoreSession(), .unavailable(.server(status: 503)))
    transport.enqueue(status: 401, json: #"{}"#)
    XCTAssertEqual(await service.restoreSession(), .unauthorized)
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/NetworkAuthServiceTests`
Expected: FAIL because restore still returns an optional user.

- [ ] **Step 3: Implement the typed result**

```swift
enum AuthUnavailability: Equatable, Sendable {
    case transport
    case server(status: Int)
}

enum AuthSessionRestoreResult: Equatable, Sendable {
    case authenticated(AuthSessionUser)
    case noSession
    case unauthorized
    case unavailable(AuthUnavailability)
}

protocol AuthSessionRestoring: Sendable {
    func restoreSession() async -> AuthSessionRestoreResult
}
```

Make `fetchSessionUser` inspect HTTP status before decoding: 401 maps to `.unauthorized`, 5xx to `.unavailable(.server)`, transport errors to `.unavailable(.transport)`, 2xx without user to `.noSession`, and a decoded user to `.authenticated`. Do not persist passwords.

- [ ] **Step 4: Run auth tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/NetworkAuthServiceTests -only-testing:ADLConsoleTests/AppStateTests`
Expected: auth tests pass; AppState tests may fail only where they still expect the old optional protocol, identifying Task 3 integration points.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Auth ios-console/ADLConsoleTests/NetworkAuthServiceTests.swift ios-console/ADLConsoleTests/MockAuthService.swift
git commit -m "refactor: preserve auth restore outcomes"
```

---

### Task 2: Add owner-scoped workspace snapshots

**Files:**
- Create: `ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/WorkspaceSnapshot.swift`
- Create: `ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/WorkspaceRepository.swift`
- Modify: `ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/RecordDatabase.swift`
- Create: `ios-console/Packages/ConsoleCore/Tests/ConsolePersistenceTests/WorkspaceRepositoryTests.swift`
- Retire after migration: `ios-console/ADLConsole/Support/ConsoleOfflineCache.swift`

**Interfaces:**
- Produces: `WorkspaceSnapshot`, `CachedRoleSurface`, and `WorkspaceRepositoryProtocol.save/load/lock/unlock`.

- [ ] **Step 1: Write failing isolation/expiry tests**

```swift
func testSnapshotIsScopedByOwnerAndOrganization() async throws {
    let repository = try WorkspaceRepository(database: .inMemory())
    try await repository.save(.fixture(ownerUserID: "u1", organizationID: "o1"))
    XCTAssertNotNil(try await repository.load(ownerUserID: "u1", organizationID: "o1"))
    XCTAssertNil(try await repository.load(ownerUserID: "u2", organizationID: "o1"))
    XCTAssertNil(try await repository.load(ownerUserID: "u1", organizationID: "o2"))
}

func testLockHidesWorkspaceUntilSameIdentityUnlocks() async throws {
    let repository = try WorkspaceRepository(database: .inMemory())
    try await repository.save(.fixture(ownerUserID: "u1", organizationID: "o1"))
    try await repository.lock(ownerUserID: "u1")
    XCTAssertNil(try await repository.loadUnlocked(ownerUserID: "u1", organizationID: "o1"))
    XCTAssertFalse(try await repository.unlock(ownerUserID: "u2", organizationID: "o1"))
    XCTAssertTrue(try await repository.unlock(ownerUserID: "u1", organizationID: "o1"))
}
```

- [ ] **Step 2: Run and verify failure**

Run: `cd ios-console/Packages/ConsoleCore && swift test --filter WorkspaceRepositoryTests`
Expected: FAIL because the workspace repository is undefined.

- [ ] **Step 3: Implement schema and repository**

```swift
public struct WorkspaceSnapshot: Codable, Equatable, Sendable {
    public let ownerUserID: String
    public let organizationID: String
    public let role: PlatformRole
    public let verifiedAt: Date
    public let expiresAt: Date
    public let verifiedSystemUptime: TimeInterval
    public let organizationJSON: Data
    public let projectsJSON: Data
    public let publishedSchemasJSON: Data
    public let locale: String
    public let isLocked: Bool
}

public protocol WorkspaceRepositoryProtocol: Sendable {
    func save(_ snapshot: WorkspaceSnapshot) async throws
    func load(ownerUserID: String, organizationID: String) async throws -> WorkspaceSnapshot?
    func loadUnlocked(ownerUserID: String, organizationID: String) async throws -> WorkspaceSnapshot?
    func lock(ownerUserID: String) async throws
    func unlock(ownerUserID: String, organizationID: String) async throws -> Bool
}
```

Add `workspace_snapshots` keyed by `(owner_user_id, organization_id)` and `role_surface_caches` with `surface`, `payload`, `fetched_at`, and byte count. Enforce a 20 MB total cache budget by deleting oldest reconstructible role caches only; never evict capture bootstrap schema/project data. Migrate valid existing `ConsoleOfflineCache` JSON after identity verification, then remove its app wiring.

- [ ] **Step 4: Run workspace and migration tests**

Run: `cd ios-console/Packages/ConsoleCore && swift test --filter WorkspaceRepositoryTests`
Expected: owner/org isolation, bounded eviction, lock/unlock, missing schema, and legacy-cache import tests pass.

- [ ] **Step 5: Commit**

```bash
git add ios-console/Packages/ConsoleCore/Sources/ConsolePersistence ios-console/Packages/ConsoleCore/Tests/ConsolePersistenceTests/WorkspaceRepositoryTests.swift ios-console/ADLConsole/Support/ConsoleOfflineCache.swift
git commit -m "feat: persist owner scoped workspaces"
```

---

### Task 3: Implement the 72-hour session repository

**Files:**
- Create: `ios-console/ADLConsole/Session/SessionRepository.swift`
- Create: `ios-console/ADLConsole/Session/AuthorizationClock.swift`
- Create: `ios-console/ADLConsoleTests/SessionRepositoryTests.swift`
- Modify: `ios-console/ADLConsole/State/AppState.swift`

**Interfaces:**
- Consumes: Task 1 restore result and Task 2 snapshots.
- Produces: `SessionAvailability`, `ReauthenticationReason`, `SessionRepository.restore/verify/signOut`.

- [ ] **Step 1: Write failing policy tests**

```swift
func testTransportFailureUsesUnexpiredSnapshot() async throws {
    let now = Date(timeIntervalSince1970: 72 * 60 * 60 - 1)
    let repository = makeRepository(restore: .unavailable(.transport), verifiedAt: .init(timeIntervalSince1970: 0), now: now)
    XCTAssertEqual(await repository.restore(), .offlineAuthorized(expiresAt: .init(timeIntervalSince1970: 72 * 60 * 60)))
}

func testExpiryAndClockRollbackRequireReauthentication() async throws {
    let expired = makeRepository(restore: .unavailable(.transport), verifiedAt: .init(timeIntervalSince1970: 0), now: .init(timeIntervalSince1970: 259_201))
    XCTAssertEqual(await expired.restore(), .reauthenticationRequired(reason: .authorizationExpired))
    let rollback = makeRepository(restore: .unavailable(.transport), wallElapsed: -60, monotonicElapsed: 259_201)
    XCTAssertEqual(await rollback.restore(), .reauthenticationRequired(reason: .authorizationExpired))
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/SessionRepositoryTests`
Expected: FAIL because session repository types do not exist.

- [ ] **Step 3: Implement exact availability and conservative clock**

```swift
enum ReauthenticationReason: Equatable, Sendable { case noSession, unauthorized, authorizationExpired, identityMismatch, membershipRevoked }

enum SessionAvailability: Equatable, Sendable {
    case restoring
    case onlineVerified(user: AuthSessionUser)
    case offlineAuthorized(expiresAt: Date)
    case reauthenticationRequired(reason: ReauthenticationReason)
    case signedOut
}

struct AuthorizationClock: Sendable {
    static let window: TimeInterval = 72 * 60 * 60
    func isValid(snapshot: WorkspaceSnapshot, now: Date, systemUptime: TimeInterval) -> Bool {
        let wallElapsed = max(0, now.timeIntervalSince(snapshot.verifiedAt))
        let monotonicElapsed = systemUptime >= snapshot.verifiedSystemUptime ? systemUptime - snapshot.verifiedSystemUptime : wallElapsed
        return max(wallElapsed, monotonicElapsed) <= Self.window && now <= snapshot.expiresAt
    }
}
```

Only successful session plus membership refresh writes a new verification timestamp. Transport/5xx may use a same-identity unexpired snapshot; nil session/401/mismatch/expiry require reauthentication. `signOut` clears local auth first, locks workspace/ledger visibility, then starts best-effort server sign-out.

- [ ] **Step 4: Run session and AppState tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/SessionRepositoryTests -only-testing:ADLConsoleTests/AppStateTests`
Expected: online, offline, 401, 5xx, expiry, rollback, same-user unlock, different-user lock, and sign-out tests pass.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Session ios-console/ADLConsole/State/AppState.swift ios-console/ADLConsoleTests/SessionRepositoryTests.swift ios-console/ADLConsoleTests/AppStateTests.swift
git commit -m "feat: authorize cached sessions for 72 hours"
```

---

### Task 4: Add connectivity hints and single-drain synchronization

**Files:**
- Create: `ios-console/ADLConsole/Runtime/ConnectivityMonitor.swift`
- Create: `ios-console/ADLConsole/Runtime/SyncEngine.swift`
- Create: `ios-console/ADLConsoleTests/ConnectivityMonitorTests.swift`
- Create: `ios-console/ADLConsoleTests/SyncEngineTests.swift`

**Interfaces:**
- Produces: `ConnectivityState`, `SyncTrigger`, `SyncProgress`, `ConnectivityMonitoring`, and `SyncEngine.trigger(_:)`.

- [ ] **Step 1: Write failing coalescing/error tests**

```swift
func testConcurrentTriggersUseOneDrainLoop() async throws {
    await withTaskGroup(of: Void.self) { group in
        for trigger in [SyncTrigger.recordPersisted, .foreground, .reconnected, .manual] {
            group.addTask { await engine.trigger(trigger) }
        }
    }
    XCTAssertEqual(submitter.maximumConcurrentCalls, 1)
}

func testValidationBlocksOneRecordAndContinues() async throws {
    submitter.results = [.failure(.validation("schema")), .success(.init(serverRecordID: "s2"))]
    await engine.trigger(.manual)
    XCTAssertEqual(try await ledger.record(localID: "r1")?.state, .blockedValidation)
    XCTAssertEqual(try await ledger.record(localID: "r2")?.state, .acknowledged)
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/SyncEngineTests`
Expected: FAIL because `SyncEngine` is undefined.

- [ ] **Step 3: Implement hint and engine contracts**

```swift
enum ConnectivityState: Equatable, Sendable { case unsatisfied, requiresConnection, satisfied }
enum SyncTrigger: String, Sendable { case recordPersisted, foreground, reconnected, manual, backgroundRefresh }
struct SyncProgress: Equatable, Sendable { let current: Int; let total: Int }

actor SyncEngine {
    private var drainTask: Task<Void, Never>?
    func trigger(_ trigger: SyncTrigger) {
        guard drainTask == nil else { return }
        drainTask = Task { await drain(trigger: trigger); drainTask = nil }
    }
}
```

Wrap `NWPathMonitor` behind a protocol. Drain oldest due records one at a time using stable keys; classify transport/5xx to retry, 401 to auth block and pause, 403 to authorization block and pause, 400/409/422 to validation block, checksum/read errors to storage block. Compute exponential delay `min(30, pow(2, attempt))` plus injected jitter in `0...1` seconds. Commit acknowledgement before calling media cleanup.

- [ ] **Step 4: Run connectivity/sync/ledger tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/ConnectivityMonitorTests -only-testing:ADLConsoleTests/SyncEngineTests`
Expected: coalescing, oldest-first, one-claim, jitter bounds, 401/403 pause, isolated validation block, cleanup order, and cancellation tests pass.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Runtime ios-console/ADLConsoleTests/ConnectivityMonitorTests.swift ios-console/ADLConsoleTests/SyncEngineTests.swift
git commit -m "feat: synchronize durable captures from runtime triggers"
```

---

### Task 5: Enforce the offline role capability matrix

**Files:**
- Create: `ios-console/ADLConsole/Runtime/OfflineRolePolicy.swift`
- Modify: `ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift`
- Modify: `ios-console/ADLConsole/Screens/Review/ReviewQueueViewModel.swift`
- Modify: `ios-console/ADLConsole/Screens/Projects/ProjectsViewModel.swift`
- Modify: `ios-console/ADLConsole/Screens/Members/MembersViewModel.swift`
- Modify: `ios-console/ADLConsole/Screens/Schema/SchemaBuilderViewModel.swift`
- Modify: `ios-console/ADLConsole/Screens/Settings/SettingsViewModel.swift`
- Create: `ios-console/ADLConsoleTests/OfflineRolePolicyTests.swift`

**Interfaces:**
- Produces: `OfflineCapability`, `OfflineRolePolicy.allows(_:role:session:)`, and guarded mutation entry points.

- [ ] **Step 1: Write the complete failing matrix test**

```swift
func testOfflineRoleMatrix() {
    let offline = SessionAvailability.offlineAuthorized(expiresAt: .distantFuture)
    XCTAssertTrue(policy.allows(.createLocalRecord, role: .collector, session: offline))
    XCTAssertTrue(policy.allows(.inspectCachedReview, role: .reviewer, session: offline))
    XCTAssertFalse(policy.allows(.reviewMutation, role: .reviewer, session: offline))
    XCTAssertTrue(policy.allows(.inspectCachedAdministration, role: .manager, session: offline))
    XCTAssertFalse(policy.allows(.administrationMutation, role: .manager, session: offline))
    XCTAssertFalse(policy.allows(.createLocalRecord, role: .collector, session: .reauthenticationRequired(reason: .authorizationExpired)))
    XCTAssertTrue(policy.allows(.exportPendingRecord, role: .collector, session: .reauthenticationRequired(reason: .authorizationExpired)))
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/OfflineRolePolicyTests`
Expected: FAIL because capability policy is undefined.

- [ ] **Step 3: Implement and apply fail-closed guards**

```swift
enum OfflineCapability: Sendable {
    case createLocalRecord, inspectPendingRecord, exportPendingRecord, discardPendingRecord
    case inspectCachedReview, reviewMutation
    case inspectCachedAdministration, administrationMutation
}
```

The pure policy returns true for collector local/recovery actions within 72 hours, cached inspection for reviewer/admin, and false for every privileged mutation unless session is `onlineVerified`. Each mutation view model checks policy before calling the API and publishes `Reconnect to continue` / `Reconnectez-vous pour continuer`; cached surfaces display their `fetchedAt` timestamp.

- [ ] **Step 4: Run policy and affected view-model tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/OfflineRolePolicyTests -only-testing:ADLConsoleTests/ReviewQueueViewModelTests -only-testing:ADLConsoleTests/ProjectsViewModelTests -only-testing:ADLConsoleTests/MembersViewModelTests`
Expected: tests pass and transport spies record zero privileged calls while offline.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Runtime/OfflineRolePolicy.swift ios-console/ADLConsole/Screens ios-console/ADLConsoleTests
git commit -m "feat: enforce offline role capabilities"
```

---

### Task 6: Wire lifecycle, truthful status, background refresh, and opt-in notifications

**Files:**
- Create: `ios-console/ADLConsole/Runtime/OperationalStatusModel.swift`
- Modify: `ios-console/ADLConsole/State/AppState.swift`
- Modify: `ios-console/ADLConsole/Shell/RootView.swift`
- Modify: `ios-console/ADLConsole/Shell/ConsoleShellView.swift`
- Modify: `ios-console/ADLConsole/Shell/AppSettingsView.swift`
- Modify: `ios-console/project.yml`
- Create: `ios-console/ADLConsoleTests/OperationalStatusModelTests.swift`
- Create: `ios-console/ADLConsoleUITests/OfflineRuntimeUITests.swift`

**Interfaces:**
- Consumes: session/connectivity/sync/ledger snapshots.
- Produces: `OperationalStatus`, foreground/reconnect/background triggers, contextual notification opt-in.

- [ ] **Step 1: Write failing precedence/notification tests**

```swift
func testBlockedOutranksSatisfiedPath() {
    let user = AuthSessionUser(id: "u1", email: nil, role: "collector", isAdmin: false)
    XCTAssertEqual(model.derive(path: .satisfied, session: .onlineVerified(user: user), ledger: .init(pending: 0, sending: 0, retrying: 0, blocked: 2, acknowledgedThisSession: 0), progress: nil), .blocked(count: 2))
}

func testNotificationPermissionDefaultsOffAndIsNotRequestedAtLaunch() async {
    let center = RecordingNotificationCenter()
    let app = makeAppState(notificationCenter: center, notificationsEnabled: false)
    await app.start()
    XCTAssertEqual(center.authorizationRequests, 0)
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/OperationalStatusModelTests`
Expected: FAIL because operational status model is undefined.

- [ ] **Step 3: Implement exact status and lifecycle wiring**

```swift
enum OperationalStatus: Equatable, Sendable {
    case offline(expiresAt: Date?)
    case connecting
    case pending(count: Int)
    case syncing(current: Int, total: Int)
    case blocked(count: Int)
    case upToDate(lastSuccessfulSyncAt: Date?)
}
```

Remove constant Connected copy. Root launch loads cached workspace/ledger immediately, restores session, and triggers sync on verified online state. `scenePhase == .active` triggers `.foreground`; monitor transition to satisfied triggers `.reconnected`; new durable record triggers `.recordPersisted`. Register `com.africandatalayer.console.sync-refresh`; expiration cancels after the current durable transition. Set `@AppStorage("notificationsEnabled")` default false and request permission only from the explicit settings action.

- [ ] **Step 4: Run the complete M1 simulator gate**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/SessionRepositoryTests -only-testing:ADLConsoleTests/SyncEngineTests -only-testing:ADLConsoleTests/OfflineRolePolicyTests -only-testing:ADLConsoleTests/OperationalStatusModelTests -only-testing:ADLConsoleUITests/OfflineRuntimeUITests`
Expected: cold-start, 72-hour boundary, role fail-closed, sign-out lock, reconnect, background expiry, EN/FR, VoiceOver, and notification denial tests pass.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Runtime/OperationalStatusModel.swift ios-console/ADLConsole/State/AppState.swift ios-console/ADLConsole/Shell ios-console/project.yml ios-console/ADLConsoleTests ios-console/ADLConsoleUITests
git commit -m "feat: expose truthful offline runtime state"
```
