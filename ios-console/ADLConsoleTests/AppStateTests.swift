@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import ConsoleState
import XCTest

/// Auth-flow + role/route bootstrap tests for `AppState`, driven entirely
/// through the injectable `AuthServiceProtocol` and `PlatformTransport`
/// seams — no real network or auth handshake involved (see the TODO in
/// `Auth/AuthService.swift` for what that will take).
@MainActor
final class AppStateTests: XCTestCase {
    private func makeAppState(
        transport: MockPlatformTransport,
        authService: MockAuthService,
        offlineCache: ConsoleOfflineCacheProtocol = InMemoryConsoleOfflineCache()
    ) -> AppState {
        AppState(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            authService: authService,
            offlineCache: offlineCache
        )
    }

    private let singleOrgOwnerJSON = Data("""
    {"organizations":[
        {"id":"org-1","name":"Acme Co","slug":"acme","createdAt":"2026-01-01T00:00:00.000Z","role":"owner"}
    ]}
    """.utf8)

    private let multiOrgJSON = Data("""
    {"organizations":[
        {"id":"org-1","name":"Acme Co","slug":"acme","createdAt":"2026-01-01T00:00:00.000Z","role":"owner"},
        {"id":"org-2","name":"Beta Ltd","slug":"beta","createdAt":"2026-01-02T00:00:00.000Z","role":"reviewer"}
    ]}
    """.utf8)

    private let noOrgJSON = Data("""
    {"organizations":[]}
    """.utf8)

    // MARK: - Sign-in success

    func testSignInSuccessFlipsAuthenticatedAndLoadsLandingRouteForOwner() async {
        let transport = MockPlatformTransport()
        transport.responseData = singleOrgOwnerJSON
        let auth = MockAuthService()
        auth.behavior = .succeed
        let state = makeAppState(transport: transport, authService: auth)

        await state.signIn(email: "owner@acme.test", password: "hunter2")

        XCTAssertTrue(state.isAuthenticated)
        XCTAssertEqual(state.sessionState, .authenticated)
        XCTAssertFalse(state.isAuthenticating)
        XCTAssertNil(state.authErrorMessage)
        XCTAssertEqual(state.role, .owner)
        XCTAssertEqual(state.organization?.id, "org-1")
        // consoleLandingRoute(.owner) == .overview (reviewer -> .review, collector -> .map).
        XCTAssertEqual(state.route, ConsoleRoute(screen: .overview))
        XCTAssertEqual(auth.signInCallCount, 1)
        XCTAssertEqual(auth.lastEmail, "owner@acme.test")
    }

    func testSignInSuccessForReviewerLandsOnReviewRoute() async {
        let transport = MockPlatformTransport()
        transport.responseData = Data("""
        {"organizations":[
            {"id":"org-1","name":"Acme Co","slug":"acme","createdAt":"2026-01-01T00:00:00.000Z","role":"reviewer"}
        ]}
        """.utf8)
        let auth = MockAuthService()
        let state = makeAppState(transport: transport, authService: auth)

        await state.signIn(email: "reviewer@acme.test", password: "hunter2")

        XCTAssertEqual(state.role, .reviewer)
        XCTAssertEqual(state.route, ConsoleRoute(screen: .review))
    }

    func testSignInWithZeroOrganizationsLandsOnJoinRoute() async {
        let transport = MockPlatformTransport()
        transport.responseData = noOrgJSON
        let auth = MockAuthService()
        let state = makeAppState(transport: transport, authService: auth)

        await state.signIn(email: "newbie@acme.test", password: "hunter2")

        XCTAssertTrue(state.isAuthenticated)
        XCTAssertNil(state.role)
        XCTAssertNil(state.organization)
        XCTAssertEqual(state.route, ConsoleRoute(screen: .join))
    }

    func testSignInFallsBackToCachedOrganizationsWhenOffline() async {
        let transport = MockPlatformTransport()
        transport.statusCode = 503
        transport.responseData = Data("{\"error\":\"offline\"}".utf8)
        let auth = MockAuthService()
        let cachedMembership = PlatformOrganizationMembership(
            organization: PlatformOrganization(
                id: "org-cached",
                name: "Cached Org",
                slug: "cached",
                logoUrl: nil,
                accentColor: nil,
                createdAt: "2026-01-01T00:00:00.000Z"
            ),
            role: .collector
        )
        let cache = InMemoryConsoleOfflineCache(organizations: [cachedMembership])
        let state = makeAppState(transport: transport, authService: auth, offlineCache: cache)

        await state.signIn(email: "collector@acme.test", password: "hunter2")

        XCTAssertTrue(state.isAuthenticated)
        XCTAssertEqual(state.organizationsLoadState, .loaded)
        XCTAssertEqual(state.organization?.id, "org-cached")
        XCTAssertEqual(state.role, .collector)
        XCTAssertEqual(state.route, ConsoleRoute(screen: .map))
    }

    // MARK: - Sign-in failure

    func testSignInFailureSurfacesErrorAndLeavesUnauthenticated() async {
        let transport = MockPlatformTransport()
        let auth = MockAuthService()
        auth.behavior = .throwError(.invalidCredentials)
        let state = makeAppState(transport: transport, authService: auth)

        await state.signIn(email: "wrong@acme.test", password: "bad")

        XCTAssertFalse(state.isAuthenticated)
        XCTAssertEqual(state.sessionState, .unauthenticated)
        XCTAssertFalse(state.isAuthenticating)
        XCTAssertNotNil(state.authErrorMessage)
        XCTAssertNil(state.role)
        XCTAssertTrue(transport.capturedRequests.isEmpty, "org fetch must not happen when sign-in fails")
    }

    func testSignInFailureErrorMessageRespectsLanguage() async {
        let transport = MockPlatformTransport()
        let auth = MockAuthService()
        auth.behavior = .throwError(.invalidCredentials)
        let state = makeAppState(transport: transport, authService: auth)
        state.language = .fr

        await state.signIn(email: "wrong@acme.test", password: "bad")

        XCTAssertEqual(state.authErrorMessage, "Adresse e-mail ou mot de passe invalide.")
    }

    // MARK: - Organization switching

    func testSelectOrganizationRecomputesRoleAndRoute() async {
        let transport = MockPlatformTransport()
        transport.responseData = multiOrgJSON
        let auth = MockAuthService()
        let state = makeAppState(transport: transport, authService: auth)

        await state.signIn(email: "owner@acme.test", password: "hunter2")
        XCTAssertEqual(state.organization?.id, "org-1")
        XCTAssertEqual(state.role, .owner)
        XCTAssertEqual(state.route, ConsoleRoute(screen: .overview))

        state.selectOrganization(organizationId: "org-2")

        XCTAssertEqual(state.organization?.id, "org-2")
        XCTAssertEqual(state.role, .reviewer)
        XCTAssertEqual(state.route, ConsoleRoute(screen: .review))
    }

    // MARK: - Sign out

    func testSignOutResetsSessionState() async {
        let transport = MockPlatformTransport()
        transport.responseData = singleOrgOwnerJSON
        let auth = MockAuthService()
        let state = makeAppState(transport: transport, authService: auth)
        await state.signIn(email: "owner@acme.test", password: "hunter2")
        XCTAssertTrue(state.isAuthenticated)

        state.signOut()

        XCTAssertFalse(state.isAuthenticated)
        XCTAssertEqual(state.sessionState, .unauthenticated)
        XCTAssertNil(state.role)
        XCTAssertNil(state.organization)
        XCTAssertTrue(state.organizations.isEmpty)
        XCTAssertEqual(state.route, ConsoleRoute(screen: .loading))
    }

    // MARK: - visibleDestinations wiring

    func testVisibleDestinationsIsEmptyBeforeRoleIsKnown() {
        let state = makeAppState(transport: MockPlatformTransport(), authService: MockAuthService())
        XCTAssertTrue(state.visibleDestinations.isEmpty)
    }

    func testVisibleDestinationsReflectsBootstrappedRole() async {
        let transport = MockPlatformTransport()
        transport.responseData = singleOrgOwnerJSON
        let state = makeAppState(transport: transport, authService: MockAuthService())

        await state.signIn(email: "owner@acme.test", password: "hunter2")

        XCTAssertEqual(
            Set(state.visibleDestinations.map(\.screen)),
            Set(ConsoleNavigation.visibleDestinations(role: .owner).map(\.screen))
        )
    }

    // MARK: - Session restore

    func testRestoreSessionKeepsLoginHiddenUntilSessionIsResolvedAndLandsCollectorOnMap() async {
        let transport = MockPlatformTransport()
        transport.responseData = Data("""
        {"organizations":[
            {"id":"org-1","name":"Acme Co","slug":"acme","createdAt":"2026-01-01T00:00:00.000Z","role":"collector"}
        ]}
        """.utf8)
        let auth = MockAuthService()
        auth.restoredUser = AuthSessionUser(id: "user-1", email: "collector@acme.test", role: nil, isAdmin: false)
        let state = makeAppState(transport: transport, authService: auth)

        XCTAssertFalse(state.isAuthenticated)
        XCTAssertEqual(state.sessionState, .unknown)

        await state.tryRestoreSession()

        XCTAssertTrue(state.isAuthenticated)
        XCTAssertEqual(state.sessionState, .authenticated)
        XCTAssertEqual(state.role, .collector)
        XCTAssertEqual(state.route, ConsoleRoute(screen: .map))
        XCTAssertEqual(auth.restoreSessionCallCount, 1)
    }

    func testRestoreSessionWithoutUserMarksAuthRequiredOnlyAfterResolution() async {
        let transport = MockPlatformTransport()
        let auth = MockAuthService()
        let state = makeAppState(transport: transport, authService: auth)

        XCTAssertEqual(state.sessionState, .unknown)

        await state.tryRestoreSession()

        XCTAssertFalse(state.isAuthenticated)
        XCTAssertEqual(state.sessionState, .unauthenticated)
        XCTAssertEqual(state.route, ConsoleRoute(screen: .authRequired))
        XCTAssertTrue(transport.capturedRequests.isEmpty)
    }
}
