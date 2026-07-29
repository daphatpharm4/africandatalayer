@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers `AgentPerformanceViewModel`: loads the client-composed per-agent
/// performance list (`AnalyticsRepositoryProtocol.agentPerformance` — a proxy
/// built from the public leaderboard's `averageQualityScore`, see
/// `AgentPerformance`'s doc comment in `ConsoleModels`), surfaces a friendly
/// error on repository failure instead of crashing, re-fetches on
/// `refresh()`, and sorts by submission count vs. quality (`trustScore`) on
/// demand. Reuses `MockAnalyticsRepository` from
/// `DeltaDashboardViewModelTests.swift` (same test target).
@MainActor
final class AgentPerformanceViewModelTests: XCTestCase {
    private func makeAgent(
        id: String,
        name: String,
        submissions: Int,
        approvalRate: Double = 0.8,
        trustScore: Double
    ) -> AgentPerformance {
        AgentPerformance(
            userId: id,
            displayName: name,
            submissions: submissions,
            approvalRate: approvalRate,
            flags: 0,
            trustScore: trustScore
        )
    }

    private func makeViewModel(repository: MockAnalyticsRepository) -> AgentPerformanceViewModel {
        AgentPerformanceViewModel(repository: repository, organizationId: "o1", language: .en)
    }

    // MARK: - Load populates agent state

    func testLoadPopulatesAgentState() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "Amina", submissions: 120, trustScore: 90),
            makeAgent(id: "u2", name: "Jean", submissions: 80, trustScore: 70),
        ])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.agents.count, 2)
        XCTAssertNil(viewModel.loadErrorMessage)
    }

    func testLoadWithEmptyAgentsMarksIsEmptyTrue() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertTrue(viewModel.isEmpty)
        XCTAssertEqual(viewModel.totalAgents, 0)
        XCTAssertEqual(viewModel.totalSubmissions, 0)
    }

    // MARK: - Repository error -> error state, not a crash

    func testLoadFailureSurfacesErrorState() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .failure(PlatformAPIError(message: "Service unavailable", status: 503))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        guard case .failed(let message) = viewModel.loadState else {
            return XCTFail("expected .failed load state, got \(viewModel.loadState)")
        }
        XCTAssertFalse(message.isEmpty)
        XCTAssertTrue(viewModel.agents.isEmpty)
    }

    func test4xxErrorSurfacesTheServerMessageVerbatim() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .failure(PlatformAPIError(message: "Not authorized for this organization", status: 403))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadErrorMessage, "Not authorized for this organization")
    }

    func test5xxErrorSurfacesAFriendlyFallbackMessage() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .failure(PlatformAPIError(message: "internal error", status: 500))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertNotEqual(viewModel.loadErrorMessage, "internal error")
        XCTAssertFalse(viewModel.loadErrorMessage!.isEmpty)
    }

    // MARK: - Refresh re-fetches

    func testRefreshReFetchesAndReplacesState() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([makeAgent(id: "u1", name: "Amina", submissions: 120, trustScore: 90)])
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()
        XCTAssertEqual(viewModel.agents.count, 1)

        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "Amina", submissions: 120, trustScore: 90),
            makeAgent(id: "u2", name: "Jean", submissions: 80, trustScore: 70),
        ])
        await viewModel.refresh()

        XCTAssertEqual(viewModel.agents.count, 2)
        XCTAssertEqual(repository.agentPerformanceCallCount, 2)
    }

    func testRefreshRecoversFromAPriorFailure() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .failure(PlatformAPIError(message: "boom", status: 500))
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()
        guard case .failed = viewModel.loadState else {
            return XCTFail("expected initial .failed load state")
        }

        repository.agentPerformanceResult = .success([makeAgent(id: "u1", name: "Amina", submissions: 120, trustScore: 90)])
        await viewModel.refresh()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertNil(viewModel.loadErrorMessage)
        XCTAssertEqual(viewModel.agents.count, 1)
    }

    // MARK: - Derived summary state

    func testTotalSubmissionsSumsAcrossAgents() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "Amina", submissions: 120, trustScore: 90),
            makeAgent(id: "u2", name: "Jean", submissions: 80, trustScore: 70),
        ])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.totalAgents, 2)
        XCTAssertEqual(viewModel.totalSubmissions, 200)
    }

    func testAverageTrustScoreIsMeanAcrossAgents() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "Amina", submissions: 120, trustScore: 90),
            makeAgent(id: "u2", name: "Jean", submissions: 80, trustScore: 70),
        ])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.averageTrustScore, 80, accuracy: 0.001)
    }

    func testAverageTrustScoreIsZeroWhenEmpty() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.averageTrustScore, 0)
    }

    // MARK: - Sort logic

    func testDefaultSortIsBySubmissionsDescending() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "Low subs, high quality", submissions: 20, trustScore: 99),
            makeAgent(id: "u2", name: "High subs, low quality", submissions: 200, trustScore: 40),
            makeAgent(id: "u3", name: "Mid subs, mid quality", submissions: 100, trustScore: 70),
        ])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.sortOption, .submissions)
        XCTAssertEqual(viewModel.agents.map(\.userId), ["u2", "u3", "u1"])
    }

    func testSwitchingToQualitySortOrdersByTrustScoreDescending() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "Low subs, high quality", submissions: 20, trustScore: 99),
            makeAgent(id: "u2", name: "High subs, low quality", submissions: 200, trustScore: 40),
            makeAgent(id: "u3", name: "Mid subs, mid quality", submissions: 100, trustScore: 70),
        ])
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()

        viewModel.sortOption = .quality

        XCTAssertEqual(viewModel.agents.map(\.userId), ["u1", "u3", "u2"])
    }

    func testSwitchingBackToSubmissionsRestoresSubmissionOrder() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "Low subs, high quality", submissions: 20, trustScore: 99),
            makeAgent(id: "u2", name: "High subs, low quality", submissions: 200, trustScore: 40),
        ])
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()

        viewModel.sortOption = .quality
        viewModel.sortOption = .submissions

        XCTAssertEqual(viewModel.agents.map(\.userId), ["u2", "u1"])
    }

    func testSortOptionAppliesImmediatelyEvenWithoutReload() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "A", submissions: 10, trustScore: 99),
            makeAgent(id: "u2", name: "B", submissions: 90, trustScore: 10),
        ])
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()
        XCTAssertEqual(viewModel.agents.map(\.userId), ["u2", "u1"])

        viewModel.sortOption = .quality
        // No refresh()/load() call in between -- sort re-applies to already-loaded data.
        XCTAssertEqual(viewModel.agents.map(\.userId), ["u1", "u2"])
    }

    func testTieBreaksBySubmissionSortFallBackToDisplayNameForDeterminism() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "Zed", submissions: 50, trustScore: 50),
            makeAgent(id: "u2", name: "Amina", submissions: 50, trustScore: 50),
        ])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.agents.map(\.userId), ["u2", "u1"])
    }

    // MARK: - Custom initial sort option

    func testInitialSortOptionCanBeConfiguredToQuality() async {
        let repository = MockAnalyticsRepository()
        repository.agentPerformanceResult = .success([
            makeAgent(id: "u1", name: "Low subs, high quality", submissions: 20, trustScore: 99),
            makeAgent(id: "u2", name: "High subs, low quality", submissions: 200, trustScore: 40),
        ])
        let viewModel = AgentPerformanceViewModel(
            repository: repository,
            organizationId: "o1",
            language: .en,
            sortOption: .quality
        )

        await viewModel.load()

        XCTAssertEqual(viewModel.sortOption, .quality)
        XCTAssertEqual(viewModel.agents.map(\.userId), ["u1", "u2"])
    }
}
