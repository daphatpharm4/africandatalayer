import XCTest
@testable import ADLConsole

final class TelemetryPrivacyTests: XCTestCase {
    func testEventRejectsProhibitedKeysAndValues() {
        XCTAssertThrowsError(try TelemetryEvent(name: "capture", fields: ["email": .string("a@b.com")]))
        XCTAssertThrowsError(try TelemetryEvent(name: "sync", fields: ["coordinates": .string("4.0,9.7")]))
        XCTAssertNoThrow(try TelemetryEvent(name: "sync.attempt", fields: ["result": .string("network"), "count": .integer(2)]))
    }

    func testEventRejectsProhibitedKeyNames() {
        XCTAssertThrowsError(try TelemetryEvent(name: "test", fields: ["email_address": .string("x")]))
        XCTAssertNoThrow(try TelemetryEvent(name: "test", fields: ["result": .string("ok"), "duration_ms": .integer(42)]))
    }

    func testInMemoryClientRecordsEvents() {
        let client = InMemoryTelemetryClient()
        client.emit(try! TelemetryEvent(name: "test.event", fields: ["result": .string("ok")]))
        XCTAssertEqual(client.events.count, 1)
        XCTAssertEqual(client.events[0].name, "test.event")
    }

    func testInMemoryClientRecordsIntervals() async {
        let client = InMemoryTelemetryClient()
        let interval = client.begin("test.interval")
        try! await Task.sleep(nanoseconds: 1_000_000)
        interval.end()
        XCTAssertEqual(client.intervals.count, 1)
        XCTAssertGreaterThanOrEqual(client.intervals[0].durationMS, 0)
    }
}
