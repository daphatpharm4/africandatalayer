import ConsoleForms
import ConsolePersistence
import Foundation

enum SyncTrigger: String, Sendable {
    case recordPersisted, foreground, reconnected, manual, backgroundRefresh
}

struct SyncProgress: Equatable, Sendable {
    let current: Int
    let total: Int
}

protocol RecordSubmitting: Sendable {
    func submit(_ record: LedgerRecord) async throws -> String
}

enum SyncSubmissionError: Error, Equatable, Sendable {
    case retryable(code: String, message: String)
    case authentication(code: String, message: String)
    case authorization(code: String, message: String)
    case validation(code: String, message: String)
    case storage(code: String, message: String)
}

actor SyncEngine {
    private let ledger: RecordLedger
    private let submitter: any RecordSubmitting
    private let mediaStore: any CaptureMediaStoreProtocol
    private let ownerUserID: String
    private let organizationID: String
    private let jitter: @Sendable (TimeInterval) -> TimeInterval
    private var drainTask: Task<Void, Never>?

    init(
        ledger: RecordLedger,
        submitter: any RecordSubmitting,
        mediaStore: any CaptureMediaStoreProtocol,
        ownerUserID: String,
        organizationID: String,
        jitter: @escaping @Sendable (TimeInterval) -> TimeInterval = { delay in
            delay * Double.random(in: 0.8...1.2)
        }
    ) {
        self.ledger = ledger
        self.submitter = submitter
        self.mediaStore = mediaStore
        self.ownerUserID = ownerUserID
        self.organizationID = organizationID
        self.jitter = jitter
    }

    func trigger(_ trigger: SyncTrigger) async {
        if let drainTask {
            await drainTask.value
            return
        }
        let task = Task { await drain() }
        drainTask = task
        await task.value
        drainTask = nil
    }

    private func drain() async {
        while let record = try? await ledger.claimNextDue(ownerUserID: ownerUserID, organizationID: organizationID) {
            if Task.isCancelled { break }
            let now = Date()
            do {
                let serverRecordID = try await submitter.submit(record)
                try await ledger.recordAcknowledgement(localID: record.localID, serverRecordID: serverRecordID, acknowledgedAt: now)
                try await mediaStore.removeAcknowledged(recordLocalID: record.localID)
            } catch let error as SyncSubmissionError {
                switch error {
                case .retryable(let code, let message):
                    let ledgerError = LedgerError(.network, code: code, safeMessage: message)
                    let baseDelay = min(300, pow(2, Double(record.automaticAttemptCount + 1)))
                    try? await ledger.recordRetry(localID: record.localID, error: ledgerError, nextAttemptAt: now.addingTimeInterval(jitter(baseDelay)))
                    return
                case .authentication(let code, let message):
                    try? await ledger.recordBlock(localID: record.localID, state: .blockedAuthentication, error: LedgerError(.authentication, code: code, safeMessage: message))
                    return
                case .authorization(let code, let message):
                    try? await ledger.recordBlock(localID: record.localID, state: .blockedAuthorization, error: LedgerError(.authorization, code: code, safeMessage: message))
                    return
                case .validation(let code, let message):
                    try? await ledger.recordBlock(localID: record.localID, state: .blockedValidation, error: LedgerError(.validation, code: code, safeMessage: message))
                case .storage(let code, let message):
                    try? await ledger.recordBlock(localID: record.localID, state: .blockedStorage, error: LedgerError(.storage, code: code, safeMessage: message))
                }
            } catch {
                let ledgerError = LedgerError(.unknown, code: "unknown", safeMessage: error.localizedDescription)
                let nextAttempt = now.addingTimeInterval(30)
                try? await ledger.recordRetry(localID: record.localID, error: ledgerError, nextAttemptAt: nextAttempt)
                return
            }
        }
    }
}
