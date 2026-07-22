import ConsoleAPI
import ConsoleForms
import ConsoleModels
import Foundation

/// Drives `SchemaBuilderView` — manager/owner's dynamic schema editor for a
/// project's `PlatformSchemaDefinition`: load the current draft/published
/// schema, edit record types and fields via `SchemaEditorModel`, save a
/// draft, and publish. All network calls and edit-session state live here;
/// the view only renders `@Published` state and forwards mutation intents
/// through `mutate(_:)`.
///
/// Source of truth for behavior: `components/Console/SchemaBuilder.tsx` (web,
/// read-only reference, specifically its `SchemaBuilderEditor` component) +
/// `lib/client/platformApi.ts` + `lib/client/consoleState.ts`
/// (`builderReducer`, ported as `SchemaEditorModel`) +
/// `shared/platformSchema.ts` (`validateSchemaDefinition`, ported as
/// `SchemaValidator`).
///
/// **A documented, deliberate asymmetry ported verbatim from the web
/// source:** `canSave`/`canPublish` (the *button-disabled* gates, exposed
/// here for the view) and the handlers' own internal guards are NOT the same
/// condition set:
///  - `canSave = issues.length === 0 && isDirty && !isBusy`, but
///    `handleSaveDraft`'s own guard is only `if (issues.length > 0 ||
///    isBusy) return;` — it does **not** check `isDirty`. So a save
///    triggered some way other than the (disabled-while-clean) button would
///    still go through even when nothing changed. Ported as `saveDraft()`
///    guarding on `isValid && !isBusy` only (no `isDirty` check) — matching
///    the handler, not the button.
///  - `canPublish = Boolean(draft) && !isDirty && issues.length === 0 &&
///    !isBusy`, and `handlePublish`'s own guard is `if (!draft || isDirty ||
///    issues.length > 0 || isBusy) return;` — the exact same condition set.
///    Ported as `publish()` guarding on `canPublish` directly (see
///    `SchemaPublishGate.canPublish`, shared with `SchemaEditorModel`'s
///    tests).
///
/// The web's `window.confirm(...)` prompts before publish and before
/// navigating away with unsaved changes are view-layer concerns, not ported
/// here — same convention as `MembersViewModel`/`ReviewQueueViewModel`.
@MainActor
final class SchemaBuilderViewModel: ObservableObject {
    @Published private(set) var editor: SchemaEditorModel?
    @Published var selectedTypeIndex: Int = 0

    @Published private(set) var draft: PlatformSchemaVersion?
    @Published private(set) var published: PlatformSchemaVersion?
    @Published private(set) var versions: [PlatformSchemaVersion] = []
    /// `nil` sentinel = "nothing persisted yet" — mirrors the web's
    /// `lastSavedDefinition` comment: a brand-new project's default
    /// definition is treated as dirty (Save enabled) rather than looking
    /// already-saved just because it hasn't been touched.
    @Published private(set) var lastSavedDefinition: PlatformSchemaDefinition?

    @Published private(set) var loadError: String?
    @Published private(set) var isBusy: Bool = false
    @Published private(set) var saveError: String?
    @Published private(set) var publishError: String?

    let language: ConsoleLanguage
    let projectId: String

    private let apiClient: PlatformAPIClient
    private let mutationAllowed: @MainActor () -> Bool

    init(
        apiClient: PlatformAPIClient,
        projectId: String,
        language: ConsoleLanguage,
        mutationAllowed: @escaping @MainActor () -> Bool = { true }
    ) {
        self.apiClient = apiClient
        self.projectId = projectId
        self.language = language
        self.mutationAllowed = mutationAllowed
    }

    // MARK: - Derived state

    var issues: [SchemaValidationIssue] { editor?.issues ?? [] }
    var isValid: Bool { editor?.isValid ?? false }
    var isDirty: Bool { editor?.isDirty(against: lastSavedDefinition) ?? false }

    /// Gates the Save-draft button's `disabled` — see the type doc above for
    /// why this differs from `saveDraft()`'s own internal guard.
    var canSave: Bool { mutationAllowed() && isValid && isDirty && !isBusy }

    /// Gates the Publish button's `disabled` — identical condition set to
    /// `publish()`'s own internal guard (see the type doc above).
    var canPublish: Bool {
        mutationAllowed() && SchemaPublishGate.canPublish(hasSavedDraft: draft != nil, isDirty: isDirty, isValid: isValid, isBusy: isBusy)
    }

    var maxVersion: Int { versions.map(\.version).max() ?? 0 }

    /// Port of `nextPublishVersion = draft ? draft.version : maxVersion + 1`.
    var nextPublishVersion: Int { draft?.version ?? maxVersion + 1 }

    /// Port of `publishedHistory` — published versions, newest first.
    var publishedHistory: [PlatformSchemaVersion] {
        versions.filter { $0.status == .published }.sorted { $0.version > $1.version }
    }

    var recordTypes: [PlatformRecordType] { editor?.definition.recordTypes ?? [] }

    var selectedRecordType: PlatformRecordType? {
        guard let editor, editor.definition.recordTypes.indices.contains(selectedTypeIndex) else { return nil }
        return editor.definition.recordTypes[selectedTypeIndex]
    }

    // MARK: - Load

    /// `view=platform_schema_get`, GET, `projectId`. Port of
    /// `getSchemaRequest`/`PlatformAPIClient.getSchema` plus the loader
    /// shell's hand-off into the editor: seeds `editor` from
    /// `draft.definition ?? published.definition ?? { recordTypes:
    /// [emptyRecordType(0)] }` (`SchemaEditorModel.empty()`), matching
    /// `SchemaBuilderEditor`'s `editorInitial`.
    func load(force: Bool = false) async {
        guard force || editor == nil else { return }
        editor = nil
        loadError = nil
        saveError = nil
        publishError = nil
        do {
            let response = try await apiClient.getSchema(projectId: projectId)
            draft = response.draft
            published = response.published
            versions = response.versions
            let initialDefinition = response.draft?.definition ?? response.published?.definition
            editor = SchemaEditorModel(definition: initialDefinition ?? SchemaEditorModel.empty().definition)
            lastSavedDefinition = initialDefinition
            selectedTypeIndex = 0
        } catch {
            loadError = describePlatformError(error, language: language)
        }
    }

    // MARK: - Editing

    /// Forwards a single mutation to the underlying `SchemaEditorModel`,
    /// the Swift equivalent of `dispatch(action)` against the web's
    /// `builderReducer`. A no-op while `editor` hasn't loaded yet.
    func mutate(_ body: (inout SchemaEditorModel) -> Void) {
        guard mutationAllowed() else { return }
        guard var editor else { return }
        body(&editor)
        self.editor = editor
    }

    /// Port of `handleAddRecordType`: appends a new record type and selects
    /// it.
    func addRecordType() {
        guard let editor else { return }
        let nextIndex = editor.definition.recordTypes.count
        mutate { $0.addRecordType() }
        selectedTypeIndex = nextIndex
    }

    /// Port of `handleRemoveRecordType`: removes the record type at
    /// `index` and adjusts `selectedTypeIndex` exactly as the web does —
    /// shift left by one if the removed type was before the selection,
    /// clamp to the previous type if it *was* the selection, otherwise
    /// leave the selection untouched.
    func removeRecordType(at index: Int) {
        mutate { $0.removeRecordType(at: index) }
        if index < selectedTypeIndex {
            selectedTypeIndex -= 1
        } else if index == selectedTypeIndex {
            selectedTypeIndex = max(0, selectedTypeIndex - 1)
        }
    }

    // MARK: - Save draft

    /// `view=platform_schema_draft_save`, POST, `{ projectId, definition }`.
    /// Port of `handleSaveDraft` — see the type doc above for why this
    /// guards on `isValid && !isBusy` only (no `isDirty` check, unlike
    /// `canSave`).
    @discardableResult
    func saveDraft() async -> Bool {
        guard mutationAllowed(), let editor, isValid, !isBusy else { return false }
        saveError = nil
        isBusy = true
        defer { isBusy = false }
        do {
            let saved = try await apiClient.saveSchemaDraft(projectId: projectId, definition: editor.draftPayload)
            draft = saved
            versions = Self.mergeVersion(versions, saved)
            lastSavedDefinition = editor.definition
            return true
        } catch {
            saveError = describeSaveError(error)
            return false
        }
    }

    // MARK: - Publish

    /// `view=platform_schema_publish`, POST, `{ projectId }`. Port of
    /// `handlePublish`'s network call + local-state update (the
    /// `window.confirm` prompt is a view-layer concern, not ported here).
    @discardableResult
    func publish() async -> Bool {
        guard canPublish else { return false }
        publishError = nil
        isBusy = true
        defer { isBusy = false }
        do {
            let publishedVersion = try await apiClient.publishSchema(projectId: projectId)
            published = publishedVersion
            draft = nil
            versions = Self.mergeVersion(versions, publishedVersion)
            return true
        } catch {
            publishError = describePublishError(error)
            return false
        }
    }

    // MARK: - Error messages

    /// Port of `handleSaveDraft`'s catch block: a 422 gets the "fix the
    /// issues" copy (curly apostrophe `’` — exact byte-for-byte match to the
    /// web source's `SchemaBuilder.tsx:272`), anything else falls through to
    /// `describeError`/`describePlatformError`.
    private func describeSaveError(_ error: Error) -> String {
        if let apiError = error as? PlatformAPIError, apiError.status == 422 {
            return language.t(
                "Fix the issues listed below before saving.",
                "Corrigez les problèmes ci-dessous avant d’enregistrer."
            )
        }
        return describePlatformError(error, language: language)
    }

    /// Port of `handlePublish`'s catch block — same English copy as
    /// `describeSaveError`, but the web source's French copy here
    /// (`SchemaBuilder.tsx:300`) uses a straight apostrophe `'`, not the
    /// curly `’` the save path uses. This is an existing inconsistency in
    /// the web source (same convention `PlatformErrorMessage.swift`
    /// documents for `describeError`'s own duplicated-fallback strings),
    /// preserved here rather than "fixed".
    private func describePublishError(_ error: Error) -> String {
        if let apiError = error as? PlatformAPIError, apiError.status == 422 {
            return language.t(
                "Fix the issues listed below before saving.",
                "Corrigez les problèmes ci-dessous avant d'enregistrer."
            )
        }
        return describePlatformError(error, language: language)
    }

    /// Port of `mergeVersion` in `SchemaBuilder.tsx`: replaces an existing
    /// entry with the same id (or prepends), newest version first.
    private static func mergeVersion(_ versions: [PlatformSchemaVersion], _ next: PlatformSchemaVersion) -> [PlatformSchemaVersion] {
        let filtered = versions.filter { $0.id != next.id }
        return ([next] + filtered).sorted { $0.version > $1.version }
    }
}
