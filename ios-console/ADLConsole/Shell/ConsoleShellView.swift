import ConsoleAPI
import ConsoleModels
import ConsoleState
import SwiftUI

/// Role-based navigation shell. Visible destinations come from
/// `AppState.visibleDestinations` (backed by the pure
/// `ConsoleNavigation.visibleDestinations`, which itself wraps
/// `canAccessConsoleScreen`) — this view never decides access itself, it
/// only renders what it's given. Mirrors `ConsoleShell.tsx`'s
/// `NAV_ITEMS.filter(...)` pattern, adapted to a mobile tab bar.
struct ConsoleShellView: View {
    @EnvironmentObject private var appState: AppState

    private var selection: Binding<ConsoleScreen> {
        Binding(
            get: { appState.route.screen },
            set: { appState.navigate(to: ConsoleRoute(screen: $0)) }
        )
    }

    var body: some View {
        TabView(selection: selection) {
            ForEach(appState.visibleDestinations) { destination in
                NavigationStack {
                    screenView(for: destination.screen)
                        .navigationTitle(destination.title(appState.language))
                        .toolbar { toolbarContent }
                }
                .tabItem {
                    Label(destination.title(appState.language), systemImage: icon(for: destination.screen))
                }
                .tag(destination.screen)
            }
        }
        .tint(ADLConsoleColor.navy)
    }

    @ViewBuilder
    private func screenView(for screen: ConsoleScreen) -> some View {
        switch screen {
        case .overview:
            overviewContent
        case .review:
            reviewContent
        default:
            PlaceholderScreenView(screen: screen)
        }
    }

    /// `.review` is nav-gated to reviewer/manager/owner by
    /// `AppState.visibleDestinations` (backed by `canAccessConsoleScreen`)
    /// before this view is ever reached, same as `.overview`'s capture
    /// gating above — no role check needed here.
    @ViewBuilder
    private var reviewContent: some View {
        if let organizationId = appState.organization?.id {
            ReviewQueueView(viewModel: appState.makeReviewQueueViewModel(organizationId: organizationId))
        } else {
            PlaceholderScreenView(screen: .review)
        }
    }

    /// `.overview` renders differently by role — see `ConsoleOverviewContent`.
    @ViewBuilder
    private var overviewContent: some View {
        switch appState.role.map(ConsoleOverviewContent.content(for:)) ?? .summary {
        case .capture:
            if let organizationId = appState.organization?.id {
                CaptureView(viewModel: appState.makeCaptureViewModel(organizationId: organizationId))
            } else {
                OverviewView()
            }
        case .summary:
            OverviewView()
        }
    }

    private func icon(for screen: ConsoleScreen) -> String {
        switch screen {
        case .overview: return "square.grid.2x2"
        case .data: return "tray.full"
        case .review: return "checkmark.shield"
        case .projects: return "folder"
        case .members: return "person.2"
        case .settings: return "gearshape"
        case .join, .onboarding, .loading, .authRequired, .schemaBuilder: return "questionmark.circle"
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            Menu {
                if appState.organizations.count > 1 {
                    Section(appState.language.t("Organization", "Organisation")) {
                        ForEach(appState.organizations, id: \.organization.id) { membership in
                            Button {
                                appState.selectOrganization(organizationId: membership.organization.id)
                            } label: {
                                if membership.organization.id == appState.organization?.id {
                                    Label(membership.organization.name, systemImage: "checkmark")
                                } else {
                                    Text(membership.organization.name)
                                }
                            }
                        }
                    }
                }
                Button {
                    appState.toggleLanguage()
                } label: {
                    Text(appState.language == .fr ? "EN · \(appState.language.t("Switch to English", "Passer en anglais"))" : "FR · \(appState.language.t("Switch to French", "Passer en français"))")
                }
                Button(role: .destructive) {
                    appState.signOut()
                } label: {
                    Text(appState.language.t("Sign out", "Se déconnecter"))
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .accessibilityLabel(appState.language.t("Console menu", "Menu de la console"))
        }
    }
}
