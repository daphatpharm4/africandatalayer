import ConsoleForms
import ConsoleModels
import SwiftUI

/// The collector's primary destination: pick a project + record type, fill
/// in the schema-driven dynamic form, attach evidence (photos + GPS +
/// notes), and submit. All field-engine/validation/queue logic lives in
/// `ConsoleForms` via `CaptureViewModel` — this view is a thin renderer that
/// draws one control per `FormFieldDescriptor` and reflects
/// `CaptureViewModel`'s published state.
struct CaptureView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: CaptureViewModel
    @State private var photoPickerItem: PhotosPickerItem?
    @State private var showingCamera = false

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> CaptureViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                pickerSection
                if viewModel.selectedRecordType != nil {
                    fieldsSection
                    evidenceSection
                    submitSection
                } else if viewModel.loadState == .loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 24)
                } else if viewModel.projectOptions.isEmpty {
                    emptyStateCard
                }
            }
            .padding(20)
        }
        .background(ADLConsoleColor.page)
        .task { await viewModel.loadProjects() }
    }

    // MARK: - Project / record type picker

    private var pickerSection: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                ADLConsoleMicroLabel(text: t("Capture a record", "Capturer un enregistrement"))

                if viewModel.projectOptions.isEmpty {
                    Text(t("No published project schema yet.", "Aucun schéma de projet publié pour le moment."))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                } else {
                    Picker(t("Project", "Projet"), selection: projectSelection) {
                        ForEach(viewModel.projectOptions) { option in
                            Text(option.project.name).tag(Optional(option.id))
                        }
                    }
                    .pickerStyle(.menu)

                    if !viewModel.recordTypes.isEmpty {
                        Picker(t("Record type", "Type d'enregistrement"), selection: recordTypeSelection) {
                            ForEach(viewModel.recordTypes, id: \.key) { recordType in
                                Text(recordType.label.text(appState.language)).tag(Optional(recordType.key))
                            }
                        }
                        .pickerStyle(.menu)
                    }
                }
            }
            .padding(16)
        }
    }

    private var projectSelection: Binding<String?> {
        Binding(
            get: { viewModel.selectedProjectId },
            set: { newValue in if let newValue { viewModel.selectProject(newValue) } }
        )
    }

    private var recordTypeSelection: Binding<String?> {
        Binding(
            get: { viewModel.selectedRecordTypeKey },
            set: { newValue in if let newValue { viewModel.selectRecordType(newValue) } }
        )
    }

    private var emptyStateCard: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(t("Nothing to capture yet", "Rien à capturer pour le moment"))
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)
                Text(t(
                    "Ask a manager to publish a project schema before you can capture records.",
                    "Demandez à un gestionnaire de publier un schéma de projet avant de pouvoir capturer des enregistrements."
                ))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            .padding(20)
        }
    }

    // MARK: - Dynamic fields

    private var fieldsSection: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 16) {
                ADLConsoleMicroLabel(text: t("Details", "Détails"))
                ForEach(viewModel.descriptors) { descriptor in
                    CaptureFieldControl(
                        descriptor: descriptor,
                        language: appState.language,
                        value: Binding(
                            get: { viewModel.value(for: descriptor.key) },
                            set: { viewModel.setValue($0, for: descriptor.key) }
                        ),
                        error: viewModel.lastValidation?.error(for: descriptor.key)
                    )
                }
            }
            .padding(16)
        }
    }

    // MARK: - Evidence

    private var evidenceSection: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 16) {
                ADLConsoleMicroLabel(text: t("Evidence", "Preuves"))

                photoEvidenceRow
                gpsEvidenceRow

                if viewModel.evidenceRules?.notesRequired == true {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(t("Notes", "Notes"))
                            .font(ADLConsoleFont.subheadline)
                            .foregroundStyle(ADLConsoleColor.ink)
                        TextField(t("Add context for reviewers", "Ajoutez du contexte pour les réviseurs"), text: $viewModel.evidenceNotes, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                    }
                }

                if let evidenceErrors = viewModel.lastValidation?.evidenceErrors, !evidenceErrors.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(evidenceErrors.enumerated()), id: \.offset) { _, error in
                            Text(evidenceErrorMessage(error))
                                .font(ADLConsoleFont.footnote)
                                .foregroundStyle(ADLConsoleColor.danger)
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private var photoEvidenceRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(t("Photos", "Photos"))
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.ink)
                Spacer()
                Text("\(viewModel.evidencePhotoRefs.count) " + t("captured", "capturées"))
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            Button {
                showingCamera = true
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: ADLConsoleRadius.card, style: .continuous)
                        .stroke(
                            viewModel.evidencePhotoRefs.isEmpty ? ADLConsoleColor.navyBorder : ADLConsoleColor.forestDark,
                            style: StrokeStyle(lineWidth: viewModel.evidencePhotoRefs.isEmpty ? 2 : 2, dash: viewModel.evidencePhotoRefs.isEmpty ? [6, 4] : [])
                        )
                        .frame(height: 180)
                        .frame(maxWidth: .infinity)
                        .background(viewModel.evidencePhotoRefs.isEmpty ? ADLConsoleColor.navyWash.opacity(0.3) : ADLConsoleColor.forestWash.opacity(0.3))

                    if viewModel.evidencePhotoRefs.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(ADLConsoleColor.terra)
                            Text(t("Tap to capture", "Appuyez pour capturer"))
                                .font(ADLConsoleFont.subheadline)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                        }
                    } else {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(ADLConsoleColor.forestDark)
                            Text(t("Photos captured — tap to add more", "Photos capturées — appuyez pour ajouter"))
                                .font(ADLConsoleFont.caption)
                                .foregroundStyle(ADLConsoleColor.forestDark)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(ADLConsoleColor.forestWash)
                        .clipShape(Capsule())
                    }
                }
            }
            .buttonStyle(ADLConsolePressStyle())
        }
        .sheet(isPresented: $showingCamera) {
            CameraCaptureView { imageData in
                let dataUrl = "data:image/jpeg;base64,\(imageData.base64EncodedString())"
                viewModel.addPhotoRef(dataUrl)
            }
        }
    }

    private var gpsEvidenceRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: viewModel.evidenceGps != nil ? "checkmark.circle.fill" : "location.fill")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(viewModel.evidenceGps != nil ? ADLConsoleColor.forestDark : ADLConsoleColor.inkMuted)
                    Text(t("GPS location", "Position GPS"))
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.ink)
                }
                if let gps = viewModel.evidenceGps {
                    HStack(spacing: 6) {
                        coordinateChip(label: "LAT", value: String(format: "%.5f", gps.latitude))
                        coordinateChip(label: "LNG", value: String(format: "%.5f", gps.longitude))
                        if let accuracy = gps.accuracyMeters {
                            coordinateChip(label: "ACC", value: "±\(Int(accuracy))m")
                        }
                    }
                } else if let error = viewModel.locationErrorMessage {
                    Text(error)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                } else {
                    Text(t("Not captured", "Non capturée"))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
            Spacer()
            Button {
                Task { await viewModel.requestLocation() }
            } label: {
                if viewModel.isRequestingLocation {
                    ProgressView()
                } else {
                    Label(
                        viewModel.evidenceGps != nil ? t("Refresh GPS", "Actualiser GPS") : t("Capture GPS", "Capturer GPS"),
                        systemImage: "location.fill"
                    )
                    .font(ADLConsoleFont.subheadline)
                }
            }
            .disabled(viewModel.isRequestingLocation)
        }
    }

    private func coordinateChip(label: String, value: String) -> some View {
        HStack(spacing: 3) {
            Text(label)
                .font(ADLConsoleFont.microLabel)
                .foregroundStyle(ADLConsoleColor.inkMuted)
            Text(value)
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.ink)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(ADLConsoleColor.navyWash)
        .clipShape(Capsule())
    }

    private func evidenceErrorMessage(_ error: EvidenceError) -> String {
        switch error {
        case .gpsRequired:
            return t("GPS location is required.", "La position GPS est requise.")
        case .gpsAccuracyTooLow(let required, let actual):
            return t(
                "GPS accuracy (\(Int(actual))m) is worse than required (\(Int(required))m).",
                "La précision GPS (\(Int(actual))m) est inférieure à celle requise (\(Int(required))m)."
            )
        case .notEnoughPhotos(let required, let actual):
            return t(
                "\(required) photo(s) required, \(actual) captured.",
                "\(required) photo(s) requise(s), \(actual) capturée(s)."
            )
        case .notesRequired:
            return t("Notes are required.", "Les notes sont requises.")
        }
    }

    // MARK: - Submit

    private var submitSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            ADLConsolePrimaryButton(
                title: submitButtonTitle,
                isBusy: viewModel.submitState == .submitting,
                isDisabled: viewModel.submitState == .submitting
            ) {
                Task { await viewModel.submit() }
            }
            submitStatusMessage
        }
    }

    private var submitButtonTitle: String {
        t("Submit record", "Soumettre l'enregistrement")
    }

    @ViewBuilder
    private var submitStatusMessage: some View {
        switch viewModel.submitState {
        case .idle, .submitting:
            EmptyView()
        case .invalid:
            Text(t("Fix the highlighted fields before submitting.", "Corrigez les champs surlignés avant de soumettre."))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.danger)
        case .synced:
            Text(t("Record submitted.", "Enregistrement soumis."))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.forestDark)
        case .queuedPendingSync:
            Text(t("Saved offline — will sync automatically.", "Enregistré hors-ligne — se synchronisera automatiquement."))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.terraDark)
        case .failed(let message):
            Text(message)
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.danger)
        }
    }
}

private extension BilingualLabel {
    func text(_ language: ConsoleLanguage) -> String {
        language.t(en, fr)
    }
}
