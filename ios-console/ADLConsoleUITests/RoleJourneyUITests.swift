import XCTest

final class RoleJourneyUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testFrenchOfflineCollectorCanSeePendingWork() {
        let app = XCUIApplication()
        app.launchArguments = ["-hasCompletedADLOnboarding", "YES", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launchEnvironment = [
            "ADL_UI_TEST_MODE": "1",
            "ADL_UI_TEST_ROLE": "collector",
            "ADL_UI_TEST_LOCALE": "fr",
            "ADL_UI_TEST_CONNECTIVITY": "offline",
        ]
        app.launch()
        let syncStatus = app.staticTexts["console-sync-status"]
        XCTAssertTrue(syncStatus.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertEqual(syncStatus.label, "Hors ligne")
    }
}
