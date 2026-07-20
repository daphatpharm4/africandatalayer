import Foundation

/// Abstraction over "send a `URLRequest`, get back the raw response body plus
/// the HTTP response" — the seam `NetworkAuthService` calls through for each
/// of its three auth requests. Mirrors `ConsoleAPI.PlatformTransport` (the
/// same role it plays for `PlatformAPIClient`), so tests can inject a mock
/// instead of hitting the network. Not shared with `ConsoleAPI` directly:
/// this type lives in the app target (auth is app-level, not part of the
/// `ConsoleCore` package), so it gets its own small protocol rather than a
/// cross-module dependency for one shape.
protocol AuthTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

/// Production `AuthTransport` backed by `URLSession.shared` — deliberately
/// the *same* session (and therefore the same `HTTPCookieStorage.shared`
/// cookie jar) that `URLSessionPlatformTransport` uses. The session cookie
/// `POST /api/auth/callback/credentials` sets via `Set-Cookie` is then
/// replayed automatically by every subsequent `PlatformAPIClient` request —
/// no manual cookie plumbing needed on either side. Do NOT construct a
/// separate `URLSession` here; that would isolate this cookie jar from the
/// one `PlatformAPIClient` reads from.
struct URLSessionAuthTransport: AuthTransport {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        return (data, httpResponse)
    }
}
