import XCTest
import ConsoleModels
@testable import ConsoleAPI

final class AnalyticsRepositoryTests: XCTestCase {
    private let baseURL = URL(string: "https://console.example.com")!

    // MARK: - deltaSnapshot -> view=kpi_summary

    func testDeltaSnapshotHitsKpiSummaryViewWithNoExtraParams() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "generatedAt": "2026-07-24T12:00:00.000Z",
          "weeklyActiveContributors": 15,
          "verification": {"totalPoints": 1500, "verifiedPoints": 900, "verificationRatePct": 60.0},
          "freshness": {"medianAgeDays": 3.5, "avgAgeDays": 5.2},
          "fraud": {"eventsWithFraudCheck": 400, "mismatchEvents": 8, "fraudRatePct": 2.0},
          "reviewQueue": {"pendingReview": 8, "highRiskEvents": 3},
          "enrichmentRatePct": 42.5
        }
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let snapshot = try await repository.deltaSnapshot(organizationId: "org_1")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.url?.path, "/api/analytics")
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "kpi_summary")
        XCTAssertEqual(snapshot.weeklyActiveContributors, 15)
        XCTAssertEqual(snapshot.verification.verificationRatePct, 60.0)
    }

    // MARK: - weeklyTrends -> view=trends, requires vertical+metric+weeks, unwraps `data`

    func testWeeklyTrendsSendsVerticalMetricWeeksAndUnwrapsDataEnvelope() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {"data": [
          {"date": "2026-07-13", "value": 80, "movingAvg": null},
          {"date": "2026-07-20", "value": 100, "movingAvg": 90.0}
        ]}
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let trends = try await repository.weeklyTrends(organizationId: "org_1", vertical: "pharmacy", metric: "total_points", weeks: 8)

        let request = try XCTUnwrap(transport.lastRequest)
        let query = JSONFixture.queryParams(request)
        XCTAssertEqual(query["view"], "trends")
        XCTAssertEqual(query["vertical"], "pharmacy")
        XCTAssertEqual(query["metric"], "total_points")
        XCTAssertEqual(query["weeks"], "8")

        XCTAssertEqual(trends.count, 2)
        XCTAssertNil(trends[0].movingAvg)
        XCTAssertEqual(trends[1].value, 100)
    }

    // MARK: - categoryBreakdown -> view=snapshots, latest row per vertical, percentage math

    func testCategoryBreakdownDerivesLatestRowPerVerticalAndComputesPercentage() async throws {
        let transport = MockPlatformTransport()
        // Ordered snapshot_date DESC, vertical_id — as the real server orders it.
        // pharmacy appears twice (newer first); fuel_station once. The stale
        // pharmacy row (total_points: 50) must be ignored in favor of the
        // latest (total_points: 300).
        transport.responseData = JSONFixture.data("""
        [
          {"id": "s1", "snapshot_date": "2026-07-20", "vertical_id": "pharmacy", "total_points": 300, "completed_points": 200, "completion_rate": 0.66, "new_count": 5, "removed_count": 1, "changed_count": 2, "unchanged_count": 292, "avg_price": null, "week_over_week_growth": null, "moving_avg_4w": null, "z_score_total_points": null, "z_score_new_count": null, "z_score_removed_count": null, "anomaly_flags": [], "is_baseline": false},
          {"id": "s2", "snapshot_date": "2026-07-20", "vertical_id": "fuel_station", "total_points": 100, "completed_points": 80, "completion_rate": 0.8, "new_count": 1, "removed_count": 0, "changed_count": 0, "unchanged_count": 99, "avg_price": null, "week_over_week_growth": null, "moving_avg_4w": null, "z_score_total_points": null, "z_score_new_count": null, "z_score_removed_count": null, "anomaly_flags": [], "is_baseline": false},
          {"id": "s3", "snapshot_date": "2026-07-13", "vertical_id": "pharmacy", "total_points": 50, "completed_points": 40, "completion_rate": 0.8, "new_count": 0, "removed_count": 0, "changed_count": 0, "unchanged_count": 50, "avg_price": null, "week_over_week_growth": null, "moving_avg_4w": null, "z_score_total_points": null, "z_score_new_count": null, "z_score_removed_count": null, "anomaly_flags": [], "is_baseline": true}
        ]
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let breakdown = try await repository.categoryBreakdown(organizationId: "org_1")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "snapshots")

        XCTAssertEqual(breakdown.count, 2)
        let pharmacy = try XCTUnwrap(breakdown.first { $0.category == "pharmacy" })
        XCTAssertEqual(pharmacy.count, 300, "must use the latest (2026-07-20) row, not the stale 50-point row")
        XCTAssertEqual(pharmacy.percentage, 75.0, accuracy: 0.001)
        let fuel = try XCTUnwrap(breakdown.first { $0.category == "fuel_station" })
        XCTAssertEqual(fuel.count, 100)
        XCTAssertEqual(fuel.percentage, 25.0, accuracy: 0.001)
    }

    // MARK: - agentPerformance -> GET api/leaderboard (no view param), field mapping

    func testAgentPerformanceHitsLeaderboardEndpointAndMapsFields() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        [
          {
            "rank": 1, "userId": "em***", "name": "Emmanuel T.", "xp": 3200, "contributions": 44,
            "lastContributionAt": "2026-07-23T10:00:00.000Z", "lastLocation": "GPS 4.05, 9.71",
            "averageQualityScore": 87, "rankingScore": 3828, "verticalBreakdown": {"pharmacy": 30}
          }
        ]
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let performance = try await repository.agentPerformance(organizationId: "org_1")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.url?.path, "/api/leaderboard")
        XCTAssertNil(JSONFixture.queryParams(request)["view"])

        XCTAssertEqual(performance.count, 1)
        XCTAssertEqual(performance[0].userId, "em***")
        XCTAssertEqual(performance[0].submissions, 44)
        XCTAssertEqual(performance[0].approvalRate, 0.87, accuracy: 0.001)
        XCTAssertEqual(performance[0].flags, 0)
        XCTAssertEqual(performance[0].trustScore, 87)
    }

    // MARK: - spatialIntelligence -> view=spatial_intelligence, requires vertical, unwraps `cells`

    func testSpatialIntelligenceSendsVerticalAndUnwrapsCellsEnvelope() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "snapshotDate": "2026-07-20", "verticalId": "pharmacy", "totalCells": 1, "totalPoints": 24,
          "narrative": "One standout cell.",
          "cells": [
            {
              "cellId": "9q8yy", "verticalId": "pharmacy", "snapshotDate": "2026-07-20",
              "center": {"latitude": 4.05, "longitude": 9.71},
              "totalPoints": 24, "completedPoints": 18, "completionRate": 0.75,
              "avgConfidenceScore": 82.0, "photoCoverageRate": 0.9, "recentActivityRate": 0.5,
              "medianFreshnessDays": 6.0, "publishableChangeCount": 3, "newCount": 2, "removedCount": 0,
              "changedCount": 1, "operatorDiversity": 4, "marketSignalScore": 71.2, "opportunityScore": 88.4,
              "coverageGapScore": 12.1, "changeSignalScore": 40.0, "drivers": [], "caveats": [],
              "summary": "9q8yy stands out."
            }
          ]
        }
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let cells = try await repository.spatialIntelligence(organizationId: "org_1", vertical: "pharmacy")

        let request = try XCTUnwrap(transport.lastRequest)
        let query = JSONFixture.queryParams(request)
        XCTAssertEqual(query["view"], "spatial_intelligence")
        XCTAssertEqual(query["vertical"], "pharmacy")

        XCTAssertEqual(cells.count, 1)
        XCTAssertEqual(cells[0].cellId, "9q8yy")
        XCTAssertEqual(cells[0].opportunityScore, 88.4)
    }

    // MARK: - heatMapData -> derived from spatialIntelligence cells

    func testHeatMapDataDerivesFromSpatialIntelligenceCells() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "snapshotDate": "2026-07-20", "verticalId": "pharmacy", "totalCells": 1, "totalPoints": 24,
          "narrative": "",
          "cells": [
            {
              "cellId": "9q8yy", "verticalId": "pharmacy", "snapshotDate": "2026-07-20",
              "center": {"latitude": 4.05, "longitude": 9.71},
              "totalPoints": 24, "completedPoints": 18, "completionRate": 0.75,
              "avgConfidenceScore": 82.0, "photoCoverageRate": 0.9, "recentActivityRate": 0.5,
              "medianFreshnessDays": 6.0, "publishableChangeCount": 3, "newCount": 2, "removedCount": 0,
              "changedCount": 1, "operatorDiversity": 4, "marketSignalScore": 71.2, "opportunityScore": 88.4,
              "coverageGapScore": 12.1, "changeSignalScore": 40.0, "drivers": [], "caveats": [],
              "summary": ""
            }
          ]
        }
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let cells = try await repository.heatMapData(organizationId: "org_1", vertical: "pharmacy")

        XCTAssertEqual(cells.count, 1)
        XCTAssertEqual(cells[0].geohash, "9q8yy")
        XCTAssertEqual(cells[0].latitude, 4.05)
        XCTAssertEqual(cells[0].longitude, 9.71)
        XCTAssertEqual(cells[0].intensity, 88.4, "intensity derives from opportunityScore")
    }

    // MARK: - anomalies -> view=anomalies, no server-side filter params, client-side `since` filter

    func testAnomaliesFetchesAllAndFiltersClientSideBySince() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        [
          {"snapshot_date": "2026-07-20", "vertical_id": "pharmacy", "total_points": 300, "anomaly_flags": [{"metric": "total_points", "zScore": 3.2, "direction": "increase"}]},
          {"snapshot_date": "2026-06-01", "vertical_id": "fuel_station", "total_points": 90, "anomaly_flags": [{"metric": "removed_count", "zScore": -2.5, "direction": "decrease"}]}
        ]
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        var components = DateComponents()
        components.year = 2026
        components.month = 7
        components.day = 1
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let since = try XCTUnwrap(calendar.date(from: components))

        let anomalies = try await repository.anomalies(organizationId: "org_1", since: since)

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "anomalies")
        XCTAssertNil(JSONFixture.queryParams(request)["since"], "the real endpoint takes no filter params; since is applied client-side")

        XCTAssertEqual(anomalies.count, 1)
        XCTAssertEqual(anomalies[0].verticalId, "pharmacy")
    }

    // MARK: - aiQuery -> POST api/ai/search?view=analytics-query, body { question }

    func testAiQuerySendsQuestionBodyToAnalyticsQueryView() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "answer": "Pharmacy coverage grew 12% this week.",
          "facts": [],
          "caveats": [],
          "suggestedNextValidations": [],
          "confidence": 0.8,
          "modelMetadata": {"provider": "google", "model": "gemini-1.5-flash", "modelVersion": null, "promptVersion": "analytics-query-v1", "confidence": 0.8}
        }
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let response = try await repository.aiQuery(organizationId: "org_1", query: "How is pharmacy coverage trending?")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.url?.path, "/api/ai/search")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "analytics-query")
        let body = try JSONFixture.bodyObject(request)
        XCTAssertEqual(body["question"] as? String, "How is pharmacy coverage trending?")
        XCTAssertNil(body["organizationId"], "organizationId is not part of the real request schema")

        XCTAssertEqual(response.confidence, 0.8)
        XCTAssertEqual(response.modelMetadata.provider, "google")
        XCTAssertNil(response.modelMetadata.modelVersion)
    }
}
