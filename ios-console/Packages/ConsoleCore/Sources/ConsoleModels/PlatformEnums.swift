import Foundation

/// A member's role within an organization.
/// Mirrors `PlatformRole` in `shared/platformTypes.ts`.
public enum PlatformRole: String, Codable, CaseIterable, Sendable, Equatable {
    case owner = "owner"
    case manager = "manager"
    case reviewer = "reviewer"
    case collector = "collector"
    case viewer = "viewer"
}

/// The input type of a schema field.
/// Mirrors `PlatformFieldType` in `shared/platformTypes.ts`.
public enum PlatformFieldType: String, Codable, CaseIterable, Sendable, Equatable {
    case text = "text"
    case number = "number"
    case select = "select"
    case multiSelect = "multi_select"
    case date = "date"
    case boolean = "boolean"
    case photo = "photo"
    case gps = "gps"
}

/// Lifecycle status of a project.
/// Mirrors `PlatformProjectStatus` in `shared/platformTypes.ts`.
public enum PlatformProjectStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case draft = "draft"
    case active = "active"
    case archived = "archived"
}

/// The geographic coverage scope of a project.
/// Mirrors `PlatformProjectCoverageScope` in `shared/platformTypes.ts`.
public enum PlatformProjectCoverageScope: String, Codable, CaseIterable, Sendable, Equatable {
    case town = "town"
    case country = "country"
    case worldwide = "worldwide"
}

/// Whether an organization currently has platform access.
/// Mirrors `PlatformOrganizationAccessStatus` in `shared/platformTypes.ts`.
public enum PlatformOrganizationAccessStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case active = "active"
    case suspended = "suspended"
}

/// Review status of a captured record.
///
/// Modeling note: in `shared/platformTypes.ts` this is an inline string-literal
/// union on `PlatformRecord.status` (`"pending_review" | "approved" | "rejected"`),
/// not a named exported type. It is promoted to a named Swift enum here so the
/// field can be strongly typed and `CaseIterable`.
public enum PlatformRecordStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case pendingReview = "pending_review"
    case approved = "approved"
    case rejected = "rejected"
}

/// Publication status of a schema version.
///
/// Modeling note: in `shared/platformTypes.ts` this is an inline string-literal
/// union on `PlatformSchemaVersion.status` (`"draft" | "published"`), not a
/// named exported type. Promoted to a named Swift enum for the same reason as
/// `PlatformRecordStatus` above.
public enum PlatformSchemaVersionStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case draft = "draft"
    case published = "published"
}
