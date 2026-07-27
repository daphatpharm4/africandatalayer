import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `CategoryBreakdownView` — the per-vertical share-of-points
/// breakdown. Loads `AnalyticsRepositoryProtocol.categoryBreakdown`, which is
/// itself a client-composed view (no dedicated backend endpoint; see
/// `AnalyticsRepository.categoryBreakdown`'s doc comment) built from the
/// latest `snapshot_stats` row per vertical.
///
/// Neither the underlying `view=snapshots` endpoint nor any other analytics
/// endpoint is organization-scoped server-side today — `organizationId` is
/// kept on this view-model for interface stability only, mirroring
/// `DeltaDashboardViewModel`.
@MainActor
final class CategoryBreakdownViewModel: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Above this many categories, `SectorMark` slice labels get too crowded
    /// to read reliably — the caller should fall back to a horizontal bar
    /// chart instead (see `CategoryBreakdownView.useBarFallback`).
    static let pieLabelingThreshold = 6

    @Published private(set) var breakdown: [CategoryBreakdown] = []
    @Published private(set) var loadState: LoadState = .idle

    let language: ConsoleLanguage

    private let repository: AnalyticsRepositoryProtocol
    private let organizationId: String

    init(
        repository: AnalyticsRepositoryProtocol,
        organizationId: String,
        language: ConsoleLanguage
    ) {
        self.repository = repository
        self.organizationId = organizationId
        self.language = language
    }

    // MARK: - Derived state

    var isEmpty: Bool { loadState == .loaded && breakdown.isEmpty }

    var loadErrorMessage: String? {
        if case .failed(let message) = loadState { return message }
        return nil
    }

    var totalCount: Int { breakdown.reduce(0) { $0 + $1.count } }

    /// Sum of the server-supplied per-category percentages. Not always
    /// exactly 100 (rounding to one decimal place per category can drift by
    /// a few tenths) — used by callers/tests as a sanity bound, not an
    /// equality check.
    var percentageSum: Double { breakdown.reduce(0) { $0 + $1.percentage } }

    /// Whether the pie chart should be replaced with a horizontal bar chart
    /// because there are too many slices to label legibly.
    var useBarFallback: Bool { breakdown.count > Self.pieLabelingThreshold }

    // MARK: - Load

    /// Fetches the category breakdown. Safe to call repeatedly (e.g. from
    /// `.task {}`) — a load already in flight is not duplicated.
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
            breakdown = try await repository.categoryBreakdown(organizationId: organizationId)
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
            "Category breakdown failed to load. Tap retry or check your connection.",
            "Impossible de charger la répartition par catégorie. Réessayez ou vérifiez votre connexion."
        )
    }
}
