import ConsoleAPI
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

    init(apiClient: PlatformAPIClient, authService: AuthServiceProtocol) {
        self.apiClient = apiClient
        self.authService = authService
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
