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
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(t("Projects", "Projets"))
                        .font(ADLConsoleFont.title)
                        .foregroundStyle(ADLConsoleColor.ink)
                    Text(t(
                        "Each project has its own record schema and its own data.",
                        "Chaque projet possède son propre schéma d'enregistrement et ses propres données."
                    ))
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                }
                Spacer(minLength: 8)
                if viewModel.canManage {
                    Button {
                        isCreateSheetPresented = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "plus")
                            Text(t("New project", "Nouveau projet"))
                                .font(ADLConsoleFont.subheadline)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(ADLConsoleColor.navy)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(ADLConsolePressStyle())
                    .accessibilityLabel(t("New project", "Nouveau projet"))
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)

            content
        }
        .background(ADLConsoleColor.page)
        .task { await viewModel.load() }
        .sheet(isPresented: $isCreateSheetPresented) {
            createSheet
        }
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
        VStack(spacing: 12) {
            Text(message)
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.danger)
                .multilineTextAlignment(.center)
            Button(t("Try again", "Réessayer")) {
                Task { await viewModel.load() }
            }
            .font(ADLConsoleFont.subheadline)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyState: some View {
        ScrollView {
            ADLConsoleCard {
                VStack(spacing: 8) {
                    Image(systemName: "folder")
                        .font(.system(size: 28))
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                    Text(t("No projects yet", "Aucun projet pour le moment"))
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    Text(t(
                        "Create your first one to define a record schema.",
                        "Créez le premier pour définir un schéma d'enregistrement."
                    ))
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
            }
            .padding(20)
        }
        .refreshable { await viewModel.load() }
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
        .refreshable { await viewModel.load() }
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
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(project.name)
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    Text("\(t("Created", "Créé le")) \(formattedDate(project.createdAt))")
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                    Text(coverageText(project))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.navy)
                }
                Spacer()
                statusPill(project.status)
                if showsChevron {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14))
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
            .padding(16)
        }
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
                        TextField(t("e.g. Douala Pilot", "p. ex. Pilote Douala"), text: $viewModel.newName)
                            .disabled(viewModel.isCreateBusy)
                            .padding(12)
                            .background(ADLConsoleColor.navyWash)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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
                        isDisabled: viewModel.isCreateBusy || !viewModel.isCreateValid
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
                TextField(
                    viewModel.coverageScope == .town ? t("e.g. Nairobi", "p. ex. Nairobi") : t("e.g. Kenya", "p. ex. Kenya"),
                    text: $viewModel.coverageLabel
                )
                .disabled(viewModel.isCreateBusy)
                .padding(12)
                .background(ADLConsoleColor.navyWash)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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

private func formattedDate(_ isoString: String) -> String {
    guard let date = ISO8601DateFormatter.parsingFractionalSeconds.date(from: isoString)
        ?? ISO8601DateFormatter().date(from: isoString)
    else {
        return isoString
    }
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    return formatter.string(from: date)
}

private extension ISO8601DateFormatter {
    nonisolated(unsafe) static let parsingFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
