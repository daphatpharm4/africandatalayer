# ADL Console Capture Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fabricated photo references and the lossy JSON retry queue with a transactional record ledger, protected prepared media, real photo acquisition, and recoverable blocked states.

**Architecture:** Add a `ConsolePersistence` package product backed by GRDB 7.10.0 for portable ledger models and transitions. Keep UIKit/PhotosUI/file-protection work in the app target, hydrate existing data-URL API payloads only during a send, and migrate the legacy JSON queue through a verified rollback-safe journal.

**Tech Stack:** Swift 6, GRDB 7.10.0, SQLite/WAL, CryptoKit, UIKit, PhotosUI, SwiftUI, XCTest/XCUITest.

**Spec:** `docs/superpowers/specs/2026-07-22-ios-console-capture-integrity-design.md`

## Global Constraints

- Tracking issues: `africandatalayer-c1l` and `africandatalayer-c0k`.
- GRDB 7.10.0 is the only new production dependency.
- The existing `PlatformAPIClient.createPlatformRecord` signature, body keys, status mapping, and `Idempotency-Key` behavior remain unchanged.
- Prepared JPEG limits remain exact: longest side 1,280 px; initial quality 0.76; floor 0.48; complete data URL at most 300,000 characters.
- No age, retry, validation, authentication, authorization, storage, or unknown-error path deletes a non-acknowledged record or recoverable attachment.
- Prepared media is deleted only after the acknowledgement transaction commits or after explicit confirmed discard.
- Store all queries under both `ownerUserID` and `organizationID`; sign-out locks data and does not erase it.
- Inspect and preserve current edits in capture, app state, queue, map-enrichment, fraud metadata, and related tests before modifying them.

---

### Task 1: Add GRDB and the durable schema

**Files:**
- Modify: `ios-console/Packages/ConsoleCore/Package.swift`
- Create: `ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/RecordPersistenceModels.swift`
- Create: `ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/RecordDatabase.swift`
- Create: `ios-console/Packages/ConsoleCore/Tests/ConsolePersistenceTests/RecordDatabaseTests.swift`
- Modify: `ios-console/project.yml`

**Interfaces:**
- Produces: `RecordState`, `RecordErrorClass`, `LedgerRecord`, `LedgerAttachment`, `RecordLedgerSnapshot`, and `RecordDatabase` with migration `record-ledger-v1`.

- [ ] **Step 1: Write the failing schema test**

```swift
import GRDB
import XCTest
@testable import ConsolePersistence

final class RecordDatabaseTests: XCTestCase {
    func testCreatesLedgerTablesAndForeignKeys() throws {
        let database = try RecordDatabase.inMemory()
        let names = try database.reader.read { db in
            try String.fetchAll(db, sql: "SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        XCTAssertTrue(names.contains("queued_records"))
        XCTAssertTrue(names.contains("media_attachments"))
        XCTAssertTrue(names.contains("queue_migrations"))
        let foreignKeys = try database.reader.read { db in
            try Row.fetchAll(db, sql: "PRAGMA foreign_key_list(media_attachments)")
        }
        XCTAssertEqual(foreignKeys.first?["table"], "queued_records")
    }
}
```

- [ ] **Step 2: Run it and verify failure**

Run: `cd ios-console/Packages/ConsoleCore && swift test --filter RecordDatabaseTests`
Expected: FAIL because `ConsolePersistence` does not exist.

- [ ] **Step 3: Add the pinned package/product and schema**

Add `.package(url: "https://github.com/groue/GRDB.swift.git", exact: "7.10.0")`, a `ConsolePersistence` library, and a test target. Define these public enums exactly:

```swift
public enum RecordState: String, Codable, CaseIterable, Sendable {
    case pending, sending, retryScheduled
    case blockedAuthentication, blockedAuthorization, blockedValidation, blockedStorage
    case acknowledged, discarded
}

public enum RecordErrorClass: String, Codable, Sendable {
    case network, server, authentication, authorization, validation, storage, unknown
}

public struct LedgerError: Codable, Equatable, Sendable {
    public let classification: RecordErrorClass
    public let code: String
    public let safeMessage: String
    public init(_ classification: RecordErrorClass, code: String, safeMessage: String) {
        self.classification = classification; self.code = code; self.safeMessage = safeMessage
    }
}

public struct RecordLedgerSnapshot: Equatable, Sendable {
    public let pending: Int
    public let sending: Int
    public let retrying: Int
    public let blocked: Int
    public let acknowledgedThisSession: Int
}
```

Register `record-ledger-v1` with the exact `queued_records`, `media_attachments`, and `queue_migrations` columns from the approved design; enable foreign keys, WAL, and `busy_timeout = 5000`; index `(owner_user_id, organization_id, state, next_attempt_at)` and `(record_local_id, placement, ordinal)`.

- [ ] **Step 4: Run the schema test and regenerate the app project**

Run: `cd ios-console/Packages/ConsoleCore && swift test --filter RecordDatabaseTests && cd ../.. && xcodegen generate`
Expected: schema test passes and XcodeGen completes without dependency errors.

- [ ] **Step 5: Commit**

```bash
git add ios-console/Packages/ConsoleCore/Package.swift ios-console/Packages/ConsoleCore/Sources/ConsolePersistence ios-console/Packages/ConsoleCore/Tests/ConsolePersistenceTests ios-console/project.yml ios-console/ADLConsole.xcodeproj
git commit -m "feat: add durable record database"
```

---

### Task 2: Implement lossless ledger transitions

**Files:**
- Create: `ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/RecordLedger.swift`
- Create: `ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/RecordTransition.swift`
- Create: `ios-console/Packages/ConsoleCore/Tests/ConsolePersistenceTests/RecordLedgerTests.swift`

**Interfaces:**
- Consumes: Task 1 database/models.
- Produces: `RecordLedgerProtocol.insert`, `claimNextDue`, `recordRetry`, `recordBlock`, `recordAcknowledgement`, `discard`, `recoverInterruptedSends`, `records`, and `snapshot`.

- [ ] **Step 1: Write failing no-loss transition tests**

```swift
func testSixRetriesAndSeventyTwoHoursNeverDeleteRecord() async throws {
    let ledger = try RecordLedger(database: .inMemory(), now: { Date(timeIntervalSince1970: 400_000) })
    try await ledger.insert(.fixture(localID: "r1", createdAt: Date(timeIntervalSince1970: 0)))
    for attempt in 1...6 {
        _ = try await ledger.claimNextDue(ownerUserID: "u1", organizationID: "o1")
        try await ledger.recordRetry(localID: "r1", error: .init(.network, code: "offline", safeMessage: "Connection unavailable"), nextAttemptAt: Date(timeIntervalSince1970: Double(attempt)))
    }
    let record = try await ledger.record(localID: "r1")
    XCTAssertEqual(record?.state, .blockedStorage)
    XCTAssertEqual(record?.automaticAttemptCount, 6)
}

func testAcknowledgementCommitsReceiptBeforeCleanupEligibility() async throws {
    let ledger = try RecordLedger(database: .inMemory())
    try await ledger.insert(.fixture(localID: "r1"))
    try await ledger.recordAcknowledgement(localID: "r1", serverRecordID: "server-1", acknowledgedAt: .now)
    let record = try await ledger.record(localID: "r1")
    XCTAssertEqual(record?.state, .acknowledged)
    XCTAssertEqual(record?.serverRecordID, "server-1")
}
```

- [ ] **Step 2: Run and verify failure**

Run: `cd ios-console/Packages/ConsoleCore && swift test --filter RecordLedgerTests`
Expected: FAIL because `RecordLedger` and transition methods are undefined.

- [ ] **Step 3: Implement the protocol and guarded transition map**

```swift
public protocol RecordLedgerProtocol: Sendable {
    func insert(_ record: LedgerRecord, attachments: [LedgerAttachment]) async throws
    func record(localID: String) async throws -> LedgerRecord?
    func records(ownerUserID: String, organizationID: String) async throws -> [LedgerRecord]
    func claimNextDue(ownerUserID: String, organizationID: String) async throws -> LedgerRecord?
    func recordRetry(localID: String, error: LedgerError, nextAttemptAt: Date) async throws
    func recordBlock(localID: String, state: RecordState, error: LedgerError) async throws
    func recordAcknowledgement(localID: String, serverRecordID: String, acknowledgedAt: Date) async throws
    func discard(localID: String, discardedAt: Date) async throws
    func recoverInterruptedSends() async throws
    func snapshot(ownerUserID: String, organizationID: String) async throws -> RecordLedgerSnapshot
}
```

Allow only `pending/retryScheduled -> sending`, `sending -> retryScheduled/blocked*/acknowledged`, `blocked* -> pending`, and non-acknowledged recoverable states -> `discarded`. After six automatic attempts, persist a generic recoverable `blockedStorage` state with code `automatic_attempt_budget_exhausted`; do not delete the row. Update state and attempt metadata in one `DatabasePool.write` transaction.

Add this shared predicate for resilience assertions:

```swift
public extension RecordState {
    var isRecoverable: Bool {
        switch self {
        case .pending, .sending, .retryScheduled, .blockedAuthentication, .blockedAuthorization, .blockedValidation, .blockedStorage: true
        case .acknowledged, .discarded: false
        }
    }
}
```

- [ ] **Step 4: Run transition, isolation, and recovery tests**

Run: `cd ios-console/Packages/ConsoleCore && swift test --filter RecordLedgerTests`
Expected: tests cover every allowed/forbidden transition, stable idempotency, owner/org isolation, oldest-first claim, and interrupted-send recovery; all pass.

- [ ] **Step 5: Commit**

```bash
git add ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/RecordLedger.swift ios-console/Packages/ConsoleCore/Sources/ConsolePersistence/RecordTransition.swift ios-console/Packages/ConsoleCore/Tests/ConsolePersistenceTests/RecordLedgerTests.swift
git commit -m "feat: add lossless record ledger transitions"
```

---

### Task 3: Store and verify protected prepared media

**Files:**
- Create: `ios-console/ADLConsole/CaptureStorage/CaptureMediaStore.swift`
- Create: `ios-console/ADLConsole/CaptureStorage/CaptureMediaPreparer.swift`
- Modify: `ios-console/ADLConsole/Support/CameraCaptureView.swift`
- Create: `ios-console/ADLConsoleTests/CaptureMediaStoreTests.swift`
- Create: `ios-console/ADLConsoleTests/CaptureMediaPreparerTests.swift`

**Interfaces:**
- Produces: `PreparedCaptureMedia`, `CaptureMediaStoreProtocol.stage/resolve/remove/quarantine`, and `CaptureMediaPreparer.prepare(_:)`.

- [ ] **Step 1: Write failing preparation and checksum tests**

```swift
func testPreparedMediaHonorsPayloadLimitAndChecksum() throws {
    let result = try CaptureMediaPreparer().prepare(TestImages.landscape4032x3024)
    XCTAssertLessThanOrEqual(max(result.pixelWidth, result.pixelHeight), 1_280)
    XCTAssertLessThanOrEqual(result.dataURLLength, 300_000)
    XCTAssertEqual(result.sha256.count, 64)
}

func testStageUsesProtectedOwnerScopedPath() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    let store = CaptureMediaStore(root: root)
    let staged = try await store.stage(.fixture(), ownerUserID: "u1", organizationID: "o1", recordLocalID: "r1")
    XCTAssertTrue(staged.relativePath.hasPrefix("u1/o1/r1/"))
    XCTAssertEqual(try Data(contentsOf: root.appendingPathComponent(staged.relativePath)).sha256Hex, staged.sha256)
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/CaptureMediaStoreTests -only-testing:ADLConsoleTests/CaptureMediaPreparerTests`
Expected: FAIL because the media boundary is undefined.

- [ ] **Step 3: Implement exact preparation and atomic storage**

```swift
struct PreparedCaptureMedia: Equatable, Sendable {
    let data: Data
    let mimeType: String
    let sha256: String
    let pixelWidth: Int
    let pixelHeight: Int
    var dataURLLength: Int { "data:image/jpeg;base64,".count + data.base64EncodedString().count }
}

protocol CaptureMediaStoreProtocol: Sendable {
    func stage(_ media: PreparedCaptureMedia, ownerUserID: String, organizationID: String, recordLocalID: String) async throws -> LedgerAttachment
    func resolve(_ attachment: LedgerAttachment) async throws -> Data
    func removeAcknowledged(recordLocalID: String) async throws
    func discard(recordLocalID: String) async throws
    func quarantine(_ attachment: LedgerAttachment, reason: String) async throws
}
```

Normalize orientation, resize to 1,280 px, encode at 0.76 and decrement by 0.04 to the 0.48 floor until the complete data URL fits. Write a staging file with `.completeFileProtectionUntilFirstUserAuthentication`, close it, verify SHA-256, then atomically move it into `owner/org/record`. Change `CameraCaptureView.onCapture` to return source `Data`; no view writes data URLs.

- [ ] **Step 4: Run media tests including corruption and disk-failure fixtures**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/CaptureMediaStoreTests -only-testing:ADLConsoleTests/CaptureMediaPreparerTests`
Expected: `** TEST SUCCEEDED **` with dimension, quality-floor, checksum, quarantine, atomic move, and cleanup-order tests passing.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/CaptureStorage ios-console/ADLConsole/Support/CameraCaptureView.swift ios-console/ADLConsoleTests/CaptureMediaStoreTests.swift ios-console/ADLConsoleTests/CaptureMediaPreparerTests.swift
git commit -m "feat: persist protected capture media"
```

---

### Task 4: Add the submission adapter and durable capture coordinator

**Files:**
- Create: `ios-console/ADLConsole/CaptureStorage/ExistingPayloadSubmissionAdapter.swift`
- Create: `ios-console/ADLConsole/Screens/Capture/CaptureCoordinator.swift`
- Modify: `ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift`
- Modify: `ios-console/ADLConsole/State/AppState.swift`
- Create: `ios-console/ADLConsoleTests/CaptureCoordinatorTests.swift`
- Create: `ios-console/ADLConsoleTests/ExistingPayloadSubmissionAdapterTests.swift`

**Interfaces:**
- Consumes: ledger/media contracts and existing API method.
- Produces: `CaptureCoordinator.persist(_:) -> String` and `ExistingPayloadSubmissionAdapter.submit(localID:) -> SubmissionAcknowledgement`.

- [ ] **Step 1: Write failing persistence-before-network and payload tests**

```swift
func testPersistCommitsBeforeAnySend() async throws {
    let ledger = RecordingLedger()
    let adapter = RecordingSubmissionAdapter()
    let coordinator = CaptureCoordinator(ledger: ledger, mediaStore: InMemoryCaptureMediaStore(), submissionAdapter: adapter)
    _ = try await coordinator.persist(.fixture())
    XCTAssertEqual(ledger.events.first, "insert")
    XCTAssertTrue(adapter.events.isEmpty)
}

func testAdapterHydratesLocalReferencesWithoutMutatingLedger() async throws {
    let adapter = ExistingPayloadSubmissionAdapter(apiClient: api, ledger: ledger, mediaStore: media)
    let acknowledgement = try await adapter.submit(localID: "r1")
    XCTAssertEqual(transport.lastRequest?.value(forHTTPHeaderField: "Idempotency-Key"), "idem-r1")
    XCTAssertTrue(transport.lastBodyString.contains("data:image/jpeg;base64,"))
    XCTAssertEqual(try await ledger.record(localID: "r1")?.fieldValuesJSON, originalFieldJSON)
    XCTAssertEqual(acknowledgement.serverRecordID, "server-r1")
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/CaptureCoordinatorTests -only-testing:ADLConsoleTests/ExistingPayloadSubmissionAdapterTests`
Expected: FAIL because both types are undefined.

- [ ] **Step 3: Implement exact boundaries**

```swift
struct SubmissionAcknowledgement: Equatable, Sendable { let serverRecordID: String }

protocol RecordSubmitting: Sendable {
    func submit(localID: String) async throws -> SubmissionAcknowledgement
}

@MainActor
final class CaptureCoordinator {
    func persist(_ intent: CaptureIntent) async throws -> String {
        let localID = UUID().uuidString
        let prepared = try await intent.attachments.asyncMap { try await mediaStore.stage($0, ownerUserID: intent.ownerUserID, organizationID: intent.organizationID, recordLocalID: localID) }
        let record = try LedgerRecord(intent: intent, localID: localID, attachments: prepared)
        try await ledger.insert(record, attachments: prepared)
        return localID
    }
}
```

The adapter loads immutable record/attachments, verifies hashes, replaces schema-photo attachment IDs with transient data URLs, supplies record-evidence photos, calls `createPlatformRecord` with the stored key, returns the server ID, and releases hydrated strings without writing them to GRDB. Replace `CaptureViewModel` queue submission with coordinator persistence followed by a sync trigger; inject all dependencies through `AppState`.

- [ ] **Step 4: Run focused and existing API contract tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/CaptureCoordinatorTests -only-testing:ADLConsoleTests/ExistingPayloadSubmissionAdapterTests && cd ios-console/Packages/ConsoleCore && swift test --filter PlatformAPIClientTests`
Expected: all tests pass and the existing body/idempotency assertions remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/CaptureStorage/ExistingPayloadSubmissionAdapter.swift ios-console/ADLConsole/Screens/Capture/CaptureCoordinator.swift ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift ios-console/ADLConsole/State/AppState.swift ios-console/ADLConsoleTests
git commit -m "feat: durably coordinate capture submission"
```

---

### Task 5: Replace fake schema photos with real attachments

**Files:**
- Modify: `ios-console/ADLConsole/Screens/Capture/CaptureFieldControl.swift`
- Modify: `ios-console/ADLConsole/Screens/Capture/CaptureView.swift`
- Modify: `ios-console/ADLConsole/Screens/Capture/CaptureViewModel.swift`
- Create: `ios-console/ADLConsole/Screens/Capture/CaptureAttachmentPicker.swift`
- Modify: `ios-console/ADLConsoleTests/CaptureViewModelTests.swift`
- Create: `ios-console/ADLConsoleUITests/CapturePhotoUITests.swift`

**Interfaces:**
- Produces: one camera/PhotosPicker component for schema photos and record evidence; field values store local attachment IDs.

- [ ] **Step 1: Write failing view-model tests**

```swift
func testRequiredPhotoNeedsDurableAttachment() async throws {
    let model = makeViewModel(requiredPhotoField: "front_photo")
    model.setValue(.photoRef("field-photo-generated"), for: "front_photo")
    XCTAssertFalse(model.isComplete)
    let attachment = try await model.addPhoto(TestImages.jpeg, placement: .schemaField("front_photo"))
    XCTAssertEqual(model.values["front_photo"], .photoRef(attachment.localID))
    XCTAssertTrue(model.isComplete)
}

func testRemovingDraftPhotoDeletesOnlyUncommittedMedia() async throws {
    let model = makeViewModel(requiredPhotoField: "front_photo")
    let attachment = try await model.addPhoto(TestImages.jpeg, placement: .schemaField("front_photo"))
    try await model.removePhoto(localID: attachment.localID)
    XCTAssertNil(model.values["front_photo"])
    XCTAssertFalse(mediaStore.contains(attachment.localID))
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/CaptureViewModelTests`
Expected: FAIL because real attachment methods are missing.

- [ ] **Step 3: Implement the attachment UI contract**

```swift
enum CaptureAttachmentPlacement: Equatable, Sendable {
    case schemaField(String)
    case recordEvidence
}

struct CaptureAttachmentViewState: Identifiable, Equatable {
    let id: String
    let thumbnail: Image
    let placement: CaptureAttachmentPlacement
    let byteCount: Int
}
```

`CaptureFieldControl` receives `attachments`, `onAddPhoto`, and `onRemovePhoto` closures; tapping empty photo content presents `confirmationDialog` with Camera and Photo Library; thumbnails have 48-point removal controls and EN/FR accessibility labels. Delete the `field-photo-<UUID>` generation path. Use the same picker in the evidence section and stage via the shared preparer/store.

- [ ] **Step 4: Run unit/UI/accessibility tests and scan for fabrication**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/CaptureViewModelTests -only-testing:ADLConsoleUITests/CapturePhotoUITests && ! rg -n 'field-photo-' ios-console/ADLConsole`
Expected: tests succeed and fabricated reference scan returns no matches.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Screens/Capture ios-console/ADLConsoleTests/CaptureViewModelTests.swift ios-console/ADLConsoleUITests/CapturePhotoUITests.swift
git commit -m "feat: capture real schema photo evidence"
```

---

### Task 6: Migrate legacy JSON and expose pending recovery

**Files:**
- Create: `ios-console/ADLConsole/CaptureStorage/LegacyQueueMigrator.swift`
- Create: `ios-console/ADLConsole/Screens/PendingWork/PendingWorkViewModel.swift`
- Create: `ios-console/ADLConsole/Screens/PendingWork/PendingWorkView.swift`
- Modify: `ios-console/ADLConsole/Shell/ConsoleShellView.swift`
- Create: `ios-console/ADLConsoleTests/LegacyQueueMigratorTests.swift`
- Create: `ios-console/ADLConsoleTests/PendingWorkViewModelTests.swift`

**Interfaces:**
- Consumes: `FileRecordQueueStore` source format and ledger/media contracts.
- Produces: `LegacyQueueMigrationResult`, atomic activation, retained protected backup, and retry/export/discard recovery UI.

- [ ] **Step 1: Write failing migration/recovery tests**

```swift
func testInterruptedMigrationLeavesLegacySourceAuthoritative() async throws {
    let fixture = try LegacyQueueFixture.items(75, failAfterImport: 32)
    let result = await migrator.migrate(source: fixture.sourceURL)
    XCTAssertEqual(result, .failed(code: "verification_failed"))
    XCTAssertTrue(FileManager.default.fileExists(atPath: fixture.sourceURL.path))
    XCTAssertEqual(try await ledger.records(ownerUserID: "u1", organizationID: "o1").count, 0)
}

func testBlockedRecordRequiresConfirmedDiscard() async throws {
    let model = PendingWorkViewModel(ledger: ledger, mediaStore: media, ownerUserID: "u1", organizationID: "o1")
    try await model.requestDiscard(localID: "r1")
    XCTAssertEqual(model.discardConfirmation?.photoCount, 2)
    XCTAssertNotNil(try await ledger.record(localID: "r1"))
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/LegacyQueueMigratorTests -only-testing:ADLConsoleTests/PendingWorkViewModelTests`
Expected: FAIL because migration and pending-work types are undefined.

- [ ] **Step 3: Implement journaled migration and recovery actions**

```swift
enum LegacyQueueMigrationResult: Equatable, Sendable {
    case notNeeded
    case activated(imported: Int, sourceSHA256: String)
    case failed(code: String)
}

struct PendingRecordActionSet: Equatable {
    let canRetry: Bool
    let canSignIn: Bool
    let canEdit: Bool
    let canExport: Bool
    let canDiscard: Bool
}
```

Copy the legacy source to the protected recovery directory, decode each item independently, decode data URLs into staged media, insert into an isolated migration transaction, verify count/keys/bytes/checksums, activate only after verification, and rename the original to `.migrated-backup`. On failure, roll back records and keep source/backup. Pending sections are Pending, Retrying, Blocked, Recently acknowledged; expose Retry, Sign in, compatible Edit, system-share Export, and confirmed Discard.

- [ ] **Step 4: Run the full M0 gate**

Run: `cd ios-console/Packages/ConsoleCore && swift test && cd ../.. && xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/LegacyQueueMigratorTests -only-testing:ADLConsoleTests/PendingWorkViewModelTests -only-testing:ADLConsoleTests/CaptureCoordinatorTests`
Expected: all tests pass, including empty/75-item/malformed/base64/disk/interruption/repeat migration fixtures and blocked recovery.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/CaptureStorage/LegacyQueueMigrator.swift ios-console/ADLConsole/Screens/PendingWork ios-console/ADLConsole/Shell/ConsoleShellView.swift ios-console/ADLConsoleTests
git commit -m "feat: migrate and recover pending captures"
```
