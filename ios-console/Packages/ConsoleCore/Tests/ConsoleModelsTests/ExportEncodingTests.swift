import XCTest
@testable import ConsoleModels

/// Covers `ExportEncoding`'s CSV and GeoJSON encoders: header/row shape,
/// RFC 4180 field escaping (comma/quote/newline), optional-field handling,
/// and empty-input behavior. These are pure `Data` producers with no I/O or
/// UIKit dependency, so they're covered here at the package level rather
/// than requiring a simulator.
final class ExportEncodingTests: XCTestCase {

    // MARK: - CSV

    func testCsvEncodesHeaderAndRows() throws {
        let rows = [
            ExportRow(id: "r1", name: "Shop A", type: "retail", latitude: 4.05, longitude: 9.74, capturedAt: "2026-07-01"),
            ExportRow(id: "r2", name: "Shop B", type: "pharmacy", latitude: 4.06, longitude: 9.75, capturedAt: "2026-07-02")
        ]

        let csv = try XCTUnwrap(String(data: ExportEncoding.csv(rows), encoding: .utf8))
        let lines = csv.components(separatedBy: "\r\n").filter { !$0.isEmpty }

        XCTAssertEqual(lines.first, "id,name,type,latitude,longitude,capturedAt")
        XCTAssertEqual(lines.count, 3)
        XCTAssertEqual(lines[1], "r1,Shop A,retail,4.05,9.74,2026-07-01")
        XCTAssertEqual(lines[2], "r2,Shop B,pharmacy,4.06,9.75,2026-07-02")
    }

    func testCsvOmitsOptionalGeoFieldsAsEmptyStrings() throws {
        let rows = [ExportRow(id: "r1", name: "Amina Fotso", type: "agent")]

        let csv = try XCTUnwrap(String(data: ExportEncoding.csv(rows), encoding: .utf8))
        let lines = csv.components(separatedBy: "\r\n").filter { !$0.isEmpty }

        XCTAssertEqual(lines[1], "r1,Amina Fotso,agent,,,")
    }

    func testCsvEscapesFieldsContainingCommas() throws {
        let rows = [ExportRow(id: "r1", name: "Shop A, Annex", type: "retail")]

        let csv = try XCTUnwrap(String(data: ExportEncoding.csv(rows), encoding: .utf8))

        XCTAssertTrue(csv.contains("\"Shop A, Annex\""))
    }

    func testCsvEscapesFieldsContainingDoubleQuotesByDoublingThem() throws {
        let rows = [ExportRow(id: "r1", name: "The \"Best\" Pharmacy", type: "pharmacy")]

        let csv = try XCTUnwrap(String(data: ExportEncoding.csv(rows), encoding: .utf8))

        XCTAssertTrue(csv.contains("\"The \"\"Best\"\" Pharmacy\""))
    }

    func testCsvEscapesFieldsContainingNewlines() throws {
        let rows = [ExportRow(id: "r1", name: "Shop A\nGround floor", type: "retail")]

        let csv = try XCTUnwrap(String(data: ExportEncoding.csv(rows), encoding: .utf8))

        XCTAssertTrue(csv.contains("\"Shop A\nGround floor\""))
    }

    func testCsvEmptyRowSetProducesHeaderRowOnly() throws {
        let csv = try XCTUnwrap(String(data: ExportEncoding.csv([]), encoding: .utf8))

        XCTAssertEqual(csv, "id,name,type,latitude,longitude,capturedAt\r\n")
    }

    // MARK: - GeoJSON

    private struct DecodedGeometry: Decodable {
        var type: String
        var coordinates: [Double]
    }

    private struct DecodedFeature: Decodable {
        var type: String
        var id: String
        var geometry: DecodedGeometry
        var properties: [String: String]
    }

    private struct DecodedFeatureCollection: Decodable {
        var type: String
        var features: [DecodedFeature]
    }

    func testGeoJSONProducesAValidFeatureCollection() throws {
        let features = [ExportFeature(id: "r1", latitude: 4.0, longitude: 11.0, properties: ["name": "Shop A"])]

        let data = try ExportEncoding.geoJSON(features)
        let decoded = try JSONDecoder().decode(DecodedFeatureCollection.self, from: data)

        XCTAssertEqual(decoded.type, "FeatureCollection")
        XCTAssertEqual(decoded.features.count, 1)
        XCTAssertEqual(decoded.features[0].type, "Feature")
        XCTAssertEqual(decoded.features[0].id, "r1")
        XCTAssertEqual(decoded.features[0].properties["name"], "Shop A")
    }

    func testGeoJSONEmitsCoordinatesInLongitudeLatitudeOrder() throws {
        let features = [ExportFeature(id: "r1", latitude: 4.05, longitude: 9.74)]

        let data = try ExportEncoding.geoJSON(features)
        let decoded = try JSONDecoder().decode(DecodedFeatureCollection.self, from: data)

        XCTAssertEqual(decoded.features[0].geometry.type, "Point")
        XCTAssertEqual(decoded.features[0].geometry.coordinates, [9.74, 4.05])
    }

    func testGeoJSONPreservesAllProperties() throws {
        let features = [
            ExportFeature(
                id: "cell-1",
                latitude: 4.05,
                longitude: 9.74,
                properties: ["vertical": "pharmacy", "capturedAt": "2026-07-01", "summary": "High opportunity cell"]
            )
        ]

        let data = try ExportEncoding.geoJSON(features)
        let decoded = try JSONDecoder().decode(DecodedFeatureCollection.self, from: data)

        XCTAssertEqual(decoded.features[0].properties["vertical"], "pharmacy")
        XCTAssertEqual(decoded.features[0].properties["capturedAt"], "2026-07-01")
        XCTAssertEqual(decoded.features[0].properties["summary"], "High opportunity cell")
    }

    func testGeoJSONEmptyFeatureSetProducesEmptyFeaturesArray() throws {
        let data = try ExportEncoding.geoJSON([])
        let decoded = try JSONDecoder().decode(DecodedFeatureCollection.self, from: data)

        XCTAssertEqual(decoded.type, "FeatureCollection")
        XCTAssertTrue(decoded.features.isEmpty)
    }

    func testGeoJSONIsDeterministicAcrossRepeatedEncodes() throws {
        let features = [
            ExportFeature(id: "r1", latitude: 4.0, longitude: 11.0, properties: ["name": "Shop A"]),
            ExportFeature(id: "r2", latitude: 4.1, longitude: 11.1, properties: ["name": "Shop B"])
        ]

        let first = try ExportEncoding.geoJSON(features)
        let second = try ExportEncoding.geoJSON(features)

        XCTAssertEqual(first, second)
    }
}
