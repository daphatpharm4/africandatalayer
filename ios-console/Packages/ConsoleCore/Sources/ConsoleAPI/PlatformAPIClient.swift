import ConsoleModels
import Foundation

/// HTTP method used by a platform API call. Mirrors the `method: "GET" | "POST"`
/// union on `callPlatform`'s `options` parameter in `lib/client/platformApi.ts`.
enum PlatformHTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
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

    /// `view=platform_record_batch_review`, POST. Applies ONE decision to
    /// every id in `recordIds` in a single request — the batch counterpart to
    /// `reviewPlatformRecord`, backed by `handleRecordBatchReview` in
    /// `lib/server/platform/api.ts`, which loops the exact same per-record
    /// review + audit logic `reviewPlatformRecord` uses (`reviewOneRecord`)
    /// rather than a bespoke bulk code path. The response is the bare
    /// `{ results, skippedCount }` payload (not wrapped in an envelope) —
    /// one `PlatformRecordBatchReviewItemResult` per id in `recordIds`,
    /// same order, so callers can zip results back to their local selection.
    public func batchReviewRecords(
        organizationId: String,
        recordIds: [String],
        decision: PlatformRecordReviewStatus,
        notes: String? = nil
    ) async throws -> PlatformRecordBatchReviewResponse {
        struct Body: Encodable {
            var organizationId: String
            var recordIds: [String]
            var decision: PlatformRecordReviewStatus
            var notes: String?
        }
        let bodyData = try JSONEncoder().encode(
            Body(organizationId: organizationId, recordIds: recordIds, decision: decision, notes: notes)
        )
        return try await callPlatform("record_batch_review", method: .post, bodyData: bodyData)
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

    // MARK: - Duplicate detection (api/submissions, NOT api/user)

    /// `GET api/submissions?view=dedup_candidates&category=&lat=&lng=&name=`
    /// — geo + category + name proximity duplicate lookup, see
    /// `lib/server/dedup.ts:buildDedupCandidates`. There is no hash-based
    /// dedup endpoint and no POST variant; this is read-only.
    ///
    /// Deliberately does NOT go through `callPlatform`: that helper is
    /// hard-coded to `api/user?view=platform_*`, but this lookup lives on
    /// the original field-submission surface, `api/submissions`. This
    /// mirrors `callPlatform`'s `URLComponents` construction and
    /// credentialed `transport.send` call directly against that different
    /// path instead. Auth is the same cookie session `callPlatform` relies
    /// on (see `URLSessionPlatformTransport`'s auth note) — no extra wiring
    /// needed here either.
    public func dedupCandidates(
        category: String,
        latitude: Double,
        longitude: Double,
        name: String? = nil
    ) async throws -> DedupCheckResult {
        guard var components = URLComponents(url: baseURL.appendingPathComponent("api/submissions"), resolvingAgainstBaseURL: false) else {
            throw PlatformAPIError(message: "Invalid base URL", status: -1)
        }
        var queryItems = [
            URLQueryItem(name: "view", value: "dedup_candidates"),
            URLQueryItem(name: "category", value: category),
            URLQueryItem(name: "lat", value: String(latitude)),
            URLQueryItem(name: "lng", value: String(longitude)),
        ]
        if let name {
            let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                queryItems.append(URLQueryItem(name: "name", value: trimmed))
            }
        }
        components.queryItems = queryItems

        guard let url = components.url else {
            throw PlatformAPIError(message: "Invalid request URL", status: -1)
        }

        let (data, response) = try await transport.send(URLRequest(url: url))

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

        do {
            return try JSONDecoder().decode(DedupCheckResult.self, from: data)
        } catch {
            throw PlatformAPIError(
                message: "Failed to decode dedup_candidates response: \(error)",
                status: response.statusCode
            )
        }
    }

    // MARK: - Organization analytics

    /// Tenant-scoped analytics served by `platform_analytics`. The backend
    /// validates membership before running organization-filtered queries.
    public func organizationAnalytics<Response: Decodable>(
        organizationId: String,
        section: String,
        query: [String: String] = [:]
    ) async throws -> Response {
        var params = query
        params["organizationId"] = organizationId
        params["section"] = section
        return try await callPlatform("analytics", method: .get, params: params)
    }

    // MARK: - ADL analytics (admin-only)

    /// Shared credentialed-request core for the analytics surface. Mirrors
    /// `callPlatform`'s `URLComponents` construction, credentialed
    /// `transport.send` call, and non-2xx error mapping, but against an
    /// arbitrary `path` instead of the `callPlatform`-hard-coded `api/user`.
    /// Used by `analyticsGet`, `leaderboard`, and `aiAnalyticsQuery` — none
    /// of which are `api/user?view=platform_*` calls, so none of them can go
    /// through `callPlatform`.
    private func sendAnalyticsRequest<Response: Decodable>(
        path: String,
        method: PlatformHTTPMethod,
        queryItems: [URLQueryItem] = [],
        bodyData: Data? = nil,
        decoder: JSONDecoder = JSONDecoder()
    ) async throws -> Response {
        guard var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw PlatformAPIError(message: "Invalid base URL", status: -1)
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw PlatformAPIError(message: "Invalid request URL", status: -1)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        if let bodyData {
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = bodyData
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

        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw PlatformAPIError(
                message: "Failed to decode response for \(path): \(error)",
                status: response.statusCode
            )
        }
    }

    /// `GET api/analytics?view=<view>&...query` — the read-only analytics
    /// surface (see `api/analytics/index.ts`). Real view names: `snapshots`,
    /// `deltas`, `monthly`, `trends`, `anomalies`, `spatial_intelligence`,
    /// `kpi_summary`, `kpi_weekly`.
    ///
    /// Several of these views (`snapshots`, `deltas`, `anomalies`,
    /// `kpi_weekly`) return raw Postgres rows with snake_case column names
    /// (e.g. `snapshot_date`, `vertical_id`) rather than the hand-built
    /// camelCase objects the other views return. Rather than hand-writing
    /// `CodingKeys` per snake_case row type, this decodes with
    /// `.convertFromSnakeCase` uniformly — it is a no-op for already-camelCase
    /// keys (no underscores to convert), so it's safe across every view.
    public func analyticsGet<Response: Decodable>(view: String, query: [String: String] = [:]) async throws -> Response {
        var queryItems = [URLQueryItem(name: "view", value: view)]
        for (key, value) in query {
            queryItems.append(URLQueryItem(name: key, value: value))
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try await sendAnalyticsRequest(path: "api/analytics", method: .get, queryItems: queryItems, decoder: decoder)
    }

    /// `GET api/leaderboard`. Company calls must include `organizationId`;
    /// the server rejects company identities that fall through to ADL scope.
    public func leaderboard(organizationId: String? = nil) async throws -> [LeaderboardEntry] {
        let queryItems = organizationId.map { [URLQueryItem(name: "organizationId", value: $0)] } ?? []
        return try await sendAnalyticsRequest(path: "api/leaderboard", method: .get, queryItems: queryItems)
    }

    /// `POST api/ai/search?view=analytics-query` — natural-language
    /// analytics Q&A (see `api/ai/search.ts` `handleAnalyticsAssistant` /
    /// `answerAnalyticsQuestion` in `lib/server/ai/analyticsAssistant.ts`).
    /// The request body's only required field is `question`; `vertical`,
    /// `zone`, `dateRange`, and `exportFormat` are optional server-side and
    /// unused by this task's `aiQuery(organizationId:query:)` entry point.
    public func aiAnalyticsQuery(question: String) async throws -> AIQueryResponse {
        struct Body: Encodable {
            var question: String
        }
        let bodyData = try JSONEncoder().encode(Body(question: question))
        return try await sendAnalyticsRequest(
            path: "api/ai/search",
            method: .post,
            queryItems: [URLQueryItem(name: "view", value: "analytics-query")],
            bodyData: bodyData
        )
    }

    // MARK: - Communications: email + SMS campaigns (api/privacy — NOT api/user)

    private struct EmailCampaignsEnvelope: Decodable {
        var campaigns: [EmailCampaign]
        var maxRecipients: Int
    }

    /// `GET api/privacy?view=campaigns` — admin-only list of the most recent
    /// email campaigns. Port of the `view === "campaigns"` GET handler in
    /// `api/privacy/index.ts`, backed by `listCampaigns` in
    /// `lib/server/email/campaigns.ts`. Reuses `sendAnalyticsRequest` the
    /// same way `listEmailCampaigns`'s siblings do below: campaigns live on
    /// the privacy surface, not `api/user?view=platform_*`, so this can't go
    /// through `callPlatform`.
    public func listEmailCampaigns() async throws -> (campaigns: [EmailCampaign], maxRecipients: Int) {
        let envelope: EmailCampaignsEnvelope = try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .get,
            queryItems: [URLQueryItem(name: "view", value: "campaigns")]
        )
        return (envelope.campaigns, envelope.maxRecipients)
    }

    /// `POST api/privacy?view=campaigns` — creates an email campaign and,
    /// unless `dryRun` or a future `scheduledAt` applies, immediately
    /// fast-path-dispatches the first batch. Port of `campaignCreateSchema` +
    /// `createCampaign` in `lib/server/email/campaigns.ts`. `createdBy` is
    /// derived server-side from the session and is intentionally not a
    /// parameter here.
    public func createEmailCampaign(
        subject: String,
        htmlBody: String,
        textBody: String,
        language: String = "en",
        recipientMode: String = "audience",
        audience: CommsAudienceFilter = CommsAudienceFilter(),
        manualRecipients: [String] = [],
        cc: [String] = [],
        scheduledAt: String? = nil,
        dryRun: Bool? = nil
    ) async throws -> CreatedEmailCampaign {
        struct Body: Encodable {
            var subject: String
            var htmlBody: String
            var textBody: String
            var language: String
            var recipientMode: String
            var audience: CommsAudienceFilter
            var manualRecipients: [String]
            var cc: [String]
            var scheduledAt: String?
            var dryRun: Bool?
        }
        let bodyData = try JSONEncoder().encode(
            Body(
                subject: subject,
                htmlBody: htmlBody,
                textBody: textBody,
                language: language,
                recipientMode: recipientMode,
                audience: audience,
                manualRecipients: manualRecipients,
                cc: cc,
                scheduledAt: scheduledAt,
                dryRun: dryRun
            )
        )
        return try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .post,
            queryItems: [URLQueryItem(name: "view", value: "campaigns")],
            bodyData: bodyData
        )
    }

    private struct CampaignCancelResponse: Decodable {
        var ok: Bool
    }

    /// `POST api/privacy?view=campaigns:cancel`, `{ id }`. Port of
    /// `cancelCampaign` in `lib/server/email/campaigns.ts`; returns `false`
    /// when the campaign was already terminal (server responds 404).
    public func cancelEmailCampaign(id: String) async throws -> Bool {
        struct Body: Encodable { var id: String }
        let bodyData = try JSONEncoder().encode(Body(id: id))
        let response: CampaignCancelResponse = try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .post,
            queryItems: [URLQueryItem(name: "view", value: "campaigns:cancel")],
            bodyData: bodyData
        )
        return response.ok
    }

    private struct EmailTemplatesEnvelope: Decodable {
        var templates: [EmailTemplate]
    }

    /// `GET api/privacy?view=email-templates[&includeArchived=true]`. Port
    /// of `listTemplates` in `lib/server/email/templates.ts`.
    public func listEmailTemplates(includeArchived: Bool = false) async throws -> [EmailTemplate] {
        var queryItems = [URLQueryItem(name: "view", value: "email-templates")]
        if includeArchived {
            queryItems.append(URLQueryItem(name: "includeArchived", value: "true"))
        }
        let envelope: EmailTemplatesEnvelope = try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .get,
            queryItems: queryItems
        )
        return envelope.templates
    }

    /// `GET api/privacy?view=audience-preview&audience=<json>`. Port of the
    /// `audience-preview` GET handler, which JSON-decodes the `audience`
    /// query param, validates it against `audienceSchema`, and resolves it
    /// via `resolveAudience`. Used by both the email and SMS composer flows
    /// before a send to show the recipient count up front.
    public func previewAudience(_ audience: CommsAudienceFilter) async throws -> AudiencePreview {
        let audienceData = try JSONEncoder().encode(audience)
        let audienceJson = String(data: audienceData, encoding: .utf8) ?? "{}"
        return try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .get,
            queryItems: [
                URLQueryItem(name: "view", value: "audience-preview"),
                URLQueryItem(name: "audience", value: audienceJson),
            ]
        )
    }

    private struct SmsCampaignsEnvelope: Decodable {
        var campaigns: [SmsCampaign]
        var maxRecipients: Int
    }

    /// `GET api/privacy?view=sms-campaigns`. Port of `listSmsCampaigns` in
    /// `lib/server/sms/campaigns.ts`.
    public func listSmsCampaigns() async throws -> (campaigns: [SmsCampaign], maxRecipients: Int) {
        let envelope: SmsCampaignsEnvelope = try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .get,
            queryItems: [URLQueryItem(name: "view", value: "sms-campaigns")]
        )
        return (envelope.campaigns, envelope.maxRecipients)
    }

    /// `POST api/privacy?view=sms-campaigns`. Port of
    /// `smsCampaignCreateSchema` + `createSmsCampaign` in
    /// `lib/server/sms/campaigns.ts`. Unlike the email path, a live
    /// (non-dry-run) send additionally requires `acknowledgeCost: true` once
    /// segment/cost estimates have been reviewed — omitting it gets a 400
    /// `cost_ack_required` from `api/privacy/index.ts`.
    public func createSmsCampaign(
        message: String,
        language: String = "en",
        audience: CommsAudienceFilter = CommsAudienceFilter(),
        scheduledAt: String? = nil,
        dryRun: Bool? = nil,
        acknowledgeCost: Bool? = nil
    ) async throws -> CreatedSmsCampaign {
        struct Body: Encodable {
            var message: String
            var language: String
            var audience: CommsAudienceFilter
            var scheduledAt: String?
            var dryRun: Bool?
            var acknowledgeCost: Bool?
        }
        let bodyData = try JSONEncoder().encode(
            Body(
                message: message,
                language: language,
                audience: audience,
                scheduledAt: scheduledAt,
                dryRun: dryRun,
                acknowledgeCost: acknowledgeCost
            )
        )
        return try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .post,
            queryItems: [URLQueryItem(name: "view", value: "sms-campaigns")],
            bodyData: bodyData
        )
    }

    /// `POST api/privacy?view=sms-campaigns:cancel`, `{ id }`. Port of
    /// `cancelSmsCampaign` in `lib/server/sms/campaigns.ts`.
    public func cancelSmsCampaign(id: String) async throws -> Bool {
        struct Body: Encodable { var id: String }
        let bodyData = try JSONEncoder().encode(Body(id: id))
        let response: CampaignCancelResponse = try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .post,
            queryItems: [URLQueryItem(name: "view", value: "sms-campaigns:cancel")],
            bodyData: bodyData
        )
        return response.ok
    }

    // MARK: - Admin operations: IP/privacy lead queue

    /// Platform-admin-only IP report queue. The server is the authorization
    /// authority; the iOS shell additionally hides this surface from
    /// organization-only roles so they never land on a guaranteed 403.
    public func listIpReports() async throws -> [IpReport] {
        try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .get,
            queryItems: [URLQueryItem(name: "view", value: "ip-reports")]
        )
    }

    public func updateIpReport(
        id: String,
        status: String,
        resolutionNotes: String?
    ) async throws -> IpReport {
        struct Body: Encodable {
            var id: String
            var status: String
            var resolutionNotes: String?
        }
        let bodyData = try JSONEncoder().encode(
            Body(id: id, status: status, resolutionNotes: resolutionNotes)
        )
        return try await sendAnalyticsRequest(
            path: "api/privacy",
            method: .patch,
            queryItems: [URLQueryItem(name: "view", value: "ip-report")],
            bodyData: bodyData
        )
    }

    // MARK: - Missions & gamification

    private struct MissionsEnvelope: Decodable { var missions: [PlatformMission] }
    private struct MissionEnvelope: Decodable { var mission: PlatformMission }
    private struct MissionAssignEnvelope: Decodable {
        var assigned: Bool
        var missionId: String
        var targetUserIds: [String]
    }

    public func listMissions(organizationId: String) async throws -> [PlatformMission] {
        let envelope: MissionsEnvelope = try await callPlatform(
            "mission_list",
            method: .get,
            params: ["organizationId": organizationId]
        )
        return envelope.missions
    }

    public func createMission(input: PlatformMissionCreateInput) async throws -> PlatformMission {
        struct CreateBody: Encodable {
            var organizationId: String
            var titleEn: String
            var titleFr: String
            var quota: Int
            var deadline: String
            var rewardXp: Int
            var projectId: String?
            var category: String?
            var notesEn: String?
            var notesFr: String?
        }
        let body = CreateBody(
            organizationId: input.organizationId,
            titleEn: input.titleEn,
            titleFr: input.titleFr,
            quota: input.quota,
            deadline: input.deadline,
            rewardXp: input.rewardXp,
            projectId: input.projectId,
            category: input.category,
            notesEn: input.notesEn,
            notesFr: input.notesFr
        )
        let envelope: MissionEnvelope = try await callPlatform(
            "mission_create",
            method: .post,
            bodyData: try JSONEncoder().encode(body)
        )
        if !input.targetUserIds.isEmpty {
            _ = try await assignMission(id: envelope.mission.id, targetUserIds: input.targetUserIds)
        }
        return envelope.mission
    }

    @discardableResult
    public func assignMission(id: String, targetUserIds: [String]) async throws -> Bool {
        struct Body: Encodable {
            var missionId: String
            var targetUserIds: [String]
        }
        let envelope: MissionAssignEnvelope = try await callPlatform(
            "mission_assign",
            method: .post,
            bodyData: try JSONEncoder().encode(Body(missionId: id, targetUserIds: targetUserIds))
        )
        return envelope.assigned
    }
}
