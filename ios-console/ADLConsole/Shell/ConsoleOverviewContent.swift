import ConsoleModels

/// What the `.overview` tab renders, by role. `ConsoleScreen.overview` is
/// shared by every role (per `canAccessConsoleScreen`), but a collector's
/// "workspace" is capture, not a record-summary dashboard — the web console
/// has no equivalent screen to mirror here (collector-focused capture is a
/// native-only concept, see the task-5 brief), so this mapping lives in the
/// app layer rather than `ConsoleState`, which stays a strict port of
/// `lib/client/consoleState.ts`.
///
/// A pure, `ConsoleShellView`-independent function so it can be unit tested
/// without touching a view hierarchy — mirrors how `ConsoleNavigation`
/// isolates its own pure computation from `ConsoleShellView`.
enum ConsoleOverviewContent: Equatable {
    case summary
    case capture

    static func content(for role: PlatformRole) -> ConsoleOverviewContent {
        role == .collector ? .capture : .summary
    }
}
