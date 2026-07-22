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
class AppState: ObservableObject {
    /// Coarse load status for the organizations fetch, surfaced by
    /// `RootView` while bootstrapping after a successful sign-in.
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    enum SessionState: Equatable {
        case unknown
        case restoring
        case authenticated
        case unauthenticated
    }

    @Published private(set) var isAuthenticated: Bool = false
    @Published private(set) var sessionState: SessionState = .unknown
    @Published private(set) var isAuthenticating: Bool = false
    @Published private(set) var authErrorMessage: String?

    @Published private(set) var organizations: [PlatformOrganizationMembership] = []
    @Published private(set) var organization: PlatformOrganization?
    @Published private(set) var role: PlatformRole?
    @Published private(set) var route: ConsoleRoute = ConsoleRoute(screen: .loading)
    @Published var organizationsLoadState: LoadState = .idle

    @Published var language: ConsoleLanguage = .en
    @Published private(set) var recordQueueSnapshot: RecordQueueSnapshot?
    @Published private(set) var isSyncingRecordQueue = false
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
    private let offlineCache: ConsoleOfflineCacheProtocol

    init(
        apiClient: PlatformAPIClient,
        authService: AuthServiceProtocol,
        recordQueue: RecordQueue = AppState.makeDefaultRecordQueue(),
        locationServiceFactory: @escaping () -> LocationServiceProtocol? = { CoreLocationService() },
        offlineCache: ConsoleOfflineCacheProtocol = ConsoleOfflineCache()
    ) {
        self.apiClient = apiClient
        self.authService = authService
        self.recordQueue = recordQueue
        self.locationServiceFactory = locationServiceFactory
        self.offlineCache = offlineCache
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
    func makeCaptureViewModel(
        organizationId: String,
        attachPointId: String? = nil,
        attachPointGps: FormGpsValue? = nil
    ) -> CaptureViewModel {
        CaptureViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            queue: recordQueue,
            language: language,
            locationService: locationServiceFactory(),
            attachPointId: attachPointId,
            attachPointGps: attachPointGps,
            offlineCache: offlineCache,
            onQueueSnapshotChanged: { [weak self] snapshot in
                self?.recordQueueSnapshot = snapshot
            }
        )
    }

    /// Builds a fresh `CompanyMapViewModel` for `ConsoleShellView`'s MAP
    /// destination, mirroring `makeReviewQueueViewModel` above.
    func makeCompanyMapViewModel(organizationId: String) -> CompanyMapViewModel {
        CompanyMapViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            language: language,
            offlineCache: offlineCache
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
            viewerRole: role ?? .viewer,
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
            sessionState = .authenticated
            await loadOrganizations()
        } catch let error as AuthServiceError {
            authErrorMessage = error.message(language)
            isAuthenticated = false
            sessionState = .unauthenticated
        } catch {
            authErrorMessage = AuthServiceError.network(String(describing: error)).message(language)
            isAuthenticated = false
            sessionState = .unauthenticated
        }
        isAuthenticating = false
    }

    func signOut() {
        isAuthenticated = false
        sessionState = .unauthenticated
        organizations = []
        organization = nil
        role = nil
        route = ConsoleRoute(screen: .loading)
        organizationsLoadState = .idle
        authErrorMessage = nil
        // Synchronously wipe the local cookie jar so restoreSession() on the
        // next app launch returns nil even if the async server call below is
        // killed before it completes.
        if let localClearing = authService as? AuthLocalSessionClearing {
            localClearing.clearLocalSession()
        }
        // Best-effort server-side invalidation — failure is swallowed because
        // the local cookie is already gone.
        if let signingOut = authService as? AuthSigningOut {
            Task { try? await signingOut.signOut() }
        }
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
            try? offlineCache.saveOrganizations(memberships)
            if let first = memberships.first {
                selectOrganization(organizationId: first.organization.id)
            } else {
                organization = nil
                role = nil
                route = ConsoleRoute(screen: .join)
            }
            organizationsLoadState = .loaded
        } catch {
            let cachedMemberships = (try? offlineCache.loadOrganizations()) ?? []
            if !cachedMemberships.isEmpty {
                organizations = cachedMemberships
                if let first = cachedMemberships.first {
                    selectOrganization(organizationId: first.organization.id)
                }
                organizationsLoadState = .loaded
            } else {
                organizationsLoadState = .failed(String(describing: error))
            }
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

    func refreshRecordQueueSnapshot() async {
        recordQueueSnapshot = try? await recordQueue.snapshot()
    }

    func syncRecordQueue() async {
        guard !isSyncingRecordQueue else { return }
        isSyncingRecordQueue = true
        let summary = await recordQueue.sync { [apiClient] draft, idempotencyKey in
            try await Self.submitRecordDraft(draft, idempotencyKey: idempotencyKey, apiClient: apiClient)
        }
        recordQueueSnapshot = try? await recordQueue.snapshot()
        if summary.remaining == 0, recordQueueSnapshot == nil {
            recordQueueSnapshot = RecordQueueSnapshot(pending: 0, syncing: 0, failed: 0, total: 0, syncedThisSession: summary.syncedIds.count)
        }
        isSyncingRecordQueue = false
    }

    private static func submitRecordDraft(
        _ draft: RecordDraft,
        idempotencyKey: String,
        apiClient: PlatformAPIClient
    ) async throws {
        do {
            _ = try await apiClient.createPlatformRecord(
                projectId: draft.projectId,
                schemaVersionId: draft.schemaVersionId,
                recordTypeKey: draft.recordTypeKey,
                data: draft.data,
                evidence: PlatformRecordEvidence(
                    gps: draft.gps.map {
                        PlatformRecordGps(latitude: $0.latitude, longitude: $0.longitude, accuracyMeters: $0.accuracyMeters)
                    },
                    photos: draft.photoRefs,
                    notes: draft.notes,
                    capturedAt: draft.capturedAt,
                    device: draft.device,
                    photoMetadata: draft.photoMetadata,
                    clientExif: draft.clientExif,
                    gpsIntegrity: draft.gpsIntegrity
                ),
                idempotencyKey: idempotencyKey,
                pointId: draft.pointId
            )
        } catch let error as PlatformAPIError {
            if error.status == -1 || (500..<600).contains(error.status) {
                throw RecordSubmitError.retryable(error.message)
            }
            throw RecordSubmitError.permanent(error.message)
        }
    }

    #if DEBUG
    func seedPreviewOrganizationsLoadState(_ loadState: LoadState) {
        organizationsLoadState = loadState
    }
    #endif

    // MARK: - Session restore (cookie-based)

    /// Attempts to restore an existing Auth.js cookie session at app start or
    /// when returning to the foreground. If a user session is present, marks
    /// the app as authenticated and ensures organizations are loaded; if not,
    /// leaves the app unauthenticated without surfacing an error.
    func tryRestoreSession() async {
        guard !isAuthenticated, sessionState != .restoring else {
            return
        }

        sessionState = .restoring

        guard let sessionRestorer = authService as? AuthSessionRestoring else {
            sessionState = .unauthenticated
            if route.screen == .loading {
                route = ConsoleRoute(screen: .authRequired)
            }
            return
        }

        if let user = await sessionRestorer.restoreSession() {
            // We have a valid session cookie — consider the user authenticated.
            isAuthenticated = true
            sessionState = .authenticated
            // Opportunistically reflect admin role if present until the TODO(real-cookie-handshake)
            // work promotes this into first-class state.
            if let role = user.role, role == "admin" {
                isAdlAdmin = true
            }
            // If we haven't loaded orgs for this session yet, do it now.
            if organizationsLoadState == .idle || organizations.isEmpty {
                await loadOrganizations()
            }
            // If there are no organizations, `loadOrganizations()` already routes to JOIN.
            // Otherwise `selectOrganization` applies the role-aware landing route
            // (collector -> map, reviewer -> review, owner/manager -> overview).
            if route.screen == .loading || route.screen == .authRequired {
                route = role.map(consoleLandingRoute(role:)) ?? ConsoleRoute(screen: .overview)
            }
        } else {
            // No session to restore — ensure the shell knows auth is required.
            isAuthenticated = false
            sessionState = .unauthenticated
            if route.screen == .loading {
                route = ConsoleRoute(screen: .authRequired)
            }
        }
    }
}
