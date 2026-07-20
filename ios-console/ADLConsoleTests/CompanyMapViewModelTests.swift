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
            language: .en
        )

        await viewModel.load()

        guard case .failed(let message) = viewModel.loadState else {
            return XCTFail("expected .failed load state")
        }
        XCTAssertEqual(message, "Company records failed to load. Tap retry or check your connection.")
        XCTAssertEqual(viewModel.loadErrorMessage, message)
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
