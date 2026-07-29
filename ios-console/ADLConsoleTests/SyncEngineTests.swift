@testable import ADLConsole
import ConsoleForms
import ConsolePersistence
import XCTest

final class SyncEngineTests: XCTestCase {
    private func makeEngine(
        ledger: RecordLedgerProtocol,
        submitter: MockRecordSubmitter = MockRecordSubmitter(),
        mediaStore: InMemoryCaptureMediaStore = InMemoryCaptureMediaStore(),
        logError: @escaping @Sendable (String) -> Void = { _ in }
    ) -> SyncEngine {
        SyncEngine(ledger: ledger, submitter: submitter, mediaStore: mediaStore, ownerUserID: "u1", organizationID: "o1", logError: logError)
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

    func testDBErrorOnClaimDoesNotHaltEngine() async {
        let ledger = MockRecordLedger()
        ledger.claimNextDueShouldThrow = true
        let submitter = MockRecordSubmitter()
        let logSink = LogSinkRecorder()
        let engine = makeEngine(ledger: ledger, submitter: submitter, logError: logSink.record)

        await engine.trigger(.manual)

        // Engine should return without crashing or hanging.
        XCTAssertEqual(submitter.callCount, 0)
        // The discriminating assertion: a DB error on claimNextDue must be surfaced via the log
        // sink exactly once, not silently swallowed (regression guard for the try? -> do/catch fix).
        XCTAssertEqual(logSink.messages.count, 1)
        XCTAssertTrue(logSink.messages.first?.contains("claimNextDue") ?? false)
    }

    func testCleanDrainDoesNotLogError() async throws {
        let ledger = try RecordLedger(database: .inMemory())
        let record = LedgerRecord(localID: "r1", ownerUserID: "u1", organizationID: "o1", projectID: "p1", schemaVersionID: "sv1", recordTypeKey: "pharmacy", fieldValuesJSON: "{}", state: .pending, createdAt: Date(timeIntervalSince1970: 0), updatedAt: Date(timeIntervalSince1970: 0))
        try await ledger.insert(record, attachments: [])
        let submitter = MockRecordSubmitter()
        let logSink = LogSinkRecorder()
        let engine = makeEngine(ledger: ledger, submitter: submitter, logError: logSink.record)

        await engine.trigger(.manual)

        XCTAssertEqual(submitter.callCount, 1)
        XCTAssertTrue(logSink.messages.isEmpty)
    }
}

/// Captures log messages emitted via an injected `logError` sink, for asserting on behavior that
/// otherwise has no externally observable difference from a silently-swallowed error. Backed by a
/// lock (not an actor) so `record` can be passed directly as a synchronous `@Sendable` closure and
/// observed immediately after `await engine.trigger(...)` returns, with no async hop to race.
private final class LogSinkRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var _messages: [String] = []

    var messages: [String] {
        lock.lock()
        defer { lock.unlock() }
        return _messages
    }

    func record(_ message: String) {
        lock.lock()
        defer { lock.unlock() }
        _messages.append(message)
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

/// Wraps a real in-memory `RecordLedger` so most calls behave normally, but lets tests force
/// `claimNextDue` to throw — simulating a DB error mid-drain. Mirrors `FailingRecordLedger` in
/// LegacyQueueMigratorTests.swift.
private final class MockRecordLedger: RecordLedgerProtocol, @unchecked Sendable {
    private let inner: RecordLedger
    var claimNextDueShouldThrow = false

    init() {
        inner = RecordLedger(database: try! RecordDatabase.inMemory())
    }

    func insert(_ record: LedgerRecord, attachments: [LedgerAttachment]) async throws {
        try await inner.insert(record, attachments: attachments)
    }

    func record(localID: String) async throws -> LedgerRecord? {
        try await inner.record(localID: localID)
    }

    func records(ownerUserID: String, organizationID: String) async throws -> [LedgerRecord] {
        try await inner.records(ownerUserID: ownerUserID, organizationID: organizationID)
    }

    func claimNextDue(ownerUserID: String, organizationID: String) async throws -> LedgerRecord? {
        if claimNextDueShouldThrow {
            throw RecordLedgerError.notRecoverable
        }
        return try await inner.claimNextDue(ownerUserID: ownerUserID, organizationID: organizationID)
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
