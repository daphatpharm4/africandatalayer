import ConsoleForms
import ConsolePersistence
import Foundation

enum LegacyQueueMigrationResult: Equatable, Sendable {
    case success(importedCount: Int)
    case partial(importedCount: Int, errors: [String])
    case failed(reason: String)

    var importedCount: Int {
        switch self {
        case .success(let c): return c
        case .partial(let c, _): return c
        case .failed: return 0
        }
    }

    var isComplete: Bool {
        if case .success = self { return true }
        return false
    }
}

enum LegacyQueueMigratorError: Error, Equatable {
    case noLegacySource
    case readFailed(String)
    case decodeFailed(String)
    case ledgerWriteFailed(String)
}

final class LegacyQueueMigrator {
    private let legacyStore: RecordQueueStore
    private let ledger: RecordLedgerProtocol
    private let ownerUserID: String
    private let organizationID: String

    init(
        legacyStore: RecordQueueStore,
        ledger: RecordLedgerProtocol,
        ownerUserID: String,
        organizationID: String
    ) {
        self.legacyStore = legacyStore
        self.ledger = ledger
        self.ownerUserID = ownerUserID
        self.organizationID = organizationID
    }

    func migrate() async -> LegacyQueueMigrationResult {
        let legacyItems: [RecordQueueItem]
        do {
            legacyItems = try legacyStore.load()
        } catch {
            return .failed(reason: "Could not read legacy queue: \(error.localizedDescription)")
        }

        guard !legacyItems.isEmpty else {
            return .success(importedCount: 0)
        }

        var importedCount = 0
        var errors: [String] = []

        for item in legacyItems {
            let fieldValuesJSON: String
            if let jsonData = try? JSONEncoder().encode(item.draft.data),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                fieldValuesJSON = jsonString
            } else {
                fieldValuesJSON = "{}"
            }

            let record = LedgerRecord(
                localID: item.id,
                ownerUserID: ownerUserID,
                organizationID: organizationID,
                projectID: item.draft.projectId,
                schemaVersionID: item.draft.schemaVersionId,
                recordTypeKey: item.draft.recordTypeKey,
                fieldValuesJSON: fieldValuesJSON,
                state: Self.ledgerState(from: item.status),
                automaticAttemptCount: item.attempts,
                nextAttemptAt: item.nextRetryAt,
                lastErrorClassification: nil,
                lastErrorCode: nil,
                lastErrorSafeMessage: item.lastError,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            )

            let attachment = item.draft.photoRefs.enumerated().map { index, ref in
                LedgerAttachment(
                    recordLocalID: item.id,
                    placement: "recordEvidence",
                    ordinal: index,
                    relativePath: ref,
                    sha256: ref,
                    mimeType: "image/jpeg",
                    pixelWidth: nil,
                    pixelHeight: nil,
                    byteCount: 0,
                    createdAt: item.createdAt
                )
            }

            do {
                try await ledger.insert(record, attachments: attachment)
                importedCount += 1
            } catch {
                errors.append("Failed to insert record \(item.id): \(error.localizedDescription)")
            }
        }

        if errors.isEmpty {
            return .success(importedCount: importedCount)
        } else if importedCount > 0 {
            return .partial(importedCount: importedCount, errors: errors)
        } else {
            return .failed(reason: errors.joined(separator: "; "))
        }
    }

    private static func ledgerState(from queueStatus: RecordQueueItemStatus) -> RecordState {
        switch queueStatus {
        case .pending: return .pending
        case .syncing: return .pending
        case .failed: return .retryScheduled
        case .synced: return .acknowledged
        }
    }
}
