import XCTest
import ConsoleModels
@testable import ConsoleForms

/// Covers `SchemaValidator` — the port of `validateSchemaDefinition` in
/// `shared/platformSchema.ts` (web, read-only reference). Each rule gets a
/// passing case and a failing case, cross-checked against the zod schema in
/// that file (see `SchemaValidator`'s doc comment for the exact mapping).
final class SchemaValidationTests: XCTestCase {
    private func label(_ en: String = "Label", _ fr: String = "Libellé") -> BilingualLabel {
        BilingualLabel(en: en, fr: fr)
    }

    private func validField(key: String = "field_one", type: PlatformFieldType = .text, options: [PlatformFieldOption]? = nil, min: Double? = nil, max: Double? = nil) -> PlatformFieldDefinition {
        PlatformFieldDefinition(key: key, label: label(), type: type, required: false, options: options, min: min, max: max)
    }

    private func validEvidence() -> PlatformEvidenceRules {
        PlatformEvidenceRules(gpsRequired: false, minPhotos: 0, notesRequired: false)
    }

    private func validRecordType(key: String = "pharmacy", fields: [PlatformFieldDefinition]? = nil, evidence: PlatformEvidenceRules? = nil) -> PlatformRecordType {
        PlatformRecordType(key: key, label: label(), fields: fields ?? [validField()], evidence: evidence ?? validEvidence())
    }

    private func definition(_ recordTypes: [PlatformRecordType]) -> PlatformSchemaDefinition {
        PlatformSchemaDefinition(recordTypes: recordTypes)
    }

    // MARK: - Baseline valid definition

    func testMinimalValidDefinitionHasNoIssues() {
        let issues = SchemaValidator.validate(definition([validRecordType()]))
        XCTAssertTrue(issues.isEmpty, "unexpected issues: \(issues)")
        XCTAssertTrue(SchemaValidator.isValid(definition([validRecordType()])))
    }

    // MARK: - recordTypes.min(1)

    func testEmptyRecordTypesFails() {
        let issues = SchemaValidator.validate(definition([]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes" && $0.message == "Define at least one record type" })
    }

    // MARK: - Key pattern (KEY_PATTERN, record type + field)

    func testRecordTypeKeyMustBeSnakeCase() {
        let badKeys = ["Not_Valid", "1starts_with_digit", "has space", "a", "UPPER", ""]
        for badKey in badKeys {
            let issues = SchemaValidator.validate(definition([validRecordType(key: badKey)]))
            XCTAssertTrue(
                issues.contains { $0.path == "recordTypes.0.key" },
                "expected key issue for \"\(badKey)\", got: \(issues)"
            )
        }
    }

    func testRecordTypeKeyValidSnakeCasePasses() {
        for goodKey in ["pharmacy", "fuel_station_2", "az"] {
            let issues = SchemaValidator.validate(definition([validRecordType(key: goodKey)]))
            XCTAssertTrue(issues.isEmpty, "expected no issues for \"\(goodKey)\", got: \(issues)")
        }
    }

    func testFieldKeyMustBeSnakeCase() {
        let issues = SchemaValidator.validate(definition([validRecordType(fields: [validField(key: "Bad Key")])]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.fields.0.key" })
    }

    // MARK: - Bilingual label required

    func testRecordTypeLabelEmptyEnglishFails() {
        var recordType = validRecordType()
        recordType.label = BilingualLabel(en: "  ", fr: "Libellé")
        let issues = SchemaValidator.validate(definition([recordType]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.label.en" && $0.message == "English label is required" })
    }

    func testRecordTypeLabelEmptyFrenchFails() {
        var recordType = validRecordType()
        recordType.label = BilingualLabel(en: "Label", fr: "")
        let issues = SchemaValidator.validate(definition([recordType]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.label.fr" && $0.message == "French label is required" })
    }

    func testFieldLabelBothLanguagesRequiredPasses() {
        let recordType = validRecordType(fields: [validField()])
        XCTAssertTrue(SchemaValidator.validate(definition([recordType])).isEmpty)
    }

    // MARK: - fields.min(1)

    func testRecordTypeWithNoFieldsFails() {
        let recordType = validRecordType(fields: [])
        let issues = SchemaValidator.validate(definition([recordType]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.fields" && $0.message == "Each record type needs at least one field" })
    }

    // MARK: - Duplicate keys (cross-field, only checked once phase 1 passes)

    func testDuplicateRecordTypeKeyFails() {
        let issues = SchemaValidator.validate(definition([validRecordType(key: "dup"), validRecordType(key: "dup")]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.1.key" && $0.message.contains("Duplicate record type key") })
    }

    func testUniqueRecordTypeKeysPasses() {
        let issues = SchemaValidator.validate(definition([validRecordType(key: "aa"), validRecordType(key: "bb")]))
        XCTAssertTrue(issues.isEmpty)
    }

    func testDuplicateFieldKeyWithinTypeFails() {
        let recordType = validRecordType(fields: [validField(key: "dup"), validField(key: "dup")])
        let issues = SchemaValidator.validate(definition([recordType]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.fields.1.key" && $0.message.contains("Duplicate field key") })
    }

    func testSameFieldKeyAcrossDifferentTypesPasses() {
        let issues = SchemaValidator.validate(definition([
            validRecordType(key: "aa", fields: [validField(key: "shared")]),
            validRecordType(key: "bb", fields: [validField(key: "shared")]),
        ]))
        XCTAssertTrue(issues.isEmpty)
    }

    // MARK: - Select/multi_select require >=1 option

    func testSelectFieldWithNoOptionsFails() {
        let recordType = validRecordType(fields: [validField(type: .select, options: [])])
        let issues = SchemaValidator.validate(definition([recordType]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.fields.0.options" })
    }

    func testSelectFieldWithNilOptionsFails() {
        let recordType = validRecordType(fields: [validField(type: .select, options: nil)])
        let issues = SchemaValidator.validate(definition([recordType]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.fields.0.options" && $0.message == "Select fields require at least one option" })
    }

    func testMultiSelectFieldWithOptionPasses() {
        let recordType = validRecordType(fields: [
            validField(type: .multiSelect, options: [PlatformFieldOption(value: "a", label: label())]),
        ])
        XCTAssertTrue(SchemaValidator.validate(definition([recordType])).isEmpty)
    }

    func testNonSelectFieldWithOptionsFails() {
        let recordType = validRecordType(fields: [
            validField(type: .text, options: [PlatformFieldOption(value: "a", label: label())]),
        ])
        let issues = SchemaValidator.validate(definition([recordType]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.fields.0.options" && $0.message == "Options are only allowed on select fields" })
    }

    // MARK: - min/max only on number fields

    func testMinMaxOnNonNumberFieldFails() {
        let recordType = validRecordType(fields: [validField(type: .text, min: 1)])
        let issues = SchemaValidator.validate(definition([recordType]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.fields.0" && $0.message == "min/max are only allowed on number fields" })
    }

    func testMinMaxOnNumberFieldPasses() {
        let recordType = validRecordType(fields: [validField(type: .number, min: 1, max: 10)])
        XCTAssertTrue(SchemaValidator.validate(definition([recordType])).isEmpty)
    }

    // MARK: - min <= max

    func testMinGreaterThanMaxFails() {
        let recordType = validRecordType(fields: [validField(type: .number, min: 10, max: 1)])
        let issues = SchemaValidator.validate(definition([recordType]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.fields.0" && $0.message == "min must be less than or equal to max" })
    }

    func testMinEqualToMaxPasses() {
        let recordType = validRecordType(fields: [validField(type: .number, min: 5, max: 5)])
        XCTAssertTrue(SchemaValidator.validate(definition([recordType])).isEmpty)
    }

    // MARK: - Evidence: gpsAccuracyMeters bounds

    func testGpsAccuracyMustBePositive() {
        var evidence = validEvidence()
        evidence.gpsRequired = true
        evidence.gpsAccuracyMeters = 0
        let issues = SchemaValidator.validate(definition([validRecordType(evidence: evidence)]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.evidence.gpsAccuracyMeters" })
    }

    func testGpsAccuracyWithinBoundsPasses() {
        var evidence = validEvidence()
        evidence.gpsAccuracyMeters = 25
        XCTAssertTrue(SchemaValidator.validate(definition([validRecordType(evidence: evidence)])).isEmpty)
    }

    // MARK: - Evidence: minPhotos bounds (0...10)

    func testMinPhotosBelowZeroFails() {
        var evidence = validEvidence()
        evidence.minPhotos = -1
        let issues = SchemaValidator.validate(definition([validRecordType(evidence: evidence)]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.evidence.minPhotos" })
    }

    func testMinPhotosAboveTenFails() {
        var evidence = validEvidence()
        evidence.minPhotos = 11
        let issues = SchemaValidator.validate(definition([validRecordType(evidence: evidence)]))
        XCTAssertTrue(issues.contains { $0.path == "recordTypes.0.evidence.minPhotos" })
    }

    func testMinPhotosWithinBoundsPasses() {
        var evidence = validEvidence()
        evidence.minPhotos = 10
        XCTAssertTrue(SchemaValidator.validate(definition([validRecordType(evidence: evidence)])).isEmpty)
    }

    // MARK: - Phase ordering: phase-1 failure short-circuits phase-2 cross-field checks

    func testPhase1FailureSkipsCrossFieldChecks() {
        // Two record types share a key (a phase-2 duplicate-key violation)
        // AND the first has an invalid key pattern (a phase-1 violation).
        // Only the phase-1 issue should be reported.
        let issues = SchemaValidator.validate(definition([
            validRecordType(key: "Not Valid"),
            validRecordType(key: "Not Valid"),
        ]))
        XCTAssertTrue(issues.contains { $0.message == "Key must be snake_case (a-z, 0-9, _), 2-40 chars" })
        XCTAssertFalse(issues.contains { $0.message.contains("Duplicate record type key") })
    }
}
