import XCTest
import ConsoleModels
@testable import ConsoleForms

/// Covers `SchemaEditorModel` — Task 7b's schema-edit mutation model. Every
/// mutation test is a direct port of one `BuilderAction` case in
/// `lib/client/consoleState.ts`'s `builderReducer` (web, read-only
/// reference); see the doc comment on each `SchemaEditorModel` method for
/// which action it ports.
final class SchemaEditorModelTests: XCTestCase {
    private func oneFieldRecordType(key: String = "record_type_1") -> PlatformRecordType {
        PlatformRecordType(
            key: key,
            label: BilingualLabel(en: "Type", fr: "Type"),
            fields: [
                PlatformFieldDefinition(key: "field_1", label: BilingualLabel(en: "Field", fr: "Champ"), type: .text, required: false),
            ],
            evidence: PlatformEvidenceRules(gpsRequired: false, minPhotos: 0, notesRequired: false)
        )
    }

    private func model(recordTypes: [PlatformRecordType]) -> SchemaEditorModel {
        SchemaEditorModel(definition: PlatformSchemaDefinition(recordTypes: recordTypes))
    }

    // MARK: - Empty-value factories

    func testEmptyFieldMatchesWebDefaults() {
        let field = SchemaEditorModel.emptyField(index: 0)
        XCTAssertEqual(field.key, "field_1")
        XCTAssertEqual(field.label, BilingualLabel(en: "", fr: ""))
        XCTAssertEqual(field.type, .text)
        XCTAssertFalse(field.required)
        XCTAssertNil(field.options)
    }

    func testEmptyRecordTypeMatchesWebDefaults() {
        let recordType = SchemaEditorModel.emptyRecordType(index: 2)
        XCTAssertEqual(recordType.key, "record_type_3")
        XCTAssertEqual(recordType.fields.count, 1)
        XCTAssertEqual(recordType.fields[0].key, "field_1")
        XCTAssertTrue(recordType.evidence.gpsRequired)
        XCTAssertEqual(recordType.evidence.minPhotos, 0)
        XCTAssertFalse(recordType.evidence.notesRequired)
    }

    func testEmptyModelSeedsSingleEmptyRecordType() {
        let editor = SchemaEditorModel.empty()
        XCTAssertEqual(editor.definition.recordTypes.count, 1)
        XCTAssertEqual(editor.definition.recordTypes[0].key, "record_type_1")
    }

    // MARK: - Record type mutations

    func testAddRecordTypeAppendsWithSequentialDefaultKey() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.addRecordType()
        XCTAssertEqual(editor.definition.recordTypes.count, 2)
        XCTAssertEqual(editor.definition.recordTypes[1].key, "record_type_2")
    }

    func testRemoveRecordTypeDeletesAtIndex() {
        var editor = model(recordTypes: [oneFieldRecordType(key: "a"), oneFieldRecordType(key: "b")])
        editor.removeRecordType(at: 0)
        XCTAssertEqual(editor.definition.recordTypes.map(\.key), ["b"])
    }

    func testRemoveRecordTypeOutOfRangeIsNoOp() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.removeRecordType(at: 5)
        XCTAssertEqual(editor.definition.recordTypes.count, 1)
    }

    func testMoveRecordTypeReorders() {
        var editor = model(recordTypes: [oneFieldRecordType(key: "a"), oneFieldRecordType(key: "b"), oneFieldRecordType(key: "c")])
        editor.moveRecordType(fromOffsets: [0], toOffset: 3)
        XCTAssertEqual(editor.definition.recordTypes.map(\.key), ["b", "c", "a"])
    }

    func testSetRecordTypeKeyUpdatesOnlyTargetIndex() {
        var editor = model(recordTypes: [oneFieldRecordType(key: "a"), oneFieldRecordType(key: "b")])
        editor.setRecordTypeKey(at: 1, value: "renamed")
        XCTAssertEqual(editor.definition.recordTypes.map(\.key), ["a", "renamed"])
    }

    func testSetRecordTypeLabelUpdatesOnlyTargetLanguage() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setRecordTypeLabel(at: 0, lang: .en, value: "Pharmacy")
        XCTAssertEqual(editor.definition.recordTypes[0].label.en, "Pharmacy")
        XCTAssertEqual(editor.definition.recordTypes[0].label.fr, "Type")

        editor.setRecordTypeLabel(at: 0, lang: .fr, value: "Pharmacie")
        XCTAssertEqual(editor.definition.recordTypes[0].label.fr, "Pharmacie")
        XCTAssertEqual(editor.definition.recordTypes[0].label.en, "Pharmacy")
    }

    // MARK: - Field mutations

    func testAddFieldAppendsWithSequentialDefaultKey() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.addField(typeIndex: 0)
        XCTAssertEqual(editor.definition.recordTypes[0].fields.map(\.key), ["field_1", "field_2"])
    }

    func testRemoveFieldDeletesAtIndex() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.addField(typeIndex: 0)
        editor.removeField(typeIndex: 0, fieldIndex: 0)
        XCTAssertEqual(editor.definition.recordTypes[0].fields.map(\.key), ["field_2"])
    }

    func testRemoveFieldOutOfRangeIsNoOp() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.removeField(typeIndex: 0, fieldIndex: 9)
        XCTAssertEqual(editor.definition.recordTypes[0].fields.count, 1)
        editor.removeField(typeIndex: 9, fieldIndex: 0)
        XCTAssertEqual(editor.definition.recordTypes[0].fields.count, 1)
    }

    func testMoveFieldReorders() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.addField(typeIndex: 0)
        editor.addField(typeIndex: 0)
        editor.moveField(typeIndex: 0, fromOffsets: [0], toOffset: 3)
        XCTAssertEqual(editor.definition.recordTypes[0].fields.map(\.key), ["field_2", "field_3", "field_1"])
    }

    func testSetFieldKeyUpdatesOnlyTargetField() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.addField(typeIndex: 0)
        editor.setFieldKey(typeIndex: 0, fieldIndex: 1, value: "renamed")
        XCTAssertEqual(editor.definition.recordTypes[0].fields.map(\.key), ["field_1", "renamed"])
    }

    func testSetFieldLabelUpdatesOnlyTargetLanguage() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldLabel(typeIndex: 0, fieldIndex: 0, lang: .en, value: "Name")
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].label.en, "Name")
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].label.fr, "Champ")
    }

    func testSetFieldRequiredSetsExplicitValue() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldRequired(typeIndex: 0, fieldIndex: 0, value: true)
        XCTAssertTrue(editor.definition.recordTypes[0].fields[0].required)
        editor.setFieldRequired(typeIndex: 0, fieldIndex: 0, value: false)
        XCTAssertFalse(editor.definition.recordTypes[0].fields[0].required)
    }

    func testSetFieldMinMaxAcceptNilAndValue() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .number)
        editor.setFieldMin(typeIndex: 0, fieldIndex: 0, value: 1)
        editor.setFieldMax(typeIndex: 0, fieldIndex: 0, value: 10)
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].min, 1)
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].max, 10)
        editor.setFieldMin(typeIndex: 0, fieldIndex: 0, value: nil)
        XCTAssertNil(editor.definition.recordTypes[0].fields[0].min)
    }

    // MARK: - Field type change (port of handleFieldTypeChange)

    func testSetFieldTypeToSelectDefaultsOptionsToEmptyArray() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .select)
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].type, .select)
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].options, [])
    }

    func testSetFieldTypeToSelectPreservesExistingOptions() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .select)
        editor.addOption(typeIndex: 0, fieldIndex: 0)
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .multiSelect)
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].options?.count, 1)
    }

    func testSetFieldTypeAwayFromSelectClearsOptions() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .select)
        editor.addOption(typeIndex: 0, fieldIndex: 0)
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .text)
        XCTAssertNil(editor.definition.recordTypes[0].fields[0].options)
    }

    func testSetFieldTypeAwayFromNumberClearsMinMax() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .number)
        editor.setFieldMin(typeIndex: 0, fieldIndex: 0, value: 0)
        editor.setFieldMax(typeIndex: 0, fieldIndex: 0, value: 5)
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .text)
        XCTAssertNil(editor.definition.recordTypes[0].fields[0].min)
        XCTAssertNil(editor.definition.recordTypes[0].fields[0].max)
    }

    func testSetFieldTypeToNumberPreservesMinMax() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .number)
        editor.setFieldMin(typeIndex: 0, fieldIndex: 0, value: 2)
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .number)
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].min, 2)
    }

    // MARK: - Option mutations

    func testAddOptionAppendsWithSequentialDefaultValue() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .select)
        editor.addOption(typeIndex: 0, fieldIndex: 0)
        editor.addOption(typeIndex: 0, fieldIndex: 0)
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].options?.map(\.value), ["option_1", "option_2"])
    }

    func testSetOptionValueUpdatesOnlyTargetOption() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .select)
        editor.addOption(typeIndex: 0, fieldIndex: 0)
        editor.addOption(typeIndex: 0, fieldIndex: 0)
        editor.setOptionValue(typeIndex: 0, fieldIndex: 0, optionIndex: 1, value: "renamed")
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].options?.map(\.value), ["option_1", "renamed"])
    }

    func testSetOptionLabelUpdatesOnlyTargetLanguage() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .select)
        editor.addOption(typeIndex: 0, fieldIndex: 0)
        editor.setOptionLabel(typeIndex: 0, fieldIndex: 0, optionIndex: 0, lang: .en, value: "Yes")
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].options?[0].label.en, "Yes")
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].options?[0].label.fr, "")
    }

    func testRemoveOptionDeletesAtIndex() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .select)
        editor.addOption(typeIndex: 0, fieldIndex: 0)
        editor.addOption(typeIndex: 0, fieldIndex: 0)
        editor.removeOption(typeIndex: 0, fieldIndex: 0, optionIndex: 0)
        XCTAssertEqual(editor.definition.recordTypes[0].fields[0].options?.map(\.value), ["option_2"])
    }

    func testOptionMutationsOutOfRangeAreNoOps() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setOptionValue(typeIndex: 0, fieldIndex: 0, optionIndex: 0, value: "x")
        editor.removeOption(typeIndex: 0, fieldIndex: 0, optionIndex: 0)
        XCTAssertNil(editor.definition.recordTypes[0].fields[0].options)
    }

    // MARK: - Evidence mutations

    func testEvidenceMutationsSetExplicitValues() {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setEvidenceGpsRequired(typeIndex: 0, value: true)
        editor.setEvidenceGpsAccuracyMeters(typeIndex: 0, value: 25)
        editor.setEvidenceMinPhotos(typeIndex: 0, value: 3)
        editor.setEvidenceNotesRequired(typeIndex: 0, value: true)

        let evidence = editor.definition.recordTypes[0].evidence
        XCTAssertTrue(evidence.gpsRequired)
        XCTAssertEqual(evidence.gpsAccuracyMeters, 25)
        XCTAssertEqual(evidence.minPhotos, 3)
        XCTAssertTrue(evidence.notesRequired)

        editor.setEvidenceGpsAccuracyMeters(typeIndex: 0, value: nil)
        XCTAssertNil(editor.definition.recordTypes[0].evidence.gpsAccuracyMeters)
    }

    // MARK: - isValid / issues passthrough

    func testIsValidReflectsSchemaValidator() {
        let valid = model(recordTypes: [oneFieldRecordType()])
        XCTAssertTrue(valid.isValid)
        XCTAssertTrue(valid.issues.isEmpty)

        var invalid = valid
        invalid.setRecordTypeKey(at: 0, value: "Not Valid!")
        XCTAssertFalse(invalid.isValid)
        XCTAssertFalse(invalid.issues.isEmpty)
    }

    // MARK: - Dirty tracking

    func testIsDirtyTrueWhenNoBaselineSaved() {
        let editor = model(recordTypes: [oneFieldRecordType()])
        XCTAssertTrue(editor.isDirty(against: nil))
    }

    func testIsDirtyFalseWhenMatchesBaseline() {
        let editor = model(recordTypes: [oneFieldRecordType()])
        XCTAssertFalse(editor.isDirty(against: editor.definition))
    }

    func testIsDirtyTrueAfterMutationDivergesFromBaseline() {
        let editor = model(recordTypes: [oneFieldRecordType()])
        let baseline = editor.definition
        var mutated = editor
        mutated.setRecordTypeKey(at: 0, value: "changed")
        XCTAssertTrue(mutated.isDirty(against: baseline))
    }

    // MARK: - Save payload

    func testDraftPayloadRoundTripsThroughJSONCodable() throws {
        var editor = model(recordTypes: [oneFieldRecordType()])
        editor.setFieldType(typeIndex: 0, fieldIndex: 0, newType: .select)
        editor.addOption(typeIndex: 0, fieldIndex: 0)

        let payload = editor.draftPayload
        let encoded = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(PlatformSchemaDefinition.self, from: encoded)
        XCTAssertEqual(decoded, payload)
        XCTAssertEqual(decoded, editor.definition)
    }

    // MARK: - SchemaPublishGate

    func testCanPublishRequiresSavedDraftNotDirtyValidAndNotBusy() {
        XCTAssertTrue(SchemaPublishGate.canPublish(hasSavedDraft: true, isDirty: false, isValid: true, isBusy: false))
        XCTAssertFalse(SchemaPublishGate.canPublish(hasSavedDraft: false, isDirty: false, isValid: true, isBusy: false))
        XCTAssertFalse(SchemaPublishGate.canPublish(hasSavedDraft: true, isDirty: true, isValid: true, isBusy: false))
        XCTAssertFalse(SchemaPublishGate.canPublish(hasSavedDraft: true, isDirty: false, isValid: false, isBusy: false))
        XCTAssertFalse(SchemaPublishGate.canPublish(hasSavedDraft: true, isDirty: false, isValid: true, isBusy: true))
    }
}
