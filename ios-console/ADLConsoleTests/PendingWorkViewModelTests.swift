@testable import ADLConsole
import ConsolePersistence
import XCTest

/// A `CaptureMediaStoreProtocol` wrapper that always fails `discard(recordLocalID:)`
/// while delegating every other call to a real `InMemoryCaptureMediaStore`.
/// Used to force the media-discard failure path in `confirmDiscard()` without
/// touching ledger behavior.
private final class FailingDiscardCaptureMediaStore: CaptureMediaStoreProtocol, @unchecked Sendable {
    private let wrapped: InMemoryCaptureMediaStore

    init(wrapped: InMemoryCaptureMediaStore) {
        self.wrapped = wrapped
    }

    func stage(_ media: PreparedCaptureMedia, ownerUserID: String, organizationID: String, recordLocalID: String) async throws -> LedgerAttachment {
        try await wrapped.stage(media, ownerUserID: ownerUserID, organizationID: organizationID, recordLocalID: recordLocalID)
    }

    func resolve(_ attachment: LedgerAttachment) async throws -> Data {
        try await wrapped.resolve(attachment)
    }

    func removeAcknowledged(recordLocalID: String) async throws {
        try await wrapped.removeAcknowledged(recordLocalID: recordLocalID)
    }

    func discard(recordLocalID: String) async throws {
        throw CaptureMediaStoreError.fileSystemFailure("forced failure for test")
    }

    func quarantine(_ attachment: LedgerAttachment, reason: String) async throws {
        try await wrapped.quarantine(attachment, reason: reason)
    }
}

@MainActor
final class PendingWorkViewModelTests: XCTestCase {
    private func makeViewModel(
        records: [LedgerRecord] = [],
        ledger: RecordLedgerProtocol? = nil
    ) async throws -> (PendingWorkViewModel, RecordLedgerProtocol) {
        let database = try RecordDatabase.inMemory()
        let recordLedger = ledger ?? RecordLedger(database: database)
        for record in records {
            try await recordLedger.insert(record, attachments: [])
        }
        let mediaStore = InMemoryCaptureMediaStore()
        let vm = PendingWorkViewModel(
            ledger: recordLedger,
            mediaStore: mediaStore,
            ownerUserID: "u1",
            organizationID: "o1",
            language: .en
        )
        return (vm, recordLedger)
    }

    private func fixtureRecord(
        localID: String = "r1",
        state: RecordState = .pending,
        ownerUserID: String = "u1",
        organizationID: String = "o1"
    ) -> LedgerRecord {
        LedgerRecord(
            localID: localID,
            ownerUserID: ownerUserID,
            organizationID: organizationID,
            projectID: "proj-1",
            schemaVersionID: "sv-1",
            recordTypeKey: "pharmacy",
            fieldValuesJSON: "{}",
            state: state,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    // MARK: - Load

    func testLoadItemsPopulatesPendingRecords() async throws {
        let (vm, _) = try await makeViewModel(records: [
            fixtureRecord(localID: "r1", state: .pending),
            fixtureRecord(localID: "r2", state: .retryScheduled),
        ])

        await vm.loadItems()

        guard case .loaded(let items) = vm.viewState else {
            XCTFail("Expected .loaded, got \(vm.viewState)"); return
        }
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[0].recordTypeKey, "pharmacy")
    }

    func testLoadItemsEmpty() async throws {
        let (vm, _) = try await makeViewModel()

        await vm.loadItems()

        XCTAssertEqual(vm.viewState, .empty)
    }

    func testLoadItemsExcludesDiscardedAndAcknowledged() async throws {
        let (vm, _) = try await makeViewModel(records: [
            fixtureRecord(localID: "r1", state: .pending),
            fixtureRecord(localID: "r2", state: .acknowledged),
            fixtureRecord(localID: "r3", state: .discarded),
        ])

        await vm.loadItems()

        guard case .loaded(let items) = vm.viewState else {
            XCTFail("Expected .loaded, got \(vm.viewState)"); return
        }
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?.id, "r1")
    }

    // MARK: - Discard requires confirmation

    func testRequestDiscardSetsConfirmationItem() async throws {
        let (vm, _) = try await makeViewModel(records: [
            fixtureRecord(localID: "r1", state: .pending),
        ])
        await vm.loadItems()

        guard case .loaded(let items) = vm.viewState else { XCTFail(); return }

        vm.requestDiscard(items[0])
        XCTAssertNotNil(vm.discardConfirmationItem)
        XCTAssertEqual(vm.discardConfirmationItem?.id, "r1")
    }

    func testCapabilityPolicyBlocksDiscardRequest() async throws {
        let database = try RecordDatabase.inMemory()
        let ledger = RecordLedger(database: database)
        try await ledger.insert(fixtureRecord())
        let vm = PendingWorkViewModel(
            ledger: ledger,
            mediaStore: InMemoryCaptureMediaStore(),
            ownerUserID: "u1",
            organizationID: "o1",
            language: .en,
            capabilityAllowed: { $0 == .exportPendingRecord }
        )
        await vm.loadItems()
        guard case .loaded(let items) = vm.viewState else { XCTFail(); return }

        vm.requestDiscard(items[0])

        XCTAssertNil(vm.discardConfirmationItem)
    }

    func testCancelDiscardClearsConfirmation() async throws {
        let (vm, _) = try await makeViewModel(records: [
            fixtureRecord(localID: "r1", state: .pending),
        ])
        await vm.loadItems()
        guard case .loaded(let items) = vm.viewState else { XCTFail(); return }

        vm.requestDiscard(items[0])
        vm.cancelDiscard()
        XCTAssertNil(vm.discardConfirmationItem)
    }

    func testConfirmDiscardRemovesItemFromView() async throws {
        let (vm, _) = try await makeViewModel(records: [
            fixtureRecord(localID: "r1", state: .pending),
            fixtureRecord(localID: "r2", state: .pending),
        ])
        await vm.loadItems()

        guard case .loaded(let items) = vm.viewState else { XCTFail(); return }
        XCTAssertEqual(items.count, 2)

        vm.requestDiscard(items[0])
        await vm.confirmDiscard()

        guard case .loaded(let remaining) = vm.viewState else { XCTFail(); return }
        XCTAssertEqual(remaining.count, 1)
        XCTAssertEqual(remaining[0].id, "r2")
    }

    func testConfirmDiscardDoesNotDiscardLedgerWhenMediaDiscardFails() async throws {
        let database = try RecordDatabase.inMemory()
        let ledger = RecordLedger(database: database)
        let record = fixtureRecord(localID: "r1", state: .pending)
        try await ledger.insert(record)

        let mediaStore = FailingDiscardCaptureMediaStore(wrapped: InMemoryCaptureMediaStore())
        let vm = PendingWorkViewModel(
            ledger: ledger,
            mediaStore: mediaStore,
            ownerUserID: "u1",
            organizationID: "o1",
            language: .en
        )
        await vm.loadItems()
        guard case .loaded(let items) = vm.viewState else { XCTFail("Expected .loaded"); return }

        vm.requestDiscard(items[0])
        await vm.confirmDiscard()

        // Media discard threw before the ledger discard could run, so the
        // ledger record must still exist (not discarded) — proving discard
        // order prevents orphaned media without a corresponding ledger loss.
        let persisted = try await ledger.record(localID: "r1")
        XCTAssertNotNil(persisted, "ledger record should still exist since media discard failed first")
        XCTAssertEqual(persisted?.state, .pending)
    }

    func testConfirmDiscardFailsForAcknowledgedRecord() async throws {
        let (vm, _) = try await makeViewModel(records: [
            fixtureRecord(localID: "r1", state: .acknowledged),
        ])
        await vm.loadItems()

        XCTAssertEqual(vm.viewState, .empty)
    }

    // MARK: - Blocked record classification

    func testBlockedRecordHasError() async throws {
        let (vm, _) = try await makeViewModel(records: [
            fixtureRecord(localID: "r1", state: .blockedStorage),
        ])
        await vm.loadItems()

        guard case .loaded(let items) = vm.viewState else { XCTFail(); return }
        XCTAssertEqual(items[0].error, .storage)
    }

    func testPendingRecordHasNoError() async throws {
        let (vm, _) = try await makeViewModel(records: [
            fixtureRecord(localID: "r1", state: .pending),
        ])
        await vm.loadItems()

        guard case .loaded(let items) = vm.viewState else { XCTFail(); return }
        XCTAssertNil(items[0].error)
    }
}
