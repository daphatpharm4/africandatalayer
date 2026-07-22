import ConsoleAPI
import ConsoleForms
import ConsoleModels
import ConsolePersistence
import Foundation

@MainActor
final class PendingWorkViewModel: ObservableObject {
    enum PendingWorkAction: Equatable {
        case retry
        case signIn
        case export
        case discard
    }

    enum PendingError: Equatable {
        case authentication
        case authorization
        case validation
        case storage
        case network
        case unknown(String)
    }

    struct PendingItem: Identifiable, Equatable {
        let id: String
        let recordTypeKey: String
        let state: RecordState
        let error: PendingError?
        let createdAt: Date
        let updatedAt: Date
    }

    enum ViewState: Equatable {
        case loading
        case loaded(items: [PendingItem])
        case empty
        case failed(String)
    }

    @Published private(set) var viewState: ViewState = .loading
    @Published var discardConfirmationItem: PendingItem?
    @Published private(set) var isExporting = false
    @Published private(set) var isRetrying = false

    let language: ConsoleLanguage

    private let ledger: RecordLedgerProtocol
    private let mediaStore: CaptureMediaStoreProtocol
    private let ownerUserID: String
    private let organizationID: String

    init(
        ledger: RecordLedgerProtocol,
        mediaStore: CaptureMediaStoreProtocol,
        ownerUserID: String,
        organizationID: String,
        language: ConsoleLanguage
    ) {
        self.ledger = ledger
        self.mediaStore = mediaStore
        self.ownerUserID = ownerUserID
        self.organizationID = organizationID
        self.language = language
    }

    func loadItems() async {
        viewState = .loading
        do {
            let records = try await ledger.records(ownerUserID: ownerUserID, organizationID: organizationID)
            let items = records.map { record in
                PendingItem(
                    id: record.localID,
                    recordTypeKey: record.recordTypeKey,
                    state: record.state,
                    error: Self.classifyError(record),
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt
                )
            }
            if items.isEmpty {
                viewState = .empty
            } else {
                viewState = .loaded(items: items)
            }
        } catch {
            viewState = .failed(String(describing: error))
        }
    }

    func requestDiscard(_ item: PendingItem) {
        discardConfirmationItem = item
    }

    func cancelDiscard() {
        discardConfirmationItem = nil
    }

    func confirmDiscard() async {
        guard let item = discardConfirmationItem else { return }
        discardConfirmationItem = nil
        guard item.state.isRecoverable else { return }
        do {
            try await ledger.discard(localID: item.id, discardedAt: Date())
            try await mediaStore.discard(recordLocalID: item.id)
        } catch {
            // discard failure is surfaced on next load
        }
        await loadItems()
    }

    func retryItem(_ item: PendingItem) async {
        guard item.state == .retryScheduled || item.state == .pending else { return }
        isRetrying = true
        do {
            try await ledger.recordRetry(
                localID: item.id,
                error: LedgerError(.network, code: "manual-retry", safeMessage: "Manual retry"),
                nextAttemptAt: Date()
            )
        } catch {}
        isRetrying = false
        await loadItems()
    }

    func exportItems() {
        isExporting = true
        // System share sheet integration — placeholder triggers external call
        isExporting = false
    }

    private static func classifyError(_ record: LedgerRecord) -> PendingError? {
        switch record.state {
        case .blockedAuthentication: return .authentication
        case .blockedAuthorization: return .authorization
        case .blockedValidation: return .validation
        case .blockedStorage: return .storage
        case .retryScheduled:
            if let classification = record.lastErrorClassification {
                switch classification {
                case "network": return .network
                case "server": return .network
                case "validation": return .validation
                default: return .unknown(record.lastErrorSafeMessage ?? classification)
                }
            }
            return .network
        case .pending, .sending: return nil
        case .acknowledged, .discarded: return nil
        }
    }
}
