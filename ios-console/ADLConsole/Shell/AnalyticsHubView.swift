import ConsoleModels
import SwiftUI

/// Content for `ConsoleShellView`'s `.analytics` destination — a role-gated
/// sub-tab picker (`AnalyticsTab.visibleTabs(role:)`) over the six analytics
/// screens built in the earlier analytics-intelligence tasks
/// (`DeltaDashboardView`, `InvestorDashboardView`, `CategoryBreakdownView`,
/// `AgentPerformanceView`, `ExportPanelView`, `AIAnalyticsAssistantView`).
/// Map overlays (spatial intelligence / heat map) are NOT a tab here — they
/// were merged directly into `CompanyMapView` behind the existing `.map`
/// destination, per the analytics-intelligence design spec.
///
/// The selected tab is local `@State`, not `AppState`/`ConsoleRoute` — like
/// `AgentPerformanceViewModel.sortOption`, it is native-only UI state with no
/// TS `ConsoleRoute` equivalent to mirror, so it doesn't belong in the
/// strict-port `ConsoleState` package.
struct AnalyticsHubView: View {
    @EnvironmentObject private var appState: AppState
    let organizationId: String
    let role: PlatformRole
    @State private var selectedTab: AnalyticsTab

    init(organizationId: String, role: PlatformRole) {
        self.organizationId = organizationId
        self.role = role
        _selectedTab = State(initialValue: AnalyticsTab.visibleTabs(role: role).first ?? .agentPerformance)
    }

    private var visibleTabs: [AnalyticsTab] { AnalyticsTab.visibleTabs(role: role) }

    var body: some View {
        VStack(spacing: 0) {
            if visibleTabs.count > 1 {
                tabPicker
                Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.6))
            }
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(ADLConsoleColor.page)
        // A role switch (e.g. via the org picker) can change which tabs are
        // visible out from under a stale `selectedTab` — re-clamp whenever
        // `role` changes so a manager who picked "Export" never gets stuck
        // showing a tab a subsequently-selected reviewer org can't access.
        .onChange(of: role) { _, newRole in
            let allowed = AnalyticsTab.visibleTabs(role: newRole)
            if !allowed.contains(selectedTab) {
                selectedTab = allowed.first ?? .agentPerformance
            }
        }
    }

    private var tabPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(visibleTabs) { tab in
                    let selected = tab == selectedTab
                    Button {
                        selectedTab = tab
                    } label: {
                        Text(tab.title(appState.language))
                            .font(ADLConsoleFont.subheadline)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .foregroundStyle(selected ? ADLConsoleColor.navy : ADLConsoleColor.inkMuted)
                            .background(selected ? ADLConsoleColor.navyWash : Color.clear)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(ADLConsolePressStyle())
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(ADLConsoleColor.surface)
    }

    @ViewBuilder
    private var content: some View {
        // Defensive fallback: if `selectedTab` somehow isn't in `visibleTabs`
        // (e.g. between a role change and `onChange` re-clamping it), render
        // the first tab the role can actually see rather than an
        // inaccessible screen.
        let tab = visibleTabs.contains(selectedTab) ? selectedTab : (visibleTabs.first ?? .agentPerformance)
        switch tab {
        case .deltaDashboard:
            DeltaDashboardView(viewModel: appState.makeDeltaDashboardViewModel(organizationId: organizationId))
        case .investorDashboard:
            InvestorDashboardView(viewModel: appState.makeInvestorDashboardViewModel(organizationId: organizationId))
        case .categoryBreakdown:
            CategoryBreakdownView(viewModel: appState.makeCategoryBreakdownViewModel(organizationId: organizationId))
        case .agentPerformance:
            AgentPerformanceView(viewModel: appState.makeAgentPerformanceViewModel(organizationId: organizationId))
        case .export:
            ExportPanelView(viewModel: appState.makeExportPanelViewModel(organizationId: organizationId))
        case .aiAssistant:
            AIAnalyticsAssistantView(viewModel: appState.makeAIAnalyticsAssistantViewModel(organizationId: organizationId))
        }
    }
}
