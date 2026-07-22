import ConsoleModels
import Foundation
import XCTest
@testable import ConsolePersistence

final class RecordLedgerTests: XCTestCase {
    func makeLedger(now: @escaping @Sendable () -> Date = { Date(timeIntervalSince1970: 400_000) }) throws -> RecordLedger {
        try RecordLedger(database: RecordDatabase.inMemory(), now: now)
    }

    func fixtureRecord(localID: String = "r1", ownerUserID: String = "u1", organizationID: String = "o1", createdAt: Date = Date(timeIntervalSince1970: 0)) -> LedgerRecord {
        LedgerRecord(
            localID: localID,
            ownerUserID: ownerUserID,
            organizationID: organizationID,
            projectID: "proj-1",
            schemaVersionID: "sv-1",
            recordTypeKey: "pharmacy",
            fieldValuesJSON: #"{"name":"Acme"}"#,
            state: .pending,
            automaticAttemptCount: 0,
            createdAt: createdAt,
            updatedAt: createdAt
        )
    }

    func testSixRetriesAndSeventyTwoHoursNeverDeleteRecord() async throws {
        let now = Date(timeIntervalSince1970: 400_000)
        let ledger = try makeLedger(now: { now })
        try await ledger.insert(fixtureRecord(localID: "r1", createdAt: Date(timeIntervalSince1970: 0)))
        for attempt in 1...6 {
            _ = try await ledger.claimNextDue(ownerUserID: "u1", organizationID: "o1")
            try await ledger.recordRetry(
                localID: "r1",
                error: LedgerError(.network, code: "offline", safeMessage: "Connection unavailable"),
                nextAttemptAt: Date(timeIntervalSince1970: Double(attempt))
            )
        }
        let record = try await ledger.record(localID: "r1")
        XCTAssertEqual(record?.state, .blockedStorage)
        XCTAssertEqual(record?.automaticAttemptCount, 6)
    }

    func testAcknowledgementCommitsReceiptBeforeCleanupEligibility() async throws {
        let ledger = try makeLedger()
        try await ledger.insert(fixtureRecord(localID: "r1"))
        _ = try await ledger.claimNextDue(ownerUserID: "u1", organizationID: "o1")
        try await ledger.recordAcknowledgement(localID: "r1", serverRecordID: "server-1", acknowledgedAt: Date(timeIntervalSince1970: 100))
        let record = try await ledger.record(localID: "r1")
        XCTAssertEqual(record?.state, .acknowledged)
        XCTAssertEqual(record?.serverRecordID, "server-1")
    }

    func testForbiddenTransitionFromAcknowledgedToSending() async throws {
        let ledger = try makeLedger()
        try await ledger.insert(fixtureRecord(localID: "r1"))
        _ = try await ledger.claimNextDue(ownerUserID: "u1", organizationID: "o1")
        try await ledger.recordAcknowledgement(localID: "r1", serverRecordID: "s1", acknowledgedAt: Date())
        do {
            try await ledger.recordRetry(localID: "r1", error: LedgerError(.network, code: "err", safeMessage: "msg"), nextAttemptAt: Date())
            XCTFail("Should have thrown")
        } catch RecordLedgerError.invalidTransition {}
    }

    func testOwnerOrganizationIsolation() async throws {
        let ledger = try makeLedger()
        try await ledger.insert(fixtureRecord(localID: "r1", ownerUserID: "u1", organizationID: "o1"))
        try await ledger.insert(fixtureRecord(localID: "r2", ownerUserID: "u2", organizationID: "o1"))
        let u1Records = try await ledger.records(ownerUserID: "u1", organizationID: "o1")
        XCTAssertEqual(u1Records.count, 1)
        XCTAssertEqual(u1Records[0].localID, "r1")
    }

    func testOldestFirstClaim() async throws {
        let ledger = try makeLedger()
        try await ledger.insert(fixtureRecord(localID: "r1", createdAt: Date(timeIntervalSince1970: 100)))
        try await ledger.insert(fixtureRecord(localID: "r2", createdAt: Date(timeIntervalSince1970: 50)))
        let claimed = try await ledger.claimNextDue(ownerUserID: "u1", organizationID: "o1")
        XCTAssertEqual(claimed?.localID, "r2")
    }

    func testRecoverInterruptedSends() async throws {
        let ledger = try makeLedger()
        try await ledger.insert(fixtureRecord(localID: "r1"))
        _ = try await ledger.claimNextDue(ownerUserID: "u1", organizationID: "o1")
        try await ledger.recoverInterruptedSends()
        let record = try await ledger.record(localID: "r1")
        XCTAssertEqual(record?.state, .pending)
    }

    func testSnapshotCounts() async throws {
        let ledger = try makeLedger()
        try await ledger.insert(fixtureRecord(localID: "r1"))
        try await ledger.insert(fixtureRecord(localID: "r2"))
        _ = try await ledger.claimNextDue(ownerUserID: "u1", organizationID: "o1")
        try await ledger.recordAcknowledgement(localID: "r1", serverRecordID: "s1", acknowledgedAt: Date())
        let snapshot = try await ledger.snapshot(ownerUserID: "u1", organizationID: "o1")
        XCTAssertEqual(snapshot.pending, 1)
        XCTAssertEqual(snapshot.sending, 0)
        XCTAssertEqual(snapshot.acknowledgedThisSession, 0)
    }

    func testDiscardRemovesNonAcknowledgedRecord() async throws {
        let ledger = try makeLedger()
        try await ledger.insert(fixtureRecord(localID: "r1"))
        try await ledger.discard(localID: "r1", discardedAt: Date())
        let record = try await ledger.record(localID: "r1")
        XCTAssertEqual(record?.state, .discarded)
    }

    func testDiscardFailsForAcknowledged() async throws {
        let ledger = try makeLedger()
        try await ledger.insert(fixtureRecord(localID: "r1"))
        _ = try await ledger.claimNextDue(ownerUserID: "u1", organizationID: "o1")
        try await ledger.recordAcknowledgement(localID: "r1", serverRecordID: "s1", acknowledgedAt: Date())
        do {
            try await ledger.discard(localID: "r1", discardedAt: Date())
            XCTFail("Should have thrown")
        } catch RecordLedgerError.invalidTransition {}
    }
}
