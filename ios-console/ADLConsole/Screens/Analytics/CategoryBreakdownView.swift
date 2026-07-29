import Charts
import ConsoleAPI
import ConsoleModels
import SwiftUI

/// Category (vertical) share-of-points breakdown. Renders a `SectorMark`
/// donut chart by default; when there are more categories than a donut can
/// label legibly (`CategoryBreakdownViewModel.pieLabelingThreshold`), falls
/// back to a horizontal bar chart instead — flagged as a risk in the task
/// spec since `SectorMark` slice labels crowd out quickly past a handful of
/// categories. Routing into this screen lands in a later task (Task 8);
/// this file only needs to exist, take its dependencies via `init`, and be
/// previewable.
struct CategoryBreakdownView: View {
    @StateObject private var viewModel: CategoryBreakdownViewModel

    init(viewModel: @autoclosure @escaping () -> CategoryBreakdownViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    private var t: (String, String) -> String { viewModel.language.t }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch viewModel.loadState {
                case .idle:
                    EmptyView()
                case .loading where viewModel.breakdown.isEmpty:
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
        .navigationTitle(t("Category Breakdown", "Répartition par catégorie"))
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.breakdown.isEmpty {
            ADLConsoleEmptyState(
                systemImage: "chart.pie",
                headline: t("No category data yet", "Aucune donnée de catégorie"),
                description: t(
                    "Category share will appear once verticals have recorded snapshots.",
                    "La répartition par catégorie apparaîtra une fois que des relevés auront été enregistrés."
                )
            )
            .padding(.horizontal, 16)
        } else {
            VStack(alignment: .leading, spacing: 16) {
                ADLConsoleSectionHeader(
                    title: t("Category Breakdown", "Répartition par catégorie"),
                    subtitle: t(
                        "Share of total points captured, by vertical.",
                        "Part du total de points capturés, par secteur."
                    )
                )
                .padding(.horizontal, 16)

                chartCard
                    .padding(.horizontal, 16)

                legend
                    .padding(.horizontal, 16)
            }
        }
    }

    private var chartCard: some View {
        ADLConsoleCard(padding: 16) {
            if viewModel.useBarFallback {
                barChart
            } else {
                pieChart
            }
        }
    }

    private var pieChart: some View {
        Chart(viewModel.breakdown) { category in
            SectorMark(
                angle: .value(t("Count", "Nombre"), category.count),
                innerRadius: .ratio(0.5),
                angularInset: 1.5
            )
            .foregroundStyle(by: .value(t("Category", "Catégorie"), category.category))
            .cornerRadius(2)
        }
        .chartForegroundStyleScale(domain: categoryDomain, range: categoryRange)
        .chartLegend(.hidden)
        .frame(height: 250)
        .accessibilityLabel(t("Category breakdown pie chart", "Graphique en secteurs de répartition par catégorie"))
    }

    private var barChart: some View {
        Chart(viewModel.breakdown) { category in
            BarMark(
                x: .value(t("Count", "Nombre"), category.count),
                y: .value(t("Category", "Catégorie"), category.category)
            )
            .foregroundStyle(by: .value(t("Category", "Catégorie"), category.category))
        }
        .chartForegroundStyleScale(domain: categoryDomain, range: categoryRange)
        .chartLegend(.hidden)
        .frame(height: max(200, CGFloat(viewModel.breakdown.count) * 34))
        .accessibilityLabel(t("Category breakdown bar chart", "Graphique à barres de répartition par catégorie"))
    }

    /// Fixed brand palette cycled across categories in the order the
    /// repository already sorted them (descending by count). Split into
    /// parallel `domain`/`range` arrays because `chartForegroundStyleScale`'s
    /// `KeyValuePairs`-based overload can only be built from a dictionary
    /// literal at the call site, not from a dynamically-sized array.
    private var categoryDomain: [String] {
        viewModel.breakdown.map(\.category)
    }

    private var categoryRange: [Color] {
        let palette: [Color] = [
            ADLConsoleColor.navy,
            ADLConsoleColor.terra,
            ADLConsoleColor.forest,
            ADLConsoleColor.gold,
            ADLConsoleColor.navyMid,
            ADLConsoleColor.terraDark,
            ADLConsoleColor.forestDark,
        ]
        return viewModel.breakdown.indices.map { palette[$0 % palette.count] }
    }

    private var legend: some View {
        ADLConsoleCard(padding: 12) {
            VStack(spacing: 0) {
                ForEach(Array(viewModel.breakdown.enumerated()), id: \.element.id) { index, category in
                    if index > 0 {
                        Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.4))
                    }
                    HStack {
                        Circle()
                            .fill(paletteColor(at: index))
                            .frame(width: 10, height: 10)
                        Text(category.category.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(ADLConsoleFont.body)
                            .foregroundStyle(ADLConsoleColor.ink)
                        Spacer()
                        Text("\(category.count)")
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                            .monospacedDigit()
                        Text(String(format: "%.1f%%", category.percentage))
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                            .monospacedDigit()
                            .frame(width: 52, alignment: .trailing)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
    }

    private func paletteColor(at index: Int) -> Color {
        let palette: [Color] = [
            ADLConsoleColor.navy,
            ADLConsoleColor.terra,
            ADLConsoleColor.forest,
            ADLConsoleColor.gold,
            ADLConsoleColor.navyMid,
            ADLConsoleColor.terraDark,
            ADLConsoleColor.forestDark,
        ]
        return palette[index % palette.count]
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
            verification: KpiVerification(totalPoints: 1500, verifiedPoints: 900, verificationRatePct: 60),
            freshness: KpiFreshness(medianAgeDays: 3.5, avgAgeDays: 5.2),
            fraud: KpiFraud(eventsWithFraudCheck: 400, mismatchEvents: 8, fraudRatePct: 2.0),
            reviewQueue: KpiReviewQueue(pendingReview: 8, highRiskEvents: 3),
            enrichmentRatePct: 42.5
        )
    }

    func weeklyTrends(organizationId: String, vertical: String, metric: String, weeks: Int) async throws -> [WeeklyTrend] { [] }

    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown] {
        [
            CategoryBreakdown(category: "pharmacy", count: 620, percentage: 41.3),
            CategoryBreakdown(category: "fuel_station", count: 410, percentage: 27.3),
            CategoryBreakdown(category: "mobile_money", count: 250, percentage: 16.7),
            CategoryBreakdown(category: "alcohol_outlet", count: 120, percentage: 8.0),
            CategoryBreakdown(category: "billboard", count: 60, percentage: 4.0),
            CategoryBreakdown(category: "transport_road", count: 40, percentage: 2.7),
        ]
    }

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
        CategoryBreakdownView(
            viewModel: CategoryBreakdownViewModel(
                repository: PreviewAnalyticsRepository(),
                organizationId: "org-1",
                language: .en
            )
        )
    }
}
