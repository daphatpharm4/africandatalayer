import ConsoleAPI
import ConsoleModels
import ConsoleState
import SwiftUI

/// Landing workspace — mirrors web `RoleWorkspaceScreen` navy hero + action cards.
struct OverviewView: View {
    @EnvironmentObject private var appState: AppState

    @State private var summary: PlatformRecordSummary?
    @State private var loadError: String?
    @State private var isLoading = false

    private var t: (String, String) -> String { appState.language.t }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                hero
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 16)
                } else if let loadError {
                    errorTile(loadError)
                } else if let summary {
                    tileGrid(summary)
                }
                actions
            }
            .padding(16)
            .padding(.bottom, 28)
        }
        .background(ADLConsoleColor.page)
        .task { await loadSummary() }
    }

    private var hero: some View {
        ADLConsoleHeroCard {
            VStack(alignment: .leading, spacing: 10) {
                ADLConsoleMicroLabel(
                    text: appState.organization?.name ?? "ADL",
                    color: Color.white.opacity(0.65)
                )
                Text(heroTitle)
                    .font(ADLConsoleFont.title)
                    .foregroundStyle(.white)
                Text(heroDescription)
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(Color.white.opacity(0.8))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var heroTitle: String {
        switch appState.role {
        case .owner:
            return t("Company administration", "Administration de l'entreprise")
        case .manager:
            return t("Operations workspace", "Espace des opérations")
        case .reviewer:
            return t("Review workspace", "Espace de révision")
        case .viewer:
            return t("Data viewer workspace", "Espace de consultation des données")
        case .collector:
            return t("Field collection workspace", "Espace de collecte terrain")
        case .none:
            return t("Workspace", "Espace de travail")
        }
    }

    private var heroDescription: String {
        switch appState.role {
        case .owner:
            return t(
                "Control company settings, projects, review operations, and member access.",
                "Gérez les paramètres de l'entreprise, les projets, les révisions et les accès des membres."
            )
        case .manager:
            return t(
                "Run projects, supervise the review queue, and coordinate the company team.",
                "Pilotez les projets, supervisez la file de révision et coordonnez l'équipe de l'entreprise."
            )
        case .reviewer:
            return t(
                "Verify incoming company records and make clear approval decisions.",
                "Vérifiez les données entrantes de l'entreprise et prenez des décisions de validation claires."
            )
        case .viewer:
            return t(
                "Follow project coverage and published collection structures without changing operations.",
                "Suivez la couverture des projets et les structures de collecte publiées sans modifier les opérations."
            )
        case .collector:
            return t(
                "Use the field app to collect company-specific records and consult your active projects here.",
                "Utilisez l'application terrain pour collecter les données propres à l'entreprise et consultez vos projets actifs ici."
            )
        case .none:
            return t("Your company workspace.", "Votre espace entreprise.")
        }
    }

    private func tileGrid(_ summary: PlatformRecordSummary) -> some View {
        let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        return LazyVGrid(columns: columns, spacing: 10) {
            summaryTile(title: t("My captures", "Mes captures"), value: summary.total, color: ADLConsoleColor.navy, background: ADLConsoleColor.navyWash)
            summaryTile(title: t("Today", "Aujourd'hui"), value: summary.submittedToday, color: ADLConsoleColor.terraDark, background: ADLConsoleColor.terraWash)
            summaryTile(title: t("Approved", "Approuvées"), value: summary.approved, color: ADLConsoleColor.forestDark, background: ADLConsoleColor.forestWash)
            summaryTile(title: t("Pending", "En attente"), value: summary.pendingReview, color: ADLConsoleColor.goldDark, background: ADLConsoleColor.goldWash)
        }
    }

    private func summaryTile(title: String, value: Int, color: Color, background: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(value)")
                .font(ADLConsoleFont.largeTitle)
                .foregroundStyle(color)
            ADLConsoleMicroLabel(text: title, color: color.opacity(0.85))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    @ViewBuilder
    private var actions: some View {
        VStack(spacing: 10) {
            if appState.role == .reviewer || appState.role == .manager || appState.role == .owner {
                ADLConsoleActionRow(
                    title: t("Review incoming records", "Réviser les données entrantes"),
                    subtitle: t("Inspect evidence and approve or reject pending records.", "Examinez les justificatifs et approuvez ou rejetez les données en attente."),
                    systemImage: "checklist"
                ) {
                    appState.navigate(to: ConsoleRoute(screen: .review))
                }
            }
            if appState.role == .viewer || appState.role == .manager || appState.role == .owner {
                ADLConsoleActionRow(
                    title: t("Browse approved data", "Consulter les données approuvées"),
                    subtitle: t("Inspect the company records that passed review.", "Consultez les données de l'entreprise qui ont été approuvées."),
                    systemImage: "tray.full"
                ) {
                    appState.navigate(to: ConsoleRoute(screen: .data))
                }
            }
            ADLConsoleActionRow(
                title: (appState.role == .viewer || appState.role == .reviewer || appState.role == .collector)
                    ? t("View projects", "Voir les projets")
                    : t("Manage projects", "Gérer les projets"),
                subtitle: t("See project coverage and company record types.", "Consultez la couverture des projets et les types de données de l'entreprise."),
                systemImage: "folder"
            ) {
                appState.navigate(to: ConsoleRoute(screen: .projects))
            }
            if appState.role == .manager || appState.role == .owner {
                ADLConsoleActionRow(
                    title: t("Coordinate the team", "Coordonner l'équipe"),
                    subtitle: t("Invite, remove, and assign operational roles.", "Invitez, retirez et attribuez les rôles opérationnels."),
                    systemImage: "person.2"
                ) {
                    appState.navigate(to: ConsoleRoute(screen: .members))
                }
            }
            if appState.role == .owner {
                ADLConsoleActionRow(
                    title: t("Company settings", "Paramètres de l'entreprise"),
                    subtitle: t("Manage the client name, logo, and visual identity.", "Gérez le nom du client, son logo et son identité visuelle."),
                    systemImage: "building.2"
                ) {
                    appState.navigate(to: ConsoleRoute(screen: .settings))
                }
            }
        }
    }

    private func errorTile(_ message: String) -> some View {
        ADLConsoleCard(padding: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text(t("Could not load workspace summary.", "Impossible de charger le résumé de l'espace de travail."))
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)
                Text(message)
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
            }
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
