import ConsoleModels

/// Direct port of `consoleLandingRoute` in `lib/client/consoleState.ts`.
public func consoleLandingRoute(role: PlatformRole) -> ConsoleRoute {
    role == .reviewer ? ConsoleRoute(screen: .review) : ConsoleRoute(screen: .overview)
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
public func canAccessConsoleScreen(
    role: PlatformRole,
    screen: ConsoleScreen,
    isAdlAdmin: Bool = false
) -> Bool {
    switch screen {
    case .join, .overview, .projects:
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
