@testable import ADLConsole
import ConsoleAPI
import ConsoleForms
import ConsoleModels
import XCTest

/// Covers Task 7b's app-level integration: `SchemaBuilderViewModel` against
/// a mock `PlatformAPIClient` transport, exercising load -> edit -> save ->
/// publish end-to-end (the pure mutation/validation logic itself is covered
/// exhaustively at the `ConsoleForms` package level by
/// `SchemaEditorModelTests`/`SchemaValidationTests`). Source of truth for
/// behavior: `components/Console/SchemaBuilder.tsx` (web, read-only
/// reference) — see the doc comment on `SchemaBuilderViewModel` for the one
/// documented asymmetry ported from it (`canSave`/`canPublish` vs. the
/// handlers' own internal guards).
@MainActor
final class SchemaBuilderViewModelTests: XCTestCase {
    private func recordTypeJSON(key: String = "pharmacy") -> String {
        """
        {
            "key": "\(key)",
            "label": {"en": "Pharmacy", "fr": "Pharmacie"},
            "fields": [
                {"key": "name", "label": {"en": "Name", "fr": "Nom"}, "type": "text", "required": true}
            ],
            "evidence": {"gpsRequired": true, "minPhotos": 1, "notesRequired": false}
        }
        """
    }

    private func definitionJSON(key: String = "pharmacy") -> String {
        "{\"recordTypes\": [\(recordTypeJSON(key: key))]}"
    }

    private func schemaVersionJSON(
        id: String,
        version: Int,
        status: String,
        definitionJSON: String,
        publishedAt: String? = nil
    ) -> String {
        let publishedAtJSON = publishedAt.map { "\"\($0)\"" } ?? "null"
        return """
        {
            "id": "\(id)",
            "projectId": "proj-1",
            "organizationId": "org-1",
            "version": \(version),
            "status": "\(status)",
            "definition": \(definitionJSON),
            "publishedAt": \(publishedAtJSON)
        }
        """
    }

    private func getSchemaResponse(draft: String?, published: String?, versions: [String]) -> Data {
        Data("""
        {
            "draft": \(draft ?? "null"),
            "published": \(published ?? "null"),
            "versions": [\(versions.joined(separator: ","))]
        }
        """.utf8)
    }

    private func schemaVersionEnvelope(_ versionJSON: String) -> Data {
        Data("{\"schemaVersion\": \(versionJSON)}".utf8)
    }

    private func makeViewModel(transport: RoutingMockPlatformTransport, projectId: String = "proj-1") -> SchemaBuilderViewModel {
        SchemaBuilderViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            projectId: projectId,
            language: .en
        )
    }

    // MARK: - Load

    func testLoadPopulatesEditorFromDraftWhenPresent() async {
        let transport = RoutingMockPlatformTransport()
        let draftVersion = schemaVersionJSON(id: "v2", version: 2, status: "draft", definitionJSON: definitionJSON(key: "pharmacy"))
        let publishedVersion = schemaVersionJSON(id: "v1", version: 1, status: "published", definitionJSON: definitionJSON(key: "old_type"), publishedAt: "2026-01-01T00:00:00.000Z")
        transport.setResponse(
            getSchemaResponse(draft: draftVersion, published: publishedVersion, versions: [draftVersion, publishedVersion]),
            forView: "platform_schema_get"
        )
        let viewModel = makeViewModel(transport: transport)

        await viewModel.load()

        XCTAssertNotNil(viewModel.editor)
        XCTAssertEqual(viewModel.editor?.definition.recordTypes.map(\.key), ["pharmacy"])
        XCTAssertEqual(viewModel.draft?.version, 2)
        XCTAssertEqual(viewModel.published?.version, 1)
        XCTAssertEqual(viewModel.versions.count, 2)
        XCTAssertFalse(viewModel.isDirty, "freshly loaded draft should not read as dirty")

        let request = transport.lastRequest
        let components = URLComponents(url: request!.url!, resolvingAgainstBaseURL: false)
        XCTAssertEqual(components?.queryItems?.first { $0.name == "projectId" }?.value, "proj-1")
        XCTAssertEqual(request?.httpMethod, "GET")
    }

    func testLoadWithNoDraftOrPublishedSeedsEmptyDefinition() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(getSchemaResponse(draft: nil, published: nil, versions: []), forView: "platform_schema_get")
        let viewModel = makeViewModel(transport: transport)

        await viewModel.load()

        XCTAssertNotNil(viewModel.editor)
        XCTAssertEqual(viewModel.editor?.definition.recordTypes.count, 1)
        XCTAssertEqual(viewModel.editor?.definition.recordTypes.first?.key, "record_type_1")
        // No baseline persisted yet -> treated as dirty, matching the web's
        // `lastSavedDefinition === null` sentinel.
        XCTAssertTrue(viewModel.isDirty)
    }

    func testLoadFailureSurfacesMessage() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"error\":\"boom\"}".utf8), forView: "platform_schema_get")
        let viewModel = SchemaBuilderViewModel(
            apiClient: PlatformAPIClient(
                baseURL: URL(string: "https://example.com")!,
                transport: StatusOverrideTransport(inner: transport, view: "platform_schema_get", statusCode: 503)
            ),
            projectId: "proj-1",
            language: .en
        )

        await viewModel.load()

        XCTAssertNil(viewModel.editor)
        XCTAssertEqual(viewModel.loadError, "Something went wrong. Please try again.")
    }

    // MARK: - Edit

    func testMutateForwardsToEditorAndMarksDirty() async {
        let transport = RoutingMockPlatformTransport()
        let publishedVersion = schemaVersionJSON(id: "v1", version: 1, status: "published", definitionJSON: definitionJSON())
        transport.setResponse(getSchemaResponse(draft: nil, published: publishedVersion, versions: [publishedVersion]), forView: "platform_schema_get")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()
        XCTAssertFalse(viewModel.isDirty)

        viewModel.mutate { $0.setRecordTypeKey(at: 0, value: "renamed_type") }

        XCTAssertEqual(viewModel.editor?.definition.recordTypes.first?.key, "renamed_type")
        XCTAssertTrue(viewModel.isDirty)
    }

    func testAddRecordTypeSelectsNewIndex() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(getSchemaResponse(draft: nil, published: nil, versions: []), forView: "platform_schema_get")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()

        viewModel.addRecordType()

        XCTAssertEqual(viewModel.recordTypes.count, 2)
        XCTAssertEqual(viewModel.selectedTypeIndex, 1)
    }

    func testRemoveSelectedRecordTypeClampsSelection() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(getSchemaResponse(draft: nil, published: nil, versions: []), forView: "platform_schema_get")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()
        viewModel.addRecordType()
        viewModel.selectedTypeIndex = 1

        viewModel.removeRecordType(at: 1)

        XCTAssertEqual(viewModel.recordTypes.count, 1)
        XCTAssertEqual(viewModel.selectedTypeIndex, 0)
    }

    // MARK: - Save draft

    func testSaveDraftCallsSaveSchemaDraftWithEditedDefinitionAndUpdatesState() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(getSchemaResponse(draft: nil, published: nil, versions: []), forView: "platform_schema_get")
        let savedVersion = schemaVersionJSON(id: "v3", version: 3, status: "draft", definitionJSON: definitionJSON(key: "renamed_type"))
        transport.setResponse(schemaVersionEnvelope(savedVersion), forView: "platform_schema_draft_save")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()
        viewModel.mutate { $0.setRecordTypeKey(at: 0, value: "renamed_type") }
        // Give every field/record-type/label a valid, unique value so the
        // edited definition actually passes SchemaValidator before saving.
        viewModel.mutate { $0.setRecordTypeLabel(at: 0, lang: .en, value: "Renamed") }
        viewModel.mutate { $0.setRecordTypeLabel(at: 0, lang: .fr, value: "Renommé") }
        viewModel.mutate { $0.setFieldLabel(typeIndex: 0, fieldIndex: 0, lang: .en, value: "Field") }
        viewModel.mutate { $0.setFieldLabel(typeIndex: 0, fieldIndex: 0, lang: .fr, value: "Champ") }
        XCTAssertTrue(viewModel.isValid, "expected valid definition, issues: \(viewModel.issues)")
        XCTAssertTrue(viewModel.canSave)

        let succeeded = await viewModel.saveDraft()

        XCTAssertTrue(succeeded)
        XCTAssertEqual(viewModel.draft?.version, 3)
        XCTAssertFalse(viewModel.isDirty, "saving should reset the dirty baseline to the just-saved definition")

        let requests = transport.requests(forView: "platform_schema_draft_save")
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests[0].httpMethod, "POST")
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["projectId"] as? String, "proj-1")
        let definition = body?["definition"] as? [String: Any]
        let recordTypes = definition?["recordTypes"] as? [[String: Any]]
        XCTAssertEqual(recordTypes?.first?["key"] as? String, "renamed_type")
    }

    func testSaveDraftBlockedWhenInvalidNoNetworkCall() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(getSchemaResponse(draft: nil, published: nil, versions: []), forView: "platform_schema_get")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()
        // Leave the auto-generated definition's empty labels in place ->
        // invalid (bilingual label required).
        XCTAssertFalse(viewModel.isValid)

        let succeeded = await viewModel.saveDraft()

        XCTAssertFalse(succeeded)
        XCTAssertTrue(transport.requests(forView: "platform_schema_draft_save").isEmpty)
    }

    func testSaveDraft422SurfacesFixIssuesCopy() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(getSchemaResponse(draft: nil, published: nil, versions: []), forView: "platform_schema_get")
        transport.setResponse(Data("{\"error\":\"invalid\"}".utf8), forView: "platform_schema_draft_save")
        let viewModel = SchemaBuilderViewModel(
            apiClient: PlatformAPIClient(
                baseURL: URL(string: "https://example.com")!,
                transport: StatusOverrideTransport(inner: transport, view: "platform_schema_draft_save", statusCode: 422)
            ),
            projectId: "proj-1",
            language: .en
        )
        await viewModel.load()
        viewModel.mutate { $0.setRecordTypeLabel(at: 0, lang: .en, value: "A") }
        viewModel.mutate { $0.setRecordTypeLabel(at: 0, lang: .fr, value: "A") }
        viewModel.mutate { $0.setFieldLabel(typeIndex: 0, fieldIndex: 0, lang: .en, value: "Field") }
        viewModel.mutate { $0.setFieldLabel(typeIndex: 0, fieldIndex: 0, lang: .fr, value: "Champ") }
        XCTAssertTrue(viewModel.isValid, "expected valid, issues: \(viewModel.issues)")

        let succeeded = await viewModel.saveDraft()

        XCTAssertFalse(succeeded)
        XCTAssertEqual(viewModel.saveError, "Fix the issues listed below before saving.")
    }

    // MARK: - Publish

    func testPublishCallsPublishSchemaAndUpdatesState() async {
        let transport = RoutingMockPlatformTransport()
        let draftVersion = schemaVersionJSON(id: "v2", version: 2, status: "draft", definitionJSON: definitionJSON())
        transport.setResponse(getSchemaResponse(draft: draftVersion, published: nil, versions: [draftVersion]), forView: "platform_schema_get")
        let publishedVersion = schemaVersionJSON(id: "v2", version: 2, status: "published", definitionJSON: definitionJSON(), publishedAt: "2026-07-19T12:00:00.000Z")
        transport.setResponse(schemaVersionEnvelope(publishedVersion), forView: "platform_schema_publish")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()
        XCTAssertTrue(viewModel.canPublish, "loaded draft, unedited, valid -> publish should be allowed")

        let succeeded = await viewModel.publish()

        XCTAssertTrue(succeeded)
        XCTAssertEqual(viewModel.published?.version, 2)
        XCTAssertNil(viewModel.draft, "publish clears the draft, matching the web's setDraft(null)")

        let requests = transport.requests(forView: "platform_schema_publish")
        XCTAssertEqual(requests.count, 1)
        let body = try? JSONSerialization.jsonObject(with: requests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["projectId"] as? String, "proj-1")
    }

    /// Port of the web's `canPublish = ... && !isDirty && ...` — publishing
    /// is blocked while there are unsaved edits, with no network call.
    func testPublishBlockedWhileDirtyNoNetworkCall() async {
        let transport = RoutingMockPlatformTransport()
        let draftVersion = schemaVersionJSON(id: "v2", version: 2, status: "draft", definitionJSON: definitionJSON())
        transport.setResponse(getSchemaResponse(draft: draftVersion, published: nil, versions: [draftVersion]), forView: "platform_schema_get")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()
        viewModel.mutate { $0.setRecordTypeLabel(at: 0, lang: .en, value: "Edited") }
        XCTAssertTrue(viewModel.isDirty)
        XCTAssertFalse(viewModel.canPublish)

        let succeeded = await viewModel.publish()

        XCTAssertFalse(succeeded)
        XCTAssertTrue(transport.requests(forView: "platform_schema_publish").isEmpty)
    }

    /// Publish is also blocked when there is no saved draft at all yet
    /// (`Boolean(draft)` in the web's `canPublish`), even if the in-memory
    /// definition is perfectly valid.
    func testPublishBlockedWithNoSavedDraftNoNetworkCall() async {
        let transport = RoutingMockPlatformTransport()
        let publishedVersion = schemaVersionJSON(id: "v1", version: 1, status: "published", definitionJSON: definitionJSON())
        transport.setResponse(getSchemaResponse(draft: nil, published: publishedVersion, versions: [publishedVersion]), forView: "platform_schema_get")
        let viewModel = makeViewModel(transport: transport)
        await viewModel.load()
        XCTAssertNil(viewModel.draft)
        XCTAssertFalse(viewModel.canPublish)

        let succeeded = await viewModel.publish()

        XCTAssertFalse(succeeded)
        XCTAssertTrue(transport.requests(forView: "platform_schema_publish").isEmpty)
    }
}

/// Forces every response for a specific `view` query param to a fixed
/// non-2xx status code — same pattern as `ReviewQueueViewModelTests`'s
/// private helper of the same name, reimplemented here since Swift test
/// targets don't share `private`/`fileprivate` types across files.
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
