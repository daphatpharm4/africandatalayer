import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `ExportPanelView`. Data source is
/// `AnalyticsRepositoryProtocol.spatialIntelligence(vertical:)` — the only
/// result on the protocol carrying both coordinates (needed for GeoJSON)
/// and enough tabular fields (needed for CSV/PDF) to double as this
/// screen's single export dataset. The date-range filter is applied
/// client-side against each cell's `snapshotDate`, mirroring how
/// `AnalyticsRepository.anomalies(since:)` already filters client-side —
/// `spatial_intelligence` has no server-side date parameter either.
@MainActor
final class ExportPanelViewModel: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Wraps a produced export file's URL for `.sheet(item:)` identity —
    /// plain `URL` isn't `Identifiable`.
    struct ShareItem: Identifiable, Equatable {
        let id = UUID()
        let url: URL
    }

    @Published var format: ExportFormat = .csv
    @Published var startDate: Date
    @Published var endDate: Date
    @Published private(set) var loadState: LoadState = .idle
    @Published private(set) var cells: [GeohashScore] = []
    @Published private(set) var shareItem: ShareItem?
    @Published private(set) var exportErrorMessage: String?

    let language: ConsoleLanguage

    private let repository: AnalyticsRepositoryProtocol
    private let organizationId: String
    private let vertical: String
    private let exportService: ExportWriting

    init(
        repository: AnalyticsRepositoryProtocol,
        organizationId: String,
        vertical: String = "pharmacy",
        language: ConsoleLanguage,
        exportService: ExportWriting = ExportService(),
        now: Date = Date()
    ) {
        self.repository = repository
        self.organizationId = organizationId
        self.vertical = vertical
        self.language = language
        self.exportService = exportService
        self.endDate = now
        self.startDate = Calendar(identifier: .gregorian).date(byAdding: .day, value: -30, to: now) ?? now
    }

    // MARK: - Derived state

    /// Cells whose `snapshotDate` (`yyyy-MM-dd`) falls within
    /// `[startDate, endDate]`, inclusive. Rows with an unparsable date are
    /// kept rather than silently dropped, mirroring
    /// `AnalyticsRepository.anomalies`'s equivalent filter.
    var filteredCells: [GeohashScore] {
        let start = Self.dateOnlyFormatter.string(from: startDate)
        let end = Self.dateOnlyFormatter.string(from: endDate)
        return cells.filter { $0.snapshotDate >= start && $0.snapshotDate <= end }
    }

    var isEmpty: Bool { loadState == .loaded && filteredCells.isEmpty }

    var canExport: Bool { loadState == .loaded && !filteredCells.isEmpty }

    var loadErrorMessage: String? {
        if case .failed(let message) = loadState { return message }
        return nil
    }

    private var exportRows: [ExportRow] {
        filteredCells.map { cell in
            ExportRow(
                id: cell.cellId,
                name: cell.summary,
                type: cell.verticalId,
                latitude: cell.center.latitude,
                longitude: cell.center.longitude,
                capturedAt: cell.snapshotDate
            )
        }
    }

    private var exportFeatures: [ExportFeature] {
        filteredCells.map { cell in
            ExportFeature(
                id: cell.cellId,
                latitude: cell.center.latitude,
                longitude: cell.center.longitude,
                properties: [
                    "vertical": cell.verticalId,
                    "snapshotDate": cell.snapshotDate,
                    "opportunityScore": String(cell.opportunityScore),
                    "summary": cell.summary
                ]
            )
        }
    }

    // MARK: - Load

    func load() async {
        guard loadState != .loading else { return }
        loadState = .loading
        await fetch()
    }

    func refresh() async {
        loadState = .loading
        await fetch()
    }

    private func fetch() async {
        do {
            cells = try await repository.spatialIntelligence(organizationId: organizationId, vertical: vertical)
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
            "Export data failed to load. Tap retry or check your connection.",
            "Impossible de charger les données d'export. Réessayez ou vérifiez votre connexion."
        )
    }

    // MARK: - Export

    /// Encodes the currently filtered data in the selected `format` and
    /// writes it to a temp file via `exportService`, publishing `shareItem`
    /// on success (driving `ExportPanelView`'s share-sheet presentation) or
    /// `exportErrorMessage` on failure.
    func exportTapped() {
        exportErrorMessage = nil
        do {
            let url = try exportService.write(
                rows: exportRows,
                features: exportFeatures,
                format: format,
                title: language.t("African Data Layer — Analytics Export", "African Data Layer — Export analytique")
            )
            shareItem = ShareItem(url: url)
        } catch {
            exportErrorMessage = language.t(
                "Couldn't generate the export file. Try again.",
                "Impossible de générer le fichier d'export. Réessayez."
            )
        }
    }

    func shareSheetDismissed() {
        shareItem = nil
    }

    private static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
