@testable import ADLConsole
import ConsoleForms
import ConsolePersistence
import XCTest

final class SyncEngineTests: XCTestCase {
    private func makeEngine(
        ledger: RecordLedger,
        submitter: MockRecordSubmitter = MockRecordSubmitter(),
        mediaStore: InMemoryCaptureMediaStore = InMemoryCaptureMediaStore()
    ) -> SyncEngine {
        SyncEngine(ledger: ledger, submitter: submitter, mediaStore: mediaStore, ownerUserID: "u1", organizationID: "o1")
    }

    func testTriggerSendsPendingRecords() async throws {
        let ledger = try RecordLedger(database: .inMemory())
        let record = LedgerRecord(localID: "r1", ownerUserID: "u1", organizationID: "o1", projectID: "p1", schemaVersionID: "sv1", recordTypeKey: "pharmacy", fieldValuesJSON: "{}", state: .pending, createdAt: Date(timeIntervalSince1970: 0), updatedAt: Date(timeIntervalSince1970: 0))
        try await ledger.insert(record, attachments: [])
        let submitter = MockRecordSubmitter()
        let engine = makeEngine(ledger: ledger, submitter: submitter)

        await engine.trigger(.manual)

        XCTAssertEqual(submitter.callCount, 1)
        let submitted = try await ledger.record(localID: "r1")
        XCTAssertEqual(submitted?.state, .acknowledged)
        XCTAssertEqual(submitted?.serverRecordID, "server-r1")
    }

    func testPermanentErrorBlocksRecord() async throws {
        let ledger = try RecordLedger(database: .inMemory())
        let record = LedgerRecord(localID: "r1", ownerUserID: "u1", organizationID: "o1", projectID: "p1", schemaVersionID: "sv1", recordTypeKey: "pharmacy", fieldValuesJSON: "{}", state: .pending, createdAt: Date(timeIntervalSince1970: 0), updatedAt: Date(timeIntervalSince1970: 0))
        try await ledger.insert(record, attachments: [])

        let claimed = try await ledger.claimNextDue(ownerUserID: "u1", organizationID: "o1")
        XCTAssertNotNil(claimed)
        XCTAssertEqual(claimed?.state, .sending)

        let ledgerError = LedgerError(.validation, code: "test", safeMessage: "direct")
        try await ledger.recordBlock(localID: "r1", state: .blockedValidation, error: ledgerError)
        let r1 = try await ledger.record(localID: "r1")
        XCTAssertEqual(r1?.state, .blockedValidation)
    }
}

final class MockRecordSubmitter: RecordSubmitting, @unchecked Sendable {
    private(set) var callCount = 0
    var results: [Result<String, SyncSubmissionError>] = []

    func submit(_ record: LedgerRecord) async throws -> String {
        callCount += 1
        if callCount <= results.count {
            let result = results[callCount - 1]
            switch result {
            case .success(let serverID): return serverID
            case .failure(let error): throw error
            }
        }
        return "server-\(record.localID)"
    }
}
