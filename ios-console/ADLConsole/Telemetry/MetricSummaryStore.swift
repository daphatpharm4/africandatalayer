import Foundation

struct MetricSummary: Codable, Equatable, Sendable {
    let periodStart: Date
    let periodEnd: Date
    let crashCount: Int
    let hangCount: Int
    let peakMemoryMB: Double?
    let cumulativeCPUSeconds: Double?
    let cumulativeEnergy: Double?
    let launchHistogram: [String: Int]?
}

protocol MetricSummaryStoring: Sendable {
    func store(_ summary: MetricSummary) async throws
    func latest() async throws -> MetricSummary?
    func all() async throws -> [MetricSummary]
}

actor InMemoryMetricSummaryStore: MetricSummaryStoring {
    private var summaries: [MetricSummary] = []

    func store(_ summary: MetricSummary) {
        summaries.append(summary)
        if summaries.count > 10 { summaries.removeFirst() }
    }

    func latest() -> MetricSummary? { summaries.last }

    func all() -> [MetricSummary] { summaries }
}

final class MetricKitReporter: NSObject, Sendable {
    private let store: MetricSummaryStoring

    init(store: MetricSummaryStoring) {
        self.store = store
    }
}
