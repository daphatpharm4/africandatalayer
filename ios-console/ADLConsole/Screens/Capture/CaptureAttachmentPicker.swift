import ConsolePersistence
import Foundation
import UIKit

enum CaptureAttachmentPlacement: Equatable, Sendable {
    case schemaField(String)
    case recordEvidence
}

struct CaptureAttachmentViewState: Equatable, Sendable {
    let thumbnail: Data
    let placement: CaptureAttachmentPlacement
    let byteCount: Int
    let localID: String

    init(thumbnail: Data, placement: CaptureAttachmentPlacement, byteCount: Int, localID: String) {
        self.thumbnail = thumbnail
        self.placement = placement
        self.byteCount = byteCount
        self.localID = localID
    }
}

enum CaptureAttachmentPickerError: Error, Equatable {
    case imageProcessingFailed
    case storageFailed
}
