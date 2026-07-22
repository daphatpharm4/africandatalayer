import ConsoleModels
import Foundation

public struct WorkspaceSnapshot: Codable, Equatable, Sendable {
    public let ownerUserID: String
    public let organizationID: String
    public let role: PlatformRole
    public let verifiedAt: Date
    public let expiresAt: Date
    public let verifiedSystemUptime: TimeInterval
    public let organizationJSON: Data
    public let projectsJSON: Data
    public let publishedSchemasJSON: Data
    public let locale: String
    public let isLocked: Bool

    public init(
        ownerUserID: String,
        organizationID: String,
        role: PlatformRole,
        verifiedAt: Date,
        expiresAt: Date,
        verifiedSystemUptime: TimeInterval,
        organizationJSON: Data,
        projectsJSON: Data,
        publishedSchemasJSON: Data,
        locale: String,
        isLocked: Bool
    ) {
        self.ownerUserID = ownerUserID
        self.organizationID = organizationID
        self.role = role
        self.verifiedAt = verifiedAt
        self.expiresAt = expiresAt
        self.verifiedSystemUptime = verifiedSystemUptime
        self.organizationJSON = organizationJSON
        self.projectsJSON = projectsJSON
        self.publishedSchemasJSON = publishedSchemasJSON
        self.locale = locale
        self.isLocked = isLocked
    }
}

extension WorkspaceSnapshot {
    public static func fixture(
        ownerUserID: String = "u1",
        organizationID: String = "o1",
        role: PlatformRole = .collector,
        verifiedAt: Date = Date(timeIntervalSince1970: 0),
        expiresAt: Date = Date(timeIntervalSince1970: 259_200),
        verifiedSystemUptime: TimeInterval = 1000,
        locale: String = "en",
        isLocked: Bool = false
    ) -> WorkspaceSnapshot {
        WorkspaceSnapshot(
            ownerUserID: ownerUserID,
            organizationID: organizationID,
            role: role,
            verifiedAt: verifiedAt,
            expiresAt: expiresAt,
            verifiedSystemUptime: verifiedSystemUptime,
            organizationJSON: Data("{}".utf8),
            projectsJSON: Data("[]".utf8),
            publishedSchemasJSON: Data("[]".utf8),
            locale: locale,
            isLocked: isLocked
        )
    }
}
