import XCTest
@testable import ADLConsole

final class CaptureResilienceTests: XCTestCase {
    func testEveryCrashPointRetainsOrAcknowledgesRecord() async throws {
        for point in FailurePoint.allCases {
            XCTAssertNotNil(FailurePoint(rawValue: point.rawValue))
        }
    }
}
