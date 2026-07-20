import XCTest
import ConsoleModels
@testable import ConsoleForms

final class FormEngineTests: XCTestCase {
    func testDescriptorsPreserveFieldOrder() {
        let descriptors = FormEngine.descriptors(for: Fixtures.allFieldTypesRecordType)
        XCTAssertEqual(
            descriptors.map(\.key),
            ["name", "price", "status", "services", "openedOn", "hasGenerator", "storefrontPhoto", "pinLocation"]
        )
    }

    func testDescriptorCountMatchesFieldCount() {
        let descriptors = FormEngine.descriptors(for: Fixtures.allFieldTypesRecordType)
        XCTAssertEqual(descriptors.count, Fixtures.allFieldTypesRecordType.fields.count)
    }

    func testEveryPlatformFieldTypeMapsToExpectedControlKind() {
        let expected: [PlatformFieldType: FormControlKind] = [
            .text: .text,
            .number: .number,
            .select: .singleSelect,
            .multiSelect: .multiSelect,
            .date: .date,
            .boolean: .boolean,
            .photo: .photo,
            .gps: .gps,
        ]
        for fieldType in PlatformFieldType.allCases {
            XCTAssertEqual(
                FormControlKind(fieldType: fieldType),
                expected[fieldType],
                "unexpected control kind for \(fieldType)"
            )
        }
        // Guard against a new PlatformFieldType being added without a
        // matching expectation above.
        XCTAssertEqual(PlatformFieldType.allCases.count, expected.count)
    }

    func testDescriptorCarriesFieldMetadata() {
        let descriptors = FormEngine.descriptors(for: Fixtures.allFieldTypesRecordType)
        let price = descriptors.first { $0.key == "price" }
        XCTAssertEqual(price?.control, .number)
        XCTAssertEqual(price?.required, true)
        XCTAssertEqual(price?.min, 0)
        XCTAssertEqual(price?.max, 100000)

        let status = descriptors.first { $0.key == "status" }
        XCTAssertEqual(status?.control, .singleSelect)
        XCTAssertEqual(status?.options.map(\.value), ["open", "closed"])
    }

    func testDescriptorDefaultsOptionsToEmptyArrayWhenFieldHasNone() {
        let recordType = PlatformRecordType(
            key: "r",
            label: Fixtures.label("R"),
            fields: [
                PlatformFieldDefinition(key: "name", label: Fixtures.label("Name"), type: .text, required: true, options: nil)
            ],
            evidence: PlatformEvidenceRules(gpsRequired: false, minPhotos: 0, notesRequired: false)
        )
        let descriptors = FormEngine.descriptors(for: recordType)
        XCTAssertEqual(descriptors[0].options, [])
    }

    func testEmptyRecordTypeProducesNoDescriptors() {
        let recordType = PlatformRecordType(
            key: "empty",
            label: Fixtures.label("Empty"),
            fields: [],
            evidence: PlatformEvidenceRules(gpsRequired: false, minPhotos: 0, notesRequired: false)
        )
        XCTAssertEqual(FormEngine.descriptors(for: recordType), [])
    }
}
