import CoreLocation
import Foundation

enum UserRole: String, CaseIterable, Codable, Identifiable {
    case agent
    case admin
    case client

    var id: String { rawValue }

    var title: String {
        switch self {
        case .agent:
            return "Field Agent"
        case .admin:
            return "Admin Reviewer"
        case .client:
            return "Client"
        }
    }
}

enum SubmissionCategory: String, CaseIterable, Codable, Identifiable {
    case pharmacy
    case fuelStation = "fuel_station"
    case mobileMoney = "mobile_money"
    case alcoholOutlet = "alcohol_outlet"
    case billboard
    case transportRoad = "transport_road"
    case censusProxy = "census_proxy"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .pharmacy:
            return "Pharmacy"
        case .fuelStation:
            return "Fuel Station"
        case .mobileMoney:
            return "Mobile Money"
        case .alcoholOutlet:
            return "Alcohol Outlet"
        case .billboard:
            return "Billboard"
        case .transportRoad:
            return "Transport Road"
        case .censusProxy:
            return "Census Proxy"
        }
    }

    var systemImage: String {
        switch self {
        case .pharmacy:
            return "cross.case.fill"
        case .fuelStation:
            return "fuelpump.fill"
        case .mobileMoney:
            return "banknote.fill"
        case .alcoholOutlet:
            return "wineglass.fill"
        case .billboard:
            return "rectangle.on.rectangle.angled"
        case .transportRoad:
            return "road.lanes"
        case .censusProxy:
            return "building.2.fill"
        }
    }
}

enum AppRoute: String, CaseIterable, Hashable, Identifiable {
    case home
    case contribute
    case queue
    case rewards
    case profile
    case adminReview
    case agentPerformance
    case clientDashboard
    case analytics

    var id: String { rawValue }
}

enum SyncState: String, Codable {
    case queued
    case syncing
    case synced
    case failed

    var title: String {
        switch self {
        case .queued:
            return "Queued"
        case .syncing:
            return "Syncing"
        case .synced:
            return "Synced"
        case .failed:
            return "Failed"
        }
    }
}

struct SubmissionLocation: Codable, Hashable {
    var latitude: Double
    var longitude: Double
    var accuracyMeters: Double?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct DataPoint: Codable, Hashable, Identifiable {
    var id: String
    var category: SubmissionCategory
    var name: String
    var subtitle: String
    var location: SubmissionLocation
    var trustScore: Int
    var eventsCount: Int
    var updatedAt: Date
    var requiresRefresh: Bool

    static let bonamoussadiSeed: [DataPoint] = [
        DataPoint(
            id: "adl-bonamoussadi-pharmacy-01",
            category: .pharmacy,
            name: "Pharmacie Bonamoussadi",
            subtitle: "Needs opening-hours refresh",
            location: SubmissionLocation(latitude: 4.08864, longitude: 9.74354, accuracyMeters: 14),
            trustScore: 86,
            eventsCount: 12,
            updatedAt: Date(timeIntervalSinceNow: -86_400 * 11),
            requiresRefresh: true
        ),
        DataPoint(
            id: "adl-bonamoussadi-money-01",
            category: .mobileMoney,
            name: "Orange Money Kiosk",
            subtitle: "Cash availability unverified today",
            location: SubmissionLocation(latitude: 4.09023, longitude: 9.73980, accuracyMeters: 18),
            trustScore: 74,
            eventsCount: 7,
            updatedAt: Date(timeIntervalSinceNow: -86_400 * 3),
            requiresRefresh: true
        ),
        DataPoint(
            id: "adl-bonamoussadi-fuel-01",
            category: .fuelStation,
            name: "TotalEnergies Makepe",
            subtitle: "Fuel price verified",
            location: SubmissionLocation(latitude: 4.08583, longitude: 9.73592, accuracyMeters: 11),
            trustScore: 92,
            eventsCount: 19,
            updatedAt: Date(timeIntervalSinceNow: -86_400),
            requiresRefresh: false
        )
    ]
}

struct ContributionDraft: Codable, Hashable, Identifiable {
    var id: UUID
    var category: SubmissionCategory
    var title: String
    var notes: String
    var location: SubmissionLocation?
    var capturedPhotoFilename: String?
    var createdAt: Date
    var syncState: SyncState

    var displayTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? category.title : title
    }
}

struct QueueSnapshot: Hashable {
    var queued: Int
    var failed: Int
    var synced: Int

    static let empty = QueueSnapshot(queued: 0, failed: 0, synced: 0)
}

struct SessionProfile: Hashable {
    var name: String
    var role: UserRole
    var trustTier: String
    var xp: Int
    var streakDays: Int

    static func demo(role: UserRole) -> SessionProfile {
        switch role {
        case .agent:
            return SessionProfile(name: "Field Agent", role: role, trustTier: "trusted", xp: 2840, streakDays: 6)
        case .admin:
            return SessionProfile(name: "Admin Reviewer", role: role, trustTier: "review lead", xp: 6120, streakDays: 14)
        case .client:
            return SessionProfile(name: "Client Analyst", role: role, trustTier: "workspace", xp: 0, streakDays: 0)
        }
    }
}
