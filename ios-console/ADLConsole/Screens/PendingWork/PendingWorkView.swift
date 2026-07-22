import ConsolePersistence
import SwiftUI

struct PendingWorkView: View {
    @StateObject private var viewModel: PendingWorkViewModel
    private let t: (String, String) -> String

    init(viewModel: @autoclosure @escaping () -> PendingWorkViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
        t = viewModel().language.t
    }

    var body: some View {
        List {
            switch viewModel.viewState {
            case .loading:
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
            case .empty:
                emptyState
            case .failed(let message):
                failedState(message)
            case .loaded(let items):
                ForEach(items) { item in
                    pendingItemRow(item)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(t("Pending Work", "Travail en attente"))
        .task { await viewModel.loadItems() }
        .confirmationDialog(
            t("Discard this record?", "Supprimer cet enregistrement ?"),
            isPresented: Binding(
                get: { viewModel.discardConfirmationItem != nil },
                set: { if !$0 { viewModel.cancelDiscard() } }
            ),
            presenting: viewModel.discardConfirmationItem
        ) { item in
            Button(t("Discard", "Supprimer"), role: .destructive) {
                Task { await viewModel.confirmDiscard() }
            }
            Button(t("Cancel", "Annuler"), role: .cancel) {
                viewModel.cancelDiscard()
            }
        } message: { item in
            Text(t(
                "This action cannot be undone. The record \"\(item.recordTypeKey)\" will be permanently removed.",
                "Cette action est irréversible. L'enregistrement \"\(item.recordTypeKey)\" sera définitivement supprimé."
            ))
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text(t("No pending work", "Aucun travail en attente"))
                .font(.headline)
            Text(t("All records have been submitted.", "Tous les enregistrements ont été soumis."))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private func failedState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundStyle(.red)
            Text(t("Could not load pending work", "Impossible de charger le travail en attente"))
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button(t("Retry", "Réessayer")) {
                Task { await viewModel.loadItems() }
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private func pendingItemRow(_ item: PendingWorkViewModel.PendingItem) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.recordTypeKey)
                    .font(.headline)
                HStack(spacing: 6) {
                    stateBadge(item.state)
                    if let error = item.error {
                        errorBadge(error)
                    }
                }
                Text(item.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if item.state.isRecoverable {
                Menu {
                    Button(t("Retry", "Réessayer")) {
                        Task { await viewModel.retryItem(item) }
                    }
                    Button(t("Discard", "Supprimer"), role: .destructive) {
                        viewModel.requestDiscard(item)
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title3)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func stateBadge(_ state: RecordState) -> some View {
        let (text, color) = stateDisplay(state)
        return Text(text)
            .font(.caption2)
            .fontWeight(.semibold)
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    private func errorBadge(_ error: PendingWorkViewModel.PendingError) -> some View {
        let text: String
        switch error {
        case .authentication:
            text = t("Auth", "Auth")
        case .authorization:
            text = t("Access", "Accès")
        case .validation:
            text = t("Validation", "Validation")
        case .storage:
            text = t("Storage", "Stockage")
        case .network:
            text = t("Network", "Réseau")
        case .unknown(let msg):
            text = String(msg.prefix(12))
        }
        return Text(text)
            .font(.caption2)
            .foregroundStyle(.red)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.red.opacity(0.1))
            .clipShape(Capsule())
    }

    private func stateDisplay(_ state: RecordState) -> (String, Color) {
        switch state {
        case .pending: return (t("Pending", "En attente"), .orange)
        case .sending: return (t("Sending", "Envoi"), .blue)
        case .retryScheduled: return (t("Retrying", "Réessai"), .orange)
        case .blockedAuthentication, .blockedAuthorization: return (t("Blocked", "Bloqué"), .red)
        case .blockedValidation: return (t("Invalid", "Invalide"), .red)
        case .blockedStorage: return (t("Full", "Plein"), .red)
        case .acknowledged: return (t("Done", "Fait"), .green)
        case .discarded: return (t("Discarded", "Supprimé"), .gray)
        }
    }
}
