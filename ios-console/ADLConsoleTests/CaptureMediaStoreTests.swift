@testable import ADLConsole
import ConsolePersistence
import CryptoKit
import XCTest

final class CaptureMediaStoreTests: XCTestCase {
    private func makePreparedMedia(data: Data = Data("test-image-data".utf8)) -> PreparedCaptureMedia {
        let sha256 = SHA256.hash(data: data).compactMap { String(format: "%02x", $0) }.joined()
        return PreparedCaptureMedia(
            data: data,
            mimeType: "image/jpeg",
            sha256: sha256,
            pixelWidth: 100,
            pixelHeight: 200
        )
    }

    // MARK: - Stage uses protected owner-scoped path

    func testStageStoresUnderOwnerOrgRecordPath() async throws {
        let store = InMemoryCaptureMediaStore()
        let media = makePreparedMedia()

        let attachment = try await store.stage(media, ownerUserID: "user-42", organizationID: "org-99", recordLocalID: "rec-abc")

        XCTAssertTrue(attachment.relativePath.hasPrefix("user-42/org-99/rec-abc/"))
        XCTAssertEqual(attachment.recordLocalID, "rec-abc")
        XCTAssertEqual(attachment.sha256, media.sha256)
        XCTAssertEqual(attachment.byteCount, media.data.count)
    }

    func testStageIncrementsOrdinal() async throws {
        let store = InMemoryCaptureMediaStore()
        let media = makePreparedMedia()

        let first = try await store.stage(media, ownerUserID: "u1", organizationID: "o1", recordLocalID: "r1")
        let second = try await store.stage(media, ownerUserID: "u1", organizationID: "o1", recordLocalID: "r1")

        XCTAssertEqual(first.ordinal, 0)
        XCTAssertEqual(second.ordinal, 1)
    }

    // MARK: - Resolve verifies checksum

    func testResolveReturnsOriginalData() async throws {
        let store = InMemoryCaptureMediaStore()
        let originalData = Data("hello-media".utf8)
        let media = makePreparedMedia(data: originalData)

        let attachment = try await store.stage(media, ownerUserID: "u1", organizationID: "o1", recordLocalID: "r1")
        let resolved = try await store.resolve(attachment)

        XCTAssertEqual(resolved, originalData)
    }

    func testResolveThrowsOnChecksumMismatch() async throws {
        let store = InMemoryCaptureMediaStore()
        let media = makePreparedMedia(data: Data("original".utf8))
        let attachment = try await store.stage(media, ownerUserID: "u1", organizationID: "o1", recordLocalID: "r1")

        let tampered = LedgerAttachment(
            recordLocalID: "r1",
            placement: "recordEvidence",
            ordinal: 0,
            relativePath: attachment.relativePath,
            sha256: "tampered-checksum",
            mimeType: "image/jpeg",
            pixelWidth: 100,
            pixelHeight: 200,
            byteCount: 7,
            createdAt: Date()
        )

        do {
            _ = try await store.resolve(tampered)
            XCTFail("Should have thrown checksum mismatch")
        } catch CaptureMediaStoreError.checksumMismatch(let expected, let actual) {
            XCTAssertEqual(expected, "tampered-checksum")
            XCTAssertFalse(actual.isEmpty)
        }
    }

    func testResolveThrowsOnMissingAttachment() async throws {
        let store = InMemoryCaptureMediaStore()
        let orphan = LedgerAttachment(
            recordLocalID: "ghost",
            placement: "recordEvidence",
            ordinal: 0,
            relativePath: "u1/o1/ghost/0.jpg",
            sha256: "abc",
            mimeType: "image/jpeg",
            pixelWidth: nil,
            pixelHeight: nil,
            byteCount: 0,
            createdAt: Date()
        )

        do {
            _ = try await store.resolve(orphan)
            XCTFail("Should have thrown")
        } catch CaptureMediaStoreError.attachmentNotFound {
            // Expected
        }
    }

    // MARK: - Discard removes only uncommitted media

    func testDiscardRemovesRecordMedia() async throws {
        let store = InMemoryCaptureMediaStore()
        let media = makePreparedMedia()

        let attachment = try await store.stage(media, ownerUserID: "u1", organizationID: "o1", recordLocalID: "r1")
        _ = try await store.resolve(attachment)

        try await store.discard(recordLocalID: "r1")

        do {
            _ = try await store.resolve(attachment)
            XCTFail("Should have thrown after discard")
        } catch CaptureMediaStoreError.attachmentNotFound {
            // Expected
        }
    }

    func testDiscardLeavesOtherRecordsIntact() async throws {
        let store = InMemoryCaptureMediaStore()
        let media = makePreparedMedia()

        let att1 = try await store.stage(media, ownerUserID: "u1", organizationID: "o1", recordLocalID: "r1")
        let att2 = try await store.stage(media, ownerUserID: "u1", organizationID: "o1", recordLocalID: "r2")

        try await store.discard(recordLocalID: "r1")

        _ = try await store.resolve(att2)
        do {
            _ = try await store.resolve(att1)
            XCTFail("r1 should be discarded")
        } catch CaptureMediaStoreError.attachmentNotFound {
            // Expected
        }
    }
}
