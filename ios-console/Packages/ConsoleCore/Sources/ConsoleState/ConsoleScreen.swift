import Foundation

/// Mirrors the `ConsoleScreen` string union in `lib/client/consoleState.ts`.
///
/// Raw values match the TS string literals exactly (uppercase, underscore-
/// separated) so any future JSON bridging round-trips without translation.
public enum ConsoleScreen: String, Codable, CaseIterable, Sendable, Equatable {
    case loading = "LOADING"
    case authRequired = "AUTH_REQUIRED"
    case overview = "OVERVIEW"
    case data = "DATA"
    case review = "REVIEW"
    case onboarding = "ONBOARDING"
    case projects = "PROJECTS"
    case schemaBuilder = "SCHEMA_BUILDER"
    case members = "MEMBERS"
    case settings = "SETTINGS"
    case join = "JOIN"
}

/// Mirrors the `ConsoleRoute` interface in `lib/client/consoleState.ts`.
///
/// `projectId` and `joinToken` are TS optional (`?`) fields, ported as
/// Swift optionals defaulting to `nil`.
public struct ConsoleRoute: Equatable, Sendable {
    public var screen: ConsoleScreen
    public var projectId: String?
    public var joinToken: String?

    public init(screen: ConsoleScreen, projectId: String? = nil, joinToken: String? = nil) {
        self.screen = screen
        self.projectId = projectId
        self.joinToken = joinToken
    }
}
