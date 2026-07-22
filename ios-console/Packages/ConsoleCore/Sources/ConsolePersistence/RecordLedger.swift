import Foundation
import GRDB

public enum RecordLedgerError: Error, Equatable {
    case invalidTransition
    case recordNotFound
    case notRecoverable
}

public struct LedgerImportItem: Sendable {
    public let record: LedgerRecord
    public let attachments: [LedgerAttachment]

    public init(record: LedgerRecord, attachments: [LedgerAttachment]) {
        self.record = record
        self.attachments = attachments
    }
}

public struct LedgerMigrationReceipt: Sendable {
    public let name: String
    public let sourceSHA256: String
    public let importedCount: Int

    public init(name: String, sourceSHA256: String, importedCount: Int) {
        self.name = name
        self.sourceSHA256 = sourceSHA256
        self.importedCount = importedCount
    }
}

public protocol RecordLedgerProtocol: Sendable {
    func insert(_ record: LedgerRecord, attachments: [LedgerAttachment]) async throws
    func importAtomically(_ items: [LedgerImportItem], migration: LedgerMigrationReceipt?) async throws
    func migrationSourceSHA256(name: String) async throws -> String?
    func record(localID: String) async throws -> LedgerRecord?
    func records(ownerUserID: String, organizationID: String) async throws -> [LedgerRecord]
    func attachments(localID: String) async throws -> [LedgerAttachment]
    func claimNextDue(ownerUserID: String, organizationID: String) async throws -> LedgerRecord?
    func recordRetry(localID: String, error: LedgerError, nextAttemptAt: Date) async throws
    func scheduleImmediateRetry(localID: String) async throws
    func recordBlock(localID: String, state: RecordState, error: LedgerError) async throws
    func recordAcknowledgement(localID: String, serverRecordID: String, acknowledgedAt: Date) async throws
    func discard(localID: String, discardedAt: Date) async throws
    func recoverInterruptedSends() async throws
    func snapshot(ownerUserID: String, organizationID: String) async throws -> RecordLedgerSnapshot
}

public extension RecordLedgerProtocol {
    func importAtomically(_ items: [LedgerImportItem], migration: LedgerMigrationReceipt? = nil) async throws {
        for item in items { try await insert(item.record, attachments: item.attachments) }
    }
    func migrationSourceSHA256(name: String) async throws -> String? { nil }
    func attachments(localID: String) async throws -> [LedgerAttachment] { [] }
    func scheduleImmediateRetry(localID: String) async throws {
        throw RecordLedgerError.notRecoverable
    }
}

public final class RecordLedger: RecordLedgerProtocol {
    private let database: RecordDatabase
    private let now: @Sendable () -> Date

    public init(database: RecordDatabase, now: @escaping @Sendable () -> Date = { Date() }) {
        self.database = database
        self.now = now
    }

    public func insert(_ record: LedgerRecord, attachments: [LedgerAttachment] = []) async throws {
        try await database.writer.write { db in
            try record.insert(db)
            for attachment in attachments {
                try attachment.insert(db)
            }
        }
    }

    public func importAtomically(_ items: [LedgerImportItem], migration: LedgerMigrationReceipt? = nil) async throws {
        try await database.writer.write { db in
            for item in items {
                try item.record.insert(db)
                for attachment in item.attachments { try attachment.insert(db) }
            }
            if let migration {
                try db.execute(
                    sql: "INSERT OR REPLACE INTO queue_migrations (name, executed_at, source_sha256, imported_count) VALUES (?, ?, ?, ?)",
                    arguments: [migration.name, self.now(), migration.sourceSHA256, migration.importedCount]
                )
            }
        }
    }

    public func migrationSourceSHA256(name: String) async throws -> String? {
        try await database.reader.read { db in
            try String.fetchOne(
                db,
                sql: "SELECT source_sha256 FROM queue_migrations WHERE name = ?",
                arguments: [name]
            )
        }
    }

    public func record(localID: String) async throws -> LedgerRecord? {
        try await database.reader.read { db in
            try LedgerRecord.filter(Column("local_id") == localID).fetchOne(db)
        }
    }

    public func records(ownerUserID: String, organizationID: String) async throws -> [LedgerRecord] {
        try await database.reader.read { db in
            try LedgerRecord
                .filter(Column("owner_user_id") == ownerUserID && Column("organization_id") == organizationID)
                .order(Column("created_at").asc)
                .fetchAll(db)
        }
    }

    public func attachments(localID: String) async throws -> [LedgerAttachment] {
        try await database.reader.read { db in
            try LedgerAttachment
                .filter(Column("record_local_id") == localID)
                .order(Column("placement").asc, Column("ordinal").asc)
                .fetchAll(db)
        }
    }

    public func claimNextDue(ownerUserID: String, organizationID: String) async throws -> LedgerRecord? {
        let now = self.now()
        return try await database.writer.write { db in
            let sql = """
                SELECT * FROM queued_records
                WHERE owner_user_id = ? AND organization_id = ?
                AND state IN (?, ?) AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
                ORDER BY created_at ASC LIMIT 1
                """
            let record = try LedgerRecord.fetchOne(db, sql: sql, arguments: [ownerUserID, organizationID, RecordState.pending.rawValue, RecordState.retryScheduled.rawValue, now])
            guard var found = record else { return nil }
            try found.updateChanges(db) { r in
                r.state = .sending
                r.updatedAt = self.now()
            }
            return try LedgerRecord.fetchOne(db, key: found.localID)
        }
    }

    public func recordRetry(localID: String, error: LedgerError, nextAttemptAt: Date) async throws {
        try await database.writer.write { db in
            guard var record = try LedgerRecord.fetchOne(db, key: localID) else {
                throw RecordLedgerError.recordNotFound
            }
            guard record.state == .sending else {
                throw RecordLedgerError.invalidTransition
            }
            let currentAttempt = record.automaticAttemptCount + 1
            let finalState: RecordState = currentAttempt >= 6 ? .blockedStorage : .retryScheduled
            try record.updateChanges(db) { r in
                r.state = finalState
                r.automaticAttemptCount = currentAttempt
                r.nextAttemptAt = nextAttemptAt
                r.lastErrorClassification = error.classification.rawValue
                r.lastErrorCode = error.code
                r.lastErrorSafeMessage = error.safeMessage
                r.updatedAt = self.now()
            }
        }
    }

    public func scheduleImmediateRetry(localID: String) async throws {
        try await database.writer.write { db in
            guard var record = try LedgerRecord.fetchOne(db, key: localID) else {
                throw RecordLedgerError.recordNotFound
            }
            guard record.state.isRecoverable, record.state != .sending else {
                throw RecordLedgerError.invalidTransition
            }
            try record.updateChanges(db) { value in
                value.state = .pending
                value.nextAttemptAt = nil
                value.lastErrorClassification = nil
                value.lastErrorCode = nil
                value.lastErrorSafeMessage = nil
                value.updatedAt = self.now()
            }
        }
    }

    public func recordBlock(localID: String, state: RecordState, error: LedgerError) async throws {
        try await database.writer.write { db in
            guard var record = try LedgerRecord.fetchOne(db, key: localID) else {
                throw RecordLedgerError.recordNotFound
            }
            guard record.state == .sending else {
                throw RecordLedgerError.invalidTransition
            }
            try record.updateChanges(db) { r in
                r.state = state
                r.lastErrorClassification = error.classification.rawValue
                r.lastErrorCode = error.code
                r.lastErrorSafeMessage = error.safeMessage
                r.updatedAt = self.now()
            }
        }
    }

    public func recordAcknowledgement(localID: String, serverRecordID: String, acknowledgedAt: Date) async throws {
        try await database.writer.write { db in
            guard var record = try LedgerRecord.fetchOne(db, key: localID) else {
                throw RecordLedgerError.recordNotFound
            }
            guard record.state == .sending else {
                throw RecordLedgerError.invalidTransition
            }
            try record.updateChanges(db) { r in
                r.state = .acknowledged
                r.serverRecordID = serverRecordID
                r.acknowledgedAt = acknowledgedAt
                r.updatedAt = self.now()
            }
        }
    }

    public func discard(localID: String, discardedAt: Date) async throws {
        try await database.writer.write { db in
            guard var record = try LedgerRecord.fetchOne(db, key: localID) else {
                throw RecordLedgerError.recordNotFound
            }
            guard record.state.isRecoverable else {
                throw RecordLedgerError.invalidTransition
            }
            try record.updateChanges(db) { r in
                r.state = .discarded
                r.discardedAt = discardedAt
                r.updatedAt = self.now()
            }
        }
    }

    public func recoverInterruptedSends() async throws {
        let now = self.now()
        try await database.writer.write { db in
            let sql = "UPDATE queued_records SET state = ?, updated_at = ? WHERE state = ?"
            try db.execute(sql: sql, arguments: [RecordState.pending.rawValue, now, RecordState.sending.rawValue])
        }
    }

    public func snapshot(ownerUserID: String, organizationID: String) async throws -> RecordLedgerSnapshot {
        try await database.reader.read { db in
            let ownerOrg = Column("owner_user_id") == ownerUserID && Column("organization_id") == organizationID
            let base = LedgerRecord.filter(ownerOrg)
            let pending = try base.filter(Column("state") == RecordState.pending.rawValue).fetchCount(db)
            let sending = try base.filter(Column("state") == RecordState.sending.rawValue).fetchCount(db)
            let retrying = try base.filter(Column("state") == RecordState.retryScheduled.rawValue).fetchCount(db)
            let blockedAuth = try base.filter(Column("state") == RecordState.blockedAuthentication.rawValue).fetchCount(db)
            let blockedAuthz = try base.filter(Column("state") == RecordState.blockedAuthorization.rawValue).fetchCount(db)
            let blockedVal = try base.filter(Column("state") == RecordState.blockedValidation.rawValue).fetchCount(db)
            let blockedStor = try base.filter(Column("state") == RecordState.blockedStorage.rawValue).fetchCount(db)
            return RecordLedgerSnapshot(
                pending: pending,
                sending: sending,
                retrying: retrying,
                blocked: blockedAuth + blockedAuthz + blockedVal + blockedStor,
                acknowledgedThisSession: 0
            )
        }
    }
}
