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
    func submit(_ record: LedgerRecord) async throws
}

actor SyncEngine {
    private let ledger: RecordLedger
    private let submitter: any RecordSubmitting
    private let mediaStore: any CaptureMediaStoreProtocol
    private let ownerUserID: String
    private let organizationID: String
    private var drainTask: Task<Void, Never>?

    init(
        ledger: RecordLedger,
        submitter: any RecordSubmitting,
        mediaStore: any CaptureMediaStoreProtocol,
        ownerUserID: String,
        organizationID: String
    ) {
        self.ledger = ledger
        self.submitter = submitter
        self.mediaStore = mediaStore
        self.ownerUserID = ownerUserID
        self.organizationID = organizationID
    }

    func trigger(_ trigger: SyncTrigger) {
        guard drainTask == nil else { return }
        drainTask = Task { await drain(); drainTask = nil }
    }

    private func drain() async {
        while let record = try? await ledger.claimNextDue(ownerUserID: ownerUserID, organizationID: organizationID) {
            if Task.isCancelled { break }
            let now = Date()
            do {
                try await submitter.submit(record)
                try await ledger.recordAcknowledgement(localID: record.localID, serverRecordID: record.localID, acknowledgedAt: now)
                try await mediaStore.discard(recordLocalID: record.localID)
            } catch let error as RecordSubmitError {
                switch error {
                case .retryable:
                    let ledgerError = LedgerError(.network, code: "retryable", safeMessage: error.localizedDescription)
                    let nextAttempt = now.addingTimeInterval(min(30, pow(2, Double(record.automaticAttemptCount + 1))))
                    try? await ledger.recordRetry(localID: record.localID, error: ledgerError, nextAttemptAt: nextAttempt)
                    break
                case .permanent:
                    let ledgerError = LedgerError(.unknown, code: "permanent", safeMessage: error.localizedDescription)
                    try? await ledger.recordBlock(localID: record.localID, state: .blockedStorage, error: ledgerError)
                }
            } catch {
                let ledgerError = LedgerError(.unknown, code: "unknown", safeMessage: error.localizedDescription)
                let nextAttempt = now.addingTimeInterval(30)
                try? await ledger.recordRetry(localID: record.localID, error: ledgerError, nextAttemptAt: nextAttempt)
                break
            }
        }
    }
}
