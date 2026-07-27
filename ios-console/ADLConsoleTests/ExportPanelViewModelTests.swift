@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers `ExportPanelViewModel`: loads spatial-intelligence cells for the
/// configured vertical, filters them by the selected date range, and
/// produces a share-ready file for the selected `ExportFormat`. Mocks both
/// `AnalyticsRepositoryProtocol` (via `MockAnalyticsRepository`, already
/// defined in `DeltaDashboardViewModelTests.swift` and shared across this
/// test target) and `ExportWriting` (via `MockExportWriter` below), so
/// these tests never touch real networking, file I/O, or
/// `UIGraphicsPDFRenderer` — per the task brief, the PDF/data-writing step
/// is exactly the seam meant to be mocked here.
@MainActor
final class ExportPanelViewModelTests: XCTestCase {
    private static let fixedNow: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 7
        components.day = 24
        components.timeZone = TimeZone(identifier: "UTC")
        return Calendar(identifier: .gregorian).date(from: components)!
    }()

    private func makeCell(
        id: String,
        vertical: String = "pharmacy",
        snapshotDate: String,
        opportunityScore: Double = 0.5
    ) -> GeohashScore {
        GeohashScore(
            cellId: id,
            verticalId: vertical,
            snapshotDate: snapshotDate,
            center: GeoCenter(latitude: 4.05, longitude: 9.74),
            totalPoints: 10,
            completedPoints: 5,
            completionRate: 0.5,
            avgConfidenceScore: 0.7,
            photoCoverageRate: 0.8,
            recentActivityRate: 0.4,
            medianFreshnessDays: 2,
            publishableChangeCount: 1,
            newCount: 1,
            removedCount: 0,
            changedCount: 0,
            operatorDiversity: 1,
            marketSignalScore: 0.5,
            opportunityScore: opportunityScore,
            coverageGapScore: 0.1,
            changeSignalScore: 0.2,
            drivers: [],
            caveats: [],
            summary: "Cell \(id)"
        )
    }

    private func makeViewModel(
        repository: MockAnalyticsRepository,
        exportService: MockExportWriter = MockExportWriter(),
        now: Date = ExportPanelViewModelTests.fixedNow
    ) -> ExportPanelViewModel {
        ExportPanelViewModel(
            repository: repository,
            organizationId: "o1",
            language: .en,
            exportService: exportService,
            now: now
        )
    }

    // MARK: - Load

    func testLoadPopulatesCellsFromSpatialIntelligenceForTheConfiguredVertical() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([makeCell(id: "c1", snapshotDate: "2026-07-10")])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.cells.count, 1)
        XCTAssertEqual(repository.spatialIntelligenceCalls.first?.organizationId, "o1")
        XCTAssertEqual(repository.spatialIntelligenceCalls.first?.vertical, "pharmacy")
    }

    func testLoadFailureSurfacesErrorStateWithoutCrashing() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .failure(PlatformAPIError(message: "boom", status: 500))
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        guard case .failed = viewModel.loadState else {
            return XCTFail("expected .failed load state, got \(viewModel.loadState)")
        }
    }

    // MARK: - Date-range filtering

    func testFilteredCellsExcludesCellsOutsideTheSelectedDateRange() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([
            makeCell(id: "too-old", snapshotDate: "2026-05-01"),
            makeCell(id: "in-range", snapshotDate: "2026-07-10"),
            makeCell(id: "too-new", snapshotDate: "2026-08-01")
        ])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(viewModel.filteredCells.map(\.cellId), ["in-range"])
    }

    func testCanExportIsFalseWhenTheFilteredSetIsEmpty() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([makeCell(id: "too-old", snapshotDate: "2026-01-01")])
        let viewModel = makeViewModel(repository: repository)

        await viewModel.load()

        XCTAssertTrue(viewModel.isEmpty)
        XCTAssertFalse(viewModel.canExport)
    }

    func testDefaultDateRangeIsTrailingThirtyDaysFromNow() {
        let repository = MockAnalyticsRepository()
        let viewModel = makeViewModel(repository: repository)
        let calendar = Calendar(identifier: .gregorian)
        let expectedStart = calendar.date(byAdding: .day, value: -30, to: Self.fixedNow)!

        XCTAssertEqual(viewModel.endDate, Self.fixedNow)
        XCTAssertEqual(calendar.startOfDay(for: viewModel.startDate), calendar.startOfDay(for: expectedStart))
    }

    // MARK: - Format selection + file-URL production

    func testExportTappedWritesTheSelectedFormatAndPublishesAShareItem() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([makeCell(id: "c1", snapshotDate: "2026-07-10")])
        let writer = MockExportWriter()
        writer.writeResult = .success(URL(fileURLWithPath: "/tmp/export.geojson"))
        let viewModel = makeViewModel(repository: repository, exportService: writer)
        await viewModel.load()

        viewModel.format = .geoJSON
        viewModel.exportTapped()

        XCTAssertEqual(writer.writeCalls.count, 1)
        XCTAssertEqual(writer.writeCalls.first?.format, .geoJSON)
        XCTAssertEqual(writer.writeCalls.first?.rows.count, 1)
        XCTAssertEqual(writer.writeCalls.first?.features.count, 1)
        XCTAssertEqual(viewModel.shareItem?.url, URL(fileURLWithPath: "/tmp/export.geojson"))
        XCTAssertNil(viewModel.exportErrorMessage)
    }

    func testExportTappedWithCsvFormatPassesCsvThroughToTheWriter() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([makeCell(id: "c1", snapshotDate: "2026-07-10")])
        let writer = MockExportWriter()
        writer.writeResult = .success(URL(fileURLWithPath: "/tmp/export.csv"))
        let viewModel = makeViewModel(repository: repository, exportService: writer)
        await viewModel.load()

        viewModel.format = .csv
        viewModel.exportTapped()

        XCTAssertEqual(writer.writeCalls.first?.format, .csv)
    }

    func testExportTappedWithPdfFormatPassesPdfThroughToTheWriter() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([makeCell(id: "c1", snapshotDate: "2026-07-10")])
        let writer = MockExportWriter()
        writer.writeResult = .success(URL(fileURLWithPath: "/tmp/export.pdf"))
        let viewModel = makeViewModel(repository: repository, exportService: writer)
        await viewModel.load()

        viewModel.format = .pdf
        viewModel.exportTapped()

        XCTAssertEqual(writer.writeCalls.first?.format, .pdf)
    }

    func testExportTappedPassesRowsShapedFromTheFilteredCells() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([makeCell(id: "c1", vertical: "fuel_station", snapshotDate: "2026-07-10")])
        let writer = MockExportWriter()
        writer.writeResult = .success(URL(fileURLWithPath: "/tmp/export.csv"))
        let viewModel = makeViewModel(repository: repository, exportService: writer)
        await viewModel.load()

        viewModel.exportTapped()

        let row = try? XCTUnwrap(writer.writeCalls.first?.rows.first)
        XCTAssertEqual(row?.id, "c1")
        XCTAssertEqual(row?.type, "fuel_station")
        XCTAssertEqual(row?.latitude, 4.05)
        XCTAssertEqual(row?.longitude, 9.74)
        XCTAssertEqual(row?.capturedAt, "2026-07-10")
    }

    func testExportTappedExcludesCellsOutsideTheDateRangeFromTheWrittenRows() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([
            makeCell(id: "too-old", snapshotDate: "2026-01-01"),
            makeCell(id: "in-range", snapshotDate: "2026-07-10")
        ])
        let writer = MockExportWriter()
        writer.writeResult = .success(URL(fileURLWithPath: "/tmp/export.csv"))
        let viewModel = makeViewModel(repository: repository, exportService: writer)
        await viewModel.load()

        viewModel.exportTapped()

        XCTAssertEqual(writer.writeCalls.first?.rows.map(\.id), ["in-range"])
    }

    func testExportTappedSurfacesAnErrorMessageWhenWritingFails() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([makeCell(id: "c1", snapshotDate: "2026-07-10")])
        let writer = MockExportWriter()
        writer.writeResult = .failure(NSError(domain: "test", code: 1))
        let viewModel = makeViewModel(repository: repository, exportService: writer)
        await viewModel.load()

        viewModel.exportTapped()

        XCTAssertNil(viewModel.shareItem)
        XCTAssertNotNil(viewModel.exportErrorMessage)
    }

    func testShareSheetDismissedClearsTheShareItem() async {
        let repository = MockAnalyticsRepository()
        repository.spatialIntelligenceResult = .success([makeCell(id: "c1", snapshotDate: "2026-07-10")])
        let writer = MockExportWriter()
        writer.writeResult = .success(URL(fileURLWithPath: "/tmp/export.pdf"))
        let viewModel = makeViewModel(repository: repository, exportService: writer)
        await viewModel.load()
        viewModel.exportTapped()
        XCTAssertNotNil(viewModel.shareItem)

        viewModel.shareSheetDismissed()

        XCTAssertNil(viewModel.shareItem)
    }
}

/// Test double for `ExportWriting` — records calls and returns a canned
/// `Result`, so `ExportPanelViewModel` tests never touch real file I/O or
/// `UIGraphicsPDFRenderer`.
final class MockExportWriter: ExportWriting, @unchecked Sendable {
    struct WriteCall: Equatable {
        let rows: [ExportRow]
        let features: [ExportFeature]
        let format: ExportFormat
        let title: String
    }

    var writeResult: Result<URL, Error> = .success(URL(fileURLWithPath: "/tmp/export.csv"))
    private(set) var writeCalls: [WriteCall] = []

    func write(rows: [ExportRow], features: [ExportFeature], format: ExportFormat, title: String) throws -> URL {
        writeCalls.append(WriteCall(rows: rows, features: features, format: format, title: title))
        return try writeResult.get()
    }
}
