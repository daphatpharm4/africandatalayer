@testable import ADLConsole
import ConsoleModels
import XCTest

/// Asserts `AnalyticsTab.visibleTabs(role:)` against the analytics-
/// intelligence design spec's role matrix (docs/superpowers/specs/
/// 2026-07-24-ios-console-analytics-intelligence-design.md):
///   owner/manager -> all six tabs
///   reviewer      -> Delta Dashboard + Agent Performance (map access comes
///                    from the separate `.map` console destination)
///   collector     -> Agent Performance only ("their own performance";
///                    map access likewise comes from `.map`)
///   viewer        -> none (not in the spec's matrix; the `.analytics`
///                    console destination itself is gated out for viewer in
///                    `canAccessConsoleScreen`, so this is unreachable in
///                    practice but defined for completeness)
final class AnalyticsTabTests: XCTestCase {
    func testOwnerSeesAllTabs() {
        XCTAssertEqual(AnalyticsTab.visibleTabs(role: .owner), AnalyticsTab.allCases)
    }

    func testManagerSeesAllTabs() {
        XCTAssertEqual(AnalyticsTab.visibleTabs(role: .manager), AnalyticsTab.allCases)
    }

    func testReviewerSeesDeltaAndAgentPerformanceOnly() {
        XCTAssertEqual(
            Set(AnalyticsTab.visibleTabs(role: .reviewer)),
            [.deltaDashboard, .agentPerformance]
        )
    }

    func testCollectorSeesAgentPerformanceOnly() {
        XCTAssertEqual(AnalyticsTab.visibleTabs(role: .collector), [.agentPerformance])
    }

    func testViewerSeesNoTabs() {
        XCTAssertEqual(AnalyticsTab.visibleTabs(role: .viewer), [])
    }

    func testEveryRoleExceptViewerSeesAgentPerformance() {
        for role in PlatformRole.allCases where role != .viewer {
            XCTAssertTrue(
                AnalyticsTab.visibleTabs(role: role).contains(.agentPerformance),
                "role=\(role) must see Agent Performance"
            )
        }
    }

    func testInvestorAndCategoryAndExportAndAIAssistantAreOwnerManagerOnly() {
        let restrictedTabs: [AnalyticsTab] = [.investorDashboard, .categoryBreakdown, .export, .aiAssistant]
        for role in PlatformRole.allCases where role != .owner && role != .manager {
            let visible = Set(AnalyticsTab.visibleTabs(role: role))
            for tab in restrictedTabs {
                XCTAssertFalse(visible.contains(tab), "role=\(role) must not see \(tab)")
            }
        }
    }

    func testAllCasesHasSixTabs() {
        XCTAssertEqual(AnalyticsTab.allCases.count, 6)
    }
}
