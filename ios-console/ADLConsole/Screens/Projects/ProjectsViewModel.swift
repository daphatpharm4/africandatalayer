import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `ProjectsView` — the org's project list plus a manager/owner-only
/// create form. Source of truth for behavior:
/// `components/Console/ProjectsScreen.tsx` (web, read-only reference) +
/// `components/Console/ProjectCoverageFields.tsx` + `lib/client/platformApi.ts`.
///
/// Web parity notes:
///  - `canManage` mirrors `ConsoleApp.tsx`'s prop:
///    `selectedOrganization.role === 'manager' || selectedOrganization.role
///    === 'owner'` — computed here from `role` so the view never re-derives it.
///  - `create()` ports `handleCreate` exactly: trims `name`, and — unless
///    `coverageScope === .worldwide` — requires the trimmed `coverageLabel`
///    to be at least 2 characters; `coverageLabel` is only sent to the API
///    when the scope isn't worldwide (matches `coverageScope === 'worldwide'
///    ? undefined : normalizedCoverageLabel`). On success the new project is
///    prepended to `projects` (`current ? [project, ...current] : [project]`)
///    and the form fields reset, same as the web screen.
///  - Tapping a project row to open `SCHEMA_BUILDER` (`onNavigate({ screen:
///    'SCHEMA_BUILDER', projectId })`) is explicitly out of scope for this
///    task (Task 7b builds Schema Builder) — `ProjectsView` renders rows
///    read-only for now; wiring that navigation is left for that task.
@MainActor
final class ProjectsViewModel: ObservableObject {
    @Published private(set) var projects: [PlatformProject]?
    @Published private(set) var loadError: String?

    @Published var newName: String = ""
    @Published var coverageScope: PlatformProjectCoverageScope = .town
    @Published var coverageLabel: String = ""
    @Published private(set) var isCreateBusy: Bool = false
    @Published private(set) var createError: String?

    let language: ConsoleLanguage
    let role: PlatformRole

    private let apiClient: PlatformAPIClient
    private let organizationId: String

    init(apiClient: PlatformAPIClient, organizationId: String, role: PlatformRole, language: ConsoleLanguage) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.role = role
        self.language = language
    }

    // MARK: - Derived state

    /// Port of `ConsoleApp.tsx`'s `canManage` prop passed into `ProjectsScreen`.
    var canManage: Bool { role == .manager || role == .owner }

    /// Port of the create button's `disabled` expression, inverted:
    /// `!(newName.trim().length === 0 || (coverageScope !== 'worldwide' &&
    /// coverageLabel.trim().length < 2))`.
    var isCreateValid: Bool {
        let trimmedName = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return false }
        if coverageScope != .worldwide {
            return coverageLabel.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
        }
        return true
    }

    // MARK: - Load

    /// `view=platform_project_list`, GET, `organizationId`. Port of
    /// `listProjectsRequest`/`PlatformAPIClient.listProjects`.
    func load(force: Bool = false) async {
        guard force || projects == nil else { return }
        projects = nil
        loadError = nil
        do {
            projects = try await apiClient.listProjects(organizationId: organizationId)
        } catch {
            loadError = describePlatformError(error, language: language)
        }
    }

    // MARK: - Create

    /// `view=platform_project_create`, POST. Port of `handleCreate` — see the
    /// type doc above for the validation + prepend-on-success semantics.
    @discardableResult
    func create() async -> Bool {
        guard canManage else { return false }
        let trimmedName = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedLabel = coverageLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty, coverageScope == .worldwide || trimmedLabel.count >= 2 else {
            return false
        }
        createError = nil
        isCreateBusy = true
        defer { isCreateBusy = false }
        do {
            let project = try await apiClient.createProject(
                organizationId: organizationId,
                name: trimmedName,
                coverageScope: coverageScope,
                coverageLabel: coverageScope == .worldwide ? nil : trimmedLabel
            )
            projects = [project] + (projects ?? [])
            resetCreateFields()
            return true
        } catch {
            createError = describePlatformError(error, language: language)
            return false
        }
    }

    /// Port of `cancelCreate` — resets every create-form field and error.
    func cancelCreate() {
        resetCreateFields()
    }

    private func resetCreateFields() {
        newName = ""
        coverageScope = .town
        coverageLabel = ""
        createError = nil
    }
}
