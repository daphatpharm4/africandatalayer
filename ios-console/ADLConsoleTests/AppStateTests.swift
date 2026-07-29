@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import ConsolePersistence
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
        offlineCache: ConsoleOfflineCacheProtocol = InMemoryConsoleOfflineCache(),
        recordLedger: RecordLedger? = nil,
        mediaStore: (any CaptureMediaStoreProtocol)? = nil,
        connectivityMonitor: (any ConnectivityMonitoring)? = nil
    ) -> AppState {
        AppState(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            authService: authService,
            offlineCache: offlineCache,
            recordLedger: recordLedger,
            mediaStore: mediaStore,
            connectivityMonitor: connectivityMonitor
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

    // MARK: - syncEngines cleanup (M4)

    /// Regression test for M4: `syncEngines` (a `[String: SyncEngine]`
    /// cache keyed by organization ID, populated lazily by
    /// `durableSyncEngine(organizationID:)`) was only ever appended to and
    /// leaked one `SyncEngine` per organization the user ever visited.
    /// Exercises the real production path end-to-end — `tryRestoreSession`
    /// → `loadOrganizations` → `selectOrganization` → `triggerDurableSync`
    /// — with a real in-memory `RecordLedger`/`RecordDatabase` and an
    /// `InMemoryCaptureMediaStore`, so the engine actually gets built and
    /// cached rather than asserting the fix in isolation.
    func testSyncEnginesClearedOnRealOrgSwitchButNotOnRedundantReselection() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = multiOrgJSON
        let auth = MockAuthService()
        auth.restoredResult = .authenticated(AuthSessionUser(id: "user-1", email: "owner@acme.test", role: nil, isAdmin: false))
        let ledger = RecordLedger(database: try RecordDatabase.inMemory())
        let state = makeAppState(
            transport: transport,
            authService: auth,
            recordLedger: ledger,
            mediaStore: InMemoryCaptureMediaStore(),
            connectivityMonitor: StubConnectivityMonitor(state: .satisfied)
        )

        await state.tryRestoreSession()
        state.startRuntime()
        XCTAssertEqual(state.organization?.id, "org-1")

        // First sync trigger for org-1 lazily builds and caches its engine.
        await state.triggerDurableSync(.manual)
        XCTAssertEqual(state.syncEnginesCount, 1, "expected org-1's engine to be cached")

        // Redundant re-selection of the already-current org (mirrors what
        // `loadOrganizations()` does on every relaunch/landing) must NOT
        // thrash the cache.
        state.selectOrganization(organizationId: "org-1")
        XCTAssertEqual(state.syncEnginesCount, 1, "redundant reselection of the current org must not clear the cache")

        // An actual switch must drop the stale org-1 engine synchronously.
        state.selectOrganization(organizationId: "org-2")
        XCTAssertEqual(state.syncEnginesCount, 0, "switching organizations must drop the previous org's cached engine")

        // The cache rebuilds lazily and only holds the new org going forward.
        await state.triggerDurableSync(.manual)
        XCTAssertEqual(state.syncEnginesCount, 1, "expected org-2's engine to rebuild lazily after the switch")
    }

    func testSyncEnginesClearedOnSignOut() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = singleOrgOwnerJSON
        let auth = MockAuthService()
        auth.restoredResult = .authenticated(AuthSessionUser(id: "user-1", email: "owner@acme.test", role: nil, isAdmin: false))
        let ledger = RecordLedger(database: try RecordDatabase.inMemory())
        let state = makeAppState(
            transport: transport,
            authService: auth,
            recordLedger: ledger,
            mediaStore: InMemoryCaptureMediaStore(),
            connectivityMonitor: StubConnectivityMonitor(state: .satisfied)
        )

        await state.tryRestoreSession()
        state.startRuntime()
        await state.triggerDurableSync(.manual)
        XCTAssertEqual(state.syncEnginesCount, 1, "expected org-1's engine to be cached before sign-out")

        state.signOut()

        XCTAssertEqual(state.syncEnginesCount, 0, "sign-out must clear all cached sync engines")
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
        auth.restoredResult = .authenticated(AuthSessionUser(id: "user-1", email: "collector@acme.test", role: nil, isAdmin: false))
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

/// Deterministic `ConnectivityMonitoring` test double — reports a fixed
/// `state` and an already-finished `stateStream` so `AppState.startRuntime()`
/// sets `connectivityState` synchronously without leaving a live background
/// `Task` awaiting connectivity changes that never arrive.
private final class StubConnectivityMonitor: ConnectivityMonitoring, @unchecked Sendable {
    let state: ConnectivityState

    init(state: ConnectivityState) {
        self.state = state
    }

    var stateStream: AsyncStream<ConnectivityState> {
        AsyncStream { continuation in
            continuation.finish()
        }
    }

    func start() {}
    func stop() {}
}
