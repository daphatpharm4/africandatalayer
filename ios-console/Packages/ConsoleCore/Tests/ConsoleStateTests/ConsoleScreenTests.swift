import XCTest
@testable import ConsoleState

final class ConsoleScreenTests: XCTestCase {
    func testRawValuesMatchTypeScriptStringUnion() {
        XCTAssertEqual(ConsoleScreen.loading.rawValue, "LOADING")
        XCTAssertEqual(ConsoleScreen.authRequired.rawValue, "AUTH_REQUIRED")
        XCTAssertEqual(ConsoleScreen.overview.rawValue, "OVERVIEW")
        XCTAssertEqual(ConsoleScreen.data.rawValue, "DATA")
        XCTAssertEqual(ConsoleScreen.review.rawValue, "REVIEW")
        XCTAssertEqual(ConsoleScreen.onboarding.rawValue, "ONBOARDING")
        XCTAssertEqual(ConsoleScreen.projects.rawValue, "PROJECTS")
        XCTAssertEqual(ConsoleScreen.schemaBuilder.rawValue, "SCHEMA_BUILDER")
        XCTAssertEqual(ConsoleScreen.members.rawValue, "MEMBERS")
        XCTAssertEqual(ConsoleScreen.settings.rawValue, "SETTINGS")
        XCTAssertEqual(ConsoleScreen.join.rawValue, "JOIN")
        XCTAssertEqual(ConsoleScreen.allCases.count, 12)
    }

    /// `.map` has no TS `ConsoleScreen` counterpart (see its doc comment) —
    /// asserted separately from the TS-mirrored raw values above.
    func testMapRawValue() {
        XCTAssertEqual(ConsoleScreen.map.rawValue, "MAP")
    }
}
