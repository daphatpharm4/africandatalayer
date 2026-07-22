import Foundation

final class InMemoryTelemetryClient: TelemetryClient, @unchecked Sendable {
    private(set) var events: [TelemetryEvent] = []
    private(set) var intervals: [InMemoryTelemetryInterval] = []
    private let lock = NSLock()

    func emit(_ event: TelemetryEvent) {
        lock.lock()
        events.append(event)
        lock.unlock()
    }

    func begin(_ name: String) -> TelemetryInterval {
        let interval = InMemoryTelemetryInterval(name: name)
        lock.lock()
        intervals.append(interval)
        lock.unlock()
        return interval
    }
}

final class InMemoryTelemetryInterval: TelemetryInterval, @unchecked Sendable {
    let name: String
    private let start = DispatchTime.now().uptimeNanoseconds
    private(set) var durationMS: Int = 0
    private var ended = false

    fileprivate init(name: String) { self.name = name }

    func end() {
        guard !ended else { return }
        ended = true
        let elapsed = DispatchTime.now().uptimeNanoseconds - start
        durationMS = Int(elapsed / 1_000_000)
    }
}
