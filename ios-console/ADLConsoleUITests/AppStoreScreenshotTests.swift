import XCTest

final class AppStoreScreenshotTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testAppLaunchesForScreenshot() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting", "YES"]
        app.launch()
        XCTAssertTrue(app.otherElements.firstMatch.exists)
    }
}
