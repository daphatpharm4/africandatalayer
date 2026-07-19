import Foundation

/// Mirrors `PlatformAdminMemberSummary` in `shared/platformTypes.ts`.
public struct PlatformAdminMemberSummary: Codable, Equatable, Sendable {
    public var userId: String
    public var name: String
    public var email: String?
    public var phone: String?
    public var role: PlatformRole
    public var joinedAt: String
    public var suspendedUntil: String?

    public init(
        userId: String,
        name: String,
        email: String?,
        phone: String?,
        role: PlatformRole,
        joinedAt: String,
        suspendedUntil: String?
    ) {
        self.userId = userId
        self.name = name
        self.email = email
        self.phone = phone
        self.role = role
        self.joinedAt = joinedAt
        self.suspendedUntil = suspendedUntil
    }
}

/// Mirrors `PlatformAdminProjectSummary` in `shared/platformTypes.ts`.
public struct PlatformAdminProjectSummary: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var status: PlatformProjectStatus
    public var coverageScope: PlatformProjectCoverageScope
    public var coverageLabel: String?
    public var recordCount: Int
    public var pendingReviewCount: Int
    public var approvedCount: Int
    public var rejectedCount: Int

    public init(
        id: String,
        name: String,
        status: PlatformProjectStatus,
        coverageScope: PlatformProjectCoverageScope,
        coverageLabel: String?,
        recordCount: Int,
        pendingReviewCount: Int,
        approvedCount: Int,
        rejectedCount: Int
    ) {
        self.id = id
        self.name = name
        self.status = status
        self.coverageScope = coverageScope
        self.coverageLabel = coverageLabel
        self.recordCount = recordCount
        self.pendingReviewCount = pendingReviewCount
        self.approvedCount = approvedCount
        self.rejectedCount = rejectedCount
    }
}

/// Mirrors `PlatformAdminOrganizationSummary` in `shared/platformTypes.ts`.
public struct PlatformAdminOrganizationSummary: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var slug: String
    public var logoUrl: String?
    public var accentColor: String?
    public var accessStatus: PlatformOrganizationAccessStatus
    public var suspensionReason: String?
    public var suspendedAt: String?
    public var suspendedBy: String?
    public var createdAt: String
    public var memberCount: Int
    public var projectCount: Int
    public var recordCount: Int
    public var pendingReviewCount: Int
    public var members: [PlatformAdminMemberSummary]
    public var projects: [PlatformAdminProjectSummary]

    public init(
        id: String,
        name: String,
        slug: String,
        logoUrl: String?,
        accentColor: String?,
        accessStatus: PlatformOrganizationAccessStatus,
        suspensionReason: String?,
        suspendedAt: String?,
        suspendedBy: String?,
        createdAt: String,
        memberCount: Int,
        projectCount: Int,
        recordCount: Int,
        pendingReviewCount: Int,
        members: [PlatformAdminMemberSummary],
        projects: [PlatformAdminProjectSummary]
    ) {
        self.id = id
        self.name = name
        self.slug = slug
        self.logoUrl = logoUrl
        self.accentColor = accentColor
        self.accessStatus = accessStatus
        self.suspensionReason = suspensionReason
        self.suspendedAt = suspendedAt
        self.suspendedBy = suspendedBy
        self.createdAt = createdAt
        self.memberCount = memberCount
        self.projectCount = projectCount
        self.recordCount = recordCount
        self.pendingReviewCount = pendingReviewCount
        self.members = members
        self.projects = projects
    }
}
