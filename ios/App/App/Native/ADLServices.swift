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

    private let queueStore = OfflineQueueStore()
    let apiClient = ADLAPIClient()

    init() {
        drafts = queueStore.loadDrafts()
        refreshQueueSnapshot()
    }

    func bootstrap() async {
        guard isBootstrapping else { return }
        try? await Task.sleep(nanoseconds: 450_000_000)
        isBootstrapping = false
    }

    func signInDemo() {
        isAuthenticated = true
        profile = SessionProfile.demo(role: selectedRole)
        selectedTab = defaultTab(for: selectedRole)
    }

    func signOut() {
        isAuthenticated = false
        selectedTab = .home
    }

    func switchRole(_ role: UserRole) {
        selectedRole = role
        profile = SessionProfile.demo(role: role)
        selectedTab = defaultTab(for: role)
    }

    func enqueueContribution(
        title: String,
        notes: String,
        category: SubmissionCategory,
        location: SubmissionLocation?,
        image: UIImage?
    ) {
        let photoFilename = image.flatMap { queueStore.persistImage($0, id: UUID()) }
        let draft = ContributionDraft(
            id: UUID(),
            category: category,
            title: title,
            notes: notes,
            location: location,
            capturedPhotoFilename: photoFilename,
            createdAt: Date(),
            syncState: .queued
        )
        drafts.insert(draft, at: 0)
        queueStore.saveDrafts(drafts)
        refreshQueueSnapshot()
        lastSyncMessage = "Contribution queued for sync"
        selectedTab = .queue
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
        switch role {
        case .agent:
            return .home
        case .admin:
            return .adminReview
        case .client:
            return .clientDashboard
        }
    }

    private func refreshQueueSnapshot() {
        queueSnapshot = QueueSnapshot(
            queued: drafts.filter { $0.syncState == .queued || $0.syncState == .syncing }.count,
            failed: drafts.filter { $0.syncState == .failed }.count,
            synced: drafts.filter { $0.syncState == .synced }.count
        )
    }
}

final class ADLAPIClient {
    private let baseURL = URL(string: "https://africandatalayer.vercel.app")!
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    func url(path: String) -> URL {
        let normalizedPath = path.hasPrefix("/") ? path : "/\(path)"
        return baseURL.appendingPathComponent(String(normalizedPath.dropFirst()))
    }

    func fetchJSON<T: Decodable>(_ type: T.Type, path: String) async throws -> T {
        let (data, response) = try await URLSession.shared.data(from: url(path: path))
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed
        }
        return try decoder.decode(T.self, from: data)
    }

    func submit(_ draft: ContributionDraft) async throws {
        var request = URLRequest(url: url(path: "/api/submissions"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(draft)
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed
        }
    }
}

enum APIError: Error {
    case requestFailed
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
}

final class LocationProvider: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var lastLocation: SubmissionLocation?
    @Published var statusText = "Location not captured"

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestCurrentLocation() {
        statusText = "Requesting location"
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
        manager.requestLocation()
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
}
