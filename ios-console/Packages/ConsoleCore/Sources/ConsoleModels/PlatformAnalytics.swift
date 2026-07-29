import Foundation

// MARK: - kpi_summary (`GET api/analytics?view=kpi_summary`)
//
// DEVIATION FROM THE TASK BRIEF: the brief's `DeltaSnapshot` guessed a flat
// shape (`totalRecords`, `recordsThisWeek`, `recordsChanged`, `recordsRemoved`,
// `pendingReview`, `weeklyActiveContributors`, `freshnessScore`). The real
// handler (`api/analytics/index.ts` `handleKpiSummary`) hand-builds a nested
// object with entirely different field names and grouping. This models the
// real response verbatim; the type name `DeltaSnapshot` is kept only because
// it is what `AnalyticsRepositoryProtocol.deltaSnapshot(organizationId:)` —
// named in the task's "Produces" list — returns.

public struct KpiVerification: Codable, Equatable, Sendable {
    public let totalPoints: Int
    public let verifiedPoints: Int
    public let verificationRatePct: Double

    public init(totalPoints: Int, verifiedPoints: Int, verificationRatePct: Double) {
        self.totalPoints = totalPoints
        self.verifiedPoints = verifiedPoints
        self.verificationRatePct = verificationRatePct
    }
}

public struct KpiFreshness: Codable, Equatable, Sendable {
    public let medianAgeDays: Double
    public let avgAgeDays: Double

    public init(medianAgeDays: Double, avgAgeDays: Double) {
        self.medianAgeDays = medianAgeDays
        self.avgAgeDays = avgAgeDays
    }
}

public struct KpiFraud: Codable, Equatable, Sendable {
    public let eventsWithFraudCheck: Int
    public let mismatchEvents: Int
    public let fraudRatePct: Double

    public init(eventsWithFraudCheck: Int, mismatchEvents: Int, fraudRatePct: Double) {
        self.eventsWithFraudCheck = eventsWithFraudCheck
        self.mismatchEvents = mismatchEvents
        self.fraudRatePct = fraudRatePct
    }
}

public struct KpiReviewQueue: Codable, Equatable, Sendable {
    public let pendingReview: Int
    public let highRiskEvents: Int

    public init(pendingReview: Int, highRiskEvents: Int) {
        self.pendingReview = pendingReview
        self.highRiskEvents = highRiskEvents
    }
}

/// KPI summary shape used by both ADL admin and organization-scoped analytics.
public struct DeltaSnapshot: Codable, Equatable, Sendable {
    public let generatedAt: String
    public let weeklyActiveContributors: Int
    public let verification: KpiVerification
    public let freshness: KpiFreshness
    public let fraud: KpiFraud
    public let reviewQueue: KpiReviewQueue
    public let enrichmentRatePct: Double

    public init(
        generatedAt: String,
        weeklyActiveContributors: Int,
        verification: KpiVerification,
        freshness: KpiFreshness,
        fraud: KpiFraud,
        reviewQueue: KpiReviewQueue,
        enrichmentRatePct: Double
    ) {
        self.generatedAt = generatedAt
        self.weeklyActiveContributors = weeklyActiveContributors
        self.verification = verification
        self.freshness = freshness
        self.fraud = fraud
        self.reviewQueue = reviewQueue
        self.enrichmentRatePct = enrichmentRatePct
    }
}

// MARK: - trends (`GET api/analytics?view=trends&vertical=...&metric=...&weeks=...`)
//
// DEVIATION: the brief's `WeeklyTrend` guessed submission/approval/rejection
// counts keyed by `weekEnding`. The real handler (`handleTrends`) returns a
// single numeric `metric` (default `total_points`) sampled per snapshot date
// for one `vertical` (a REQUIRED param — the brief omitted it), wrapped in a
// `{ data: [...] }` envelope. This models the real `TrendDataPoint` shape.

/// One point of `GET api/analytics?view=trends`'s `data` array.
public struct WeeklyTrend: Codable, Equatable, Sendable, Identifiable {
    public var id: String { date }
    public let date: String
    public let value: Double
    public let movingAvg: Double?

    public init(date: String, value: Double, movingAvg: Double?) {
        self.date = date
        self.value = value
        self.movingAvg = movingAvg
    }
}

// MARK: - CategoryBreakdown (derived — no dedicated backend view)
//
// Composed client-side from `GET api/analytics?view=snapshots`: the latest
// `snapshot_stats` row per `vertical_id`, expressed as a share of total
// points across verticals. Shape matches the brief's guess since there is no
// server response to defer to here.

public struct CategoryBreakdown: Codable, Equatable, Sendable, Identifiable {
    public var id: String { category }
    public let category: String
    public let count: Int
    public let percentage: Double

    public init(category: String, count: Int, percentage: Double) {
        self.category = category
        self.count = count
        self.percentage = percentage
    }
}

// MARK: - AgentPerformance

public struct AgentPerformance: Codable, Equatable, Sendable, Identifiable {
    public var id: String { userId }
    public let userId: String
    public let displayName: String
    public let submissions: Int
    public let approvalRate: Double
    public let flags: Int
    public let trustScore: Double

    public init(userId: String, displayName: String, submissions: Int, approvalRate: Double, flags: Int, trustScore: Double) {
        self.userId = userId
        self.displayName = displayName
        self.submissions = submissions
        self.approvalRate = approvalRate
        self.flags = flags
        self.trustScore = trustScore
    }
}

/// `GET api/leaderboard` — bare array, no envelope, no `view` param (see
/// `api/leaderboard/index.ts`). Field names already match the real
/// `LeaderboardEntry` TS interface in `shared/types.ts` verbatim.
public struct LeaderboardEntry: Codable, Equatable, Sendable, Identifiable {
    public var id: String { userId }
    public let rank: Int
    public let userId: String
    public let name: String
    public let xp: Int
    public let contributions: Int
    public let lastContributionAt: String?
    public let lastLocation: String
    public let averageQualityScore: Int
    public let rankingScore: Int
    public let verticalBreakdown: [String: Int]

    public init(
        rank: Int,
        userId: String,
        name: String,
        xp: Int,
        contributions: Int,
        lastContributionAt: String?,
        lastLocation: String,
        averageQualityScore: Int,
        rankingScore: Int,
        verticalBreakdown: [String: Int]
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
}

// MARK: - spatial_intelligence (`GET api/analytics?view=spatial_intelligence&vertical=...`)
//
// DEVIATION: the brief's `GeohashScore` guessed a 4-field shape (`geohash`,
// `opportunityScore`, `recordCount`, `lastUpdated`). The real handler
// (`getSpatialIntelligence` in `lib/server/spatialIntelligence.ts`, response
// type `SpatialIntelligenceResponse`/`SpatialIntelligenceCell` in
// `shared/types.ts`) returns a much richer per-cell object nested under
// `{ cells: [...] }`, requiring a `vertical` query param the brief omitted.
// This models the real cell shape; the type name `GeohashScore` is kept
// because it is what the "Produces" list names.

public struct GeoCenter: Codable, Equatable, Sendable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

public struct SpatialInsightDriver: Codable, Equatable, Sendable {
    public let label: String
    /// "positive" | "negative" | "neutral" — kept as `String` (not an enum)
    /// so an unrecognized future value from the server doesn't fail decoding.
    public let impact: String
    public let score: Double
    public let evidence: String

    public init(label: String, impact: String, score: Double, evidence: String) {
        self.label = label
        self.impact = impact
        self.score = score
        self.evidence = evidence
    }
}

/// Real shape of one `SpatialIntelligenceCell` from
/// `GET api/analytics?view=spatial_intelligence`.
public struct GeohashScore: Codable, Equatable, Sendable, Identifiable {
    public var id: String { cellId }
    public let cellId: String
    public let verticalId: String
    public let snapshotDate: String
    public let center: GeoCenter
    public let totalPoints: Int
    public let completedPoints: Int
    public let completionRate: Double
    public let avgConfidenceScore: Double
    public let photoCoverageRate: Double
    public let recentActivityRate: Double
    public let medianFreshnessDays: Double
    public let publishableChangeCount: Int
    public let newCount: Int
    public let removedCount: Int
    public let changedCount: Int
    public let operatorDiversity: Int
    public let marketSignalScore: Double
    public let opportunityScore: Double
    public let coverageGapScore: Double
    public let changeSignalScore: Double
    public let drivers: [SpatialInsightDriver]
    public let caveats: [String]
    public let summary: String

    public init(
        cellId: String,
        verticalId: String,
        snapshotDate: String,
        center: GeoCenter,
        totalPoints: Int,
        completedPoints: Int,
        completionRate: Double,
        avgConfidenceScore: Double,
        photoCoverageRate: Double,
        recentActivityRate: Double,
        medianFreshnessDays: Double,
        publishableChangeCount: Int,
        newCount: Int,
        removedCount: Int,
        changedCount: Int,
        operatorDiversity: Int,
        marketSignalScore: Double,
        opportunityScore: Double,
        coverageGapScore: Double,
        changeSignalScore: Double,
        drivers: [SpatialInsightDriver],
        caveats: [String],
        summary: String
    ) {
        self.cellId = cellId
        self.verticalId = verticalId
        self.snapshotDate = snapshotDate
        self.center = center
        self.totalPoints = totalPoints
        self.completedPoints = completedPoints
        self.completionRate = completionRate
        self.avgConfidenceScore = avgConfidenceScore
        self.photoCoverageRate = photoCoverageRate
        self.recentActivityRate = recentActivityRate
        self.medianFreshnessDays = medianFreshnessDays
        self.publishableChangeCount = publishableChangeCount
        self.newCount = newCount
        self.removedCount = removedCount
        self.changedCount = changedCount
        self.operatorDiversity = operatorDiversity
        self.marketSignalScore = marketSignalScore
        self.opportunityScore = opportunityScore
        self.coverageGapScore = coverageGapScore
        self.changeSignalScore = changeSignalScore
        self.drivers = drivers
        self.caveats = caveats
        self.summary = summary
    }
}

// MARK: - HeatMapCell (derived — no dedicated backend view)
//
// Composed client-side from `spatial_intelligence` cells: `geohash` <-
// `cellId`, `latitude`/`longitude` <- `center`, `intensity` <-
// `opportunityScore`. Shape matches the brief's guess.

public struct HeatMapCell: Codable, Equatable, Sendable {
    public let geohash: String
    public let latitude: Double
    public let longitude: Double
    public let intensity: Double

    public init(geohash: String, latitude: Double, longitude: Double, intensity: Double) {
        self.geohash = geohash
        self.latitude = latitude
        self.longitude = longitude
        self.intensity = intensity
    }
}

// MARK: - anomalies (`GET api/analytics?view=anomalies`)
//
// DEVIATION: the brief's `AnomalyFlag` guessed one row per anomaly
// (`recordId`, `anomalyType`, `severity`, `description`, `detectedAt`). The
// real handler (`handleAnomalies`) returns one row per
// `(snapshot_date, vertical_id)` with a *nested* `anomaly_flags` JSONB array
// of `{ metric, zScore, direction }` (see `AnomalyFlag`/`SnapshotStats` in
// `shared/types.ts`) — a completely different shape. It also takes no query
// parameters (no per-vertical or date filtering server-side; `since` is
// applied client-side by the repository after decoding). The top-level type
// name `AnomalyFlag` is kept because it is what the "Produces" list names.

public struct AnomalyMetricFlag: Codable, Equatable, Sendable {
    public let metric: String
    public let zScore: Double
    /// "increase" | "decrease" | "stable" | "not_applicable"
    public let direction: String

    public init(metric: String, zScore: Double, direction: String) {
        self.metric = metric
        self.zScore = zScore
        self.direction = direction
    }
}

/// Real shape of one row from `GET api/analytics?view=anomalies`.
public struct AnomalyFlag: Codable, Equatable, Sendable, Identifiable {
    public var id: String { "\(snapshotDate)-\(verticalId)" }
    public let snapshotDate: String
    public let verticalId: String
    public let totalPoints: Int
    public let anomalyFlags: [AnomalyMetricFlag]

    public init(snapshotDate: String, verticalId: String, totalPoints: Int, anomalyFlags: [AnomalyMetricFlag]) {
        self.snapshotDate = snapshotDate
        self.verticalId = verticalId
        self.totalPoints = totalPoints
        self.anomalyFlags = anomalyFlags
    }
}

// MARK: - AI analytics query (`POST api/ai/search?view=analytics-query`)
//
// DEVIATION: the brief's `AIQueryResponse` guessed `{ answer, data, chartSuggestion }`.
// The real handler (`handleAnalyticsAssistant` -> `answerAnalyticsQuestion` in
// `lib/server/ai/analyticsAssistant.ts`) returns `AiAnalyticsResponse` from
// `shared/types.ts`: `{ answer, facts, caveats, suggestedNextValidations,
// confidence, modelMetadata }`. This models the real shape; the type name
// `AIQueryResponse` is kept because it is what the "Produces" list names.

public struct AiModelMetadata: Codable, Equatable, Sendable {
    public let provider: String
    public let model: String
    public let modelVersion: String?
    public let promptVersion: String
    public let confidence: Double

    public init(provider: String, model: String, modelVersion: String?, promptVersion: String, confidence: Double) {
        self.provider = provider
        self.model = model
        self.modelVersion = modelVersion
        self.promptVersion = promptVersion
        self.confidence = confidence
    }
}

public struct AnalyticsFact: Codable, Equatable, Sendable {
    public let label: String
    /// `string | number` on the server; decoded as `JSONValue` to preserve
    /// either without losing information.
    public let value: JSONValue
    public let source: String

    public init(label: String, value: JSONValue, source: String) {
        self.label = label
        self.value = value
        self.source = source
    }
}

/// Real shape of `POST api/ai/search?view=analytics-query`'s response body
/// (`AiAnalyticsResponse` in `shared/types.ts`).
public struct AIQueryResponse: Codable, Equatable, Sendable {
    public let answer: String
    public let facts: [AnalyticsFact]
    public let caveats: [String]
    public let suggestedNextValidations: [String]
    public let confidence: Double
    public let modelMetadata: AiModelMetadata

    public init(
        answer: String,
        facts: [AnalyticsFact],
        caveats: [String],
        suggestedNextValidations: [String],
        confidence: Double,
        modelMetadata: AiModelMetadata
    ) {
        self.answer = answer
        self.facts = facts
        self.caveats = caveats
        self.suggestedNextValidations = suggestedNextValidations
        self.confidence = confidence
        self.modelMetadata = modelMetadata
    }
}
