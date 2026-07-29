import Foundation

/// Mirrors `AudienceFilter`/`audienceSchema` in `lib/server/email/campaigns.ts`
/// (reused verbatim by `lib/server/sms/campaigns.ts`'s `smsCampaignCreateSchema`).
/// Every field is `.optional()` server-side, so a `nil` field here is simply
/// omitted from the encoded JSON body/query rather than sent as an explicit
/// `null` — matching zod's "absent" semantics rather than "present and null".
public struct CommsAudienceFilter: Codable, Equatable, Sendable {
    /// One or more of the ADL app's own user roles: `"agent" | "admin" | "client"`.
    /// Kept as a plain `[String]` rather than an enum for the same reason
    /// `createInvite(role:)` does on `PlatformAPIClient` — this is a
    /// server-validated string set, not the console's own `PlatformRole`.
    public var roles: [String]?
    /// `"new" | "standard" | "trusted" | "elite" | "restricted"`.
    public var trustTiers: [String]?
    public var mapScopes: [String]?
    public var requireEmailOptIn: Bool?
    public var lastActiveDays: Int?

    public init(
        roles: [String]? = nil,
        trustTiers: [String]? = nil,
        mapScopes: [String]? = nil,
        requireEmailOptIn: Bool? = nil,
        lastActiveDays: Int? = nil
    ) {
        self.roles = roles
        self.trustTiers = trustTiers
        self.mapScopes = mapScopes
        self.requireEmailOptIn = requireEmailOptIn
        self.lastActiveDays = lastActiveDays
    }
}

/// Mirrors the row shape returned by `listCampaigns` in
/// `lib/server/email/campaigns.ts` (`GET api/privacy?view=campaigns`).
public struct EmailCampaign: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var subject: String
    public var status: String
    public var recipientCount: Int
    public var sentCount: Int
    public var failedCount: Int
    public var suppressedCount: Int
    public var createdAt: String
    public var startedAt: String?
    public var completedAt: String?

    public init(
        id: String,
        subject: String,
        status: String,
        recipientCount: Int,
        sentCount: Int,
        failedCount: Int,
        suppressedCount: Int,
        createdAt: String,
        startedAt: String? = nil,
        completedAt: String? = nil
    ) {
        self.id = id
        self.subject = subject
        self.status = status
        self.recipientCount = recipientCount
        self.sentCount = sentCount
        self.failedCount = failedCount
        self.suppressedCount = suppressedCount
        self.createdAt = createdAt
        self.startedAt = startedAt
        self.completedAt = completedAt
    }
}

/// Mirrors the row shape returned by `listSmsCampaigns` in
/// `lib/server/sms/campaigns.ts` (`GET api/privacy?view=sms-campaigns`).
public struct SmsCampaign: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var message: String
    public var status: String
    public var recipientCount: Int
    public var sentCount: Int
    public var failedCount: Int
    public var suppressedCount: Int
    public var createdAt: String
    public var startedAt: String?
    public var completedAt: String?

    public init(
        id: String,
        message: String,
        status: String,
        recipientCount: Int,
        sentCount: Int,
        failedCount: Int,
        suppressedCount: Int,
        createdAt: String,
        startedAt: String? = nil,
        completedAt: String? = nil
    ) {
        self.id = id
        self.message = message
        self.status = status
        self.recipientCount = recipientCount
        self.sentCount = sentCount
        self.failedCount = failedCount
        self.suppressedCount = suppressedCount
        self.createdAt = createdAt
        self.startedAt = startedAt
        self.completedAt = completedAt
    }
}

/// Mirrors `CreatedCampaign` returned by `createCampaign` in
/// `lib/server/email/campaigns.ts` — the bare `POST api/privacy?view=campaigns`
/// response body (not wrapped in an envelope). `createdBy` is derived
/// server-side from the session and never appears in this response or the
/// request that produced it.
public struct CreatedEmailCampaign: Codable, Equatable, Sendable {
    public var id: String
    public var status: String
    public var recipientCount: Int
    public var suppressedCount: Int
    public var capped: Bool

    public init(id: String, status: String, recipientCount: Int, suppressedCount: Int, capped: Bool) {
        self.id = id
        self.status = status
        self.recipientCount = recipientCount
        self.suppressedCount = suppressedCount
        self.capped = capped
    }
}

/// Mirrors `CreatedSmsCampaign` returned by `createSmsCampaign` in
/// `lib/server/sms/campaigns.ts` — the bare `POST api/privacy?view=sms-campaigns`
/// response body.
public struct CreatedSmsCampaign: Codable, Equatable, Sendable {
    public var id: String
    public var status: String
    public var recipientCount: Int
    public var capped: Bool
    public var segmentsPerRecipient: Int
    public var estimatedCostUnits: Int?

    public init(
        id: String,
        status: String,
        recipientCount: Int,
        capped: Bool,
        segmentsPerRecipient: Int,
        estimatedCostUnits: Int? = nil
    ) {
        self.id = id
        self.status = status
        self.recipientCount = recipientCount
        self.capped = capped
        self.segmentsPerRecipient = segmentsPerRecipient
        self.estimatedCostUnits = estimatedCostUnits
    }
}

/// Mirrors `TemplateRow` returned by `listTemplates` in
/// `lib/server/email/templates.ts` (`GET api/privacy?view=email-templates`).
public struct EmailTemplate: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var slug: String
    public var name: String
    public var subjectEn: String
    public var subjectFr: String
    public var htmlEn: String
    public var htmlFr: String
    public var textEn: String
    public var textFr: String
    public var variables: [String]
    public var archived: Bool
    public var createdAt: String
    public var updatedAt: String

    public init(
        id: String,
        slug: String,
        name: String,
        subjectEn: String,
        subjectFr: String,
        htmlEn: String,
        htmlFr: String,
        textEn: String,
        textFr: String,
        variables: [String],
        archived: Bool,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.slug = slug
        self.name = name
        self.subjectEn = subjectEn
        self.subjectFr = subjectFr
        self.htmlEn = htmlEn
        self.htmlFr = htmlFr
        self.textEn = textEn
        self.textFr = textFr
        self.variables = variables
        self.archived = archived
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Mirrors the bare object returned by `GET api/privacy?view=audience-preview`
/// (see `resolveAudience` in `lib/server/email/campaigns.ts`). Used for both
/// the email and SMS composer flows — SMS just ignores `suppressedCount`
/// (its resolver reports opt-outs as exclusions up front, not a separate
/// suppression list) and treats `maxRecipients` as its own channel's cap
/// only when the caller passed `requireEmailOptIn: false`-shaped SMS-style
/// audience params.
public struct AudiencePreview: Codable, Equatable, Sendable {
    public var recipientCount: Int
    public var totalCount: Int
    public var suppressedCount: Int
    public var maxRecipients: Int

    public init(recipientCount: Int, totalCount: Int, suppressedCount: Int, maxRecipients: Int) {
        self.recipientCount = recipientCount
        self.totalCount = totalCount
        self.suppressedCount = suppressedCount
        self.maxRecipients = maxRecipients
    }
}
