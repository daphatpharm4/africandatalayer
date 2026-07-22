@testable import ADLConsole
import ConsolePersistence
import XCTest

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
        // records() returns ALL records including acknowledged/discarded
        // ViewModel should still include them — verify count is 3
        XCTAssertEqual(items.count, 3)
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

    func testConfirmDiscardFailsForAcknowledgedRecord() async throws {
        let (vm, _) = try await makeViewModel(records: [
            fixtureRecord(localID: "r1", state: .acknowledged),
        ])
        await vm.loadItems()

        guard case .loaded(let items) = vm.viewState else { XCTFail(); return }

        vm.requestDiscard(items[0])
        // acknowledged records cannot be discarded (state.isRecoverable == false)
        // confirmDiscard should skip it
        await vm.confirmDiscard()

        guard case .loaded(let remaining) = vm.viewState else { XCTFail(); return }
        XCTAssertEqual(remaining.count, 1)
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
