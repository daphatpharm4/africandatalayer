import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `AgentPerformanceView` — a sortable list of per-agent contribution
/// stats. Loads `AnalyticsRepositoryProtocol.agentPerformance`, which is
/// itself a client-composed proxy (no dedicated backend endpoint; see
/// `AnalyticsRepository.agentPerformance`'s doc comment in `ConsoleAPI`) —
/// `approvalRate`/`trustScore` are derived from the public leaderboard's
/// `averageQualityScore`, and `flags` is always `0` (unavailable from this
/// data source). This view-model does not reinterpret those values as
/// ground truth; `AgentPerformanceView` surfaces the caveat to the reviewer.
///
/// Neither `GET api/leaderboard` nor any other analytics endpoint is
/// organization-scoped server-side today — `organizationId` is kept on this
/// view-model for interface stability only, mirroring the sibling
/// `CategoryBreakdownViewModel`/`DeltaDashboardViewModel`.
@MainActor
final class AgentPerformanceViewModel: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// How `agents` is ordered. `.quality` sorts by `trustScore` — the
    /// leaderboard-quality proxy, not a real approval metric (see the
    /// type-level doc comment).
    enum SortOption: String, CaseIterable, Identifiable, Sendable {
        case submissions
        case quality
        var id: String { rawValue }
    }

    @Published private(set) var agents: [AgentPerformance] = []
    @Published var sortOption: SortOption {
        didSet { applySort() }
    }
    @Published private(set) var loadState: LoadState = .idle

    let language: ConsoleLanguage

    private let repository: AnalyticsRepositoryProtocol
    private let organizationId: String
    private var loadedAgents: [AgentPerformance] = []

    init(
        repository: AnalyticsRepositoryProtocol,
        organizationId: String,
        language: ConsoleLanguage,
        sortOption: SortOption = .submissions
    ) {
        self.repository = repository
        self.organizationId = organizationId
        self.language = language
        self.sortOption = sortOption
    }

    // MARK: - Derived state

    var isEmpty: Bool { loadState == .loaded && agents.isEmpty }

    var loadErrorMessage: String? {
        if case .failed(let message) = loadState { return message }
        return nil
    }

    var totalAgents: Int { loadedAgents.count }
    var totalSubmissions: Int { loadedAgents.reduce(0) { $0 + $1.submissions } }

    /// Mean `trustScore` across loaded agents (`0` when empty) — feeds the
    /// KPI header's "avg quality" tile.
    var averageTrustScore: Double {
        guard !loadedAgents.isEmpty else { return 0 }
        return loadedAgents.reduce(0) { $0 + $1.trustScore } / Double(loadedAgents.count)
    }

    // MARK: - Load

    /// Fetches the agent performance list. Safe to call repeatedly (e.g.
    /// from `.task {}`) — a load already in flight is not duplicated.
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
            loadedAgents = try await repository.agentPerformance(organizationId: organizationId)
            applySort()
            loadState = .loaded
        } catch {
            loadedAgents = []
            agents = []
            loadState = .failed(loadFailureMessage(for: error))
        }
    }

    /// Re-derives `agents` from `loadedAgents` for the current `sortOption`.
    /// Ties break on `displayName` (ascending) so ordering is deterministic
    /// rather than depending on the source array's incidental order.
    private func applySort() {
        switch sortOption {
        case .submissions:
            agents = loadedAgents.sorted { lhs, rhs in
                lhs.submissions != rhs.submissions
                    ? lhs.submissions > rhs.submissions
                    : lhs.displayName < rhs.displayName
            }
        case .quality:
            agents = loadedAgents.sorted { lhs, rhs in
                lhs.trustScore != rhs.trustScore
                    ? lhs.trustScore > rhs.trustScore
                    : lhs.displayName < rhs.displayName
            }
        }
    }

    private func loadFailureMessage(for error: Error) -> String {
        if let apiError = error as? PlatformAPIError, apiError.status < 500 {
            return apiError.message
        }
        return language.t(
            "Agent performance failed to load. Tap retry or check your connection.",
            "Impossible de charger la performance des agents. Réessayez ou vérifiez votre connexion."
        )
    }
}
