import Charts
import ConsoleModels
import SwiftUI

/// Weekly trend bar chart — one bar per `WeeklyTrend` point from the real
/// `GET api/analytics?view=trends` response (`date`/`value`/`movingAvg`,
/// not the task brief's guessed submissions/approvals/rejections triple —
/// see `ConsoleModels/PlatformAnalytics.swift`'s `WeeklyTrend` doc comment).
/// A rolling-average line overlays the bars wherever the server supplied
/// one (early points in a short series have no average yet).
struct WeeklyTrendChartView: View {
    let trends: [WeeklyTrend]
    var t: (String, String) -> String = { en, _ in en }

    var body: some View {
        if trends.isEmpty {
            ADLConsoleEmptyState(
                systemImage: "chart.bar",
                headline: t("No trend data yet", "Aucune donnée de tendance"),
                description: t(
                    "Weekly trends appear once enough snapshots have been recorded.",
                    "Les tendances hebdomadaires apparaissent une fois que suffisamment de relevés ont été enregistrés."
                )
            )
        } else {
            chart
                .frame(height: 200)
                .padding(16)
                .background(ADLConsoleColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.card, style: .continuous))
                .adlShadowBorder()
                .accessibilityLabel(t("Weekly trend chart", "Graphique de tendance hebdomadaire"))
        }
    }

    private var chart: some View {
        Chart(trends) { point in
            BarMark(
                x: .value(t("Week", "Semaine"), shortDate(point.date)),
                y: .value(t("Value", "Valeur"), point.value)
            )
            .foregroundStyle(ADLConsoleColor.navy)

            if let movingAvg = point.movingAvg {
                LineMark(
                    x: .value(t("Week", "Semaine"), shortDate(point.date)),
                    y: .value(t("Moving average", "Moyenne mobile"), movingAvg)
                )
                .foregroundStyle(ADLConsoleColor.terra)
                .interpolationMethod(.catmullRom)
                .symbol(Circle())
            }
        }
    }

    /// `YYYY-MM-DD` -> `MM-DD` for a compact x-axis label.
    private func shortDate(_ isoDate: String) -> String {
        String(isoDate.suffix(5))
    }
}
