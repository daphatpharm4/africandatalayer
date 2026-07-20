import Foundation

/// Mirrors `PlatformOrganization` in `shared/platformTypes.ts`.
///
/// Modeling note: `suspensionReason?: string | null` and `suspendedAt?: string | null`
/// collapse the TS "optional-and-nullable" shape (absent vs. explicit null are
/// distinct in TS) into a single Swift `Optional`, per the port's stated rule
/// that optional/nullable TS fields become plain Swift `Optional`. Both
/// "key missing" and "key present as null" decode to `nil` here; callers do
/// not need to distinguish the two for this dataset.
public struct PlatformOrganization: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var slug: String
    public var logoUrl: String?
    public var accentColor: String?
    public var createdAt: String
    public var accessStatus: PlatformOrganizationAccessStatus?
    public var suspensionReason: String?
    public var suspendedAt: String?

    public init(
        id: String,
        name: String,
        slug: String,
        logoUrl: String?,
        accentColor: String?,
        createdAt: String,
        accessStatus: PlatformOrganizationAccessStatus? = nil,
        suspensionReason: String? = nil,
        suspendedAt: String? = nil
    ) {
        self.id = id
        self.name = name
        self.slug = slug
        self.logoUrl = logoUrl
        self.accentColor = accentColor
        self.createdAt = createdAt
        self.accessStatus = accessStatus
        self.suspensionReason = suspensionReason
        self.suspendedAt = suspendedAt
    }
}

/// Mirrors `PlatformMembership` in `shared/platformTypes.ts`.
public struct PlatformMembership: Codable, Equatable, Sendable {
    public var organizationId: String
    public var userId: String
    public var role: PlatformRole
    public var createdAt: String

    public init(organizationId: String, userId: String, role: PlatformRole, createdAt: String) {
        self.organizationId = organizationId
        self.userId = userId
        self.role = role
        self.createdAt = createdAt
    }
}

/// Mirrors `PlatformInvite` in `shared/platformTypes.ts`.
///
/// Modeling note: TS types `role` as `Exclude<PlatformRole, "owner">`. Swift
/// has no direct "exclude one case" mechanism without declaring a duplicate
/// enum, so this reuses `PlatformRole` in full (a strict superset) rather than
/// introducing an `PlatformInviteRole` enum. The API is expected to never
/// produce `.owner` here; callers that need to enforce the narrower
/// constraint should validate at the call site.
public struct PlatformInvite: Codable, Equatable, Sendable {
    public var id: String
    public var organizationId: String
    public var email: String
    public var role: PlatformRole
    public var expiresAt: String
    public var acceptedAt: String?
    public var createdAt: String

    public init(
        id: String,
        organizationId: String,
        email: String,
        role: PlatformRole,
        expiresAt: String,
        acceptedAt: String?,
        createdAt: String
    ) {
        self.id = id
        self.organizationId = organizationId
        self.email = email
        self.role = role
        self.expiresAt = expiresAt
        self.acceptedAt = acceptedAt
        self.createdAt = createdAt
    }
}
