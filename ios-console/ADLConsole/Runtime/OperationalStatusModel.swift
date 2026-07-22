import ConsolePersistence
import Foundation

enum OperationalStatus: Equatable, Sendable {
    case offline(expiresAt: Date?)
    case connecting
    case pending(count: Int)
    case syncing(current: Int, total: Int)
    case blocked(count: Int)
    case upToDate(lastSuccessfulSyncAt: Date?)
}

extension OperationalStatus {
    static func derive(
        path: ConnectivityState,
        session: SessionAvailability,
        ledger: RecordLedgerSnapshot,
        progress: SyncProgress?
    ) -> OperationalStatus {
        if ledger.blocked > 0 {
            return .blocked(count: ledger.blocked)
        }
        if let progress {
            return .syncing(current: progress.current, total: progress.total)
        }
        if ledger.pending + ledger.sending + ledger.retrying > 0 {
            return .pending(count: ledger.pending + ledger.sending + ledger.retrying)
        }
        switch session {
        case .offlineAuthorized(let snapshot):
            return .offline(expiresAt: snapshot.expiresAt)
        case .restoring, .reauthenticationRequired:
            return .connecting
        case .signedOut:
            return .offline(expiresAt: nil)
        case .onlineVerified:
            return .upToDate(lastSuccessfulSyncAt: Date())
        }
    }
}
