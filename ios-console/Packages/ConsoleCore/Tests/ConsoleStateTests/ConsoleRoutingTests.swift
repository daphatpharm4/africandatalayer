import XCTest
@testable import ConsoleState

final class ConsoleRoutingTests: XCTestCase {

    // MARK: - parseConsoleHash edge cases

    func testEmptyStringIsOverview() {
        XCTAssertEqual(parseConsoleHash(""), ConsoleRoute(screen: .overview))
    }

    func testHashOnlyIsOverview() {
        XCTAssertEqual(parseConsoleHash("#"), ConsoleRoute(screen: .overview))
    }

    func testHashSlashOnlyIsOverview() {
        XCTAssertEqual(parseConsoleHash("#/"), ConsoleRoute(screen: .overview))
    }

    func testSlashOnlyIsOverview() {
        XCTAssertEqual(parseConsoleHash("/"), ConsoleRoute(screen: .overview))
    }

    func testGarbageIsOverview() {
        XCTAssertEqual(parseConsoleHash("#/totally-not-a-screen"), ConsoleRoute(screen: .overview))
        XCTAssertEqual(parseConsoleHash("garbage/more/garbage"), ConsoleRoute(screen: .overview))
    }

    func testMissingHashSlashPrefixTolerated() {
        // Bare path, no "#/" prefix at all.
        XCTAssertEqual(parseConsoleHash("overview"), ConsoleRoute(screen: .overview))
        XCTAssertEqual(parseConsoleHash("data"), ConsoleRoute(screen: .data))
    }

    func testLeadingHashWithoutSlashTolerated() {
        XCTAssertEqual(parseConsoleHash("#review"), ConsoleRoute(screen: .review))
    }

    func testLeadingSlashWithoutHashTolerated() {
        XCTAssertEqual(parseConsoleHash("/settings"), ConsoleRoute(screen: .settings))
    }

    func testOverview() {
        XCTAssertEqual(parseConsoleHash("#/overview"), ConsoleRoute(screen: .overview))
    }

    func testData() {
        XCTAssertEqual(parseConsoleHash("#/data"), ConsoleRoute(screen: .data))
    }

    func testReview() {
        XCTAssertEqual(parseConsoleHash("#/review"), ConsoleRoute(screen: .review))
    }

    func testMembers() {
        XCTAssertEqual(parseConsoleHash("#/members"), ConsoleRoute(screen: .members))
    }

    func testSettings() {
        XCTAssertEqual(parseConsoleHash("#/settings"), ConsoleRoute(screen: .settings))
    }

    func testOnboarding() {
        XCTAssertEqual(parseConsoleHash("#/onboarding"), ConsoleRoute(screen: .onboarding))
    }

    func testProjectsBare() {
        XCTAssertEqual(parseConsoleHash("#/projects"), ConsoleRoute(screen: .projects))
    }

    func testProjectsWithOnlyIdIsStillProjects() {
        // second segment present but no "schema" third segment -> plain PROJECTS,
        // matching TS: `if (second && third === "schema")` else falls through.
        XCTAssertEqual(parseConsoleHash("#/projects/abc123"), ConsoleRoute(screen: .projects))
    }

    func testProjectsSchemaBuilder() {
        XCTAssertEqual(
            parseConsoleHash("#/projects/abc123/schema"),
            ConsoleRoute(screen: .schemaBuilder, projectId: "abc123")
        )
    }

    func testProjectsSchemaBuilderExtraSegmentsIgnored() {
        // TS destructures only [first, second, third]; a 4th segment is ignored.
        XCTAssertEqual(
            parseConsoleHash("#/projects/abc123/schema/extra"),
            ConsoleRoute(screen: .schemaBuilder, projectId: "abc123")
        )
    }

    func testJoinWithoutToken() {
        XCTAssertEqual(parseConsoleHash("#/join"), ConsoleRoute(screen: .join))
    }

    func testJoinWithToken() {
        XCTAssertEqual(
            parseConsoleHash("#/join?token=abc"),
            ConsoleRoute(screen: .join, joinToken: "abc")
        )
    }

    func testJoinWithEmptyTokenParamIsTreatedAsPresentEmptyString() {
        // URLSearchParams.get("token") on "?token=" returns "" (present, not nil).
        // TS: `token ? {...} : {...}` — an empty string is falsy in JS, so this
        // degrades to JOIN with no token, same as absent.
        XCTAssertEqual(parseConsoleHash("#/join?token="), ConsoleRoute(screen: .join))
    }

    func testJoinTokenIsURLDecoded() {
        XCTAssertEqual(
            parseConsoleHash("#/join?token=a%20b"),
            ConsoleRoute(screen: .join, joinToken: "a b")
        )
    }

    // MARK: - consoleRouteToHash

    func testToHashOverview() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .overview)), "#/overview")
    }

    func testToHashData() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .data)), "#/data")
    }

    func testToHashReview() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .review)), "#/review")
    }

    func testToHashProjects() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .projects)), "#/projects")
    }

    func testToHashSchemaBuilderWithProjectId() {
        XCTAssertEqual(
            consoleRouteToHash(ConsoleRoute(screen: .schemaBuilder, projectId: "abc123")),
            "#/projects/abc123/schema"
        )
    }

    func testToHashSchemaBuilderWithoutProjectIdFallsBackToProjects() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .schemaBuilder)), "#/projects")
    }

    func testToHashMembers() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .members)), "#/members")
    }

    func testToHashSettings() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .settings)), "#/settings")
    }

    func testToHashOnboarding() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .onboarding)), "#/onboarding")
    }

    func testToHashJoinWithoutToken() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .join)), "#/join")
    }

    func testToHashJoinWithToken() {
        XCTAssertEqual(
            consoleRouteToHash(ConsoleRoute(screen: .join, joinToken: "abc")),
            "#/join?token=abc"
        )
    }

    func testToHashJoinTokenIsPercentEncoded() {
        XCTAssertEqual(
            consoleRouteToHash(ConsoleRoute(screen: .join, joinToken: "a b/c")),
            "#/join?token=a%20b%2Fc"
        )
    }

    func testToHashLoadingIsEmpty() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .loading)), "")
    }

    func testToHashAuthRequiredIsEmpty() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .authRequired)), "")
    }

    // MARK: - MAP (iOS-console-only, no TS counterpart — see `ConsoleScreen.map`)

    func testMap() {
        XCTAssertEqual(parseConsoleHash("#/map"), ConsoleRoute(screen: .map))
    }

    func testToHashMap() {
        XCTAssertEqual(consoleRouteToHash(ConsoleRoute(screen: .map)), "#/map")
    }

    // MARK: - Round trips

    func testRoundTripsForEveryProducibleRoute() {
        let routes: [ConsoleRoute] = [
            ConsoleRoute(screen: .overview),
            ConsoleRoute(screen: .data),
            ConsoleRoute(screen: .review),
            ConsoleRoute(screen: .projects),
            ConsoleRoute(screen: .schemaBuilder, projectId: "proj-1"),
            ConsoleRoute(screen: .members),
            ConsoleRoute(screen: .settings),
            ConsoleRoute(screen: .onboarding),
            ConsoleRoute(screen: .join),
            ConsoleRoute(screen: .join, joinToken: "tok-1"),
            ConsoleRoute(screen: .map),
        ]
        for route in routes {
            let hash = consoleRouteToHash(route)
            XCTAssertEqual(parseConsoleHash(hash), route, "round trip failed for \(route)")
        }
    }
}
