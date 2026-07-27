import ConsoleAPI
import ConsoleModels
import SwiftUI

/// Modal export panel: pick a format (CSV/GeoJSON/PDF), a date range, and
/// share the resulting file via `UIActivityViewController`. Presented as a
/// sheet over an Analytics screen (routing lands in Task 8); this file only
/// needs to exist, take its dependencies via `init`, and be previewable.
struct ExportPanelView: View {
    @StateObject private var viewModel: ExportPanelViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: @autoclosure @escaping () -> ExportPanelViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    private var t: (String, String) -> String { viewModel.language.t }

    var body: some View {
        NavigationStack {
            ScrollView {
                Group {
                    switch viewModel.loadState {
                    case .idle:
                        EmptyView()
                    case .loading where viewModel.cells.isEmpty:
                        ADLConsoleSkeleton()
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
                .padding(16)
            }
            .background(ADLConsoleColor.page)
            .navigationTitle(t("Export Data", "Exporter les données"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("Close", "Fermer")) { dismiss() }
                }
            }
            .task { await viewModel.load() }
            .sheet(item: shareItemBinding) { item in
                ActivityView(activityItems: [item.url])
            }
        }
    }

    /// `.sheet(item:)` needs a `Binding`; the view model's `shareItem` is
    /// read-only from the outside, so dismissal (setting `nil`) is routed
    /// back through `shareSheetDismissed()` rather than direct mutation.
    private var shareItemBinding: Binding<ExportPanelViewModel.ShareItem?> {
        Binding(
            get: { viewModel.shareItem },
            set: { newValue in if newValue == nil { viewModel.shareSheetDismissed() } }
        )
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: 20) {
            ADLConsoleSectionHeader(
                title: t("Export Data", "Exporter les données"),
                subtitle: t(
                    "Download spatial intelligence data as CSV, GeoJSON, or a PDF report.",
                    "Téléchargez les données d'intelligence spatiale en CSV, GeoJSON ou en rapport PDF."
                )
            )

            formatPicker
            dateRangeCard
            summaryBanner

            if let exportErrorMessage = viewModel.exportErrorMessage {
                ADLConsoleStatusBanner(
                    message: exportErrorMessage,
                    systemImage: "exclamationmark.triangle",
                    tint: ADLConsoleColor.danger,
                    background: ADLConsoleColor.dangerWash
                )
            }

            ADLConsolePrimaryButton(
                title: t("Share Export", "Partager l'export"),
                systemImage: "square.and.arrow.up",
                isDisabled: !viewModel.canExport
            ) {
                viewModel.exportTapped()
            }
        }
    }

    private var formatPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            ADLConsoleMicroLabel(text: t("Format", "Format"))
            HStack(spacing: 8) {
                ForEach(ExportFormat.allCases) { format in
                    ADLConsoleChip(
                        title: formatLabel(format),
                        isSelected: viewModel.format == format
                    ) {
                        viewModel.format = format
                    }
                }
                Spacer()
            }
        }
    }

    private func formatLabel(_ format: ExportFormat) -> String {
        switch format {
        case .csv: return "CSV"
        case .geoJSON: return "GeoJSON"
        case .pdf: return "PDF"
        }
    }

    private var dateRangeCard: some View {
        ADLConsoleCard(padding: 14) {
            VStack(alignment: .leading, spacing: 12) {
                ADLConsoleMicroLabel(text: t("Date Range", "Plage de dates"))
                DatePicker(
                    t("From", "Du"),
                    selection: $viewModel.startDate,
                    in: ...viewModel.endDate,
                    displayedComponents: .date
                )
                .font(ADLConsoleFont.subheadline)
                DatePicker(
                    t("To", "Au"),
                    selection: $viewModel.endDate,
                    in: viewModel.startDate...Date(),
                    displayedComponents: .date
                )
                .font(ADLConsoleFont.subheadline)
            }
        }
    }

    private var summaryBanner: some View {
        ADLConsoleStatusBanner(
            message: viewModel.isEmpty
                ? t("No records in this date range.", "Aucune donnée dans cette plage de dates.")
                : t(
                    "\(viewModel.filteredCells.count) records ready to export.",
                    "\(viewModel.filteredCells.count) enregistrements prêts à exporter."
                ),
            systemImage: "tray.full"
        )
    }
}

/// Thin `UIViewControllerRepresentable` wrapper over
/// `UIActivityViewController` so the export panel can present the system
/// share sheet from SwiftUI.
private struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Preview

/// Fast, deterministic stub for previews — always succeeds with canned
/// spatial intelligence cells, no network activity. Mirrors
/// `AgentPerformanceView`'s preview stub.
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
    func agentPerformance(organizationId: String) async throws -> [AgentPerformance] { [] }

    func spatialIntelligence(organizationId: String, vertical: String) async throws -> [GeohashScore] {
        [
            GeohashScore(
                cellId: "s0wzj9",
                verticalId: vertical,
                snapshotDate: "2026-07-20",
                center: GeoCenter(latitude: 4.05, longitude: 9.74),
                totalPoints: 42,
                completedPoints: 30,
                completionRate: 0.71,
                avgConfidenceScore: 0.8,
                photoCoverageRate: 0.9,
                recentActivityRate: 0.5,
                medianFreshnessDays: 3,
                publishableChangeCount: 4,
                newCount: 2,
                removedCount: 0,
                changedCount: 1,
                operatorDiversity: 3,
                marketSignalScore: 0.6,
                opportunityScore: 0.72,
                coverageGapScore: 0.2,
                changeSignalScore: 0.3,
                drivers: [],
                caveats: [],
                summary: "High opportunity pharmacy cell in Bonamoussadi"
            )
        ]
    }

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
    ExportPanelView(
        viewModel: ExportPanelViewModel(
            repository: PreviewAnalyticsRepository(),
            organizationId: "org-1",
            language: .en
        )
    )
}
