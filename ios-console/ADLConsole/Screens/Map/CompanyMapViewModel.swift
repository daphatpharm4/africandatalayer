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

    /// Drives `CompanyMapView`'s overlay-mode picker (Standard / Grid /
    /// Heat) — `.none` is the plain pin map, `.grid` draws opportunity-scored
    /// geohash cells (`GeohashGridOverlay`), `.heat` draws a density layer
    /// derived from the same cells (`HeatMapOverlay`).
    enum OverlayMode: String, CaseIterable, Identifiable, Equatable {
        case none
        case grid
        case heat

        var id: String { rawValue }
    }

    enum SpatialLoadState: Equatable {
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

    /// Current overlay mode; only mutated through `setOverlayMode(_:)` so a
    /// mode switch to `.grid`/`.heat` can trigger a lazy load.
    @Published private(set) var overlayMode: OverlayMode = .none
    /// Raw cells for the "Grid" overlay — `view=spatial_intelligence`.
    @Published private(set) var gridCells: [GeohashScore] = []
    @Published private(set) var spatialLoadState: SpatialLoadState = .idle
    /// The tapped grid cell's info card — score + record count.
    @Published var selectedGridCell: GeohashScore?

    let language: ConsoleLanguage

    private let apiClient: PlatformAPIClient
    private let organizationId: String
    private let offlineCache: ConsoleOfflineCacheProtocol
    private let analyticsRepository: AnalyticsRepositoryProtocol
    /// The company map shows every record type, so its tenant analytics
    /// request uses the backend's explicit all-types scope.
    private let spatialVertical: String

    init(
        apiClient: PlatformAPIClient,
        organizationId: String,
        language: ConsoleLanguage,
        offlineCache: ConsoleOfflineCacheProtocol = ConsoleOfflineCache(),
        analyticsRepository: AnalyticsRepositoryProtocol? = nil,
        spatialVertical: String = "all"
    ) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.language = language
        self.offlineCache = offlineCache
        self.analyticsRepository = analyticsRepository ?? AnalyticsRepository(apiClient: apiClient)
        self.spatialVertical = spatialVertical
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

    /// DERIVED — mirrors `AnalyticsRepository.heatMapData`'s own composition
    /// (`geohash` <- `cellId`, `latitude`/`longitude` <- `center`,
    /// `intensity` <- `opportunityScore`) client-side instead of issuing a
    /// second network call, since `heatMapData` would just re-fetch and
    /// re-derive the same `spatial_intelligence` cells already in
    /// `gridCells`.
    var heatCells: [HeatMapCell] {
        gridCells.map { cell in
            HeatMapCell(
                geohash: cell.cellId,
                latitude: cell.center.latitude,
                longitude: cell.center.longitude,
                intensity: cell.opportunityScore
            )
        }
    }

    var spatialLoadErrorMessage: String? {
        if case .failed(let message) = spatialLoadState { return message }
        return nil
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
            try? offlineCache.saveApprovedRecords(records, organizationId: organizationId)
            loadState = .loaded
        } catch {
            let cachedRecords = (try? offlineCache.loadApprovedRecords(organizationId: organizationId)) ?? []
            if !cachedRecords.isEmpty {
                points = PointChainGrouping.collapseRecordChains(cachedRecords)
                loadState = .loaded
            } else {
                loadState = .failed(loadFailureMessage(for: error))
            }
        }
    }

    // MARK: - Selection

    func select(_ point: CollapsedPlatformPoint) {
        selectedPoint = point
    }

    func clearSelection() {
        selectedPoint = nil
    }

    // MARK: - Overlay mode (Grid / Heat)

    /// Switches the active overlay. Switching to `.grid`/`.heat` for the
    /// first time (or after a prior failure) lazily fetches
    /// `spatial_intelligence` cells; switching back to `.none`, or between
    /// `.grid`/`.heat` once cells are already loaded, is a pure state flip —
    /// both overlays share the same `gridCells`/`heatCells` data.
    func setOverlayMode(_ mode: OverlayMode) async {
        overlayMode = mode
        guard mode != .none else { return }
        guard spatialLoadState != .loading, spatialLoadState != .loaded else { return }
        await loadSpatialIntelligence()
    }

    /// Re-fetches after a failure — used by the overlay's retry affordance.
    func retrySpatialLoad() async {
        guard spatialLoadState != .loading else { return }
        await loadSpatialIntelligence()
    }

    func selectGridCell(_ cell: GeohashScore) {
        selectedGridCell = cell
    }

    func clearGridSelection() {
        selectedGridCell = nil
    }

    private func loadSpatialIntelligence() async {
        spatialLoadState = .loading
        do {
            gridCells = try await analyticsRepository.spatialIntelligence(
                organizationId: organizationId,
                vertical: spatialVertical
            )
            spatialLoadState = .loaded
        } catch {
            spatialLoadState = .failed(spatialLoadFailureMessage(for: error))
        }
    }

    private func spatialLoadFailureMessage(for error: Error) -> String {
        if let apiError = error as? PlatformAPIError, apiError.status < 500 {
            return apiError.message
        }
        return language.t(
            "Spatial intelligence failed to load. Tap retry or check your connection.",
            "Impossible de charger l'intelligence spatiale. Réessayez ou vérifiez votre connexion."
        )
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
