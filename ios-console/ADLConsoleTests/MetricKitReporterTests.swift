import MetricKit
import XCTest
@testable import ADLConsole

final class MetricKitReporterTests: XCTestCase {
    func testProcessorStoresOnlyBoundedSummary() async throws {
        let store = InMemoryMetricSummaryStore()
        let reporter = MetricKitReporter(store: store)
        let summary = MetricSummary(
            periodStart: Date(),
            periodEnd: Date().addingTimeInterval(86400),
            crashCount: 1,
            hangCount: 0,
            peakMemoryMB: 45.0,
            cumulativeCPUSeconds: 120.0,
            cumulativeEnergy: 10.0,
            launchHistogram: ["0-100ms": 5, "100-200ms": 3]
        )
        try await store.store(summary)
        let latest = try await store.latest()
        XCTAssertEqual(latest?.crashCount, 1)
        XCTAssertEqual(latest?.hangCount, 0)
        XCTAssertNotNil(latest?.launchHistogram)
        let encoded = try JSONEncoder().encode(summary)
        XCTAssertLessThan(encoded.count, 64_000)
    }
}
