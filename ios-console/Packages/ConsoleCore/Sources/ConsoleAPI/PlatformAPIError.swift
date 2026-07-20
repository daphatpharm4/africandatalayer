import Foundation

/// Mirrors `SchemaValidationIssue` in `shared/platformSchema.ts`, surfaced
/// through `PlatformApiError.issues` in `lib/client/platformApi.ts` when a
/// schema-draft save/publish fails validation.
public struct PlatformValidationIssue: Codable, Equatable, Sendable {
    public var path: String
    public var message: String

    public init(path: String, message: String) {
        self.path = path
        self.message = message
    }
}

/// Mirrors `PlatformApiError` in `lib/client/platformApi.ts`: every non-2xx
/// response from `GET|POST /api/user?view=platform_<name>` is surfaced as
/// this typed error instead of a generic thrown value, carrying the same
/// `status`, `message`, optional `code`, and optional `issues` fields the TS
/// class does.
public struct PlatformAPIError: Error, Equatable, Sendable {
    public var message: String
    public var status: Int
    public var code: String?
    public var issues: [PlatformValidationIssue]?

    public init(message: String, status: Int, code: String? = nil, issues: [PlatformValidationIssue]? = nil) {
        self.message = message
        self.status = status
        self.code = code
        self.issues = issues
    }
}

extension PlatformAPIError: LocalizedError {
    public var errorDescription: String? { message }
}

/// Decode target for a non-2xx response body. Mirrors exactly what
/// `callPlatform` reads off `payload` in `lib/client/platformApi.ts` when
/// `!response.ok`: `payload.error`, `payload.code`, `payload.issues`.
struct PlatformAPIErrorPayload: Decodable {
    var error: String?
    var code: String?
    var issues: [PlatformValidationIssue]?
}
