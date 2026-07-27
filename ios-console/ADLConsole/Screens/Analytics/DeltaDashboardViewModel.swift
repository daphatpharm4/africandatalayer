import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `DeltaDashboardView` — the client-facing KPI header + weekly trend
/// dashboard. Loads the platform-wide `kpi_summary` snapshot
/// (`AnalyticsRepositoryProtocol.deltaSnapshot`) and a `vertical`-scoped
/// weekly trend series (`.weeklyTrends`) together. Neither endpoint is
/// organization-scoped server-side today (see `AnalyticsRepositoryProtocol`'s
/// doc comment in `ConsoleAPI`) — `organizationId` is kept on this
/// view-model for interface stability only, mirroring the repository.
@MainActor
final class DeltaDashboardViewModel: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    @Published private(set) var snapshot: DeltaSnapshot?
    @Published private(set) var trends: [WeeklyTrend] = []
    @Published private(set) var loadState: LoadState = .idle

    let language: ConsoleLanguage

    private let repository: AnalyticsRepositoryProtocol
    private let organizationId: String
    private let vertical: String
    private let trendMetric: String
    private let trendWeeks: Int

    init(
        repository: AnalyticsRepositoryProtocol,
        organizationId: String,
        language: ConsoleLanguage,
        vertical: String = "pharmacy",
        trendMetric: String = "total_points",
        trendWeeks: Int = 12
    ) {
        self.repository = repository
        self.organizationId = organizationId
        self.language = language
        self.vertical = vertical
        self.trendMetric = trendMetric
        self.trendWeeks = trendWeeks
    }

    // MARK: - Derived state

    var isEmpty: Bool { loadState == .loaded && snapshot == nil }

    var loadErrorMessage: String? {
        if case .failed(let message) = loadState { return message }
        return nil
    }

    // MARK: - Load

    /// Fetches `kpi_summary` and `trends` concurrently. Safe to call
    /// repeatedly (e.g. from `.task {}`) — a load already in flight is not
    /// duplicated.
    func load() async {
        guard loadState != .loading else { return }
        loadState = .loading
        await fetch()
    }

    /// Re-fetches regardless of current state — used by pull-to-refresh.
    func refresh() async {
        loadState = .loading
        await fetch()
    }

    private func fetch() async {
        do {
            async let snapshotResult = repository.deltaSnapshot(organizationId: organizationId)
            async let trendsResult = repository.weeklyTrends(
                organizationId: organizationId,
                vertical: vertical,
                metric: trendMetric,
                weeks: trendWeeks
            )
            let (loadedSnapshot, loadedTrends) = try await (snapshotResult, trendsResult)
            snapshot = loadedSnapshot
            trends = loadedTrends
            loadState = .loaded
        } catch {
            loadState = .failed(loadFailureMessage(for: error))
        }
    }

    private func loadFailureMessage(for error: Error) -> String {
        if let apiError = error as? PlatformAPIError, apiError.status < 500 {
            return apiError.message
        }
        return language.t(
            "Dashboard data failed to load. Tap retry or check your connection.",
            "Impossible de charger les données du tableau de bord. Réessayez ou vérifiez votre connexion."
        )
    }
}
