import ConsoleForms
import ConsoleModels
import SwiftUI

/// The SCHEMA_BUILDER destination (manager/owner only, gated upstream by
/// `canAccessConsoleScreen` before this view is ever reached). Mirrors
/// `components/Console/SchemaBuilder.tsx` (web, read-only reference)
/// adapted from its two-column desktop layout (sidebar list + detail pane)
/// to a single scrolling mobile column: a horizontal record-type chip row in
/// place of the sidebar, the selected type's editor below it, one shared
/// save/publish footer at the bottom (same as the web's single persistent
/// footer), and published-version history below that.
///
/// **Field editing is a modal sheet, not inline text fields as on the web**
/// — a mobile-appropriate adaptation of the same reducer-driven live editing
/// (every keystroke in the sheet dispatches straight through
/// `SchemaBuilderViewModel.mutate(_:)` against the live `SchemaEditorModel`,
/// exactly like the web's `dispatch(...)` calls; there is no separate draft
/// state to reconcile on sheet dismiss). All mutation/validation logic lives
/// in `SchemaEditorModel`/`SchemaValidator` (`ConsoleForms`, CLI-tested);
/// this view only renders state and forwards intents.
struct SchemaBuilderView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: SchemaBuilderViewModel

    /// Called when the user confirms leaving (or leaves with no unsaved
    /// changes) — `ConsoleShellView` passes a closure that routes back to
    /// PROJECTS via `AppState.navigate(to:)`.
    let onDismiss: () -> Void

    @State private var editingField: FieldEditTarget?
    @State private var isLeaveConfirmPresented: Bool = false

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> SchemaBuilderViewModel, onDismiss: @escaping () -> Void) {
        _viewModel = StateObject(wrappedValue: viewModel())
        self.onDismiss = onDismiss
    }

    var body: some View {
        NavigationStack {
            content
                .background(ADLConsoleColor.page)
                .navigationTitle(t("Schema builder", "Générateur de schéma"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button {
                            attemptLeave()
                        } label: {
                            Label(t("Projects", "Projets"), systemImage: "chevron.left")
                        }
                    }
                }
                .task { await viewModel.load() }
                .confirmationDialog(
                    t(
                        "You have unsaved changes. Leave without saving?",
                        "Vous avez des modifications non enregistrées. Quitter sans enregistrer ?"
                    ),
                    isPresented: $isLeaveConfirmPresented,
                    titleVisibility: .visible
                ) {
                    Button(t("Leave without saving", "Quitter sans enregistrer"), role: .destructive) { onDismiss() }
                    Button(t("Cancel", "Annuler"), role: .cancel) {}
                }
                .sheet(item: $editingField) { target in
                    FieldEditSheet(viewModel: viewModel, typeIndex: target.typeIndex, fieldIndex: target.fieldIndex)
                }
        }
    }

    private func attemptLeave() {
        if viewModel.isDirty {
            isLeaveConfirmPresented = true
        } else {
            onDismiss()
        }
    }

    // MARK: - Content states

    @ViewBuilder
    private var content: some View {
        if let loadError = viewModel.loadError {
            errorState(loadError)
        } else if viewModel.editor == nil {
            ProgressView(t("Loading schema…", "Chargement du schéma…"))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            editorContent
        }
    }

    private func errorState(_ message: String) -> some View {
        ADLConsoleErrorState(
            message: message,
            retryTitle: t("Try again", "Réessayer")
        ) {
            Task { await viewModel.load() }
        }
    }

    private var editorContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let published = viewModel.published {
                    Text("\(t("Live schema: version", "Schéma actif : version")) \(published.version)")
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }

                recordTypeChipsRow

                if let selected = viewModel.selectedRecordType {
                    recordTypeDetailCard(selected)
                    fieldsCard(selected)
                    evidenceCard(selected)
                } else {
                    ADLConsoleCard {
                        ADLConsoleEmptyState(
                            systemImage: "doc.text",
                            headline: t("Add a record type to get started.", "Ajoutez un type d'enregistrement pour commencer."),
                            description: ""
                        )
                    }
                }

                saveAndPublishCard
                publishedHistoryCard
            }
            .padding(20)
        }
    }

    // MARK: - Record type chip row

    private var recordTypeChipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(viewModel.recordTypes.enumerated()), id: \.offset) { index, recordType in
                    recordTypeChip(index: index, recordType: recordType)
                }
                Button {
                    viewModel.addRecordType()
                } label: {
                    Label(t("Add record type", "Ajouter un type"), systemImage: "plus")
                        .font(ADLConsoleFont.footnote)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                }
                .background(ADLConsoleColor.navyWash)
                .foregroundStyle(ADLConsoleColor.navy)
                .clipShape(Capsule())
            }
        }
    }

    private func recordTypeChip(index: Int, recordType: PlatformRecordType) -> some View {
        let isSelected = index == viewModel.selectedTypeIndex
        let title = recordType.label.en.isEmpty
            ? (recordType.label.fr.isEmpty ? (recordType.key.isEmpty ? t("Untitled", "Sans titre") : recordType.key) : recordType.label.fr)
            : recordType.label.en

        return HStack(spacing: 6) {
            Button {
                viewModel.selectedTypeIndex = index
            } label: {
                Text(title)
                    .font(ADLConsoleFont.footnote)
                    .lineLimit(1)
            }
            Button {
                viewModel.removeRecordType(at: index)
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 14))
                    .frame(width: 28, height: 28)
            }
            .accessibilityLabel(t("Remove record type", "Supprimer le type"))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(isSelected ? ADLConsoleColor.navy : ADLConsoleColor.navyWash)
        .foregroundStyle(isSelected ? .white : ADLConsoleColor.navy)
        .clipShape(Capsule())
    }

    // MARK: - Record type detail (key + bilingual label)

    private func recordTypeDetailCard(_ recordType: PlatformRecordType) -> some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                labeledTextField(t("Key", "Clé"), text: Binding(
                    get: { recordType.key },
                    set: { value in viewModel.mutate { $0.setRecordTypeKey(at: viewModel.selectedTypeIndex, value: value) } }
                ))
                labeledTextField(t("Label (English)", "Libellé (anglais)"), text: Binding(
                    get: { recordType.label.en },
                    set: { value in
                        viewModel.mutate { $0.setRecordTypeLabel(at: viewModel.selectedTypeIndex, lang: .en, value: value) }
                    }
                ))
                labeledTextField(t("Label (French)", "Libellé (français)"), text: Binding(
                    get: { recordType.label.fr },
                    set: { value in
                        viewModel.mutate { $0.setRecordTypeLabel(at: viewModel.selectedTypeIndex, lang: .fr, value: value) }
                    }
                ))
            }
            .padding(16)
        }
    }

    // MARK: - Fields

    private func fieldsCard(_ recordType: PlatformRecordType) -> some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    ADLConsoleMicroLabel(text: t("Fields", "Champs"))
                    Spacer()
                    Button {
                        viewModel.mutate { $0.addField(typeIndex: viewModel.selectedTypeIndex) }
                        let newIndex = recordType.fields.count
                        editingField = FieldEditTarget(typeIndex: viewModel.selectedTypeIndex, fieldIndex: newIndex)
                    } label: {
                        Label(t("Add field", "Ajouter un champ"), systemImage: "plus")
                            .font(ADLConsoleFont.footnote)
                    }
                }

                if recordType.fields.isEmpty {
                    Text(t("No fields yet.", "Aucun champ pour le moment."))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                } else {
                    VStack(spacing: 8) {
                        ForEach(Array(recordType.fields.enumerated()), id: \.offset) { fieldIndex, field in
                            fieldRow(typeIndex: viewModel.selectedTypeIndex, fieldIndex: fieldIndex, field: field)
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func fieldRow(typeIndex: Int, fieldIndex: Int, field: PlatformFieldDefinition) -> some View {
        Button {
            editingField = FieldEditTarget(typeIndex: typeIndex, fieldIndex: fieldIndex)
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(field.label.en.isEmpty ? field.key : field.label.en)
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    Text("\(fieldTypeLabel(field.type))\(field.required ? " · \(t("Required", "Requis"))" : "")")
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
                Spacer()
                Button {
                    viewModel.mutate { $0.removeField(typeIndex: typeIndex, fieldIndex: fieldIndex) }
                } label: {
                    Image(systemName: "trash")
                        .frame(width: 36, height: 36)
                }
                .accessibilityLabel(t("Remove field", "Supprimer le champ"))
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .accessibilityHidden(true)
            }
            .padding(12)
            .background(ADLConsoleColor.navyWash.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Evidence

    private func evidenceCard(_ recordType: PlatformRecordType) -> some View {
        let typeIndex = viewModel.selectedTypeIndex
        return ADLConsoleCard {
            VStack(alignment: .leading, spacing: 16) {
                ADLConsoleMicroLabel(text: t("Evidence requirements", "Exigences de preuve"))

                Toggle(t("Require GPS location", "Exiger la position GPS"), isOn: Binding(
                    get: { recordType.evidence.gpsRequired },
                    set: { value in viewModel.mutate { $0.setEvidenceGpsRequired(typeIndex: typeIndex, value: value) } }
                ))
                .font(ADLConsoleFont.subheadline)

                if recordType.evidence.gpsRequired {
                    labeledTextField(
                        t("Max accuracy (meters)", "Précision max (mètres)"),
                        text: Binding(
                            get: { recordType.evidence.gpsAccuracyMeters.map { String($0) } ?? "" },
                            set: { value in
                                viewModel.mutate {
                                    $0.setEvidenceGpsAccuracyMeters(typeIndex: typeIndex, value: Double(value))
                                }
                            }
                        ),
                        keyboardType: .decimalPad
                    )
                }

                HStack {
                    Text(t("Minimum photos", "Photos minimum"))
                        .font(ADLConsoleFont.subheadline)
                    Spacer()
                    Stepper(
                        value: Binding(
                            get: { recordType.evidence.minPhotos },
                            set: { value in
                                viewModel.mutate {
                                    $0.setEvidenceMinPhotos(typeIndex: typeIndex, value: min(10, max(0, value)))
                                }
                            }
                        ),
                        in: 0...10
                    ) {
                        Text("\(recordType.evidence.minPhotos)")
                            .font(ADLConsoleFont.subheadline)
                    }
                    .fixedSize()
                }

                Toggle(t("Require notes", "Exiger des notes"), isOn: Binding(
                    get: { recordType.evidence.notesRequired },
                    set: { value in viewModel.mutate { $0.setEvidenceNotesRequired(typeIndex: typeIndex, value: value) } }
                ))
                .font(ADLConsoleFont.subheadline)
            }
            .padding(16)
        }
    }

    // MARK: - Save / publish footer

    private var saveAndPublishCard: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                if !viewModel.issues.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(t("Issues", "Problèmes")) (\(viewModel.issues.count))")
                            .font(ADLConsoleFont.microLabel)
                            .foregroundStyle(ADLConsoleColor.danger)
                        ForEach(Array(viewModel.issues.enumerated()), id: \.offset) { _, issue in
                            Text("\(issue.path.isEmpty ? "(root)" : issue.path) — \(issue.message)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(ADLConsoleColor.danger)
                        }
                    }
                }

                if let saveError = viewModel.saveError {
                    Text(saveError).font(ADLConsoleFont.footnote).foregroundStyle(ADLConsoleColor.danger)
                }
                if let publishError = viewModel.publishError {
                    Text(publishError).font(ADLConsoleFont.footnote).foregroundStyle(ADLConsoleColor.danger)
                }

                Text(viewModel.isDirty
                    ? t("Unsaved changes", "Modifications non enregistrées")
                    : t("All changes saved", "Toutes les modifications sont enregistrées"))
                    .font(ADLConsoleFont.microLabel)
                    .foregroundStyle(ADLConsoleColor.inkMuted)

                HStack(spacing: 12) {
                    Button {
                        Task { await viewModel.saveDraft() }
                    } label: {
                        Text(viewModel.isBusy ? t("Saving…", "Enregistrement…") : t("Save draft", "Enregistrer le brouillon"))
                            .font(ADLConsoleFont.subheadline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .disabled(!viewModel.canSave)
                    .background(ADLConsoleColor.navyWash)
                    .foregroundStyle(ADLConsoleColor.navy)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                    Button {
                        Task { await viewModel.publish() }
                    } label: {
                        Text(t("Publish version \(viewModel.nextPublishVersion)", "Publier la version \(viewModel.nextPublishVersion)"))
                            .font(ADLConsoleFont.subheadline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .disabled(!viewModel.canPublish)
                    .background(viewModel.canPublish ? ADLConsoleColor.navy : ADLConsoleColor.navy.opacity(0.4))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                if viewModel.draft == nil && !viewModel.isDirty && viewModel.issues.isEmpty {
                    Text(t(
                        "Nothing to publish yet — save a draft first.",
                        "Rien à publier pour le moment — enregistrez d’abord un brouillon."
                    ))
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
            .padding(16)
        }
    }

    private var publishedHistoryCard: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 8) {
                ADLConsoleMicroLabel(text: t("Published version history", "Historique des versions publiées"))
                if viewModel.publishedHistory.isEmpty {
                    Text(t("No versions published yet.", "Aucune version publiée pour le moment."))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                } else {
                    ForEach(viewModel.publishedHistory, id: \.id) { version in
                        HStack {
                            Text("\(t("Version", "Version")) \(version.version)")
                                .font(ADLConsoleFont.subheadline)
                                .foregroundStyle(ADLConsoleColor.ink)
                            Spacer()
                            Text(version.publishedAt ?? "")
                                .font(ADLConsoleFont.footnote)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .padding(16)
        }
    }

    // MARK: - Shared field-type label helper

    private func fieldTypeLabel(_ type: PlatformFieldType) -> String {
        type.label(t)
    }

    private func labeledTextField(_ label: String, text: Binding<String>, keyboardType: UIKeyboardType = .default) -> some View {
        ADLConsoleLabeledField(
            label: label,
            text: text,
            keyboardType: keyboardType
        )
    }
}

/// Identifies which field a `FieldEditSheet` presentation targets — `Identifiable`
/// so `.sheet(item:)` can drive it directly off `@State`.
private struct FieldEditTarget: Identifiable, Equatable {
    let typeIndex: Int
    let fieldIndex: Int
    var id: String { "\(typeIndex).\(fieldIndex)" }
}

/// Modal field editor: key, bilingual label, type picker (all 8
/// `PlatformFieldType` cases), required toggle, number min/max (only for
/// `.number`), and an options editor (only for `.select`/`.multiSelect`).
/// Every control writes straight through `SchemaBuilderViewModel.mutate(_:)`
/// against the live `SchemaEditorModel` — see the type doc on
/// `SchemaBuilderView` for why there is no separate draft/save step here.
private struct FieldEditSheet: View {
    @ObservedObject var viewModel: SchemaBuilderViewModel
    let typeIndex: Int
    let fieldIndex: Int

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    private var t: (String, String) -> String { appState.language.t }

    private var field: PlatformFieldDefinition? {
        guard viewModel.recordTypes.indices.contains(typeIndex) else { return nil }
        let fields = viewModel.recordTypes[typeIndex].fields
        guard fields.indices.contains(fieldIndex) else { return nil }
        return fields[fieldIndex]
    }

    var body: some View {
        NavigationStack {
            Group {
                if let field {
                    Form {
                        Section {
                            TextField(t("Key", "Clé"), text: Binding(
                                get: { field.key },
                                set: { value in viewModel.mutate { $0.setFieldKey(typeIndex: typeIndex, fieldIndex: fieldIndex, value: value) } }
                            ))
                        }
                        labelSection(field)
                        typeSection(field)
                        if field.type == .number {
                            numberBoundsSection(field)
                        }
                        if field.type == .select || field.type == .multiSelect {
                            optionsSection(field)
                        }
                        Section {
                            Toggle(t("Required", "Requis"), isOn: Binding(
                                get: { field.required },
                                set: { value in viewModel.mutate { $0.setFieldRequired(typeIndex: typeIndex, fieldIndex: fieldIndex, value: value) } }
                            ))
                        }
                    }
                } else {
                    Text(t("Field removed", "Champ supprimé"))
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle(t("Field", "Champ"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(t("Done", "Terminé")) { dismiss() }
                }
            }
        }
    }

    private func labelSection(_ field: PlatformFieldDefinition) -> some View {
        Section(t("Label", "Libellé")) {
            TextField(t("Label (EN)", "Libellé (EN)"), text: Binding(
                get: { field.label.en },
                set: { value in viewModel.mutate { $0.setFieldLabel(typeIndex: typeIndex, fieldIndex: fieldIndex, lang: .en, value: value) } }
            ))
            TextField(t("Label (FR)", "Libellé (FR)"), text: Binding(
                get: { field.label.fr },
                set: { value in viewModel.mutate { $0.setFieldLabel(typeIndex: typeIndex, fieldIndex: fieldIndex, lang: .fr, value: value) } }
            ))
        }
    }

    private func typeSection(_ field: PlatformFieldDefinition) -> some View {
        Section(t("Type", "Type")) {
            Picker(t("Type", "Type"), selection: Binding(
                get: { field.type },
                set: { newType in viewModel.mutate { $0.setFieldType(typeIndex: typeIndex, fieldIndex: fieldIndex, newType: newType) } }
            )) {
                ForEach(PlatformFieldType.allCases, id: \.self) { fieldType in
                    Text(fieldTypeLabel(fieldType)).tag(fieldType)
                }
            }
            .pickerStyle(.navigationLink)
        }
    }

    private func numberBoundsSection(_ field: PlatformFieldDefinition) -> some View {
        Section(t("Range", "Plage")) {
            TextField(t("Min", "Min"), text: Binding(
                get: { field.min.map { String($0) } ?? "" },
                set: { value in viewModel.mutate { $0.setFieldMin(typeIndex: typeIndex, fieldIndex: fieldIndex, value: value.isEmpty ? nil : Double(value)) } }
            ))
            .keyboardType(.decimalPad)
            TextField(t("Max", "Max"), text: Binding(
                get: { field.max.map { String($0) } ?? "" },
                set: { value in viewModel.mutate { $0.setFieldMax(typeIndex: typeIndex, fieldIndex: fieldIndex, value: value.isEmpty ? nil : Double(value)) } }
            ))
            .keyboardType(.decimalPad)
        }
    }

    private func optionsSection(_ field: PlatformFieldDefinition) -> some View {
        Section(t("Options", "Options")) {
            ForEach(Array((field.options ?? []).enumerated()), id: \.offset) { optionIndex, option in
                VStack(alignment: .leading, spacing: 6) {
                    TextField(t("Value", "Valeur"), text: Binding(
                        get: { option.value },
                        set: { value in
                            viewModel.mutate { $0.setOptionValue(typeIndex: typeIndex, fieldIndex: fieldIndex, optionIndex: optionIndex, value: value) }
                        }
                    ))
                    TextField(t("Label (EN)", "Libellé (EN)"), text: Binding(
                        get: { option.label.en },
                        set: { value in
                            viewModel.mutate {
                                $0.setOptionLabel(typeIndex: typeIndex, fieldIndex: fieldIndex, optionIndex: optionIndex, lang: .en, value: value)
                            }
                        }
                    ))
                    TextField(t("Label (FR)", "Libellé (FR)"), text: Binding(
                        get: { option.label.fr },
                        set: { value in
                            viewModel.mutate {
                                $0.setOptionLabel(typeIndex: typeIndex, fieldIndex: fieldIndex, optionIndex: optionIndex, lang: .fr, value: value)
                            }
                        }
                    ))
                }
                .swipeActions {
                    Button(role: .destructive) {
                        viewModel.mutate { $0.removeOption(typeIndex: typeIndex, fieldIndex: fieldIndex, optionIndex: optionIndex) }
                    } label: {
                        Label(t("Remove option", "Supprimer l’option"), systemImage: "trash")
                    }
                }
            }
            Button {
                viewModel.mutate { $0.addOption(typeIndex: typeIndex, fieldIndex: fieldIndex) }
            } label: {
                Label(t("Add option", "Ajouter une option"), systemImage: "plus")
            }
        }
    }

    private func fieldTypeLabel(_ type: PlatformFieldType) -> String {
        type.label(t)
    }
}
