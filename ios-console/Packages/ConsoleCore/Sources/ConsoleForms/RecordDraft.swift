import ConsoleModels
import Foundation

/// A captured-but-not-yet-submitted company record: the projectId, schema
/// version, and record-type key `PlatformAPIClient.createPlatformRecord`
/// needs, the validated field `data` payload, and the record-level evidence
/// (photo refs + optional GPS + optional notes). Constructed by the capture
/// flow once `FormValidator.validate(...).isValid` is `true` — `RecordDraft`
/// itself does not re-validate, it is the already-valid submission unit the
/// offline queue persists and eventually sends.
public struct RecordDraft: Codable, Equatable, Sendable {
    public var projectId: String
    public var schemaVersionId: String
    public var recordTypeKey: String
    public var data: [String: JSONValue]
    public var photoRefs: [String]
    public var gps: FormGpsValue?
    public var notes: String?
    public var pointId: String?
    public var capturedAt: String
    public var device: PlatformRecordEvidence.Device?
    public var photoMetadata: [PlatformRecordEvidence.PhotoMetadata]?
    public var clientExif: PlatformRecordEvidence.ClientExif?
    public var gpsIntegrity: PlatformRecordEvidence.GpsIntegrity?

    public init(
        projectId: String,
        schemaVersionId: String,
        recordTypeKey: String,
        data: [String: JSONValue],
        photoRefs: [String] = [],
        gps: FormGpsValue? = nil,
        notes: String? = nil,
        pointId: String? = nil,
        capturedAt: String,
        device: PlatformRecordEvidence.Device? = nil,
        photoMetadata: [PlatformRecordEvidence.PhotoMetadata]? = nil,
        clientExif: PlatformRecordEvidence.ClientExif? = nil,
        gpsIntegrity: PlatformRecordEvidence.GpsIntegrity? = nil
    ) {
        self.projectId = projectId
        self.schemaVersionId = schemaVersionId
        self.recordTypeKey = recordTypeKey
        self.data = data
        self.photoRefs = photoRefs
        self.gps = gps
        self.notes = notes
        self.pointId = pointId
        self.capturedAt = capturedAt
        self.device = device
        self.photoMetadata = photoMetadata
        self.clientExif = clientExif
        self.gpsIntegrity = gpsIntegrity
    }
}
