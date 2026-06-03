import CoreLocation
import Foundation
import UIKit

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

enum SubmissionEventType: String, Codable, Hashable {
    case create = "CREATE_EVENT"
    case enrich = "ENRICH_EVENT"
}

enum ConsentStatus: String, CaseIterable, Codable, Identifiable {
    case obtained
    case refusedPiiOnly = "refused_pii_only"
    case notRequired = "not_required"
    case withdrawn

    var id: String { rawValue }

    var title: String {
        switch self {
        case .obtained:
            return "Consent obtained"
        case .refusedPiiOnly:
            return "No PII"
        case .notRequired:
            return "Not required"
        case .withdrawn:
            return "Withdrawn"
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

struct VerticalConfig: Hashable, Identifiable {
    var id: SubmissionCategory
    var requiredFields: [String]
    var enrichableFields: [String]
    var stalenessDays: Int

    static let all: [SubmissionCategory: VerticalConfig] = [
        .pharmacy: VerticalConfig(
            id: .pharmacy,
            requiredFields: ["name", "isOpenNow"],
            enrichableFields: ["openingHours", "isOpenNow", "isOnDuty", "isLicensed", "hasPrescriptionService", "medicineCategories"],
            stalenessDays: 5
        ),
        .mobileMoney: VerticalConfig(
            id: .mobileMoney,
            requiredFields: ["providers"],
            enrichableFields: ["merchantIdByProvider", "paymentMethods", "openingHours", "providers", "isActive", "hasFloat", "agentType"],
            stalenessDays: 3
        ),
        .fuelStation: VerticalConfig(
            id: .fuelStation,
            requiredFields: ["name", "hasFuelAvailable"],
            enrichableFields: ["fuelTypes", "pricesByFuel", "quality", "paymentMethods", "openingHours", "hasFuelAvailable", "queueLength"],
            stalenessDays: 3
        ),
        .alcoholOutlet: VerticalConfig(
            id: .alcoholOutlet,
            requiredFields: ["name"],
            enrichableFields: ["brand", "openingHours", "paymentMethods", "outletType", "isFormal", "servesFood", "brandsAvailable", "priceRange"],
            stalenessDays: 7
        ),
        .billboard: VerticalConfig(
            id: .billboard,
            requiredFields: ["name"],
            enrichableFields: ["brand", "billboardType", "isOccupied", "advertiserBrand", "advertiserCategory", "condition", "size", "isLit"],
            stalenessDays: 14
        ),
        .transportRoad: VerticalConfig(
            id: .transportRoad,
            requiredFields: ["roadName", "condition"],
            enrichableFields: ["condition", "isBlocked", "blockageType", "surfaceType", "passableBy", "trafficLevel", "hasStreetLight"],
            stalenessDays: 14
        ),
        .censusProxy: VerticalConfig(
            id: .censusProxy,
            requiredFields: ["buildingType", "occupancyStatus"],
            enrichableFields: ["occupancyStatus", "storeyCount", "estimatedUnits", "hasElectricity", "constructionMaterial", "hasCommercialGround"],
            stalenessDays: 30
        )
    ]
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

enum AppReleaseMode {
#if DEBUG
    static let allowsDemoAccess = true
    static let allowsRoleSwitching = true
#else
    static let allowsDemoAccess = false
    static let allowsRoleSwitching = false
#endif

    static var demoRoles: [UserRole] {
#if DEBUG
        return UserRole.allCases
#else
        return [.agent]
#endif
    }

    static func normalizedRole(_ role: UserRole) -> UserRole {
#if DEBUG
        return role
#else
        return .agent
#endif
    }

    static func defaultTab(for role: UserRole) -> AppRoute {
        switch normalizedRole(role) {
        case .agent:
            return .home
        case .admin:
            return .adminReview
        case .client:
            return .clientDashboard
        }
    }

    static func tabs(for role: UserRole) -> [AppRoute] {
        switch normalizedRole(role) {
        case .agent:
            return [.home, .contribute, .queue, .profile]
        case .admin:
            return [.adminReview, .agentPerformance, .profile]
        case .client:
            return [.clientDashboard, .analytics, .profile]
        }
    }

    static func canShow(_ route: AppRoute, for role: UserRole) -> Bool {
        tabs(for: role).contains(route)
    }
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

struct ClientDeviceInfo: Codable, Hashable {
    var deviceId: String
    var platform: String?
    var userAgent: String?

    static func current() -> ClientDeviceInfo {
        ClientDeviceInfo(
            deviceId: UIDevice.current.identifierForVendor?.uuidString ?? "ios-native-unknown",
            platform: "ios",
            userAgent: "AfricanDataLayer-iOS-Swift"
        )
    }
}

struct GpsIntegrityReport: Codable, Hashable {
    var mockLocationDetected: Bool
    var mockLocationMethod: String?
    var hasAccelerometerData: Bool
    var hasGyroscopeData: Bool
    var accelerometerSampleCount: Int
    var motionDetectedDuringCapture: Bool
    var gpsAccuracyMeters: Double?
    var networkType: String?
    var gpsTimestamp: Int?
    var deviceTimestamp: Int
    var timeDeltaMs: Int?

    static func from(location: SubmissionLocation?) -> GpsIntegrityReport {
        let nowMs = Int(Date().timeIntervalSince1970 * 1000)
        return GpsIntegrityReport(
            mockLocationDetected: false,
            mockLocationMethod: nil,
            hasAccelerometerData: false,
            hasGyroscopeData: false,
            accelerometerSampleCount: 0,
            motionDetectedDuringCapture: false,
            gpsAccuracyMeters: location?.accuracyMeters,
            networkType: nil,
            gpsTimestamp: nowMs,
            deviceTimestamp: nowMs,
            timeDeltaMs: nil
        )
    }
}

struct SubmissionDetails: Codable, Hashable {
    var name: String? = nil
    var siteName: String? = nil
    var openingHours: String? = nil
    var isOpenNow: Bool? = nil
    var isOnDuty: Bool? = nil
    var providers: [String]? = nil
    var paymentMethods: [String]? = nil
    var merchantIdByProvider: [String: String]? = nil
    var hasFuelAvailable: Bool? = nil
    var fuelTypes: [String]? = nil
    var pricesByFuel: [String: Double]? = nil
    var quality: String? = nil
    var outletType: String? = nil
    var isFormal: Bool? = nil
    var billboardType: String? = nil
    var isOccupied: Bool? = nil
    var advertiserBrand: String? = nil
    var roadName: String? = nil
    var condition: String? = nil
    var surfaceType: String? = nil
    var isBlocked: Bool? = nil
    var blockageType: String? = nil
    var buildingType: String? = nil
    var occupancyStatus: String? = nil
    var storeyCount: Int? = nil
    var estimatedUnits: Int? = nil
    var consentStatus: ConsentStatus? = nil
    var consentRecordedAt: String? = nil
    var clientDevice: ClientDeviceInfo? = nil
}

struct SubmissionPayload: Codable, Hashable {
    var eventType: SubmissionEventType
    var pointId: String?
    var category: SubmissionCategory
    var location: SubmissionLocation?
    var details: SubmissionDetails
    var imageBase64: String?
    var consentStatus: ConsentStatus
    var consentRecordedAt: String
    var gpsIntegrity: GpsIntegrityReport?
    var photoEvidenceSha256: String?
}

struct MapCaptureContext: Hashable {
    var category: SubmissionCategory?
    var location: SubmissionLocation
    var pointId: String?
    var title: String
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
    var payload: SubmissionPayload?
    var createdAt: Date
    var syncState: SyncState
    var lastError: String?

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

struct AuthSession: Codable, Hashable {
    var user: AuthUser?
    var expires: String?
}

struct AuthUser: Codable, Hashable {
    var id: String?
    var name: String?
    var email: String?
    var image: String?
    var isAdmin: Bool?
    var role: UserRole?
}
