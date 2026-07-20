@testable import ADLConsole
import ConsoleModels
import XCTest

final class ConsoleOverviewContentTests: XCTestCase {
    func testCollectorGetsCaptureOnOverview() {
        XCTAssertEqual(ConsoleOverviewContent.content(for: .collector), .capture)
    }

    func testEveryOtherRoleGetsSummaryOnOverview() {
        for role in PlatformRole.allCases where role != .collector {
            XCTAssertEqual(
                ConsoleOverviewContent.content(for: role),
                .summary,
                "expected .summary for \(role)"
            )
        }
    }
}
