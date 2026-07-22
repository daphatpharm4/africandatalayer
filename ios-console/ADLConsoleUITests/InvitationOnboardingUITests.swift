import XCTest

final class InvitationOnboardingUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testSignedOutScreenShowsNoSignup() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTestLocale", "en"]
        app.launch()
        XCTAssertFalse(app.buttons["Create account"].exists)
        XCTAssertFalse(app.buttons["Sign up"].exists)
    }
}
