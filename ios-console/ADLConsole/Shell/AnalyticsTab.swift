import ConsoleModels

/// Sub-tabs within the `.analytics` console destination — a native-only
/// concept mirroring how `ConsoleOverviewContent` maps `.overview` to a
/// role-specific variant. Unlike `ConsoleScreen`, this has no TS union
/// equivalent (the web console has no analytics screen yet, per the
/// analytics-intelligence design spec), so it lives in the app layer rather
/// than `ConsoleState`, which stays a strict port of `lib/client/consoleState.ts`.
///
/// A pure, view-independent enum + role function so it can be unit tested
/// without touching a view hierarchy — mirrors how `ConsoleNavigation`
/// isolates its own pure computation from `ConsoleShellView`.
enum AnalyticsTab: String, CaseIterable, Equatable, Identifiable {
    case deltaDashboard
    case investorDashboard
    case categoryBreakdown
    case agentPerformance
    case export
    case aiAssistant

    var id: String { rawValue }

    /// Bilingual tab labels — matches each screen's own `navigationTitle`
    /// copy exactly (see `DeltaDashboardView`, `InvestorDashboardView`, etc.)
    /// so the tab picker and the pushed screen never disagree on naming.
    func title(_ language: ConsoleLanguage) -> String {
        switch self {
        case .deltaDashboard:
            return language.t("Delta Dashboard", "Tableau de bord des écarts")
        case .investorDashboard:
            return language.t("Investor Dashboard", "Tableau de bord investisseur")
        case .categoryBreakdown:
            return language.t("Category Breakdown", "Répartition par catégorie")
        case .agentPerformance:
            return language.t("Agent Performance", "Performance des agents")
        case .export:
            return language.t("Export Data", "Exporter les données")
        case .aiAssistant:
            return language.t("AI Assistant", "Assistant IA")
        }
    }

    /// Per the analytics-intelligence design spec's role-gating matrix
    /// (docs/superpowers/specs/2026-07-24-ios-console-analytics-intelligence-design.md):
    /// owner/manager see all six tabs; reviewer sees Delta Dashboard + Agent
    /// Performance (their map access comes from the separate `.map` console
    /// destination, unaffected by this list); collector sees only their own
    /// performance (Agent Performance — map access likewise comes from
    /// `.map`, not this list). Viewer is not in the spec's matrix at all, so
    /// it gets no tabs here — consistent with `canAccessConsoleScreen`
    /// already gating the `.analytics` destination itself out for viewer.
    static func visibleTabs(role: PlatformRole) -> [AnalyticsTab] {
        switch role {
        case .owner, .manager:
            return allCases
        case .reviewer:
            return [.deltaDashboard, .agentPerformance]
        case .collector:
            return [.agentPerformance]
        case .viewer:
            return []
        }
    }
}
