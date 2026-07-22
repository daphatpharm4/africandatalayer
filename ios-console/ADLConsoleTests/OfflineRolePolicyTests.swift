@testable import ADLConsole
import ConsoleModels
import XCTest

final class OfflineRolePolicyTests: XCTestCase {
    private let policy = OfflineRolePolicy()

    func testOfflineRoleMatrix() {
        let offline = SessionAvailability.offlineAuthorized(snapshot: .fixture(expiresAt: .distantFuture))
        XCTAssertTrue(policy.allows(.createLocalRecord, role: .collector, session: offline))
        XCTAssertTrue(policy.allows(.retryPendingRecord, role: .collector, session: offline))
        XCTAssertTrue(policy.allows(.inspectCachedReview, role: .reviewer, session: offline))
        XCTAssertFalse(policy.allows(.reviewMutation, role: .reviewer, session: offline))
        XCTAssertTrue(policy.allows(.inspectCachedAdministration, role: .manager, session: offline))
        XCTAssertFalse(policy.allows(.administrationMutation, role: .manager, session: offline))
        XCTAssertFalse(policy.allows(.createLocalRecord, role: .collector, session: .reauthenticationRequired(reason: .authorizationExpired)))
        XCTAssertTrue(policy.allows(.exportPendingRecord, role: .collector, session: .reauthenticationRequired(reason: .authorizationExpired)))
    }
}
