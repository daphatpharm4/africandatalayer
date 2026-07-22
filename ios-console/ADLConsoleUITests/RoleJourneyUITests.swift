import XCTest

final class RoleJourneyUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testFrenchOfflineCollectorCanSeePendingWork() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTestRole", "collector", "-uiTestLocale", "fr", "-uiTestConnectivity", "offline", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Hors ligne"].waitForExistence(timeout: 5))
    }
}
