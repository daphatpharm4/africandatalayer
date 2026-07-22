import XCTest

final class PermissionUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAppLaunchesWithoutCrashing() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.otherElements.firstMatch.exists)
    }
}
