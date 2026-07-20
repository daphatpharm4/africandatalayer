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
        .fullScreenCover(isPresented: schemaBuilderPresented) {
            if let projectId = appState.route.projectId, canAccessSchemaBuilder {
                SchemaBuilderView(
                    viewModel: appState.makeSchemaBuilderViewModel(projectId: projectId),
                    onDismiss: { appState.navigate(to: ConsoleRoute(screen: .projects)) }
                )
            }
        }
    }

    /// `.schemaBuilder` is not a tab (`AppState.visibleDestinations` never
    /// includes it — it's reached by tapping a project row, not the tab
    /// bar), so it is presented as a full-screen cover driven directly by
    /// `appState.route` rather than through `screenView(for:)`'s `TabView`
    /// switch above. Access is still gated the same way every other
    /// manager/owner-only destination is: `canAccessConsoleScreen` (not a
    /// hand-rolled check here).
    private var schemaBuilderPresented: Binding<Bool> {
        Binding(
            get: { appState.route.screen == .schemaBuilder },
            set: { isPresented in
                if !isPresented { appState.navigate(to: ConsoleRoute(screen: .projects)) }
            }
        )
    }

    private var canAccessSchemaBuilder: Bool {
        guard let role = appState.role else { return false }
        return canAccessConsoleScreen(role: role, screen: .schemaBuilder, isAdlAdmin: appState.isAdlAdmin)
    }

    @ViewBuilder
    private func screenView(for screen: ConsoleScreen) -> some View {
        switch screen {
        case .overview:
            overviewContent
        case .review:
            reviewContent
        case .projects:
            projectsContent
        case .members:
            membersContent
        case .settings:
            settingsContent
        default:
            PlaceholderScreenView(screen: screen)
        }
    }

    /// `.projects` is nav-gated visible for every role by
    /// `AppState.visibleDestinations` — `ProjectsViewModel.canManage` (not a
    /// nav gate) handles the manager/owner-only "New project" action inside
    /// the view itself, same split `ProjectsScreen.tsx` uses.
    @ViewBuilder
    private var projectsContent: some View {
        if let organizationId = appState.organization?.id {
            ProjectsView(viewModel: appState.makeProjectsViewModel(organizationId: organizationId))
        } else {
            PlaceholderScreenView(screen: .projects)
        }
    }

    /// `.members` is nav-gated to manager/owner by `AppState.visibleDestinations`.
    @ViewBuilder
    private var membersContent: some View {
        if let organizationId = appState.organization?.id {
            MembersView(viewModel: appState.makeMembersViewModel(organizationId: organizationId))
        } else {
            PlaceholderScreenView(screen: .members)
        }
    }

    /// `.settings` is nav-gated to owner by `AppState.visibleDestinations`.
    @ViewBuilder
    private var settingsContent: some View {
        if let organizationId = appState.organization?.id, let organization = appState.organization {
            SettingsView(viewModel: appState.makeSettingsViewModel(organizationId: organizationId, organization: organization))
        } else {
            PlaceholderScreenView(screen: .settings)
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
