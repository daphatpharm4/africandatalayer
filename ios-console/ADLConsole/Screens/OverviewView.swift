import ConsoleAPI
import ConsoleModels
import SwiftUI

/// The console's landing screen for most roles (`consoleLandingRoute`
/// returns `.overview` for every role except `.reviewer`). Shows the active
/// organization header plus a few record-summary tiles, loaded via
/// `PlatformAPIClient.getMyPlatformRecordSummary` — matches the "org
/// name/header, a few summary tiles" scope in the task-4 brief.
struct OverviewView: View {
    @EnvironmentObject private var appState: AppState

    @State private var summary: PlatformRecordSummary?
    @State private var loadError: String?
    @State private var isLoading = false

    private var t: (String, String) -> String { appState.language.t }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                organizationHeader

                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                } else if let loadError {
                    errorTile(loadError)
                } else if let summary {
                    tileGrid(summary)
                }
            }
            .padding(20)
        }
        .background(ADLConsoleColor.page)
        .task { await loadSummary() }
    }

    private var organizationHeader: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 8) {
                ADLConsoleMicroLabel(text: t("Workspace", "Espace de travail"))
                Text(appState.organization?.name ?? t("No organization", "Aucune organisation"))
                    .font(ADLConsoleFont.title)
                    .foregroundStyle(ADLConsoleColor.ink)
                if let role = appState.role {
                    Text(roleLabel(role))
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
            .padding(20)
        }
    }

    private func tileGrid(_ summary: PlatformRecordSummary) -> some View {
        let columns = [GridItem(.flexible()), GridItem(.flexible())]
        return LazyVGrid(columns: columns, spacing: 12) {
            summaryTile(
                title: t("Total records", "Enregistrements totaux"),
                value: summary.total,
                color: ADLConsoleColor.navy,
                background: ADLConsoleColor.navyWash
            )
            summaryTile(
                title: t("Pending review", "En attente de révision"),
                value: summary.pendingReview,
                color: ADLConsoleColor.terraDark,
                background: ADLConsoleColor.terraWash
            )
            summaryTile(
                title: t("Approved", "Approuvés"),
                value: summary.approved,
                color: ADLConsoleColor.forestDark,
                background: ADLConsoleColor.forestWash
            )
            summaryTile(
                title: t("Submitted today", "Soumis aujourd'hui"),
                value: summary.submittedToday,
                color: ADLConsoleColor.navyDark,
                background: ADLConsoleColor.goldWash
            )
        }
    }

    private func summaryTile(title: String, value: Int, color: Color, background: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(value)")
                .font(ADLConsoleFont.largeTitle)
                .foregroundStyle(color)
            ADLConsoleMicroLabel(text: title, color: color.opacity(0.8))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func errorTile(_ message: String) -> some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(t("Could not load workspace summary.", "Impossible de charger le résumé de l'espace de travail."))
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)
                Text(message)
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            .padding(20)
        }
    }

    private func roleLabel(_ role: PlatformRole) -> String {
        switch role {
        case .owner: return t("Owner", "Propriétaire")
        case .manager: return t("Manager", "Gestionnaire")
        case .reviewer: return t("Reviewer", "Réviseur")
        case .collector: return t("Collector", "Collecteur")
        case .viewer: return t("Viewer", "Observateur")
        }
    }

    private func loadSummary() async {
        isLoading = true
        loadError = nil
        do {
            summary = try await appState.apiClient.getMyPlatformRecordSummary()
        } catch {
            loadError = String(describing: error)
        }
        isLoading = false
    }
}
