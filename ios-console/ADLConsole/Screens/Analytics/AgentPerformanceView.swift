import ConsoleAPI
import ConsoleModels
import Foundation
import SwiftUI

/// Sortable list of per-agent contribution stats — submissions count,
/// approval-rate bar, and flag count. Routing into this screen lands in a
/// later task (Task 8); this file only needs to exist, take its
/// dependencies via `init`, and be previewable.
///
/// CAVEAT surfaced to the reviewer: `approvalRate`/`trustScore` are derived
/// from the public leaderboard's `averageQualityScore` — there is no
/// dedicated per-agent approval/flag endpoint yet (see
/// `AnalyticsRepository.agentPerformance`'s doc comment in `ConsoleAPI`) —
/// and `flags` is always `0`. This view labels those figures as estimates
/// rather than presenting them as confirmed approvals.
struct AgentPerformanceView: View {
    @StateObject private var viewModel: AgentPerformanceViewModel

    init(viewModel: @autoclosure @escaping () -> AgentPerformanceViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    private var t: (String, String) -> String { viewModel.language.t }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch viewModel.loadState {
                case .idle:
                    EmptyView()
                case .loading where viewModel.agents.isEmpty:
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
        .navigationTitle(t("Agent Performance", "Performance des agents"))
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.agents.isEmpty {
            ADLConsoleEmptyState(
                systemImage: "person.2.slash",
                headline: t("No agent data yet", "Aucune donnée d'agent"),
                description: t(
                    "Agent rankings will appear once field agents have recorded submissions.",
                    "Le classement des agents apparaîtra une fois que des agents auront enregistré des soumissions."
                )
            )
            .padding(.horizontal, 16)
        } else {
            VStack(alignment: .leading, spacing: 16) {
                ADLConsoleSectionHeader(
                    title: t("Agent Performance", "Performance des agents"),
                    subtitle: t(
                        "Submission counts and quality-based estimates, by agent.",
                        "Nombre de soumissions et estimations de qualité, par agent."
                    )
                )
                .padding(.horizontal, 16)

                KPIHeaderView(items: summaryItems)

                sortPicker
                    .padding(.horizontal, 16)

                ADLConsoleStatusBanner(
                    message: t(
                        "Approval rate and quality are estimates derived from leaderboard data, not confirmed approvals. Flag counts aren't available from this data source yet.",
                        "Le taux d'approbation et la qualité sont des estimations dérivées des données de classement, pas des approbations confirmées. Le nombre de signalements n'est pas encore disponible pour cette source de données."
                    ),
                    systemImage: "info.circle"
                )
                .padding(.horizontal, 16)

                agentList
                    .padding(.horizontal, 16)
            }
        }
    }

    private var summaryItems: [KPIStatItem] {
        [
            KPIStatItem(
                id: "agent-count",
                label: t("Agents", "Agents"),
                value: "\(viewModel.totalAgents)",
                icon: "person.2.fill",
                color: ADLConsoleColor.navy
            ),
            KPIStatItem(
                id: "total-submissions",
                label: t("Submissions", "Soumissions"),
                value: "\(viewModel.totalSubmissions)",
                icon: "tray.full.fill",
                color: ADLConsoleColor.terraDark
            ),
            KPIStatItem(
                id: "avg-quality",
                label: t("Avg Quality (est.)", "Qualité moy. (est.)"),
                value: String(format: "%.0f%%", viewModel.averageTrustScore),
                icon: "star.fill",
                color: ADLConsoleColor.forest
            ),
        ]
    }

    private var sortPicker: some View {
        HStack(spacing: 8) {
            ForEach(AgentPerformanceViewModel.SortOption.allCases) { option in
                ADLConsoleChip(
                    title: sortOptionLabel(option),
                    isSelected: viewModel.sortOption == option
                ) {
                    viewModel.sortOption = option
                }
            }
            Spacer()
        }
    }

    private func sortOptionLabel(_ option: AgentPerformanceViewModel.SortOption) -> String {
        switch option {
        case .submissions: return t("Most submissions", "Plus de soumissions")
        case .quality: return t("Highest quality", "Meilleure qualité")
        }
    }

    private var agentList: some View {
        ADLConsoleCard(padding: 0) {
            VStack(spacing: 0) {
                ForEach(Array(viewModel.agents.enumerated()), id: \.element.id) { index, agent in
                    if index > 0 {
                        Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.4))
                    }
                    AgentPerformanceRow(rank: index + 1, agent: agent, t: t)
                }
            }
        }
    }
}

/// One row in `AgentPerformanceView`'s list: rank, letter-initial identity
/// circle (navy→terra gradient — mirrors `ConsoleShellView`'s avatar
/// fallback, per CLAUDE.md's "stats as identity" pattern), name, submission
/// count, an approval-rate bar, and flag count.
private struct AgentPerformanceRow: View {
    let rank: Int
    let agent: AgentPerformance
    let t: (String, String) -> String

    private var initial: String {
        String(agent.displayName.prefix(1)).uppercased()
    }

    private var approvalPercent: Int {
        Int((agent.approvalRate * 100).rounded())
    }

    private var barFraction: CGFloat {
        CGFloat(min(max(agent.approvalRate, 0), 1))
    }

    private var barColor: Color {
        if approvalPercent >= 85 { return ADLConsoleColor.forest }
        if approvalPercent >= 60 { return ADLConsoleColor.goldDark }
        return ADLConsoleColor.danger
    }

    var body: some View {
        HStack(spacing: 12) {
            Text("#\(rank)")
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .frame(width: 22, alignment: .center)
                .monospacedDigit()

            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [ADLConsoleColor.navy, ADLConsoleColor.terra],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Text(initial)
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(.white)
            }
            .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: 5) {
                Text(agent.displayName)
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)
                    .lineLimit(1)
                Text(t("\(agent.submissions) submissions", "\(agent.submissions) soumissions"))
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .monospacedDigit()

                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(ADLConsoleColor.navyWash)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(barColor)
                            .frame(width: proxy.size.width * barFraction)
                    }
                }
                .frame(height: 6)
                .accessibilityHidden(true)
            }

            VStack(alignment: .trailing, spacing: 4) {
                Text("\(approvalPercent)%")
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.ink)
                    .monospacedDigit()
                HStack(spacing: 4) {
                    Image(systemName: "flag.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(ADLConsoleColor.terra)
                    Text("\(agent.flags)")
                        .font(ADLConsoleFont.caption)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .monospacedDigit()
                }
            }
        }
        .padding(14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(agent.displayName), \(agent.submissions) \(t("submissions", "soumissions")), "
                + "\(approvalPercent)% \(t("estimated approval rate", "taux d'approbation estimé")), "
                + "\(agent.flags) \(t("flags", "signalements"))"
        )
    }
}

// MARK: - Preview

/// Fast, deterministic stub for previews — always succeeds with canned data,
/// no network activity. Mirrors `CategoryBreakdownView`'s preview stub.
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
    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown] { [] }

    func agentPerformance(organizationId: String) async throws -> [AgentPerformance] {
        [
            AgentPerformance(userId: "u1", displayName: "Amina Fotso", submissions: 128, approvalRate: 0.92, flags: 0, trustScore: 92),
            AgentPerformance(userId: "u2", displayName: "Jean Mballa", submissions: 96, approvalRate: 0.81, flags: 0, trustScore: 81),
            AgentPerformance(userId: "u3", displayName: "Chantal Ngo", submissions: 54, approvalRate: 0.58, flags: 0, trustScore: 58),
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
        AgentPerformanceView(
            viewModel: AgentPerformanceViewModel(
                repository: PreviewAnalyticsRepository(),
                organizationId: "org-1",
                language: .en
            )
        )
    }
}
