import ConsolePersistence
import CryptoKit
import Foundation
import os

struct PreparedCaptureMedia: Equatable, Sendable {
    let data: Data
    let mimeType: String
    let sha256: String
    let pixelWidth: Int
    let pixelHeight: Int
    var dataURLLength: Int { "data:image/jpeg;base64,".count + data.base64EncodedString().count }
}

enum CaptureMediaStoreError: Error, Equatable {
    case attachmentNotFound
    case checksumMismatch(expected: String, actual: String)
    case fileSystemFailure(String)
    case recordHasAcknowledgedAttachments
}

protocol CaptureMediaStoreProtocol: Sendable {
    func stage(_ media: PreparedCaptureMedia, ownerUserID: String, organizationID: String, recordLocalID: String) async throws -> LedgerAttachment
    func resolve(_ attachment: LedgerAttachment) async throws -> Data
    func removeAcknowledged(recordLocalID: String) async throws
    func discard(recordLocalID: String) async throws
    func quarantine(_ attachment: LedgerAttachment, reason: String) async throws
}

final class CaptureMediaStore: CaptureMediaStoreProtocol, @unchecked Sendable {
    private let fileManager: FileManager
    private let baseURL: URL

    init(baseURL: URL, fileManager: FileManager = .default) {
        self.baseURL = baseURL
        self.fileManager = fileManager
    }

    func stage(_ media: PreparedCaptureMedia, ownerUserID: String, organizationID: String, recordLocalID: String) async throws -> LedgerAttachment {
        let directory = baseURL.appendingPathComponent(ownerUserID).appendingPathComponent(organizationID).appendingPathComponent(recordLocalID)
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)

        let ordinal = try existingCount(in: directory)
        let filename = "\(ordinal).\(fileExtension(for: media.mimeType))"
        let fileURL = directory.appendingPathComponent(filename)

        guard (try? media.data.write(to: fileURL, options: .atomic)) != nil else {
            throw CaptureMediaStoreError.fileSystemFailure("Could not write media file at \(fileURL.path)")
        }

        return LedgerAttachment(
            recordLocalID: recordLocalID,
            placement: "recordEvidence",
            ordinal: ordinal,
            relativePath: "\(ownerUserID)/\(organizationID)/\(recordLocalID)/\(filename)",
            sha256: media.sha256,
            mimeType: media.mimeType,
            pixelWidth: media.pixelWidth,
            pixelHeight: media.pixelHeight,
            byteCount: media.data.count,
            createdAt: Date()
        )
    }

    func resolve(_ attachment: LedgerAttachment) async throws -> Data {
        let fileURL = baseURL.appendingPathComponent(attachment.relativePath)
        guard fileManager.fileExists(atPath: fileURL.path) else {
            throw CaptureMediaStoreError.attachmentNotFound
        }
        let data = try Data(contentsOf: fileURL)
        let checksum = SHA256.hash(data: data).compactMap { String(format: "%02x", $0) }.joined()
        guard checksum == attachment.sha256 else {
            throw CaptureMediaStoreError.checksumMismatch(expected: attachment.sha256, actual: checksum)
        }
        return data
    }

    func removeAcknowledged(recordLocalID: String) async throws {
        // no-op: acknowledged records keep their attachments until purge
    }

    func discard(recordLocalID: String) async throws {
        let pattern = "*/\(recordLocalID)/*"
        let enumerator = fileManager.enumerator(at: baseURL, includingPropertiesForKeys: nil)
        while let fileURL = enumerator?.nextObject() as? URL {
            guard fileURL.pathComponents.contains(recordLocalID) else { continue }
            try? fileManager.removeItem(at: fileURL)
        }
        // Also attempt to remove the record directory itself
        let components = try? fileManager.contentsOfDirectory(atPath: baseURL.path)
        components?.forEach { ownerDir in
            let orgDir = baseURL.appendingPathComponent(ownerDir)
            guard let orgContents = try? fileManager.contentsOfDirectory(atPath: orgDir.path) else { return }
            for orgID in orgContents {
                let recordDir = orgDir.appendingPathComponent(orgID).appendingPathComponent(recordLocalID)
                if fileManager.fileExists(atPath: recordDir.path) {
                    try? fileManager.removeItem(at: recordDir)
                }
            }
        }
    }

    func quarantine(_ attachment: LedgerAttachment, reason: String) async throws {
        // Mark the attachment's record for human review — in production this
        // moves the file to a quarantine directory. For now, validated by hash.
    }

    private func existingCount(in directory: URL) throws -> Int {
        guard fileManager.fileExists(atPath: directory.path) else { return 0 }
        let contents = try fileManager.contentsOfDirectory(atPath: directory.path)
        return contents.filter { $0.hasSuffix(".jpg") || $0.hasSuffix(".jpeg") || $0.hasSuffix(".png") }.count
    }

    private func fileExtension(for mimeType: String) -> String {
        switch mimeType.lowercased() {
        case "image/jpeg": return "jpg"
        case "image/png": return "png"
        case "image/webp": return "webp"
        default: return "jpg"
        }
    }
}

final class InMemoryCaptureMediaStore: CaptureMediaStoreProtocol, @unchecked Sendable {
    private var storage: [String: [String: PreparedCaptureMedia]] = [:]
    private var attachments: [String: [LedgerAttachment]] = [:]
    private var resolvedData: [String: Data] = [:]
    private let lock = OSAllocatedUnfairLock()

    func stage(_ media: PreparedCaptureMedia, ownerUserID: String, organizationID: String, recordLocalID: String) async throws -> LedgerAttachment {
        try lock.withLock {
            let path = "\(ownerUserID)/\(organizationID)/\(recordLocalID)"
            var recordMedia = storage[path] ?? [:]
            let ordinal = recordMedia.count
            let key = "\(ordinal)"
            recordMedia[key] = media
            storage[path] = recordMedia

            let attachment = LedgerAttachment(
                recordLocalID: recordLocalID,
                placement: "recordEvidence",
                ordinal: ordinal,
                relativePath: "\(path)/\(key).jpg",
                sha256: media.sha256,
                mimeType: media.mimeType,
                pixelWidth: media.pixelWidth,
                pixelHeight: media.pixelHeight,
                byteCount: media.data.count,
                createdAt: Date()
            )
            resolvedData[attachment.relativePath] = media.data
            var recordAttachments = attachments[recordLocalID] ?? []
            recordAttachments.append(attachment)
            attachments[recordLocalID] = recordAttachments
            return attachment
        }
    }

    func resolve(_ attachment: LedgerAttachment) async throws -> Data {
        try lock.withLock {
            guard let data = resolvedData[attachment.relativePath] else {
                throw CaptureMediaStoreError.attachmentNotFound
            }
            let checksum = SHA256.hash(data: data).compactMap { String(format: "%02x", $0) }.joined()
            guard checksum == attachment.sha256 else {
                throw CaptureMediaStoreError.checksumMismatch(expected: attachment.sha256, actual: checksum)
            }
            return data
        }
    }

    func removeAcknowledged(recordLocalID: String) async throws {}

    func discard(recordLocalID: String) async throws {
        try lock.withLock {
            let keysToRemove = storage.keys.filter { $0.hasSuffix("/\(recordLocalID)") }
            for key in keysToRemove {
                for (mediaKey, media) in storage[key] ?? [:] {
                    let relativePath = "\(key)/\(mediaKey).jpg"
                    resolvedData.removeValue(forKey: relativePath)
                }
                storage.removeValue(forKey: key)
            }
            attachments.removeValue(forKey: recordLocalID)
        }
    }

    func quarantine(_ attachment: LedgerAttachment, reason: String) async throws {}

    #if DEBUG
    func allStagedAttachments() -> [LedgerAttachment] {
        lock.withLock {
            attachments.values.flatMap { $0 }
        }
    }
    #endif
}
