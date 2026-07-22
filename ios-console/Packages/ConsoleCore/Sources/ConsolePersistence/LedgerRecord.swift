import Foundation
import GRDB

public struct LedgerRecord: Codable, Equatable, Sendable, FetchableRecord, PersistableRecord {
    public static let databaseTableName = "queued_records"
    public var localID: String
    public var ownerUserID: String
    public var organizationID: String
    public var projectID: String
    public var schemaVersionID: String
    public var recordTypeKey: String
    public var fieldValuesJSON: String
    public var state: RecordState
    public var automaticAttemptCount: Int
    public var nextAttemptAt: Date?
    public var lastErrorClassification: String?
    public var lastErrorCode: String?
    public var lastErrorSafeMessage: String?
    public var serverRecordID: String?
    public var acknowledgedAt: Date?
    public var discardedAt: Date?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        localID: String,
        ownerUserID: String,
        organizationID: String,
        projectID: String,
        schemaVersionID: String,
        recordTypeKey: String,
        fieldValuesJSON: String,
        state: RecordState,
        automaticAttemptCount: Int = 0,
        nextAttemptAt: Date? = nil,
        lastErrorClassification: String? = nil,
        lastErrorCode: String? = nil,
        lastErrorSafeMessage: String? = nil,
        serverRecordID: String? = nil,
        acknowledgedAt: Date? = nil,
        discardedAt: Date? = nil,
        createdAt: Date,
        updatedAt: Date
    ) {
        self.localID = localID
        self.ownerUserID = ownerUserID
        self.organizationID = organizationID
        self.projectID = projectID
        self.schemaVersionID = schemaVersionID
        self.recordTypeKey = recordTypeKey
        self.fieldValuesJSON = fieldValuesJSON
        self.state = state
        self.automaticAttemptCount = automaticAttemptCount
        self.nextAttemptAt = nextAttemptAt
        self.lastErrorClassification = lastErrorClassification
        self.lastErrorCode = lastErrorCode
        self.lastErrorSafeMessage = lastErrorSafeMessage
        self.serverRecordID = serverRecordID
        self.acknowledgedAt = acknowledgedAt
        self.discardedAt = discardedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case localID = "local_id"
        case ownerUserID = "owner_user_id"
        case organizationID = "organization_id"
        case projectID = "project_id"
        case schemaVersionID = "schema_version_id"
        case recordTypeKey = "record_type_key"
        case fieldValuesJSON = "field_values_json"
        case state
        case automaticAttemptCount = "automatic_attempt_count"
        case nextAttemptAt = "next_attempt_at"
        case lastErrorClassification = "last_error_classification"
        case lastErrorCode = "last_error_code"
        case lastErrorSafeMessage = "last_error_safe_message"
        case serverRecordID = "server_record_id"
        case acknowledgedAt = "acknowledged_at"
        case discardedAt = "discarded_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

public struct LedgerAttachment: Codable, Equatable, Sendable, FetchableRecord, PersistableRecord {
    public static let databaseTableName = "media_attachments"
    public var id: Int64?
    public var recordLocalID: String
    public var placement: String
    public var ordinal: Int
    public var relativePath: String
    public var sha256: String
    public var mimeType: String
    public var pixelWidth: Int?
    public var pixelHeight: Int?
    public var byteCount: Int
    public var createdAt: Date

    public init(
        id: Int64? = nil,
        recordLocalID: String,
        placement: String,
        ordinal: Int,
        relativePath: String,
        sha256: String,
        mimeType: String,
        pixelWidth: Int? = nil,
        pixelHeight: Int? = nil,
        byteCount: Int,
        createdAt: Date
    ) {
        self.id = id
        self.recordLocalID = recordLocalID
        self.placement = placement
        self.ordinal = ordinal
        self.relativePath = relativePath
        self.sha256 = sha256
        self.mimeType = mimeType
        self.pixelWidth = pixelWidth
        self.pixelHeight = pixelHeight
        self.byteCount = byteCount
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case recordLocalID = "record_local_id"
        case placement
        case ordinal
        case relativePath = "relative_path"
        case sha256
        case mimeType = "mime_type"
        case pixelWidth = "pixel_width"
        case pixelHeight = "pixel_height"
        case byteCount = "byte_count"
        case createdAt = "created_at"
    }
}
