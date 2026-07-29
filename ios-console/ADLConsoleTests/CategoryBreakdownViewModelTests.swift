@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers `CategoryBreakdownViewModel`: loads the client-composed
/// per-vertical share-of-points breakdown, surfaces a friendly error on
/// repository failure instead of crashing, re-fetches on `refresh()`, and
/// derives the pie/bar fallback threshold and percentage-sum sanity check.
/// Reuses `MockAnalyticsRepository` from `DeltaDashboardViewModelTests.swift`
/// (same test target).
@MainActor
final class CategoryBreakdownViewModelTests: XCTestCase {
    private func makeBreakdown(_ pairs: [(String, Int, Double)]) -> [CategoryBreakdown] {
        pairs.map { CategoryBreakdown(category: $0.0, count: $0.1, percentage: $0.2) }
    }

    private func makeViewModel(repository: MockAnalyticsRepository) -> CategoryBreakdownViewModel {
        CategoryBreakdownViewModel(repository: repository, organizationId: "o1", language: .en)
    }

    // MARK: - Load populates breakdown state

    func testLoadPopulatesBreakdownState() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .success(makeBreakdown([
            ("pharmacy", 620, 41.3),
            ("fuel_station", 410, 27.3),
        ]))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.breakdown.count, 2)
        XCTAssertEqual(viewModel.breakdown.first?.category, "pharmacy")
        XCTAssertNil(viewModel.loadErrorMessage)
    }

    func testLoadWithEmptyBreakdownMarksIsEmptyTrue() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .success([])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertTrue(viewModel.isEmpty)
        XCTAssertEqual(viewModel.totalCount, 0)
    }

    // MARK: - Repository error -> error state, not a crash

    func testLoadFailureSurfacesErrorState() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .failure(PlatformAPIError(message: "Service unavailable", status: 503))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        guard case .failed(let message) = viewModel.loadState else {
            return XCTFail("expected .failed load state, got \(viewModel.loadState)")
        }
        XCTAssertFalse(message.isEmpty)
        XCTAssertTrue(viewModel.breakdown.isEmpty)
    }

    func test4xxErrorSurfacesTheServerMessageVerbatim() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .failure(PlatformAPIError(message: "Not authorized for this organization", status: 403))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadErrorMessage, "Not authorized for this organization")
    }

    func test5xxErrorSurfacesAFriendlyFallbackMessage() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .failure(PlatformAPIError(message: "internal error", status: 500))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertNotEqual(viewModel.loadErrorMessage, "internal error")
        XCTAssertFalse(viewModel.loadErrorMessage!.isEmpty)
    }

    // MARK: - Refresh re-fetches

    func testRefreshReFetchesAndReplacesState() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .success(makeBreakdown([("pharmacy", 620, 41.3)]))
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()
        XCTAssertEqual(viewModel.breakdown.count, 1)

        repository.categoryBreakdownResult = .success(makeBreakdown([
            ("pharmacy", 620, 41.3),
            ("fuel_station", 410, 27.3),
            ("mobile_money", 250, 16.7),
        ]))
        await viewModel.refresh()

        XCTAssertEqual(viewModel.breakdown.count, 3)
        XCTAssertEqual(repository.categoryBreakdownCallCount, 2)
    }

    func testRefreshRecoversFromAPriorFailure() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .failure(PlatformAPIError(message: "boom", status: 500))
        let viewModel = makeViewModel(repository: repository)
        await viewModel.load()
        guard case .failed = viewModel.loadState else {
            return XCTFail("expected initial .failed load state")
        }

        repository.categoryBreakdownResult = .success(makeBreakdown([("pharmacy", 620, 41.3)]))
        await viewModel.refresh()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertNil(viewModel.loadErrorMessage)
        XCTAssertEqual(viewModel.breakdown.count, 1)
    }

    // MARK: - Derived state: totals, percentage sum sanity, pie/bar fallback

    func testTotalCountSumsCountsAcrossCategories() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .success(makeBreakdown([
            ("pharmacy", 620, 41.3),
            ("fuel_station", 410, 27.3),
            ("mobile_money", 470, 31.4),
        ]))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.totalCount, 1500)
    }

    func testPercentageSumIsCloseToOneHundredForAFullBreakdown() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .success(makeBreakdown([
            ("pharmacy", 620, 41.3),
            ("fuel_station", 410, 27.3),
            ("mobile_money", 470, 31.4),
        ]))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.percentageSum, 100.0, accuracy: 1.0)
    }

    func testUseBarFallbackIsFalseAtOrBelowThePieLabelingThreshold() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .success(makeBreakdown(
            (1...CategoryBreakdownViewModel.pieLabelingThreshold).map { ("vertical_\($0)", 10, 10.0) }
        ))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertFalse(viewModel.useBarFallback)
    }

    func testUseBarFallbackIsTrueAboveThePieLabelingThreshold() async {
        let repository = MockAnalyticsRepository()
        repository.categoryBreakdownResult = .success(makeBreakdown(
            (1...(CategoryBreakdownViewModel.pieLabelingThreshold + 1)).map { ("vertical_\($0)", 10, 10.0) }
        ))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertTrue(viewModel.useBarFallback)
    }
}
