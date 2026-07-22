@testable import ADLConsole
import ConsoleAPI
import ConsoleForms
import ConsoleModels
import XCTest

/// Covers the two things Task 5's brief calls out explicitly for the app
/// target: "form renders expected fields for a sample schema" and "submit
/// enqueues + calls the injected client with the idempotency key" — plus a
/// few adjacent flows (validation gating, offline/queued outcome) that were
/// cheap to add alongside those two.
@MainActor
final class CaptureViewModelTests: XCTestCase {
    private let projectsJSON = Data("""
    {"projects":[
        {"id":"proj-1","organizationId":"org-1","name":"Bonamoussadi Pharmacies","status":"active","coverageScope":"town","coverageLabel":"Bonamoussadi","createdAt":"2026-01-01T00:00:00.000Z"}
    ]}
    """.utf8)

    private let schemaJSON = Data("""
    {
      "draft": null,
      "published": {
        "id": "schema-1",
        "projectId": "proj-1",
        "organizationId": "org-1",
        "version": 1,
        "status": "published",
        "definition": {
          "recordTypes": [
            {
              "key": "pharmacy",
              "label": {"en": "Pharmacy", "fr": "Pharmacie"},
              "fields": [
                {"key": "name", "label": {"en": "Name", "fr": "Nom"}, "type": "text", "required": true},
                {"key": "price", "label": {"en": "Price", "fr": "Prix"}, "type": "number", "required": true, "min": 0, "max": 100000}
              ],
              "evidence": {"gpsRequired": false, "minPhotos": 0, "notesRequired": false}
            }
          ]
        },
        "publishedAt": "2026-01-01T00:00:00.000Z"
      },
      "versions": []
    }
    """.utf8)

    private let createRecordJSON = Data("""
    {"record": {
        "id": "rec-1",
        "projectId": "proj-1",
        "organizationId": "org-1",
        "schemaVersionId": "schema-1",
        "recordTypeKey": "pharmacy",
        "data": {"name": "Acme Pharmacy", "price": 10},
        "evidence": {"photos": []},
        "status": "pending_review",
        "capturedBy": "user-1",
        "createdAt": "2026-07-19T10:00:00.000Z"
    }}
    """.utf8)

    private func makeViewModel(
        transport: RoutingMockPlatformTransport,
        queue: RecordQueue = RecordQueue(store: InMemoryRecordQueueStore()),
        locationService: LocationServiceProtocol? = nil,
        fraudMetadataProvider: CaptureFraudMetadataProviding = StubCaptureFraudMetadataProvider()
    ) -> CaptureViewModel {
        transport.setResponse(projectsJSON, forView: "platform_project_list")
        transport.setResponse(schemaJSON, forView: "platform_schema_get")
        transport.setResponse(createRecordJSON, forView: "platform_record_create")

        return CaptureViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            queue: queue,
            language: .en,
            locationService: locationService,
            fraudMetadataProvider: fraudMetadataProvider
        )
    }

    // MARK: - Form renders expected fields for a sample schema

    func testDescriptorsMatchSampleSchemaFieldsAfterLoadingProjects() async {
        let viewModel = makeViewModel(transport: RoutingMockPlatformTransport())

        await viewModel.loadProjects()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.projectOptions.map(\.id), ["proj-1"])
        XCTAssertEqual(viewModel.selectedProjectId, "proj-1")
        XCTAssertEqual(viewModel.selectedRecordTypeKey, "pharmacy")

        let descriptors = viewModel.descriptors
        XCTAssertEqual(descriptors.map(\.key), ["name", "price"])
        XCTAssertEqual(descriptors[0].control, .text)
        XCTAssertEqual(descriptors[0].required, true)
        XCTAssertEqual(descriptors[1].control, .number)
        XCTAssertEqual(descriptors[1].min, 0)
        XCTAssertEqual(descriptors[1].max, 100000)
    }

    func testProjectsWithNoPublishedSchemaAreExcluded() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(projectsJSON, forView: "platform_project_list")
        transport.setResponse(Data("""
        {"draft": null, "published": null, "versions": []}
        """.utf8), forView: "platform_schema_get")

        let viewModel = CaptureViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            queue: RecordQueue(store: InMemoryRecordQueueStore()),
            language: .en
        )

        await viewModel.loadProjects()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertTrue(viewModel.projectOptions.isEmpty)
        XCTAssertTrue(viewModel.descriptors.isEmpty)
    }

    func testLoadProjectsFallsBackToCachedProjectOptionsWhenOffline() async throws {
        let schema = try JSONDecoder().decode(PlatformSchemaGetResponse.self, from: schemaJSON)
        let project = PlatformProject(
            id: "proj-1",
            organizationId: "org-1",
            name: "Bonamoussadi Pharmacies",
            status: .active,
            coverageScope: .town,
            coverageLabel: "Bonamoussadi",
            createdAt: "2026-01-01T00:00:00.000Z"
        )
        let cache = InMemoryConsoleOfflineCache(projectOptionsByOrganizationId: [
            "org-1": [CachedProjectOption(project: project, schemaVersion: schema.published!)]
        ])
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(Data("{\"error\":\"offline\"}".utf8), forView: "platform_project_list")
        let viewModel = CaptureViewModel(
            apiClient: PlatformAPIClient(
                baseURL: URL(string: "https://example.com")!,
                transport: ViewStatusOverrideTransport(inner: transport, view: "platform_project_list", statusCode: 503)
            ),
            organizationId: "org-1",
            queue: RecordQueue(store: InMemoryRecordQueueStore()),
            language: .en,
            offlineCache: cache
        )

        await viewModel.loadProjects()

        XCTAssertEqual(viewModel.loadState, .loaded)
        XCTAssertEqual(viewModel.projectOptions.map(\.id), ["proj-1"])
        XCTAssertEqual(viewModel.selectedRecordTypeKey, "pharmacy")
        XCTAssertEqual(viewModel.descriptors.map(\.key), ["name", "price"])
    }

    // MARK: - Submit enqueues + calls the injected client with the idempotency key

    func testSubmitEnqueuesDraftAndCallsInjectedClientWithStableIdempotencyKey() async {
        let transport = RoutingMockPlatformTransport()
        let queue = RecordQueue(
            store: InMemoryRecordQueueStore(),
            idGenerator: { "queue-item-1" },
            idempotencyKeyGenerator: { "idem-fixed-1" }
        )
        let viewModel = makeViewModel(transport: transport, queue: queue)

        await viewModel.loadProjects()
        viewModel.setValue(.text("Acme Pharmacy"), for: "name")
        viewModel.setValue(.numberText("10"), for: "price")

        await viewModel.submit()

        XCTAssertEqual(viewModel.submitState, .synced)

        let createRequests = transport.requests(forView: "platform_record_create")
        XCTAssertEqual(createRequests.count, 1)
        XCTAssertEqual(createRequests[0].value(forHTTPHeaderField: "Idempotency-Key"), "idem-fixed-1")

        let body = try? JSONSerialization.jsonObject(with: createRequests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["projectId"] as? String, "proj-1")
        XCTAssertEqual(body?["recordTypeKey"] as? String, "pharmacy")
        let data = body?["data"] as? [String: Any]
        XCTAssertEqual(data?["name"] as? String, "Acme Pharmacy")
        XCTAssertEqual(data?["price"] as? Double, 10)

        // The draft was removed from the queue once the submit succeeded.
        let remaining = try? await queue.items()
        XCTAssertEqual(remaining?.count, 0)
    }

    func testSubmitIncludesFraudMetadataEvidence() async throws {
        let transport = RoutingMockPlatformTransport()
        let provider = StubCaptureFraudMetadataProvider()
        let viewModel = makeViewModel(transport: transport, fraudMetadataProvider: provider)

        await viewModel.loadProjects()
        viewModel.setValue(.text("Acme Pharmacy"), for: "name")
        viewModel.setValue(.numberText("10"), for: "price")
        viewModel.evidenceGps = FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 8)
        viewModel.addPhotoRef("data:image/jpeg;base64,ZmFrZQ==", metadata: provider.photoMetadata(for: "", capturedAt: "2026-07-19T10:00:00Z"))

        await viewModel.submit()

        let request = try XCTUnwrap(transport.requests(forView: "platform_record_create").first)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: request.httpBody ?? Data()) as? [String: Any])
        let evidence = try XCTUnwrap(body["evidence"] as? [String: Any])
        let device = try XCTUnwrap(evidence["device"] as? [String: Any])
        XCTAssertEqual(device["deviceId"] as? String, "device-test-1")
        XCTAssertEqual(device["platform"] as? String, "ios")

        let photoMetadata = try XCTUnwrap(evidence["photoMetadata"] as? [[String: Any]])
        XCTAssertEqual(photoMetadata.first?["mimeType"] as? String, "image/jpeg")
        XCTAssertEqual(photoMetadata.first?["storedBytes"] as? Int, 4)

        let clientExif = try XCTUnwrap(evidence["clientExif"] as? [String: Any])
        XCTAssertEqual(clientExif["latitude"] as? Double, 4.05)
        XCTAssertEqual(clientExif["longitude"] as? Double, 9.7)
        XCTAssertEqual(clientExif["deviceMake"] as? String, "Apple")

        let gpsIntegrity = try XCTUnwrap(evidence["gpsIntegrity"] as? [String: Any])
        XCTAssertEqual(gpsIntegrity["hasAccelerometerData"] as? Bool, true)
        XCTAssertEqual(gpsIntegrity["hasGyroscopeData"] as? Bool, true)
        XCTAssertEqual(gpsIntegrity["accelerometerSampleCount"] as? Int, 12)
        XCTAssertEqual(gpsIntegrity["gpsAccuracyMeters"] as? Double, 8)
    }

    func testSubmitWithMissingRequiredFieldsDoesNotEnqueueOrCallClient() async {
        let transport = RoutingMockPlatformTransport()
        let queue = RecordQueue(store: InMemoryRecordQueueStore())
        let viewModel = makeViewModel(transport: transport, queue: queue)

        await viewModel.loadProjects()
        // "name" and "price" both left empty.
        await viewModel.submit()

        XCTAssertEqual(viewModel.submitState, .invalid)
        XCTAssertEqual(viewModel.lastValidation?.fieldErrors.map(\.key).sorted(), ["name", "price"])
        XCTAssertTrue(transport.requests(forView: "platform_record_create").isEmpty)
        let items = try? await queue.items()
        XCTAssertEqual(items?.count, 0)
    }

    func testSubmitSurfacesQueuedPendingSyncWhenServerReturnsRetryableError() async {
        let transport = RoutingMockPlatformTransport()
        transport.setResponse(projectsJSON, forView: "platform_project_list")
        transport.setResponse(schemaJSON, forView: "platform_schema_get")
        transport.setResponse(Data("""
        {"error": "temporarily unavailable"}
        """.utf8), forView: "platform_record_create")

        let queue = RecordQueue(store: InMemoryRecordQueueStore())
        let viewModel = CaptureViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: FailingStatusTransport(inner: transport, statusCode: 503)),
            organizationId: "org-1",
            queue: queue,
            language: .en
        )

        await viewModel.loadProjects()
        viewModel.setValue(.text("Acme Pharmacy"), for: "name")
        viewModel.setValue(.numberText("10"), for: "price")

        await viewModel.submit()

        XCTAssertEqual(viewModel.submitState, .queuedPendingSync)
        let items = try? await queue.items()
        XCTAssertEqual(items?.count, 1)
        XCTAssertEqual(items?.first?.status, .failed)
    }

    // MARK: - Attach to an existing point (company map "Update this point" seam)

    func testAttachPointIdIsSentAsPointIdOnSubmit() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = CaptureViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            queue: RecordQueue(store: InMemoryRecordQueueStore()),
            language: .en,
            attachPointId: "point-root-1"
        )
        transport.setResponse(projectsJSON, forView: "platform_project_list")
        transport.setResponse(schemaJSON, forView: "platform_schema_get")
        transport.setResponse(createRecordJSON, forView: "platform_record_create")

        XCTAssertEqual(viewModel.preAttachPointId, "point-root-1")

        await viewModel.loadProjects()
        viewModel.setValue(.text("Acme Pharmacy"), for: "name")
        viewModel.setValue(.numberText("10"), for: "price")

        await viewModel.submit()

        XCTAssertEqual(viewModel.submitState, .synced)
        let createRequests = transport.requests(forView: "platform_record_create")
        XCTAssertEqual(createRequests.count, 1)
        let body = try? JSONSerialization.jsonObject(with: createRequests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertEqual(body?["pointId"] as? String, "point-root-1")
    }

    func testAttachedPointSubmitRequiresImmediateVicinityBeforeEnqueue() async {
        let transport = RoutingMockPlatformTransport()
        let queue = RecordQueue(store: InMemoryRecordQueueStore())
        let locationService = MockLocationService(behavior: .succeed(
            FormGpsValue(latitude: 4.09, longitude: 9.74, accuracyMeters: 8)
        ))
        let viewModel = CaptureViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            queue: queue,
            language: .en,
            locationService: locationService,
            attachPointId: "point-root-1",
            attachPointGps: FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 8)
        )
        transport.setResponse(projectsJSON, forView: "platform_project_list")
        transport.setResponse(schemaJSON, forView: "platform_schema_get")
        transport.setResponse(createRecordJSON, forView: "platform_record_create")

        await viewModel.loadProjects()
        viewModel.setValue(.text("Acme Pharmacy"), for: "name")
        viewModel.setValue(.numberText("10"), for: "price")

        await viewModel.submit()

        guard case .failed(let message) = viewModel.submitState else {
            return XCTFail("expected proximity failure")
        }
        XCTAssertTrue(message.contains("too far"))
        XCTAssertEqual(locationService.requestCount, 1)
        XCTAssertTrue(transport.requests(forView: "platform_record_create").isEmpty)
        let items = try? await queue.items()
        XCTAssertEqual(items?.count, 0)
    }

    func testClearAttachedPointRemovesPreAttachedPointId() {
        let transport = RoutingMockPlatformTransport()
        let viewModel = CaptureViewModel(
            apiClient: PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: transport),
            organizationId: "org-1",
            queue: RecordQueue(store: InMemoryRecordQueueStore()),
            language: .en,
            attachPointId: "point-root-1"
        )

        XCTAssertEqual(viewModel.preAttachPointId, "point-root-1")

        viewModel.clearAttachedPoint()

        XCTAssertNil(viewModel.preAttachPointId)
    }

    func testNoAttachPointIdOmitsPointIdOnSubmit() async {
        let transport = RoutingMockPlatformTransport()
        let viewModel = makeViewModel(transport: transport)

        await viewModel.loadProjects()
        viewModel.setValue(.text("Acme Pharmacy"), for: "name")
        viewModel.setValue(.numberText("10"), for: "price")

        await viewModel.submit()

        let createRequests = transport.requests(forView: "platform_record_create")
        let body = try? JSONSerialization.jsonObject(with: createRequests[0].httpBody ?? Data()) as? [String: Any]
        XCTAssertNil(body?["pointId"])
    }

    // MARK: - GPS evidence capture

    func testRequestLocationPopulatesEvidenceGps() async {
        let transport = RoutingMockPlatformTransport()
        let expected = FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 6)
        let locationService = MockLocationService(behavior: .succeed(expected))
        let viewModel = makeViewModel(transport: transport, locationService: locationService)

        await viewModel.requestLocation()

        XCTAssertEqual(viewModel.evidenceGps, expected)
        XCTAssertEqual(locationService.requestCount, 1)
        XCTAssertNil(viewModel.locationErrorMessage)
    }

    func testRequestLocationSurfacesErrorMessage() async {
        let transport = RoutingMockPlatformTransport()
        let locationService = MockLocationService(behavior: .fail(.permissionDenied))
        let viewModel = makeViewModel(transport: transport, locationService: locationService)

        await viewModel.requestLocation()

        XCTAssertNil(viewModel.evidenceGps)
        XCTAssertNotNil(viewModel.locationErrorMessage)
    }
}

/// Wraps another `PlatformTransport`, forcing every response to a fixed
/// non-2xx status code — used to simulate a server-side failure on
/// `platform_record_create` without needing a per-view status map in
/// `RoutingMockPlatformTransport`.
private final class FailingStatusTransport: PlatformTransport, @unchecked Sendable {
    private let inner: RoutingMockPlatformTransport
    private let statusCode: Int

    init(inner: RoutingMockPlatformTransport, statusCode: Int) {
        self.inner = inner
        self.statusCode = statusCode
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await inner.send(request)
        guard response.url?.query?.contains("view=platform_record_create") == true else {
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

@MainActor
private final class StubCaptureFraudMetadataProvider: CaptureFraudMetadataProviding {
    func startCapture() {}
    func stopCapture() {}

    func device(language: ConsoleLanguage) -> PlatformRecordEvidence.Device {
        PlatformRecordEvidence.Device(
            deviceId: "device-test-1",
            platform: "ios",
            userAgent: "ADLConsoleTests",
            language: language.rawValue
        )
    }

    func photoMetadata(for dataURL: String, capturedAt: String) -> PlatformRecordEvidence.PhotoMetadata? {
        PlatformRecordEvidence.PhotoMetadata(
            mimeType: "image/jpeg",
            originalBytes: 4,
            storedBytes: 4,
            width: 2,
            height: 2,
            capturedAt: capturedAt
        )
    }

    func clientExif(gps: FormGpsValue?, capturedAt: String) -> PlatformRecordEvidence.ClientExif? {
        PlatformRecordEvidence.ClientExif(
            latitude: gps?.latitude,
            longitude: gps?.longitude,
            capturedAt: capturedAt,
            deviceMake: "Apple",
            deviceModel: "iPhone"
        )
    }

    func gpsIntegrity(gps: FormGpsValue?, capturedAt: Date) -> PlatformRecordEvidence.GpsIntegrity {
        PlatformRecordEvidence.GpsIntegrity(
            mockLocationDetected: false,
            mockLocationMethod: nil,
            hasAccelerometerData: true,
            hasGyroscopeData: true,
            accelerometerSampleCount: 12,
            motionDetectedDuringCapture: true,
            gpsAccuracyMeters: gps?.accuracyMeters,
            networkType: nil,
            gpsTimestamp: 1_784_457_600_000,
            deviceTimestamp: 1_784_457_600_250,
            timeDeltaMs: 250
        )
    }
}

private final class ViewStatusOverrideTransport: PlatformTransport, @unchecked Sendable {
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
