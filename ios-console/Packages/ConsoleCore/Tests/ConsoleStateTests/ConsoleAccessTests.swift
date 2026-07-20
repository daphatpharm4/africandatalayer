import XCTest
@testable import ConsoleState
@testable import ConsoleModels

final class ConsoleAccessTests: XCTestCase {

    // MARK: - Landing route

    func testLandingRouteForReviewerIsReview() {
        XCTAssertEqual(consoleLandingRoute(role: .reviewer), ConsoleRoute(screen: .review))
    }

    func testLandingRouteForEveryOtherRoleIsOverview() {
        for role in PlatformRole.allCases where role != .reviewer {
            XCTAssertEqual(
                consoleLandingRoute(role: role),
                ConsoleRoute(screen: .overview),
                "expected OVERVIEW landing route for \(role)"
            )
        }
    }

    // MARK: - Exhaustive access matrix
    //
    // Cross-checked, pair by pair, against `canAccessConsoleScreen` in
    // lib/client/consoleState.ts:
    //
    //   JOIN, OVERVIEW, PROJECTS      -> true for every role
    //   DATA                          -> role != "collector"
    //   REVIEW                       -> role in {reviewer, manager, owner}
    //   SCHEMA_BUILDER, MEMBERS      -> role in {manager, owner}
    //   SETTINGS                     -> role == "owner"
    //   ONBOARDING                   -> isAdlAdmin
    //   LOADING, AUTH_REQUIRED       -> false (falls into TS `default: return false`)

    private func expectedAccess(role: PlatformRole, screen: ConsoleScreen, isAdlAdmin: Bool) -> Bool {
        switch screen {
        case .join, .overview, .projects:
            return true
        case .data:
            return role != .collector
        case .review:
            return role == .reviewer || role == .manager || role == .owner
        case .schemaBuilder, .members:
            return role == .manager || role == .owner
        case .settings:
            return role == .owner
        case .onboarding:
            return isAdlAdmin
        case .loading, .authRequired:
            return false
        }
    }

    func testAccessMatrixEveryRoleEveryScreen_isAdlAdminFalse() {
        for role in PlatformRole.allCases {
            for screen in ConsoleScreen.allCases {
                let expected = expectedAccess(role: role, screen: screen, isAdlAdmin: false)
                let actual = canAccessConsoleScreen(role: role, screen: screen, isAdlAdmin: false)
                XCTAssertEqual(
                    actual,
                    expected,
                    "role=\(role.rawValue) screen=\(screen.rawValue) isAdlAdmin=false expected \(expected) got \(actual)"
                )
            }
        }
    }

    func testAccessMatrixEveryRoleEveryScreen_isAdlAdminTrue() {
        for role in PlatformRole.allCases {
            for screen in ConsoleScreen.allCases {
                let expected = expectedAccess(role: role, screen: screen, isAdlAdmin: true)
                let actual = canAccessConsoleScreen(role: role, screen: screen, isAdlAdmin: true)
                XCTAssertEqual(
                    actual,
                    expected,
                    "role=\(role.rawValue) screen=\(screen.rawValue) isAdlAdmin=true expected \(expected) got \(actual)"
                )
            }
        }
    }

    func testDefaultIsAdlAdminParameterDefaultsFalse() {
        // TS default parameter `isAdlAdmin = false`; ONBOARDING should be
        // inaccessible when the parameter is omitted.
        for role in PlatformRole.allCases {
            XCTAssertFalse(canAccessConsoleScreen(role: role, screen: .onboarding))
        }
    }

    // MARK: - Explicit literal table (belt-and-suspenders vs the closure above)

    func testExplicitAccessMatrixLiterals() {
        // JOIN, OVERVIEW, PROJECTS: true for all roles.
        for role in PlatformRole.allCases {
            XCTAssertTrue(canAccessConsoleScreen(role: role, screen: .join))
            XCTAssertTrue(canAccessConsoleScreen(role: role, screen: .overview))
            XCTAssertTrue(canAccessConsoleScreen(role: role, screen: .projects))
        }

        // DATA: everyone except collector.
        XCTAssertTrue(canAccessConsoleScreen(role: .owner, screen: .data))
        XCTAssertTrue(canAccessConsoleScreen(role: .manager, screen: .data))
        XCTAssertTrue(canAccessConsoleScreen(role: .reviewer, screen: .data))
        XCTAssertFalse(canAccessConsoleScreen(role: .collector, screen: .data))
        XCTAssertTrue(canAccessConsoleScreen(role: .viewer, screen: .data))

        // REVIEW: reviewer, manager, owner only.
        XCTAssertTrue(canAccessConsoleScreen(role: .owner, screen: .review))
        XCTAssertTrue(canAccessConsoleScreen(role: .manager, screen: .review))
        XCTAssertTrue(canAccessConsoleScreen(role: .reviewer, screen: .review))
        XCTAssertFalse(canAccessConsoleScreen(role: .collector, screen: .review))
        XCTAssertFalse(canAccessConsoleScreen(role: .viewer, screen: .review))

        // SCHEMA_BUILDER: manager, owner only.
        XCTAssertTrue(canAccessConsoleScreen(role: .owner, screen: .schemaBuilder))
        XCTAssertTrue(canAccessConsoleScreen(role: .manager, screen: .schemaBuilder))
        XCTAssertFalse(canAccessConsoleScreen(role: .reviewer, screen: .schemaBuilder))
        XCTAssertFalse(canAccessConsoleScreen(role: .collector, screen: .schemaBuilder))
        XCTAssertFalse(canAccessConsoleScreen(role: .viewer, screen: .schemaBuilder))

        // MEMBERS: manager, owner only.
        XCTAssertTrue(canAccessConsoleScreen(role: .owner, screen: .members))
        XCTAssertTrue(canAccessConsoleScreen(role: .manager, screen: .members))
        XCTAssertFalse(canAccessConsoleScreen(role: .reviewer, screen: .members))
        XCTAssertFalse(canAccessConsoleScreen(role: .collector, screen: .members))
        XCTAssertFalse(canAccessConsoleScreen(role: .viewer, screen: .members))

        // SETTINGS: owner only.
        XCTAssertTrue(canAccessConsoleScreen(role: .owner, screen: .settings))
        XCTAssertFalse(canAccessConsoleScreen(role: .manager, screen: .settings))
        XCTAssertFalse(canAccessConsoleScreen(role: .reviewer, screen: .settings))
        XCTAssertFalse(canAccessConsoleScreen(role: .collector, screen: .settings))
        XCTAssertFalse(canAccessConsoleScreen(role: .viewer, screen: .settings))

        // ONBOARDING: isAdlAdmin gate, independent of role.
        for role in PlatformRole.allCases {
            XCTAssertFalse(canAccessConsoleScreen(role: role, screen: .onboarding, isAdlAdmin: false))
            XCTAssertTrue(canAccessConsoleScreen(role: role, screen: .onboarding, isAdlAdmin: true))
        }

        // LOADING, AUTH_REQUIRED: always false, regardless of role or admin flag.
        for role in PlatformRole.allCases {
            XCTAssertFalse(canAccessConsoleScreen(role: role, screen: .loading))
            XCTAssertFalse(canAccessConsoleScreen(role: role, screen: .loading, isAdlAdmin: true))
            XCTAssertFalse(canAccessConsoleScreen(role: role, screen: .authRequired))
            XCTAssertFalse(canAccessConsoleScreen(role: role, screen: .authRequired, isAdlAdmin: true))
        }
    }
}
