import ConsoleModels
import Foundation

/// Mirrors the TS intersection type `PlatformOrganization & { role: PlatformRole }`
/// returned by `listMyOrganizations` in `lib/client/platformApi.ts` (view
/// `platform_org_list`). Swift has no intersection types, so the wire shape —
/// a flat JSON object with every `PlatformOrganization` field plus a sibling
/// `role` key — is decoded/encoded by delegating to `PlatformOrganization`'s
/// own `Codable` conformance for the shared fields and reading/writing `role`
/// as an extra key on the same container.
public struct PlatformOrganizationMembership: Codable, Equatable, Sendable {
    public var organization: PlatformOrganization
    public var role: PlatformRole

    public init(organization: PlatformOrganization, role: PlatformRole) {
        self.organization = organization
        self.role = role
    }

    private enum RoleCodingKeys: String, CodingKey {
        case role
    }

    public init(from decoder: Decoder) throws {
        organization = try PlatformOrganization(from: decoder)
        let container = try decoder.container(keyedBy: RoleCodingKeys.self)
        role = try container.decode(PlatformRole.self, forKey: .role)
    }

    public func encode(to encoder: Encoder) throws {
        try organization.encode(to: encoder)
        var container = encoder.container(keyedBy: RoleCodingKeys.self)
        try container.encode(role, forKey: .role)
    }
}

/// Mirrors the anonymous `organization` result object returned by
/// `updateAdminOrganizationAccessRequest` in `lib/client/platformApi.ts`
/// (view `platform_admin_org_access`).
public struct PlatformOrganizationAccessResult: Codable, Equatable, Sendable {
    public var id: String
    public var accessStatus: PlatformOrganizationAccessStatus
    public var suspensionReason: String?
    public var suspendedAt: String?
    public var suspendedBy: String?

    public init(
        id: String,
        accessStatus: PlatformOrganizationAccessStatus,
        suspensionReason: String?,
        suspendedAt: String?,
        suspendedBy: String?
    ) {
        self.id = id
        self.accessStatus = accessStatus
        self.suspensionReason = suspensionReason
        self.suspendedAt = suspendedAt
        self.suspendedBy = suspendedBy
    }
}

/// Mirrors the bare `{ members, invites }` payload returned directly by
/// `listOrgMembersRequest` in `lib/client/platformApi.ts` (view
/// `platform_org_members`) — unlike most list endpoints this one is not
/// re-wrapped in a single-field envelope before being returned to the caller.
public struct PlatformOrgMembersResponse: Codable, Equatable, Sendable {
    public var members: [PlatformMembership]
    public var invites: [PlatformInvite]

    public init(members: [PlatformMembership], invites: [PlatformInvite]) {
        self.members = members
        self.invites = invites
    }
}

/// Mirrors the bare `{ organizationId }` payload returned directly by
/// `acceptInviteRequest` in `lib/client/platformApi.ts` (view
/// `platform_invite_accept`).
public struct PlatformAcceptInviteResponse: Codable, Equatable, Sendable {
    public var organizationId: String

    public init(organizationId: String) {
        self.organizationId = organizationId
    }
}

/// Mirrors the bare `{ draft, published, versions }` payload returned
/// directly by `getSchemaRequest` in `lib/client/platformApi.ts` (view
/// `platform_schema_get`).
public struct PlatformSchemaGetResponse: Codable, Equatable, Sendable {
    public var draft: PlatformSchemaVersion?
    public var published: PlatformSchemaVersion?
    public var versions: [PlatformSchemaVersion]

    public init(draft: PlatformSchemaVersion?, published: PlatformSchemaVersion?, versions: [PlatformSchemaVersion]) {
        self.draft = draft
        self.published = published
        self.versions = versions
    }
}

/// Mirrors the TS string-literal union `"approved" | "rejected"` that
/// `reviewPlatformRecordRequest` narrows its `status` input to in
/// `lib/client/platformApi.ts` — deliberately narrower than
/// `PlatformRecordStatus` (which also has `.pendingReview`), since a review
/// decision can only ever set one of these two outcomes.
public enum PlatformRecordReviewStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case approved = "approved"
    case rejected = "rejected"
}

/// Result returned by `platform_notification_broadcast` after the server
/// resolves role-scoped recipients and attempts delivery.
public struct PlatformNotificationBroadcastResponse: Codable, Equatable, Sendable {
    public var sentCount: Int
    public var skippedCount: Int
    public var failedCount: Int

    public init(sentCount: Int, skippedCount: Int, failedCount: Int) {
        self.sentCount = sentCount
        self.skippedCount = skippedCount
        self.failedCount = failedCount
    }
}

/// Decode target for endpoints whose Swift method returns `Void` (the TS
/// counterpart returns `Promise<void>` and discards the parsed payload) —
/// `revokeInvite`, `updateMember`, `removeMember`. Declared with no stored
/// properties so it decodes successfully from any JSON object body without
/// asserting on its shape.
struct PlatformEmptyResponse: Decodable {}
