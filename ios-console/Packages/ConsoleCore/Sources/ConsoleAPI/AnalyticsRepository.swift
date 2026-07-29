import ConsoleModels
import Foundation

/// Read-only company analytics. Every request goes through the authorized
/// `platform_analytics` tenant route and carries the selected organization id.
public protocol AnalyticsRepositoryProtocol: Sendable {
    func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot
    func weeklyTrends(organizationId: String, vertical: String, metric: String, weeks: Int) async throws -> [WeeklyTrend]
    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown]
    func agentPerformance(organizationId: String) async throws -> [AgentPerformance]
    func spatialIntelligence(organizationId: String, vertical: String) async throws -> [GeohashScore]
    func anomalies(organizationId: String, since: Date) async throws -> [AnomalyFlag]
    func heatMapData(organizationId: String, vertical: String) async throws -> [HeatMapCell]
    func aiQuery(organizationId: String, query: String) async throws -> AIQueryResponse
}

public final class AnalyticsRepository: AnalyticsRepositoryProtocol, Sendable {
    private let apiClient: PlatformAPIClient

    public init(apiClient: PlatformAPIClient) {
        self.apiClient = apiClient
    }

    public func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot {
        try await apiClient.organizationAnalytics(organizationId: organizationId, section: "snapshot")
    }

    /// `view=trends`, GET. DEVIATION: `vertical` is a REQUIRED server param
    /// (`handleTrends` 400s without it) and `metric` defaults to
    /// `total_points` server-side — the brief's signature only had `weeks`.
    /// Response is `{ data: [TrendDataPoint] }`; this unwraps the envelope.
    public func weeklyTrends(
        organizationId: String,
        vertical: String,
        metric: String = "total_points",
        weeks: Int = 12
    ) async throws -> [WeeklyTrend] {
        let trends: [WeeklyTrend] = try await apiClient.organizationAnalytics(
            organizationId: organizationId,
            section: "trends",
            query: ["vertical": vertical, "metric": metric, "weeks": String(weeks)]
        )
        return trends
    }

    /// Company record counts and percentages grouped by record type.
    public func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown] {
        try await apiClient.organizationAnalytics(organizationId: organizationId, section: "categories")
    }

    /// Company-scoped contributor performance derived from platform records.
    public func agentPerformance(organizationId: String) async throws -> [AgentPerformance] {
        try await apiClient.organizationAnalytics(organizationId: organizationId, section: "agents")
    }

    /// Company-scoped spatial cells. Pass `all` to include every record type.
    public func spatialIntelligence(organizationId: String, vertical: String) async throws -> [GeohashScore] {
        let cells: [GeohashScore] = try await apiClient.organizationAnalytics(
            organizationId: organizationId,
            section: "spatial",
            query: ["vertical": vertical]
        )
        return cells
    }

    /// Company anomalies filtered by date after decoding.
    public func anomalies(organizationId: String, since: Date) async throws -> [AnomalyFlag] {
        let rows: [AnomalyFlag] = try await apiClient.organizationAnalytics(
            organizationId: organizationId,
            section: "anomalies"
        )
        return rows.filter { row in
            guard let rowDate = Self.dateOnlyFormatter.date(from: row.snapshotDate) else { return true }
            return rowDate >= since
        }
    }

    /// DERIVED — no dedicated backend view. Composes `HeatMapCell`s from
    /// `spatial_intelligence` cells: `geohash` <- `cellId`,
    /// `latitude`/`longitude` <- `center`, `intensity` <- `opportunityScore`.
    /// DEVIATION: the brief's `geohashPrecision: Int` param has no backend
    /// equivalent (cell size is fixed server-side); replaced with the
    /// `vertical` param `spatial_intelligence` actually requires.
    public func heatMapData(organizationId: String, vertical: String) async throws -> [HeatMapCell] {
        let cells = try await spatialIntelligence(organizationId: organizationId, vertical: vertical)
        return cells.map { cell in
            HeatMapCell(
                geohash: cell.cellId,
                latitude: cell.center.latitude,
                longitude: cell.center.longitude,
                intensity: cell.opportunityScore
            )
        }
    }

    /// Fails closed until the AI facts pipeline supports organization scope.
    public func aiQuery(organizationId: String, query: String) async throws -> AIQueryResponse {
        throw PlatformAPIError(
            message: "The AI analytics assistant is unavailable until organization-scoped facts are supported.",
            status: 403,
            code: "platform_analytics_ai_unavailable"
        )
    }

    private static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
