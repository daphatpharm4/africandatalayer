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
        public var deviceId: String?
        public var platform: String?
        public var userAgent: String?
        public var language: String?

        public init(deviceId: String? = nil, platform: String? = nil, userAgent: String? = nil, language: String? = nil) {
            self.deviceId = deviceId
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

    /// Mirrors `ClientExifData` in `shared/types.ts`; attached as an explicit
    /// client fallback because the console recompresses photos before upload.
    public struct ClientExif: Codable, Equatable, Sendable {
        public var latitude: Double?
        public var longitude: Double?
        public var capturedAt: String?
        public var deviceMake: String?
        public var deviceModel: String?

        public init(
            latitude: Double? = nil,
            longitude: Double? = nil,
            capturedAt: String? = nil,
            deviceMake: String? = nil,
            deviceModel: String? = nil
        ) {
            self.latitude = latitude
            self.longitude = longitude
            self.capturedAt = capturedAt
            self.deviceMake = deviceMake
            self.deviceModel = deviceModel
        }
    }

    /// Mirrors `GpsIntegrityReport` in `shared/types.ts`.
    public struct GpsIntegrity: Codable, Equatable, Sendable {
        public var mockLocationDetected: Bool
        public var mockLocationMethod: String?
        public var hasAccelerometerData: Bool
        public var hasGyroscopeData: Bool
        public var accelerometerSampleCount: Int
        public var motionDetectedDuringCapture: Bool
        public var gpsAccuracyMeters: Double?
        public var networkType: String?
        public var gpsTimestamp: Int?
        public var deviceTimestamp: Int
        public var timeDeltaMs: Int?

        public init(
            mockLocationDetected: Bool,
            mockLocationMethod: String? = nil,
            hasAccelerometerData: Bool,
            hasGyroscopeData: Bool,
            accelerometerSampleCount: Int,
            motionDetectedDuringCapture: Bool,
            gpsAccuracyMeters: Double? = nil,
            networkType: String? = nil,
            gpsTimestamp: Int? = nil,
            deviceTimestamp: Int,
            timeDeltaMs: Int? = nil
        ) {
            self.mockLocationDetected = mockLocationDetected
            self.mockLocationMethod = mockLocationMethod
            self.hasAccelerometerData = hasAccelerometerData
            self.hasGyroscopeData = hasGyroscopeData
            self.accelerometerSampleCount = accelerometerSampleCount
            self.motionDetectedDuringCapture = motionDetectedDuringCapture
            self.gpsAccuracyMeters = gpsAccuracyMeters
            self.networkType = networkType
            self.gpsTimestamp = gpsTimestamp
            self.deviceTimestamp = deviceTimestamp
            self.timeDeltaMs = timeDeltaMs
        }

        enum CodingKeys: String, CodingKey {
            case mockLocationDetected
            case mockLocationMethod
            case hasAccelerometerData
            case hasGyroscopeData
            case accelerometerSampleCount
            case motionDetectedDuringCapture
            case gpsAccuracyMeters
            case networkType
            case gpsTimestamp
            case deviceTimestamp
            case timeDeltaMs
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(mockLocationDetected, forKey: .mockLocationDetected)
            try container.encodeNilOrValue(mockLocationMethod, forKey: .mockLocationMethod)
            try container.encode(hasAccelerometerData, forKey: .hasAccelerometerData)
            try container.encode(hasGyroscopeData, forKey: .hasGyroscopeData)
            try container.encode(accelerometerSampleCount, forKey: .accelerometerSampleCount)
            try container.encode(motionDetectedDuringCapture, forKey: .motionDetectedDuringCapture)
            try container.encodeNilOrValue(gpsAccuracyMeters, forKey: .gpsAccuracyMeters)
            try container.encodeNilOrValue(networkType, forKey: .networkType)
            try container.encodeNilOrValue(gpsTimestamp, forKey: .gpsTimestamp)
            try container.encode(deviceTimestamp, forKey: .deviceTimestamp)
            try container.encodeNilOrValue(timeDeltaMs, forKey: .timeDeltaMs)
        }
    }

    public var gps: PlatformRecordGps?
    public var photos: [String]
    public var notes: String?
    public var capturedAt: String?
    public var device: Device?
    public var photoMetadata: [PhotoMetadata]?
    public var clientExif: ClientExif?
    public var gpsIntegrity: GpsIntegrity?

    public init(
        gps: PlatformRecordGps? = nil,
        photos: [String],
        notes: String? = nil,
        capturedAt: String? = nil,
        device: Device? = nil,
        photoMetadata: [PhotoMetadata]? = nil,
        clientExif: ClientExif? = nil,
        gpsIntegrity: GpsIntegrity? = nil
    ) {
        self.gps = gps
        self.photos = photos
        self.notes = notes
        self.capturedAt = capturedAt
        self.device = device
        self.photoMetadata = photoMetadata
        self.clientExif = clientExif
        self.gpsIntegrity = gpsIntegrity
    }
}

private extension KeyedEncodingContainer {
    mutating func encodeNilOrValue<T: Encodable>(_ value: T?, forKey key: Key) throws {
        if let value {
            try encode(value, forKey: key)
        } else {
            try encodeNil(forKey: key)
        }
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
