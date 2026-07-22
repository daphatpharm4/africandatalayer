import ConsoleAPI
import ConsoleModels
import ConsoleState
import SwiftUI

/// Role-based shell matching web console mobile chrome:
/// org header · horizontal pill tabs · language / sign-out · content.
struct ConsoleShellView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.colorScheme) private var colorScheme
    @State private var isAppSettingsPresented = false

    var body: some View {
        VStack(spacing: 0) {
            header
            pillNav
            syncBar
            Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.6))
            screenBody
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(ADLConsoleColor.page.ignoresSafeArea())
        .fullScreenCover(isPresented: $isAppSettingsPresented) {
            NavigationStack {
                AppSettingsView()
                    .environmentObject(appState)
            }
        }
        .fullScreenCover(isPresented: schemaBuilderPresented) {
            if let projectId = appState.route.projectId, canAccessSchemaBuilder {
                SchemaBuilderView(
                    viewModel: appState.makeSchemaBuilderViewModel(projectId: projectId),
                    onDismiss: { appState.navigate(to: ConsoleRoute(screen: .projects)) }
                )
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            orgAvatar
            VStack(alignment: .leading, spacing: 2) {
                Text(appState.organization?.name ?? appState.language.t("No organization", "Aucune organisation"))
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)
                    .lineLimit(1)
                if let role = appState.role {
                    Text(roleLabel(role).uppercased())
                        .font(ADLConsoleFont.microLabel)
                        .tracking(0.6)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
            Spacer(minLength: 8)
            if appState.organizations.count > 1 {
                Menu {
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
                    Divider()
                    Button {
                        appState.toggleLanguage()
                    } label: {
                        Label(
                            appState.language == .fr
                                ? "Switch to English"
                                : "Passer en français",
                            systemImage: "globe"
                        )
                    }
                    Button {
                        isAppSettingsPresented = true
                    } label: {
                        Label(appState.language.t("Settings", "Paramètres"), systemImage: "gearshape")
                    }
                    Button(role: .destructive) {
                        appState.signOut()
                    } label: {
                        Label(appState.language.t("Sign out", "Se déconnecter"), systemImage: "rectangle.portrait.and.arrow.right")
                    }
                } label: {
                    Image(systemName: "chevron.down.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(ADLConsoleColor.navy.opacity(0.75))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel(appState.language.t("Organization", "Organisation"))
            } else {
                Menu {
                    Button {
                        appState.toggleLanguage()
                    } label: {
                        Label(
                            appState.language == .fr
                                ? "Switch to English"
                                : "Passer en français",
                            systemImage: "globe"
                        )
                    }
                    Button {
                        isAppSettingsPresented = true
                    } label: {
                        Label(appState.language.t("Settings", "Paramètres"), systemImage: "gearshape")
                    }
                    Button(role: .destructive) {
                        appState.signOut()
                    } label: {
                        Label(appState.language.t("Sign out", "Se déconnecter"), systemImage: "rectangle.portrait.and.arrow.right")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(ADLConsoleColor.navy.opacity(0.75))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel(appState.language.t("Menu", "Menu"))
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(ADLConsoleColor.surface)
    }

    @ViewBuilder
    private var orgAvatar: some View {
        if let logo = appState.organization?.logoUrl, let url = URL(string: logo) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    avatarFallback
                }
            }
            .frame(width: 40, height: 40)
            .clipShape(Circle())
            .overlay(Circle().stroke(avatarOutlineColor, lineWidth: 1))
        } else {
            avatarFallback
        }
    }

    private var avatarFallback: some View {
        let initial = String((appState.organization?.name ?? "A").prefix(1)).uppercased()
        return ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [ADLConsoleColor.navy, ADLConsoleColor.terra],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(initial)
                .font(ADLConsoleFont.headline)
                .foregroundStyle(.white)
        }
        .frame(width: 40, height: 40)
        .overlay(Circle().stroke(avatarOutlineColor, lineWidth: 1))
    }

    private var avatarOutlineColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.10) : Color.black.opacity(0.10)
    }

    // MARK: - Pill nav

    private var pillNav: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(appState.visibleDestinations) { destination in
                    let selected = appState.route.screen == destination.screen
                        || (appState.route.screen == .schemaBuilder && destination.screen == .projects)
                    Button {
                        appState.navigate(to: ConsoleRoute(screen: destination.screen))
                    } label: {
                        Text(destination.title(appState.language))
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

    // MARK: - Controls

    private var syncBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 13))
                .foregroundStyle(ADLConsoleColor.forestDark)
            Text(appState.language.t("Connected", "Connecté"))
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.forestDark)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 7)
        .background(ADLConsoleColor.forestWash)
    }

    // MARK: - Body

    @ViewBuilder
    private var screenBody: some View {
        let screen = appState.route.screen == .schemaBuilder ? ConsoleScreen.projects : appState.route.screen
        switch screen {
        case .overview:
            overviewContent
        case .map:
            mapContent
        case .data:
            dataContent
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
    private var projectsContent: some View {
        if let organizationId = appState.organization?.id {
            ProjectsView(viewModel: appState.makeProjectsViewModel(organizationId: organizationId))
        } else {
            PlaceholderScreenView(screen: .projects)
        }
    }

    @ViewBuilder
    private var membersContent: some View {
        if let organizationId = appState.organization?.id {
            MembersView(viewModel: appState.makeMembersViewModel(organizationId: organizationId))
        } else {
            PlaceholderScreenView(screen: .members)
        }
    }

    @ViewBuilder
    private var settingsContent: some View {
        if let organizationId = appState.organization?.id, let organization = appState.organization {
            SettingsView(viewModel: appState.makeSettingsViewModel(organizationId: organizationId, organization: organization))
        } else {
            PlaceholderScreenView(screen: .settings)
        }
    }

    @ViewBuilder
    private var reviewContent: some View {
        if let organizationId = appState.organization?.id {
            ReviewQueueView(viewModel: appState.makeReviewQueueViewModel(organizationId: organizationId))
        } else {
            PlaceholderScreenView(screen: .review)
        }
    }

    @ViewBuilder
    private var mapContent: some View {
        if let organizationId = appState.organization?.id {
            CompanyMapView(viewModel: appState.makeCompanyMapViewModel(organizationId: organizationId))
        } else {
            PlaceholderScreenView(screen: .map)
        }
    }

    @ViewBuilder
    private var dataContent: some View {
        if let organizationId = appState.organization?.id {
            DataBrowseView(organizationId: organizationId)
        } else {
            PlaceholderScreenView(screen: .data)
        }
    }

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

    private func roleLabel(_ role: PlatformRole) -> String {
        role.label(appState.language.t)
    }
}
