@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers Task 6's testable core: `ReviewQueueViewModel`. Source of truth for
/// behavior is `components/Console/ReviewQueueScreen.tsx` (web, read-only
/// reference) + `lib/client/platformApi.ts` — see the doc comment on
/// `ReviewQueueViewModel` for the two deliberate, documented differences
/// (server-side `status=pending_review` filtering; a resolved record is
/// removed from this pending-only queue instead of replaced in place).
@MainActor
final class ReviewQueueViewModelTests: XCTestCase {
    private func recordJSON(id: String, capturedBy: String = "user-1") -> String {
        """
        {
            "id": "\(id)",
            "projectId": "proj-1",
            "organizationId": "org-1",
            "schemaVersionId": "schema-1",
            "recordTypeKey": "pharmacy",
            "data": {"name": "Acme Pharmacy"},
            "evidence": {"photos": []},
            "status": "pending_review",
            "capturedBy": "\(capturedBy)",
            "createdAt": "2026-07-19T10:00:00.000Z"
        }
        """
    }

    private func listResponse(_ ids: [String]) -> Data {
        Data("""
        {"records": [\(ids.map { recordJSON(id: $0) }.joined(separator: ","))]}
        """.utf8)
    }

    private func reviewResponse(id: String) -> Data {
        Data("{\"record\": \(recordJSON(id: id))}".utf8)
    }

    private func makeViewModel(transport: RoutingMockPlatformTransport) -> ReviewQueueViewModel {
        ReviewQueueViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            language: .en
        )
    }

    // MARK: - Load

    func testLoadPopulatesPendingRecordsWithServerSideStatusFilter() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse(["rec-1", "rec-2"]), forView: "platform_record_list")
        let viewModel = makeViewModel(transport: transport)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.records.map(\.id), ["rec-1", "rec-2"])
        XCTAssertFalse(viewModel.isEmpty)

        // Exact param cross-checked vs `listPlatformRecordsRequest`/`PlatformAPIClient.listPlatformRecords`:
        // GET view=platform_record_list with organizationId + status=pending_review.
        let request = transport.lastRequest
        XCTAssertNotNil(request)
        let components = URLComponents(url: request!.url!, resolvingAgainstBaseURL: false)
        let queryItems = components?.queryItems ?? []
        XCTAssertEqual(queryItems.first { $0.name == "organizationId" }?.value, "org-1")
        XCTAssertEqual(queryItems.first { $0.name == "status" }?.value, "pending_review")
        XCTAssertEqual(request?.httpMethod, "GET")
    }

    func testEmptyResponseYieldsEmptyState() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse([]), forView: "platform_record_list")
        let viewModel = makeViewModel(transport: transport)

        await viewModel.load()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertTrue(viewModel.records.isEmpty)
        XCTAssertTrue(viewModel.isEmpty)
    }

    func testLoadFailureSurfacesFriendlyMessageForServerError() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"error\":\"boom\"}".utf8), forView: "platform_record_list")
        let viewModel = ReviewQueueViewModel(
            apiClient: PlatformAPIClient(
                baseURL: URL(string: "https://example.com")!,
                transport: StatusOverrideTransport(inner: transport, view: "platform_record_list", statusCode: 503)
            ),
            organizationId: "org-1",
            language: .en
        )

        await viewModel.load()

        guard case .failed(let message) = viewModel.loadState else {
            return XCTFail("expected .failed load state")
        }
        XCTAssertEqual(message, "Could not load company records. Check your connection and try again.")
    }

    // MARK: - Approve

    func testOfflineReviewPolicyBlocksDecisionBeforeNetwork() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = ReviewQueueViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            language: .en,
            mutationAllowed: { false }
        )

        XCTAssertFalse(viewModel.canMutate)
        let approved = await viewModel.approve("rec-1")
        XCTAssertFalse(approved)
        XCTAssertTrue(transport.requests(forView: "platform_record_review").isEmpty)
    }

    func testApproveCallsReviewPlatformRecordWithApprovePayloadAndRemovesItem() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse(["rec-1", "rec-2"]), forView: "platform_record_list")
        transport.setResponse(reviewResponse(id: "rec-1"), forView: "platform_record_review")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()

        let succeeded = await viewModel.approve("rec-1")

        XCTAssertTrue(succeeded)
        XCTAssertEqual(viewModel.records.map(\.id), ["rec-2"])

        let requests = transport.requests(forView: "platform_record_review")
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests[0].httpMethod, "POST")
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["organizationId"] as? String, "org-1")
        XCTAssertEqual(body?["recordId"] as? String, "rec-1")
        XCTAssertEqual(body?["status"] as? String, "approved")
        XCTAssertNil(body?["reviewNotes"])
    }

    // MARK: - Reject

    func testRejectSendsReasonAsReviewNotesAndRemovesItem() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse(["rec-1"]), forView: "platform_record_list")
        transport.setResponse(reviewResponse(id: "rec-1"), forView: "platform_record_review")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()

        let succeeded = await viewModel.reject("rec-1", reason: "  Blurry photo  ")

        XCTAssertTrue(succeeded)
        XCTAssertTrue(viewModel.records.isEmpty)

        let requests = transport.requests(forView: "platform_record_review")
        XCTAssertEqual(requests.count, 1)
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["status"] as? String, "rejected")
        XCTAssertEqual(body?["reviewNotes"] as? String, "Blurry photo")
    }

    func testRejectWithEmptyReasonIsBlockedClientSideWithoutCallingApi() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse(["rec-1"]), forView: "platform_record_list")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()

        let succeeded = await viewModel.reject("rec-1", reason: "   ")

        XCTAssertFalse(succeeded)
        XCTAssertEqual(viewModel.records.map(\.id), ["rec-1"])
        XCTAssertTrue(transport.requests(forView: "platform_record_review").isEmpty)
        XCTAssertEqual(
            viewModel.itemError(for: "rec-1"),
            "Add a rejection reason before rejecting this record."
        )
    }

    // MARK: - Mass-approve

    func testApproveSelectedIteratesSelectionAndCallsPerRecord() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse(["rec-1", "rec-2", "rec-3"]), forView: "platform_record_list")
        transport.setResponse(reviewResponse(id: "rec-x"), forView: "platform_record_review")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()
        viewModel.toggleSelection("rec-1")
        viewModel.toggleSelection("rec-2")

        let succeededCount = await viewModel.approveSelected()

        XCTAssertEqual(succeededCount, 2)
        XCTAssertEqual(viewModel.records.map(\.id), ["rec-3"])
        XCTAssertTrue(viewModel.selection.isEmpty)
        XCTAssertEqual(transport.requests(forView: "platform_record_review").count, 2)
    }

    func testMassApproveFailingItemLeavesOthersIntactAndSurfacesItsError() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse(["rec-1", "rec-2"]), forView: "platform_record_list")
        transport.setResponse(reviewResponse(id: "rec-x"), forView: "platform_record_review")
        let failingTransport = RecordReviewFailureTransport(inner: transport, failingRecordId: "rec-1")
        let viewModel = ReviewQueueViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: failingTransport),
            organizationId: "org-1",
            language: .en
        )
        await viewModel.load()
        viewModel.toggleSelection("rec-1")
        viewModel.toggleSelection("rec-2")

        let succeededCount = await viewModel.approveSelected()

        XCTAssertEqual(succeededCount, 1)
        // rec-1 failed and stays; rec-2 succeeded and was removed.
        XCTAssertEqual(viewModel.records.map(\.id), ["rec-1"])
        XCTAssertTrue(viewModel.selection.contains("rec-1"))
        XCTAssertFalse(viewModel.selection.contains("rec-2"))
        XCTAssertNotNil(viewModel.itemError(for: "rec-1"))
        XCTAssertNil(viewModel.itemError(for: "rec-2"))
    }

    // MARK: - Selection helpers

    func testToggleSelectionAddsAndRemoves() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse(["rec-1"]), forView: "platform_record_list")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()

        viewModel.toggleSelection("rec-1")
        XCTAssertTrue(viewModel.isSelected("rec-1"))

        viewModel.toggleSelection("rec-1")
        XCTAssertFalse(viewModel.isSelected("rec-1"))
    }
}

/// Forces every response for a specific `view` query param to a fixed
/// non-2xx status code — used to simulate a server-side load failure.
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

/// Forces the `platform_record_review` response for one specific `recordId`
/// (read from the POST body) to a 500 — used to simulate one failing item in
/// a mass-approve batch while every other record's request still succeeds.
private final class RecordReviewFailureTransport: PlatformTransport, @unchecked Sendable {
    private let inner: RoutingMockPlatformTransport
    private let failingRecordId: String

    init(inner: RoutingMockPlatformTransport, failingRecordId: String) {
        self.inner = inner
        self.failingRecordId = failingRecordId
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await inner.send(request)
        guard response.url?.query?.contains("view=platform_record_review") == true,
              let body = request.httpBody,
              let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
              json["recordId"] as? String == failingRecordId
        else {
            return (data, response)
        }
        let failingResponse = HTTPURLResponse(
            url: response.url!,
            statusCode: 500,
            httpVersion: "HTTP/1.1",
            headerFields: ["content-type": "application/json"]
        )!
        return (Data("{\"error\": \"simulated failure\"}".utf8), failingResponse)
    }
}
