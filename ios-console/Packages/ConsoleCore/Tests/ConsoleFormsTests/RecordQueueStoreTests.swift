import XCTest
import ConsoleModels
@testable import ConsoleForms

final class RecordQueueStoreTests: XCTestCase {
    private func sampleItem() -> RecordQueueItem {
        RecordQueueItem(
            id: "item-1",
            idempotencyKey: "idem-1",
            draft: RecordDraft(
                projectId: "proj-1",
                schemaVersionId: "schema-1",
                recordTypeKey: "pharmacy",
                data: ["name": .string("Acme"), "price": .number(4.5)],
                photoRefs: ["photo-1"],
                gps: FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 12),
                notes: "corner shop",
                pointId: nil,
                capturedAt: "2026-07-19T10:00:00Z"
            ),
            status: .failed,
            attempts: 2,
            retryCount: 1,
            nextRetryAt: Date(timeIntervalSince1970: 1_700_000_100),
            lastError: "network down",
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            updatedAt: Date(timeIntervalSince1970: 1_700_000_050)
        )
    }

    func testInMemoryStoreRoundTrip() throws {
        let store = InMemoryRecordQueueStore()
        XCTAssertEqual(try store.load(), [])
        try store.save([sampleItem()])
        XCTAssertEqual(try store.load(), [sampleItem()])
    }

    func testInMemoryStoreInitialSeed() throws {
        let store = InMemoryRecordQueueStore(initial: [sampleItem()])
        XCTAssertEqual(try store.load(), [sampleItem()])
    }

    func testFileStoreRoundTrip() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let fileURL = directory.appendingPathComponent("queue.json")
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = FileRecordQueueStore(fileURL: fileURL)
        XCTAssertEqual(try store.load(), [], "a store with no file yet should load as empty, not throw")

        try store.save([sampleItem()])
        XCTAssertEqual(try store.load(), [sampleItem()])

        // A second store instance pointed at the same file sees the same data.
        let reopened = FileRecordQueueStore(fileURL: fileURL)
        XCTAssertEqual(try reopened.load(), [sampleItem()])
    }

    func testFileStoreOverwritesPreviousContents() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let fileURL = directory.appendingPathComponent("queue.json")
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = FileRecordQueueStore(fileURL: fileURL)
        try store.save([sampleItem()])
        try store.save([])
        XCTAssertEqual(try store.load(), [])
    }

    func testUserDefaultsStoreRoundTrip() throws {
        let suiteName = "consoleforms.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let store = UserDefaultsRecordQueueStore(defaults: defaults, key: "queue")
        XCTAssertEqual(try store.load(), [])
        try store.save([sampleItem()])
        XCTAssertEqual(try store.load(), [sampleItem()])
    }
}
