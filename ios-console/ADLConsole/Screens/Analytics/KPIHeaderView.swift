import ConsoleModels
import SwiftUI

/// One tile in `KPIHeaderView`'s horizontal scroller.
struct KPIStatItem: Identifiable {
    let id: String
    let label: String
    let value: String
    let icon: String
    var color: Color = ADLConsoleColor.navy
}

/// Reusable horizontal row of stat cards — the KPI header used atop
/// `DeltaDashboardView`. Generic over `KPIStatItem` so other analytics
/// screens (agent performance, spatial intelligence) can reuse the same
/// scroller shape without depending on `DeltaSnapshot`.
struct KPIHeaderView: View {
    let items: [KPIStatItem]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(items) { item in
                    KPIStatCard(item: item)
                }
            }
            .padding(.horizontal, 16)
        }
    }
}

extension KPIHeaderView {
    /// Builds the standard delta-dashboard KPI set from the real
    /// `GET api/analytics?view=kpi_summary` shape (`DeltaSnapshot` in
    /// `ConsoleModels`) — nested `verification`/`freshness`/`fraud`/
    /// `reviewQueue` groups, not the task brief's flat guessed fields.
    init(snapshot: DeltaSnapshot, language: ConsoleLanguage) {
        let t = language.t
        self.items = [
            KPIStatItem(
                id: "total-points",
                label: t("Total Points", "Points totaux"),
                value: "\(snapshot.verification.totalPoints)",
                icon: "database",
                color: ADLConsoleColor.navy
            ),
            KPIStatItem(
                id: "verified",
                label: t("Verified", "Vérifiés"),
                value: "\(snapshot.verification.verifiedPoints)",
                icon: "checkmark.seal.fill",
                color: ADLConsoleColor.forest
            ),
            KPIStatItem(
                id: "verification-rate",
                label: t("Verification Rate", "Taux de vérification"),
                value: String(format: "%.0f%%", snapshot.verification.verificationRatePct),
                icon: "percent",
                color: ADLConsoleColor.forest
            ),
            KPIStatItem(
                id: "pending-review",
                label: t("Pending Review", "En attente"),
                value: "\(snapshot.reviewQueue.pendingReview)",
                icon: "clock.fill",
                color: ADLConsoleColor.goldDark
            ),
            KPIStatItem(
                id: "high-risk",
                label: t("High Risk", "Risque élevé"),
                value: "\(snapshot.reviewQueue.highRiskEvents)",
                icon: "exclamationmark.triangle.fill",
                color: ADLConsoleColor.danger
            ),
            KPIStatItem(
                id: "active-contributors",
                label: t("Active Contributors", "Contributeurs actifs"),
                value: "\(snapshot.weeklyActiveContributors)",
                icon: "person.2.fill",
                color: ADLConsoleColor.terraDark
            ),
            KPIStatItem(
                id: "freshness",
                label: t("Median Freshness", "Fraîcheur médiane"),
                value: t("\(Int(snapshot.freshness.medianAgeDays))d", "\(Int(snapshot.freshness.medianAgeDays))j"),
                icon: "drop.fill",
                color: ADLConsoleColor.navyMid
            ),
        ]
    }
}

private struct KPIStatCard: View {
    let item: KPIStatItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: item.icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(item.color)
            Text(item.value)
                .font(ADLConsoleFont.title2)
                .foregroundStyle(ADLConsoleColor.ink)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            ADLConsoleMicroLabel(text: item.label, color: item.color.opacity(0.85))
        }
        .frame(width: 132, alignment: .leading)
        .padding(14)
        .background(item.color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.statTile, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.label): \(item.value)")
    }
}
