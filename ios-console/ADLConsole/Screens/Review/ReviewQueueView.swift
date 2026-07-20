import ConsoleModels
import SwiftUI

/// The reviewer/manager/owner's REVIEW destination: pending-records queue
/// with multi-select mass-approve, per-row approve/reject, and a record
/// detail sheet. All load/decision/selection logic lives in
/// `ReviewQueueViewModel` — this view only renders `@Published` state and
/// forwards taps. Mirrors `components/Console/ReviewQueueScreen.tsx`'s
/// non-`readOnly` mode (its default queue view).
struct ReviewQueueView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: ReviewQueueViewModel
    @Environment(\.horizontalSizeClass) private var sizeClass

    @State private var isSelectionMode = false
    @State private var detailRecord: PlatformRecord?
    @State private var rejectingRecord: PlatformRecord?
    @State private var rejectReasonDraft = ""

    private var t: (String, String) -> String { appState.language.t }
    private var isWide: Bool { sizeClass == .regular }

    init(viewModel: @autoclosure @escaping () -> ReviewQueueViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            content
            massApproveBar
        }
        .background(ADLConsoleColor.page)
        .task { await viewModel.load() }
        .sheet(item: $detailRecord) { record in
            ReviewRecordDetailView(record: record, language: appState.language)
        }
        .sheet(item: $rejectingRecord) { record in
            rejectSheet(for: record)
        }
    }

    private var headerBar: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(t("Evidence review", "Révision des justificatifs"))
                    .font(ADLConsoleFont.title)
                    .foregroundStyle(ADLConsoleColor.ink)
                Text(t(
                    "Inspect all field evidence before approving or rejecting a company record.",
                    "Inspectez tous les justificatifs terrain avant d'approuver ou de rejeter une donnée entreprise."
                ))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
            }

            HStack(spacing: 10) {
                ADLConsoleSecondaryButton(
                    title: t("Refresh data", "Actualiser les données"),
                    systemImage: "arrow.clockwise"
                ) {
                    Task { await viewModel.load() }
                }
                if !viewModel.records.isEmpty {
                    ADLConsoleSecondaryButton(
                        title: isSelectionMode ? t("Done", "Terminé") : t("Select", "Sélectionner")
                    ) {
                        isSelectionMode.toggle()
                        if !isSelectionMode { viewModel.clearSelection() }
                    }
                }
            }

            ADLConsoleChip(title: t("Pending", "En attente"), isSelected: true) {}
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    // MARK: - Content states

    @ViewBuilder
    private var content: some View {
        switch viewModel.loadState {
        case .idle, .loading:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed:
            errorState
        case .loaded:
            if viewModel.isEmpty {
                emptyState
            } else {
                recordList
            }
        }
    }

    private var errorState: some View {
        ADLConsoleErrorState(
            message: viewModel.loadErrorMessage ?? t("Something went wrong.", "Une erreur est survenue."),
            retryTitle: t("Retry", "Réessayer")
        ) {
            Task { await viewModel.load() }
        }
    }

    private var emptyState: some View {
        ScrollView {
            ADLConsoleCard {
                ADLConsoleEmptyState(
                    systemImage: "checkmark.shield",
                    headline: t("No records in this queue", "Aucune donnée dans cette file"),
                    description: t(
                        "All caught up! New field captures will appear here after they sync.",
                        "Tout est à jour ! Les nouvelles captures terrain apparaîtront ici après synchronisation."
                    ),
                    iconColor: ADLConsoleColor.forestDark
                )
            }
            .padding(20)
        }
        .refreshable { await viewModel.load() }
    }

    private var recordList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.records, id: \.id) { record in
                    recordRow(record)
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .scale.combined(with: .opacity)
                        ))
                }
            }
            .padding(20)
            .animation(.easeInOut(duration: 0.3), value: viewModel.records.map(\.id))
        }
        .refreshable { await viewModel.load() }
    }

    // MARK: - Row

    private func recordRow(_ record: PlatformRecord) -> some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    if isSelectionMode {
                        Image(systemName: viewModel.isSelected(record.id) ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 20))
                            .foregroundStyle(viewModel.isSelected(record.id) ? ADLConsoleColor.navy : ADLConsoleColor.navyBorder)
                            .transition(.scale.combined(with: .opacity))
                            .accessibilityLabel(viewModel.isSelected(record.id)
                                ? t("Selected", "Sélectionnée")
                                : t("Not selected", "Non sélectionnée"))
                            .accessibilityAddTraits(.isButton)
                    } else if let thumbnail = record.evidence.photos.first, let url = URL(string: thumbnail) {
                        ADLCachedAsyncImage(url: url, targetSize: CGSize(width: 44, height: 44)) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            ADLConsoleColor.navyWash
                        }
                        .frame(width: 44, height: 44)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .accessibilityHidden(true)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(record.recordTypeKey.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(ADLConsoleFont.headline)
                            .foregroundStyle(ADLConsoleColor.ink)
                        Text("\(record.capturedBy) · \(ADLConsoleDateFormatting.mediumDateTime(record.createdAt))")
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                        HStack(spacing: 12) {
                            Label("\(record.evidence.photos.count) \(t("photos", "photos"))", systemImage: "camera")
                            Label("\(record.data.count) \(t("fields", "champs"))", systemImage: "list.bullet")
                        }
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                    }

                    Spacer()
                }

                if let itemError = viewModel.itemError(for: record.id) {
                    Text(itemError)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                }

                if !isSelectionMode {
                    HStack(spacing: 10) {
                        Button {
                            detailRecord = record
                        } label: {
                            Text(t("Inspect", "Inspecter"))
                                .font(ADLConsoleFont.subheadline)
                        }
                        .buttonStyle(ADLConsoleChipStyle(outlined: true))

                        Spacer()

                        Button(role: .destructive) {
                            rejectReasonDraft = ""
                            rejectingRecord = record
                        } label: {
                            Text(t("Reject", "Rejeter"))
                                .font(ADLConsoleFont.subheadline)
                        }
                        .buttonStyle(ADLConsoleChipStyle(outlined: true, tinted: ADLConsoleColor.danger))
                        .disabled(viewModel.busyRecordId == record.id)

                        Button {
                            Task { await viewModel.approve(record.id) }
                        } label: {
                            if viewModel.busyRecordId == record.id {
                                ProgressView()
                                    .frame(width: 44, height: 36)
                            } else {
                                Text(t("Approve", "Approuver"))
                                    .font(ADLConsoleFont.subheadline)
                            }
                        }
                        .buttonStyle(ADLConsoleChipStyle(filled: true, fillColor: ADLConsoleColor.forest))
                        .disabled(viewModel.busyRecordId == record.id)
                        .sensoryFeedback(.success, trigger: viewModel.busyRecordId == record.id)
                    }
                }
            }
            .padding(16)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if isSelectionMode {
                viewModel.toggleSelection(record.id)
            } else {
                detailRecord = record
            }
        }
    }

    // MARK: - Mass-approve bar

    @ViewBuilder
    private var massApproveBar: some View {
        if isSelectionMode && !viewModel.selection.isEmpty {
            HStack {
                Text(t("\(viewModel.selection.count) selected", "\(viewModel.selection.count) sélectionnées"))
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.ink)
                Spacer()
                ADLConsolePrimaryButton(
                    title: t("Approve selected", "Approuver la sélection"),
                    isBusy: viewModel.isBulkBusy,
                    isDisabled: viewModel.isBulkBusy
                ) {
                    Task { await viewModel.approveSelected() }
                }
                .frame(width: 200, height: 44)
                .sensoryFeedback(.success, trigger: viewModel.isBulkBusy)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(ADLConsoleColor.surface)
            .overlay(Rectangle().frame(height: 1).foregroundStyle(ADLConsoleColor.navyBorder), alignment: .top)
        }
    }

    // MARK: - Reject sheet

    private func rejectSheet(for record: PlatformRecord) -> some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text(t(
                    "Add a rejection reason before rejecting this record.",
                    "Ajoutez un motif avant de rejeter cette donnée."
                ))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)

                TextEditor(text: $rejectReasonDraft)
                    .frame(minHeight: 100)
                    .padding(8)
                    .background(ADLConsoleColor.page)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                if let itemError = viewModel.itemError(for: record.id) {
                    Text(itemError)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                }

                ADLConsolePrimaryButton(
                    title: t("Reject record", "Rejeter la donnée"),
                    isBusy: viewModel.busyRecordId == record.id,
                    isDisabled: viewModel.busyRecordId == record.id
                ) {
                    Task {
                        if await viewModel.reject(record.id, reason: rejectReasonDraft) {
                            UINotificationFeedbackGenerator().notificationOccurred(.warning)
                            rejectingRecord = nil
                        }
                    }
                }

                Spacer()
            }
            .padding(20)
            .navigationTitle(t("Reject record", "Rejeter la donnée"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("Cancel", "Annuler")) { rejectingRecord = nil }
                }
            }
        }
    }
}

extension PlatformRecord: @retroactive Identifiable {}
