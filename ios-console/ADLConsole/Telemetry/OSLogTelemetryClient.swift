import Foundation
import OSLog

final class OSLogTelemetryClient: TelemetryClient {
    private let logger: Logger

    init(subsystem: String = "com.africandatalayer.console") {
        self.logger = Logger(subsystem: subsystem, category: "telemetry")
    }

    func emit(_ event: TelemetryEvent) {
        let message: String = {
            let fields = event.fields.map { key, value in
                switch value {
                case .string(let s): "\(key)=\(s)"
                case .integer(let i): "\(key)=\(i)"
                case .durationMilliseconds(let d): "\(key)=\(d)ms"
                case .byteBucket(let b): "\(key)=\(b)"
                }
            }.joined(separator: " ")
            return "\(event.name) \(fields)"
        }()
        logger.log("\(message)")
    }

    func begin(_ name: String) -> TelemetryInterval {
        let start = DispatchTime.now().uptimeNanoseconds
        return OSLogTelemetryInterval(name: name, start: start, logger: logger)
    }
}

final class OSLogTelemetryInterval: TelemetryInterval, @unchecked Sendable {
    private let name: String
    private let start: UInt64
    private let logger: Logger
    private(set) var durationMS: Int = 0
    private var ended = false

    fileprivate init(name: String, start: UInt64, logger: Logger) {
        self.name = name
        self.start = start
        self.logger = logger
    }

    func end() {
        guard !self.ended else { return }
        self.ended = true
        let elapsed = DispatchTime.now().uptimeNanoseconds - self.start
        self.durationMS = Int(elapsed / 1_000_000)
        let message = "\(self.name) \(self.durationMS)ms"
        self.logger.log("\(message)")
    }

    deinit {
        if !ended { self.end() }
    }
}
