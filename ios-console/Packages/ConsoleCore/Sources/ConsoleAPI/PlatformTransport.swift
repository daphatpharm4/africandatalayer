import Foundation

/// Abstraction over "send a `URLRequest`, get back the raw response body plus
/// the HTTP response" — the seam `PlatformAPIClient` calls through for every
/// request. Mirrors the injectable `PlatformApiDeps.fetchFn` seam in
/// `lib/client/platformApi.ts`, which lets tests supply a fake `fetch` instead
/// of hitting the network.
///
/// Production code uses `URLSessionPlatformTransport`; tests inject a mock
/// that captures the outgoing request and returns canned data.
public protocol PlatformTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

/// Production `PlatformTransport` backed by `URLSession`.
///
/// Auth note: the platform API is cookie-session authenticated — the TS
/// client passes `credentials: "include"` on every `fetch` call (see
/// `lib/client/platformApi.ts`'s `callPlatform`). `URLSession`'s default
/// configuration already stores and replays cookies via
/// `HTTPCookieStorage.shared` for requests to the same host, which is the
/// Foundation equivalent of `credentials: "include"`, so no extra cookie
/// wiring is needed here. Attaching an authenticated session (e.g. from a
/// native sign-in flow) to the `URLSession` used by this transport is out of
/// scope for this task and is expected to land in a later phase.
public struct URLSessionPlatformTransport: PlatformTransport {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PlatformAPIError(message: "Received a non-HTTP response", status: -1)
        }
        return (data, httpResponse)
    }
}
