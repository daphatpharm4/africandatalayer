import XCTest

final class RecoveryAccessibilityUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunchShowsAccessibleContent() {
        let app = XCUIApplication()
        app.launchArguments = ["-hasCompletedADLOnboarding", "YES"]
        app.launch()
        XCTAssertTrue(app.buttons["Open company console"].waitForExistence(timeout: 5))
    }
}
