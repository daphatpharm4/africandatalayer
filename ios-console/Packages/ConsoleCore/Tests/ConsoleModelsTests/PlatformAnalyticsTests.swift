import XCTest
@testable import ConsoleModels

final class PlatformAnalyticsTests: XCTestCase {
    // MARK: - DeltaSnapshot (real `view=kpi_summary` shape)

    func testDeltaSnapshotDecodesRealKpiSummaryShape() throws {
        let json = """
        {
          "generatedAt": "2026-07-24T12:00:00.000Z",
          "weeklyActiveContributors": 15,
          "verification": {"totalPoints": 1500, "verifiedPoints": 900, "verificationRatePct": 60.0},
          "freshness": {"medianAgeDays": 3.5, "avgAgeDays": 5.2},
          "fraud": {"eventsWithFraudCheck": 400, "mismatchEvents": 8, "fraudRatePct": 2.0},
          "reviewQueue": {"pendingReview": 8, "highRiskEvents": 3},
          "enrichmentRatePct": 42.5
        }
        """.data(using: .utf8)!
        let snapshot = try JSONDecoder().decode(DeltaSnapshot.self, from: json)
        XCTAssertEqual(snapshot.weeklyActiveContributors, 15)
        XCTAssertEqual(snapshot.verification.totalPoints, 1500)
        XCTAssertEqual(snapshot.verification.verificationRatePct, 60.0)
        XCTAssertEqual(snapshot.freshness.medianAgeDays, 3.5)
        XCTAssertEqual(snapshot.fraud.fraudRatePct, 2.0)
        XCTAssertEqual(snapshot.reviewQueue.pendingReview, 8)
        XCTAssertEqual(snapshot.enrichmentRatePct, 42.5)
    }

    // MARK: - WeeklyTrend (real `view=trends` `data[]` item shape)

    func testWeeklyTrendDecodesRealTrendDataPointShape() throws {
        let json = """
        {"date":"2026-07-20","value":100,"movingAvg":92.5}
        """.data(using: .utf8)!
        let trend = try JSONDecoder().decode(WeeklyTrend.self, from: json)
        XCTAssertEqual(trend.date, "2026-07-20")
        XCTAssertEqual(trend.value, 100)
        XCTAssertEqual(trend.movingAvg, 92.5)
        XCTAssertEqual(trend.id, "2026-07-20")
    }

    func testWeeklyTrendDecodesNullMovingAvg() throws {
        let json = """
        {"date":"2026-07-20","value":100,"movingAvg":null}
        """.data(using: .utf8)!
        let trend = try JSONDecoder().decode(WeeklyTrend.self, from: json)
        XCTAssertNil(trend.movingAvg)
    }

    // MARK: - GeohashScore (real `view=spatial_intelligence` cell shape)

    func testGeohashScoreDecodesRealSpatialIntelligenceCellShape() throws {
        let json = """
        {
          "cellId": "9q8yy",
          "verticalId": "pharmacy",
          "snapshotDate": "2026-07-20",
          "center": {"latitude": 4.05, "longitude": 9.71},
          "totalPoints": 24,
          "completedPoints": 18,
          "completionRate": 0.75,
          "avgConfidenceScore": 82.0,
          "photoCoverageRate": 0.9,
          "recentActivityRate": 0.5,
          "medianFreshnessDays": 6.0,
          "publishableChangeCount": 3,
          "newCount": 2,
          "removedCount": 0,
          "changedCount": 1,
          "operatorDiversity": 4,
          "marketSignalScore": 71.2,
          "opportunityScore": 88.4,
          "coverageGapScore": 12.1,
          "changeSignalScore": 40.0,
          "drivers": [
            {"label": "Above-average density", "impact": "positive", "score": 85.0, "evidence": "24 mapped points in this cell"}
          ],
          "caveats": ["Photo coverage is limited at 45%."],
          "summary": "9q8yy stands out for pharmacy with 24 mapped points."
        }
        """.data(using: .utf8)!
        let cell = try JSONDecoder().decode(GeohashScore.self, from: json)
        XCTAssertEqual(cell.id, "9q8yy")
        XCTAssertEqual(cell.center.latitude, 4.05)
        XCTAssertEqual(cell.operatorDiversity, 4)
        XCTAssertEqual(cell.opportunityScore, 88.4)
        XCTAssertEqual(cell.drivers.count, 1)
        XCTAssertEqual(cell.drivers[0].impact, "positive")
        XCTAssertEqual(cell.caveats, ["Photo coverage is limited at 45%."])
    }

    // MARK: - AnomalyFlag (real `view=anomalies` row shape — nested + snake_case)

    func testAnomalyFlagDecodesRealSnakeCaseRowWithNestedFlags() throws {
        let json = """
        {
          "snapshot_date": "2026-07-20",
          "vertical_id": "fuel_station",
          "total_points": 340,
          "anomaly_flags": [
            {"metric": "total_points", "zScore": 3.2, "direction": "increase"},
            {"metric": "removed_count", "zScore": -2.1, "direction": "decrease"}
          ]
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let anomaly = try decoder.decode(AnomalyFlag.self, from: json)
        XCTAssertEqual(anomaly.snapshotDate, "2026-07-20")
        XCTAssertEqual(anomaly.verticalId, "fuel_station")
        XCTAssertEqual(anomaly.totalPoints, 340)
        XCTAssertEqual(anomaly.anomalyFlags.count, 2)
        XCTAssertEqual(anomaly.anomalyFlags[0].metric, "total_points")
        XCTAssertEqual(anomaly.anomalyFlags[0].zScore, 3.2)
        XCTAssertEqual(anomaly.anomalyFlags[0].direction, "increase")
        XCTAssertEqual(anomaly.id, "2026-07-20-fuel_station")
    }

    // MARK: - AIQueryResponse (real `AiAnalyticsResponse` shape)

    func testAIQueryResponseDecodesRealAiAnalyticsResponseShape() throws {
        let json = """
        {
          "answer": "Pharmacy coverage grew 12% this week.",
          "facts": [
            {"label": "Total pharmacy points", "value": 412, "source": "snapshot_stats"},
            {"label": "Top zone", "value": "Bonamoussadi", "source": "spatial_intelligence"}
          ],
          "caveats": ["Sample size is small in some zones."],
          "suggestedNextValidations": ["Cross-check with field agent notes."],
          "confidence": 0.82,
          "modelMetadata": {
            "provider": "google",
            "model": "gemini-1.5-flash",
            "modelVersion": "001",
            "promptVersion": "analytics-query-v1",
            "confidence": 0.82
          }
        }
        """.data(using: .utf8)!
        let response = try JSONDecoder().decode(AIQueryResponse.self, from: json)
        XCTAssertEqual(response.answer, "Pharmacy coverage grew 12% this week.")
        XCTAssertEqual(response.facts.count, 2)
        if case .number(let value) = response.facts[0].value {
            XCTAssertEqual(value, 412)
        } else {
            XCTFail("expected numeric fact value")
        }
        if case .string(let value) = response.facts[1].value {
            XCTAssertEqual(value, "Bonamoussadi")
        } else {
            XCTFail("expected string fact value")
        }
        XCTAssertEqual(response.confidence, 0.82)
        XCTAssertEqual(response.modelMetadata.provider, "google")
        XCTAssertEqual(response.modelMetadata.modelVersion, "001")
    }

    // MARK: - LeaderboardEntry (real `GET api/leaderboard` shape)

    func testLeaderboardEntryDecodesRealShape() throws {
        let json = """
        {
          "rank": 1,
          "userId": "em***",
          "name": "Emmanuel T.",
          "xp": 3200,
          "contributions": 44,
          "lastContributionAt": "2026-07-23T10:00:00.000Z",
          "lastLocation": "GPS 4.0500\\u00b0, 9.7100\\u00b0",
          "averageQualityScore": 87,
          "rankingScore": 3828,
          "verticalBreakdown": {"pharmacy": 30, "fuel_station": 14}
        }
        """.data(using: .utf8)!
        let entry = try JSONDecoder().decode(LeaderboardEntry.self, from: json)
        XCTAssertEqual(entry.rank, 1)
        XCTAssertEqual(entry.userId, "em***")
        XCTAssertEqual(entry.contributions, 44)
        XCTAssertEqual(entry.verticalBreakdown["pharmacy"], 30)
        XCTAssertEqual(entry.id, "em***")
    }

    // MARK: - Derived, client-composed models (round trip only — no server shape to defer to)

    func testCategoryBreakdownRoundTrips() throws {
        let breakdown = CategoryBreakdown(category: "pharmacy", count: 412, percentage: 34.5)
        let data = try JSONEncoder().encode(breakdown)
        let decoded = try JSONDecoder().decode(CategoryBreakdown.self, from: data)
        XCTAssertEqual(decoded, breakdown)
        XCTAssertEqual(decoded.id, "pharmacy")
    }

    func testAgentPerformanceRoundTrips() throws {
        let performance = AgentPerformance(
            userId: "em***",
            displayName: "Emmanuel T.",
            submissions: 44,
            approvalRate: 0.87,
            flags: 0,
            trustScore: 87
        )
        let data = try JSONEncoder().encode(performance)
        let decoded = try JSONDecoder().decode(AgentPerformance.self, from: data)
        XCTAssertEqual(decoded, performance)
        XCTAssertEqual(decoded.id, "em***")
    }

    func testHeatMapCellRoundTrips() throws {
        let cell = HeatMapCell(geohash: "9q8yy", latitude: 4.05, longitude: 9.71, intensity: 88.4)
        let data = try JSONEncoder().encode(cell)
        let decoded = try JSONDecoder().decode(HeatMapCell.self, from: data)
        XCTAssertEqual(decoded, cell)
    }
}
