import ConsoleModels

/// Collector lands on the map (field-collection is map-first),
/// reviewer lands on the review queue, everyone else on the overview dashboard.
public func consoleLandingRoute(role: PlatformRole) -> ConsoleRoute {
    switch role {
    case .reviewer: return ConsoleRoute(screen: .review)
    case .collector: return ConsoleRoute(screen: .map)
    default: return ConsoleRoute(screen: .overview)
    }
}

/// Direct port of `canAccessConsoleScreen` in `lib/client/consoleState.ts`.
///
/// Access matrix (role x screen), cross-checked against the TS switch:
///   JOIN, OVERVIEW, PROJECTS -> true for every role
///   DATA                     -> role != .collector
///   REVIEW                   -> role in {.reviewer, .manager, .owner}
///   SCHEMA_BUILDER, MEMBERS  -> role in {.manager, .owner}
///   SETTINGS                 -> role == .owner
///   ONBOARDING               -> isAdlAdmin (role-independent)
///   LOADING, AUTH_REQUIRED   -> false (TS `default: return false`)
///   MAP                      -> true for every role (iOS-only addition, no
///                               TS case — a collector must reach it to
///                               capture/browse points, so it stays as open
///                               as OVERVIEW/PROJECTS rather than following
///                               DATA's `role != .collector` gate)
public func canAccessConsoleScreen(
    role: PlatformRole,
    screen: ConsoleScreen,
    isAdlAdmin: Bool = false
) -> Bool {
    switch screen {
    case .join, .overview, .projects, .map:
        return true
    case .data:
        return role != .collector
    case .review:
        return role == .reviewer || role == .manager || role == .owner
    case .schemaBuilder, .members:
        return role == .manager || role == .owner
    case .settings:
        return role == .owner
    case .onboarding:
        return isAdlAdmin
    case .loading, .authRequired:
        return false
    }
}
