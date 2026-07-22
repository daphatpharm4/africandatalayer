import ConsoleAPI
import ConsoleForms
import ConsoleModels
import ConsolePersistence
import Foundation

struct CaptureIntentMedia: Equatable, Sendable {
    let prepared: PreparedCaptureMedia
    let placement: String
}

struct CaptureIntent: Equatable, Sendable {
    let projectID: String
    let schemaVersionID: String
    let recordTypeKey: String
    let fieldValuesJSON: String
    let ownerUserID: String
    let organizationID: String
    let media: [CaptureIntentMedia]
}

enum CaptureCoordinatorError: Error, Equatable {
    case ledgerFailure(RecordLedgerError)
    case mediaStoreFailure(CaptureMediaStoreError)
}

@MainActor
final class CaptureCoordinator {
    private let mediaStore: CaptureMediaStoreProtocol
    private let ledger: RecordLedgerProtocol

    init(mediaStore: CaptureMediaStoreProtocol, ledger: RecordLedgerProtocol) {
        self.mediaStore = mediaStore
        self.ledger = ledger
    }

    func persist(_ intent: CaptureIntent) async throws -> String {
        let localID = UUID().uuidString
        let now = Date()

        var attachments: [LedgerAttachment] = []
        for mediaItem in intent.media {
            let attachment = try await mediaStore.stage(
                mediaItem.prepared,
                ownerUserID: intent.ownerUserID,
                organizationID: intent.organizationID,
                recordLocalID: localID
            )
            attachments.append(attachment)
        }

        let record = LedgerRecord(
            localID: localID,
            ownerUserID: intent.ownerUserID,
            organizationID: intent.organizationID,
            projectID: intent.projectID,
            schemaVersionID: intent.schemaVersionID,
            recordTypeKey: intent.recordTypeKey,
            fieldValuesJSON: intent.fieldValuesJSON,
            state: .pending,
            createdAt: now,
            updatedAt: now
        )

        do {
            try await ledger.insert(record, attachments: attachments)
        } catch let error as RecordLedgerError {
            throw CaptureCoordinatorError.ledgerFailure(error)
        } catch {
            throw CaptureCoordinatorError.ledgerFailure(.invalidTransition)
        }

        return localID
    }
}
