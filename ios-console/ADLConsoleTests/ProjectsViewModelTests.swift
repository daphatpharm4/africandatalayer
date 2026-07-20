@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers Task 7a's `ProjectsViewModel`. Source of truth for behavior is
/// `components/Console/ProjectsScreen.tsx` (web, read-only reference) +
/// `lib/client/platformApi.ts`.
@MainActor
final class ProjectsViewModelTests: XCTestCase {
    private func projectJSON(id: String, name: String = "Douala Pilot", coverageLabel: String? = "Douala") -> String {
        """
        {
            "id": "\(id)",
            "organizationId": "org-1",
            "name": "\(name)",
            "status": "draft",
            "coverageScope": "town",
            "coverageLabel": \(coverageLabel.map { "\"\($0)\"" } ?? "null"),
            "createdAt": "2026-07-19T10:00:00.000Z"
        }
        """
    }

    private func listResponse(_ ids: [String]) -> Data {
        Data("{\"projects\": [\(ids.map { projectJSON(id: $0) }.joined(separator: ","))]}".utf8)
    }

    private func createResponse(id: String, name: String, coverageLabel: String?) -> Data {
        Data("{\"project\": \(projectJSON(id: id, name: name, coverageLabel: coverageLabel))}".utf8)
    }

    private func makeViewModel(
        transport: RoutingMockPlatformTransport,
        role: PlatformRole = .manager
    ) -> ProjectsViewModel {
        ProjectsViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            role: role,
            language: .en
        )
    }

    // MARK: - canManage

    func testCanManageTrueForManagerAndOwnerOnly() {
        let transport = RoutingMockPlatformTransport()
        XCTAssertTrue(makeViewModel(transport: transport, role: .manager).canManage)
        XCTAssertTrue(makeViewModel(transport: transport, role: .owner).canManage)
        XCTAssertFalse(makeViewModel(transport: transport, role: .reviewer).canManage)
        XCTAssertFalse(makeViewModel(transport: transport, role: .collector).canManage)
        XCTAssertFalse(makeViewModel(transport: transport, role: .viewer).canManage)
    }

    // MARK: - Load

    func testLoadPopulatesProjects() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse(["proj-1", "proj-2"]), forView: "platform_project_list")
        let viewModel = makeViewModel(transport: transport)

        await viewModel.load()

        XCTAssertEqual(viewModel.projects?.map(\.id), ["proj-1", "proj-2"])
        XCTAssertNil(viewModel.loadError)

        let request = transport.lastRequest
        let components = URLComponents(url: request!.url!, resolvingAgainstBaseURL: false)
        XCTAssertEqual(components?.queryItems?.first { $0.name == "organizationId" }?.value, "org-1")
        XCTAssertEqual(request?.httpMethod, "GET")
    }

    func testLoadFailureSurfacesServerMessageFor4xx() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"error\":\"Organization not found\"}".utf8), forView: "platform_project_list")
        let viewModel = ProjectsViewModel(
            apiClient: PlatformAPIClient(
                baseURL: URL(string: "https://example.com")!,
                transport: StatusOverrideTransport(inner: transport, view: "platform_project_list", statusCode: 404)
            ),
            organizationId: "org-1",
            role: .manager,
            language: .en
        )

        await viewModel.load()

        XCTAssertEqual(viewModel.loadError, "Organization not found")
        XCTAssertNil(viewModel.projects)
    }

    func testLoadFailureSurfacesGenericFallbackFor5xx() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"error\":\"boom\"}".utf8), forView: "platform_project_list")
        let viewModel = ProjectsViewModel(
            apiClient: PlatformAPIClient(
                baseURL: URL(string: "https://example.com")!,
                transport: StatusOverrideTransport(inner: transport, view: "platform_project_list", statusCode: 503)
            ),
            organizationId: "org-1",
            role: .manager,
            language: .en
        )

        await viewModel.load()

        XCTAssertEqual(viewModel.loadError, "Something went wrong. Please try again.")
    }

    // MARK: - Create validation (pure)

    func testIsCreateValidRequiresNonEmptyNameAndCoverageLabelUnlessWorldwide() {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport)

        XCTAssertFalse(viewModel.isCreateValid) // empty name

        viewModel.newName = "Douala Pilot"
        XCTAssertFalse(viewModel.isCreateValid) // town scope, no label

        viewModel.coverageLabel = "D"
        XCTAssertFalse(viewModel.isCreateValid) // label too short

        viewModel.coverageLabel = "Douala"
        XCTAssertTrue(viewModel.isCreateValid)

        viewModel.coverageScope = .worldwide
        viewModel.coverageLabel = ""
        XCTAssertTrue(viewModel.isCreateValid) // worldwide never needs a label
    }

    // MARK: - Create

    func testCreateCallsCreateProjectWithCorrectPayloadAndPrependsToList() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(listResponse(["proj-1"]), forView: "platform_project_list")
        transport.setResponse(createResponse(id: "proj-new", name: "Yaoundé Pilot", coverageLabel: "Yaoundé"), forView: "platform_project_create")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()

        viewModel.newName = "  Yaoundé Pilot  "
        viewModel.coverageScope = .town
        viewModel.coverageLabel = "  Yaoundé  "

        let succeeded = await viewModel.create()

        XCTAssertTrue(succeeded)
        XCTAssertEqual(viewModel.projects?.map(\.id), ["proj-new", "proj-1"])
        // Form resets on success.
        XCTAssertEqual(viewModel.newName, "")
        XCTAssertEqual(viewModel.coverageScope, .town)
        XCTAssertEqual(viewModel.coverageLabel, "")
        XCTAssertNil(viewModel.createError)

        let requests = transport.requests(forView: "platform_project_create")
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests[0].httpMethod, "POST")
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["organizationId"] as? String, "org-1")
        XCTAssertEqual(body?["name"] as? String, "Yaoundé Pilot")
        XCTAssertEqual(body?["coverageScope"] as? String, "town")
        XCTAssertEqual(body?["coverageLabel"] as? String, "Yaoundé")
    }

    func testCreateOmitsCoverageLabelWhenWorldwide() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(createResponse(id: "proj-new", name: "Global Pilot", coverageLabel: nil), forView: "platform_project_create")
        let viewModel = makeViewModel(transport: transport)
        viewModel.newName = "Global Pilot"
        viewModel.coverageScope = .worldwide

        let succeeded = await viewModel.create()

        XCTAssertTrue(succeeded)
        let requests = transport.requests(forView: "platform_project_create")
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["coverageScope"] as? String, "worldwide")
        XCTAssertNil(body?["coverageLabel"])
    }

    func testCreateWithInvalidFormDoesNotCallApi() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport)
        viewModel.newName = "" // invalid

        let succeeded = await viewModel.create()

        XCTAssertFalse(succeeded)
        XCTAssertTrue(transport.requests(forView: "platform_project_create").isEmpty)
    }

    func testCreateFailureSurfacesErrorAndKeepsFormFields() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"error\":\"Name already used\"}".utf8), forView: "platform_project_create")
        let failingTransport = StatusOverrideTransport(inner: transport, view: "platform_project_create", statusCode: 409)
        let viewModel = ProjectsViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: failingTransport),
            organizationId: "org-1",
            role: .manager,
            language: .en
        )
        viewModel.newName = "Douala Pilot"
        viewModel.coverageLabel = "Douala"

        let succeeded = await viewModel.create()

        XCTAssertFalse(succeeded)
        XCTAssertEqual(viewModel.createError, "Name already used")
        // Form is NOT reset on failure.
        XCTAssertEqual(viewModel.newName, "Douala Pilot")
    }

    func testCancelCreateResetsFields() {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport)
        viewModel.newName = "Draft"
        viewModel.coverageScope = .country
        viewModel.coverageLabel = "Cameroon"

        viewModel.cancelCreate()

        XCTAssertEqual(viewModel.newName, "")
        XCTAssertEqual(viewModel.coverageScope, .town)
        XCTAssertEqual(viewModel.coverageLabel, "")
    }
}

/// Forces every response for a specific `view` query param to a fixed
/// non-2xx status code — mirrors `ReviewQueueViewModelTests`'s
/// `StatusOverrideTransport`, reimplemented here as file-private so both
/// test files can each own their copy without a shared test-support target.
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
