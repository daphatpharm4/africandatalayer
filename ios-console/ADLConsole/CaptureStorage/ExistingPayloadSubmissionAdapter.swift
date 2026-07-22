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

final class ExistingPayloadSubmissionAdapter: RecordSubmitting, @unchecked Sendable {
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
        var hydratedFieldPhotos: [String: String] = [:]
        for attachment in attachments {
            let data = try await mediaStore.resolve(attachment)
            let base64 = data.base64EncodedString()
            let dataURL = "data:\(attachment.mimeType);base64,\(base64)"
            if attachment.placement.hasPrefix("schemaField:") {
                let fieldKey = String(attachment.placement.dropFirst("schemaField:".count))
                hydratedFieldPhotos[fieldKey] = dataURL
            } else if attachment.placement.hasPrefix("schemaField("), attachment.placement.hasSuffix(")") {
                let start = attachment.placement.index(attachment.placement.startIndex, offsetBy: "schemaField(".count)
                let end = attachment.placement.index(before: attachment.placement.endIndex)
                hydratedFieldPhotos[String(attachment.placement[start..<end])] = dataURL
            } else {
                hydratedPhotoRefs.append(dataURL)
            }
        }

        let storedData = record.fieldValuesJSON.data(using: .utf8)
        let storedDraft = storedData.flatMap { try? JSONDecoder().decode(RecordDraft.self, from: $0) }
        var fieldData: [String: JSONValue]
        if let storedDraft {
            fieldData = storedDraft.data
        } else if let storedData,
                  let decoded = try? JSONDecoder().decode([String: JSONValue].self, from: storedData) {
            // Backward compatibility for records created before the durable
            // envelope began storing the complete RecordDraft.
            fieldData = decoded
        } else {
            fieldData = [:]
        }
        for (fieldKey, dataURL) in hydratedFieldPhotos {
            fieldData[fieldKey] = .string(dataURL)
        }

        let platformRecord = try await apiClient.createPlatformRecord(
            projectId: record.projectID,
            schemaVersionId: record.schemaVersionID,
            recordTypeKey: record.recordTypeKey,
            data: fieldData,
            evidence: PlatformRecordEvidence(
                gps: storedDraft?.gps.map {
                    PlatformRecordGps(
                        latitude: $0.latitude,
                        longitude: $0.longitude,
                        accuracyMeters: $0.accuracyMeters
                    )
                },
                photos: hydratedPhotoRefs,
                notes: storedDraft?.notes,
                capturedAt: storedDraft?.capturedAt ?? ISO8601DateFormatter().string(from: record.createdAt),
                device: storedDraft?.device,
                photoMetadata: storedDraft?.photoMetadata,
                clientExif: storedDraft?.clientExif,
                gpsIntegrity: storedDraft?.gpsIntegrity
            ),
            idempotencyKey: localID,
            pointId: storedDraft?.pointId
        )

        return platformRecord.id
    }

    func submit(_ record: LedgerRecord) async throws -> String {
        do {
            return try await submit(localID: record.localID)
        } catch let error as PlatformAPIError {
            switch error.status {
            case -1:
                throw SyncSubmissionError.retryable(code: "transport", message: error.message)
            case 401:
                throw SyncSubmissionError.authentication(code: "unauthorized", message: error.message)
            case 403:
                throw SyncSubmissionError.authorization(code: "forbidden", message: error.message)
            case 500..<600:
                throw SyncSubmissionError.retryable(code: "server_\(error.status)", message: error.message)
            case 400, 409, 422:
                throw SyncSubmissionError.validation(code: "http_\(error.status)", message: error.message)
            default:
                throw SyncSubmissionError.validation(code: "http_\(error.status)", message: error.message)
            }
        } catch let error as CaptureMediaStoreError {
            throw SyncSubmissionError.storage(code: "media_integrity", message: String(describing: error))
        }
    }
}
