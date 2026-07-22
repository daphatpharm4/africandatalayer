@testable import ADLConsole
import Foundation

/// Test double for `AuthTransport` — captures every outgoing `URLRequest` (in
/// order) and returns queued `(Data, HTTPURLResponse)` pairs, one per call,
/// falling back to the last-queued response once exhausted. Mirrors
/// `MockPlatformTransport` (`ConsoleAPITests` / `ADLConsoleTests`), the same
/// role for `PlatformTransport`.
final class MockAuthTransport: AuthTransport, @unchecked Sendable {
    struct Stub {
        var statusCode: Int
        var data: Data

        static func json(_ string: String, statusCode: Int = 200) -> Stub {
            Stub(statusCode: statusCode, data: Data(string.utf8))
        }
    }

    private(set) var capturedRequests: [URLRequest] = []
    private var responses: [Stub]
    var shouldThrow: Bool = false
    var throwError: Error = URLError(.notConnectedToInternet)

    init(responses: [Stub] = []) {
        self.responses = responses
    }

    var lastRequest: URLRequest? { capturedRequests.last }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        if shouldThrow { throw throwError }
        capturedRequests.append(request)
        let stub = responses.isEmpty ? Stub(statusCode: 200, data: Data("{}".utf8)) : responses.removeFirst()
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: stub.statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: ["content-type": "application/json"]
        )!
        return (stub.data, response)
    }
}

/// Parses a captured request's `httpBody` (a `application/x-www-form-urlencoded`
/// string, per `NetworkAuthService.formURLEncode`) into a `[String: String]`
/// for order-independent field assertions.
enum FormBodyFixture {
    static func fields(_ request: URLRequest) -> [String: String] {
        guard let body = request.httpBody, let raw = String(data: body, encoding: .utf8) else { return [:] }
        var result: [String: String] = [:]
        for pair in raw.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
            guard parts.count == 2 else { continue }
            let key = String(parts[0]).removingPercentEncoding ?? String(parts[0])
            let value = String(parts[1]).replacingOccurrences(of: "+", with: " ").removingPercentEncoding ?? String(parts[1])
            result[key] = value
        }
        return result
    }
}
