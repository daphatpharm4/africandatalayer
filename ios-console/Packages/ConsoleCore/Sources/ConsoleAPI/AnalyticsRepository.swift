import ConsoleModels
import Foundation

/// Read-only analytics + intelligence surface for the console app.
///
/// IMPORTANT — endpoint reality (verified against `api/analytics/index.ts`,
/// `api/leaderboard/index.ts`, and `api/ai/search.ts`): analytics lives at
/// `GET /api/analytics?view=…`, rankings at `GET /api/leaderboard`, and the
/// AI assistant at `POST /api/ai/search?view=analytics-query`. None of these
/// are `api/user?view=platform_*` calls, so `PlatformAPIClient.callPlatform`
/// (hard-coded to that convention) cannot serve them — every method below
/// goes through `PlatformAPIClient.analyticsGet`, `.leaderboard()`, or
/// `.aiAnalyticsQuery(question:)` instead, added alongside `callPlatform`
/// for exactly this reason (mirroring how `dedupCandidates` already talks to
/// `api/submissions` directly).
///
/// None of the real analytics/leaderboard/AI-search endpoints are
/// organization-scoped today (no handler reads an `organizationId` query
/// param or request field) — this is a platform-wide surface, unlike the
/// `platform_*` views. `organizationId` is kept on every protocol method for
/// interface stability (and in case the server adds scoping later) but is
/// currently unused by the implementation below; see the per-method notes
/// for the other, more substantive shape deviations from the task brief.
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

    /// `view=kpi_summary`, GET, no query params — the handler takes none.
    public func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot {
        try await apiClient.analyticsGet(view: "kpi_summary")
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
        struct TrendsEnvelope: Decodable {
            var data: [WeeklyTrend]
        }
        let envelope: TrendsEnvelope = try await apiClient.analyticsGet(
            view: "trends",
            query: ["vertical": vertical, "metric": metric, "weeks": String(weeks)]
        )
        return envelope.data
    }

    /// DERIVED — no dedicated backend view. Composes the latest
    /// `snapshot_stats` row per vertical (from `view=snapshots`) into a
    /// count + percentage-of-total breakdown. Rows are ordered
    /// `snapshot_date DESC, vertical_id` server-side, so the first row seen
    /// per `verticalId` while iterating is that vertical's latest snapshot.
    public func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown] {
        let rows: [SnapshotStatsRow] = try await apiClient.analyticsGet(view: "snapshots", query: ["limit": "100"])

        var latestByVertical: [String: SnapshotStatsRow] = [:]
        var order: [String] = []
        for row in rows where latestByVertical[row.verticalId] == nil {
            latestByVertical[row.verticalId] = row
            order.append(row.verticalId)
        }

        let total = latestByVertical.values.reduce(0) { $0 + $1.totalPoints }
        return order.compactMap { verticalId -> CategoryBreakdown? in
            guard let row = latestByVertical[verticalId] else { return nil }
            let percentage = total > 0 ? (Double(row.totalPoints) / Double(total) * 100).rounded(toPlaces: 1) : 0
            return CategoryBreakdown(category: row.verticalId, count: row.totalPoints, percentage: percentage)
        }
        .sorted { $0.count > $1.count }
    }

    /// DERIVED — no dedicated per-agent performance view. Composed from the
    /// public `GET api/leaderboard`, which has no approval-rate, flag-count,
    /// or trust-score fields (those live behind admin-only endpoints out of
    /// this task's scope). `approvalRate` and `trustScore` are proxies
    /// derived from `averageQualityScore`; `flags` is always `0`
    /// (unavailable from this data source). See `AgentPerformance`'s doc
    /// comment in `ConsoleModels` for the caveat.
    public func agentPerformance(organizationId: String) async throws -> [AgentPerformance] {
        let entries = try await apiClient.leaderboard()
        return entries.map { entry in
            AgentPerformance(
                userId: entry.userId,
                displayName: entry.name,
                submissions: entry.contributions,
                approvalRate: Double(entry.averageQualityScore) / 100,
                flags: 0,
                trustScore: Double(entry.averageQualityScore)
            )
        }
    }

    /// `view=spatial_intelligence`, GET. DEVIATION: `vertical` is a REQUIRED
    /// server param (`handleSpatialIntelligence` 400s without it) — the
    /// brief's signature had none. Response is `SpatialIntelligenceResponse`
    /// (`{ cells: [...], narrative, ... }`); this unwraps to `cells`.
    public func spatialIntelligence(organizationId: String, vertical: String) async throws -> [GeohashScore] {
        struct SpatialIntelligenceEnvelope: Decodable {
            var cells: [GeohashScore]
        }
        let envelope: SpatialIntelligenceEnvelope = try await apiClient.analyticsGet(
            view: "spatial_intelligence",
            query: ["vertical": vertical]
        )
        return envelope.cells
    }

    /// `view=anomalies`, GET. DEVIATION: the real handler
    /// (`handleAnomalies`) takes no query params at all — no date/vertical
    /// filtering server-side (it just returns the 50 most recent
    /// `snapshot_stats` rows with a non-empty `anomaly_flags` array). `since`
    /// is therefore applied client-side after decoding, keeping only rows
    /// whose `snapshotDate` (`YYYY-MM-DD`) falls on or after `since`. Rows
    /// with an unparsable date are kept rather than silently dropped.
    public func anomalies(organizationId: String, since: Date) async throws -> [AnomalyFlag] {
        let rows: [AnomalyFlag] = try await apiClient.analyticsGet(view: "anomalies")
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

    /// `POST api/ai/search?view=analytics-query`. DEVIATION: the server
    /// field is `question`, not `query`; `organizationId` is accepted for
    /// interface parity but not sent (the server has no such field in
    /// `aiAnalyticsQueryRequestSchema` and rejects unknown fields via
    /// `.strict()`).
    public func aiQuery(organizationId: String, query: String) async throws -> AIQueryResponse {
        try await apiClient.aiAnalyticsQuery(question: query)
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

/// Raw shape of one `snapshot_stats` row from `GET api/analytics?view=snapshots`
/// (see `api/analytics/index.ts` `handleSnapshots` and the `snapshot_stats`
/// table in `supabase/migrations/20260303_snapshot_delta_tables.sql`). Decoded
/// with `.convertFromSnakeCase` by `PlatformAPIClient.analyticsGet`, so the
/// snake_case Postgres columns land on these camelCase properties without
/// explicit `CodingKeys`. Internal — this is purely an implementation detail
/// of `categoryBreakdown`'s client-side composition, not part of the
/// repository's public model surface.
struct SnapshotStatsRow: Decodable {
    var id: String
    var snapshotDate: String
    var verticalId: String
    var totalPoints: Int
    var completedPoints: Int
    var completionRate: Double
    var newCount: Int
    var removedCount: Int
    var changedCount: Int
    var unchangedCount: Int
    var avgPrice: Double?
    var weekOverWeekGrowth: Double?
    var movingAvg4w: Double?
    var zScoreTotalPoints: Double?
    var zScoreNewCount: Double?
    var zScoreRemovedCount: Double?
    var anomalyFlags: [AnomalyMetricFlag]
    var isBaseline: Bool
}

private extension Double {
    func rounded(toPlaces places: Int) -> Double {
        let factor = pow(10.0, Double(places))
        return (self * factor).rounded() / factor
    }
}
