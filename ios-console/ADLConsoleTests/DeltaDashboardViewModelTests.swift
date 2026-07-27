@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers `DeltaDashboardViewModel`: loads the KPI snapshot + weekly trend
/// series in parallel, surfaces a friendly error on repository failure
/// instead of crashing, and re-fetches on `refresh()`. Mocks
/// `AnalyticsRepositoryProtocol` directly (rather than routing through a
/// fake `PlatformTransport`) since the repository is the seam this
/// view-model actually depends on.
@MainActor
final class DeltaDashboardViewModelTests: XCTestCase {
    private func makeSnapshot(
        totalPoints: Int = 1500,
        verifiedPoints: Int = 900,
        verificationRatePct: Double = 60,
        pendingReview: Int = 8,
        highRiskEvents: Int = 3,
        weeklyActiveContributors: Int = 15
    ) -> DeltaSnapshot {
        DeltaSnapshot(
            generatedAt: "2026-07-24T12:00:00.000Z",
            weeklyActiveContributors: weeklyActiveContributors,
            verification: KpiVerification(
                totalPoints: totalPoints,
                verifiedPoints: verifiedPoints,
                verificationRatePct: verificationRatePct
            ),
            freshness: KpiFreshness(medianAgeDays: 3.5, avgAgeDays: 5.2),
            fraud: KpiFraud(eventsWithFraudCheck: 400, mismatchEvents: 8, fraudRatePct: 2.0),
            reviewQueue: KpiReviewQueue(pendingReview: pendingReview, highRiskEvents: highRiskEvents),
            enrichmentRatePct: 42.5
        )
    }

    private func makeTrends(count: Int = 1) -> [WeeklyTrend] {
        (0..<count).map { index in
            WeeklyTrend(date: "2026-07-\(10 + index)", value: Double(100 + index), movingAvg: nil)
        }
    }

    private func makeViewModel(repository: MockAnalyticsRepository) -> DeltaDashboardViewModel {
        DeltaDashboardViewModel(
            repository: repository,
            organizationId: "o1",
            language: .en
        )
    }

    // MARK: - Load populates KPI + trends state

    func testLoadPopulatesKpiAndTrendsState() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot(totalPoints: 1500))
        repository.weeklyTrendsResult = .success(makeTrends(count: 1))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.snapshot?.verification.totalPoints, 1500)
        XCTAssertEqual(viewModel.trends.count, 1)
        XCTAssertNil(viewModel.loadErrorMessage)
    }

    func testLoadRequestsTrendsForTheConfiguredVerticalMetricAndWeeks() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot())
        repository.weeklyTrendsResult = .success(makeTrends())
        let viewModel = DeltaDashboardViewModel(
            repository: repository,
            organizationId: "o1",
            language: .en,
            vertical: "fuel_station",
            trendMetric: "total_points",
            trendWeeks: 8
        )

        await viewModel.load()

        XCTAssertEqual(repository.weeklyTrendsCalls.count, 1)
        XCTAssertEqual(repository.weeklyTrendsCalls.first?.vertical, "fuel_station")
        XCTAssertEqual(repository.weeklyTrendsCalls.first?.metric, "total_points")
        XCTAssertEqual(repository.weeklyTrendsCalls.first?.weeks, 8)
    }

    // MARK: - Repository error -> error state, not a crash

    func testLoadFailureFromDeltaSnapshotSurfacesErrorState() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .failure(PlatformAPIError(message: "Service unavailable", status: 503))
        repository.weeklyTrendsResult = .success(makeTrends())
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        guard case .failed(let message) = viewModel.loadState else {
            return XCTFail("expected .failed load state, got \(viewModel.loadState)")
        }
        XCTAssertFalse(message.isEmpty)
        XCTAssertEqual(viewModel.loadErrorMessage, message)
        XCTAssertNil(viewModel.snapshot)
        XCTAssertTrue(viewModel.trends.isEmpty)
    }

    func testLoadFailureFromWeeklyTrendsSurfacesErrorStateWithoutCrashing() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot())
        repository.weeklyTrendsResult = .failure(PlatformAPIError(message: "boom", status: 500))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        guard case .failed = viewModel.loadState else {
            return XCTFail("expected .failed load state, got \(viewModel.loadState)")
        }
    }

    func test4xxErrorSurfacesTheServerMessageVerbatim() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .failure(PlatformAPIError(message: "Not authorized for this organization", status: 403))
        repository.weeklyTrendsResult = .success(makeTrends())
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadErrorMessage, "Not authorized for this organization")
    }

    // MARK: - Refresh re-fetches

    func testRefreshReFetchesAndReplacesState() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot(totalPoints: 1500))
        repository.weeklyTrendsResult = .success(makeTrends(count: 1))
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()
        XCTAssertEqual(viewModel.snapshot?.verification.totalPoints, 1500)

        repository.deltaSnapshotResult = .success(makeSnapshot(totalPoints: 2000))
        repository.weeklyTrendsResult = .success(makeTrends(count: 3))
        await viewModel.refresh()

        XCTAssertEqual(viewModel.snapshot?.verification.totalPoints, 2000)
        XCTAssertEqual(viewModel.trends.count, 3)
        XCTAssertEqual(repository.deltaSnapshotCallCount, 2)
        XCTAssertEqual(repository.weeklyTrendsCalls.count, 2)
    }

    func testRefreshRecoversFromAPriorFailure() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .failure(PlatformAPIError(message: "boom", status: 500))
        repository.weeklyTrendsResult = .success(makeTrends())
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()
        guard case .failed = viewModel.loadState else {
            return XCTFail("expected initial .failed load state")
        }

        repository.deltaSnapshotResult = .success(makeSnapshot(totalPoints: 42))
        await viewModel.refresh()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.snapshot?.verification.totalPoints, 42)
        XCTAssertNil(viewModel.loadErrorMessage)
    }
}

/// Test double for `AnalyticsRepositoryProtocol` — records calls and returns
/// canned `Result`s, so `DeltaDashboardViewModel` tests never touch
/// `PlatformAPIClient`/networking. Only the methods this task's view-model
/// consumes (`deltaSnapshot`, `weeklyTrends`) are exercised; the rest return
/// empty/error stand-ins.
final class MockAnalyticsRepository: AnalyticsRepositoryProtocol, @unchecked Sendable {
    struct WeeklyTrendsCall: Equatable {
        let organizationId: String
        let vertical: String
        let metric: String
        let weeks: Int
    }

    var deltaSnapshotResult: Result<DeltaSnapshot, Error> = .failure(PlatformAPIError(message: "unset", status: 500))
    var weeklyTrendsResult: Result<[WeeklyTrend], Error> = .success([])
    var categoryBreakdownResult: Result<[CategoryBreakdown], Error> = .success([])
    var agentPerformanceResult: Result<[AgentPerformance], Error> = .success([])

    private(set) var deltaSnapshotCallCount = 0
    private(set) var weeklyTrendsCalls: [WeeklyTrendsCall] = []
    private(set) var categoryBreakdownCallCount = 0
    private(set) var agentPerformanceCallCount = 0

    func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot {
        deltaSnapshotCallCount += 1
        return try deltaSnapshotResult.get()
    }

    func weeklyTrends(organizationId: String, vertical: String, metric: String, weeks: Int) async throws -> [WeeklyTrend] {
        weeklyTrendsCalls.append(WeeklyTrendsCall(organizationId: organizationId, vertical: vertical, metric: metric, weeks: weeks))
        return try weeklyTrendsResult.get()
    }

    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown] {
        categoryBreakdownCallCount += 1
        return try categoryBreakdownResult.get()
    }

    func agentPerformance(organizationId: String) async throws -> [AgentPerformance] {
        agentPerformanceCallCount += 1
        return try agentPerformanceResult.get()
    }

    func spatialIntelligence(organizationId: String, vertical: String) async throws -> [GeohashScore] { [] }
    func anomalies(organizationId: String, since: Date) async throws -> [AnomalyFlag] { [] }
    func heatMapData(organizationId: String, vertical: String) async throws -> [HeatMapCell] { [] }

    func aiQuery(organizationId: String, query: String) async throws -> AIQueryResponse {
        AIQueryResponse(
            answer: "",
            facts: [],
            caveats: [],
            suggestedNextValidations: [],
            confidence: 0,
            modelMetadata: AiModelMetadata(provider: "mock", model: "mock", modelVersion: nil, promptVersion: "0", confidence: 0)
        )
    }
}
