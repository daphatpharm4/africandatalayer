import XCTest
import ConsoleModels
@testable import ConsoleForms

final class FormValidatorTests: XCTestCase {
    private func satisfiedEvidence(for recordType: PlatformRecordType) -> FormEvidenceInput {
        FormEvidenceInput(
            gps: FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 5),
            photoCount: max(recordType.evidence.minPhotos, 0),
            notes: recordType.evidence.notesRequired ? "some notes" : nil
        )
    }

    // MARK: - All-required, all-filled -> valid

    func testAllFieldTypesValidWhenFullyAndValidlyFilled() {
        let recordType = Fixtures.allFieldTypesRecordType
        let result = FormValidator.validate(
            recordType: recordType,
            values: Fixtures.validValues(for: recordType),
            evidence: satisfiedEvidence(for: recordType)
        )
        XCTAssertTrue(result.isValid, "expected valid, got errors: \(result.fieldErrors) \(result.evidenceErrors)")
    }

    // MARK: - Required-empty, per field type

    func testTextFieldRequiredEmptyFails() {
        assertRequiredFails(key: "name", input: .text(""))
        assertRequiredFails(key: "name", input: .text("   "))
    }

    func testNumberFieldRequiredEmptyFails() {
        assertRequiredFails(key: "price", input: .numberText(""))
        assertRequiredFails(key: "price", input: .numberText("   "))
    }

    func testSelectFieldRequiredEmptyFails() {
        assertRequiredFails(key: "status", input: .select(nil))
        assertRequiredFails(key: "status", input: .select(""))
    }

    func testMultiSelectFieldRequiredEmptyFails() {
        assertRequiredFails(key: "services", input: .multiSelect([]))
    }

    func testDateFieldRequiredEmptyFails() {
        assertRequiredFails(key: "openedOn", input: .date(""))
    }

    func testPhotoFieldRequiredEmptyFails() {
        assertRequiredFails(key: "storefrontPhoto", input: .photo(nil))
        assertRequiredFails(key: "storefrontPhoto", input: .photo(""))
    }

    func testGpsFieldRequiredEmptyFails() {
        assertRequiredFails(key: "pinLocation", input: .gps(nil))
    }

    func testBooleanFieldIsNeverRequiredEmpty() {
        // false is a complete answer for a boolean field, even when required.
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values["hasGenerator"] = .boolean(false)
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertNil(result.error(for: "hasGenerator"))
    }

    func testMissingKeyInValuesMapTreatedAsEmpty() {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values.removeValue(forKey: "name")
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertEqual(result.error(for: "name")?.reason, .required)
    }

    private func assertRequiredFails(key: String, input: FormFieldInput, file: StaticString = #filePath, line: UInt = #line) {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values[key] = input
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertEqual(result.error(for: key)?.reason, .required, file: file, line: line)
    }

    // MARK: - Optional fields pass when empty

    func testAllFieldTypesPassWhenOptionalAndEmpty() {
        let recordType = Fixtures.allFieldTypesOptionalRecordType
        var values: FormValues = [:]
        for field in recordType.fields {
            values[field.key] = .empty(for: FormControlKind(fieldType: field.type))
        }
        let result = FormValidator.validate(
            recordType: recordType,
            values: values,
            evidence: FormEvidenceInput()
        )
        XCTAssertTrue(result.isValid, "expected valid, got errors: \(result.fieldErrors)")
    }

    // MARK: - Number parsing + bounds

    func testNumberFieldInvalidTextFails() {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values["price"] = .numberText("not-a-number")
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertEqual(result.error(for: "price")?.reason, .invalidNumber)
    }

    func testNumberFieldBelowMinimumFails() {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values["price"] = .numberText("-5")
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertEqual(result.error(for: "price")?.reason, .belowMinimum(0))
    }

    func testNumberFieldAboveMaximumFails() {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values["price"] = .numberText("999999")
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertEqual(result.error(for: "price")?.reason, .aboveMaximum(100000))
    }

    func testNumberFieldAtExactBoundsPasses() {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values["price"] = .numberText("0")
        var result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertNil(result.error(for: "price"))

        values["price"] = .numberText("100000")
        result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertNil(result.error(for: "price"))
    }

    // MARK: - Select / multi-select option membership

    func testSelectValueNotInOptionsFails() {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values["status"] = .select("permanently-closed")
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertEqual(result.error(for: "status")?.reason, .invalidSelectValue)
    }

    func testSelectValueInOptionsPasses() {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values["status"] = .select("closed")
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertNil(result.error(for: "status"))
    }

    func testMultiSelectSubsetOfOptionsPasses() {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values["services"] = .multiSelect(["diesel"])
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertNil(result.error(for: "services"))
    }

    func testMultiSelectValueOutsideOptionsFails() {
        var values = Fixtures.validValues(for: Fixtures.allFieldTypesRecordType)
        values["services"] = .multiSelect(["diesel", "kerosene"])
        let result = FormValidator.validate(
            recordType: Fixtures.allFieldTypesRecordType,
            values: values,
            evidence: satisfiedEvidence(for: Fixtures.allFieldTypesRecordType)
        )
        XCTAssertEqual(result.error(for: "services")?.reason, .invalidMultiSelectValue)
    }

    // MARK: - Evidence rules

    func testGpsRequiredMissingFails() {
        let recordType = Fixtures.strictEvidenceRecordType
        let result = FormValidator.validate(
            recordType: recordType,
            values: ["name": .text("Acme")],
            evidence: FormEvidenceInput(gps: nil, photoCount: 2, notes: "notes")
        )
        XCTAssertTrue(result.evidenceErrors.contains(.gpsRequired))
    }

    func testGpsRequiredPresentPasses() {
        let recordType = Fixtures.strictEvidenceRecordType
        let result = FormValidator.validate(
            recordType: recordType,
            values: ["name": .text("Acme")],
            evidence: FormEvidenceInput(
                gps: FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 10),
                photoCount: 2,
                notes: "notes"
            )
        )
        XCTAssertFalse(result.evidenceErrors.contains(.gpsRequired))
    }

    func testGpsAccuracyWorseThanRequiredFails() {
        let recordType = Fixtures.strictEvidenceRecordType // requires <= 20m accuracy
        let result = FormValidator.validate(
            recordType: recordType,
            values: ["name": .text("Acme")],
            evidence: FormEvidenceInput(
                gps: FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 45),
                photoCount: 2,
                notes: "notes"
            )
        )
        XCTAssertEqual(result.evidenceErrors, [.gpsAccuracyTooLow(requiredMeters: 20, actualMeters: 45)])
    }

    func testGpsAccuracyMissingDoesNotFailAccuracyCheck() {
        // A GPS fix with no reported accuracy can't be judged against the
        // threshold — only presence/absence is enforced in that case.
        let recordType = Fixtures.strictEvidenceRecordType
        let result = FormValidator.validate(
            recordType: recordType,
            values: ["name": .text("Acme")],
            evidence: FormEvidenceInput(
                gps: FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: nil),
                photoCount: 2,
                notes: "notes"
            )
        )
        XCTAssertTrue(result.evidenceErrors.isEmpty)
    }

    func testNotEnoughPhotosFails() {
        let recordType = Fixtures.strictEvidenceRecordType // minPhotos: 2
        let result = FormValidator.validate(
            recordType: recordType,
            values: ["name": .text("Acme")],
            evidence: FormEvidenceInput(
                gps: FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 5),
                photoCount: 1,
                notes: "notes"
            )
        )
        XCTAssertEqual(result.evidenceErrors, [.notEnoughPhotos(required: 2, actual: 1)])
    }

    func testExactlyMinPhotosPasses() {
        let recordType = Fixtures.strictEvidenceRecordType
        let result = FormValidator.validate(
            recordType: recordType,
            values: ["name": .text("Acme")],
            evidence: FormEvidenceInput(
                gps: FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 5),
                photoCount: 2,
                notes: "notes"
            )
        )
        XCTAssertFalse(result.evidenceErrors.contains { if case .notEnoughPhotos = $0 { return true }; return false })
    }

    func testNotesRequiredMissingFails() {
        let recordType = Fixtures.strictEvidenceRecordType
        let result = FormValidator.validate(
            recordType: recordType,
            values: ["name": .text("Acme")],
            evidence: FormEvidenceInput(
                gps: FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 5),
                photoCount: 2,
                notes: "   "
            )
        )
        XCTAssertTrue(result.evidenceErrors.contains(.notesRequired))
    }

    func testMultipleEvidenceErrorsAllReported() {
        let recordType = Fixtures.strictEvidenceRecordType
        let result = FormValidator.validate(
            recordType: recordType,
            values: ["name": .text("Acme")],
            evidence: FormEvidenceInput(gps: nil, photoCount: 0, notes: nil)
        )
        XCTAssertEqual(result.evidenceErrors.count, 3)
        XCTAssertTrue(result.evidenceErrors.contains(.gpsRequired))
        XCTAssertTrue(result.evidenceErrors.contains(.notEnoughPhotos(required: 2, actual: 0)))
        XCTAssertTrue(result.evidenceErrors.contains(.notesRequired))
    }

    func testEvidenceRulesNotEnforcedWhenDisabled() {
        let recordType = PlatformRecordType(
            key: "lenient",
            label: Fixtures.label("Lenient"),
            fields: [],
            evidence: PlatformEvidenceRules(gpsRequired: false, gpsAccuracyMeters: nil, minPhotos: 0, notesRequired: false)
        )
        let result = FormValidator.validate(recordType: recordType, values: [:], evidence: FormEvidenceInput())
        XCTAssertTrue(result.evidenceErrors.isEmpty)
    }

    // MARK: - recordData construction

    func testRecordDataBuildsExpectedJSONShapePerFieldType() {
        let recordType = Fixtures.allFieldTypesRecordType
        let values = Fixtures.validValues(for: recordType)
        let data = FormValidator.recordData(recordType: recordType, values: values)

        XCTAssertEqual(data["name"], .string("Acme Pharmacy"))
        XCTAssertEqual(data["price"], .number(42))
        XCTAssertEqual(data["status"], .string("open"))
        XCTAssertEqual(data["services"], .array([.string("diesel"), .string("petrol")]))
        XCTAssertEqual(data["openedOn"], .string("2026-07-01"))
        XCTAssertEqual(data["hasGenerator"], .bool(true))
        XCTAssertEqual(data["storefrontPhoto"], .string("local-photo-ref-1"))
        if case .object(let gpsObject)? = data["pinLocation"] {
            XCTAssertEqual(gpsObject["latitude"], .number(4.05))
            XCTAssertEqual(gpsObject["longitude"], .number(9.7))
        } else {
            XCTFail("expected pinLocation to encode as a JSON object")
        }
    }

    func testRecordDataDegradesInvalidNumberToNull() {
        let recordType = Fixtures.allFieldTypesRecordType
        var values = Fixtures.validValues(for: recordType)
        values["price"] = .numberText("not-a-number")
        let data = FormValidator.recordData(recordType: recordType, values: values)
        XCTAssertEqual(data["price"], .null)
    }

    func testRecordDataFillsMissingKeysWithEmptyDefault() {
        let recordType = Fixtures.allFieldTypesRecordType
        let data = FormValidator.recordData(recordType: recordType, values: [:])
        XCTAssertEqual(data["name"], .string(""))
        XCTAssertEqual(data["hasGenerator"], .bool(false))
        XCTAssertEqual(data["storefrontPhoto"], .null)
        XCTAssertEqual(data["pinLocation"], .null)
    }
}
