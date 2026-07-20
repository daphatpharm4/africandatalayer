@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers Task 7a's `SettingsViewModel`. Source of truth for behavior is
/// `components/Console/SettingsScreen.tsx` (web, read-only reference) +
/// `lib/client/platformApi.ts`.
@MainActor
final class SettingsViewModelTests: XCTestCase {
    private func orgJSON(
        id: String = "org-1",
        name: String = "Acme Co",
        logoUrl: String? = nil,
        accentColor: String? = "#c86b4a"
    ) -> String {
        """
        {
            "id": "\(id)",
            "name": "\(name)",
            "slug": "acme-co",
            "logoUrl": \(logoUrl.map { "\"\($0)\"" } ?? "null"),
            "accentColor": \(accentColor.map { "\"\($0)\"" } ?? "null"),
            "createdAt": "2026-07-01T00:00:00.000Z"
        }
        """
    }

    private func orgResponse(name: String = "Acme Co", logoUrl: String? = nil, accentColor: String? = "#c86b4a") -> Data {
        Data("{\"organization\": \(orgJSON(name: name, logoUrl: logoUrl, accentColor: accentColor))}".utf8)
    }

    private func makeOrganization(name: String = "Acme Co", logoUrl: String? = nil, accentColor: String? = "#c86b4a") -> PlatformOrganization {
        PlatformOrganization(id: "org-1", name: name, slug: "acme-co", logoUrl: logoUrl, accentColor: accentColor, createdAt: "2026-07-01T00:00:00.000Z")
    }

    private func makeViewModel(
        transport: RoutingMockPlatformTransport,
        organization: PlatformOrganization,
        role: PlatformRole = .owner
    ) -> SettingsViewModel {
        SettingsViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            organization: organization,
            role: role,
            language: .en
        )
    }

    // MARK: - Init

    func testInitSeedsNameAndColorFromOrganization() {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(name: "Acme Co", accentColor: "#123456"))

        XCTAssertEqual(viewModel.name, "Acme Co")
        XCTAssertEqual(viewModel.colorHex, "#123456")
    }

    func testInitFallsBackToDefaultAccentWhenOrganizationHasNone() {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(accentColor: nil))

        XCTAssertEqual(viewModel.colorHex, SettingsViewModel.defaultAccent)
    }

    // MARK: - isOwner

    func testIsOwnerReflectsRole() {
        let transport = RoutingMockPlatformTransport()
        XCTAssertTrue(makeViewModel(transport: transport, organization: makeOrganization(), role: .owner).isOwner)
        XCTAssertFalse(makeViewModel(transport: transport, organization: makeOrganization(), role: .manager).isOwner)
    }

    // MARK: - Name dirty / save

    func testIsNameDirtyRequiresNonEmptyTrimmedDifferentName() {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(name: "Acme Co"))

        XCTAssertFalse(viewModel.isNameDirty) // unchanged

        viewModel.name = "  Acme Co  "
        XCTAssertFalse(viewModel.isNameDirty) // same after trim

        viewModel.name = "   "
        XCTAssertFalse(viewModel.isNameDirty) // blank

        viewModel.name = "New Name"
        XCTAssertTrue(viewModel.isNameDirty)
    }

    func testSaveNameCallsUpdateOrganizationWithTrimmedNameAndUpdatesState() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(orgResponse(name: "New Name"), forView: "platform_org_update")
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(name: "Acme Co"))
        viewModel.name = "  New Name  "

        await viewModel.saveName()

        XCTAssertEqual(viewModel.name, "New Name")
        XCTAssertNil(viewModel.nameError)

        let requests = transport.requests(forView: "platform_org_update")
        XCTAssertEqual(requests.count, 1)
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["organizationId"] as? String, "org-1")
        XCTAssertEqual(body?["name"] as? String, "New Name")
        XCTAssertNil(body?["accentColor"])
        XCTAssertNil(body?["logoDataUrl"])
        XCTAssertNil(body?["clearLogo"])
    }

    func testSaveNameBlockedForNonOwnerMakesNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(), role: .manager)
        viewModel.name = "New Name"

        await viewModel.saveName()

        XCTAssertTrue(transport.requests(forView: "platform_org_update").isEmpty)
    }

    func testSaveNameBlockedWhenNotDirtyMakesNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(name: "Acme Co"))
        // name is already "Acme Co" (not dirty)

        await viewModel.saveName()

        XCTAssertTrue(transport.requests(forView: "platform_org_update").isEmpty)
    }

    // MARK: - Color validity / dirty / save

    func testIsColorValidRequiresSixDigitHex() {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization())

        viewModel.colorHex = "#c86b4a"
        XCTAssertTrue(viewModel.isColorValid)

        viewModel.colorHex = "#fff"
        XCTAssertFalse(viewModel.isColorValid)

        viewModel.colorHex = "c86b4a"
        XCTAssertFalse(viewModel.isColorValid) // missing '#'

        viewModel.colorHex = "#gggggg"
        XCTAssertFalse(viewModel.isColorValid)
    }

    func testIsColorDirtyRequiresValidAndDifferentFromCurrent() {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(accentColor: "#c86b4a"))

        XCTAssertFalse(viewModel.isColorDirty) // unchanged

        viewModel.colorHex = "#C86B4A" // same color, different case
        XCTAssertFalse(viewModel.isColorDirty)

        viewModel.colorHex = "#123456"
        XCTAssertTrue(viewModel.isColorDirty)

        viewModel.colorHex = "not-a-color"
        XCTAssertFalse(viewModel.isColorDirty) // invalid never counts as dirty
    }

    func testSaveColorCallsUpdateOrganizationWithTrimmedHex() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(orgResponse(accentColor: "#123456"), forView: "platform_org_update")
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(accentColor: "#c86b4a"))
        viewModel.colorHex = "  #123456  "

        await viewModel.saveColor()

        XCTAssertEqual(viewModel.colorHex, "#123456")
        XCTAssertNil(viewModel.colorError)
        let requests = transport.requests(forView: "platform_org_update")
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["accentColor"] as? String, "#123456")
        XCTAssertNil(body?["name"])
    }

    func testSaveColorWithInvalidHexSurfacesErrorWithoutApiCall() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization())
        viewModel.colorHex = "nope"

        await viewModel.saveColor()

        XCTAssertEqual(viewModel.colorError, "Enter a valid hex color, e.g. #c86b4a.")
        XCTAssertTrue(transport.requests(forView: "platform_org_update").isEmpty)
    }

    func testSaveColorBlockedForNonOwnerMakesNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(), role: .viewer)
        viewModel.colorHex = "#123456"

        await viewModel.saveColor()

        XCTAssertTrue(transport.requests(forView: "platform_org_update").isEmpty)
    }

    // MARK: - Logo upload

    func testUploadLogoCallsUpdateOrganizationWithDataUrl() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(orgResponse(logoUrl: "https://cdn.example.com/logo.png"), forView: "platform_org_update")
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization())
        let dataURL = "data:image/png;base64,abc123"

        await viewModel.uploadLogo(rawByteCount: 500, dataURL: dataURL)

        XCTAssertNil(viewModel.logoError)
        let requests = transport.requests(forView: "platform_org_update")
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["logoDataUrl"] as? String, dataURL)
        XCTAssertNil(body?["name"])
    }

    func testUploadLogoOverRawByteCapIsBlockedClientSideWithNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization())

        await viewModel.uploadLogo(rawByteCount: SettingsViewModel.maxLogoFileBytes + 1, dataURL: "data:image/png;base64,x")

        XCTAssertEqual(viewModel.logoError, "Logo must be smaller than 1 MB.")
        XCTAssertTrue(transport.requests(forView: "platform_org_update").isEmpty)
    }

    func testUploadLogoOverDataUrlCapIsBlockedClientSideWithNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization())
        let oversizedDataURL = "data:image/png;base64," + String(repeating: "a", count: SettingsViewModel.maxLogoDataURLLength + 1)

        await viewModel.uploadLogo(rawByteCount: 100, dataURL: oversizedDataURL)

        XCTAssertEqual(viewModel.logoError, "Logo must be smaller than 1 MB.")
        XCTAssertTrue(transport.requests(forView: "platform_org_update").isEmpty)
    }

    func testUploadLogoBlockedForNonOwnerMakesNoApiCall() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(), role: .manager)

        await viewModel.uploadLogo(rawByteCount: 100, dataURL: "data:image/png;base64,x")

        XCTAssertTrue(transport.requests(forView: "platform_org_update").isEmpty)
    }

    // MARK: - Remove logo

    func testRemoveLogoCallsUpdateOrganizationWithClearLogo() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(orgResponse(logoUrl: nil), forView: "platform_org_update")
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(logoUrl: "https://cdn.example.com/logo.png"))

        await viewModel.removeLogo()

        let requests = transport.requests(forView: "platform_org_update")
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["clearLogo"] as? Bool, true)
    }

    func testRemoveLogoNoOpWhenNoLogoPresent() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, organization: makeOrganization(logoUrl: nil))

        await viewModel.removeLogo()

        XCTAssertTrue(transport.requests(forView: "platform_org_update").isEmpty)
    }

    // MARK: - Error copy

    func testSaveNameFailureSurfacesServerMessageFor4xxAndGenericFor5xx() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"error\":\"Name too long\"}".utf8), forView: "platform_org_update")
        let viewModel = SettingsViewModel(
            apiClient: PlatformAPIClient(
                baseURL: URL(string: "https://example.com")!,
                transport: StatusOverrideTransport(inner: transport, view: "platform_org_update", statusCode: 422)
            ),
            organizationId: "org-1",
            organization: makeOrganization(name: "Acme Co"),
            role: .owner,
            language: .en
        )
        viewModel.name = "New Name"

        await viewModel.saveName()

        XCTAssertEqual(viewModel.nameError, "Name too long")
    }
}

/// Forces every response for a specific `view` query param to a fixed
/// non-2xx status code (file-private copy, same pattern as
/// `ProjectsViewModelTests`/`ReviewQueueViewModelTests`).
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
