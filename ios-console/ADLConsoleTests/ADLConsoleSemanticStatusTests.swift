import XCTest
@testable import ADLConsole

final class ADLConsoleSemanticStatusTests: XCTestCase {
    func testOperationalStatusesMapToSharedTones() {
        XCTAssertEqual(OperationalStatus.offline(expiresAt: nil).semanticTone, .warning)
        XCTAssertEqual(OperationalStatus.connecting.semanticTone, .info)
        XCTAssertEqual(OperationalStatus.pending(count: 2).semanticTone, .warning)
        XCTAssertEqual(OperationalStatus.syncing(current: 1, total: 3).semanticTone, .info)
        XCTAssertEqual(OperationalStatus.blocked(count: 1).semanticTone, .danger)
        XCTAssertEqual(OperationalStatus.upToDate(lastSuccessfulSyncAt: nil).semanticTone, .success)
    }
}
