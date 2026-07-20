import ConsoleAPI
import ConsoleForms
import ConsoleModels
import ConsoleState
import Foundation

/// App-level state, the single owner of auth/session/role/route — mirrors
/// the role `App.tsx` plays for the field app and `ConsoleApp.tsx` plays for
/// the web console client. No external state library; plain
/// `@Published`/`ObservableObject`, per CLAUDE.md.
@MainActor
final class AppState: ObservableObject {
    /// Coarse load status for the organizations fetch, surfaced by
    /// `RootView` while bootstrapping after a successful sign-in.
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    @Published private(set) var isAuthenticated: Bool = false
    @Published private(set) var isAuthenticating: Bool = false
    @Published private(set) var authErrorMessage: String?

    @Published private(set) var organizations: [PlatformOrganizationMembership] = []
    @Published private(set) var organization: PlatformOrganization?
    @Published private(set) var role: PlatformRole?
    @Published private(set) var route: ConsoleRoute = ConsoleRoute(screen: .loading)
    @Published private(set) var organizationsLoadState: LoadState = .idle

    @Published var language: ConsoleLanguage = .en
    /// Whether the signed-in user is an ADL platform admin (not an org
    /// role) — gates the `ONBOARDING` screen per `canAccessConsoleScreen`.
    /// TODO(real-cookie-handshake): derive this from `GET /api/auth/session`
    /// (`session.user.role === 'admin'`) once the real handshake lands; the
    /// stub auth flow has no session payload to read it from yet.
    @Published var isAdlAdmin: Bool = false

    /// Exposed (not private) so screen views — e.g. `OverviewView` — can
    /// issue their own reads through the same injectable client `AppState`
    /// bootstraps with, instead of `AppState` growing a method per screen.
    let apiClient: PlatformAPIClient
    private let authService: AuthServiceProtocol

    /// The offline record-capture queue, owned centrally (not per-screen) so
    /// a draft enqueued in one `CaptureView` session survives navigating
    /// away and back. Defaults to a `FileRecordQueueStore` under Application
    /// Support; tests inject an in-memory store via `init`.
    let recordQueue: RecordQueue
    private let locationServiceFactory: () -> LocationServiceProtocol?

    init(
        apiClient: PlatformAPIClient,
        authService: AuthServiceProtocol,
        recordQueue: RecordQueue = AppState.makeDefaultRecordQueue(),
        locationServiceFactory: @escaping () -> LocationServiceProtocol? = { CoreLocationService() }
    ) {
        self.apiClient = apiClient
        self.authService = authService
        self.recordQueue = recordQueue
        self.locationServiceFactory = locationServiceFactory
    }

    private static func makeDefaultRecordQueue() -> RecordQueue {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let fileURL = directory.appendingPathComponent("adl-console-record-queue.json")
        return RecordQueue(store: FileRecordQueueStore(fileURL: fileURL))
    }

    /// Builds a fresh `CaptureViewModel` wired to this `AppState`'s shared
    /// `apiClient`/`recordQueue`/`language` — the factory `ConsoleShellView`
    /// calls to construct `CaptureView`'s `@StateObject`. `attachPointId`
    /// (default `nil`) is the company map's attach seam: when the map's
    /// floating "+" is used, it is `nil` (a fresh point); when "Update this
    /// point" is used, it is the tapped point's `CollapsedPlatformPoint.rootId`,
    /// so the new capture joins that point's chain instead of starting one.
    func makeCaptureViewModel(organizationId: String, attachPointId: String? = nil) -> CaptureViewModel {
        CaptureViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            queue: recordQueue,
            language: language,
            locationService: locationServiceFactory(),
            attachPointId: attachPointId
        )
    }

    /// Builds a fresh `CompanyMapViewModel` for `ConsoleShellView`'s MAP
    /// destination, mirroring `makeReviewQueueViewModel` above.
    func makeCompanyMapViewModel(organizationId: String) -> CompanyMapViewModel {
        CompanyMapViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            language: language
        )
    }

    /// Builds a fresh `ReviewQueueViewModel` wired to this `AppState`'s
    /// shared `apiClient`/`language` — the factory `ConsoleShellView` calls
    /// to construct `ReviewQueueView`'s `@StateObject`, mirroring
    /// `makeCaptureViewModel` above.
    func makeReviewQueueViewModel(organizationId: String) -> ReviewQueueViewModel {
        ReviewQueueViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            language: language
        )
    }

    /// Builds a fresh `ProjectsViewModel` for `ConsoleShellView`'s PROJECTS
    /// destination, mirroring `makeReviewQueueViewModel` above.
    func makeProjectsViewModel(organizationId: String) -> ProjectsViewModel {
        ProjectsViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            role: role ?? .viewer,
            language: language
        )
    }

    /// Builds a fresh `MembersViewModel` for `ConsoleShellView`'s MEMBERS
    /// destination. `viewerUserId` mirrors `isAdlAdmin` above — the stub
    /// auth flow has no session payload to read the signed-in user's id
    /// from yet, so it stays `nil` until the real cookie handshake lands
    /// (TODO(real-cookie-handshake), same as `isAdlAdmin`).
    func makeMembersViewModel(organizationId: String) -> MembersViewModel {
        MembersViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            viewerRole: role ?? .viewer,
            viewerUserId: nil,
            viewerIsAdlAdmin: isAdlAdmin,
            language: language
        )
    }

    /// Builds a fresh `SchemaBuilderViewModel` for the SCHEMA_BUILDER
    /// destination (`route.projectId`), mirroring `makeReviewQueueViewModel`
    /// above. Access is already gated manager/owner by
    /// `canAccessConsoleScreen` before `ConsoleShellView` ever presents this.
    func makeSchemaBuilderViewModel(projectId: String) -> SchemaBuilderViewModel {
        SchemaBuilderViewModel(
            apiClient: apiClient,
            projectId: projectId,
            language: language
        )
    }

    /// Builds a fresh `SettingsViewModel` for `ConsoleShellView`'s SETTINGS
    /// destination, seeded from the currently-selected `organization`.
    func makeSettingsViewModel(organizationId: String, organization: PlatformOrganization) -> SettingsViewModel {
        SettingsViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            organization: organization,
            role: role ?? .viewer,
            language: language
        )
    }

    /// Destinations visible in the current role's nav — thin pass-through to
    /// the pure `ConsoleNavigation.visibleDestinations`, so views never
    /// compute this themselves.
    var visibleDestinations: [ConsoleDestination] {
        guard let role else { return [] }
        return ConsoleNavigation.visibleDestinations(role: role, isAdlAdmin: isAdlAdmin)
    }

    func toggleLanguage() {
        language = language.toggled
    }

    /// Drives the auth form. On success, loads organizations and computes
    /// the landing route; on failure, surfaces a bilingual error and leaves
    /// `isAuthenticated` false.
    func signIn(email: String, password: String) async {
        guard !isAuthenticating else { return }
        isAuthenticating = true
        authErrorMessage = nil
        do {
            try await authService.signIn(email: email, password: password)
            isAuthenticated = true
            await loadOrganizations()
        } catch let error as AuthServiceError {
            authErrorMessage = error.message(language)
            isAuthenticated = false
        } catch {
            authErrorMessage = AuthServiceError.network(String(describing: error)).message(language)
            isAuthenticated = false
        }
        isAuthenticating = false
    }

    func signOut() {
        isAuthenticated = false
        organizations = []
        organization = nil
        role = nil
        route = ConsoleRoute(screen: .loading)
        organizationsLoadState = .idle
        authErrorMessage = nil
    }

    /// Loads the signed-in user's organizations via `ConsoleAPI` and derives
    /// role + landing route from the first membership — mirrors
    /// `ConsoleApp.tsx`'s org bootstrap (it also defaults to the first
    /// accessible org absent a persisted selection). A brand-new invitee
    /// with zero organizations lands on `JOIN`, same as the web client.
    func loadOrganizations() async {
        organizationsLoadState = .loading
        do {
            let memberships = try await apiClient.listMyOrganizations()
            organizations = memberships
            if let first = memberships.first {
                selectOrganization(organizationId: first.organization.id)
            } else {
                organization = nil
                role = nil
                route = ConsoleRoute(screen: .join)
            }
            organizationsLoadState = .loaded
        } catch {
            organizationsLoadState = .failed(String(describing: error))
        }
    }

    /// Switches the active organization and recomputes the landing route
    /// for its role — mirrors the web client's org picker in
    /// `ConsoleShell.tsx` (`onSelectOrganization`).
    func selectOrganization(organizationId: String) {
        guard let membership = organizations.first(where: { $0.organization.id == organizationId }) else { return }
        organization = membership.organization
        role = membership.role
        route = consoleLandingRoute(role: membership.role)
    }

    func navigate(to newRoute: ConsoleRoute) {
        route = newRoute
    }
}
