@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

/// Covers `CommunicationsViewModel` — the admin communications panel's
/// email/SMS campaign lists and template → audience → schedule → review
/// composer flow. All endpoints live on `api/privacy` (not the
/// `api/user?view=platform_*` convention `PlatformAPIClient`'s other
/// methods use), but `RoutingMockPlatformTransport` routes purely on the
/// `view` query parameter, so it works unmodified here — see
/// `PlatformAPIClient.sendAnalyticsRequest` for how these calls are wired.
@MainActor
final class CommunicationsViewModelTests: XCTestCase {
    private func makeViewModel(transport: PlatformTransport, language: ConsoleLanguage = .en) -> CommunicationsViewModel {
        CommunicationsViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            language: language
        )
    }

    private func lastRequestBody(_ transport: RoutingMockPlatformTransport, forView view: String) -> [String: Any]? {
        guard let request = transport.requests(forView: view).last else { return nil }
        return try? JSONSerialization.jsonObject(with: request.httpBody ?? Data()) as? [String: Any]
    }

    // MARK: - Load: email campaigns

    func testLoadEmailCampaignsPopulatesListAndMaxRecipients() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("""
            {"campaigns": [
                {"id":"c1","subject":"Welcome back","status":"sending","recipientCount":10,"sentCount":5,"failedCount":0,"suppressedCount":1,"createdAt":"2026-07-01T00:00:00.000Z","startedAt":"2026-07-01T00:00:00.000Z","completedAt":null}
            ], "maxRecipients": 5000}
            """.utf8),
            forView: "campaigns"
        )
        let viewModel = makeViewModel(transport: transport)

        await viewModel.loadEmailCampaigns()

        XCTAssertEqual(viewModel.emailCampaigns?.map(\.id), ["c1"])
        XCTAssertEqual(viewModel.emailCampaigns?.first?.recipientCount, 10)
        XCTAssertEqual(viewModel.maxEmailRecipients, 5000)
        XCTAssertNil(viewModel.loadError)
    }

    func testLoadEmailCampaignsSurfacesError() async {
        let transport = RoutingMockPlatformTransport()
        let failing = ErrorViewTransport(inner: transport, view: "campaigns", status: 500, body: "{\"error\": \"boom\"}")
        let viewModel = makeViewModel(transport: failing)

        await viewModel.loadEmailCampaigns()

        XCTAssertNil(viewModel.emailCampaigns)
        XCTAssertEqual(
            viewModel.loadError,
            "Something went wrong. Please try again."
        )
    }

    // MARK: - Load: SMS campaigns

    func testLoadSmsCampaignsPopulatesListAndMaxRecipients() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("""
            {"campaigns": [
                {"id":"s1","message":"Reminder","status":"completed","recipientCount":20,"sentCount":20,"failedCount":0,"suppressedCount":0,"createdAt":"2026-07-01T00:00:00.000Z","startedAt":"2026-07-01T00:00:00.000Z","completedAt":"2026-07-01T00:05:00.000Z"}
            ], "maxRecipients": 1000}
            """.utf8),
            forView: "sms-campaigns"
        )
        let viewModel = makeViewModel(transport: transport)

        await viewModel.loadSmsCampaigns()

        XCTAssertEqual(viewModel.smsCampaigns?.map(\.id), ["s1"])
        XCTAssertEqual(viewModel.maxSmsRecipients, 1000)
        XCTAssertNil(viewModel.loadError)
    }

    // MARK: - Create: email campaign payload correctness

    func testSendEmailCampaignSendsCorrectPayloadAndPrependsToList() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("{\"id\":\"c2\",\"status\":\"sending\",\"recipientCount\":3,\"suppressedCount\":0,\"capped\":false}".utf8),
            forView: "campaigns"
        )
        let viewModel = makeViewModel(transport: transport)
        viewModel.channel = .email
        viewModel.subject = "  Big news  "
        viewModel.messageBody = "  Hello everyone  "
        viewModel.audienceRoles = ["agent"]
        viewModel.audienceTrustTiers = ["trusted", "elite"]
        viewModel.lastActiveDaysText = "30"

        let sent = await viewModel.sendCampaign()

        XCTAssertTrue(sent)
        XCTAssertEqual(viewModel.sendState, .success)
        XCTAssertEqual(viewModel.emailCampaigns?.first?.id, "c2")
        XCTAssertEqual(viewModel.emailCampaigns?.first?.subject, "Big news")

        guard let body = lastRequestBody(transport, forView: "campaigns") else {
            return XCTFail("expected a POST to view=campaigns")
        }
        XCTAssertEqual(body["subject"] as? String, "Big news")
        XCTAssertEqual(body["htmlBody"] as? String, "Hello everyone")
        XCTAssertEqual(body["textBody"] as? String, "Hello everyone")
        XCTAssertEqual(body["language"] as? String, "en")
        XCTAssertEqual(body["recipientMode"] as? String, "audience")
        XCTAssertNil(body["scheduledAt"])
        XCTAssertNil(body["createdBy"]) // server-derived, never sent by the client

        let audience = body["audience"] as? [String: Any]
        XCTAssertEqual(audience?["roles"] as? [String], ["agent"])
        XCTAssertEqual((audience?["trustTiers"] as? [String])?.sorted(), ["elite", "trusted"])
        XCTAssertEqual(audience?["lastActiveDays"] as? Int, 30)
    }

    func testSendEmailCampaignWithEmptySubjectDoesNotCallApi() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport)
        viewModel.channel = .email
        viewModel.subject = "   "
        viewModel.messageBody = "Body text"

        let sent = await viewModel.sendCampaign()

        XCTAssertFalse(sent)
        XCTAssertTrue(transport.requests(forView: "campaigns").isEmpty)
    }

    // MARK: - Create: SMS campaign payload correctness

    func testSendSmsCampaignSendsCorrectPayloadWithAcknowledgeCostAndPrependsToList() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("{\"id\":\"s2\",\"status\":\"sending\",\"recipientCount\":7,\"capped\":false,\"segmentsPerRecipient\":1,\"estimatedCostUnits\":7}".utf8),
            forView: "sms-campaigns"
        )
        let viewModel = makeViewModel(transport: transport)
        viewModel.channel = .sms
        viewModel.messageBody = "  Field visit tomorrow  "

        let sent = await viewModel.sendCampaign()

        XCTAssertTrue(sent)
        XCTAssertEqual(viewModel.smsCampaigns?.first?.id, "s2")
        XCTAssertEqual(viewModel.smsCampaigns?.first?.message, "Field visit tomorrow")

        guard let body = lastRequestBody(transport, forView: "sms-campaigns") else {
            return XCTFail("expected a POST to view=sms-campaigns")
        }
        XCTAssertEqual(body["message"] as? String, "Field visit tomorrow")
        XCTAssertEqual(body["acknowledgeCost"] as? Bool, true)
        XCTAssertNil(body["scheduledAt"])
    }

    func testSendCampaignWithScheduleForLaterSendsIsoScheduledAt() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("{\"id\":\"c3\",\"status\":\"scheduled\",\"recipientCount\":3,\"suppressedCount\":0,\"capped\":false}".utf8),
            forView: "campaigns"
        )
        let viewModel = makeViewModel(transport: transport)
        viewModel.channel = .email
        viewModel.subject = "Later"
        viewModel.messageBody = "Later body"
        viewModel.scheduleForLater = true
        let future = Date().addingTimeInterval(3600)
        viewModel.scheduledDate = future

        _ = await viewModel.sendCampaign()

        guard let body = lastRequestBody(transport, forView: "campaigns") else {
            return XCTFail("expected a POST to view=campaigns")
        }
        XCTAssertEqual(body["scheduledAt"] as? String, ISO8601DateFormatter().string(from: future))
    }

    // MARK: - Audience preview wiring

    func testPreviewAudienceSendsFilterAsQueryParamAndStoresResult() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("{\"recipientCount\":42,\"totalCount\":50,\"suppressedCount\":8,\"maxRecipients\":5000}".utf8),
            forView: "audience-preview"
        )
        let viewModel = makeViewModel(transport: transport)
        viewModel.audienceRoles = ["client"]

        await viewModel.previewAudience()

        XCTAssertEqual(viewModel.audiencePreview?.recipientCount, 42)
        XCTAssertEqual(viewModel.audiencePreview?.suppressedCount, 8)
        XCTAssertNil(viewModel.previewError)

        guard let request = transport.requests(forView: "audience-preview").last,
              let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false) else {
            return XCTFail("expected a GET to view=audience-preview")
        }
        XCTAssertEqual(request.httpMethod, "GET")
        let audienceParam = components.queryItems?.first { $0.name == "audience" }?.value
        XCTAssertNotNil(audienceParam)
        let decodedAudience = try? JSONSerialization.jsonObject(with: Data(audienceParam!.utf8)) as? [String: Any]
        XCTAssertEqual(decodedAudience?["roles"] as? [String], ["client"])
    }

    func testPreviewAudienceSurfacesError() async {
        let transport = RoutingMockPlatformTransport()
        let failing = ErrorViewTransport(inner: transport, view: "audience-preview", status: 400, body: "{\"error\": \"Invalid audience filter\"}")
        let viewModel = makeViewModel(transport: failing)

        await viewModel.previewAudience()

        XCTAssertNil(viewModel.audiencePreview)
        XCTAssertEqual(viewModel.previewError, "Invalid audience filter")
    }

    // MARK: - Cancel

    func testCancelEmailCampaignMarksStatusCancelled() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("""
            {"campaigns": [
                {"id":"c1","subject":"Welcome","status":"sending","recipientCount":10,"sentCount":5,"failedCount":0,"suppressedCount":0,"createdAt":"2026-07-01T00:00:00.000Z","startedAt":null,"completedAt":null}
            ], "maxRecipients": 5000}
            """.utf8),
            forView: "campaigns"
        )
        transport.setResponse(Data("{\"ok\": true}".utf8), forView: "campaigns:cancel")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.loadEmailCampaigns()

        await viewModel.cancelEmailCampaign(viewModel.emailCampaigns![0])

        XCTAssertEqual(viewModel.emailCampaigns?.first?.status, "cancelled")
        let requests = transport.requests(forView: "campaigns:cancel")
        XCTAssertEqual(requests.count, 1)
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["id"] as? String, "c1")
    }

    func testCancelSmsCampaignMarksStatusCancelled() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("""
            {"campaigns": [
                {"id":"s1","message":"Reminder","status":"scheduled","recipientCount":10,"sentCount":0,"failedCount":0,"suppressedCount":0,"createdAt":"2026-07-01T00:00:00.000Z","startedAt":null,"completedAt":null}
            ], "maxRecipients": 1000}
            """.utf8),
            forView: "sms-campaigns"
        )
        transport.setResponse(Data("{\"ok\": true}".utf8), forView: "sms-campaigns:cancel")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.loadSmsCampaigns()

        await viewModel.cancelSmsCampaign(viewModel.smsCampaigns![0])

        XCTAssertEqual(viewModel.smsCampaigns?.first?.status, "cancelled")
        let requests = transport.requests(forView: "sms-campaigns:cancel")
        XCTAssertEqual(requests.count, 1)
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["id"] as? String, "s1")
    }

    func testCancelEmailCampaignNotFoundLeavesListUnchanged() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("""
            {"campaigns": [
                {"id":"c1","subject":"Welcome","status":"completed","recipientCount":10,"sentCount":10,"failedCount":0,"suppressedCount":0,"createdAt":"2026-07-01T00:00:00.000Z","startedAt":null,"completedAt":null}
            ], "maxRecipients": 5000}
            """.utf8),
            forView: "campaigns"
        )
        transport.setResponse(Data("{\"ok\": false}".utf8), forView: "campaigns:cancel")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.loadEmailCampaigns()

        await viewModel.cancelEmailCampaign(viewModel.emailCampaigns![0])

        XCTAssertEqual(viewModel.emailCampaigns?.first?.status, "completed")
    }

    // MARK: - Templates

    func testLoadTemplatesPopulatesList() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(
            Data("""
            {"templates": [
                {"id":"t1","slug":"welcome","name":"Welcome","subjectEn":"Welcome!","subjectFr":"Bienvenue !","htmlEn":"<p>Hi</p>","htmlFr":"<p>Salut</p>","textEn":"Hi {{name}}","textFr":"Salut {{name}}","variables":["name"],"archived":false,"createdAt":"2026-07-01T00:00:00.000Z","updatedAt":"2026-07-01T00:00:00.000Z"}
            ]}
            """.utf8),
            forView: "email-templates"
        )
        let viewModel = makeViewModel(transport: transport)

        await viewModel.loadTemplates()

        XCTAssertEqual(viewModel.templates?.count, 1)
        XCTAssertEqual(viewModel.templates?.first?.name, "Welcome")
        XCTAssertNil(viewModel.templatesError)
    }

    func testSelectTemplatePrefillsSubjectAndBodyForCurrentLanguage() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport, language: .fr)
        let template = EmailTemplate(
            id: "t1",
            slug: "welcome",
            name: "Welcome",
            subjectEn: "Welcome!",
            subjectFr: "Bienvenue !",
            htmlEn: "<p>Hi</p>",
            htmlFr: "<p>Salut</p>",
            textEn: "Hi there",
            textFr: "Salut à vous",
            variables: [],
            archived: false,
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z"
        )

        viewModel.selectTemplate(template)

        XCTAssertEqual(viewModel.subject, "Bienvenue !")
        XCTAssertEqual(viewModel.messageBody, "Salut à vous")
        XCTAssertEqual(viewModel.messageHTMLBody, "<p>Salut</p>")
        XCTAssertEqual(viewModel.selectedTemplate?.id, "t1")
    }
}

/// Forces every response for a specific `view` to a given non-2xx status,
/// simulating a server error for one endpoint while letting others pass
/// through to the inner `RoutingMockPlatformTransport` unmodified. Mirrors
/// `MembersViewModelTests`'s `LastOwner409Transport`, generalized to an
/// arbitrary status/body.
private final class ErrorViewTransport: PlatformTransport, @unchecked Sendable {
    private let inner: RoutingMockPlatformTransport
    private let view: String
    private let status: Int
    private let body: String

    init(inner: RoutingMockPlatformTransport, view: String, status: Int, body: String) {
        self.inner = inner
        self.view = view
        self.status = status
        self.body = body
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await inner.send(request)
        guard response.url?.query?.contains("view=\(view)") == true else {
            return (data, response)
        }
        let failingResponse = HTTPURLResponse(
            url: response.url!,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: ["content-type": "application/json"]
        )!
        return (Data(body.utf8), failingResponse)
    }
}
