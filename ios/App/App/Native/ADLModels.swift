import CoreLocation
import Foundation
import SwiftUI
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
            return [.home, .contribute, .analytics, .profile]
        case .admin:
            return [.adminReview, .home, .agentPerformance, .profile]
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

// MARK: - Analytics

/// Mirrors the `view=kpi_summary` payload from `api/analytics/index.ts`.
struct AnalyticsSummary: Codable, Hashable {
    struct Verification: Codable, Hashable {
        var totalPoints: Int
        var verifiedPoints: Int
        var verificationRatePct: Double
    }

    struct Freshness: Codable, Hashable {
        var medianAgeDays: Double
        var avgAgeDays: Double
    }

    struct Fraud: Codable, Hashable {
        var eventsWithFraudCheck: Int
        var mismatchEvents: Int
        var fraudRatePct: Double
    }

    struct ReviewQueue: Codable, Hashable {
        var pendingReview: Int
        var highRiskEvents: Int
    }

    var generatedAt: String?
    var weeklyActiveContributors: Int
    var verification: Verification
    var freshness: Freshness
    var fraud: Fraud
    var reviewQueue: ReviewQueue
    var enrichmentRatePct: Double
}

/// Mirrors a row from the `view=kpi_weekly` array in `api/analytics/index.ts`.
/// Only the integer columns are decoded; `pg` returns NUMERIC columns
/// (avg_completeness_pct, median_freshness_days) as strings, so they are
/// intentionally omitted to keep decoding total.
struct WeeklyKpiRow: Codable, Hashable, Identifiable {
    var weekStart: String
    var category: String?
    var totalEvents: Int
    var totalCreates: Int
    var totalEnrichments: Int
    var uniqueUsers: Int
    var uniquePoints: Int

    var id: String { "\(weekStart)-\(category ?? "all")" }

    enum CodingKeys: String, CodingKey {
        case weekStart = "week_start"
        case category
        case totalEvents = "total_events"
        case totalCreates = "total_creates"
        case totalEnrichments = "total_enrichments"
        case uniqueUsers = "unique_users"
        case uniquePoints = "unique_points"
    }
}

/// One bar in the analytics weekly trend, aggregated across categories.
struct WeeklyTrendBar: Identifiable, Hashable {
    var id: String { weekStart }
    var weekStart: String
    var totalEvents: Int
}

// MARK: - User profile

/// Lenient decode of `GET /api/user` — only the fields the native app uses.
struct UserProfile: Codable, Hashable {
    var id: String?
    var name: String?
    var role: UserRole?
    var trustTier: String?
    var trustScore: Int?
    var xp: Int

    enum CodingKeys: String, CodingKey {
        case id, name, role, trustTier, trustScore
        case xp = "XP"
    }
}

// MARK: - Rewards

enum RewardCategory: String, Codable, CaseIterable, Identifiable {
    case mobileCredit
    case fuelDiscount
    case giftCard
    case recognition

    var id: String { rawValue }

    var title: String {
        switch self {
        case .mobileCredit: return "Mobile credit"
        case .fuelDiscount: return "Fuel discount"
        case .giftCard: return "Gift card"
        case .recognition: return "Recognition"
        }
    }

    var systemImage: String {
        switch self {
        case .mobileCredit: return "antenna.radiowaves.left.and.right"
        case .fuelDiscount: return "fuelpump.fill"
        case .giftCard: return "giftcard.fill"
        case .recognition: return "rosette"
        }
    }
}

enum RewardStock: String, Codable {
    case inStock
    case lowStock
    case outOfStock

    var title: String {
        switch self {
        case .inStock: return "In stock"
        case .lowStock: return "Low stock"
        case .outOfStock: return "Out of stock"
        }
    }

    var isAvailable: Bool { self != .outOfStock }
}

struct Reward: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var category: RewardCategory
    var costXP: Int
    var stock: RewardStock

    static let catalog: [Reward] = [
        Reward(id: "mtn-credit-5k", name: "Mobile credit · 5,000 FCFA", category: .mobileCredit, costXP: 5_000, stock: .inStock),
        Reward(id: "fuel-10", name: "Fuel discount · 10%", category: .fuelDiscount, costXP: 12_000, stock: .lowStock),
        Reward(id: "grocer-card", name: "Gift card · Local grocer", category: .giftCard, costXP: 8_500, stock: .inStock),
        Reward(id: "data-2gb", name: "Data bundle · 2 GB", category: .mobileCredit, costXP: 3_500, stock: .inStock),
        Reward(id: "badge-boost", name: "Community badge boost", category: .recognition, costXP: 2_000, stock: .inStock)
    ]
}

/// A redeemed reward, persisted locally in the on-device wallet.
struct Voucher: Identifiable, Codable, Hashable {
    var id: UUID
    var rewardId: String
    var rewardName: String
    var costXP: Int
    var code: String
    var redeemedAt: Date

    static func generateCode() -> String {
        let alphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        func block() -> String { String((0..<4).map { _ in alphabet.randomElement()! }) }
        return "ADL-\(block())-\(block())"
    }
}

enum RedeemError: LocalizedError {
    case insufficientBalance
    case outOfStock

    var errorDescription: String? {
        switch self {
        case .insufficientBalance: return "Not enough XP for this reward yet."
        case .outOfStock: return "This reward is out of stock."
        }
    }
}

// MARK: - Gamification

/// XP-threshold progression used for the profile bar and level-up celebration.
enum AgentTier: Int, CaseIterable, Identifiable {
    case starter
    case contributor
    case trusted
    case expert
    case elite
    case legend

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .starter: return "Starter"
        case .contributor: return "Contributor"
        case .trusted: return "Trusted"
        case .expert: return "Expert"
        case .elite: return "Elite"
        case .legend: return "Legend"
        }
    }

    /// Minimum XP to hold this tier.
    var threshold: Int {
        switch self {
        case .starter: return 0
        case .contributor: return 500
        case .trusted: return 1_500
        case .expert: return 4_000
        case .elite: return 8_000
        case .legend: return 15_000
        }
    }

    static func tier(forXP xp: Int) -> AgentTier {
        allCases.last { xp >= $0.threshold } ?? .starter
    }

    var next: AgentTier? {
        AgentTier(rawValue: rawValue + 1)
    }
}

/// Derived progress toward the next XP tier.
struct TierProgress: Hashable {
    var current: AgentTier
    var next: AgentTier?
    var xp: Int

    init(xp: Int) {
        self.xp = xp
        self.current = AgentTier.tier(forXP: xp)
        self.next = current.next
    }

    /// 0…1 progress from the current tier threshold to the next.
    var fraction: Double {
        guard let next else { return 1 }
        let span = Double(next.threshold - current.threshold)
        guard span > 0 else { return 1 }
        return min(1, max(0, Double(xp - current.threshold) / span))
    }

    var xpToNext: Int {
        guard let next else { return 0 }
        return max(0, next.threshold - xp)
    }
}

struct Badge: Identifiable, Hashable {
    var id: String
    var title: String
    var detail: String
    var systemImage: String
    var tint: Color
    var unlocked: Bool
    var progress: Double
}

enum MissionPeriod: String, Hashable {
    case daily
    case weekly

    var title: String {
        switch self {
        case .daily: return "Daily"
        case .weekly: return "Weekly"
        }
    }
}

struct Mission: Identifiable, Hashable {
    var id: String
    var title: String
    var detail: String
    var period: MissionPeriod
    var goal: Int
    var current: Int
    var rewardXP: Int

    var fraction: Double {
        guard goal > 0 else { return 0 }
        return min(1, Double(current) / Double(goal))
    }

    var isComplete: Bool { current >= goal }
}

struct DailyGoal: Hashable {
    var target: Int
    var completed: Int

    var fraction: Double {
        guard target > 0 else { return 0 }
        return min(1, Double(completed) / Double(target))
    }
}

/// Emitted when the agent crosses into a new tier, to trigger the celebration.
struct LevelUpEvent: Equatable {
    var tier: AgentTier
}
