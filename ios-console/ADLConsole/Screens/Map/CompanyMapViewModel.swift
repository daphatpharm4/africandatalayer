import ConsoleAPI
import ConsoleForms
import ConsoleModels
import Foundation

/// Drives `CompanyMapView` — the collector's org-wide MapKit map: load every
/// approved company record, collapse each point-chain to one pin
/// (`PointChainGrouping.collapseRecordChains`, `ConsoleForms`), and expose
/// the tapped pin's ordered chain for `CompanyPointDetailView`. Mirrors the
/// role `ReviewQueueViewModel`/`CaptureViewModel` play elsewhere: every
/// network call and state transition lives here, the view only renders
/// `@Published` state.
///
/// Source data is the same `listApprovedPlatformRecords` endpoint
/// `DataBrowseView` uses (and the web field app's company-explore map calls
/// via `listApprovedPlatformRecordsRequest` — see `components/Screens/Home.tsx`'s
/// `loadPoints`) — this view-model just adds the chain-collapsing step before
/// exposing pins, which `DataBrowseView`'s flat list does not need.
@MainActor
final class CompanyMapViewModel: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// One pin per point-chain, in first-seen order (see
    /// `PointChainGrouping.collapseRecordChains`'s ordering note).
    @Published private(set) var points: [CollapsedPlatformPoint] = []
    @Published private(set) var loadState: LoadState = .idle
    /// The point-detail sheet's driving state — `.sheet(item:)`-friendly.
    @Published var selectedPoint: CollapsedPlatformPoint?

    let language: ConsoleLanguage

    private let apiClient: PlatformAPIClient
    private let organizationId: String

    init(apiClient: PlatformAPIClient, organizationId: String, language: ConsoleLanguage) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.language = language
    }

    // MARK: - Derived state

    var isEmpty: Bool { loadState == .loaded && points.isEmpty }

    var loadErrorMessage: String? {
        if case .failed(let message) = loadState { return message }
        return nil
    }

    /// Pins that can actually be placed on the map — a point whose newest
    /// record happens to carry no GPS fix (evidence.gps is optional) has
    /// nothing to plot, so it is excluded here while still counting toward
    /// `points`/`isEmpty` for any future non-map (list) surface.
    var annotations: [CollapsedPlatformPoint] {
        points.filter { $0.representative.evidence.gps != nil }
    }

    var capturedTodayCount: Int {
        let calendar = Calendar.current
        return points.filter { point in
            let iso = point.representative.evidence.capturedAt ?? point.representative.createdAt
            guard let date = ADLConsoleDateFormatting.parse(iso) else { return false }
            return calendar.isDate(date, inSameDayAs: Date())
        }.count
    }

    // MARK: - Load

    /// `view=platform_record_browse`, GET. Port of
    /// `listApprovedPlatformRecordsRequest` + `collapseRecordChains`, mirroring
    /// `Home.tsx`'s `loadPoints` company-explore branch.
    func load(force: Bool = false) async {
        guard force || loadState != .loading else { return }
        guard force || loadState != .loaded else { return }
        loadState = .loading
        do {
            let records = try await apiClient.listApprovedPlatformRecords(organizationId: organizationId)
            points = PointChainGrouping.collapseRecordChains(records)
            loadState = .loaded
        } catch {
            loadState = .failed(loadFailureMessage(for: error))
        }
    }

    // MARK: - Selection

    func select(_ point: CollapsedPlatformPoint) {
        selectedPoint = point
    }

    func clearSelection() {
        selectedPoint = nil
    }

    // MARK: - Error messages (mirrors DataBrowseView's fallback string)

    private func loadFailureMessage(for error: Error) -> String {
        if let apiError = error as? PlatformAPIError, apiError.status < 500 {
            return apiError.message
        }
        return language.t(
            "Company records failed to load. Tap retry or check your connection.",
            "Impossible de charger les données entreprise. Réessayez ou vérifiez votre connexion."
        )
    }
}
