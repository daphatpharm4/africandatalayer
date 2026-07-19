import XCTest
@testable import ConsoleModels

final class SchemaModelTests: XCTestCase {
    func testBilingualLabelRoundTrip() throws {
        let label = BilingualLabel(en: "Name", fr: "Nom")
        let data = try JSONEncoder().encode(label)
        let decoded = try JSONDecoder().decode(BilingualLabel.self, from: data)
        XCTAssertEqual(decoded, label)
    }

    func testBilingualLabelDecodesFromFixture() throws {
        let json = """
        {"en":"Name","fr":"Nom"}
        """
        let decoded = try JSONDecoder().decode(BilingualLabel.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(decoded.en, "Name")
        XCTAssertEqual(decoded.fr, "Nom")
    }

    func testPlatformFieldOptionRoundTrip() throws {
        let option = PlatformFieldOption(value: "open", label: BilingualLabel(en: "Open", fr: "Ouvert"))
        let data = try JSONEncoder().encode(option)
        let decoded = try JSONDecoder().decode(PlatformFieldOption.self, from: data)
        XCTAssertEqual(decoded, option)
    }

    func testPlatformFieldDefinitionRoundTripWithOptionals() throws {
        let full = PlatformFieldDefinition(
            key: "price",
            label: BilingualLabel(en: "Price", fr: "Prix"),
            type: .number,
            required: true,
            options: [PlatformFieldOption(value: "a", label: BilingualLabel(en: "A", fr: "A"))],
            min: 0,
            max: 100000
        )
        let data = try JSONEncoder().encode(full)
        let decoded = try JSONDecoder().decode(PlatformFieldDefinition.self, from: data)
        XCTAssertEqual(decoded, full)

        let minimal = PlatformFieldDefinition(
            key: "name",
            label: BilingualLabel(en: "Name", fr: "Nom"),
            type: .text,
            required: false,
            options: nil,
            min: nil,
            max: nil
        )
        let minimalData = try JSONEncoder().encode(minimal)
        let minimalDecoded = try JSONDecoder().decode(PlatformFieldDefinition.self, from: minimalData)
        XCTAssertEqual(minimalDecoded, minimal)
    }

    func testPlatformFieldDefinitionDecodesFromFixtureMissingOptionalKeys() throws {
        let json = """
        {"key":"name","label":{"en":"Name","fr":"Nom"},"type":"text","required":false}
        """
        let decoded = try JSONDecoder().decode(PlatformFieldDefinition.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(decoded.key, "name")
        XCTAssertEqual(decoded.type, .text)
        XCTAssertNil(decoded.options)
        XCTAssertNil(decoded.min)
        XCTAssertNil(decoded.max)
    }

    func testPlatformEvidenceRulesRoundTrip() throws {
        let rules = PlatformEvidenceRules(
            gpsRequired: true,
            gpsAccuracyMeters: 25.5,
            minPhotos: 1,
            notesRequired: false
        )
        let data = try JSONEncoder().encode(rules)
        let decoded = try JSONDecoder().decode(PlatformEvidenceRules.self, from: data)
        XCTAssertEqual(decoded, rules)
    }

    func testPlatformRecordTypeRoundTrip() throws {
        let recordType = PlatformRecordType(
            key: "pharmacy",
            label: BilingualLabel(en: "Pharmacy", fr: "Pharmacie"),
            fields: [
                PlatformFieldDefinition(
                    key: "name",
                    label: BilingualLabel(en: "Name", fr: "Nom"),
                    type: .text,
                    required: true,
                    options: nil,
                    min: nil,
                    max: nil
                )
            ],
            evidence: PlatformEvidenceRules(
                gpsRequired: true,
                gpsAccuracyMeters: nil,
                minPhotos: 1,
                notesRequired: false
            )
        )
        let data = try JSONEncoder().encode(recordType)
        let decoded = try JSONDecoder().decode(PlatformRecordType.self, from: data)
        XCTAssertEqual(decoded, recordType)
    }

    func testPlatformSchemaDefinitionRoundTripAndFixture() throws {
        let schema = PlatformSchemaDefinition(recordTypes: [
            PlatformRecordType(
                key: "fuel_station",
                label: BilingualLabel(en: "Fuel Station", fr: "Station Essence"),
                fields: [],
                evidence: PlatformEvidenceRules(
                    gpsRequired: true,
                    gpsAccuracyMeters: 30,
                    minPhotos: 2,
                    notesRequired: true
                )
            )
        ])
        let data = try JSONEncoder().encode(schema)
        let decoded = try JSONDecoder().decode(PlatformSchemaDefinition.self, from: data)
        XCTAssertEqual(decoded, schema)

        let json = """
        {"recordTypes":[{"key":"fuel_station","label":{"en":"Fuel Station","fr":"Station Essence"},"fields":[],"evidence":{"gpsRequired":true,"minPhotos":2,"notesRequired":true}}]}
        """
        let fixtureDecoded = try JSONDecoder().decode(PlatformSchemaDefinition.self, from: json.data(using: .utf8)!)
        XCTAssertEqual(fixtureDecoded.recordTypes.count, 1)
        XCTAssertEqual(fixtureDecoded.recordTypes[0].key, "fuel_station")
        XCTAssertNil(fixtureDecoded.recordTypes[0].evidence.gpsAccuracyMeters)
    }
}
