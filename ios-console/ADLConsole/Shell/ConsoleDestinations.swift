import ConsoleModels
import ConsoleState

/// A single console nav destination — screen identity plus bilingual title.
/// Mirrors one entry of `NAV_ITEMS` in `components/Console/ConsoleShell.tsx`.
struct ConsoleDestination: Equatable, Identifiable, Sendable {
    let screen: ConsoleScreen
    let titleEN: String
    let titleFR: String

    var id: ConsoleScreen { screen }

    func title(_ language: ConsoleLanguage) -> String {
        language.t(titleEN, titleFR)
    }
}

/// Pure, view-independent computation of the console's role-gated nav —
/// factored out of any SwiftUI view body per the task-4 brief so
/// `ADLConsoleTests` can assert it directly against `canAccessConsoleScreen`
/// (from `ConsoleState`) without touching a view hierarchy.
enum ConsoleNavigation {
    /// The full, unfiltered destination list — a direct port of `NAV_ITEMS`
    /// in `ConsoleShell.tsx`, PLUS `.map` (see `ConsoleScreen.map`'s doc
    /// comment — an iOS-console-only addition with no web `NAV_ITEMS`
    /// counterpart yet). Order matters: it is the order rendered in the nav.
    /// Note `JOIN` and `ONBOARDING` are deliberately absent here, same as on
    /// the web: `JOIN` is reached by invite link, and `ONBOARDING` by the
    /// separate ADL-admin-only "Create company" action, not this list.
    static let allDestinations: [ConsoleDestination] = [
        ConsoleDestination(screen: .map, titleEN: "Map", titleFR: "Carte"),
        ConsoleDestination(screen: .overview, titleEN: "Workspace", titleFR: "Espace de travail"),
        ConsoleDestination(screen: .data, titleEN: "Company data", titleFR: "Données entreprise"),
        ConsoleDestination(screen: .review, titleEN: "Review queue", titleFR: "File de révision"),
        ConsoleDestination(screen: .projects, titleEN: "Projects", titleFR: "Projets"),
        ConsoleDestination(screen: .members, titleEN: "Members", titleFR: "Membres"),
        ConsoleDestination(screen: .settings, titleEN: "Settings", titleFR: "Paramètres"),
    ]

    /// Filters `allDestinations` down to what a given role (and ADL-admin
    /// flag) may see, using `canAccessConsoleScreen` — the same gate the
    /// web `ConsoleShell` filters `NAV_ITEMS` with. No role-specific logic
    /// is duplicated here; this function is a thin, testable wrapper.
    static func visibleDestinations(role: PlatformRole, isAdlAdmin: Bool = false) -> [ConsoleDestination] {
        allDestinations.filter { canAccessConsoleScreen(role: role, screen: $0.screen, isAdlAdmin: isAdlAdmin) }
    }
}
