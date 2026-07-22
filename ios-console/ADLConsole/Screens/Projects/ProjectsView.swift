import ConsoleModels
import ConsoleState
import SwiftUI

/// The PROJECTS destination: every role can view the list, manager/owner get
/// a "New project" action + create sheet. Mirrors
/// `components/Console/ProjectsScreen.tsx`. All load/create logic lives in
/// `ProjectsViewModel` — this view only renders `@Published` state.
///
/// Tapping a project row opens Schema Builder (`SCHEMA_BUILDER` on the web)
/// — port of `ProjectsScreen.tsx`'s row rendering: `canManage ? <button
/// onClick={() => onNavigate({ screen: 'SCHEMA_BUILDER', projectId })}> :
/// <article>` (manager/owner rows are tappable with a chevron; every other
/// role's rows are static). `ConsoleShellView` owns presenting
/// `SchemaBuilderView` off `appState.route`, this view only sets the route.
struct ProjectsView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: ProjectsViewModel

    @State private var isCreateSheetPresented = false

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> ProjectsViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        VStack(spacing: 0) {
            projectMissionHeader
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 12)

            content
        }
        .background(ADLConsoleColor.page)
        .task { await viewModel.load() }
        .sheet(isPresented: $isCreateSheetPresented) {
            createSheet
        }
    }

    private var projectMissionHeader: some View {
        ADLConsoleHeroCard {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    ADLConsoleMicroLabel(
                        text: t("Project missions", "Missions de projet"),
                        color: Color.white.opacity(0.68)
                    )
                    Text(viewModel.canManage ? t("Manage collection coverage", "Gérer la couverture") : t("Active collection routes", "Parcours de collecte actifs"))
                        .font(ADLConsoleFont.title)
                        .foregroundStyle(.white)
                    Text(t(
                        "Each project defines where the team collects and which records are trusted enough to capture.",
                        "Chaque projet définit où l'équipe collecte et quels types de données sont assez fiables pour être capturés."
                    ))
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(Color.white.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true)
                }

                HStack(spacing: 8) {
                    projectHeaderMetric(
                        value: "\(viewModel.projects?.count ?? 0)",
                        label: t("projects", "projets"),
                        systemImage: "folder.fill"
                    )
                    projectHeaderMetric(
                        value: "\(activeProjectCount)",
                        label: t("active", "actifs"),
                        systemImage: "checkmark.seal.fill"
                    )
                    projectHeaderMetric(
                        value: "\(draftProjectCount)",
                        label: t("draft", "brouillon"),
                        systemImage: "pencil.and.list.clipboard"
                    )
                }

                if viewModel.canManage {
                    Button {
                        isCreateSheetPresented = true
                    } label: {
                        Label(t("New project", "Nouveau projet"), systemImage: "plus")
                            .font(ADLConsoleFont.subheadline)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 46)
                            .foregroundStyle(ADLConsoleColor.navy)
                            .background(.white)
                            .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.button, style: .continuous))
                    }
                    .buttonStyle(ADLConsolePressStyle())
                    .accessibilityLabel(t("New project", "Nouveau projet"))
                }
            }
        }
    }

    private var activeProjectCount: Int {
        viewModel.projects?.filter { $0.status == .active }.count ?? 0
    }

    private var draftProjectCount: Int {
        viewModel.projects?.filter { $0.status == .draft }.count ?? 0
    }

    private func projectHeaderMetric(value: String, label: String, systemImage: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.78))
            Text(value)
                .font(ADLConsoleFont.headline)
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(ADLConsoleFont.caption)
                .foregroundStyle(Color.white.opacity(0.72))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.white.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    // MARK: - Content states

    @ViewBuilder
    private var content: some View {
        if viewModel.projects == nil && viewModel.loadError == nil {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let loadError = viewModel.loadError {
            errorState(loadError)
        } else if let projects = viewModel.projects, projects.isEmpty {
            emptyState
        } else {
            projectList
        }
    }

    private func errorState(_ message: String) -> some View {
        ADLConsoleErrorState(
            message: message,
            retryTitle: t("Try again", "Réessayer")
        ) {
            Task { await viewModel.load(force: true) }
        }
    }

    private var emptyState: some View {
        ScrollView {
            ADLConsoleCard {
                ADLConsoleEmptyState(
                    systemImage: "folder",
                    headline: t("No projects yet", "Aucun projet pour le moment"),
                    description: t(
                        "Create your first one to define a record schema.",
                        "Créez le premier pour définir un schéma d'enregistrement."
                    )
                )
            }
            .padding(20)
        }
        .refreshable { await viewModel.load(force: true) }
    }

    private var projectList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.projects ?? [], id: \.id) { project in
                    projectRow(project)
                }
            }
            .padding(20)
        }
        .refreshable { await viewModel.load(force: true) }
    }

    // MARK: - Row

    private func projectRow(_ project: PlatformProject) -> some View {
        Group {
            if viewModel.canManage {
                Button {
                    appState.navigate(to: ConsoleRoute(screen: .schemaBuilder, projectId: project.id))
                } label: {
                    projectRowContent(project, showsChevron: true)
                }
                .buttonStyle(.plain)
            } else {
                projectRowContent(project, showsChevron: false)
            }
        }
    }

    private func projectRowContent(_ project: PlatformProject, showsChevron: Bool) -> some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(projectAccentBackground(project.status))
                            .frame(width: 46, height: 46)
                        Image(systemName: projectIcon(project.status))
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(projectAccentColor(project.status))
                    }
                    VStack(alignment: .leading, spacing: 5) {
                        Text(project.name)
                            .font(ADLConsoleFont.headline)
                            .foregroundStyle(ADLConsoleColor.ink)
                            .lineLimit(2)
                        Text(projectReadinessText(project))
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 8) {
                        statusPill(project.status)
                        if showsChevron {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                                .accessibilityHidden(true)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    missionTag(
                        text: coverageText(project),
                        systemImage: coverageIcon(project.coverageScope),
                        tint: ADLConsoleColor.navy
                    )
                    missionTag(
                        text: "\(t("Created", "Créé le")) \(ADLConsoleDateFormatting.mediumDate(project.createdAt))",
                        systemImage: "calendar",
                        tint: ADLConsoleColor.inkMuted
                    )
                }
            }
            .padding(16)
        }
    }

    private func projectReadinessText(_ project: PlatformProject) -> String {
        switch project.status {
        case .active:
            return t("Ready for field capture and project-specific records.", "Prêt pour la collecte terrain et les données propres au projet.")
        case .draft:
            return t("Schema setup is in progress before collectors can capture.", "La configuration du schéma est en cours avant la collecte.")
        case .archived:
            return t("Archived for reference; no new collection expected.", "Archivé pour référence ; aucune nouvelle collecte prévue.")
        }
    }

    private func projectIcon(_ status: PlatformProjectStatus) -> String {
        switch status {
        case .active: return "location.north.line.fill"
        case .draft: return "pencil.and.list.clipboard"
        case .archived: return "archivebox.fill"
        }
    }

    private func projectAccentColor(_ status: PlatformProjectStatus) -> Color {
        switch status {
        case .active: return ADLConsoleColor.forestDark
        case .draft: return ADLConsoleColor.navy
        case .archived: return ADLConsoleColor.inkMuted
        }
    }

    private func projectAccentBackground(_ status: PlatformProjectStatus) -> Color {
        switch status {
        case .active: return ADLConsoleColor.forestWash
        case .draft: return ADLConsoleColor.navyWash
        case .archived: return ADLConsoleColor.navyWash.opacity(0.7)
        }
    }

    private func coverageIcon(_ scope: PlatformProjectCoverageScope) -> String {
        switch scope {
        case .town: return "building.2.fill"
        case .country: return "map.fill"
        case .worldwide: return "globe.europe.africa.fill"
        }
    }

    private func missionTag(text: String, systemImage: String, tint: Color) -> some View {
        Label(text, systemImage: systemImage)
            .font(ADLConsoleFont.caption)
            .foregroundStyle(tint)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(ADLConsoleColor.navyWash.opacity(0.65))
            .clipShape(Capsule())
            .monospacedDigit()
    }

    private func coverageText(_ project: PlatformProject) -> String {
        guard project.coverageScope != .worldwide else {
            return t("Worldwide coverage", "Couverture mondiale")
        }
        return project.coverageLabel ?? ""
    }

    private func statusPill(_ status: PlatformProjectStatus) -> some View {
        let (text, color, background): (String, Color, Color)
        switch status {
        case .active:
            (text, color, background) = (t("Active", "Actif"), ADLConsoleColor.forestDark, ADLConsoleColor.forestWash)
        case .archived:
            (text, color, background) = (t("Archived", "Archivé"), ADLConsoleColor.inkMuted, ADLConsoleColor.navyWash)
        case .draft:
            (text, color, background) = (t("Draft", "Brouillon"), ADLConsoleColor.navy, ADLConsoleColor.navyWash)
        }
        return Text(text.uppercased())
            .font(ADLConsoleFont.microLabel)
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(background)
            .clipShape(Capsule())
    }

    // MARK: - Create sheet

    private var createSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        ADLConsoleMicroLabel(text: t("Project name", "Nom du projet"))
                        ADLConsoleInputField(
                            placeholder: t("e.g. Douala Pilot", "p. ex. Pilote Douala"),
                            text: $viewModel.newName,
                            disabled: viewModel.isCreateBusy
                        )
                    }

                    coverageFields

                    if let createError = viewModel.createError {
                        Text(createError)
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.danger)
                    }

                    ADLConsolePrimaryButton(
                        title: t("Create", "Créer"),
                        isBusy: viewModel.isCreateBusy,
                        isDisabled: viewModel.isCreateBusy || !viewModel.isCreateValid,
                        pressAnimationEnabled: false
                    ) {
                        Task {
                            if await viewModel.create() {
                                isCreateSheetPresented = false
                            }
                        }
                    }
                }
                .padding(20)
            }
            .navigationTitle(t("New project", "Nouveau projet"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("Cancel", "Annuler")) {
                        viewModel.cancelCreate()
                        isCreateSheetPresented = false
                    }
                }
            }
        }
    }

    private var coverageFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            ADLConsoleMicroLabel(text: t("Collection coverage", "Zone de collecte"))
            HStack(spacing: 8) {
                coverageScopeButton(.town, title: t("Town", "Ville"))
                coverageScopeButton(.country, title: t("Country", "Pays"))
                coverageScopeButton(.worldwide, title: t("Worldwide", "Monde"))
            }
            if viewModel.coverageScope != .worldwide {
                ADLConsoleInputField(
                    placeholder: viewModel.coverageScope == .town ? t("e.g. Nairobi", "p. ex. Nairobi") : t("e.g. Kenya", "p. ex. Kenya"),
                    text: $viewModel.coverageLabel,
                    disabled: viewModel.isCreateBusy
                )
            }
        }
    }

    private func coverageScopeButton(_ scope: PlatformProjectCoverageScope, title: String) -> some View {
        let isSelected = viewModel.coverageScope == scope
        return Button {
            viewModel.coverageScope = scope
            if scope == .worldwide { viewModel.coverageLabel = "" }
        } label: {
            Text(title)
                .font(ADLConsoleFont.subheadline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(isSelected ? ADLConsoleColor.navy : ADLConsoleColor.navyWash)
                .foregroundStyle(isSelected ? .white : ADLConsoleColor.ink)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .disabled(viewModel.isCreateBusy)
    }
}
