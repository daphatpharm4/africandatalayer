import XCTest
@testable import ADLConsole

final class StagingContractSmokeTests: XCTestCase {
    func testStagingSecretsExist() throws {
        guard ProcessInfo.processInfo.environment["ADL_STAGING_EMAIL"] != nil,
              ProcessInfo.processInfo.environment["ADL_STAGING_PASSWORD"] != nil else {
            throw XCTSkip("Staging credentials not configured")
        }
    }
}
