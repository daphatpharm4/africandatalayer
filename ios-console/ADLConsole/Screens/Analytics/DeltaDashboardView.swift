import ConsoleAPI
import ConsoleModels
import Foundation
import SwiftUI

/// Client-facing delta dashboard — KPI header + weekly trend chart + a data
/// quality summary card. Routing into this screen lands in a later task
/// (Task 8); this file only needs to exist, take its dependencies via
/// `init`, and be previewable.
struct DeltaDashboardView: View {
    @StateObject private var viewModel: DeltaDashboardViewModel

    init(viewModel: @autoclosure @escaping () -> DeltaDashboardViewModel) {
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
        .navigationTitle(t("Delta Dashboard", "Tableau de bord des écarts"))
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
    }

    @ViewBuilder
    private var content: some View {
        if let snapshot = viewModel.snapshot {
            VStack(alignment: .leading, spacing: 16) {
                ADLConsoleSectionHeader(
                    title: t("Overview", "Aperçu"),
                    subtitle: t(
                        "Platform-wide verification and review posture.",
                        "Posture de vérification et de révision à l'échelle de la plateforme."
                    )
                )
                .padding(.horizontal, 16)

                KPIHeaderView(snapshot: snapshot, language: viewModel.language)

                ADLConsoleSectionHeader(
                    title: t("Weekly Trend", "Tendance hebdomadaire"),
                    subtitle: t(
                        "Total points captured per week, with a rolling average.",
                        "Total de points capturés par semaine, avec une moyenne mobile."
                    )
                )
                .padding(.horizontal, 16)

                WeeklyTrendChartView(trends: viewModel.trends, t: t)
                    .padding(.horizontal, 16)

                ADLConsoleSectionHeader(title: t("Data Quality", "Qualité des données"), subtitle: "")
                    .padding(.horizontal, 16)

                dataQualityCard(snapshot)
                    .padding(.horizontal, 16)
            }
        } else {
            ADLConsoleEmptyState(
                systemImage: "chart.bar.xaxis",
                headline: t("No dashboard data yet", "Aucune donnée de tableau de bord"),
                description: t(
                    "KPI data will appear once the platform has recorded activity.",
                    "Les données KPI apparaîtront une fois que la plateforme aura enregistré de l'activité."
                )
            )
            .padding(.horizontal, 16)
        }
    }

    private func dataQualityCard(_ snapshot: DeltaSnapshot) -> some View {
        ADLConsoleCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                ADLConsoleMetadataRow(
                    label: t("Median Freshness", "Fraîcheur médiane"),
                    value: t("\(Int(snapshot.freshness.medianAgeDays)) days", "\(Int(snapshot.freshness.medianAgeDays)) jours")
                )
                Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.4))
                ADLConsoleMetadataRow(
                    label: t("Fraud Rate", "Taux de fraude"),
                    value: String(format: "%.1f%%", snapshot.fraud.fraudRatePct)
                )
                Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.4))
                ADLConsoleMetadataRow(
                    label: t("Enrichment Rate", "Taux d'enrichissement"),
                    value: String(format: "%.1f%%", snapshot.enrichmentRatePct)
                )
            }
        }
    }
}

// MARK: - Preview

/// Fast, deterministic stub for previews — always succeeds with canned data,
/// no network activity. Mirrors `StubAuthService`'s role for `AuthServiceProtocol`.
private struct PreviewAnalyticsRepository: AnalyticsRepositoryProtocol {
    func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot {
        DeltaSnapshot(
            generatedAt: "2026-07-24T12:00:00.000Z",
            weeklyActiveContributors: 15,
            verification: KpiVerification(totalPoints: 1500, verifiedPoints: 900, verificationRatePct: 60),
            freshness: KpiFreshness(medianAgeDays: 3.5, avgAgeDays: 5.2),
            fraud: KpiFraud(eventsWithFraudCheck: 400, mismatchEvents: 8, fraudRatePct: 2.0),
            reviewQueue: KpiReviewQueue(pendingReview: 8, highRiskEvents: 3),
            enrichmentRatePct: 42.5
        )
    }

    func weeklyTrends(organizationId: String, vertical: String, metric: String, weeks: Int) async throws -> [WeeklyTrend] {
        [
            WeeklyTrend(date: "2026-06-29", value: 80, movingAvg: nil),
            WeeklyTrend(date: "2026-07-06", value: 95, movingAvg: 87.5),
            WeeklyTrend(date: "2026-07-13", value: 88, movingAvg: 87.6),
            WeeklyTrend(date: "2026-07-20", value: 110, movingAvg: 93.25),
        ]
    }

    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown] { [] }
    func agentPerformance(organizationId: String) async throws -> [AgentPerformance] { [] }
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
        DeltaDashboardView(
            viewModel: DeltaDashboardViewModel(
                repository: PreviewAnalyticsRepository(),
                organizationId: "org-1",
                language: .en
            )
        )
    }
}
