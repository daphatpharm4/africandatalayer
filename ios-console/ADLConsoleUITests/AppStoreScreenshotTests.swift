import XCTest

final class AppStoreScreenshotTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAppLaunchesForScreenshot() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "YES"]
        app.launch()
        XCTAssertTrue(app.otherElements.firstMatch.exists)
    }
}
