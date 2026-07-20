import ConsoleModels
import Foundation

/// Which side of a `BilingualLabel` a mutation targets — Schema Builder's
/// package-level stand-in for the app target's `ConsoleLanguage` (which this
/// package cannot depend on), used purely as a two-case selector.
public enum SchemaLabelLanguage: String, Sendable, Equatable {
    case en
    case fr
}

/// Editable wrapper around a `PlatformSchemaDefinition` — the pure,
/// CLI-testable model behind the Schema Builder screen (Task 7b). Every
/// mutation here is a direct, one-to-one port of an action in the web
/// `builderReducer` (`lib/client/consoleState.ts`, read-only reference); the
/// doc comment on each method names the `BuilderAction` case it ports.
///
/// SwiftUI stays thin: `SchemaBuilderViewModel` (app target) owns exactly one
/// `SchemaEditorModel`, forwards every user intent to a mutation here, and
/// reads `issues`/`isValid`/`isDirty(against:)` back out — no editing logic
/// lives in the view layer.
public struct SchemaEditorModel: Equatable, Sendable {
    public private(set) var definition: PlatformSchemaDefinition

    public init(definition: PlatformSchemaDefinition) {
        self.definition = definition
    }

    /// A brand-new editor seeded with a single empty record type — port of
    /// `{ recordTypes: [emptyRecordType(0)] }`, the `SchemaBuilderEditor`
    /// fallback used when a project has neither a draft nor a published
    /// schema yet.
    public static func empty() -> SchemaEditorModel {
        SchemaEditorModel(definition: PlatformSchemaDefinition(recordTypes: [emptyRecordType(index: 0)]))
    }

    // MARK: - Empty-value factories (port of emptyField/emptyRecordType/emptyOption)

    /// Port of `emptyField` in `consoleState.ts`.
    public static func emptyField(index: Int) -> PlatformFieldDefinition {
        PlatformFieldDefinition(
            key: "field_\(index + 1)",
            label: BilingualLabel(en: "", fr: ""),
            type: .text,
            required: false
        )
    }

    /// Port of `emptyRecordType` in `consoleState.ts`.
    public static func emptyRecordType(index: Int) -> PlatformRecordType {
        PlatformRecordType(
            key: "record_type_\(index + 1)",
            label: BilingualLabel(en: "", fr: ""),
            fields: [emptyField(index: 0)],
            evidence: PlatformEvidenceRules(gpsRequired: true, minPhotos: 0, notesRequired: false)
        )
    }

    /// Port of `emptyOption` in `consoleState.ts`.
    public static func emptyOption(index: Int) -> PlatformFieldOption {
        PlatformFieldOption(value: "option_\(index + 1)", label: BilingualLabel(en: "", fr: ""))
    }

    // MARK: - Record type mutations

    /// Port of `ADD_RECORD_TYPE`.
    public mutating func addRecordType() {
        definition.recordTypes.append(Self.emptyRecordType(index: definition.recordTypes.count))
    }

    /// Port of `REMOVE_RECORD_TYPE`. Out-of-range index is a no-op, matching
    /// the reducer's `.filter((_, index) => index !== action.typeIndex)`
    /// (which likewise silently does nothing for an index that isn't present).
    public mutating func removeRecordType(at index: Int) {
        guard definition.recordTypes.indices.contains(index) else { return }
        definition.recordTypes.remove(at: index)
    }

    /// Reorder record types. Not a `BuilderAction` case on the web (the
    /// reducer has no MOVE/REORDER action) — added per Task 7b's brief for
    /// drag-to-reorder in the SwiftUI list. Pure array move; does not affect
    /// validation or the save/publish payload shape.
    public mutating func moveRecordType(fromOffsets: IndexSet, toOffset: Int) {
        definition.recordTypes.adlMove(fromOffsets: fromOffsets, toOffset: toOffset)
    }

    /// Port of `SET_TYPE_KEY`.
    public mutating func setRecordTypeKey(at index: Int, value: String) {
        guard definition.recordTypes.indices.contains(index) else { return }
        definition.recordTypes[index].key = value
    }

    /// Port of `SET_TYPE_LABEL`.
    public mutating func setRecordTypeLabel(at index: Int, lang: SchemaLabelLanguage, value: String) {
        guard definition.recordTypes.indices.contains(index) else { return }
        switch lang {
        case .en: definition.recordTypes[index].label.en = value
        case .fr: definition.recordTypes[index].label.fr = value
        }
    }

    // MARK: - Field mutations

    /// Port of `ADD_FIELD`.
    public mutating func addField(typeIndex: Int) {
        guard definition.recordTypes.indices.contains(typeIndex) else { return }
        let fieldCount = definition.recordTypes[typeIndex].fields.count
        definition.recordTypes[typeIndex].fields.append(Self.emptyField(index: fieldCount))
    }

    /// Port of `REMOVE_FIELD`.
    public mutating func removeField(typeIndex: Int, fieldIndex: Int) {
        guard fieldExists(typeIndex: typeIndex, fieldIndex: fieldIndex) else { return }
        definition.recordTypes[typeIndex].fields.remove(at: fieldIndex)
    }

    /// Reorder fields within a record type. Same "not a web `BuilderAction`,
    /// added per brief" note as `moveRecordType` above.
    public mutating func moveField(typeIndex: Int, fromOffsets: IndexSet, toOffset: Int) {
        guard definition.recordTypes.indices.contains(typeIndex) else { return }
        definition.recordTypes[typeIndex].fields.adlMove(fromOffsets: fromOffsets, toOffset: toOffset)
    }

    /// Port of `UPDATE_FIELD` with `patch: { key: value }`.
    public mutating func setFieldKey(typeIndex: Int, fieldIndex: Int, value: String) {
        guard fieldExists(typeIndex: typeIndex, fieldIndex: fieldIndex) else { return }
        definition.recordTypes[typeIndex].fields[fieldIndex].key = value
    }

    /// Port of `UPDATE_FIELD` with `patch: { label: { ...field.label, [lang]: value } }`.
    public mutating func setFieldLabel(typeIndex: Int, fieldIndex: Int, lang: SchemaLabelLanguage, value: String) {
        guard fieldExists(typeIndex: typeIndex, fieldIndex: fieldIndex) else { return }
        switch lang {
        case .en: definition.recordTypes[typeIndex].fields[fieldIndex].label.en = value
        case .fr: definition.recordTypes[typeIndex].fields[fieldIndex].label.fr = value
        }
    }

    /// Port of `UPDATE_FIELD` with `patch: { required: !field.required }`
    /// (generalized to set an explicit value rather than only toggle).
    public mutating func setFieldRequired(typeIndex: Int, fieldIndex: Int, value: Bool) {
        guard fieldExists(typeIndex: typeIndex, fieldIndex: fieldIndex) else { return }
        definition.recordTypes[typeIndex].fields[fieldIndex].required = value
    }

    /// Port of `UPDATE_FIELD` with `patch: { min: ... }` — the min-value
    /// number input's `onChange` sends `undefined` for an empty string,
    /// otherwise the parsed number, ported as `nil` / `.some(value)`.
    public mutating func setFieldMin(typeIndex: Int, fieldIndex: Int, value: Double?) {
        guard fieldExists(typeIndex: typeIndex, fieldIndex: fieldIndex) else { return }
        definition.recordTypes[typeIndex].fields[fieldIndex].min = value
    }

    /// Port of `UPDATE_FIELD` with `patch: { max: ... }`, mirroring `setFieldMin`.
    public mutating func setFieldMax(typeIndex: Int, fieldIndex: Int, value: Double?) {
        guard fieldExists(typeIndex: typeIndex, fieldIndex: fieldIndex) else { return }
        definition.recordTypes[typeIndex].fields[fieldIndex].max = value
    }

    /// Port of `handleFieldTypeChange` in `SchemaBuilder.tsx` (not the bare
    /// `UPDATE_FIELD` reducer case — this mirrors the screen's own patch
    /// assembly before dispatching): changing a field's type also resets
    /// `options` (kept, defaulting to `[]`, only for `.select`/`.multiSelect`;
    /// cleared to `nil` otherwise) and clears `min`/`max` unless the new type
    /// is `.number`.
    public mutating func setFieldType(typeIndex: Int, fieldIndex: Int, newType: PlatformFieldType) {
        guard fieldExists(typeIndex: typeIndex, fieldIndex: fieldIndex) else { return }
        let existingOptions = definition.recordTypes[typeIndex].fields[fieldIndex].options
        definition.recordTypes[typeIndex].fields[fieldIndex].type = newType
        if newType == .select || newType == .multiSelect {
            definition.recordTypes[typeIndex].fields[fieldIndex].options = existingOptions ?? []
        } else {
            definition.recordTypes[typeIndex].fields[fieldIndex].options = nil
        }
        if newType != .number {
            definition.recordTypes[typeIndex].fields[fieldIndex].min = nil
            definition.recordTypes[typeIndex].fields[fieldIndex].max = nil
        }
    }

    // MARK: - Option mutations (select / multi_select fields)

    /// Port of `ADD_OPTION`.
    public mutating func addOption(typeIndex: Int, fieldIndex: Int) {
        guard fieldExists(typeIndex: typeIndex, fieldIndex: fieldIndex) else { return }
        var options = definition.recordTypes[typeIndex].fields[fieldIndex].options ?? []
        options.append(Self.emptyOption(index: options.count))
        definition.recordTypes[typeIndex].fields[fieldIndex].options = options
    }

    /// Port of `UPDATE_OPTION` with `patch: { value }`.
    public mutating func setOptionValue(typeIndex: Int, fieldIndex: Int, optionIndex: Int, value: String) {
        guard optionExists(typeIndex: typeIndex, fieldIndex: fieldIndex, optionIndex: optionIndex) else { return }
        definition.recordTypes[typeIndex].fields[fieldIndex].options?[optionIndex].value = value
    }

    /// Port of `UPDATE_OPTION` with `patch: { label: { ...option.label, [lang]: value } }`.
    public mutating func setOptionLabel(
        typeIndex: Int,
        fieldIndex: Int,
        optionIndex: Int,
        lang: SchemaLabelLanguage,
        value: String
    ) {
        guard optionExists(typeIndex: typeIndex, fieldIndex: fieldIndex, optionIndex: optionIndex) else { return }
        switch lang {
        case .en: definition.recordTypes[typeIndex].fields[fieldIndex].options?[optionIndex].label.en = value
        case .fr: definition.recordTypes[typeIndex].fields[fieldIndex].options?[optionIndex].label.fr = value
        }
    }

    /// Port of `REMOVE_OPTION`.
    public mutating func removeOption(typeIndex: Int, fieldIndex: Int, optionIndex: Int) {
        guard optionExists(typeIndex: typeIndex, fieldIndex: fieldIndex, optionIndex: optionIndex) else { return }
        definition.recordTypes[typeIndex].fields[fieldIndex].options?.remove(at: optionIndex)
    }

    // MARK: - Evidence mutations

    /// Port of `UPDATE_EVIDENCE` with `patch: { gpsRequired: !evidence.gpsRequired }`
    /// (generalized to set an explicit value).
    public mutating func setEvidenceGpsRequired(typeIndex: Int, value: Bool) {
        guard definition.recordTypes.indices.contains(typeIndex) else { return }
        definition.recordTypes[typeIndex].evidence.gpsRequired = value
    }

    /// Port of `UPDATE_EVIDENCE` with `patch: { gpsAccuracyMeters: ... }` —
    /// the accuracy input's `onChange` sends `undefined` for an empty
    /// string, otherwise the parsed number.
    public mutating func setEvidenceGpsAccuracyMeters(typeIndex: Int, value: Double?) {
        guard definition.recordTypes.indices.contains(typeIndex) else { return }
        definition.recordTypes[typeIndex].evidence.gpsAccuracyMeters = value
    }

    /// Port of `UPDATE_EVIDENCE` with `patch: { minPhotos: ... }`. The web's
    /// +/- stepper buttons clamp to `Math.max(0, ...)` / `Math.min(10, ...)`
    /// themselves *before* dispatching — the reducer case itself does not
    /// clamp — so this setter mirrors the reducer exactly and takes the
    /// already-clamped value as-is; the SwiftUI stepper is responsible for
    /// clamping before calling this, same division of labor as the web.
    public mutating func setEvidenceMinPhotos(typeIndex: Int, value: Int) {
        guard definition.recordTypes.indices.contains(typeIndex) else { return }
        definition.recordTypes[typeIndex].evidence.minPhotos = value
    }

    /// Port of `UPDATE_EVIDENCE` with `patch: { notesRequired: !evidence.notesRequired }`.
    public mutating func setEvidenceNotesRequired(typeIndex: Int, value: Bool) {
        guard definition.recordTypes.indices.contains(typeIndex) else { return }
        definition.recordTypes[typeIndex].evidence.notesRequired = value
    }

    // MARK: - Validation (port of `validateSchemaDefinition` in `shared/platformSchema.ts`)

    /// Every validation issue for the current `definition` — see
    /// `SchemaValidator` for the full port of `validateSchemaDefinition`.
    public var issues: [SchemaValidationIssue] { SchemaValidator.validate(definition) }

    /// Port of `issues.length === 0` (the web's `canSave`/`canPublish` both
    /// gate on this).
    public var isValid: Bool { issues.isEmpty }

    // MARK: - Dirty tracking

    /// Port of `isDirty = lastSavedDefinition === null || JSON.stringify(definition) !== JSON.stringify(lastSavedDefinition)`.
    /// `baseline == nil` mirrors the web's "nothing persisted yet" sentinel —
    /// a brand-new project's default definition is treated as dirty (Save
    /// enabled) rather than looking already-saved just because it hasn't
    /// been touched. Structural (`Equatable`) comparison is used in place of
    /// the web's `JSON.stringify` string comparison; both are order-sensitive
    /// over the same field set, so they agree for every reachable state.
    public func isDirty(against baseline: PlatformSchemaDefinition?) -> Bool {
        guard let baseline else { return true }
        return definition != baseline
    }

    // MARK: - Save/publish payload

    /// The exact payload `PlatformAPIClient.saveSchemaDraft(projectId:definition:)`
    /// needs — just `definition` itself, named here so call sites read as
    /// "the draft I'm about to save" rather than reaching into `.definition`
    /// directly. `publishSchema(projectId:)` takes no body payload at all
    /// (the server publishes whatever draft already exists), so there is no
    /// equivalent accessor for it.
    public var draftPayload: PlatformSchemaDefinition { definition }

    // MARK: - Bounds helpers

    private func fieldExists(typeIndex: Int, fieldIndex: Int) -> Bool {
        guard definition.recordTypes.indices.contains(typeIndex) else { return false }
        return definition.recordTypes[typeIndex].fields.indices.contains(fieldIndex)
    }

    private func optionExists(typeIndex: Int, fieldIndex: Int, optionIndex: Int) -> Bool {
        guard fieldExists(typeIndex: typeIndex, fieldIndex: fieldIndex) else { return false }
        guard let options = definition.recordTypes[typeIndex].fields[fieldIndex].options else { return false }
        return options.indices.contains(optionIndex)
    }
}

/// Port of `canPublish = Boolean(draft) && !isDirty && issues.length === 0 && !isBusy`
/// in `SchemaBuilder.tsx` — publish is only ever allowed once a draft has
/// been saved, the editor matches that saved draft exactly (no unsaved
/// edits), validation is clean, and no request is already in flight. Kept as
/// a free, pure function (rather than a method on the view-model, which owns
/// the non-pure `draft`/`isBusy` state) so this specific gate is directly
/// CLI-testable in isolation.
public enum SchemaPublishGate {
    public static func canPublish(hasSavedDraft: Bool, isDirty: Bool, isValid: Bool, isBusy: Bool) -> Bool {
        hasSavedDraft && !isDirty && isValid && !isBusy
    }
}

/// Foundation-only reimplementation of `Array.move(fromOffsets:toOffset:)`
/// (a SwiftUI-only API this Foundation-only package cannot import) — same
/// semantics as `List.onMove`: every element at `fromOffsets` is pulled out
/// (order preserved) and reinserted, as a contiguous block, immediately
/// before what was originally index `toOffset`.
extension Array {
    fileprivate mutating func adlMove(fromOffsets offsets: IndexSet, toOffset destination: Int) {
        let itemsToMove = offsets.map { self[$0] }
        for offset in offsets.sorted(by: >) {
            remove(at: offset)
        }
        let removedBeforeDestination = offsets.filter { $0 < destination }.count
        let adjustedDestination = destination - removedBeforeDestination
        insert(contentsOf: itemsToMove, at: adjustedDestination)
    }
}
