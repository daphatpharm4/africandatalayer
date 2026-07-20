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
        ADLConsoleSectionHeader(
            title: t("Approved company data", "Données entreprise approuvées"),
            subtitle: t(
                "Open a record to inspect the form, photos, GPS and capture metadata.",
                "Ouvrez une donnée pour consulter le formulaire, les photos, le GPS et les métadonnées de capture."
            )
        )
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
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let errorMessage {
            ADLConsoleCard(padding: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundStyle(ADLConsoleColor.danger.opacity(0.7))
                            .accessibilityHidden(true)
                        Text(errorMessage)
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.danger)
                    }
                    Button(t("Try again", "Réessayer")) {
                        Task { await load() }
                    }
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.navy)
                }
            }
        } else if records.isEmpty {
            ADLConsoleCard(padding: 24) {
                ADLConsoleEmptyState(
                    systemImage: "tray",
                    headline: t("No approved records yet", "Aucune donnée approuvée pour le moment"),
                    description: t(
                        "Records appear here after reviewers approve them. Check back soon.",
                        "Les données apparaissent ici après validation par les réviseurs. Revenez bientôt."
                    ),
                    iconColor: ADLConsoleColor.inkMuted
                )
            }
        } else {
            LazyVStack(spacing: 12) {
                ForEach(records, id: \.id) { record in
                    recordCard(record)
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .scale.combined(with: .opacity)
                        ))
                }
            }
            .animation(.easeInOut(duration: 0.3), value: records.map(\.id))
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
                            .accessibilityHidden(true)
                    }
                    Text("\(record.capturedBy) · \(ADLConsoleDateFormatting.mediumDateTime(record.createdAt))")
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
