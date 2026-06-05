import Combine
import CoreLocation
import Foundation
import SwiftUI
import UIKit

@MainActor
final class AppState: ObservableObject {
    @Published var isBootstrapping = true
    @Published var isAuthenticated = false
    @Published var isGuest = false
    @Published var isAuthRequested = false
    @Published var selectedRole: UserRole = .agent
    @Published var selectedTab: AppRoute = .home
    @Published var profile = SessionProfile.demo(role: .agent)
    @Published var points: [DataPoint] = []
    @Published var isLoadingPoints = false
    @Published var pointsError: String?
    @Published var drafts: [ContributionDraft] = []
    @Published var queueSnapshot = QueueSnapshot.empty
    @Published var lastSyncMessage = ""
    @Published var authError: String?
    @Published var isSigningIn = false
    @Published var isSyncingQueue = false
    @Published var mapCaptureContext: MapCaptureContext?
    @Published var analyticsSummary: AnalyticsSummary?
    @Published var weeklyTrend: [WeeklyTrendBar] = []
    @Published var leaderboard: [LeaderboardEntry] = []
    @Published var isLoadingLeaderboard = false
    @Published var leaderboardError: String?
    @Published var isLoadingAnalytics = false
    @Published var analyticsError: String?
    @Published var userProfile: UserProfile?
    @Published var serverXP = 0
    @Published var spentXP = 0
    @Published var vouchers: [Voucher] = []
    @Published var badges: [Badge] = []
    @Published var missions: [Mission] = []
    @Published var dailyGoal = DailyGoal(target: 5, completed: 0)
    @Published var levelUpEvent: LevelUpEvent?
    @Published var isLoadingProfile = false
    @Published var profileError: String?
    @Published var language: String = UserDefaults.standard.string(forKey: "adl_language") ?? "fr" {
        didSet { UserDefaults.standard.set(language, forKey: "adl_language") }
    }

    // MARK: - Admin Review Queue (africandatalayer-ot4)
    @Published var reviewQueue: [AdminReviewGroup] = []
    @Published var reviewStats: AdminReviewStats?
    @Published var isLoadingReview = false
    @Published var reviewError: String?

    func t(_ en: String, _ fr: String) -> String { language == "fr" ? fr : en }

    private let queueStore = OfflineQueueStore()
    private let rewardsService: RewardsService = LocalRewardsService()
    let apiClient = ADLAPIClient()

    /// Spendable balance = server-canonical XP minus locally-recorded redemptions.
    var spendableXP: Int { max(0, serverXP - spentXP) }
    var tierProgress: TierProgress { TierProgress(xp: serverXP) }
    var catalog: [Reward] { rewardsService.catalog() }

    init() {
        drafts = queueStore.loadDrafts()
        serverXP = profile.xp
        spentXP = rewardsService.loadSpentXP()
        vouchers = rewardsService.loadVouchers()
        refreshQueueSnapshot()
        refreshGamification()
    }

    func loadProfile(force: Bool = false) async {
        guard !isLoadingProfile else { return }
        if userProfile != nil, !force { return }
        isLoadingProfile = true
        profileError = nil
        defer { isLoadingProfile = false }
        do {
            let fetched = try await apiClient.fetchUserProfile()
            userProfile = fetched
            applyServerXP(fetched.xp)
        } catch {
            profileError = (error as? APIError)?.message ?? "Unable to load profile."
        }
    }

    func redeem(_ reward: Reward) throws -> Voucher {
        guard reward.stock.isAvailable else { throw RedeemError.outOfStock }
        guard spendableXP >= reward.costXP else { throw RedeemError.insufficientBalance }
        let voucher = Voucher(
            id: UUID(),
            rewardId: reward.id,
            rewardName: reward.name,
            costXP: reward.costXP,
            code: Voucher.generateCode(),
            redeemedAt: Date()
        )
        spentXP += reward.costXP
        vouchers.insert(voucher, at: 0)
        rewardsService.recordRedemption(voucher, spentXP: spentXP)
        return voucher
    }

    func dismissLevelUp() { levelUpEvent = nil }

    private var didEstablishXPBaseline = false

    private func applyServerXP(_ xp: Int) {
        let previousTier = AgentTier.tier(forXP: serverXP)
        serverXP = xp
        profile.xp = xp
        let newTier = AgentTier.tier(forXP: xp)
        // Only celebrate genuine tier increases after the first real load — the
        // initial demo→server XP swap should not trigger a false celebration.
        if didEstablishXPBaseline, newTier.rawValue > previousTier.rawValue {
            levelUpEvent = LevelUpEvent(tier: newTier)
        }
        didEstablishXPBaseline = true
        refreshGamification()
    }

    func refreshGamification() {
        badges = Self.deriveBadges(xp: serverXP, profile: userProfile, drafts: drafts, streakDays: profile.streakDays)
        missions = Self.deriveMissions(drafts: drafts)
        dailyGoal = DailyGoal(target: 5, completed: Self.capturesToday(drafts))
    }

    static func capturesToday(_ drafts: [ContributionDraft]) -> Int {
        let calendar = Calendar.current
        return drafts.filter { calendar.isDateInToday($0.createdAt) }.count
    }

    static func deriveMissions(drafts: [ContributionDraft]) -> [Mission] {
        let calendar = Calendar.current
        let today = capturesToday(drafts)
        let weekCount = drafts.filter { calendar.isDate($0.createdAt, equalTo: Date(), toGranularity: .weekOfYear) }.count
        let syncedWeek = drafts.filter {
            $0.syncState == .synced && calendar.isDate($0.createdAt, equalTo: Date(), toGranularity: .weekOfYear)
        }.count
        return [
            Mission(id: "daily-capture", title: "Capture 3 points", detail: "Add three field submissions today.", period: .daily, goal: 3, current: today, rewardXP: 150),
            Mission(id: "weekly-sync", title: "Sync 10 submissions", detail: "Get ten captures synced this week.", period: .weekly, goal: 10, current: syncedWeek, rewardXP: 500),
            Mission(id: "weekly-capture", title: "Field 15 points", detail: "Capture fifteen points this week.", period: .weekly, goal: 15, current: weekCount, rewardXP: 700)
        ]
    }

    static func deriveBadges(xp: Int, profile: UserProfile?, drafts: [ContributionDraft], streakDays: Int) -> [Badge] {
        let syncedCount = drafts.filter { $0.syncState == .synced }.count
        let trustTier = (profile?.trustTier ?? "").lowercased()
        let isTrusted = ["trusted", "elite"].contains(trustTier)
        return [
            Badge(id: "first-capture", title: "First Capture", detail: "Submit your first point.", systemImage: "mappin.and.ellipse", tint: ADLColor.forest, unlocked: xp > 0 || syncedCount > 0, progress: (xp > 0 || syncedCount > 0) ? 1 : 0),
            Badge(id: "streak-5", title: "5-Day Streak", detail: "Capture five days running.", systemImage: "flame.fill", tint: ADLColor.terracotta, unlocked: streakDays >= 5, progress: min(1, Double(streakDays) / 5)),
            Badge(id: "trusted", title: "Trusted Agent", detail: "Reach the trusted tier.", systemImage: "checkmark.seal.fill", tint: ADLColor.navy, unlocked: isTrusted, progress: isTrusted ? 1 : 0.5),
            Badge(id: "xp-2500", title: "Field Veteran", detail: "Earn 2,500 XP.", systemImage: "star.circle.fill", tint: ADLColor.gold, unlocked: xp >= 2_500, progress: min(1, Double(xp) / 2_500)),
            Badge(id: "synced-25", title: "Quarter Century", detail: "Sync 25 submissions.", systemImage: "tray.full.fill", tint: ADLColor.navySoft, unlocked: syncedCount >= 25, progress: min(1, Double(syncedCount) / 25)),
            Badge(id: "elite", title: "Elite Mapper", detail: "Earn 8,000 XP.", systemImage: "trophy.fill", tint: ADLColor.gold, unlocked: xp >= 8_000, progress: min(1, Double(xp) / 8_000))
        ]
    }

    func bootstrap() async {
        guard isBootstrapping else { return }
        try? await Task.sleep(nanoseconds: 250_000_000)
        await restoreSession()
        #if DEBUG
        let env = ProcessInfo.processInfo.environment
        if env["ADL_DEMO"] == "1", env["ADL_ALLOW_DEMO"] == "1" {
            if let raw = env["ADL_ROLE"], let role = UserRole(rawValue: raw) { selectedRole = role }
            signInDemo()
            if let raw = env["ADL_TAB"], let route = AppRoute(rawValue: raw) { selectedTab = route }
        }
        #endif
        if !isAuthenticated && !isGuest && !isAuthRequested {
            continueAsGuest()
        }
        isBootstrapping = false
    }

    func restoreSession() async {
        do {
            guard let session = try await apiClient.currentSession(), let user = session.user else { return }
            applyAuthenticatedUser(user)
        } catch {
            authError = nil
        }
    }

    func signIn(identifier: String, password: String) async {
        let normalizedIdentifier = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedIdentifier.isEmpty, !password.isEmpty else {
            authError = t("Enter phone/email and password.", "Saisissez téléphone/email et mot de passe.")
            return
        }

        isSigningIn = true
        authError = nil
        defer { isSigningIn = false }

        do {
            let session = try await apiClient.signIn(identifier: normalizedIdentifier, password: password)
            guard let user = session.user else {
                authError = "Unable to load session."
                return
            }
            applyAuthenticatedUser(user)
        } catch {
            authError = (error as? APIError)?.message ?? t("Unable to sign in.", "Connexion impossible.")
        }
    }

    func register(
        identifier: String,
        password: String,
        acceptedTerms: Bool,
        smsOptIn: Bool,
        emailNoticeAccepted: Bool
    ) async {
        let normalizedIdentifier = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedIdentifier.isEmpty, !password.isEmpty else {
            authError = t("Enter phone/email and password.", "Saisissez téléphone/email et mot de passe.")
            return
        }
        guard acceptedTerms else {
            authError = t(
                "You must accept the Terms of Use and Privacy Policy.",
                "Vous devez accepter les Conditions d'utilisation et la Politique de confidentialité."
            )
            return
        }
        guard emailNoticeAccepted else {
            authError = t(
                "You must acknowledge operational email notices.",
                "Vous devez accepter les avis opérationnels par email."
            )
            return
        }

        isSigningIn = true
        authError = nil
        defer { isSigningIn = false }

        do {
            try await apiClient.register(identifier: normalizedIdentifier, password: password, smsOptIn: smsOptIn)
            let session = try await apiClient.signIn(identifier: normalizedIdentifier, password: password)
            guard let user = session.user else {
                authError = t("Unable to load session.", "Session impossible à charger.")
                return
            }
            applyAuthenticatedUser(user)
        } catch {
            authError = (error as? APIError)?.message ?? t("Unable to create account.", "Création du compte impossible.")
        }
    }

    func signInDemo() {
        let role = AppReleaseMode.normalizedRole(selectedRole)
        selectedRole = role
        isAuthenticated = true
        isGuest = false
        isAuthRequested = false
        profile = SessionProfile.demo(role: role)
        selectedTab = defaultTab(for: role)
    }

    /// Browse the app without an account (read-only public data).
    func continueAsGuest() {
        selectedRole = .agent
        isGuest = true
        isAuthenticated = false
        isAuthRequested = false
        userProfile = nil
        serverXP = 0
        profile = SessionProfile(name: "Guest", role: .agent, trustTier: "guest", xp: 0, streakDays: 0)
        refreshGamification()
        selectedTab = .home
    }

    func requestAuth() {
        isGuest = false
        isAuthenticated = false
        isAuthRequested = true
    }

    func signOut() {
        Task {
            try? await apiClient.signOut()
            await MainActor.run {
                self.continueAsGuest()
            }
        }
    }

    func updateProfile(name: String? = nil, avatarPreset: String? = nil, imageBase64: String? = nil) async throws {
        let updated = try await apiClient.updateUserProfile(name: name, avatarPreset: avatarPreset, imageBase64: imageBase64)
        userProfile = updated
        if let nextName = updated.name?.trimmingCharacters(in: .whitespacesAndNewlines), !nextName.isEmpty {
            profile.name = nextName
        }
        refreshGamification()
    }

    func submitIpReport(_ payload: IpReportPayload) async throws {
        try await apiClient.submitIpReport(payload)
    }

    func submitPrivacyRequest(_ payload: PrivacyRequestPayload) async throws {
        try await apiClient.submitPrivacyRequest(payload)
    }

    func switchRole(_ role: UserRole) {
        let nextRole = AppReleaseMode.normalizedRole(role)
        selectedRole = nextRole
        profile = SessionProfile.demo(role: nextRole)
        selectedTab = defaultTab(for: nextRole)
    }

    func enforceVisibleNavigation() {
        let nextRole = AppReleaseMode.normalizedRole(selectedRole)

        if selectedRole != nextRole {
            selectedRole = nextRole
        }

        if profile.role != nextRole {
            let roleDefaults = SessionProfile.demo(role: nextRole)
            profile = SessionProfile(
                name: profile.name,
                role: nextRole,
                trustTier: roleDefaults.trustTier,
                xp: roleDefaults.xp,
                streakDays: roleDefaults.streakDays
            )
        }

        if !AppReleaseMode.canShow(selectedTab, for: nextRole) {
            selectedTab = defaultTab(for: nextRole)
        }
    }

    func enqueueContribution(
        title: String,
        notes: String,
        category: SubmissionCategory,
        location: SubmissionLocation?,
        image: UIImage?,
        payload: SubmissionPayload
    ) {
        let photoFilename = image.flatMap { queueStore.persistImage($0, id: UUID()) }
        let draft = ContributionDraft(
            id: UUID(),
            category: category,
            title: title,
            notes: notes,
            location: location,
            capturedPhotoFilename: photoFilename,
            payload: payload,
            createdAt: Date(),
            syncState: .queued,
            lastError: nil
        )
        drafts.insert(draft, at: 0)
        queueStore.saveDrafts(drafts)
        refreshQueueSnapshot()
        lastSyncMessage = t("Contribution queued for sync", "Contribution en file d'attente")
        // Queue isn't an agent tab; return to the map (reach the queue via Profile).
        selectedTab = .home
    }

    func loadAnalytics(force: Bool = false) async {
        guard !isLoadingAnalytics else { return }
        if analyticsSummary != nil, !force { return }
        isLoadingAnalytics = true
        analyticsError = nil
        defer { isLoadingAnalytics = false }

        do {
            async let summaryTask = apiClient.fetchAnalyticsSummary()
            async let weeklyTask = apiClient.fetchWeeklyKpis(limit: 24)
            let (summary, weekly) = try await (summaryTask, weeklyTask)
            analyticsSummary = summary
            weeklyTrend = Self.aggregateWeeklyTrend(weekly, weeks: 7)
        } catch {
            analyticsError = (error as? APIError)?.message ?? "Unable to load analytics."
        }
    }

    func loadLeaderboard(force: Bool = false) async {
        guard !isLoadingLeaderboard else { return }
        if !leaderboard.isEmpty, !force { return }
        isLoadingLeaderboard = true
        leaderboardError = nil
        defer { isLoadingLeaderboard = false }

        do {
            leaderboard = try await apiClient.fetchLeaderboard()
        } catch {
            leaderboardError = (error as? APIError)?.message ?? "Unable to load leaderboard."
        }
    }

    func loadPoints(force: Bool = false) async {
        guard !isLoadingPoints else { return }
        if !points.isEmpty, !force { return }
        isLoadingPoints = true
        pointsError = nil
        defer { isLoadingPoints = false }

        do {
            let projected = try await apiClient.fetchProjectedPoints()
            points = projected.map(DataPoint.init(projected:))
            if points.isEmpty {
                pointsError = "No backend points returned yet."
            }
        } catch {
            points = []
            pointsError = (error as? APIError)?.message ?? "Unable to load backend points."
        }
    }

    // MARK: - Admin Review Queue service methods (africandatalayer-ot4)

    func loadReviewQueue(force: Bool = false) async {
        guard !isLoadingReview else { return }
        if !reviewQueue.isEmpty, !force { return }
        isLoadingReview = true
        reviewError = nil
        defer { isLoadingReview = false }
        do {
            let result = try await apiClient.fetchReviewQueue()
            reviewQueue = result.groups
            reviewStats = result.stats
        } catch {
            reviewError = (error as? APIError)?.message ?? "Unable to load review queue."
        }
    }

    func submitReviewDecision(eventId: String, decision: ReviewDecision) async {
        struct DecisionBody: Encodable { let decision: String }
        do {
            try await apiClient.patchJSON(
                path: "/api/submissions/\(eventId)?view=review",
                body: DecisionBody(decision: decision.rawValue)
            )
            // Optimistically update matching group's reviewStatus locally
            reviewQueue = reviewQueue.map { group in
                guard group.latestEventId == eventId else { return group }
                var updated = group
                updated.summary.reviewStatus = decision.rawValue
                return updated
            }
            // Background refresh to pull canonical server state
            Task { await loadReviewQueue(force: true) }
        } catch {
            // Errors are transient — the queue reload will correct state
            reviewError = (error as? APIError)?.message ?? "Unable to submit decision."
        }
    }

    /// Collapse per-category weekly rows into one ascending series of the most
    /// recent `weeks`, summing total events across categories per week.
    static func aggregateWeeklyTrend(_ rows: [WeeklyKpiRow], weeks: Int) -> [WeeklyTrendBar] {
        var totalsByWeek: [String: Int] = [:]
        for row in rows {
            totalsByWeek[row.weekStart, default: 0] += row.totalEvents
        }
        return totalsByWeek
            .map { WeeklyTrendBar(weekStart: $0.key, totalEvents: $0.value) }
            .sorted { $0.weekStart < $1.weekStart }
            .suffix(weeks)
            .map { $0 }
    }

    func startMapCapture(for point: DataPoint) {
        guard !isGuest else {
            requestAuth()
            return
        }
        mapCaptureContext = MapCaptureContext(
            category: point.category,
            location: point.location,
            pointId: point.id,
            title: point.name
        )
        selectedTab = .contribute
    }

    func startMapCapture(at coordinate: CLLocationCoordinate2D) {
        guard !isGuest else {
            requestAuth()
            return
        }
        mapCaptureContext = MapCaptureContext(
            category: nil,
            location: SubmissionLocation(
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                accuracyMeters: nil
            ),
            pointId: nil,
            title: ""
        )
        selectedTab = .contribute
    }

    func consumeMapCaptureContext() -> MapCaptureContext? {
        defer { mapCaptureContext = nil }
        return mapCaptureContext
    }

    func syncQueuedDrafts() async {
        guard !isSyncingQueue else { return }
        isSyncingQueue = true
        defer { isSyncingQueue = false }

        let candidates = drafts.filter { $0.syncState == .queued || $0.syncState == .failed }
        if candidates.isEmpty {
            lastSyncMessage = t("No queued drafts", "Aucun brouillon en file")
            return
        }

        for draft in candidates {
            await syncDraft(draft)
        }
    }

    func syncDraft(_ draft: ContributionDraft) async {
        updateDraft(draft.id, state: .syncing, error: nil)
        do {
            let payload = try queueStore.hydratedPayload(for: draft)
            try await apiClient.submit(payload)
            updateDraft(draft.id, state: .synced, error: nil)
            lastSyncMessage = "Synced \(draft.displayTitle)"
        } catch {
            updateDraft(draft.id, state: .failed, error: (error as? APIError)?.message ?? "Sync failed")
            lastSyncMessage = "Sync failed for \(draft.displayTitle)"
        }
    }

    private func updateDraft(_ id: UUID, state: SyncState, error: String?) {
        drafts = drafts.map { item in
            guard item.id == id else { return item }
            var updated = item
            updated.syncState = state
            updated.lastError = error
            return updated
        }
        queueStore.saveDrafts(drafts)
        refreshQueueSnapshot()
    }

    func markDraftSynced(_ draft: ContributionDraft) {
        drafts = drafts.map { item in
            guard item.id == draft.id else { return item }
            var updated = item
            updated.syncState = .synced
            return updated
        }
        queueStore.saveDrafts(drafts)
        refreshQueueSnapshot()
    }

    func deleteDraft(_ draft: ContributionDraft) {
        drafts.removeAll { $0.id == draft.id }
        queueStore.saveDrafts(drafts)
        refreshQueueSnapshot()
    }

    private func defaultTab(for role: UserRole) -> AppRoute {
        AppReleaseMode.defaultTab(for: role)
    }

    private func refreshQueueSnapshot() {
        queueSnapshot = QueueSnapshot(
            queued: drafts.filter { $0.syncState == .queued || $0.syncState == .syncing }.count,
            failed: drafts.filter { $0.syncState == .failed }.count,
            synced: drafts.filter { $0.syncState == .synced }.count
        )
        refreshGamification()
    }

    private func applyAuthenticatedUser(_ user: AuthUser) {
        let accountRole = user.role ?? (user.isAdmin == true ? .admin : selectedRole)
        let resolvedRole = AppReleaseMode.normalizedRole(accountRole)
        userProfile = nil
        serverXP = 0
        spentXP = rewardsService.loadSpentXP()
        selectedRole = resolvedRole
        profile = SessionProfile(
            name: user.name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? user.name! : resolvedRole.title,
            role: resolvedRole,
            trustTier: "member",
            xp: 0,
            streakDays: 0
        )
        isAuthenticated = true
        isGuest = false
        isAuthRequested = false
        refreshGamification()
        selectedTab = defaultTab(for: resolvedRole)
    }
}

final class ADLAPIClient {
    /// Production app host (real database + envs). Override with ADL_API_BASE for staging/local.
    private let baseURL: URL = {
        if let override = ProcessInfo.processInfo.environment["ADL_API_BASE"],
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://www.app.africandatalayer.com")!
    }()
    private let urlSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpShouldSetCookies = true
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }()
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    func url(path: String) -> URL {
        // Resolve relative to baseURL so query strings (e.g. "?view=kpi_summary")
        // are preserved. appendingPathComponent would percent-encode "?".
        let normalizedPath = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: normalizedPath, relativeTo: baseURL)?.absoluteURL
            ?? baseURL.appendingPathComponent(String(normalizedPath.dropFirst()))
    }

    func fetchJSON<T: Decodable>(_ type: T.Type, path: String) async throws -> T {
        let (data, response) = try await urlSession.data(from: url(path: path))
        try validate(response: response, data: data)
        return try decoder.decode(T.self, from: data)
    }

    func currentSession() async throws -> AuthSession? {
        let authSession = try await fetchJSON(AuthSession.self, path: "/api/auth/session")
        return authSession.user == nil ? nil : authSession
    }

    func signIn(identifier: String, password: String) async throws -> AuthSession {
        let csrf = try await csrfToken()
        let callbackURL = baseURL.absoluteString
        var request = URLRequest(url: url(path: "/api/auth/callback/credentials"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: "X-Auth-Return-Redirect")
        request.httpBody = formURLEncoded([
            "csrfToken": csrf,
            "identifier": identifier,
            "email": identifier,
            "password": password,
            "callbackUrl": callbackURL,
            "json": "true"
        ])

        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
        let redirect = try decoder.decode(AuthRedirectPayload.self, from: data)
        if let authError = authError(from: redirect.url) {
            throw APIError.requestFailed(authError)
        }
        guard let session = try await currentSession() else {
            throw APIError.requestFailed("No session returned after sign in.")
        }
        return session
    }

    func register(identifier: String, password: String, smsOptIn: Bool) async throws {
        var request = URLRequest(url: url(path: "/api/auth/register"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(RegisterPayload(
            identifier: identifier,
            email: identifier,
            password: password,
            acceptedPolicies: ["privacy", "terms"],
            smsOptIn: smsOptIn ? true : nil
        ))
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
    }

    func signOut() async throws {
        let csrf = try await csrfToken()
        var request = URLRequest(url: url(path: "/api/auth/signout"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = formURLEncoded([
            "csrfToken": csrf,
            "callbackUrl": baseURL.absoluteString,
            "json": "true"
        ])
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
    }

    func fetchAnalyticsSummary() async throws -> AnalyticsSummary {
        try await fetchJSON(AnalyticsSummary.self, path: "/api/analytics?view=kpi_summary")
    }

    func fetchWeeklyKpis(limit: Int = 24) async throws -> [WeeklyKpiRow] {
        try await fetchJSON([WeeklyKpiRow].self, path: "/api/analytics?view=kpi_weekly&limit=\(limit)")
    }

    func fetchLeaderboard() async throws -> [LeaderboardEntry] {
        try await fetchJSON([LeaderboardEntry].self, path: "/api/leaderboard")
    }

    func fetchProjectedPoints() async throws -> [ProjectedPoint] {
        try await fetchJSON([ProjectedPoint].self, path: "/api/submissions")
    }

    func fetchUserProfile() async throws -> UserProfile {
        try await fetchJSON(UserProfile.self, path: "/api/user")
    }

    func updateUserProfile(name: String?, avatarPreset: String?, imageBase64: String?) async throws -> UserProfile {
        var request = URLRequest(url: url(path: "/api/user"))
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "Idempotency-Key")
        request.httpBody = try JSONEncoder().encode(UserProfileUpdatePayload(name: name, avatarPreset: avatarPreset, imageBase64: imageBase64))
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
        return try decoder.decode(UserProfile.self, from: data)
    }

    func submitIpReport(_ payload: IpReportPayload) async throws {
        var request = URLRequest(url: url(path: "/api/privacy?view=ip-report"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
    }

    func submitPrivacyRequest(_ payload: PrivacyRequestPayload) async throws {
        var request = URLRequest(url: url(path: "/api/privacy?view=requests"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
    }

    func submit(_ payload: SubmissionPayload) async throws {
        var request = URLRequest(url: url(path: "/api/submissions"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
    }

    /// Fetch the admin review queue — page 0 defaults, optional risk filter.
    func fetchReviewQueue(page: Int = 0, limit: Int = 20) async throws -> AdminReviewQueueResponse {
        let path = "/api/submissions?view=review_queue&scope=global&page=\(page)&limit=\(limit)"
        return try await fetchJSON(AdminReviewQueueResponse.self, path: path)
    }

    /// PATCH /api/submissions/{eventId}?view=review with a ReviewDecision body.
    func patchJSON<T: Encodable>(path: String, body: T) async throws {
        var request = URLRequest(url: url(path: path))
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
    }

    private func csrfToken() async throws -> String {
        let response = try await fetchJSON(CsrfResponse.self, path: "/api/auth/csrf")
        return response.csrfToken
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.requestFailed("Invalid server response.")
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let message = parseErrorMessage(data: data) ?? "Request failed with status \(httpResponse.statusCode)."
            throw APIError.requestFailed(message)
        }
    }

    private func parseErrorMessage(data: Data) -> String? {
        if let payload = try? JSONDecoder().decode(APIErrorPayload.self, from: data) {
            return payload.error ?? payload.message
        }
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func formURLEncoded(_ values: [String: String]) -> Data {
        let allowed = CharacterSet.urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&+="))
        let body = values
            .map { key, value in
                let encodedKey = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
                let encodedValue = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
                return "\(encodedKey)=\(encodedValue)"
            }
            .joined(separator: "&")
        return Data(body.utf8)
    }

    private func authError(from redirectURL: String?) -> String? {
        guard
            let redirectURL,
            let components = URLComponents(string: redirectURL)
        else { return nil }
        let params = Dictionary(uniqueKeysWithValues: components.queryItems?.map { ($0.name, $0.value ?? "") } ?? [])
        if params["error"] == "CredentialsSignin" || params["code"] == "credentials" {
            return "Invalid phone/email or password."
        }
        if params["error"] != nil || params["code"] != nil {
            return "Unable to sign in."
        }
        return nil
    }
}

struct CsrfResponse: Codable {
    var csrfToken: String
}

struct AuthRedirectPayload: Codable {
    var url: String?
}

struct APIErrorPayload: Codable {
    var error: String?
    var message: String?
}

struct RegisterPayload: Encodable {
    var identifier: String
    var email: String
    var password: String
    var acceptedPolicies: [String]
    var smsOptIn: Bool?
}

struct UserProfileUpdatePayload: Encodable {
    var name: String?
    var avatarPreset: String?
    var imageBase64: String?
}

struct IpReportPayload: Encodable {
    var reporterName: String
    var reporterEmail: String
    var targetKind: String
    var targetRef: String?
    var description: String
    var sworn: Bool
}

struct PrivacyRequestPayload: Encodable {
    var requestType: String
    var subjectReference: String?
    var notes: String?
}

enum APIError: Error {
    case requestFailed(String)

    var message: String {
        switch self {
        case .requestFailed(let message):
            return message
        }
    }
}

final class OfflineQueueStore {
    private let defaults = UserDefaults.standard
    private let draftsKey = "adl.native.drafts"

    func loadDrafts() -> [ContributionDraft] {
        guard let data = defaults.data(forKey: draftsKey) else { return [] }
        return (try? JSONDecoder().decode([ContributionDraft].self, from: data)) ?? []
    }

    func saveDrafts(_ drafts: [ContributionDraft]) {
        guard let data = try? JSONEncoder().encode(drafts) else { return }
        defaults.set(data, forKey: draftsKey)
    }

    func hydratedPayload(for draft: ContributionDraft) throws -> SubmissionPayload {
        guard var payload = draft.payload else {
            throw APIError.requestFailed("Draft is missing submission payload.")
        }
        if payload.imageBase64 == nil, let filename = draft.capturedPhotoFilename {
            payload.imageBase64 = try imageDataURL(filename: filename)
        }
        guard payload.imageBase64 != nil else {
            throw APIError.requestFailed("Photo is required before sync.")
        }
        return payload
    }

    func persistImage(_ image: UIImage, id: UUID) -> String? {
        guard let data = image.jpegData(compressionQuality: 0.82) else { return nil }
        let filename = "\(id.uuidString).jpg"
        let url = imageDirectory().appendingPathComponent(filename)
        try? FileManager.default.createDirectory(at: imageDirectory(), withIntermediateDirectories: true)
        do {
            try data.write(to: url, options: .atomic)
            return filename
        } catch {
            return nil
        }
    }

    private func imageDirectory() -> URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ADLContributionPhotos", isDirectory: true)
    }

    private func imageDataURL(filename: String) throws -> String {
        let url = imageDirectory().appendingPathComponent(filename)
        let data = try Data(contentsOf: url)
        return "data:image/jpeg;base64,\(data.base64EncodedString())"
    }
}

/// Seam for the rewards economy. The local implementation persists redemptions
/// on-device; a future backend ledger can replace it without touching the UI.
protocol RewardsService {
    func catalog() -> [Reward]
    func loadVouchers() -> [Voucher]
    func loadSpentXP() -> Int
    func recordRedemption(_ voucher: Voucher, spentXP: Int)
}

final class LocalRewardsService: RewardsService {
    private let defaults = UserDefaults.standard
    private let vouchersKey = "adl.native.vouchers"
    private let spentKey = "adl.native.spentXP"

    func catalog() -> [Reward] { Reward.catalog }

    func loadVouchers() -> [Voucher] {
        guard let data = defaults.data(forKey: vouchersKey) else { return [] }
        return (try? JSONDecoder().decode([Voucher].self, from: data)) ?? []
    }

    func loadSpentXP() -> Int { defaults.integer(forKey: spentKey) }

    func recordRedemption(_ voucher: Voucher, spentXP: Int) {
        var current = loadVouchers()
        current.insert(voucher, at: 0)
        if let data = try? JSONEncoder().encode(current) {
            defaults.set(data, forKey: vouchersKey)
        }
        defaults.set(spentXP, forKey: spentKey)
    }
}

final class LocationProvider: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var lastLocation: SubmissionLocation?
    @Published var statusText = UserDefaults.standard.string(forKey: "adl_language") == "fr" ? "Position non capturée" : "Location not captured"

    private let manager = CLLocationManager()
    private var pendingLocationRequest = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestCurrentLocation() {
        statusText = "Requesting location"
        switch manager.authorizationStatus {
        case .notDetermined:
            pendingLocationRequest = true
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            pendingLocationRequest = false
            manager.requestLocation()
        case .denied, .restricted:
            pendingLocationRequest = false
            statusText = "Location permission needed"
        @unknown default:
            pendingLocationRequest = false
            statusText = "Location unavailable"
        }
    }

    func setLocation(_ location: SubmissionLocation, status: String) {
        lastLocation = location
        statusText = status
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        DispatchQueue.main.async {
            self.lastLocation = SubmissionLocation(
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                accuracyMeters: location.horizontalAccuracy
            )
            self.statusText = "GPS locked to \(Int(location.horizontalAccuracy)) m"
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.statusText = "Location unavailable"
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        handleAuthorizationChange(manager.authorizationStatus)
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        handleAuthorizationChange(status)
    }

    private func handleAuthorizationChange(_ status: CLAuthorizationStatus) {
        guard pendingLocationRequest else { return }

        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            pendingLocationRequest = false
            manager.requestLocation()
        case .denied, .restricted:
            pendingLocationRequest = false
            statusText = "Location permission needed"
        case .notDetermined:
            break
        @unknown default:
            pendingLocationRequest = false
            statusText = "Location unavailable"
        }
    }
}
