import XCTest
@testable import ADLConsole

final class AppEnvironmentTests: XCTestCase {
    func testReleaseAcceptsOnlyApprovedHTTPSHost() throws {
        let environment = try AppEnvironment.load(info: [
            "ADL_BUILD_CHANNEL": "production",
            "ADL_API_BASE_URL": "https://www.app.africandatalayer.com",
            "CFBundleIdentifier": "com.africandatalayer.console",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "42"
        ])
        XCTAssertEqual(environment.channel, .production)
        XCTAssertEqual(environment.apiBaseURL.host, "www.app.africandatalayer.com")
        XCTAssertEqual(environment.network.requestTimeout, 30)
    }

    func testProductionRejectsHTTPAndUnapprovedHost() {
        XCTAssertThrowsError(try AppEnvironment.load(info: [
            "ADL_BUILD_CHANNEL": "production",
            "ADL_API_BASE_URL": "http://preview.example.com",
            "CFBundleIdentifier": "com.africandatalayer.console",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "42"
        ])) { error in
            XCTAssertEqual(error as? AppEnvironmentError, .insecureURL)
        }
    }

    func testDebugAllowsLoopbackHTTP() throws {
        let environment = try AppEnvironment.load(info: [
            "ADL_BUILD_CHANNEL": "debug",
            "ADL_API_BASE_URL": "http://127.0.0.1:4173",
            "CFBundleIdentifier": "com.africandatalayer.console.debug",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "1"
        ])
        XCTAssertEqual(environment.channel, .debug)
    }

    func testProductionRejectsWrongHost() {
        XCTAssertThrowsError(try AppEnvironment.load(info: [
            "ADL_BUILD_CHANNEL": "production",
            "ADL_API_BASE_URL": "https://wrong.example.com",
            "CFBundleIdentifier": "com.africandatalayer.console",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "42"
        ])) { error in
            XCTAssertEqual(error as? AppEnvironmentError, .unapprovedProductionHost)
        }
    }

    func testMissingKeyThrows() {
        XCTAssertThrowsError(try AppEnvironment.load(info: [:])) { error in
            XCTAssertEqual(error as? AppEnvironmentError, .missing("ADL_BUILD_CHANNEL"))
        }
    }

    func testTelemetryPrefix() throws {
        let env = try AppEnvironment.load(info: [
            "ADL_BUILD_CHANNEL": "debug",
            "ADL_API_BASE_URL": "http://127.0.0.1:4173",
            "CFBundleIdentifier": "com.africandatalayer.console.debug",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "1"
        ])
        XCTAssertEqual(env.telemetryPrefix, "com.africandatalayer.console.debug")
    }

    func testProductionAppDependenciesShareEnvironment() throws {
        let environment = try AppEnvironment.load(info: [
            "ADL_BUILD_CHANNEL": "production",
            "ADL_API_BASE_URL": "https://www.app.africandatalayer.com",
            "CFBundleIdentifier": "com.africandatalayer.console",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "42"
        ])
        let dependencies = AppDependencies(environment: environment)
        XCTAssertEqual(dependencies.baseURL, environment.apiBaseURL)
        XCTAssertEqual(dependencies.session.configuration.timeoutIntervalForRequest, 30)
    }
}
