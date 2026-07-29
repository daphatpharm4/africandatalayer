import XCTest

final class RecoveryAccessibilityUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunchShowsAccessibleContent() {
        let app = XCUIApplication()
        app.launchArguments = ["-hasCompletedADLOnboarding", "YES"]
        app.launchEnvironment = [
            "ADL_UI_TEST_MODE": "1",
            "ADL_UI_TEST_LOCALE": "en",
        ]
        app.launch()
        XCTAssertTrue(
            app.buttons["auth-open-company-console"].waitForExistence(timeout: 5),
            app.debugDescription
        )
    }
}
