@testable import ADLConsole
import ConsolePersistence
import CryptoKit
import XCTest

@MainActor
final class CaptureCoordinatorTests: XCTestCase {
    private func makeCoordinator() throws -> (CaptureCoordinator, RecordLedger, InMemoryCaptureMediaStore) {
        let database = try RecordDatabase.inMemory()
        let ledger = RecordLedger(database: database)
        let mediaStore = InMemoryCaptureMediaStore()
        let coordinator = CaptureCoordinator(mediaStore: mediaStore, ledger: ledger)
        return (coordinator, ledger, mediaStore)
    }

    private func makeIntent(ownerUserID: String = "u1", organizationID: String = "o1") -> CaptureIntent {
        let sha256 = SHA256.hash(data: Data("test".utf8)).compactMap { String(format: "%02x", $0) }.joined()
        let media = CaptureIntentMedia(
            prepared: PreparedCaptureMedia(
                data: Data("test".utf8),
                mimeType: "image/jpeg",
                sha256: sha256,
                pixelWidth: 100,
                pixelHeight: 200
            ),
            placement: "recordEvidence"
        )
        return CaptureIntent(
            projectID: "proj-1",
            schemaVersionID: "sv-1",
            recordTypeKey: "pharmacy",
            fieldValuesJSON: #"{"name":"Acme"}"#,
            ownerUserID: ownerUserID,
            organizationID: organizationID,
            media: [media]
        )
    }

    // MARK: - Persist commits before any send

    func testPersistCreatesRecordInLedger() async throws {
        let (coordinator, ledger, _) = try makeCoordinator()
        let intent = makeIntent()

        let localID = try await coordinator.persist(intent)

        let record = try await ledger.record(localID: localID)
        XCTAssertNotNil(record)
        XCTAssertEqual(record?.localID, localID)
        XCTAssertEqual(record?.state, .pending)
        XCTAssertEqual(record?.projectID, "proj-1")
    }

    func testPersistReturnsLocalUUID() async throws {
        let (coordinator, _, _) = try makeCoordinator()
        let intent = makeIntent()

        let localID = try await coordinator.persist(intent)

        XCTAssertTrue(UUID(uuidString: localID) != nil, "localID must be a valid UUID")
    }

    func testPersistStagesMediaForIntent() async throws {
        let (coordinator, _, mediaStore) = try makeCoordinator()
        let intent = makeIntent()

        let localID = try await coordinator.persist(intent)

        let attachments = mediaStore.allStagedAttachments()
        let recordAttachments = attachments.filter { $0.recordLocalID == localID }
        XCTAssertEqual(recordAttachments.count, 1)
        XCTAssertEqual(recordAttachments[0].recordLocalID, localID)
    }

    func testPersistDoesNotMakeNetworkCall() async throws {
        let (coordinator, _, _) = try makeCoordinator()
        let intent = makeIntent()

        // This should succeed synchronously (local-only) — no transport needed
        let localID = try await coordinator.persist(intent)
        XCTAssertFalse(localID.isEmpty)
    }

    func testPersistMultipleMediaItems() async throws {
        let (coordinator, _, mediaStore) = try makeCoordinator()
        let sha256 = SHA256.hash(data: Data("test".utf8)).compactMap { String(format: "%02x", $0) }.joined()
        let intent = CaptureIntent(
            projectID: "proj-1",
            schemaVersionID: "sv-1",
            recordTypeKey: "pharmacy",
            fieldValuesJSON: "{}",
            ownerUserID: "u1",
            organizationID: "o1",
            media: [
                CaptureIntentMedia(
                    prepared: PreparedCaptureMedia(data: Data("a".utf8), mimeType: "image/jpeg", sha256: sha256, pixelWidth: 1, pixelHeight: 1),
                    placement: "recordEvidence"
                ),
                CaptureIntentMedia(
                    prepared: PreparedCaptureMedia(data: Data("b".utf8), mimeType: "image/jpeg", sha256: sha256, pixelWidth: 1, pixelHeight: 1),
                    placement: "schemaField(storefront)"
                ),
            ]
        )

        let localID = try await coordinator.persist(intent)
        let attachments = mediaStore.allStagedAttachments().filter { $0.recordLocalID == localID }

        XCTAssertEqual(attachments.count, 2)
    }
}
