import ConsoleAPI
import Foundation

/// Test double for `PlatformTransport` (from `ConsoleAPI`) — captures the
/// last outgoing `URLRequest` and returns a canned `(Data, HTTPURLResponse)`
/// pair, so `AppState` can be exercised end-to-end against `PlatformAPIClient`
/// with no real network activity. Mirrors `MockPlatformTransport` in the
/// `ConsoleCore` package's own `ConsoleAPITests` target — reimplemented here
/// (rather than shared) because it is a test-only type in a different module
/// and `PlatformTransport` is public, so conforming to it from this test
/// target needs no `@testable` import.
final class MockPlatformTransport: PlatformTransport, @unchecked Sendable {
    private(set) var capturedRequests: [URLRequest] = []
    var statusCode: Int = 200
    var responseData: Data = Data("{}".utf8)

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        capturedRequests.append(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: ["content-type": "application/json"]
        )!
        return (responseData, response)
    }
}
