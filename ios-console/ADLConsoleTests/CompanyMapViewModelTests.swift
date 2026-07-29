@testable import ADLConsole
import ConsoleAPI
import ConsoleForms
import ConsoleModels
import XCTest

/// Covers `CompanyMapViewModel`: loads approved company records, collapses
/// them to N pins via `PointChainGrouping.collapseRecordChains`, exposes
/// mappable annotations, and yields a tapped point's ordered chain for the
/// detail sheet. Source of truth for behavior: the web field app's
/// company-explore map (`components/Screens/Home.tsx`'s `loadPoints`,
/// company-explore branch) — `listApprovedPlatformRecords` +
/// `collapseRecordChains`, ported one-to-one.
@MainActor
final class CompanyMapViewModelTests: XCTestCase {
    private func recordJSON(
        id: String,
        createdAt: String,
        pointId: String? = nil,
        gps: (Double, Double)? = (4.05, 9.7),
        status: String = "approved"
    ) -> String {
        let pointIdField = pointId.map { "\"pointId\": \"\($0)\"," } ?? ""
        let gpsField = gps.map { "\"gps\": {\"latitude\": \($0.0), \"longitude\": \($0.1)}," } ?? ""
        return """
        {
            "id": "\(id)",
            "projectId": "proj-1",
            "organizationId": "org-1",
            "schemaVersionId": "schema-1",
            "recordTypeKey": "pharmacy",
            "data": {"name": "Acme Pharmacy"},
            "evidence": {\(gpsField) "photos": []},
            "status": "\(status)",
            "capturedBy": "user-1",
            "createdAt": "\(createdAt)",
            \(pointIdField)
            "reviewedBy": null
        }
        """
    }

    private func listResponse(_ records: [String]) -> Data {
        Data("""
        {"records": [\(records.joined(separator: ","))]}
        """.utf8)
    }

    private func makeViewModel(transport: RoutingMockPlatformTransport) -> CompanyMapViewModel {
        CompanyMapViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            language: .en
        )
    }

    // MARK: - Load + collapse

    func testLoadCollapsesRecordsIntoOnePinPerChain() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            listResponse([
                recordJSON(id: "root-1", createdAt: "2026-07-18T10:00:00Z"),
                recordJSON(id: "e1", createdAt: "2026-07-19T10:00:00Z", pointId: "root-1"),
                recordJSON(id: "root-2", createdAt: "2026-07-17T10:00:00Z"),
            ]),
            forView: "platform_record_browse"
        )
        let viewModel = makeViewModel(transport: transport)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.points.count, 2, "root-1 + e1 must collapse to one pin")
        XCTAssertFalse(viewModel.isEmpty)

        // Exact params cross-checked vs `listApprovedPlatformRecordsRequest`/
        // `PlatformAPIClient.listApprovedPlatformRecords`.
        let request = transport.lastRequest
        XCTAssertEqual(request?.httpMethod, "GET")
        let components = URLComponents(url: request!.url!, resolvingAgainstBaseURL: false)
        XCTAssertEqual(components?.queryItems?.first { $0.name == "organizationId" }?.value, "org-1")
    }

    func testEmptyResponseYieldsEmptyState() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse([]), forView: "platform_record_browse")
        let viewModel = makeViewModel(transport: transport)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertTrue(viewModel.points.isEmpty)
        XCTAssertTrue(viewModel.isEmpty)
        XCTAssertTrue(viewModel.annotations.isEmpty)
    }

    func testLoadFailureSurfacesFriendlyMessage() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"error\":\"boom\"}".utf8), forView: "platform_record_browse")
        let viewModel = CompanyMapViewModel(
            apiClient: PlatformAPIClient(
                baseURL: URL(string: "https://example.com")!,
                transport: StatusOverrideTransport(inner: transport, view: "platform_record_browse", statusCode: 503)
            ),
            organizationId: "org-1",
            language: .en,
            offlineCache: InMemoryConsoleOfflineCache()
        )

        await viewModel.load()

        guard case .failed(let message) = viewModel.loadState else {
            return XCTFail("expected .failed load state")
        }
        XCTAssertEqual(message, "Company records failed to load. Tap retry or check your connection.")
        XCTAssertEqual(viewModel.loadErrorMessage, message)
    }

    func testLoadFallsBackToCachedApprovedRecordsWhenOffline() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"error\":\"offline\"}".utf8), forView: "platform_record_browse")
        let cachedRecord = PlatformRecord(
            id: "cached-root",
            projectId: "proj-1",
            organizationId: "org-1",
            schemaVersionId: "schema-1",
            recordTypeKey: "pharmacy",
            data: ["name": .string("Cached Pharmacy")],
            evidence: PlatformRecordEvidence(
                gps: PlatformRecordGps(latitude: 4.05, longitude: 9.7),
                photos: []
            ),
            status: .approved,
            capturedBy: "user-1",
            createdAt: "2026-07-18T10:00:00Z"
        )
        let cache = InMemoryConsoleOfflineCache(approvedRecordsByOrganizationId: ["org-1": [cachedRecord]])
        let viewModel = CompanyMapViewModel(
            apiClient: PlatformAPIClient(
                baseURL: URL(string: "https://example.com")!,
                transport: StatusOverrideTransport(inner: transport, view: "platform_record_browse", statusCode: 503)
            ),
            organizationId: "org-1",
            language: .en,
            offlineCache: cache
        )

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.points.map(\.rootId), ["cached-root"])
        XCTAssertEqual(viewModel.annotations.count, 1)
    }

    // MARK: - Collector location

    func testRefreshUserLocationPublishesCurrentDeviceFix() async {
        let transport = RoutingMockPlatformTransport()
        let expected = FormGpsValue(latitude: -1.286389, longitude: 36.817223, accuracyMeters: 7)
        let locationService = MockLocationService(behavior: .succeed(expected))
        let viewModel = CompanyMapViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            language: .en,
            locationService: locationService
        )

        let location = await viewModel.refreshUserLocation()

        XCTAssertEqual(location, expected)
        XCTAssertEqual(viewModel.userLocation, expected)
        XCTAssertNil(viewModel.locationErrorMessage)
        XCTAssertFalse(viewModel.isLocatingUser)
        XCTAssertEqual(locationService.requestCount, 1)
    }

    func testRefreshUserLocationSurfacesPermissionFailureWithoutInventingCoordinate() async {
        let transport = RoutingMockPlatformTransport()
        let locationService = MockLocationService(behavior: .fail(.permissionDenied))
        let viewModel = CompanyMapViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            language: .en,
            locationService: locationService
        )

        let location = await viewModel.refreshUserLocation()

        XCTAssertNil(location)
        XCTAssertNil(viewModel.userLocation)
        XCTAssertEqual(
            viewModel.locationErrorMessage,
            "Location access is off. Enable it in Settings to show your position."
        )
        XCTAssertFalse(viewModel.isLocatingUser)
    }

    func testRefreshUserLocationRejectsInvalidCoordinate() async {
        let transport = RoutingMockPlatformTransport()
        let locationService = MockLocationService(
            behavior: .succeed(FormGpsValue(latitude: 120, longitude: 36.817223, accuracyMeters: 7))
        )
        let viewModel = CompanyMapViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            language: .en,
            locationService: locationService
        )

        let location = await viewModel.refreshUserLocation()

        XCTAssertNil(location)
        XCTAssertNil(viewModel.userLocation)
        XCTAssertEqual(
            viewModel.locationErrorMessage,
            "Your position is unavailable. Tap the location button to try again."
        )
    }

    // MARK: - Annotations (map-placeable subset)

    func testAnnotationsExcludePointsWithNoGpsOnTheirRepresentative() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            listResponse([
                recordJSON(id: "has-gps", createdAt: "2026-07-18T10:00:00Z", gps: (4.05, 9.7)),
                recordJSON(id: "no-gps", createdAt: "2026-07-18T10:00:00Z", gps: nil),
            ]),
            forView: "platform_record_browse"
        )
        let viewModel = makeViewModel(transport: transport)

        await viewModel.load()

        XCTAssertEqual(viewModel.points.count, 2, "both still count as points")
        XCTAssertEqual(viewModel.annotations.map(\.representative.id), ["has-gps"], "only the GPS-bearing point is mappable")
    }

    // MARK: - Selection -> ordered chain for the detail sheet

    func testSelectExposesOrderedChainNewestFirstForTheDetailSheet() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            listResponse([
                recordJSON(id: "e1", createdAt: "2026-07-19T10:00:00Z", pointId: "root-1"),
                recordJSON(id: "root-1", createdAt: "2026-07-18T10:00:00Z"),
                recordJSON(id: "e2", createdAt: "2026-07-20T10:00:00Z", pointId: "root-1"),
            ]),
            forView: "platform_record_browse"
        )
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()

        XCTAssertNil(viewModel.selectedPoint)
        let point = viewModel.points[0]
        viewModel.select(point)

        XCTAssertEqual(viewModel.selectedPoint?.chain.map(\.id), ["e2", "e1", "root-1"])
        XCTAssertEqual(viewModel.selectedPoint?.chainCount, 3)
        XCTAssertEqual(viewModel.selectedPoint?.rootId, "root-1")

        viewModel.clearSelection()
        XCTAssertNil(viewModel.selectedPoint)
    }

    // MARK: - Overlay mode (Grid / Heat) — mocks AnalyticsRepositoryProtocol
    // directly, mirroring DeltaDashboardViewModelTests' approach, since that
    // (not PlatformTransport) is the seam CompanyMapViewModel's overlay
    // state actually depends on.

    private func makeGeohashScore(
        cellId: String = "u4pruy",
        opportunityScore: Double = 72,
        totalPoints: Int = 12,
        latitude: Double = 4.05,
        longitude: Double = 9.74
    ) -> GeohashScore {
        GeohashScore(
            cellId: cellId,
            verticalId: "pharmacy",
            snapshotDate: "2026-07-20",
            center: GeoCenter(latitude: latitude, longitude: longitude),
            totalPoints: totalPoints,
            completedPoints: totalPoints,
            completionRate: 1,
            avgConfidenceScore: 0.8,
            photoCoverageRate: 0.9,
            recentActivityRate: 0.5,
            medianFreshnessDays: 2,
            publishableChangeCount: 1,
            newCount: 1,
            removedCount: 0,
            changedCount: 0,
            operatorDiversity: 2,
            marketSignalScore: 50,
            opportunityScore: opportunityScore,
            coverageGapScore: 20,
            changeSignalScore: 10,
            drivers: [],
            caveats: [],
            summary: ""
        )
    }

    private func makeOverlayViewModel(analyticsRepository: MockAnalyticsRepository) -> CompanyMapViewModel {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse([]), forView: "platform_record_browse")
        return CompanyMapViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            language: .en,
            analyticsRepository: analyticsRepository
        )
    }

    func testSetOverlayModeGridLoadsGridCells() async {
        let analyticsRepository = MockAnalyticsRepository()
        analyticsRepository.spatialIntelligenceResult = .success([makeGeohashScore()])
        let viewModel = makeOverlayViewModel(analyticsRepository: analyticsRepository)

        await viewModel.setOverlayMode(.grid)

        XCTAssertEqual(viewModel.overlayMode, .grid)
        XCTAssertEqual(viewModel.gridCells.count, 1)
        XCTAssertEqual(viewModel.spatialLoadState, .loaded)
        XCTAssertEqual(analyticsRepository.spatialIntelligenceCalls.count, 1)
        XCTAssertEqual(analyticsRepository.spatialIntelligenceCalls.first?.organizationId, "org-1")
        XCTAssertEqual(analyticsRepository.spatialIntelligenceCalls.first?.vertical, "all")
    }

    func testHeatCellsAreDerivedFromGridCellsWithoutASecondRepositoryCall() async {
        let analyticsRepository = MockAnalyticsRepository()
        analyticsRepository.spatialIntelligenceResult = .success([
            makeGeohashScore(cellId: "u4pruy", opportunityScore: 72, latitude: 4.05, longitude: 9.74),
        ])
        let viewModel = makeOverlayViewModel(analyticsRepository: analyticsRepository)

        await viewModel.setOverlayMode(.heat)

        XCTAssertEqual(viewModel.heatCells.count, 1)
        XCTAssertEqual(viewModel.heatCells.first?.geohash, "u4pruy")
        XCTAssertEqual(viewModel.heatCells.first?.intensity, 72)
        XCTAssertEqual(viewModel.heatCells.first?.latitude, 4.05)
        XCTAssertEqual(viewModel.heatCells.first?.longitude, 9.74)
        // heatMapData is never called — heatCells is derived client-side
        // from the same gridCells the .grid mode already loaded.
        XCTAssertEqual(analyticsRepository.spatialIntelligenceCalls.count, 1)
    }

    func testSetOverlayModeDoesNotReloadWhenAlreadyLoaded() async {
        let analyticsRepository = MockAnalyticsRepository()
        analyticsRepository.spatialIntelligenceResult = .success([makeGeohashScore()])
        let viewModel = makeOverlayViewModel(analyticsRepository: analyticsRepository)

        await viewModel.setOverlayMode(.grid)
        await viewModel.setOverlayMode(.heat)
        await viewModel.setOverlayMode(.grid)

        XCTAssertEqual(analyticsRepository.spatialIntelligenceCalls.count, 1, "cells are shared across grid/heat once loaded")
    }

    func testSetOverlayModeNoneDoesNotTriggerALoad() async {
        let analyticsRepository = MockAnalyticsRepository()
        let viewModel = makeOverlayViewModel(analyticsRepository: analyticsRepository)

        await viewModel.setOverlayMode(.none)

        XCTAssertEqual(viewModel.overlayMode, .none)
        XCTAssertEqual(analyticsRepository.spatialIntelligenceCalls.count, 0)
        XCTAssertEqual(viewModel.spatialLoadState, .idle)
    }

    func testSpatialLoadFailureSurfacesErrorStateAndRetrySucceeds() async {
        let analyticsRepository = MockAnalyticsRepository()
        analyticsRepository.spatialIntelligenceResult = .failure(PlatformAPIError(message: "Service unavailable", status: 503))
        let viewModel = makeOverlayViewModel(analyticsRepository: analyticsRepository)

        await viewModel.setOverlayMode(.grid)

        guard case .failed = viewModel.spatialLoadState else {
            return XCTFail("expected .failed spatialLoadState, got \(viewModel.spatialLoadState)")
        }
        XCTAssertNotNil(viewModel.spatialLoadErrorMessage)
        XCTAssertTrue(viewModel.gridCells.isEmpty)

        analyticsRepository.spatialIntelligenceResult = .success([makeGeohashScore()])
        await viewModel.retrySpatialLoad()

        XCTAssertEqual(viewModel.spatialLoadState, .loaded)
        XCTAssertEqual(viewModel.gridCells.count, 1)
        XCTAssertNil(viewModel.spatialLoadErrorMessage)
    }

    func test4xxSpatialErrorSurfacesTheServerMessageVerbatim() async {
        let analyticsRepository = MockAnalyticsRepository()
        analyticsRepository.spatialIntelligenceResult = .failure(PlatformAPIError(message: "Not authorized for this organization", status: 403))
        let viewModel = makeOverlayViewModel(analyticsRepository: analyticsRepository)

        await viewModel.setOverlayMode(.grid)

        XCTAssertEqual(viewModel.spatialLoadErrorMessage, "Not authorized for this organization")
    }

    func testSelectAndClearGridCell() async {
        let analyticsRepository = MockAnalyticsRepository()
        let viewModel = makeOverlayViewModel(analyticsRepository: analyticsRepository)
        let cell = makeGeohashScore(cellId: "abcdef")

        XCTAssertNil(viewModel.selectedGridCell)
        viewModel.selectGridCell(cell)
        XCTAssertEqual(viewModel.selectedGridCell?.cellId, "abcdef")

        viewModel.clearGridSelection()
        XCTAssertNil(viewModel.selectedGridCell)
    }
}

/// Forces every response for a specific `view` query param to a fixed
/// non-2xx status code — reused verbatim from `ReviewQueueViewModelTests`'s
/// pattern (not shared across files since it is test-only and file-private
/// there).
private final class StatusOverrideTransport: PlatformTransport, @unchecked Sendable {
    private let inner: RoutingMockPlatformTransport
    private let view: String
    private let statusCode: Int

    init(inner: RoutingMockPlatformTransport, view: String, statusCode: Int) {
        self.inner = inner
        self.view = view
        self.statusCode = statusCode
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await inner.send(request)
        guard response.url?.query?.contains("view=\(view)") == true else {
            return (data, response)
        }
        let failingResponse = HTTPURLResponse(
            url: response.url!,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: ["content-type": "application/json"]
        )!
        return (data, failingResponse)
    }
}
