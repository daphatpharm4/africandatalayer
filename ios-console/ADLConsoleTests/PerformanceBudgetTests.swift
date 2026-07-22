import ConsolePersistence
import XCTest
@testable import ADLConsole

final class PerformanceBudgetTests: XCTestCase {
    func testRecordLedgerSnapshotPerformance() throws {
        let ledger = try makeTestLedger()
        measure {
            let exp = expectation(description: "snapshot")
            Task {
                let snapshot = try? await ledger.snapshot(ownerUserID: "u1", organizationID: "o1")
                XCTAssertNotNil(snapshot)
                exp.fulfill()
            }
            wait(for: [exp], timeout: 5)
        }
    }

    private func makeTestLedger() throws -> RecordLedger {
        let database = try RecordDatabase.inMemory()
        return RecordLedger(database: database)
    }
}
