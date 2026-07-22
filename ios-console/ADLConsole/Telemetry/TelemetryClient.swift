import Foundation

enum TelemetryValue: Equatable, Sendable {
    case string(String)
    case integer(Int)
    case durationMilliseconds(Int)
    case byteBucket(String)
}

enum TelemetryError: Error, Equatable {
    case prohibitedField
}

struct TelemetryEvent: Equatable, Sendable {
    let name: String
    let fields: [String: TelemetryValue]

    init(name: String, fields: [String: TelemetryValue] = [:]) throws {
        let allowed: Set<String> = ["result", "class", "trigger", "state", "count", "attempt", "duration_ms", "byte_bucket", "channel", "version"]
        let prohibitedKeys: Set<String> = ["email", "email_address", "coordinates", "name", "organization", "project",
                                            "address", "phone", "notes", "field_values", "data_url", "path", "cookie",
                                            "token", "password", "secret"]
        let fieldKeys = Set(fields.keys)
        guard fieldKeys.isSubset(of: allowed), fieldKeys.intersection(prohibitedKeys).isEmpty else {
            throw TelemetryError.prohibitedField
        }
        self.name = name
        self.fields = fields
    }
}

protocol TelemetryClient: Sendable {
    func emit(_ event: TelemetryEvent)
    func begin(_ name: String) -> TelemetryInterval
}

protocol TelemetryInterval: Sendable {
    var durationMS: Int { get }
    func end()
}
