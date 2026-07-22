import ConsoleForms
import ConsoleModels
import ConsoleState
import PhotosUI
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
    @State private var photoErrorMessage: String?

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> CaptureViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                fieldCommandCenter
                pickerSection
                if viewModel.selectedRecordType != nil {
                    existingPointSection
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
        .task {
            viewModel.startFraudMetadataCapture()
            await viewModel.loadProjects()
            await viewModel.refreshQueueSnapshot()
        }
        .onDisappear {
            viewModel.stopFraudMetadataCapture()
        }
    }

    // MARK: - Field command center

    private var fieldCommandCenter: some View {
        VStack(alignment: .leading, spacing: 14) {
            ADLConsoleHeroCard {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        ADLConsoleMicroLabel(
                            text: appState.organization?.name ?? "ADL",
                            color: Color.white.opacity(0.68)
                        )
                        Text(t("Today in the field", "Aujourd'hui sur le terrain"))
                            .font(ADLConsoleFont.title)
                            .foregroundStyle(.white)
                        Text(t(
                            "Capture verified infrastructure records, attach evidence, and keep useful updates moving.",
                            "Capturez des données d'infrastructure vérifiées, ajoutez les justificatifs et faites avancer les mises à jour utiles."
                        ))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(Color.white.opacity(0.82))
                        .fixedSize(horizontal: false, vertical: true)
                    }

                    HStack(spacing: 8) {
                        commandMetric(
                            value: "\(viewModel.projectOptions.count)",
                            label: t("active projects", "projets actifs"),
                            systemImage: "folder.fill"
                        )
                        commandMetric(
                            value: "\(totalRecordTypes)",
                            label: t("record types", "types de données"),
                            systemImage: "list.bullet.rectangle.fill"
                        )
                        commandMetric(
                            value: "\(viewModel.queueSnapshot?.total ?? 0)",
                            label: t("queued", "en attente"),
                            systemImage: "tray.and.arrow.up.fill"
                        )
                    }

                    HStack(spacing: 10) {
                        Button {
                            appState.navigate(to: ConsoleRoute(screen: .map))
                        } label: {
                            Label(t("Open map capture", "Ouvrir la carte"), systemImage: "map.fill")
                                .font(ADLConsoleFont.subheadline)
                                .frame(maxWidth: .infinity)
                                .frame(minHeight: 46)
                                .foregroundStyle(ADLConsoleColor.navy)
                                .background(.white)
                                .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.button, style: .continuous))
                        }
                        .buttonStyle(ADLConsolePressStyle())

                        Button {
                            appState.navigate(to: ConsoleRoute(screen: .projects))
                        } label: {
                            Image(systemName: "folder.fill")
                                .font(.system(size: 17, weight: .semibold))
                                .frame(width: 46, height: 46)
                                .foregroundStyle(.white)
                                .background(Color.white.opacity(0.16))
                                .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.button, style: .continuous))
                        }
                        .buttonStyle(ADLConsolePressStyle())
                        .accessibilityLabel(t("View projects", "Voir les projets"))
                    }
                }
            }

            if let selectedRecordType = viewModel.selectedRecordType {
                selectedMissionStrip(selectedRecordType)
                captureProgressCard
            }
        }
    }

    private var totalRecordTypes: Int {
        viewModel.projectOptions.reduce(0) { $0 + $1.schemaVersion.definition.recordTypes.count }
    }

    private func commandMetric(value: String, label: String, systemImage: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.78))
            Text(value)
                .font(ADLConsoleFont.headline)
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(ADLConsoleFont.caption)
                .foregroundStyle(Color.white.opacity(0.72))
                .lineLimit(2)
                .minimumScaleFactor(0.85)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.white.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func selectedMissionStrip(_ recordType: PlatformRecordType) -> some View {
        HStack(spacing: 10) {
            Label(viewModel.selectedProjectOption?.project.name ?? t("Selected project", "Projet sélectionné"), systemImage: "location.north.line.fill")
                .lineLimit(1)
            Spacer(minLength: 8)
            missionRequirementPill(
                text: recordType.evidence.gpsRequired ? t("GPS required", "GPS requis") : t("GPS optional", "GPS optionnel"),
                systemImage: "location.fill",
                color: recordType.evidence.gpsRequired ? ADLConsoleColor.terraDark : ADLConsoleColor.inkMuted
            )
            missionRequirementPill(
                text: "\(recordType.evidence.minPhotos) " + t("photos", "photos"),
                systemImage: "camera.fill",
                color: recordType.evidence.minPhotos > 0 ? ADLConsoleColor.forestDark : ADLConsoleColor.inkMuted
            )
        }
        .font(ADLConsoleFont.caption)
        .foregroundStyle(ADLConsoleColor.ink)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(ADLConsoleColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
        .adlShadowBorder()
    }

    private func missionRequirementPill(text: String, systemImage: String, color: Color) -> some View {
        Label(text, systemImage: systemImage)
            .font(ADLConsoleFont.caption)
            .foregroundStyle(color)
            .monospacedDigit()
    }

    private var captureProgressCard: some View {
        let progress = viewModel.captureProgress
        return ADLConsoleCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        ADLConsoleMicroLabel(text: t("Record readiness", "Préparation du relevé"))
                        Text(progress.total == 0
                             ? t("Optional details only", "Détails optionnels uniquement")
                             : t("\(progress.completed) of \(progress.total) required items complete", "\(progress.completed) sur \(progress.total) éléments requis complétés"))
                        .font(ADLConsoleFont.caption)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .monospacedDigit()
                    }
                    Spacer()
                    Text("\(progress.percent)%")
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(progress.fraction >= 1 ? ADLConsoleColor.forestDark : ADLConsoleColor.navy)
                        .monospacedDigit()
                }

                ProgressView(value: progress.fraction)
                    .tint(progress.fraction >= 1 ? ADLConsoleColor.forestDark : ADLConsoleColor.gold)
                    .accessibilityLabel(t("Record capture progress", "Progression de la capture"))
                    .accessibilityValue("\(progress.percent)%")
            }
            .padding(14)
        }
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

    private var existingPointSection: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    ADLConsoleMicroLabel(text: t("Existing point", "Point existant"))
                    Text(t(
                        "Attach this record to a point your company already tracks.",
                        "Associez ce relevé à un point déjà suivi par votre entreprise."
                    ))
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                }

                if let attachedPoint = viewModel.attachedPoint {
                    attachedPointRow(attachedPoint)
                } else if let preAttachPointId = viewModel.preAttachPointId {
                    preAttachedPointRow(pointId: preAttachPointId)
                } else if let nearbyPoints = viewModel.nearbyPoints {
                    nearbyPointResults(nearbyPoints)
                } else {
                    Button {
                        Task { await viewModel.loadNearbyPoints() }
                    } label: {
                        HStack(spacing: 8) {
                            if viewModel.isLoadingNearbyPoints {
                                ProgressView()
                                    .scaleEffect(0.82)
                            } else {
                                Image(systemName: "mappin.and.ellipse")
                                    .font(.system(size: 16, weight: .semibold))
                            }
                            Text(viewModel.isLoadingNearbyPoints
                                 ? t("Looking for nearby points...", "Recherche de points à proximité...")
                                 : t("Attach to existing point", "Associer à un point existant"))
                            .font(ADLConsoleFont.subheadline)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 48)
                    }
                    .disabled(viewModel.isLoadingNearbyPoints)
                    .buttonStyle(ADLConsolePressStyle())
                    .foregroundStyle(ADLConsoleColor.navy)
                    .background(ADLConsoleColor.navyWash)
                    .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
                }

                if let message = viewModel.nearbyPointsErrorMessage {
                    ADLConsoleStatusBanner(
                        message: message,
                        systemImage: "exclamationmark.triangle.fill",
                        tint: ADLConsoleColor.danger,
                        background: ADLConsoleColor.dangerWash
                    )
                }
            }
            .padding(16)
        }
    }

    private func attachedPointRow(_ point: PlatformNearbyPoint) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "mappin.circle.fill")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(ADLConsoleColor.forestDark)
                .frame(width: 44, height: 44)
                .background(ADLConsoleColor.forestWash)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(point.name ?? point.category)
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.forestDark)
                    .lineLimit(1)
                Text(pointStalenessLabel(point.updatedAt))
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.forestDark.opacity(0.78))
            }

            Spacer()

            Button {
                viewModel.clearAttachedPoint()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(ADLConsolePressStyle())
            .foregroundStyle(ADLConsoleColor.forestDark)
            .accessibilityLabel(t("Remove attached point", "Retirer le point associé"))
        }
        .padding(12)
        .background(ADLConsoleColor.forestWash)
        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
        .adlShadowBorder()
    }

    private func preAttachedPointRow(pointId: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "mappin.circle.fill")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(ADLConsoleColor.forestDark)
                .frame(width: 44, height: 44)
                .background(ADLConsoleColor.forestWash)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(t("Point selected from map", "Point sélectionné depuis la carte"))
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.forestDark)
                    .lineLimit(1)
                Text(pointId)
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.forestDark.opacity(0.78))
                    .lineLimit(1)
            }

            Spacer()

            Button {
                viewModel.clearAttachedPoint()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(ADLConsolePressStyle())
            .foregroundStyle(ADLConsoleColor.forestDark)
            .accessibilityLabel(t("Remove attached point", "Retirer le point associé"))
        }
        .padding(12)
        .background(ADLConsoleColor.forestWash)
        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
        .adlShadowBorder()
    }

    private func nearbyPointResults(_ points: [PlatformNearbyPoint]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if points.isEmpty {
                Text(t("No points nearby", "Aucun point à proximité"))
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ADLConsoleColor.navyWash)
                    .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
            } else {
                ForEach(points, id: \.pointId) { point in
                    Button {
                        viewModel.attach(to: point)
                    } label: {
                        nearbyPointRow(point)
                    }
                    .buttonStyle(ADLConsolePressStyle())
                }
            }

            Button {
                Task { await viewModel.loadNearbyPoints() }
            } label: {
                Label(t("Refresh", "Actualiser"), systemImage: "arrow.clockwise")
                    .font(ADLConsoleFont.caption)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 44)
            }
            .disabled(viewModel.isLoadingNearbyPoints)
            .buttonStyle(ADLConsolePressStyle())
            .foregroundStyle(ADLConsoleColor.navy)
        }
    }

    private func nearbyPointRow(_ point: PlatformNearbyPoint) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(point.name ?? point.category)
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.ink)
                    .lineLimit(1)
                ADLConsoleMicroLabel(text: point.category)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 5) {
                Text(formatDistanceMeters(point.distanceMeters))
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.ink)
                    .monospacedDigit()
                Text(pointStalenessLabel(point.updatedAt))
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .lineLimit(1)
            }
        }
        .padding(12)
        .frame(minHeight: 52)
        .background(ADLConsoleColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
        .adlShadowBorder()
    }

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
                        error: viewModel.lastValidation?.error(for: descriptor.key),
                        onPhotoSelected: { data, key in
                            try viewModel.preparePhoto(data, placement: .schemaField(key))
                        },
                        onPhotoCleared: { localID in
                            viewModel.removePreparedPhoto(localID: localID)
                        }
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
                if let photoErrorMessage {
                    Text(photoErrorMessage)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                        .fixedSize(horizontal: false, vertical: true)
                }
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
                    .monospacedDigit()
            }
            Button {
                showingCamera = true
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
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
            CameraCaptureView { result in
                switch result {
                case .success(let dataURL):
                    do {
                        let localID = try viewModel.preparePhotoDataURL(dataURL, placement: .recordEvidence)
                        photoErrorMessage = nil
                        viewModel.addPhotoRef(localID, metadata: viewModel.metadataForCapturedPhoto(dataURL))
                    } catch {
                        photoErrorMessage = t(
                            "This photo could not be prepared for upload. Take another photo and try again.",
                            "Cette photo n'a pas pu être préparée. Prenez une autre photo et réessayez."
                        )
                    }
                case .failure:
                    photoErrorMessage = t(
                        "This photo could not be prepared for upload. Take another photo and try again.",
                        "Cette photo n'a pas pu être préparée. Prenez une autre photo et réessayez."
                    )
                }
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
                .monospacedDigit()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(ADLConsoleColor.navyWash)
        .clipShape(Capsule())
    }

    private func formatDistanceMeters(_ meters: Double) -> String {
        if meters >= 1_000 {
            return String(format: "%.1f km", meters / 1_000)
        }
        return "\(Int(meters.rounded())) m"
    }

    private func pointStalenessLabel(_ isoString: String) -> String {
        guard let date = ADLConsoleDateFormatting.parse(isoString) else {
            return t("Tracked point", "Point suivi")
        }

        let days = max(0, Calendar.current.dateComponents([.day], from: date, to: Date()).day ?? 0)
        if days == 0 {
            return t("Updated today", "Mis à jour aujourd'hui")
        }
        if days == 1 {
            return t("Updated yesterday", "Mis à jour hier")
        }
        return t("\(days) days since update", "\(days) jours depuis la mise à jour")
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
                isDisabled: viewModel.submitState == .submitting,
                pressAnimationEnabled: false
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
            ADLConsoleStatusBanner(
                message: t("Fix the highlighted fields before submitting.", "Corrigez les champs surlignés avant de soumettre."),
                systemImage: "exclamationmark.triangle.fill",
                tint: ADLConsoleColor.danger,
                background: ADLConsoleColor.dangerWash
            )
        case .synced:
            ADLConsoleStatusBanner(
                message: t("Record submitted.", "Enregistrement soumis."),
                systemImage: "checkmark.circle.fill",
                tint: ADLConsoleColor.forestDark,
                background: ADLConsoleColor.forestWash
            )
        case .queuedPendingSync:
            ADLConsoleStatusBanner(
                message: t("Saved offline — will sync automatically.", "Enregistré hors-ligne — se synchronisera automatiquement."),
                systemImage: "icloud.and.arrow.up.fill",
                tint: ADLConsoleColor.terraDark,
                background: ADLConsoleColor.terraWash
            )
        case .failed(let message):
            ADLConsoleStatusBanner(
                message: message,
                systemImage: "xmark.circle.fill",
                tint: ADLConsoleColor.danger,
                background: ADLConsoleColor.dangerWash
            )
        }
    }
}

private extension BilingualLabel {
    func text(_ language: ConsoleLanguage) -> String {
        language.t(en, fr)
    }
}
