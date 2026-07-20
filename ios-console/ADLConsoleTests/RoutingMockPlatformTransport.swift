import ConsoleAPI
import Foundation

/// A `PlatformTransport` double that routes on the `view` query parameter —
/// `MockPlatformTransport` (used by `AppStateTests`) returns one fixed
/// response for every call, which is enough for the org-bootstrap flow, but
/// `CaptureViewModel` drives three different endpoints in one flow
/// (`platform_project_list` -> `platform_schema_get` -> `platform_record_create`)
/// and needs a distinct canned response per endpoint.
final class RoutingMockPlatformTransport: PlatformTransport, @unchecked Sendable {
    private var responsesByView: [String: Data] = [:]
    private(set) var capturedRequests: [URLRequest] = []
    private let lock = NSLock()

    func setResponse(_ data: Data, forView view: String) {
        lock.lock()
        defer { lock.unlock() }
        responsesByView[view] = data
    }

    var lastRequest: URLRequest? {
        lock.lock()
        defer { lock.unlock() }
        return capturedRequests.last
    }

    func requests(forView view: String) -> [URLRequest] {
        lock.lock()
        defer { lock.unlock() }
        return capturedRequests.filter { viewParameter(of: $0) == view }
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        // `NSLock.lock()`/`unlock()` are unavailable directly inside an
        // `async` function body under strict concurrency — routed through a
        // synchronous helper instead, since the restriction is lexical
        // (does the *call site* sit in an async function), not transitive.
        let data = recordRequestAndResolveResponse(request)

        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["content-type": "application/json"]
        )!
        return (data, response)
    }

    private func recordRequestAndResolveResponse(_ request: URLRequest) -> Data {
        lock.lock()
        defer { lock.unlock() }
        capturedRequests.append(request)
        let view = viewParameter(of: request)
        return view.flatMap { responsesByView[$0] } ?? Data("{}".utf8)
    }

    private func viewParameter(of request: URLRequest) -> String? {
        guard let url = request.url, let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        return components.queryItems?.first { $0.name == "view" }?.value
    }
}
