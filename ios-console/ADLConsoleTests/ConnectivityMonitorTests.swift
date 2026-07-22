@testable import ADLConsole
import XCTest

final class ConnectivityMonitorTests: XCTestCase {
    func testInitialStateIsUnsatisfied() {
        let monitor = ConnectivityMonitor()
        XCTAssertEqual(monitor.state, .unsatisfied)
    }
}
