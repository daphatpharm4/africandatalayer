import ConsoleAPI
import ConsoleModels
import SwiftUI

/// Approved company data browse — mirrors web DATA / ReviewQueue read-only cards.
struct DataBrowseView: View {
    @EnvironmentObject private var appState: AppState

    let organizationId: String

    @State private var records: [PlatformRecord] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var detailRecord: PlatformRecord?

    private var t: (String, String) -> String { appState.language.t }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                refreshButton
                content
            }
            .padding(16)
            .padding(.bottom, 28)
        }
        .background(ADLConsoleColor.page)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $detailRecord) { record in
            ReviewRecordDetailView(record: record, language: appState.language)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(t("Approved company data", "Données entreprise approuvées"))
                .font(ADLConsoleFont.title)
                .foregroundStyle(ADLConsoleColor.ink)
            Text(t(
                "Open a record to inspect the form, photos, GPS and capture metadata.",
                "Ouvrez une donnée pour consulter le formulaire, les photos, le GPS et les métadonnées de capture."
            ))
            .font(ADLConsoleFont.footnote)
            .foregroundStyle(ADLConsoleColor.inkMuted)
        }
    }

    private var refreshButton: some View {
        ADLConsoleSecondaryButton(
            title: t("Refresh data", "Actualiser les données"),
            systemImage: "arrow.clockwise"
        ) {
            Task { await load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.top, 40)
        } else if let errorMessage {
            ADLConsoleCard(padding: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(errorMessage)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                    Button(t("Try again", "Réessayer")) {
                        Task { await load() }
                    }
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.navy)
                }
            }
        } else if records.isEmpty {
            ADLConsoleCard(padding: 24) {
                VStack(spacing: 8) {
                    Image(systemName: "tray")
                        .font(.system(size: 28))
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                    Text(t("No approved records yet", "Aucune donnée approuvée pour le moment"))
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    Text(t(
                        "Records appear here after reviewers approve them.",
                        "Les données apparaissent ici après validation par les réviseurs."
                    ))
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
            }
        } else {
            LazyVStack(spacing: 12) {
                ForEach(records, id: \.id) { record in
                    recordCard(record)
                }
            }
        }
    }

    private func recordCard(_ record: PlatformRecord) -> some View {
        Button {
            detailRecord = record
        } label: {
            ADLConsoleCard(padding: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Text(record.recordTypeKey.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(ADLConsoleFont.headline)
                            .foregroundStyle(ADLConsoleColor.ink)
                        ADLConsolePill(
                            text: t("Approved", "Approuvée"),
                            foreground: ADLConsoleColor.forestDark,
                            background: ADLConsoleColor.forestWash
                        )
                        if record.pointId != nil {
                            ADLConsolePill(
                                text: t("Linked point", "Point associé"),
                                foreground: ADLConsoleColor.navy,
                                background: ADLConsoleColor.navyWash
                            )
                        }
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                    }
                    Text("\(record.capturedBy) · \(formattedDate(record.createdAt))")
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .lineLimit(1)
                    HStack(spacing: 14) {
                        Label("\(record.evidence.photos.count) \(t("photos", "photos"))", systemImage: "camera")
                        Label("\(record.data.count) \(t("fields", "champs"))", systemImage: "list.bullet.rectangle")
                        Label(t("Inspect", "Inspecter"), systemImage: "eye")
                    }
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
        }
        .buttonStyle(ADLConsolePressStyle())
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            records = try await appState.apiClient.listApprovedPlatformRecords(organizationId: organizationId)
        } catch {
            errorMessage = t(
                "Could not load company records. Check your connection and try again.",
                "Impossible de charger les données entreprise. Vérifiez votre connexion et réessayez."
            )
        }
        isLoading = false
    }
}

private func formattedDate(_ isoString: String) -> String {
    guard let date = ISO8601DateFormatter.parsingFractionalSecondsData.date(from: isoString)
        ?? ISO8601DateFormatter().date(from: isoString)
    else {
        return isoString
    }
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .short
    return formatter.string(from: date)
}

private extension ISO8601DateFormatter {
    nonisolated(unsafe) static let parsingFractionalSecondsData: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
