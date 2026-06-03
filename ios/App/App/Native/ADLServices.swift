import Combine
import CoreLocation
import Foundation
import UIKit

@MainActor
final class AppState: ObservableObject {
    @Published var isBootstrapping = true
    @Published var isAuthenticated = false
    @Published var selectedRole: UserRole = .agent
    @Published var selectedTab: AppRoute = .home
    @Published var profile = SessionProfile.demo(role: .agent)
    @Published var points: [DataPoint] = DataPoint.bonamoussadiSeed
    @Published var drafts: [ContributionDraft] = []
    @Published var queueSnapshot = QueueSnapshot.empty
    @Published var lastSyncMessage = "Native Swift rewrite started"
    @Published var authError: String?
    @Published var isSigningIn = false
    @Published var isSyncingQueue = false
    @Published var mapCaptureContext: MapCaptureContext?
    @Published var analyticsSummary: AnalyticsSummary?
    @Published var weeklyTrend: [WeeklyTrendBar] = []
    @Published var isLoadingAnalytics = false
    @Published var analyticsError: String?

    private let queueStore = OfflineQueueStore()
    let apiClient = ADLAPIClient()

    init() {
        drafts = queueStore.loadDrafts()
        refreshQueueSnapshot()
    }

    func bootstrap() async {
        guard isBootstrapping else { return }
        try? await Task.sleep(nanoseconds: 250_000_000)
        await restoreSession()
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
            authError = "Enter phone/email and password."
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
            authError = (error as? APIError)?.message ?? "Unable to sign in."
        }
    }

    func signInDemo() {
        let role = AppReleaseMode.normalizedRole(selectedRole)
        selectedRole = role
        isAuthenticated = true
        profile = SessionProfile.demo(role: role)
        selectedTab = defaultTab(for: role)
    }

    func signOut() {
        Task {
            try? await apiClient.signOut()
            await MainActor.run {
                self.isAuthenticated = false
                self.selectedTab = .home
            }
        }
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
        lastSyncMessage = "Contribution queued for sync"
        selectedTab = .queue
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
        mapCaptureContext = MapCaptureContext(
            category: point.category,
            location: point.location,
            pointId: point.id,
            title: point.name
        )
        selectedTab = .contribute
    }

    func startMapCapture(at coordinate: CLLocationCoordinate2D) {
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
            lastSyncMessage = "No queued drafts"
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

    private func defaultTab(for role: UserRole) -> AppRoute {
        AppReleaseMode.defaultTab(for: role)
    }

    private func refreshQueueSnapshot() {
        queueSnapshot = QueueSnapshot(
            queued: drafts.filter { $0.syncState == .queued || $0.syncState == .syncing }.count,
            failed: drafts.filter { $0.syncState == .failed }.count,
            synced: drafts.filter { $0.syncState == .synced }.count
        )
    }

    private func applyAuthenticatedUser(_ user: AuthUser) {
        let accountRole = user.role ?? (user.isAdmin == true ? .admin : selectedRole)
        let resolvedRole = AppReleaseMode.normalizedRole(accountRole)
        let roleDefaults = SessionProfile.demo(role: resolvedRole)
        selectedRole = resolvedRole
        profile = SessionProfile(
            name: user.name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? user.name! : roleDefaults.name,
            role: resolvedRole,
            trustTier: roleDefaults.trustTier,
            xp: roleDefaults.xp,
            streakDays: roleDefaults.streakDays
        )
        isAuthenticated = true
        selectedTab = defaultTab(for: resolvedRole)
    }
}

final class ADLAPIClient {
    private let baseURL = URL(string: "https://africandatalayer.vercel.app")!
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

    func submit(_ payload: SubmissionPayload) async throws {
        var request = URLRequest(url: url(path: "/api/submissions"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)
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

final class LocationProvider: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var lastLocation: SubmissionLocation?
    @Published var statusText = "Location not captured"

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
