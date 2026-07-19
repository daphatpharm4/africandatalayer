import Foundation

/// Mirrors `PlatformProject` in `shared/platformTypes.ts`.
public struct PlatformProject: Codable, Equatable, Sendable {
    public var id: String
    public var organizationId: String
    public var name: String
    public var status: PlatformProjectStatus
    public var coverageScope: PlatformProjectCoverageScope
    public var coverageLabel: String?
    public var createdAt: String

    public init(
        id: String,
        organizationId: String,
        name: String,
        status: PlatformProjectStatus,
        coverageScope: PlatformProjectCoverageScope,
        coverageLabel: String?,
        createdAt: String
    ) {
        self.id = id
        self.organizationId = organizationId
        self.name = name
        self.status = status
        self.coverageScope = coverageScope
        self.coverageLabel = coverageLabel
        self.createdAt = createdAt
    }
}

/// Mirrors `PlatformSchemaVersion` in `shared/platformTypes.ts`.
public struct PlatformSchemaVersion: Codable, Equatable, Sendable {
    public var id: String
    public var projectId: String
    public var organizationId: String
    /// Modeling note: TS `version: number` — represented as `Int` since schema
    /// versions are sequential integers in the source domain.
    public var version: Int
    public var status: PlatformSchemaVersionStatus
    public var definition: PlatformSchemaDefinition
    public var publishedAt: String?

    public init(
        id: String,
        projectId: String,
        organizationId: String,
        version: Int,
        status: PlatformSchemaVersionStatus,
        definition: PlatformSchemaDefinition,
        publishedAt: String?
    ) {
        self.id = id
        self.projectId = projectId
        self.organizationId = organizationId
        self.version = version
        self.status = status
        self.definition = definition
        self.publishedAt = publishedAt
    }
}
