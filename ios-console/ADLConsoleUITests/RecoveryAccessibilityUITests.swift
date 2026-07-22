import XCTest

final class RecoveryAccessibilityUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunchShowsAccessibleContent() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["Open company console"].waitForExistence(timeout: 5))
    }
}
