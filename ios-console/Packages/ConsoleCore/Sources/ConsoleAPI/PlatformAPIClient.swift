import ConsoleModels
import Foundation

/// HTTP method used by a platform API call. Mirrors the `method: "GET" | "POST"`
/// union on `callPlatform`'s `options` parameter in `lib/client/platformApi.ts`.
enum PlatformHTTPMethod: String {
    case get = "GET"
    case post = "POST"
}

/// Async Swift port of `lib/client/platformApi.ts` — the typed client for the
/// Data Operations Platform admin surface. Every operation is `GET|POST
/// /api/user?view=platform_<name>` (see `lib/server/platform/api.ts`); this
/// type is the single place that knows that convention, mirroring the role
/// `platformApi.ts` plays on the web client.
///
/// Auth is cookie-session based; see `URLSessionPlatformTransport` for the
/// cookie-handling note. Testability mirrors the TS `PlatformApiDeps.fetchFn`
/// injection point: `transport` is supplied at `init` and can be a mock.
public struct PlatformAPIClient: Sendable {
    private let baseURL: URL
    private let transport: PlatformTransport

    public init(baseURL: URL, transport: PlatformTransport = URLSessionPlatformTransport()) {
        self.baseURL = baseURL
        self.transport = transport
    }

    // MARK: - Transport core (port of `callPlatform` in platformApi.ts)

    /// Every call is `GET|POST /api/user?view=platform_<name>` plus any extra
    /// query `params`. GET params go on the query string; POST bodies are
    /// JSON. `idempotencyKey`, when present, is sent as an `Idempotency-Key`
    /// header — mirroring `options.idempotencyKey` in the TS `callPlatform`,
    /// which only `createPlatformRecordRequest` actually supplies.
    ///
    /// The response body is decoded as `Response` on 2xx. On non-2xx the body
    /// is decoded as `PlatformAPIErrorPayload` and re-thrown as a
    /// `PlatformAPIError`, mirroring `callPlatform`'s `payload.error` /
    /// `payload.code` / `payload.issues` handling exactly — including the
    /// `.catch(() => ({}))` fallback for an unparsable body.
    private func callPlatform<Response: Decodable>(
        _ view: String,
        method: PlatformHTTPMethod,
        params: [String: String] = [:],
        bodyData: Data? = nil,
        idempotencyKey: String? = nil
    ) async throws -> Response {
        guard var components = URLComponents(url: baseURL.appendingPathComponent("api/user"), resolvingAgainstBaseURL: false) else {
            throw PlatformAPIError(message: "Invalid base URL", status: -1)
        }
        var queryItems = [URLQueryItem(name: "view", value: "platform_\(view)")]
        for (key, value) in params {
            queryItems.append(URLQueryItem(name: key, value: value))
        }
        components.queryItems = queryItems

        guard let url = components.url else {
            throw PlatformAPIError(message: "Invalid request URL", status: -1)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        if let bodyData {
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = bodyData
        }
        if let idempotencyKey {
            request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        }

        let (data, response) = try await transport.send(request)

        guard (200..<300).contains(response.statusCode) else {
            let errorPayload = (try? JSONDecoder().decode(PlatformAPIErrorPayload.self, from: data))
                ?? PlatformAPIErrorPayload(error: nil, code: nil, issues: nil)
            throw PlatformAPIError(
                message: errorPayload.error ?? "Request failed (\(response.statusCode))",
                status: response.statusCode,
                code: errorPayload.code,
                issues: errorPayload.issues
            )
        }

        let payloadData = data.isEmpty ? Data("{}".utf8) : data
        do {
            return try JSONDecoder().decode(Response.self, from: payloadData)
        } catch {
            throw PlatformAPIError(
                message: "Failed to decode response for view platform_\(view): \(error)",
                status: response.statusCode
            )
        }
    }

    // MARK: - Organizations

    private struct OrganizationsEnvelope: Decodable {
        var organizations: [PlatformOrganizationMembership]
    }

    /// `view=platform_org_list`, GET. Port of `listMyOrganizations`.
    public func listMyOrganizations() async throws -> [PlatformOrganizationMembership] {
        let envelope: OrganizationsEnvelope = try await callPlatform("org_list", method: .get)
        return envelope.organizations
    }

    private struct OrganizationEnvelope: Decodable {
        var organization: PlatformOrganization
    }

    /// `view=platform_org_create`, POST. Port of `createOrganizationRequest`.
    public func createOrganization(name: String, slug: String) async throws -> PlatformOrganization {
        struct Body: Encodable {
            var name: String
            var slug: String
        }
        let bodyData = try JSONEncoder().encode(Body(name: name, slug: slug))
        let envelope: OrganizationEnvelope = try await callPlatform("org_create", method: .post, bodyData: bodyData)
        return envelope.organization
    }

    /// `view=platform_org_get`, GET. Port of `getOrganizationRequest`.
    public func getOrganization(organizationId: String) async throws -> PlatformOrganization {
        let envelope: OrganizationEnvelope = try await callPlatform(
            "org_get",
            method: .get,
            params: ["organizationId": organizationId]
        )
        return envelope.organization
    }

    /// `view=platform_org_update`, POST. Port of `updateOrganizationRequest`.
    public func updateOrganization(
        organizationId: String,
        name: String? = nil,
        accentColor: String? = nil,
        logoDataUrl: String? = nil,
        clearLogo: Bool? = nil
    ) async throws -> PlatformOrganization {
        struct Body: Encodable {
            var organizationId: String
            var name: String?
            var accentColor: String?
            var logoDataUrl: String?
            var clearLogo: Bool?
        }
        let bodyData = try JSONEncoder().encode(
            Body(organizationId: organizationId, name: name, accentColor: accentColor, logoDataUrl: logoDataUrl, clearLogo: clearLogo)
        )
        let envelope: OrganizationEnvelope = try await callPlatform("org_update", method: .post, bodyData: bodyData)
        return envelope.organization
    }

    private struct AdminOrganizationsEnvelope: Decodable {
        var organizations: [PlatformAdminOrganizationSummary]
    }

    /// `view=platform_admin_org_list`, GET. Port of `listAdminOrganizationsRequest`.
    public func listAdminOrganizations() async throws -> [PlatformAdminOrganizationSummary] {
        let envelope: AdminOrganizationsEnvelope = try await callPlatform("admin_org_list", method: .get)
        return envelope.organizations
    }

    private struct AdminOrganizationAccessEnvelope: Decodable {
        var organization: PlatformOrganizationAccessResult
    }

    /// `view=platform_admin_org_access`, POST. Port of `updateAdminOrganizationAccessRequest`.
    public func updateAdminOrganizationAccess(
        organizationId: String,
        accessStatus: PlatformOrganizationAccessStatus,
        reason: String? = nil
    ) async throws -> PlatformOrganizationAccessResult {
        struct Body: Encodable {
            var organizationId: String
            var accessStatus: PlatformOrganizationAccessStatus
            var reason: String?
        }
        let bodyData = try JSONEncoder().encode(Body(organizationId: organizationId, accessStatus: accessStatus, reason: reason))
        let envelope: AdminOrganizationAccessEnvelope = try await callPlatform("admin_org_access", method: .post, bodyData: bodyData)
        return envelope.organization
    }

    // MARK: - Members & invites

    /// `view=platform_org_members`, GET. Port of `listOrgMembersRequest`.
    public func listOrgMembers(organizationId: String) async throws -> PlatformOrgMembersResponse {
        try await callPlatform("org_members", method: .get, params: ["organizationId": organizationId])
    }

    private struct InviteEnvelope: Decodable {
        var invite: PlatformInvite
    }

    /// `view=platform_invite_create`, POST. Port of `createInviteRequest`.
    ///
    /// Modeling note: TS types `role` as a plain `string` here (not
    /// `PlatformRole`) — invites can target roles the caller hasn't validated
    /// client-side yet — so this stays `String` rather than `PlatformRole` to
    /// match the source exactly.
    public func createInvite(organizationId: String, email: String, role: String) async throws -> PlatformInvite {
        struct Body: Encodable {
            var organizationId: String
            var email: String
            var role: String
        }
        let bodyData = try JSONEncoder().encode(Body(organizationId: organizationId, email: email, role: role))
        let envelope: InviteEnvelope = try await callPlatform("invite_create", method: .post, bodyData: bodyData)
        return envelope.invite
    }

    /// `view=platform_invite_accept`, POST. Port of `acceptInviteRequest`.
    public func acceptInvite(token: String) async throws -> PlatformAcceptInviteResponse {
        struct Body: Encodable {
            var token: String
        }
        let bodyData = try JSONEncoder().encode(Body(token: token))
        return try await callPlatform("invite_accept", method: .post, bodyData: bodyData)
    }

    /// `view=platform_invite_revoke`, POST. Port of `revokeInviteRequest`
    /// (TS discards the `{ revoked: true }` payload and returns `void`).
    public func revokeInvite(organizationId: String, inviteId: String) async throws {
        struct Body: Encodable {
            var organizationId: String
            var inviteId: String
        }
        let bodyData = try JSONEncoder().encode(Body(organizationId: organizationId, inviteId: inviteId))
        let _: PlatformEmptyResponse = try await callPlatform("invite_revoke", method: .post, bodyData: bodyData)
    }

    /// `view=platform_member_update`, POST. Port of `updateMemberRequest`
    /// (TS discards the `{ updated: true }` payload and returns `void`).
    public func updateMember(organizationId: String, userId: String, role: PlatformRole) async throws {
        struct Body: Encodable {
            var organizationId: String
            var userId: String
            var role: PlatformRole
        }
        let bodyData = try JSONEncoder().encode(Body(organizationId: organizationId, userId: userId, role: role))
        let _: PlatformEmptyResponse = try await callPlatform("member_update", method: .post, bodyData: bodyData)
    }

    /// `view=platform_member_remove`, POST. Port of `removeMemberRequest`
    /// (TS discards the `{ removed: true }` payload and returns `void`).
    public func removeMember(organizationId: String, userId: String) async throws {
        struct Body: Encodable {
            var organizationId: String
            var userId: String
        }
        let bodyData = try JSONEncoder().encode(Body(organizationId: organizationId, userId: userId))
        let _: PlatformEmptyResponse = try await callPlatform("member_remove", method: .post, bodyData: bodyData)
    }

    // MARK: - Projects

    private struct ProjectEnvelope: Decodable {
        var project: PlatformProject
    }

    /// `view=platform_project_create`, POST. Port of `createProjectRequest`.
    public func createProject(
        organizationId: String,
        name: String,
        coverageScope: PlatformProjectCoverageScope,
        coverageLabel: String? = nil
    ) async throws -> PlatformProject {
        struct Body: Encodable {
            var organizationId: String
            var name: String
            var coverageScope: PlatformProjectCoverageScope
            var coverageLabel: String?
        }
        let bodyData = try JSONEncoder().encode(
            Body(organizationId: organizationId, name: name, coverageScope: coverageScope, coverageLabel: coverageLabel)
        )
        let envelope: ProjectEnvelope = try await callPlatform("project_create", method: .post, bodyData: bodyData)
        return envelope.project
    }

    private struct ProjectsEnvelope: Decodable {
        var projects: [PlatformProject]
    }

    /// `view=platform_project_list`, GET. Port of `listProjectsRequest`.
    public func listProjects(organizationId: String) async throws -> [PlatformProject] {
        let envelope: ProjectsEnvelope = try await callPlatform(
            "project_list",
            method: .get,
            params: ["organizationId": organizationId]
        )
        return envelope.projects
    }

    // MARK: - Schema

    /// `view=platform_schema_get`, GET. Port of `getSchemaRequest`.
    public func getSchema(projectId: String) async throws -> PlatformSchemaGetResponse {
        try await callPlatform("schema_get", method: .get, params: ["projectId": projectId])
    }

    private struct SchemaVersionEnvelope: Decodable {
        var schemaVersion: PlatformSchemaVersion
    }

    /// `view=platform_schema_draft_save`, POST. Port of `saveSchemaDraftRequest`.
    public func saveSchemaDraft(projectId: String, definition: PlatformSchemaDefinition) async throws -> PlatformSchemaVersion {
        struct Body: Encodable {
            var projectId: String
            var definition: PlatformSchemaDefinition
        }
        let bodyData = try JSONEncoder().encode(Body(projectId: projectId, definition: definition))
        let envelope: SchemaVersionEnvelope = try await callPlatform("schema_draft_save", method: .post, bodyData: bodyData)
        return envelope.schemaVersion
    }

    /// `view=platform_schema_publish`, POST. Port of `publishSchemaRequest`.
    public func publishSchema(projectId: String) async throws -> PlatformSchemaVersion {
        struct Body: Encodable {
            var projectId: String
        }
        let bodyData = try JSONEncoder().encode(Body(projectId: projectId))
        let envelope: SchemaVersionEnvelope = try await callPlatform("schema_publish", method: .post, bodyData: bodyData)
        return envelope.schemaVersion
    }

    // MARK: - Field records

    private struct RecordEnvelope: Decodable {
        var record: PlatformRecord
    }

    /// `view=platform_record_create`, POST, with an `Idempotency-Key` header
    /// set from `idempotencyKey`. Port of `createPlatformRecordRequest` — the
    /// only mutation in `platformApi.ts` that actually supplies
    /// `options.idempotencyKey` to `callPlatform`. Note `idempotencyKey`
    /// itself is not part of the JSON body (it's header-only), matching the
    /// TS body object literal exactly.
    public func createPlatformRecord(
        projectId: String,
        schemaVersionId: String,
        recordTypeKey: String,
        data: [String: JSONValue],
        evidence: PlatformRecordEvidence,
        idempotencyKey: String,
        pointId: String? = nil
    ) async throws -> PlatformRecord {
        struct Body: Encodable {
            var projectId: String
            var schemaVersionId: String
            var recordTypeKey: String
            var data: [String: JSONValue]
            var evidence: PlatformRecordEvidence
            var pointId: String?
        }
        let bodyData = try JSONEncoder().encode(
            Body(
                projectId: projectId,
                schemaVersionId: schemaVersionId,
                recordTypeKey: recordTypeKey,
                data: data,
                evidence: evidence,
                pointId: pointId
            )
        )
        let envelope: RecordEnvelope = try await callPlatform(
            "record_create",
            method: .post,
            bodyData: bodyData,
            idempotencyKey: idempotencyKey
        )
        return envelope.record
    }

    private struct RecordsEnvelope: Decodable {
        var records: [PlatformRecord]
    }

    /// `view=platform_record_list`, GET. Port of `listPlatformRecordsRequest`.
    public func listPlatformRecords(organizationId: String, status: PlatformRecordStatus? = nil) async throws -> [PlatformRecord] {
        var params = ["organizationId": organizationId]
        if let status {
            params["status"] = status.rawValue
        }
        let envelope: RecordsEnvelope = try await callPlatform("record_list", method: .get, params: params)
        return envelope.records
    }

    /// `view=platform_record_browse`, GET. Port of `listApprovedPlatformRecordsRequest`.
    public func listApprovedPlatformRecords(organizationId: String) async throws -> [PlatformRecord] {
        let envelope: RecordsEnvelope = try await callPlatform(
            "record_browse",
            method: .get,
            params: ["organizationId": organizationId]
        )
        return envelope.records
    }

    private struct PointsEnvelope: Decodable {
        var points: [PlatformNearbyPoint]
    }

    /// `view=platform_point_nearby`, GET. Port of `nearbyPlatformPointsRequest`.
    public func nearbyPlatformPoints(
        projectId: String,
        latitude: Double,
        longitude: Double,
        radiusMeters: Double? = nil
    ) async throws -> [PlatformNearbyPoint] {
        var params = [
            "projectId": projectId,
            "latitude": String(latitude),
            "longitude": String(longitude),
        ]
        if let radiusMeters {
            params["radiusMeters"] = String(radiusMeters)
        }
        let envelope: PointsEnvelope = try await callPlatform("point_nearby", method: .get, params: params)
        return envelope.points
    }

    /// `view=platform_record_review`, POST. Port of `reviewPlatformRecordRequest`.
    public func reviewPlatformRecord(
        organizationId: String,
        recordId: String,
        status: PlatformRecordReviewStatus,
        reviewNotes: String? = nil
    ) async throws -> PlatformRecord {
        struct Body: Encodable {
            var organizationId: String
            var recordId: String
            var status: PlatformRecordReviewStatus
            var reviewNotes: String?
        }
        let bodyData = try JSONEncoder().encode(
            Body(organizationId: organizationId, recordId: recordId, status: status, reviewNotes: reviewNotes)
        )
        let envelope: RecordEnvelope = try await callPlatform("record_review", method: .post, bodyData: bodyData)
        return envelope.record
    }

    /// `view=platform_notification_broadcast`, POST. Sends an operational
    /// notification to members whose roles are included in `targetRoles`.
    public func sendNotificationBroadcast(
        organizationId: String,
        targetRoles: [PlatformRole],
        title: String,
        body: String
    ) async throws -> PlatformNotificationBroadcastResponse {
        struct Body: Encodable {
            var organizationId: String
            var targetRoles: [PlatformRole]
            var title: String
            var body: String
        }
        let bodyData = try JSONEncoder().encode(
            Body(organizationId: organizationId, targetRoles: targetRoles, title: title, body: body)
        )
        return try await callPlatform("notification_broadcast", method: .post, bodyData: bodyData)
    }

    private struct RecordSummaryEnvelope: Decodable {
        var summary: PlatformRecordSummary
    }

    /// `view=platform_record_my_summary`, GET. Port of `getMyPlatformRecordSummaryRequest`.
    public func getMyPlatformRecordSummary() async throws -> PlatformRecordSummary {
        let envelope: RecordSummaryEnvelope = try await callPlatform("record_my_summary", method: .get)
        return envelope.summary
    }
}
