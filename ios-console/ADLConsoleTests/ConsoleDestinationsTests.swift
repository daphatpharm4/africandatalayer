@testable import ADLConsole
import ConsoleModels
import ConsoleState
import XCTest

/// Asserts the shell's role-gated nav (`ConsoleNavigation.visibleDestinations`)
/// against `canAccessConsoleScreen` directly — the same access-control
/// function `ConsoleState` exposes and the web `ConsoleShell.tsx` filters
/// `NAV_ITEMS` with. This re-derives the expected set from the gate itself
/// rather than re-reading `ConsoleNavigation`'s own filter, so a regression
/// in either the destination list or the gating call would be caught.
final class ConsoleDestinationsTests: XCTestCase {
    func testVisibleDestinationsMatchCanAccessConsoleScreenForEveryRole() {
        for role in PlatformRole.allCases {
            for isAdlAdmin in [false, true] {
                let expectedScreens = ConsoleNavigation.allDestinations
                    .map(\.screen)
                    .filter { canAccessConsoleScreen(role: role, screen: $0, isAdlAdmin: isAdlAdmin) }

                let actualScreens = ConsoleNavigation.visibleDestinations(role: role, isAdlAdmin: isAdlAdmin)
                    .map(\.screen)

                XCTAssertEqual(
                    actualScreens,
                    expectedScreens,
                    "role=\(role) isAdlAdmin=\(isAdlAdmin): visible destinations must match canAccessConsoleScreen exactly"
                )
            }
        }
    }

    func testOwnerSeesEveryNavDestination() {
        let screens = Set(ConsoleNavigation.visibleDestinations(role: .owner).map(\.screen))
        XCTAssertEqual(screens, Set(ConsoleNavigation.allDestinations.map(\.screen)))
    }

    func testCollectorCannotSeeDataReviewMembersOrSettings() {
        let screens = Set(ConsoleNavigation.visibleDestinations(role: .collector).map(\.screen))
        XCTAssertFalse(screens.contains(.data))
        XCTAssertFalse(screens.contains(.review))
        XCTAssertFalse(screens.contains(.members))
        XCTAssertFalse(screens.contains(.settings))
        XCTAssertTrue(screens.contains(.overview))
        XCTAssertTrue(screens.contains(.projects))
    }

    /// The brief for the company map explicitly requires it be visible to
    /// "at least collector" — the one role `DATA` (company records browse)
    /// is hidden from.
    func testEveryRoleIncludingCollectorSeesMap() {
        for role in PlatformRole.allCases {
            XCTAssertTrue(
                ConsoleNavigation.visibleDestinations(role: role).map(\.screen).contains(.map),
                "role=\(role) must see the MAP destination"
            )
        }
    }

    func testViewerSeesDataButNotReviewMembersOrSettings() {
        let screens = Set(ConsoleNavigation.visibleDestinations(role: .viewer).map(\.screen))
        XCTAssertTrue(screens.contains(.data))
        XCTAssertFalse(screens.contains(.review))
        XCTAssertFalse(screens.contains(.members))
        XCTAssertFalse(screens.contains(.settings))
    }

    func testReviewerSeesReviewButNotMembersOrSettings() {
        let screens = Set(ConsoleNavigation.visibleDestinations(role: .reviewer).map(\.screen))
        XCTAssertTrue(screens.contains(.review))
        XCTAssertFalse(screens.contains(.members))
        XCTAssertFalse(screens.contains(.settings))
    }

    func testManagerSeesMembersButNotSettings() {
        let screens = Set(ConsoleNavigation.visibleDestinations(role: .manager).map(\.screen))
        XCTAssertTrue(screens.contains(.members))
        XCTAssertTrue(screens.contains(.review))
        XCTAssertFalse(screens.contains(.settings))
    }

    /// `JOIN` and `ONBOARDING` are reachable by invite link / the ADL-admin
    /// "Create company" action, never by the role-filtered nav — this holds
    /// regardless of `isAdlAdmin`, since `NAV_ITEMS` never includes them.
    func testOnboardingAndJoinAreNeverInTheNavListRegardlessOfAdlAdmin() {
        for role in PlatformRole.allCases {
            for isAdlAdmin in [false, true] {
                let screens = Set(ConsoleNavigation.visibleDestinations(role: role, isAdlAdmin: isAdlAdmin).map(\.screen))
                XCTAssertFalse(screens.contains(.onboarding))
                XCTAssertFalse(screens.contains(.join))
            }
        }
    }
}
