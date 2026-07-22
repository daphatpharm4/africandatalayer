@testable import ADLConsole
import ConsoleForms
import ConsoleModels
import ConsolePersistence
import XCTest

final class LegacyQueueMigratorTests: XCTestCase {
    private func makeMigrator(
        legacyItems: [RecordQueueItem] = [],
        ledger: RecordLedgerProtocol? = nil
    ) throws -> (LegacyQueueMigrator, RecordLedger, InMemoryRecordQueueStore) {
        let store = InMemoryRecordQueueStore(initial: legacyItems)
        let database = try RecordDatabase.inMemory()
        let recordLedger = ledger ?? RecordLedger(database: database)
        let migrator = LegacyQueueMigrator(
            legacyStore: store,
            ledger: recordLedger,
            ownerUserID: "u1",
            organizationID: "o1"
        )
        return (migrator, recordLedger as! RecordLedger, store)
    }

    private func legacyItem(
        id: String = "legacy-1",
        status: RecordQueueItemStatus = .pending,
        projectId: String = "proj-1"
    ) -> RecordQueueItem {
        RecordQueueItem(
            id: id,
            idempotencyKey: "ik-\(id)",
            draft: RecordDraft(
                projectId: projectId,
                schemaVersionId: "sv-1",
                recordTypeKey: "pharmacy",
                data: ["name": .string("Acme")],
                capturedAt: "2026-01-01T00:00:00Z"
            ),
            status: status,
            attempts: 0,
            retryCount: 0,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    // MARK: - Successful migration

    func testMigrateImportsPendingItems() async throws {
        let (migrator, ledger, _) = try makeMigrator(legacyItems: [
            legacyItem(id: "l1"),
            legacyItem(id: "l2"),
        ])

        let result = await migrator.migrate()

        XCTAssertEqual(result, .success(importedCount: 2))
        let records = try await ledger.records(ownerUserID: "u1", organizationID: "o1")
        XCTAssertEqual(records.count, 2)
    }

    func testMigrateEmptyLegacyQueueReturnsSuccessZero() async throws {
        let (migrator, _, _) = try makeMigrator(legacyItems: [])

        let result = await migrator.migrate()

        XCTAssertEqual(result, .success(importedCount: 0))
    }

    func testMigratePreservesItemFields() async throws {
        let (migrator, ledger, _) = try makeMigrator(legacyItems: [
            legacyItem(id: "l1", projectId: "proj-42")
        ])

        _ = await migrator.migrate()

        let record = try await ledger.record(localID: "l1")
        XCTAssertEqual(record?.projectID, "proj-42")
        XCTAssertEqual(record?.recordTypeKey, "pharmacy")
        XCTAssertEqual(record?.state, .pending)
    }

    func testMigrateMapsFailedToRetryScheduled() async throws {
        let (migrator, ledger, _) = try makeMigrator(legacyItems: [
            legacyItem(id: "l1", status: .failed)
        ])

        _ = await migrator.migrate()

        let record = try await ledger.record(localID: "l1")
        XCTAssertEqual(record?.state, .retryScheduled)
    }

    func testMigrateMapsSyncedToAcknowledged() async throws {
        let (migrator, ledger, _) = try makeMigrator(legacyItems: [
            legacyItem(id: "l1", status: .synced)
        ])

        _ = await migrator.migrate()

        let record = try await ledger.record(localID: "l1")
        XCTAssertEqual(record?.state, .acknowledged)
    }

    // MARK: - Interrupted migration preserves source

    func testInterruptedMigrationLeavesLegacySourceAuthoritative() async throws {
        let store = InMemoryRecordQueueStore(initial: [
            legacyItem(id: "l1"),
            legacyItem(id: "l2"),
        ])

        let database = try RecordDatabase.inMemory()
        let ledger = RecordLedger(database: database)

        // Simulate ledger failure on the second insert by using a custom ledger
        let failingLedger = FailingRecordLedger(inner: ledger, failOnLocalID: "l2")
        let migrator = LegacyQueueMigrator(
            legacyStore: store,
            ledger: failingLedger,
            ownerUserID: "u1",
            organizationID: "o1"
        )

        let result = await migrator.migrate()

        // The legacy source should still be intact
        let remaining = try store.load()
        XCTAssertEqual(remaining.count, 2)

        // Partial success — l1 was imported, l2 failed
        if case .partial(let count, _) = result {
            XCTAssertEqual(count, 1)
        } else if case .failed = result {
            // Also acceptable — depends on error handling
        } else {
            XCTFail("Expected partial or failed, got \(result)")
        }
    }
}

private final class FailingRecordLedger: RecordLedgerProtocol {
    private let inner: RecordLedgerProtocol
    private let failOnLocalID: String

    init(inner: RecordLedgerProtocol, failOnLocalID: String) {
        self.inner = inner
        self.failOnLocalID = failOnLocalID
    }

    func insert(_ record: LedgerRecord, attachments: [LedgerAttachment]) async throws {
        if record.localID == failOnLocalID {
            throw RecordLedgerError.invalidTransition
        }
        try await inner.insert(record, attachments: attachments)
    }

    func record(localID: String) async throws -> LedgerRecord? {
        try await inner.record(localID: localID)
    }

    func records(ownerUserID: String, organizationID: String) async throws -> [LedgerRecord] {
        try await inner.records(ownerUserID: ownerUserID, organizationID: organizationID)
    }

    func claimNextDue(ownerUserID: String, organizationID: String) async throws -> LedgerRecord? {
        try await inner.claimNextDue(ownerUserID: ownerUserID, organizationID: organizationID)
    }

    func recordRetry(localID: String, error: LedgerError, nextAttemptAt: Date) async throws {
        try await inner.recordRetry(localID: localID, error: error, nextAttemptAt: nextAttemptAt)
    }

    func recordBlock(localID: String, state: RecordState, error: LedgerError) async throws {
        try await inner.recordBlock(localID: localID, state: state, error: error)
    }

    func recordAcknowledgement(localID: String, serverRecordID: String, acknowledgedAt: Date) async throws {
        try await inner.recordAcknowledgement(localID: localID, serverRecordID: serverRecordID, acknowledgedAt: acknowledgedAt)
    }

    func discard(localID: String, discardedAt: Date) async throws {
        try await inner.discard(localID: localID, discardedAt: discardedAt)
    }

    func recoverInterruptedSends() async throws {
        try await inner.recoverInterruptedSends()
    }

    func snapshot(ownerUserID: String, organizationID: String) async throws -> RecordLedgerSnapshot {
        try await inner.snapshot(ownerUserID: ownerUserID, organizationID: organizationID)
    }
}
