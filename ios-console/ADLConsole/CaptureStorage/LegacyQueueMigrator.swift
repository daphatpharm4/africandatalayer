import ConsoleForms
import ConsolePersistence
import CryptoKit
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
    private let mediaStore: any CaptureMediaStoreProtocol

    init(
        legacyStore: RecordQueueStore,
        ledger: RecordLedgerProtocol,
        ownerUserID: String,
        organizationID: String,
        mediaStore: any CaptureMediaStoreProtocol = InMemoryCaptureMediaStore()
    ) {
        self.legacyStore = legacyStore
        self.ledger = ledger
        self.ownerUserID = ownerUserID
        self.organizationID = organizationID
        self.mediaStore = mediaStore
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

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        guard let sourceData = try? encoder.encode(legacyItems) else {
            return .failed(reason: "Could not fingerprint the legacy queue")
        }
        let sourceSHA256 = SHA256.hash(data: sourceData).map { String(format: "%02x", $0) }.joined()
        if (try? await ledger.migrationSourceSHA256(name: "legacy-record-queue-v1")) == sourceSHA256 {
            try? archiveSource()
            return .success(importedCount: 0)
        }

        var imports: [LedgerImportItem] = []
        var stagedRecordIDs: [String] = []

        for item in legacyItems {
            let fieldValuesJSON: String
            if let jsonData = try? JSONEncoder().encode(item.draft.data),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                fieldValuesJSON = jsonString
            } else {
                fieldValuesJSON = "{}"
            }

            // Preserve the original idempotency key as the durable local ID so
            // a response-lost legacy submission cannot be duplicated.
            let localID = item.idempotencyKey
            let record = LedgerRecord(
                localID: localID,
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

            do {
                var attachments: [LedgerAttachment] = []
                for ref in item.draft.photoRefs {
                    guard let comma = ref.firstIndex(of: ","), ref.hasPrefix("data:image/"),
                          let data = Data(base64Encoded: String(ref[ref.index(after: comma)...])) else {
                        throw LegacyQueueMigratorError.decodeFailed("Invalid photo data for \(item.id)")
                    }
                    let prepared = try CaptureMediaPreparer.prepareData(data)
                    let attachment = try await mediaStore.stage(
                        prepared,
                        ownerUserID: ownerUserID,
                        organizationID: organizationID,
                        recordLocalID: localID
                    )
                    attachments.append(attachment)
                }
                stagedRecordIDs.append(localID)
                imports.append(LedgerImportItem(record: record, attachments: attachments))
            } catch {
                for recordID in stagedRecordIDs { try? await mediaStore.discard(recordLocalID: recordID) }
                return .failed(reason: "Could not prepare legacy record \(item.id): \(error.localizedDescription)")
            }
        }

        do {
            try await ledger.importAtomically(
                imports,
                migration: LedgerMigrationReceipt(
                    name: "legacy-record-queue-v1",
                    sourceSHA256: sourceSHA256,
                    importedCount: imports.count
                )
            )
            try archiveSource()
            return .success(importedCount: imports.count)
        } catch {
            for recordID in stagedRecordIDs { try? await mediaStore.discard(recordLocalID: recordID) }
            return .failed(reason: "Legacy migration rolled back: \(error.localizedDescription)")
        }
    }

    private func archiveSource() throws {
        if let archivingStore = legacyStore as? any LegacyQueueArchivingStore {
            try archivingStore.archiveAfterMigration()
        } else {
            try legacyStore.save([])
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
