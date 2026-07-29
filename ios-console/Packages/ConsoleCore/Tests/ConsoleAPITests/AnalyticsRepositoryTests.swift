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
        XCTAssertEqual(request.url?.path, "/api/user")
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_analytics")
        XCTAssertEqual(JSONFixture.queryParams(request)["organizationId"], "org_1")
        XCTAssertEqual(JSONFixture.queryParams(request)["section"], "snapshot")
        XCTAssertEqual(snapshot.weeklyActiveContributors, 15)
        XCTAssertEqual(snapshot.verification.verificationRatePct, 60.0)
    }

    // MARK: - weeklyTrends -> view=trends, requires vertical+metric+weeks, unwraps `data`

    func testWeeklyTrendsSendsVerticalMetricWeeksAndUnwrapsDataEnvelope() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        [
          {"date": "2026-07-13", "value": 80, "movingAvg": null},
          {"date": "2026-07-20", "value": 100, "movingAvg": 90.0}
        ]
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let trends = try await repository.weeklyTrends(organizationId: "org_1", vertical: "pharmacy", metric: "total_points", weeks: 8)

        let request = try XCTUnwrap(transport.lastRequest)
        let query = JSONFixture.queryParams(request)
        XCTAssertEqual(query["view"], "platform_analytics")
        XCTAssertEqual(query["organizationId"], "org_1")
        XCTAssertEqual(query["section"], "trends")
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
        transport.responseData = JSONFixture.data("""
        [
          {"category": "pharmacy", "count": 300, "percentage": 75},
          {"category": "fuel_station", "count": 100, "percentage": 25}
        ]
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let breakdown = try await repository.categoryBreakdown(organizationId: "org_1")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_analytics")
        XCTAssertEqual(JSONFixture.queryParams(request)["organizationId"], "org_1")
        XCTAssertEqual(JSONFixture.queryParams(request)["section"], "categories")

        XCTAssertEqual(breakdown.count, 2)
        let pharmacy = try XCTUnwrap(breakdown.first { $0.category == "pharmacy" })
        XCTAssertEqual(pharmacy.count, 300)
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
          {"userId": "em***", "displayName": "Emmanuel T.", "submissions": 44, "approvalRate": 0.87, "flags": 0, "trustScore": 87}
        ]
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let performance = try await repository.agentPerformance(organizationId: "org_1")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.url?.path, "/api/user")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_analytics")
        XCTAssertEqual(JSONFixture.queryParams(request)["organizationId"], "org_1")
        XCTAssertEqual(JSONFixture.queryParams(request)["section"], "agents")

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
        [
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
        """)
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        let cells = try await repository.spatialIntelligence(organizationId: "org_1", vertical: "pharmacy")

        let request = try XCTUnwrap(transport.lastRequest)
        let query = JSONFixture.queryParams(request)
        XCTAssertEqual(query["view"], "platform_analytics")
        XCTAssertEqual(query["organizationId"], "org_1")
        XCTAssertEqual(query["section"], "spatial")
        XCTAssertEqual(query["vertical"], "pharmacy")

        XCTAssertEqual(cells.count, 1)
        XCTAssertEqual(cells[0].cellId, "9q8yy")
        XCTAssertEqual(cells[0].opportunityScore, 88.4)
    }

    // MARK: - heatMapData -> derived from spatialIntelligence cells

    func testHeatMapDataDerivesFromSpatialIntelligenceCells() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        [
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
          {"snapshotDate": "2026-07-20", "verticalId": "pharmacy", "totalPoints": 300, "anomalyFlags": [{"metric": "total_points", "zScore": 3.2, "direction": "increase"}]},
          {"snapshotDate": "2026-06-01", "verticalId": "fuel_station", "totalPoints": 90, "anomalyFlags": [{"metric": "removed_count", "zScore": -2.5, "direction": "decrease"}]}
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
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_analytics")
        XCTAssertEqual(JSONFixture.queryParams(request)["organizationId"], "org_1")
        XCTAssertEqual(JSONFixture.queryParams(request)["section"], "anomalies")
        XCTAssertNil(JSONFixture.queryParams(request)["since"], "the real endpoint takes no filter params; since is applied client-side")

        XCTAssertEqual(anomalies.count, 1)
        XCTAssertEqual(anomalies[0].verticalId, "pharmacy")
    }

    // MARK: - AI analytics fails closed until scoped facts exist

    func testAiQueryDoesNotFallThroughToAdlWideAssistant() async throws {
        let transport = MockPlatformTransport()
        let repository = AnalyticsRepository(apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport))

        do {
            _ = try await repository.aiQuery(organizationId: "org_1", query: "How is pharmacy coverage trending?")
            XCTFail("Expected tenant-scoped AI to fail closed")
        } catch let error as PlatformAPIError {
            XCTAssertEqual(error.status, 403)
            XCTAssertEqual(error.code, "platform_analytics_ai_unavailable")
        }
        XCTAssertNil(transport.lastRequest)
    }
}
