import GRDB
import XCTest
@testable import ConsolePersistence

final class RecordDatabaseTests: XCTestCase {
    func testCreatesLedgerTablesAndForeignKeys() throws {
        let database = try RecordDatabase.inMemory()
        let names = try database.reader.read { db in
            try String.fetchAll(db, sql: "SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        XCTAssertTrue(names.contains("queued_records"))
        XCTAssertTrue(names.contains("media_attachments"))
        XCTAssertTrue(names.contains("queue_migrations"))
        let foreignKeys = try database.reader.read { db in
            try Row.fetchAll(db, sql: "PRAGMA foreign_key_list(media_attachments)")
        }
        XCTAssertEqual(foreignKeys.first?["table"], "queued_records")
    }
}
