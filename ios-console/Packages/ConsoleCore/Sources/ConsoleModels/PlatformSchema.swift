import Foundation

/// Mirrors `BilingualLabel` in `shared/platformTypes.ts`.
public struct BilingualLabel: Codable, Equatable, Sendable {
    public var en: String
    public var fr: String

    public init(en: String, fr: String) {
        self.en = en
        self.fr = fr
    }
}

/// Mirrors `PlatformFieldOption` in `shared/platformTypes.ts`.
public struct PlatformFieldOption: Codable, Equatable, Sendable {
    public var value: String
    public var label: BilingualLabel

    public init(value: String, label: BilingualLabel) {
        self.value = value
        self.label = label
    }
}

/// Mirrors `PlatformFieldDefinition` in `shared/platformTypes.ts`.
public struct PlatformFieldDefinition: Codable, Equatable, Sendable {
    public var key: String
    public var label: BilingualLabel
    public var type: PlatformFieldType
    public var required: Bool
    public var options: [PlatformFieldOption]?
    /// Modeling note: TS `min?: number` — represented as `Double` since the
    /// field's numeric domain (currency, distances, counts) is not
    /// constrained to integers by the source type.
    public var min: Double?
    public var max: Double?

    public init(
        key: String,
        label: BilingualLabel,
        type: PlatformFieldType,
        required: Bool,
        options: [PlatformFieldOption]? = nil,
        min: Double? = nil,
        max: Double? = nil
    ) {
        self.key = key
        self.label = label
        self.type = type
        self.required = required
        self.options = options
        self.min = min
        self.max = max
    }
}

/// Mirrors `PlatformEvidenceRules` in `shared/platformTypes.ts`.
public struct PlatformEvidenceRules: Codable, Equatable, Sendable {
    public var gpsRequired: Bool
    public var gpsAccuracyMeters: Double?
    public var minPhotos: Int
    public var notesRequired: Bool

    public init(
        gpsRequired: Bool,
        gpsAccuracyMeters: Double? = nil,
        minPhotos: Int,
        notesRequired: Bool
    ) {
        self.gpsRequired = gpsRequired
        self.gpsAccuracyMeters = gpsAccuracyMeters
        self.minPhotos = minPhotos
        self.notesRequired = notesRequired
    }
}

/// Mirrors `PlatformRecordType` in `shared/platformTypes.ts`.
public struct PlatformRecordType: Codable, Equatable, Sendable {
    public var key: String
    public var label: BilingualLabel
    public var fields: [PlatformFieldDefinition]
    public var evidence: PlatformEvidenceRules

    public init(
        key: String,
        label: BilingualLabel,
        fields: [PlatformFieldDefinition],
        evidence: PlatformEvidenceRules
    ) {
        self.key = key
        self.label = label
        self.fields = fields
        self.evidence = evidence
    }
}

/// Mirrors `PlatformSchemaDefinition` in `shared/platformTypes.ts`.
public struct PlatformSchemaDefinition: Codable, Equatable, Sendable {
    public var recordTypes: [PlatformRecordType]

    public init(recordTypes: [PlatformRecordType]) {
        self.recordTypes = recordTypes
    }
}
