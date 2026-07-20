import Foundation

/// Mirrors `PlatformRecordGps` in `shared/platformTypes.ts`.
public struct PlatformRecordGps: Codable, Equatable, Sendable {
    public var latitude: Double
    public var longitude: Double
    public var accuracyMeters: Double?

    public init(latitude: Double, longitude: Double, accuracyMeters: Double? = nil) {
        self.latitude = latitude
        self.longitude = longitude
        self.accuracyMeters = accuracyMeters
    }
}

/// Mirrors `PlatformRecordEvidence` in `shared/platformTypes.ts`.
public struct PlatformRecordEvidence: Codable, Equatable, Sendable {
    /// Mirrors the anonymous `device?: { platform?; userAgent?; language? }`
    /// object type nested in `PlatformRecordEvidence`.
    public struct Device: Codable, Equatable, Sendable {
        public var platform: String?
        public var userAgent: String?
        public var language: String?

        public init(platform: String? = nil, userAgent: String? = nil, language: String? = nil) {
            self.platform = platform
            self.userAgent = userAgent
            self.language = language
        }
    }

    /// Mirrors the anonymous element type of `photoMetadata?: Array<{...}>`
    /// nested in `PlatformRecordEvidence`.
    public struct PhotoMetadata: Codable, Equatable, Sendable {
        public var mimeType: String
        /// Modeling note: TS `originalBytes: number` — represented as `Int`
        /// since byte counts are whole numbers.
        public var originalBytes: Int
        public var storedBytes: Int
        /// Modeling note: TS `width?: number` — represented as `Int` since
        /// pixel dimensions are whole numbers.
        public var width: Int?
        public var height: Int?
        public var capturedAt: String?

        public init(
            mimeType: String,
            originalBytes: Int,
            storedBytes: Int,
            width: Int? = nil,
            height: Int? = nil,
            capturedAt: String? = nil
        ) {
            self.mimeType = mimeType
            self.originalBytes = originalBytes
            self.storedBytes = storedBytes
            self.width = width
            self.height = height
            self.capturedAt = capturedAt
        }
    }

    public var gps: PlatformRecordGps?
    public var photos: [String]
    public var notes: String?
    public var capturedAt: String?
    public var device: Device?
    public var photoMetadata: [PhotoMetadata]?

    public init(
        gps: PlatformRecordGps? = nil,
        photos: [String],
        notes: String? = nil,
        capturedAt: String? = nil,
        device: Device? = nil,
        photoMetadata: [PhotoMetadata]? = nil
    ) {
        self.gps = gps
        self.photos = photos
        self.notes = notes
        self.capturedAt = capturedAt
        self.device = device
        self.photoMetadata = photoMetadata
    }
}

/// Mirrors `PlatformRecord` in `shared/platformTypes.ts`.
public struct PlatformRecord: Codable, Equatable, Sendable {
    public var id: String
    public var projectId: String
    public var organizationId: String
    public var schemaVersionId: String
    public var recordTypeKey: String
    /// Modeling note: TS `data: Record<string, unknown>` — the record's
    /// dynamic per-record-type field payload. Modeled as `[String: JSONValue]`
    /// (see `JSONValue.swift`) so arbitrary field shapes round-trip without
    /// loss, since the actual shape depends on `recordTypeKey` /
    /// `PlatformSchemaDefinition` and cannot be fixed at compile time.
    public var data: [String: JSONValue]
    public var evidence: PlatformRecordEvidence
    public var status: PlatformRecordStatus
    public var capturedBy: String
    public var createdAt: String
    public var pointId: String?
    public var reviewedBy: String?
    public var reviewedAt: String?
    public var reviewNotes: String?

    public init(
        id: String,
        projectId: String,
        organizationId: String,
        schemaVersionId: String,
        recordTypeKey: String,
        data: [String: JSONValue],
        evidence: PlatformRecordEvidence,
        status: PlatformRecordStatus,
        capturedBy: String,
        createdAt: String,
        pointId: String? = nil,
        reviewedBy: String? = nil,
        reviewedAt: String? = nil,
        reviewNotes: String? = nil
    ) {
        self.id = id
        self.projectId = projectId
        self.organizationId = organizationId
        self.schemaVersionId = schemaVersionId
        self.recordTypeKey = recordTypeKey
        self.data = data
        self.evidence = evidence
        self.status = status
        self.capturedBy = capturedBy
        self.createdAt = createdAt
        self.pointId = pointId
        self.reviewedBy = reviewedBy
        self.reviewedAt = reviewedAt
        self.reviewNotes = reviewNotes
    }
}

/// Mirrors `PlatformRecordSummary` in `shared/platformTypes.ts`.
public struct PlatformRecordSummary: Codable, Equatable, Sendable {
    public var total: Int
    public var pendingReview: Int
    public var approved: Int
    public var rejected: Int
    public var submittedToday: Int

    public init(total: Int, pendingReview: Int, approved: Int, rejected: Int, submittedToday: Int) {
        self.total = total
        self.pendingReview = pendingReview
        self.approved = approved
        self.rejected = rejected
        self.submittedToday = submittedToday
    }
}
