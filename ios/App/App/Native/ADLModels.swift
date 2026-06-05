import CoreLocation
import Foundation
import SwiftUI
import UIKit

enum ADLModelText {
    static var language: String {
        UserDefaults.standard.string(forKey: "adl_language") ?? "fr"
    }

    static func t(_ en: String, _ fr: String) -> String {
        language == "fr" ? fr : en
    }
}

enum UserRole: String, CaseIterable, Codable, Identifiable {
    case agent
    case admin
    case client

    var id: String { rawValue }

    var title: String {
        switch self {
        case .agent:
            return ADLModelText.t("Field Agent", "Agent terrain")
        case .admin:
            return ADLModelText.t("Admin Reviewer", "Réviseur admin")
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
            return ADLModelText.t("Consent obtained", "Consentement obtenu")
        case .refusedPiiOnly:
            return ADLModelText.t("No PII", "Sans PII")
        case .notRequired:
            return ADLModelText.t("Not required", "Non requis")
        case .withdrawn:
            return ADLModelText.t("Withdrawn", "Retiré")
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
            return ADLModelText.t("Pharmacy", "Pharmacie")
        case .fuelStation:
            return ADLModelText.t("Fuel Station", "Station-service")
        case .mobileMoney:
            return "Mobile Money"
        case .alcoholOutlet:
            return ADLModelText.t("Alcohol Outlet", "Point alcool")
        case .billboard:
            return ADLModelText.t("Billboard", "Panneau publicitaire")
        case .transportRoad:
            return ADLModelText.t("Transport Road", "Route transport")
        case .censusProxy:
            return ADLModelText.t("Census Proxy", "Proxy recensement")
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
    case investor
    case analytics

    var id: String { rawValue }
}

enum AppReleaseMode {
#if DEBUG
    static let allowsDemoAccess = false
    static let allowsRoleSwitching = false
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
            return [.adminReview, .home, .analytics, .agentPerformance, .profile]
        case .client:
            return [.clientDashboard, .investor, .home, .analytics, .profile]
        }
    }

    static func canShow(_ route: AppRoute, for role: UserRole) -> Bool {
        tabs(for: role).contains(route)
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
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
            return ADLModelText.t("Queued", "En file")
        case .syncing:
            return ADLModelText.t("Syncing", "Synchronisation")
        case .synced:
            return ADLModelText.t("Synced", "Synchronisé")
        case .failed:
            return ADLModelText.t("Failed", "Échec")
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

    enum CodingKeys: String, CodingKey {
        case mockLocationDetected
        case mockLocationMethod
        case hasAccelerometerData
        case hasGyroscopeData
        case accelerometerSampleCount
        case motionDetectedDuringCapture
        case gpsAccuracyMeters
        case networkType
        case gpsTimestamp
        case deviceTimestamp
        case timeDeltaMs
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(mockLocationDetected, forKey: .mockLocationDetected)
        try container.encodeNilOrValue(mockLocationMethod, forKey: .mockLocationMethod)
        try container.encode(hasAccelerometerData, forKey: .hasAccelerometerData)
        try container.encode(hasGyroscopeData, forKey: .hasGyroscopeData)
        try container.encode(accelerometerSampleCount, forKey: .accelerometerSampleCount)
        try container.encode(motionDetectedDuringCapture, forKey: .motionDetectedDuringCapture)
        try container.encodeNilOrValue(gpsAccuracyMeters, forKey: .gpsAccuracyMeters)
        try container.encodeNilOrValue(networkType, forKey: .networkType)
        try container.encodeNilOrValue(gpsTimestamp, forKey: .gpsTimestamp)
        try container.encode(deviceTimestamp, forKey: .deviceTimestamp)
        try container.encodeNilOrValue(timeDeltaMs, forKey: .timeDeltaMs)
    }

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

private extension KeyedEncodingContainer {
    mutating func encodeNilOrValue<T: Encodable>(_ value: T?, forKey key: Key) throws {
        if let value {
            try encode(value, forKey: key)
        } else {
            try encodeNil(forKey: key)
        }
    }
}

struct SubmissionDetails: Codable, Hashable {
    var name: String? = nil
    var siteName: String? = nil
    var confidenceScore: Double? = nil
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

struct ProjectedPoint: Codable, Hashable, Identifiable {
    var id: String
    var pointId: String
    var category: SubmissionCategory
    var location: SubmissionLocation
    var details: SubmissionDetails
    var photoUrl: String?
    var createdAt: String
    var updatedAt: String
    var gaps: [String]
    var eventsCount: Int
    var eventIds: [String]
}

struct DataPoint: Codable, Hashable, Identifiable {
    var id: String
    var category: SubmissionCategory
    var name: String
    var subtitle: String
    var location: SubmissionLocation
    var trustScore: Int
    var eventsCount: Int
    var createdAt: Date
    var updatedAt: Date
    var requiresRefresh: Bool
    var photoUrl: String?
    var details: SubmissionDetails
    var gaps: [String]

    init(
        id: String,
        category: SubmissionCategory,
        name: String,
        subtitle: String,
        location: SubmissionLocation,
        trustScore: Int,
        eventsCount: Int,
        createdAt: Date? = nil,
        updatedAt: Date,
        requiresRefresh: Bool,
        photoUrl: String? = nil,
        details: SubmissionDetails = SubmissionDetails(),
        gaps: [String] = []
    ) {
        self.id = id
        self.category = category
        self.name = name
        self.subtitle = subtitle
        self.location = location
        self.trustScore = trustScore
        self.eventsCount = eventsCount
        self.createdAt = createdAt ?? updatedAt
        self.updatedAt = updatedAt
        self.requiresRefresh = requiresRefresh
        self.photoUrl = photoUrl
        self.details = details
        self.gaps = gaps
    }

    init(projected point: ProjectedPoint) {
        let name = point.details.name?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? point.details.siteName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? point.details.roadName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? point.category.title
        let createdDate = Self.parseDate(point.createdAt) ?? Date()
        let date = Self.parseDate(point.updatedAt) ?? createdDate
        let score = point.details.confidenceScore.map { Int(max(0, min(100, $0)).rounded()) } ?? 85
        self.init(
            id: point.pointId,
            category: point.category,
            name: name,
            subtitle: Self.subtitle(for: point, updatedAt: date),
            location: point.location,
            trustScore: score,
            eventsCount: point.eventsCount,
            createdAt: createdDate,
            updatedAt: date,
            requiresRefresh: !point.gaps.isEmpty,
            photoUrl: point.photoUrl?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            details: point.details,
            gaps: point.gaps
        )
    }

    private static func subtitle(for point: ProjectedPoint, updatedAt: Date) -> String {
        if let gap = point.gaps.first?.trimmingCharacters(in: .whitespacesAndNewlines), !gap.isEmpty {
            return "Needs \(gap.replacingOccurrences(of: "_", with: " ")) refresh"
        }
        let days = max(0, Calendar.current.dateComponents([.day], from: updatedAt, to: Date()).day ?? 0)
        if days == 0 { return "Verified today" }
        if days == 1 { return "Verified 1 day ago" }
        return "Verified \(days)d ago"
    }

    private static func parseDate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }

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

/// Mirrors `/api/leaderboard`, used by the native leaderboard/analytics surface.
struct LeaderboardEntry: Codable, Hashable, Identifiable {
    var id: String { userId }
    var rank: Int
    var userId: String
    var name: String
    var xp: Int
    var contributions: Int
    var lastContributionAt: String?
    var lastLocation: String
    var averageQualityScore: Int
    var rankingScore: Int
    var verticalBreakdown: [String: Int]

    enum CodingKeys: String, CodingKey {
        case rank, userId, name, xp, contributions, lastContributionAt, lastLocation
        case averageQualityScore, rankingScore, verticalBreakdown
    }

    init(
        rank: Int,
        userId: String,
        name: String,
        xp: Int,
        contributions: Int,
        lastContributionAt: String?,
        lastLocation: String,
        averageQualityScore: Int,
        rankingScore: Int,
        verticalBreakdown: [String: Int] = [:]
    ) {
        self.rank = rank
        self.userId = userId
        self.name = name
        self.xp = xp
        self.contributions = contributions
        self.lastContributionAt = lastContributionAt
        self.lastLocation = lastLocation
        self.averageQualityScore = averageQualityScore
        self.rankingScore = rankingScore
        self.verticalBreakdown = verticalBreakdown
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        rank = try container.decodeIfPresent(Int.self, forKey: .rank) ?? 0
        userId = try container.decodeIfPresent(String.self, forKey: .userId) ?? "contributor"
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "Contributor"
        xp = try container.decodeIfPresent(Int.self, forKey: .xp) ?? 0
        contributions = try container.decodeIfPresent(Int.self, forKey: .contributions) ?? 0
        lastContributionAt = try container.decodeIfPresent(String.self, forKey: .lastContributionAt)
        lastLocation = try container.decodeIfPresent(String.self, forKey: .lastLocation) ?? "Location unavailable"
        averageQualityScore = try container.decodeIfPresent(Int.self, forKey: .averageQualityScore) ?? 0
        rankingScore = try container.decodeIfPresent(Int.self, forKey: .rankingScore) ?? 0
        verticalBreakdown = try container.decodeIfPresent([String: Int].self, forKey: .verticalBreakdown) ?? [:]
    }
}

// MARK: - User profile

/// Lenient decode of `GET /api/user` — only the fields the native app uses.
struct UserProfile: Codable, Hashable {
    var id: String?
    var name: String?
    var image: String?
    var avatarPreset: String?
    var occupation: String?
    var role: UserRole?
    var trustTier: String?
    var trustScore: Int?
    var xp: Int

    enum CodingKeys: String, CodingKey {
        case id, name, image, avatarPreset, occupation, role, trustTier, trustScore
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
        case .mobileCredit: return ADLModelText.t("Mobile credit", "Crédit mobile")
        case .fuelDiscount: return ADLModelText.t("Fuel discount", "Réduction carburant")
        case .giftCard: return ADLModelText.t("Gift card", "Carte cadeau")
        case .recognition: return ADLModelText.t("Recognition", "Reconnaissance")
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
        case .inStock: return ADLModelText.t("In stock", "Disponible")
        case .lowStock: return ADLModelText.t("Low stock", "Stock faible")
        case .outOfStock: return ADLModelText.t("Out of stock", "Rupture")
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
        case .insufficientBalance: return ADLModelText.t("Not enough XP for this reward yet.", "Pas encore assez de XP pour cette récompense.")
        case .outOfStock: return ADLModelText.t("This reward is out of stock.", "Cette récompense est en rupture.")
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
        case .starter: return ADLModelText.t("Starter", "Débutant")
        case .contributor: return ADLModelText.t("Contributor", "Contributeur")
        case .trusted: return ADLModelText.t("Trusted", "Fiable")
        case .expert: return "Expert"
        case .elite: return ADLModelText.t("Elite", "Élite")
        case .legend: return ADLModelText.t("Legend", "Légende")
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
        case .daily: return ADLModelText.t("Daily", "Quotidien")
        case .weekly: return ADLModelText.t("Weekly", "Hebdomadaire")
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

// MARK: - Admin Review Queue (africandatalayer-ot4)

/// Decision values accepted by PATCH /api/submissions/{id}?view=review
enum ReviewDecision: String, Codable {
    case approved
    case rejected
    case flagged
}

/// Stats counts from AdminReviewQueueResponse.stats
struct AdminReviewStats: Codable, Hashable {
    var all: Int
    var flagged: Int
    var pending: Int
    var lowRisk: Int
    var eligible: Int

    enum CodingKeys: String, CodingKey {
        case all, flagged, pending, eligible
        case lowRisk
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        all      = try c.decodeIfPresent(Int.self, forKey: .all)      ?? 0
        flagged  = try c.decodeIfPresent(Int.self, forKey: .flagged)  ?? 0
        pending  = try c.decodeIfPresent(Int.self, forKey: .pending)  ?? 0
        lowRisk  = try c.decodeIfPresent(Int.self, forKey: .lowRisk)  ?? 0
        eligible = try c.decodeIfPresent(Int.self, forKey: .eligible) ?? 0
    }
}

/// Flattened summary of one review group — from AdminSubmissionGroup.summary
struct AdminReviewSummary: Codable, Hashable {
    var riskScore: Double
    var reviewStatus: String
    var riskBucket: String       // "flagged" | "pending" | "low_risk"
    var trustTier: String?
    var trustScore: Double?
    var evidenceCount: Int
    var contributorCount: Int
    var staleHours: Int
    var submissionDistanceKm: Double?
    var ipDistanceKm: Double?
    var hasSubmissionMismatch: Bool
    var hasIpMismatch: Bool
    var isLowEndDevice: Bool

    enum CodingKeys: String, CodingKey {
        case riskScore, reviewStatus, riskBucket, trustTier, trustScore, evidenceCount, contributorCount
        case staleHours, submissionDistanceKm, ipDistanceKm, hasSubmissionMismatch, hasIpMismatch, isLowEndDevice
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        riskScore       = try c.decodeIfPresent(Double.self, forKey: .riskScore)        ?? 0
        reviewStatus    = try c.decodeIfPresent(String.self, forKey: .reviewStatus)    ?? ""
        riskBucket      = try c.decodeIfPresent(String.self, forKey: .riskBucket)      ?? "pending"
        trustTier       = try c.decodeIfPresent(String.self, forKey: .trustTier)
        trustScore      = try c.decodeIfPresent(Double.self, forKey: .trustScore)
        evidenceCount   = try c.decodeIfPresent(Int.self,    forKey: .evidenceCount)   ?? 0
        contributorCount = try c.decodeIfPresent(Int.self,   forKey: .contributorCount) ?? 0
        staleHours      = try c.decodeIfPresent(Int.self, forKey: .staleHours)          ?? 0
        submissionDistanceKm = try c.decodeIfPresent(Double.self, forKey: .submissionDistanceKm)
        ipDistanceKm    = try c.decodeIfPresent(Double.self, forKey: .ipDistanceKm)
        hasSubmissionMismatch = try c.decodeIfPresent(Bool.self, forKey: .hasSubmissionMismatch) ?? false
        hasIpMismatch   = try c.decodeIfPresent(Bool.self, forKey: .hasIpMismatch)      ?? false
        isLowEndDevice  = try c.decodeIfPresent(Bool.self, forKey: .isLowEndDevice)     ?? false
    }
}

struct AdminReviewEvent: Decodable, Hashable {
    var id: String
    var eventType: String
    var createdAt: String
    var category: SubmissionCategory
    var location: SubmissionLocation?
    var details: SubmissionDetails
    var photoUrl: String?
}

struct AdminReviewUser: Decodable, Hashable {
    var id: String
    var name: String
    var email: String?
    var trustScore: Int?
    var trustTier: String?
}

/// One group in the review queue — a point with its latest event + summary
struct AdminReviewGroup: Identifiable, Decodable, Hashable {
    var id: String { pointId }
    var pointId: String
    var category: SubmissionCategory
    var siteName: String?
    var latestEventId: String
    var photoURL: String?
    var latestEvent: AdminReviewEvent?
    var latestUser: AdminReviewUser?
    var summary: AdminReviewSummary

    // Wire nested latestEvent.event.id and latestEvent.event.photoUrl
    // plus allPhotos[0].url as an alternative photo source.
    private enum CodingKeys: String, CodingKey {
        case pointId, category, siteName, allPhotos, summary, latestEvent
    }

    private struct LatestEventWrapper: Decodable {
        var event: AdminReviewEvent
        var user: AdminReviewUser?
    }

    private struct PhotoEntry: Decodable {
        var url: String
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pointId  = try c.decodeIfPresent(String.self, forKey: .pointId)  ?? ""
        siteName = try c.decodeIfPresent(String.self, forKey: .siteName)
        summary  = try c.decode(AdminReviewSummary.self, forKey: .summary)

        // category: String rawValue → SubmissionCategory (defensive)
        let catRaw = try c.decodeIfPresent(String.self, forKey: .category) ?? ""
        category = SubmissionCategory(rawValue: catRaw) ?? .censusProxy

        // latestEvent.event.id and latestEvent.event.photoUrl
        let wrapper = try c.decodeIfPresent(LatestEventWrapper.self, forKey: .latestEvent)
        latestEvent = wrapper?.event
        latestUser = wrapper?.user
        latestEventId = wrapper?.event.id ?? ""
        let latestPhoto = wrapper?.event.photoUrl?.trimmingCharacters(in: .whitespacesAndNewlines)

        // allPhotos[0].url as first-choice photo
        let photos = try c.decodeIfPresent([PhotoEntry].self, forKey: .allPhotos) ?? []
        let firstPhotoURL = photos.first?.url.trimmingCharacters(in: .whitespacesAndNewlines)

        // Prefer allPhotos[0], fall back to latestEvent.event.photoUrl
        let resolved = firstPhotoURL?.isEmpty == false ? firstPhotoURL : (latestPhoto?.isEmpty == false ? latestPhoto : nil)
        photoURL = resolved
    }
}

/// Top-level response from GET /api/submissions?view=review_queue
struct AdminReviewQueueResponse: Decodable {
    var groups: [AdminReviewGroup]
    var stats: AdminReviewStats
    var page: Int
    var totalPages: Int
    var totalGroups: Int
    var limit: Int

    enum CodingKeys: String, CodingKey {
        case groups, stats, page, totalPages, totalGroups, limit
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        groups      = try c.decodeIfPresent([AdminReviewGroup].self, forKey: .groups)      ?? []
        stats       = try c.decodeIfPresent(AdminReviewStats.self,   forKey: .stats)       ?? AdminReviewStats()
        page        = try c.decodeIfPresent(Int.self, forKey: .page)        ?? 0
        totalPages  = try c.decodeIfPresent(Int.self, forKey: .totalPages)  ?? 1
        totalGroups = try c.decodeIfPresent(Int.self, forKey: .totalGroups) ?? 0
        limit       = try c.decodeIfPresent(Int.self, forKey: .limit)       ?? 20
    }
}

// Allow AdminReviewStats zero-arg init for decodeIfPresent fallback
extension AdminReviewStats {
    init() {
        all = 0; flagged = 0; pending = 0; lowRisk = 0; eligible = 0
    }
}

// MARK: - Assignments (africandatalayer-955)

enum CollectionAssignmentStatus: String, Codable, Hashable {
    case pending
    case inProgress = "in_progress"
    case completed
    case cancelled

    var title: String {
        switch self {
        case .pending:    return ADLModelText.t("Pending", "En attente")
        case .inProgress: return ADLModelText.t("In Progress", "En cours")
        case .completed:  return ADLModelText.t("Completed", "Terminé")
        case .cancelled:  return ADLModelText.t("Cancelled", "Annulé")
        }
    }

    var tint: String {
        switch self {
        case .pending:    return "amber"
        case .inProgress: return "navy"
        case .completed:  return "forest"
        case .cancelled:  return "terra"
        }
    }
}

struct CollectionAssignment: Decodable, Hashable, Identifiable {
    var id: String
    var agentUserId: String
    var zoneId: String
    var zoneLabel: String
    var assignedVerticals: [SubmissionCategory]
    var assignedDate: String
    var dueDate: String
    var status: CollectionAssignmentStatus
    var pointsExpected: Int
    var pointsSubmitted: Int
    var completionRate: Double
    var notes: String?
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, agentUserId, zoneId, zoneLabel, assignedVerticals, assignedDate, dueDate
        case status, pointsExpected, pointsSubmitted, completionRate, notes, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id              = try c.decodeIfPresent(String.self, forKey: .id)              ?? ""
        agentUserId     = try c.decodeIfPresent(String.self, forKey: .agentUserId)     ?? ""
        zoneId          = try c.decodeIfPresent(String.self, forKey: .zoneId)          ?? ""
        zoneLabel       = try c.decodeIfPresent(String.self, forKey: .zoneLabel)       ?? ""
        assignedDate    = try c.decodeIfPresent(String.self, forKey: .assignedDate)    ?? ""
        dueDate         = try c.decodeIfPresent(String.self, forKey: .dueDate)         ?? ""
        pointsExpected  = try c.decodeIfPresent(Int.self,    forKey: .pointsExpected)  ?? 0
        pointsSubmitted = try c.decodeIfPresent(Int.self,    forKey: .pointsSubmitted) ?? 0
        completionRate  = try c.decodeIfPresent(Double.self, forKey: .completionRate)  ?? 0
        notes           = try c.decodeIfPresent(String.self, forKey: .notes)
        createdAt       = try c.decodeIfPresent(String.self, forKey: .createdAt)       ?? ""
        updatedAt       = try c.decodeIfPresent(String.self, forKey: .updatedAt)       ?? ""

        let rawStatus = try c.decodeIfPresent(String.self, forKey: .status) ?? "pending"
        status = CollectionAssignmentStatus(rawValue: rawStatus) ?? .pending

        let rawVerticals = try c.decodeIfPresent([String].self, forKey: .assignedVerticals) ?? []
        assignedVerticals = rawVerticals.compactMap { SubmissionCategory(rawValue: $0) }
    }
}

struct AssignmentZone: Decodable, Hashable, Identifiable {
    var id: String
    var label: String
}

struct AssignmentAgent: Decodable, Hashable, Identifiable {
    var id: String
    var name: String
    var email: String?
}

struct AssignmentPlannerContext: Decodable, Hashable {
    var zones: [AssignmentZone]
    var agents: [AssignmentAgent]

    init(zones: [AssignmentZone] = [], agents: [AssignmentAgent] = []) {
        self.zones = zones
        self.agents = agents
    }

    enum CodingKeys: String, CodingKey { case zones, agents }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        zones  = try c.decodeIfPresent([AssignmentZone].self,  forKey: .zones)  ?? []
        agents = try c.decodeIfPresent([AssignmentAgent].self, forKey: .agents) ?? []
    }
}

struct AssignmentsResponse: Decodable {
    var context: AssignmentPlannerContext
    var assignments: [CollectionAssignment]

    enum CodingKeys: String, CodingKey { case context, assignments }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        context     = try c.decode(AssignmentPlannerContext.self,   forKey: .context)
        assignments = try c.decodeIfPresent([CollectionAssignment].self, forKey: .assignments) ?? []
    }
}

// MARK: - Automation Leads (africandatalayer-955)

enum AutomationLeadStatus: String, Codable, Hashable {
    case rejectedOutOfZone    = "rejected_out_of_zone"
    case rejectedManual       = "rejected_manual"
    case matchedExisting      = "matched_existing"
    case needsFieldVerify     = "needs_field_verify"
    case readyForAssignment   = "ready_for_assignment"
    case assignmentCreated    = "assignment_created"
    case verified
    case importCandidate      = "import_candidate"

    var title: String {
        switch self {
        case .rejectedOutOfZone:  return ADLModelText.t("Rejected (zone)", "Rejeté (zone)")
        case .rejectedManual:     return ADLModelText.t("Rejected", "Rejeté")
        case .matchedExisting:    return ADLModelText.t("Matched", "Associé")
        case .needsFieldVerify:   return ADLModelText.t("Needs Verify", "Vérif. terrain")
        case .readyForAssignment: return ADLModelText.t("Ready", "Prêt")
        case .assignmentCreated:  return ADLModelText.t("Assigned", "Affecté")
        case .verified:           return ADLModelText.t("Verified", "Vérifié")
        case .importCandidate:    return ADLModelText.t("Import", "Importable")
        }
    }
}

enum AutomationLeadPriority: String, Codable, Hashable {
    case high
    case medium
    case low

    var title: String {
        switch self {
        case .high:   return ADLModelText.t("High", "Haute")
        case .medium: return ADLModelText.t("Medium", "Moyenne")
        case .low:    return ADLModelText.t("Low", "Faible")
        }
    }
}

struct LeadCandidate: Decodable, Hashable, Identifiable {
    var id: String
    var sourceSystem: String
    var sourceRecordId: String
    var sourceUrl: String?
    var category: SubmissionCategory
    var zoneId: String?
    var location: SubmissionLocation
    var matchPointId: String?
    var matchConfidence: Double?
    var status: AutomationLeadStatus
    var priority: AutomationLeadPriority
    var createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, sourceSystem, sourceRecordId, sourceUrl, category, zoneId, location
        case matchPointId, matchConfidence, status, priority, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id             = try c.decodeIfPresent(String.self, forKey: .id)             ?? ""
        sourceSystem   = try c.decodeIfPresent(String.self, forKey: .sourceSystem)   ?? ""
        sourceRecordId = try c.decodeIfPresent(String.self, forKey: .sourceRecordId) ?? ""
        sourceUrl      = try c.decodeIfPresent(String.self, forKey: .sourceUrl)
        zoneId         = try c.decodeIfPresent(String.self, forKey: .zoneId)
        matchPointId   = try c.decodeIfPresent(String.self, forKey: .matchPointId)
        matchConfidence = try c.decodeIfPresent(Double.self, forKey: .matchConfidence)
        createdAt      = try c.decodeIfPresent(String.self, forKey: .createdAt)      ?? ""
        updatedAt      = try c.decodeIfPresent(String.self, forKey: .updatedAt)      ?? ""
        location       = try c.decodeIfPresent(SubmissionLocation.self, forKey: .location) ?? SubmissionLocation(latitude: 0, longitude: 0, accuracyMeters: nil)

        let rawCat = try c.decodeIfPresent(String.self, forKey: .category) ?? ""
        category = SubmissionCategory(rawValue: rawCat) ?? .censusProxy

        let rawStatus = try c.decodeIfPresent(String.self, forKey: .status) ?? "needs_field_verify"
        status = AutomationLeadStatus(rawValue: rawStatus) ?? .needsFieldVerify

        let rawPriority = try c.decodeIfPresent(String.self, forKey: .priority) ?? "medium"
        priority = AutomationLeadPriority(rawValue: rawPriority) ?? .medium
    }
}
