import Foundation
@testable import ConsoleAPI

/// Test double for `PlatformTransport` — captures the last outgoing
/// `URLRequest` and returns a canned `(Data, HTTPURLResponse)` pair, so
/// `PlatformAPIClient` can be exercised end-to-end with no real network
/// activity. Mirrors how `lib/client/platformApi.ts` tests would inject a
/// fake `fetchFn` via `PlatformApiDeps`.
final class MockPlatformTransport: PlatformTransport, @unchecked Sendable {
    private(set) var capturedRequests: [URLRequest] = []
    var statusCode: Int = 200
    var responseData: Data = Data("{}".utf8)
    var responseHeaders: [String: String] = ["content-type": "application/json"]

    var lastRequest: URLRequest? { capturedRequests.last }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        capturedRequests.append(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: responseHeaders
        )!
        return (responseData, response)
    }
}

/// JSON test helpers shared across the ConsoleAPI test suite.
enum JSONFixture {
    static func data(_ string: String) -> Data {
        Data(string.utf8)
    }

    /// Decodes a captured request's `httpBody` into a loosely-typed JSON
    /// dictionary so tests can assert on individual fields without needing a
    /// concrete Decodable type per request body.
    static func bodyObject(_ request: URLRequest) throws -> [String: Any] {
        guard let body = request.httpBody else { return [:] }
        let object = try JSONSerialization.jsonObject(with: body)
        return object as? [String: Any] ?? [:]
    }

    /// Parses a request URL's query string into a `[String: String]` for
    /// order-independent assertions.
    static func queryParams(_ request: URLRequest) -> [String: String] {
        guard let url = request.url, let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return [:]
        }
        var result: [String: String] = [:]
        for item in components.queryItems ?? [] {
            result[item.name] = item.value
        }
        return result
    }
}
