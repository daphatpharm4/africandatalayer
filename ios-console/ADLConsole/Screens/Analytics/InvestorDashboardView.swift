import Charts
import ConsoleAPI
import ConsoleModels
import SwiftUI

/// Investor/NGO-facing trust & quality dashboard — a composite trust gauge,
/// a fraud-rate badge with a trend arrow, a freshness stat, and a bar chart
/// of the trust-score distribution across agents. Routing into this screen
/// lands in a later task (Task 8); this file only needs to exist, take its
/// dependencies via `init`, and be previewable.
struct InvestorDashboardView: View {
    @StateObject private var viewModel: InvestorDashboardViewModel

    init(viewModel: @autoclosure @escaping () -> InvestorDashboardViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    private var t: (String, String) -> String { viewModel.language.t }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch viewModel.loadState {
                case .idle:
                    EmptyView()
                case .loading where viewModel.snapshot == nil:
                    ADLConsoleSkeleton()
                        .padding(.horizontal, 16)
                case .loading, .loaded:
                    content
                case .failed(let message):
                    ADLConsoleErrorState(
                        message: message,
                        retryTitle: t("Retry", "Réessayer")
                    ) {
                        Task { await viewModel.refresh() }
                    }
                }
            }
            .padding(.vertical, 16)
        }
        .background(ADLConsoleColor.page)
        .navigationTitle(t("Investor Dashboard", "Tableau de bord investisseur"))
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
    }

    @ViewBuilder
    private var content: some View {
        if let snapshot = viewModel.snapshot {
            VStack(alignment: .leading, spacing: 16) {
                ADLConsoleSectionHeader(
                    title: t("Trust & Quality", "Confiance et qualité"),
                    subtitle: t(
                        "A composite view of verification confidence and fraud exposure.",
                        "Une vue composite de la confiance de vérification et de l'exposition à la fraude."
                    )
                )
                .padding(.horizontal, 16)

                trustGaugeCard

                fraudAndFreshnessRow(snapshot)
                    .padding(.horizontal, 16)

                ADLConsoleSectionHeader(
                    title: t("Trust Score Distribution", "Répartition des scores de confiance"),
                    subtitle: t(
                        "Number of agents in each trust-score band.",
                        "Nombre d'agents dans chaque tranche de score de confiance."
                    )
                )
                .padding(.horizontal, 16)

                trustDistributionChart
                    .padding(.horizontal, 16)
            }
        } else {
            ADLConsoleEmptyState(
                systemImage: "shield.checkered",
                headline: t("No trust data yet", "Aucune donnée de confiance"),
                description: t(
                    "Trust and fraud metrics will appear once the platform has recorded activity.",
                    "Les indicateurs de confiance et de fraude apparaîtront une fois que la plateforme aura enregistré de l'activité."
                )
            )
            .padding(.horizontal, 16)
        }
    }

    private var trustGaugeCard: some View {
        ADLConsoleCard(padding: 20) {
            VStack(spacing: 8) {
                Gauge(value: viewModel.trustScore, in: 0...100) {
                    Text(t("Trust Score", "Score de confiance"))
                } currentValueLabel: {
                    Text("\(Int(viewModel.trustScore))")
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .tint(viewModel.trustScore > 70 ? ADLConsoleColor.forest : ADLConsoleColor.gold)
                .frame(maxWidth: .infinity)

                HStack(spacing: 6) {
                    Text(t("Trust Score", "Score de confiance"))
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    Text(t("ESTIMATED", "ESTIMÉ"))
                        .font(ADLConsoleFont.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(ADLConsoleColor.goldDark)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(ADLConsoleColor.gold.opacity(0.15), in: Capsule())
                }
                Text(
                    t(
                        "Estimated indicator — blends verification rate and fraud rate; not an audited score.",
                        "Indicateur estimé — combine le taux de vérification et le taux de fraude ; pas un score audité."
                    )
                )
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(t("Trust Score", "Score de confiance")): \(Int(viewModel.trustScore))")
    }

    private func fraudAndFreshnessRow(_ snapshot: DeltaSnapshot) -> some View {
        HStack(spacing: 12) {
            ADLConsoleCard(padding: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    ADLConsoleMicroLabel(text: t("Fraud Rate", "Taux de fraude"))
                    HStack(spacing: 6) {
                        Text(viewModel.fraudRateText)
                            .font(ADLConsoleFont.title2)
                            .foregroundStyle(ADLConsoleColor.ink)
                            .monospacedDigit()
                        fraudTrendIcon
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            ADLConsoleCard(padding: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    ADLConsoleMicroLabel(text: t("Median Freshness", "Fraîcheur médiane"))
                    Text(viewModel.freshnessText)
                        .font(ADLConsoleFont.title2)
                        .foregroundStyle(ADLConsoleColor.ink)
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private var fraudTrendIcon: some View {
        switch viewModel.fraudTrend {
        case .up:
            Image(systemName: "arrow.up.right")
                .foregroundStyle(ADLConsoleColor.danger)
                .accessibilityLabel(t("Fraud rate rising", "Taux de fraude en hausse"))
        case .down:
            Image(systemName: "arrow.down.right")
                .foregroundStyle(ADLConsoleColor.forest)
                .accessibilityLabel(t("Fraud rate falling", "Taux de fraude en baisse"))
        case .flat:
            Image(systemName: "arrow.right")
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .accessibilityLabel(t("Fraud rate steady", "Taux de fraude stable"))
        case .unknown:
            EmptyView()
        }
    }

    private var trustDistributionChart: some View {
        Group {
            if viewModel.agentPerformance.isEmpty {
                ADLConsoleEmptyState(
                    systemImage: "chart.bar",
                    headline: t("No agent data yet", "Aucune donnée d'agent"),
                    description: t(
                        "Trust distribution appears once agents have submissions on the leaderboard.",
                        "La répartition de confiance apparaît une fois que des agents figurent au classement."
                    )
                )
            } else {
                Chart(viewModel.trustDistribution) { band in
                    BarMark(
                        x: .value(t("Agents", "Agents"), band.agentCount),
                        y: .value(t("Trust band", "Tranche de confiance"), band.label)
                    )
                    .foregroundStyle(ADLConsoleColor.navy)
                }
                .frame(height: 180)
                .padding(16)
                .background(ADLConsoleColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.card, style: .continuous))
                .adlShadowBorder()
                .accessibilityLabel(t("Trust score distribution chart", "Graphique de répartition des scores de confiance"))
            }
        }
    }
}

// MARK: - Preview

/// Fast, deterministic stub for previews — always succeeds with canned data,
/// no network activity. Mirrors `DeltaDashboardView`'s preview stub.
private struct PreviewAnalyticsRepository: AnalyticsRepositoryProtocol {
    func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot {
        DeltaSnapshot(
            generatedAt: "2026-07-24T12:00:00.000Z",
            weeklyActiveContributors: 15,
            verification: KpiVerification(totalPoints: 1500, verifiedPoints: 900, verificationRatePct: 78),
            freshness: KpiFreshness(medianAgeDays: 3.5, avgAgeDays: 5.2),
            fraud: KpiFraud(eventsWithFraudCheck: 400, mismatchEvents: 8, fraudRatePct: 2.0),
            reviewQueue: KpiReviewQueue(pendingReview: 8, highRiskEvents: 3),
            enrichmentRatePct: 42.5
        )
    }

    func weeklyTrends(organizationId: String, vertical: String, metric: String, weeks: Int) async throws -> [WeeklyTrend] { [] }
    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown] { [] }

    func agentPerformance(organizationId: String) async throws -> [AgentPerformance] {
        [
            AgentPerformance(userId: "1", displayName: "Amina", submissions: 40, approvalRate: 0.9, flags: 0, trustScore: 92),
            AgentPerformance(userId: "2", displayName: "Bello", submissions: 22, approvalRate: 0.7, flags: 0, trustScore: 68),
            AgentPerformance(userId: "3", displayName: "Chantal", submissions: 15, approvalRate: 0.5, flags: 0, trustScore: 45),
        ]
    }

    func spatialIntelligence(organizationId: String, vertical: String) async throws -> [GeohashScore] { [] }
    func anomalies(organizationId: String, since: Date) async throws -> [AnomalyFlag] { [] }
    func heatMapData(organizationId: String, vertical: String) async throws -> [HeatMapCell] { [] }

    func aiQuery(organizationId: String, query: String) async throws -> AIQueryResponse {
        AIQueryResponse(
            answer: "",
            facts: [],
            caveats: [],
            suggestedNextValidations: [],
            confidence: 0,
            modelMetadata: AiModelMetadata(provider: "preview", model: "preview", modelVersion: nil, promptVersion: "0", confidence: 0)
        )
    }
}

#Preview {
    NavigationStack {
        InvestorDashboardView(
            viewModel: InvestorDashboardViewModel(
                repository: PreviewAnalyticsRepository(),
                organizationId: "org-1",
                language: .en
            )
        )
    }
}
