import XCTest

final class PermissionUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testAppLaunchesWithoutCrashing() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.otherElements.firstMatch.exists)
    }
}
