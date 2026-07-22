import ConsoleAPI
import ConsoleForms
import ConsoleModels
import ConsolePersistence
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
    @Published private(set) var sessionAvailability: SessionAvailability = .restoring
    @Published private(set) var currentUserID: String?
    @Published private(set) var connectivityState: ConnectivityState = .requiresConnection
    @Published private(set) var recordLedgerSnapshot: RecordLedgerSnapshot?

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
    /// Derived from `GET /api/auth/session` (`session.user.role === 'admin'`)
    /// during `tryRestoreSession()`, or defaults to `false` for services
    /// that do not provide a session restore.
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
    private let recordLedger: RecordLedger?
    private let workspaceRepository: (any WorkspaceRepositoryProtocol)?
    private let mediaStore: (any CaptureMediaStoreProtocol)?
    private let sessionRepository: SessionRepository?
    private let connectivityMonitor: (any ConnectivityMonitoring)?
    private var connectivityTask: Task<Void, Never>?
    private var syncEngines: [String: SyncEngine] = [:]
    private let legacyQueueStore: (any RecordQueueStore)?
    private var migratedWorkspaceKeys: Set<String> = []
    private var runtimeDisabledForUITest = false

    init(
        apiClient: PlatformAPIClient,
        authService: AuthServiceProtocol,
        recordQueue: RecordQueue = AppState.makeDefaultRecordQueue(),
        locationServiceFactory: @escaping () -> LocationServiceProtocol? = { CoreLocationService() },
        offlineCache: ConsoleOfflineCacheProtocol = ConsoleOfflineCache(),
        recordLedger: RecordLedger? = nil,
        workspaceRepository: (any WorkspaceRepositoryProtocol)? = nil,
        mediaStore: (any CaptureMediaStoreProtocol)? = nil,
        sessionRepository: SessionRepository? = nil,
        connectivityMonitor: (any ConnectivityMonitoring)? = nil,
        legacyQueueStore: (any RecordQueueStore)? = nil
    ) {
        self.apiClient = apiClient
        self.authService = authService
        self.recordQueue = recordQueue
        self.locationServiceFactory = locationServiceFactory
        self.offlineCache = offlineCache
        self.recordLedger = recordLedger
        self.workspaceRepository = workspaceRepository
        self.mediaStore = mediaStore
        self.sessionRepository = sessionRepository
        self.connectivityMonitor = connectivityMonitor
        self.legacyQueueStore = legacyQueueStore
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
        let coordinator: CaptureCoordinator?
        if let recordLedger, let mediaStore, currentUserID != nil {
            coordinator = CaptureCoordinator(mediaStore: mediaStore, ledger: recordLedger)
        } else {
            coordinator = nil
        }
        return CaptureViewModel(
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
            },
            mediaStore: mediaStore ?? InMemoryCaptureMediaStore(),
            durableCoordinator: coordinator,
            ownerUserID: currentUserID,
            onDurableRecordPersisted: { [weak self] _ in
                await self?.triggerDurableSync(.recordPersisted)
            },
            creationAllowed: { [weak self] in
                self?.allowsOfflineCapability(.createLocalRecord) ?? false
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

    func makePendingWorkViewModel() -> PendingWorkViewModel? {
        guard let recordLedger, let mediaStore, let currentUserID, let organizationID = organization?.id else {
            return nil
        }
        return PendingWorkViewModel(
            ledger: recordLedger,
            mediaStore: mediaStore,
            ownerUserID: currentUserID,
            organizationID: organizationID,
            language: language,
            capabilityAllowed: { [weak self] capability in
                self?.allowsOfflineCapability(capability) ?? false
            }
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
            language: language,
            mutationAllowed: { [weak self] in
                self?.allowsOfflineCapability(.reviewMutation) ?? false
            }
        )
    }

    /// Builds a fresh `ProjectsViewModel` for `ConsoleShellView`'s PROJECTS
    /// destination, mirroring `makeReviewQueueViewModel` above.
    func makeProjectsViewModel(organizationId: String) -> ProjectsViewModel {
        ProjectsViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            role: role ?? .viewer,
            language: language,
            mutationAllowed: { [weak self] in
                self?.allowsOfflineCapability(.administrationMutation) ?? false
            }
        )
    }

    /// Builds a fresh `MembersViewModel` for `ConsoleShellView`'s MEMBERS
    /// destination. `viewerUserId` is set from the session user's `id`
    /// when available (via `tryRestoreSession()`), or defaults to `nil`
    /// for services that do not provide a session restore.
    func makeMembersViewModel(organizationId: String) -> MembersViewModel {
        MembersViewModel(
            apiClient: apiClient,
            organizationId: organizationId,
            viewerRole: role ?? .viewer,
            viewerUserId: nil,
            viewerIsAdlAdmin: isAdlAdmin,
            language: language,
            mutationAllowed: { [weak self] in
                self?.allowsOfflineCapability(.administrationMutation) ?? false
            }
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
            language: language,
            mutationAllowed: { [weak self] in
                self?.allowsOfflineCapability(.administrationMutation) ?? false
            }
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
            language: language,
            mutationAllowed: { [weak self] in
                self?.allowsOfflineCapability(.administrationMutation) ?? false
            }
        )
    }

    private func allowsOfflineCapability(_ capability: OfflineCapability) -> Bool {
        // Lightweight/test auth services do not expose SessionRepository's
        // richer restore result. Their successful sign-in is still an online
        // verified session for capability purposes.
        if sessionRepository == nil, isAuthenticated { return true }
        guard let role else { return false }
        return OfflineRolePolicy().allows(capability, role: role, session: sessionAvailability)
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
            if let sessionRepository {
                await apply(await sessionRepository.restore())
            } else {
                isAuthenticated = true
                sessionState = .authenticated
                await loadOrganizations()
            }
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
        let ownerUserID = currentUserID
        isAuthenticated = false
        sessionState = .unauthenticated
        organizations = []
        organization = nil
        role = nil
        route = ConsoleRoute(screen: .loading)
        organizationsLoadState = .idle
        authErrorMessage = nil
        currentUserID = nil
        sessionAvailability = .signedOut
        // Synchronously wipe the local cookie jar so restoreSession() on the
        // next app launch returns nil even if the async server call below is
        // killed before it completes.
        if sessionRepository != nil {
            Task { [sessionRepository] in
                await sessionRepository?.signOut(ownerUserID: ownerUserID)
            }
            return
        }
        if let localClearing = authService as? AuthLocalSessionClearing { localClearing.clearLocalSession() }
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
            await persistWorkspaceSnapshots(memberships)
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
        if let currentUserID {
            sessionRepository?.selectIdentity(ownerUserID: currentUserID, organizationID: organizationId)
        }
        Task { await refreshDurableRuntime() }
        Task { await migrateLegacyQueueIfNeeded() }
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

    func configureForUITest(role roleValue: String, locale: String, connectivity: String) {
        runtimeDisabledForUITest = true
        let resolvedRole = PlatformRole(rawValue: roleValue) ?? .collector
        let organization = PlatformOrganization(
            id: "ui-test-org",
            name: "ADL Field Operations",
            slug: "ui-test",
            logoUrl: nil,
            accentColor: nil,
            createdAt: "2026-01-01T00:00:00Z"
        )
        language = locale == "fr" ? .fr : .en
        currentUserID = "ui-test-user"
        organizations = [PlatformOrganizationMembership(organization: organization, role: resolvedRole)]
        self.organization = organization
        role = resolvedRole
        isAuthenticated = true
        sessionState = .authenticated
        organizationsLoadState = .loaded
        route = consoleLandingRoute(role: resolvedRole)
        connectivityState = connectivity == "offline" ? .unsatisfied : .satisfied
        recordLedgerSnapshot = RecordLedgerSnapshot(
            pending: 0,
            sending: 0,
            retrying: 0,
            blocked: 0,
            acknowledgedThisSession: 0
        )
        sessionAvailability = connectivity == "offline"
            ? .offlineAuthorized(snapshot: .fixture(
                ownerUserID: "ui-test-user",
                organizationID: organization.id,
                role: resolvedRole,
                verifiedAt: Date(),
                expiresAt: Date().addingTimeInterval(AuthorizationClock.window)
            ))
            : .onlineVerified(user: AuthSessionUser(
                id: "ui-test-user",
                email: "collector@example.test",
                role: roleValue,
                isAdmin: false
            ))
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

        if let sessionRepository {
            await apply(await sessionRepository.restore())
            return
        }

        guard let sessionRestorer = authService as? AuthSessionRestoring else {
            sessionState = .unauthenticated
            if route.screen == .loading {
                route = ConsoleRoute(screen: .authRequired)
            }
            return
        }

        let result = await sessionRestorer.restoreSession()

        switch result {
        case .authenticated(let user):
            currentUserID = user.id
            sessionAvailability = .onlineVerified(user: user)
            isAuthenticated = true
            sessionState = .authenticated
            if let role = user.role, role == "admin" {
                isAdlAdmin = true
            }
            if organizationsLoadState == .idle || organizations.isEmpty {
                await loadOrganizations()
            }
            if route.screen == .loading || route.screen == .authRequired {
                route = role.map(consoleLandingRoute(role:)) ?? ConsoleRoute(screen: .overview)
            }

        case .noSession, .unauthorized:
            sessionAvailability = .reauthenticationRequired(reason: .unauthorized)
            isAuthenticated = false
            sessionState = .unauthenticated
            if route.screen == .loading {
                route = ConsoleRoute(screen: .authRequired)
            }

        case .unavailable:
            sessionAvailability = .reauthenticationRequired(reason: .authorizationExpired)
            isAuthenticated = false
            sessionState = .unauthenticated
            if route.screen == .loading {
                route = ConsoleRoute(screen: .authRequired)
            }
        }
    }

    func startRuntime() {
        guard !runtimeDisabledForUITest else { return }
        guard connectivityTask == nil, let connectivityMonitor else { return }
        connectivityMonitor.start()
        connectivityState = connectivityMonitor.state
        connectivityTask = Task { [weak self, connectivityMonitor] in
            for await state in connectivityMonitor.stateStream {
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    self?.connectivityState = state
                }
                if state == .satisfied {
                    await self?.triggerDurableSync(.reconnected)
                }
            }
        }
    }

    func handleForeground() async {
        await triggerDurableSync(.foreground)
        await tryRestoreSession()
    }

    private func apply(_ availability: SessionAvailability) async {
        sessionAvailability = availability
        switch availability {
        case .onlineVerified(let user):
            currentUserID = user.id
            isAuthenticated = true
            sessionState = .authenticated
            isAdlAdmin = (user.isAdmin ?? false) || user.role == "admin"
            await loadOrganizations()
        case .offlineAuthorized(let snapshot):
            guard let organization = try? JSONDecoder().decode(PlatformOrganization.self, from: snapshot.organizationJSON) else {
                sessionAvailability = .reauthenticationRequired(reason: .identityMismatch)
                isAuthenticated = false
                sessionState = .unauthenticated
                route = ConsoleRoute(screen: .authRequired)
                return
            }
            currentUserID = snapshot.ownerUserID
            let membership = PlatformOrganizationMembership(organization: organization, role: snapshot.role)
            organizations = [membership]
            self.organization = organization
            role = snapshot.role
            organizationsLoadState = .loaded
            isAuthenticated = true
            sessionState = .authenticated
            route = consoleLandingRoute(role: snapshot.role)
            await refreshDurableRuntime()
        case .reauthenticationRequired:
            isAuthenticated = false
            sessionState = .unauthenticated
            route = ConsoleRoute(screen: .authRequired)
        case .restoring:
            sessionState = .restoring
        case .signedOut:
            isAuthenticated = false
            sessionState = .unauthenticated
        }
    }

    private func persistWorkspaceSnapshots(_ memberships: [PlatformOrganizationMembership]) async {
        guard let currentUserID, let workspaceRepository else { return }
        let now = Date()
        for membership in memberships {
            guard let organizationJSON = try? JSONEncoder().encode(membership.organization) else { continue }
            let snapshot = WorkspaceSnapshot(
                ownerUserID: currentUserID,
                organizationID: membership.organization.id,
                role: membership.role,
                verifiedAt: now,
                expiresAt: now.addingTimeInterval(AuthorizationClock.window),
                verifiedSystemUptime: ProcessInfo.processInfo.systemUptime,
                organizationJSON: organizationJSON,
                projectsJSON: Data("[]".utf8),
                publishedSchemasJSON: Data("[]".utf8),
                locale: language == .fr ? "fr" : "en",
                isLocked: false
            )
            try? await workspaceRepository.save(snapshot)
        }
    }

    private func durableSyncEngine(organizationID: String) -> SyncEngine? {
        guard let recordLedger, let mediaStore, let currentUserID else { return nil }
        if let engine = syncEngines[organizationID] { return engine }
        let adapter = ExistingPayloadSubmissionAdapter(
            ledger: recordLedger,
            mediaStore: mediaStore,
            apiClient: apiClient,
            attachmentLoader: { [recordLedger] localID in
                try await recordLedger.attachments(localID: localID)
            }
        )
        let engine = SyncEngine(
            ledger: recordLedger,
            submitter: adapter,
            mediaStore: mediaStore,
            ownerUserID: currentUserID,
            organizationID: organizationID
        )
        syncEngines[organizationID] = engine
        return engine
    }

    func triggerDurableSync(_ trigger: SyncTrigger) async {
        guard connectivityState == .satisfied, let organizationID = organization?.id else { return }
        await durableSyncEngine(organizationID: organizationID)?.trigger(trigger)
        await refreshDurableRuntime()
    }

    func refreshDurableRuntime() async {
        guard let recordLedger, let currentUserID, let organizationID = organization?.id else { return }
        recordLedgerSnapshot = try? await recordLedger.snapshot(ownerUserID: currentUserID, organizationID: organizationID)
    }

    private func migrateLegacyQueueIfNeeded() async {
        guard let legacyQueueStore, let recordLedger, let mediaStore,
              let currentUserID, let organizationID = organization?.id else { return }
        let key = "\(currentUserID)/\(organizationID)"
        guard !migratedWorkspaceKeys.contains(key) else { return }
        let migrator = LegacyQueueMigrator(
            legacyStore: legacyQueueStore,
            ledger: recordLedger,
            ownerUserID: currentUserID,
            organizationID: organizationID,
            mediaStore: mediaStore
        )
        if (await migrator.migrate()).isComplete {
            migratedWorkspaceKeys.insert(key)
            await refreshDurableRuntime()
        }
    }
}
