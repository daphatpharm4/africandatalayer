@testable import ADLConsole
import ConsolePersistence
import XCTest

final class OperationalStatusModelTests: XCTestCase {
    func testBlockedOutranksSatisfiedPath() {
        let user = AuthSessionUser(id: "u1", email: nil, role: "collector", isAdmin: false)
        let status = OperationalStatus.derive(
            path: .satisfied,
            session: .onlineVerified(user: user),
            ledger: .init(pending: 0, sending: 0, retrying: 0, blocked: 2, acknowledgedThisSession: 0),
            progress: nil
        )
        XCTAssertEqual(status, .blocked(count: 2))
    }
}
