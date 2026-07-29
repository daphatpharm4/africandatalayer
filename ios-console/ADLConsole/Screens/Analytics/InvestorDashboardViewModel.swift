import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `InvestorDashboardView` — the client-facing trust/quality posture
/// screen for investor and NGO consumers of the platform. Loads the
/// platform-wide `kpi_summary` snapshot (`AnalyticsRepositoryProtocol
/// .deltaSnapshot`) and the agent leaderboard-derived
/// `.agentPerformance` (used to build a trust-score distribution) together.
///
/// Neither endpoint is organization-scoped server-side today (see
/// `AnalyticsRepositoryProtocol`'s doc comment in `ConsoleAPI`) —
/// `organizationId` is kept on this view-model for interface stability only,
/// mirroring `DeltaDashboardViewModel`.
///
/// DERIVED METRICS — the real `DeltaSnapshot` has no single `freshnessScore`
/// or trust field (the task brief's pseudocode guessed one); this
/// view-model composes an investor-facing "Trust Score" from the two real
/// signals the server *does* provide (`verification.verificationRatePct` and
/// `fraud.fraudRatePct`), and derives a fraud-rate trend arrow by comparing
/// the fraud rate across successive loads (there is no dedicated
/// fraud-rate-over-time endpoint — `GET api/analytics?view=trends`'s
/// `metric` param only accepts `total_points`, `completion_rate`,
/// `new_count`, `removed_count`, `avg_price`, `week_over_week_growth`; see
/// `VALID_METRICS` in `api/analytics/index.ts`).
@MainActor
final class InvestorDashboardViewModel: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Direction of the fraud rate relative to the previous successful load.
    /// `.unknown` until a second data point exists to compare against.
    enum FraudTrend: Equatable {
        case up
        case down
        case flat
        case unknown
    }

    /// One bucket of the trust-score distribution bar chart, built from
    /// `AgentPerformance.trustScore` across all agents on the leaderboard.
    struct TrustBand: Identifiable, Equatable {
        let id: String
        let label: String
        let lowerBound: Double
        let agentCount: Int
    }

    @Published private(set) var snapshot: DeltaSnapshot?
    @Published private(set) var agentPerformance: [AgentPerformance] = []
    @Published private(set) var loadState: LoadState = .idle
    @Published private(set) var fraudTrend: FraudTrend = .unknown

    let language: ConsoleLanguage

    private let repository: AnalyticsRepositoryProtocol
    private let organizationId: String
    private var previousFraudRatePct: Double?

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

    var isEmpty: Bool { loadState == .loaded && snapshot == nil }

    var loadErrorMessage: String? {
        if case .failed(let message) = loadState { return message }
        return nil
    }

    /// Composite 0...100 trust score: weights the real verification rate
    /// (higher is better) against the real fraud rate (lower is better).
    /// A documented proxy, not a server-computed value — see the type doc.
    var trustScore: Double {
        guard let snapshot else { return 0 }
        let verificationComponent = snapshot.verification.verificationRatePct * 0.6
        let fraudComponent = max(0, 100 - snapshot.fraud.fraudRatePct) * 0.4
        return min(100, max(0, verificationComponent + fraudComponent))
    }

    var fraudRateText: String {
        guard let snapshot else { return "--" }
        return String(format: "%.1f%%", snapshot.fraud.fraudRatePct)
    }

    var freshnessText: String {
        guard let snapshot else { return "--" }
        return language.t(
            "\(Int(snapshot.freshness.medianAgeDays)) days",
            "\(Int(snapshot.freshness.medianAgeDays)) jours"
        )
    }

    /// Buckets `agentPerformance` into five 20-point trust-score bands for
    /// the distribution bar chart. Always returns all five bands (even if
    /// empty) so the chart's x-axis stays stable across loads.
    var trustDistribution: [TrustBand] {
        let bands: [(id: String, label: String, lower: Double, upper: Double)] = [
            ("0", "0-19", 0, 20),
            ("20", "20-39", 20, 40),
            ("40", "40-59", 40, 60),
            ("60", "60-79", 60, 80),
            ("80", "80-100", 80, 100.01),
        ]
        return bands.map { band in
            let count = agentPerformance.filter { $0.trustScore >= band.lower && $0.trustScore < band.upper }.count
            return TrustBand(id: band.id, label: band.label, lowerBound: band.lower, agentCount: count)
        }
    }

    // MARK: - Load

    /// Fetches `kpi_summary` and agent performance concurrently. Safe to
    /// call repeatedly (e.g. from `.task {}`) — a load already in flight is
    /// not duplicated.
    func load() async {
        guard loadState != .loading else { return }
        loadState = .loading
        await fetch()
    }

    /// Re-fetches regardless of current state — used by pull-to-refresh.
    /// Updates `fraudTrend` by comparing the new fraud rate against the
    /// value captured by the previous successful load.
    func refresh() async {
        loadState = .loading
        await fetch()
    }

    private func fetch() async {
        do {
            async let snapshotResult = repository.deltaSnapshot(organizationId: organizationId)
            async let performanceResult = repository.agentPerformance(organizationId: organizationId)
            let (loadedSnapshot, loadedPerformance) = try await (snapshotResult, performanceResult)

            let newFraudRatePct = loadedSnapshot.fraud.fraudRatePct
            if let previous = previousFraudRatePct {
                if newFraudRatePct > previous {
                    fraudTrend = .up
                } else if newFraudRatePct < previous {
                    fraudTrend = .down
                } else {
                    fraudTrend = .flat
                }
            } else {
                fraudTrend = .unknown
            }
            previousFraudRatePct = newFraudRatePct

            snapshot = loadedSnapshot
            agentPerformance = loadedPerformance
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
            "Investor dashboard failed to load. Tap retry or check your connection.",
            "Impossible de charger le tableau de bord investisseur. Réessayez ou vérifiez votre connexion."
        )
    }
}
