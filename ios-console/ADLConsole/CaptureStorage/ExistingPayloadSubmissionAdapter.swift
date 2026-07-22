import ConsoleAPI
import ConsoleForms
import ConsoleModels
import ConsolePersistence
import Foundation

enum ExistingPayloadSubmissionError: Error, Equatable {
    case recordNotFound
    case attachmentNotFound
    case checksumMismatch(String)
    case networkFailure(String)
    case permanentFailure(String)
}

final class ExistingPayloadSubmissionAdapter {
    private let ledger: RecordLedgerProtocol
    private let mediaStore: CaptureMediaStoreProtocol
    private let apiClient: PlatformAPIClient
    private let attachmentLoader: @Sendable (String) async throws -> [LedgerAttachment]

    init(
        ledger: RecordLedgerProtocol,
        mediaStore: CaptureMediaStoreProtocol,
        apiClient: PlatformAPIClient,
        attachmentLoader: @escaping @Sendable (String) async throws -> [LedgerAttachment]
    ) {
        self.ledger = ledger
        self.mediaStore = mediaStore
        self.apiClient = apiClient
        self.attachmentLoader = attachmentLoader
    }

    func submit(localID: String) async throws -> String {
        guard let record = try await ledger.record(localID: localID) else {
            throw ExistingPayloadSubmissionError.recordNotFound
        }

        let attachments = try await attachmentLoader(localID)

        var hydratedPhotoRefs: [String] = []
        for attachment in attachments {
            let data = try await mediaStore.resolve(attachment)
            let base64 = data.base64EncodedString()
            let dataURL = "data:\(attachment.mimeType);base64,\(base64)"
            hydratedPhotoRefs.append(dataURL)
        }

        let fieldData: [String: JSONValue]
        if let data = record.fieldValuesJSON.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String: JSONValue].self, from: data) {
            fieldData = decoded
        } else {
            fieldData = [:]
        }

        let platformRecord = try await apiClient.createPlatformRecord(
            projectId: record.projectID,
            schemaVersionId: record.schemaVersionID,
            recordTypeKey: record.recordTypeKey,
            data: fieldData,
            evidence: PlatformRecordEvidence(
                photos: hydratedPhotoRefs,
                capturedAt: ISO8601DateFormatter().string(from: record.createdAt)
            ),
            idempotencyKey: localID,
            pointId: nil
        )

        return platformRecord.id
    }
}
