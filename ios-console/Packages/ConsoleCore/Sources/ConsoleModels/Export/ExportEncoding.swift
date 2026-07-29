import Foundation

// MARK: - Export row/feature models
//
// Deliberately generic — the analytics export panel (app target) can map
// *any* `AnalyticsRepositoryProtocol` result (agent performance, spatial
// intelligence cells, category breakdowns, ...) into these shapes rather
// than this package needing a bespoke encoder per analytics endpoint.

/// One flat, tabular record for CSV/PDF export. `latitude`/`longitude`/
/// `capturedAt` default to `nil` so callers exporting non-geo tabular data
/// (e.g. agent performance rows, which have no coordinates) don't need to
/// invent placeholder values.
public struct ExportRow: Equatable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let latitude: Double?
    public let longitude: Double?
    public let capturedAt: String?

    public init(
        id: String,
        name: String,
        type: String,
        latitude: Double? = nil,
        longitude: Double? = nil,
        capturedAt: String? = nil
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.latitude = latitude
        self.longitude = longitude
        self.capturedAt = capturedAt
    }
}

/// One GeoJSON-worthy record: a required point geometry plus flat string
/// properties. Unlike `ExportRow`, coordinates are non-optional — a feature
/// with no location has no geometry to encode.
public struct ExportFeature: Equatable, Sendable {
    public let id: String
    public let latitude: Double
    public let longitude: Double
    public let properties: [String: String]

    public init(id: String, latitude: Double, longitude: Double, properties: [String: String] = [:]) {
        self.id = id
        self.latitude = latitude
        self.longitude = longitude
        self.properties = properties
    }
}

// MARK: - Pure encoders

/// Pure `Data`-producing CSV/GeoJSON encoders for the analytics export
/// panel. No file I/O, no UIKit — safe to unit test with `swift test` and
/// call from any isolation context. PDF rendering needs
/// `UIGraphicsPDFRenderer` (UIKit), so it lives in the app target's
/// `ExportService` instead; see that type's doc comment.
public enum ExportEncoding {
    private static let csvHeader = "id,name,type,latitude,longitude,capturedAt"
    /// RFC 4180 specifies CRLF line terminators for CSV.
    private static let csvLineTerminator = "\r\n"

    /// Encodes `rows` as CSV `Data` (UTF-8): a header row followed by one
    /// row per record. Fields containing a comma, double quote, or newline
    /// are wrapped in double quotes with internal quotes doubled, per RFC
    /// 4180. Empty `rows` still produces the header line alone — never
    /// empty `Data` — so a downstream file always opens as a valid (if
    /// empty) CSV.
    public static func csv(_ rows: [ExportRow]) -> Data {
        var lines = [csvHeader]
        for row in rows {
            let fields = [
                row.id,
                row.name,
                row.type,
                row.latitude.map(formatCoordinate) ?? "",
                row.longitude.map(formatCoordinate) ?? "",
                row.capturedAt ?? ""
            ]
            lines.append(fields.map(escapeCSVField).joined(separator: ","))
        }
        return Data((lines.joined(separator: csvLineTerminator) + csvLineTerminator).utf8)
    }

    /// Encodes `features` as a GeoJSON `FeatureCollection` `Data` (UTF-8,
    /// pretty-printed with sorted keys for deterministic output — stable
    /// byte-for-byte across encodes of the same input, which both this
    /// package's tests and any downstream diffing rely on). Coordinates are
    /// emitted `[longitude, latitude]` per RFC 7946 §3.1.1. Empty `features`
    /// yields a valid `FeatureCollection` with an empty `features` array,
    /// not empty/invalid `Data`.
    public static func geoJSON(_ features: [ExportFeature]) throws -> Data {
        let collection = GeoJSONFeatureCollection(
            features: features.map { feature in
                GeoJSONFeature(
                    id: feature.id,
                    geometry: GeoJSONGeometry(coordinates: [feature.longitude, feature.latitude]),
                    properties: feature.properties
                )
            }
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(collection)
    }

    private static func formatCoordinate(_ value: Double) -> String {
        String(value)
    }

    private static func escapeCSVField(_ field: String) -> String {
        guard field.contains(",") || field.contains("\"") || field.contains("\n") || field.contains("\r") else {
            return field
        }
        return "\"" + field.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }
}

// MARK: - GeoJSON wire types (internal — `ExportEncoding.geoJSON` is the only entry point)

struct GeoJSONFeatureCollection: Encodable {
    let type = "FeatureCollection"
    let features: [GeoJSONFeature]
}

struct GeoJSONFeature: Encodable {
    let type = "Feature"
    let id: String
    let geometry: GeoJSONGeometry
    let properties: [String: String]
}

struct GeoJSONGeometry: Encodable {
    let type = "Point"
    /// `[longitude, latitude]` — GeoJSON's coordinate order (RFC 7946 §3.1.1).
    let coordinates: [Double]
}
