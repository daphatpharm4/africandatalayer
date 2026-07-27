@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers `InvestorDashboardViewModel`: loads the KPI snapshot + agent
/// performance in parallel, surfaces a friendly error on repository failure
/// instead of crashing, re-fetches on `refresh()`, and derives the composite
/// trust score / fraud trend / trust-distribution bands correctly. Reuses
/// `MockAnalyticsRepository` from `DeltaDashboardViewModelTests.swift` (same
/// test target) since both view-models depend on the same repository seam.
@MainActor
final class InvestorDashboardViewModelTests: XCTestCase {
    private func makeSnapshot(
        verificationRatePct: Double = 78,
        fraudRatePct: Double = 2.0,
        medianAgeDays: Double = 3.5
    ) -> DeltaSnapshot {
        DeltaSnapshot(
            generatedAt: "2026-07-24T12:00:00.000Z",
            weeklyActiveContributors: 15,
            verification: KpiVerification(totalPoints: 1500, verifiedPoints: 900, verificationRatePct: verificationRatePct),
            freshness: KpiFreshness(medianAgeDays: medianAgeDays, avgAgeDays: 5.2),
            fraud: KpiFraud(eventsWithFraudCheck: 400, mismatchEvents: 8, fraudRatePct: fraudRatePct),
            reviewQueue: KpiReviewQueue(pendingReview: 8, highRiskEvents: 3),
            enrichmentRatePct: 42.5
        )
    }

    private func makeAgent(trustScore: Double) -> AgentPerformance {
        AgentPerformance(userId: UUID().uuidString, displayName: "Agent", submissions: 10, approvalRate: 0.8, flags: 0, trustScore: trustScore)
    }

    private func makeViewModel(repository: MockAnalyticsRepository) -> InvestorDashboardViewModel {
        InvestorDashboardViewModel(repository: repository, organizationId: "o1", language: .en)
    }

    // MARK: - Load populates snapshot + agent performance state

    func testLoadPopulatesSnapshotAndAgentPerformanceState() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot())
        repository.agentPerformanceResult = .success([makeAgent(trustScore: 90), makeAgent(trustScore: 40)])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.snapshot?.verification.verificationRatePct, 78)
        XCTAssertEqual(viewModel.agentPerformance.count, 2)
        XCTAssertNil(viewModel.loadErrorMessage)
    }

    // MARK: - Repository error -> error state, not a crash

    func testLoadFailureFromDeltaSnapshotSurfacesErrorState() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .failure(PlatformAPIError(message: "Service unavailable", status: 503))
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        guard case .failed(let message) = viewModel.loadState else {
            return XCTFail("expected .failed load state, got \(viewModel.loadState)")
        }
        XCTAssertFalse(message.isEmpty)
        XCTAssertNil(viewModel.snapshot)
        XCTAssertTrue(viewModel.agentPerformance.isEmpty)
    }

    func testLoadFailureFromAgentPerformanceSurfacesErrorStateWithoutCrashing() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot())
        repository.agentPerformanceResult = .failure(PlatformAPIError(message: "boom", status: 500))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        guard case .failed = viewModel.loadState else {
            return XCTFail("expected .failed load state, got \(viewModel.loadState)")
        }
    }

    func test4xxErrorSurfacesTheServerMessageVerbatim() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .failure(PlatformAPIError(message: "Not authorized for this organization", status: 403))
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadErrorMessage, "Not authorized for this organization")
    }

    // MARK: - Refresh re-fetches

    func testRefreshReFetchesAndReplacesState() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot(verificationRatePct: 78))
        repository.agentPerformanceResult = .success([makeAgent(trustScore: 90)])
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()
        XCTAssertEqual(viewModel.snapshot?.verification.verificationRatePct, 78)

        repository.deltaSnapshotResult = .success(makeSnapshot(verificationRatePct: 55))
        repository.agentPerformanceResult = .success([makeAgent(trustScore: 90), makeAgent(trustScore: 20)])
        await viewModel.refresh()

        XCTAssertEqual(viewModel.snapshot?.verification.verificationRatePct, 55)
        XCTAssertEqual(viewModel.agentPerformance.count, 2)
        XCTAssertEqual(repository.deltaSnapshotCallCount, 2)
    }

    func testRefreshRecoversFromAPriorFailure() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .failure(PlatformAPIError(message: "boom", status: 500))
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()
        guard case .failed = viewModel.loadState else {
            return XCTFail("expected initial .failed load state")
        }

        repository.deltaSnapshotResult = .success(makeSnapshot())
        await viewModel.refresh()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertNil(viewModel.loadErrorMessage)
    }

    // MARK: - Trust score derivation

    func testTrustScoreBlendsVerificationRateAndInverseFraudRate() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot(verificationRatePct: 80, fraudRatePct: 10))
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        // 0.6 * 80 + 0.4 * (100 - 10) = 48 + 36 = 84
        XCTAssertEqual(viewModel.trustScore, 84, accuracy: 0.001)
    }

    func testTrustScoreIsClampedToZeroToOneHundredRange() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot(verificationRatePct: 0, fraudRatePct: 200))
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertGreaterThanOrEqual(viewModel.trustScore, 0)
        XCTAssertLessThanOrEqual(viewModel.trustScore, 100)
    }

    func testTrustScoreIsZeroBeforeAnyLoad() {
        let repository = MockAnalyticsRepository()
        let viewModel = makeViewModel(repository: repository)

        XCTAssertEqual(viewModel.trustScore, 0)
    }

    // MARK: - Fraud trend derivation

    func testFraudTrendIsUnknownAfterFirstLoad() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot(fraudRatePct: 3.0))
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.fraudTrend, .unknown)
    }

    func testFraudTrendIsUpWhenFraudRateIncreasesOnRefresh() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot(fraudRatePct: 2.0))
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()

        repository.deltaSnapshotResult = .success(makeSnapshot(fraudRatePct: 5.0))
        await viewModel.refresh()

        XCTAssertEqual(viewModel.fraudTrend, .up)
    }

    func testFraudTrendIsDownWhenFraudRateDecreasesOnRefresh() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot(fraudRatePct: 5.0))
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()

        repository.deltaSnapshotResult = .success(makeSnapshot(fraudRatePct: 2.0))
        await viewModel.refresh()

        XCTAssertEqual(viewModel.fraudTrend, .down)
    }

    func testFraudTrendIsFlatWhenFraudRateIsUnchangedOnRefresh() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot(fraudRatePct: 2.0))
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()

        repository.deltaSnapshotResult = .success(makeSnapshot(fraudRatePct: 2.0))
        await viewModel.refresh()

        XCTAssertEqual(viewModel.fraudTrend, .flat)
    }

    // MARK: - Trust distribution derivation

    func testTrustDistributionAlwaysReturnsFiveBandsEvenWhenEmpty() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot())
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.trustDistribution.count, 5)
        XCTAssertEqual(viewModel.trustDistribution.reduce(0) { $0 + $1.agentCount }, 0)
    }

    func testTrustDistributionBucketsAgentsIntoTheCorrectBands() async {
        let repository = MockAnalyticsRepository()
        repository.deltaSnapshotResult = .success(makeSnapshot())
        repository.agentPerformanceResult = .success([
            makeAgent(trustScore: 5),   // 0-19
            makeAgent(trustScore: 25),  // 20-39
            makeAgent(trustScore: 45),  // 40-59
            makeAgent(trustScore: 65),  // 60-79
            makeAgent(trustScore: 95),  // 80-100
            makeAgent(trustScore: 100), // 80-100
        ])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        let counts = viewModel.trustDistribution.reduce(into: [String: Int]()) { $0[$1.label] = $1.agentCount }
        XCTAssertEqual(counts["0-19"], 1)
        XCTAssertEqual(counts["20-39"], 1)
        XCTAssertEqual(counts["40-59"], 1)
        XCTAssertEqual(counts["60-79"], 1)
        XCTAssertEqual(counts["80-100"], 2)
        XCTAssertEqual(viewModel.trustDistribution.reduce(0) { $0 + $1.agentCount }, 6)
    }
}
