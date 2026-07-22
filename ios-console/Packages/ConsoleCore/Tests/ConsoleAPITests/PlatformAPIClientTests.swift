import XCTest
import ConsoleModels
@testable import ConsoleAPI

final class PlatformAPIClientTests: XCTestCase {
    private let baseURL = URL(string: "https://console.example.com")!

    // MARK: - GET, no params: listMyOrganizations

    func testListMyOrganizationsSendsCorrectGetRequestAndDecodesRoleIntersection() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "organizations": [
            {
              "id": "org_1",
              "name": "Acme",
              "slug": "acme",
              "logoUrl": null,
              "accentColor": null,
              "createdAt": "2026-01-01T00:00:00.000Z",
              "role": "owner"
            }
          ]
        }
        """)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        let organizations = try await client.listMyOrganizations()

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.url?.path, "/api/user")
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_org_list")
        XCTAssertNil(request.value(forHTTPHeaderField: "Idempotency-Key"))
        XCTAssertNil(request.httpBody)

        XCTAssertEqual(organizations.count, 1)
        XCTAssertEqual(organizations[0].organization.id, "org_1")
        XCTAssertEqual(organizations[0].organization.slug, "acme")
        XCTAssertEqual(organizations[0].role, .owner)
    }

    // MARK: - GET with extra params: nearbyPlatformPoints

    func testNearbyPlatformPointsSendsCorrectQueryParamsAndDecodesList() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "points": [
            {
              "pointId": "point_1",
              "category": "pharmacy",
              "name": "Pharmacie Centrale",
              "location": {"latitude": 4.05, "longitude": 9.71},
              "details": {},
              "createdAt": "2026-01-01T00:00:00.000Z",
              "updatedAt": "2026-01-02T00:00:00.000Z",
              "gaps": [],
              "eventsCount": 2,
              "distanceMeters": 12.5
            }
          ]
        }
        """)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        let points = try await client.nearbyPlatformPoints(
            projectId: "proj_1",
            latitude: 4.05,
            longitude: 9.71,
            radiusMeters: 500
        )

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.httpMethod, "GET")
        let query = JSONFixture.queryParams(request)
        XCTAssertEqual(query["view"], "platform_point_nearby")
        XCTAssertEqual(query["projectId"], "proj_1")
        XCTAssertEqual(query["latitude"], "4.05")
        XCTAssertEqual(query["longitude"], "9.71")
        XCTAssertEqual(query["radiusMeters"], "500.0")
        XCTAssertNil(request.value(forHTTPHeaderField: "Idempotency-Key"))

        XCTAssertEqual(points.count, 1)
        XCTAssertEqual(points[0].pointId, "point_1")
        XCTAssertEqual(points[0].distanceMeters, 12.5)
    }

    // MARK: - POST with body, no idempotency: createOrganization

    func testCreateOrganizationSendsCorrectPostBodyAndNoIdempotencyHeader() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "organization": {
            "id": "org_2",
            "name": "New Co",
            "slug": "new-co",
            "logoUrl": null,
            "accentColor": null,
            "createdAt": "2026-01-01T00:00:00.000Z"
          }
        }
        """)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        let organization = try await client.createOrganization(name: "New Co", slug: "new-co")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_org_create")
        XCTAssertEqual(request.value(forHTTPHeaderField: "content-type"), "application/json")
        XCTAssertNil(request.value(forHTTPHeaderField: "Idempotency-Key"))

        let body = try JSONFixture.bodyObject(request)
        XCTAssertEqual(body["name"] as? String, "New Co")
        XCTAssertEqual(body["slug"] as? String, "new-co")

        XCTAssertEqual(organization.id, "org_2")
        XCTAssertEqual(organization.slug, "new-co")
    }

    // MARK: - Mutation with idempotency: createPlatformRecord

    func testCreatePlatformRecordSendsIdempotencyHeaderAndExcludesItFromBody() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "record": {
            "id": "rec_1",
            "projectId": "proj_1",
            "organizationId": "org_1",
            "schemaVersionId": "sv_1",
            "recordTypeKey": "pharmacy",
            "data": {"name": "Pharmacie Centrale"},
            "evidence": {"photos": ["https://example.com/a.jpg"]},
            "status": "pending_review",
            "capturedBy": "user_1",
            "createdAt": "2026-01-01T00:00:00.000Z"
          }
        }
        """)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        let record = try await client.createPlatformRecord(
            projectId: "proj_1",
            schemaVersionId: "sv_1",
            recordTypeKey: "pharmacy",
            data: ["name": .string("Pharmacie Centrale")],
            evidence: PlatformRecordEvidence(photos: ["https://example.com/a.jpg"]),
            idempotencyKey: "idem-key-123"
        )

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_record_create")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Idempotency-Key"), "idem-key-123")

        let body = try JSONFixture.bodyObject(request)
        XCTAssertNil(body["idempotencyKey"], "idempotencyKey must be header-only, not part of the JSON body")
        XCTAssertEqual(body["projectId"] as? String, "proj_1")
        XCTAssertEqual(body["recordTypeKey"] as? String, "pharmacy")

        XCTAssertEqual(record.id, "rec_1")
        XCTAssertEqual(record.status, .pendingReview)
    }

    // MARK: - reviewPlatformRecord (mutation, narrowed review-status enum)

    func testReviewPlatformRecordSendsCorrectBodyAndDecodesApprovedRecord() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "record": {
            "id": "rec_2",
            "projectId": "proj_1",
            "organizationId": "org_1",
            "schemaVersionId": "sv_1",
            "recordTypeKey": "pharmacy",
            "data": {},
            "evidence": {"photos": []},
            "status": "approved",
            "capturedBy": "user_1",
            "createdAt": "2026-01-01T00:00:00.000Z",
            "reviewedBy": "admin_1",
            "reviewedAt": "2026-01-02T00:00:00.000Z",
            "reviewNotes": "Looks good"
          }
        }
        """)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        let record = try await client.reviewPlatformRecord(
            organizationId: "org_1",
            recordId: "rec_2",
            status: .approved,
            reviewNotes: "Looks good"
        )

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_record_review")
        XCTAssertNil(request.value(forHTTPHeaderField: "Idempotency-Key"))

        let body = try JSONFixture.bodyObject(request)
        XCTAssertEqual(body["status"] as? String, "approved")
        XCTAssertEqual(body["recordId"] as? String, "rec_2")

        XCTAssertEqual(record.status, .approved)
        XCTAssertEqual(record.reviewNotes, "Looks good")
    }

    func testSendNotificationBroadcastSendsTargetRolesAndDecodesCounts() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "sentCount": 12,
          "skippedCount": 2,
          "failedCount": 1
        }
        """)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        let result = try await client.sendNotificationBroadcast(
            organizationId: "org_1",
            targetRoles: [.reviewer, .collector],
            title: "Route updated",
            body: "Start with the Nairobi pilot route."
        )

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_notification_broadcast")
        XCTAssertNil(request.value(forHTTPHeaderField: "Idempotency-Key"))

        let body = try JSONFixture.bodyObject(request)
        XCTAssertEqual(body["organizationId"] as? String, "org_1")
        XCTAssertEqual(body["title"] as? String, "Route updated")
        XCTAssertEqual(body["body"] as? String, "Start with the Nairobi pilot route.")
        XCTAssertEqual(body["targetRoles"] as? [String], ["reviewer", "collector"])

        XCTAssertEqual(result.sentCount, 12)
        XCTAssertEqual(result.skippedCount, 2)
        XCTAssertEqual(result.failedCount, 1)
    }

    // MARK: - Bare-payload (non-envelope) responses: listOrgMembers, getSchema

    func testListOrgMembersDecodesBarePayloadWithMembersAndInvites() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "members": [
            {"organizationId": "org_1", "userId": "user_1", "role": "collector", "createdAt": "2026-01-01T00:00:00.000Z"}
          ],
          "invites": []
        }
        """)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        let response = try await client.listOrgMembers(organizationId: "org_1")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_org_members")
        XCTAssertEqual(JSONFixture.queryParams(request)["organizationId"], "org_1")
        XCTAssertEqual(response.members.count, 1)
        XCTAssertEqual(response.members[0].role, .collector)
        XCTAssertTrue(response.invites.isEmpty)
    }

    func testGetSchemaDecodesNullableDraftAndPublished() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data("""
        {
          "draft": null,
          "published": {
            "id": "sv_1",
            "projectId": "proj_1",
            "organizationId": "org_1",
            "version": 1,
            "status": "published",
            "definition": {"recordTypes": []},
            "publishedAt": "2026-01-01T00:00:00.000Z"
          },
          "versions": []
        }
        """)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        let response = try await client.getSchema(projectId: "proj_1")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_schema_get")
        XCTAssertNil(response.draft)
        XCTAssertEqual(response.published?.version, 1)
        XCTAssertEqual(response.published?.status, .published)
    }

    // MARK: - Void-returning mutations: revokeInvite / updateMember / removeMember

    func testRevokeInviteSendsCorrectRequestAndCompletesWithoutThrowing() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data(#"{"revoked": true}"#)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        try await client.revokeInvite(organizationId: "org_1", inviteId: "invite_1")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_invite_revoke")
        XCTAssertNil(request.value(forHTTPHeaderField: "Idempotency-Key"))
        let body = try JSONFixture.bodyObject(request)
        XCTAssertEqual(body["inviteId"] as? String, "invite_1")
    }

    func testUpdateMemberSendsCorrectRequestAndCompletesWithoutThrowing() async throws {
        let transport = MockPlatformTransport()
        transport.responseData = JSONFixture.data(#"{"updated": true}"#)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        try await client.updateMember(organizationId: "org_1", userId: "user_1", role: .manager)

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(JSONFixture.queryParams(request)["view"], "platform_member_update")
        let body = try JSONFixture.bodyObject(request)
        XCTAssertEqual(body["role"] as? String, "manager")
    }

    // MARK: - Error mapping

    func testNonSuccessStatusThrowsPlatformAPIErrorWithStatusMessageAndCode() async throws {
        let transport = MockPlatformTransport()
        transport.statusCode = 422
        transport.responseData = JSONFixture.data("""
        {"error": "Validation failed", "code": "invalid_input", "issues": [{"path": "name", "message": "Required"}]}
        """)
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        do {
            _ = try await client.createOrganization(name: "", slug: "")
            XCTFail("Expected PlatformAPIError to be thrown")
        } catch let error as PlatformAPIError {
            XCTAssertEqual(error.status, 422)
            XCTAssertEqual(error.message, "Validation failed")
            XCTAssertEqual(error.code, "invalid_input")
            XCTAssertEqual(error.issues?.first?.path, "name")
        }
    }

    func testNonSuccessStatusWithoutParsableBodyFallsBackToGenericMessage() async throws {
        let transport = MockPlatformTransport()
        transport.statusCode = 500
        transport.responseData = JSONFixture.data("not json")
        let client = PlatformAPIClient(baseURL: baseURL, transport: transport)

        do {
            _ = try await client.getMyPlatformRecordSummary()
            XCTFail("Expected PlatformAPIError to be thrown")
        } catch let error as PlatformAPIError {
            XCTAssertEqual(error.status, 500)
            XCTAssertEqual(error.message, "Request failed (500)")
            XCTAssertNil(error.code)
        }
    }
}
