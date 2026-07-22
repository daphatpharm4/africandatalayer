@testable import ADLConsole
import ConsoleAPI
import ConsoleForms
import ConsoleModels
import ConsolePersistence
import CryptoKit
import XCTest

final class ExistingPayloadSubmissionAdapterTests: XCTestCase {
    private let createRecordJSON = Data("""
    {"record": {
        "id": "server-rec-1",
        "projectId": "proj-1",
        "organizationId": "org-1",
        "schemaVersionId": "sv-1",
        "recordTypeKey": "pharmacy",
        "data": {"name": "Acme"},
        "evidence": {"photos": []},
        "status": "pending_review",
        "capturedBy": "user-1",
        "createdAt": "2026-07-19T10:00:00.000Z"
    }}
    """.utf8)

    private func makeAdapter(
        transport: RoutingMockPlatformTransport,
        ledger: RecordLedgerProtocol,
        mediaStore: CaptureMediaStoreProtocol,
        attachmentLoader: @escaping @Sendable (String) async throws -> [LedgerAttachment]
    ) -> ExistingPayloadSubmissionAdapter {
        ExistingPayloadSubmissionAdapter(
            ledger: ledger,
            mediaStore: mediaStore,
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            attachmentLoader: attachmentLoader
        )
    }

    func testSubmitLoadsRecordFromLedger() async throws {
        let database = try RecordDatabase.inMemory()
        let ledger = RecordLedger(database: database)
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(createRecordJSON, forView: "platform_record_create")

        let record = LedgerRecord(
            localID: "local-1",
            ownerUserID: "u1",
            organizationID: "o1",
            projectID: "proj-1",
            schemaVersionID: "sv-1",
            recordTypeKey: "pharmacy",
            fieldValuesJSON: #"{"name":"Acme"}"#,
            state: .pending,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
        try await ledger.insert(record)

        let mediaStore = InMemoryCaptureMediaStore()
        let adapter = makeAdapter(
            transport: transport,
            ledger: ledger,
            mediaStore: mediaStore,
            attachmentLoader: { _ in [] }
        )

        let serverID = try await adapter.submit(localID: "local-1")

        XCTAssertEqual(serverID, "server-rec-1")
    }

    func testSubmitHydratesDataURLsFromAttachments() async throws {
        let database = try RecordDatabase.inMemory()
        let ledger = RecordLedger(database: database)
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(createRecordJSON, forView: "platform_record_create")
        let capturedTransport = CapturingTransport(inner: transport)

        let record = LedgerRecord(
            localID: "local-2",
            ownerUserID: "u1",
            organizationID: "o1",
            projectID: "proj-1",
            schemaVersionID: "sv-1",
            recordTypeKey: "pharmacy",
            fieldValuesJSON: "{}",
            state: .pending,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
        try await ledger.insert(record)

        let mediaStore = InMemoryCaptureMediaStore()
        let sha256 = SHA256.hash(data: Data("photo-data".utf8)).compactMap { String(format: "%02x", $0) }.joined()
        let media = PreparedCaptureMedia(data: Data("photo-data".utf8), mimeType: "image/jpeg", sha256: sha256, pixelWidth: 10, pixelHeight: 10)
        let attachment = try await mediaStore.stage(media, ownerUserID: "u1", organizationID: "o1", recordLocalID: "local-2")

        let adapter = makeAdapter(
            transport: capturedTransport,
            ledger: ledger,
            mediaStore: mediaStore,
            attachmentLoader: { _ in [attachment] }
        )

        _ = try await adapter.submit(localID: "local-2")

        let sentBody = try XCTUnwrap(capturedTransport.lastBody)
        let decoded = try JSONDecoder().decode(SubmitBody.self, from: sentBody)
        let photo = try XCTUnwrap(decoded.evidence.photos.first)
        XCTAssertTrue(photo.hasPrefix("data:image/jpeg;base64,"))
    }

    func testSubmitThrowsOnMissingRecord() async throws {
        let database = try RecordDatabase.inMemory()
        let ledger = RecordLedger(database: database)
        let transport = RoutingMockPlatformTransport()
        let mediaStore = InMemoryCaptureMediaStore()

        let adapter = makeAdapter(
            transport: transport,
            ledger: ledger,
            mediaStore: mediaStore,
            attachmentLoader: { _ in [] }
        )

        do {
            _ = try await adapter.submit(localID: "nonexistent")
            XCTFail("Should have thrown")
        } catch ExistingPayloadSubmissionError.recordNotFound {
            // Expected
        }
    }

    func testSubmitVerifiesAttachmentHash() async throws {
        let database = try RecordDatabase.inMemory()
        let ledger = RecordLedger(database: database)
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(createRecordJSON, forView: "platform_record_create")

        let record = LedgerRecord(
            localID: "local-3",
            ownerUserID: "u1",
            organizationID: "o1",
            projectID: "proj-1",
            schemaVersionID: "sv-1",
            recordTypeKey: "pharmacy",
            fieldValuesJSON: "{}",
            state: .pending,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
        try await ledger.insert(record)

        let mediaStore = InMemoryCaptureMediaStore()
        let tamperedAttachment = LedgerAttachment(
            recordLocalID: "local-3",
            placement: "recordEvidence",
            ordinal: 0,
            relativePath: "u1/o1/local-3/0.jpg",
            sha256: "bad-checksum",
            mimeType: "image/jpeg",
            pixelWidth: nil,
            pixelHeight: nil,
            byteCount: 0,
            createdAt: Date()
        )

        let adapter = makeAdapter(
            transport: transport,
            ledger: ledger,
            mediaStore: mediaStore,
            attachmentLoader: { _ in [tamperedAttachment] }
        )

        do {
            _ = try await adapter.submit(localID: "local-3")
            XCTFail("Should have thrown")
        } catch CaptureMediaStoreError.checksumMismatch {
            // Expected
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
}

private final class CapturingTransport: PlatformTransport, @unchecked Sendable {
    private let inner: RoutingMockPlatformTransport
    private(set) var lastBody: Data?

    init(inner: RoutingMockPlatformTransport) {
        self.inner = inner
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        lastBody = request.httpBody
        return try await inner.send(request)
    }
}

private struct SubmitBody: Decodable {
    struct Evidence: Decodable {
        var photos: [String]
    }
    var evidence: Evidence
}
