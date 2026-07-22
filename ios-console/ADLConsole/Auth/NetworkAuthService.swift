import Foundation

/// User payload extracted from `GET /api/auth/session`'s `{ user }`, mirroring
/// the fields of `lib/client/auth.ts`'s `AuthSession.user` the console cares
/// about (id/email/role/isAdmin — used by `AppState.tryRestoreSession()` to
/// derive `isAdlAdmin` and `viewerUserId` on app launch).
struct AuthSessionUser: Equatable, Sendable {
    let id: String?
    let email: String?
    let role: String?
    let isAdmin: Bool?
}

/// Real credential auth service — ports the 3-request Auth.js credentials
/// dance from `lib/client/auth.ts` (`signInWithCredentialsOnce` +
/// `getSession`) onto `URLSession`/`AuthTransport`:
///
///   1. `GET  /api/auth/csrf`                 → `{ csrfToken }` (sets a csrf cookie)
///   2. `POST /api/auth/callback/credentials`  → sets the session cookie on success
///   3. `GET  /api/auth/session`               → `{ user }` confirms the session landed
///
/// Uses `URLSessionAuthTransport` (i.e. `URLSession.shared` +
/// `HTTPCookieStorage.shared`) by default, so the cookie `Set-Cookie` sets in
/// step 2 is automatically replayed by `URLSessionPlatformTransport`'s later
/// `PlatformAPIClient` calls — no manual cookie plumbing on either side (see
/// `AuthTransport.swift`).
struct NetworkAuthService: AuthServiceProtocol, AuthSessionRestoring, AuthSigningOut, AuthLocalSessionClearing {
    private let baseURL: URL
    private let transport: AuthTransport

    init(baseURL: URL, transport: AuthTransport = URLSessionAuthTransport()) {
        self.baseURL = baseURL
        self.transport = transport
    }

    // MARK: - AuthServiceProtocol

    /// `identifier` and `email` form fields are BOTH the normalized (trimmed,
    /// lowercased) email — matching `signInWithCredentialsOnce`'s
    /// `normalizeIdentifier(identifier)?.value` (email path; the console only
    /// ever collects an email, never a phone identifier).
    func signIn(email: String, password: String) async throws {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalizedEmail.isEmpty, !password.isEmpty else {
            throw AuthServiceError.invalidCredentials
        }

        let csrfToken = try await fetchCsrfToken()
        try await postCredentialsCallback(csrfToken: csrfToken, email: normalizedEmail, password: password)

        guard try await fetchSessionUser() != nil else {
            // Callback succeeded (no Auth.js `error` param on the redirect) but the
            // session GET came back with no user — surface as a network/availability
            // failure, matching how `AuthServiceError.network` reads to the shell
            // ("temporarily unavailable, try again") rather than "wrong password".
            throw AuthServiceError.network("Session did not establish after sign-in.")
        }
    }

    // MARK: - Session restore / sign-out
    //
    // Not part of `AuthServiceProtocol` (which only declares `signIn` — see
    // `AuthService.swift`); these are additional entry points a caller can
    // reach directly (e.g. an app-launch session check, or a future
    // network-backed `AppState.signOut()`). Wiring either into `AppState`'s
    // published state is out of scope for this task per the brief.

    /// `GET /api/auth/session` — returns a typed result that distinguishes
    /// "authenticated", "no session", "session expired/unauthorized", and
    /// "transport/server unavailable". Uses `transport.send()` directly
    /// (instead of the error-wrapping `self.send()`) so that HTTP status
    /// codes for non-2xx responses are preserved and transport errors are
    /// not swallowed into a generic `AuthServiceError.network`.
    func restoreSession() async -> AuthSessionRestoreResult {
        do {
            let request = URLRequest(url: baseURL.appendingPathComponent("api/auth/session"))
            let (data, response) = try await transport.send(request)
            let statusCode = response.statusCode
            guard (200..<300).contains(statusCode) else {
                if statusCode == 401 { return .unauthorized }
                return .unavailable(.server(status: statusCode))
            }
            guard let decoded = try? JSONDecoder().decode(SessionResponse.self, from: data),
                  let sessionUser = decoded.user else {
                return .noSession
            }
            return .authenticated(AuthSessionUser(id: sessionUser.id, email: sessionUser.email, role: sessionUser.role, isAdmin: sessionUser.isAdmin))
        } catch {
            return .unavailable(.transport)
        }
    }

    /// `POST /api/auth/signout` — mirrors `signOut()` in `lib/client/auth.ts`.
    func signOut() async throws {
        let csrfToken = try await fetchCsrfToken()
        let bodyData = formURLEncode([
            ("csrfToken", csrfToken),
            ("callbackUrl", baseURL.absoluteString),
            ("json", "true"),
        ])

        var request = URLRequest(url: baseURL.appendingPathComponent("api/auth/signout"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = bodyData

        let (_, response) = try await send(request)
        guard (200..<300).contains(response.statusCode) else {
            throw AuthServiceError.network("Sign-out failed (\(response.statusCode)).")
        }
    }

    /// Removes all cookies for `baseURL` from the shared cookie jar so that
    /// `restoreSession()` on the next app launch returns `nil` even if the
    /// server-side signout request never completed.
    func clearLocalSession() {
        let storage = HTTPCookieStorage.shared
        let cookies = storage.cookies(for: baseURL) ?? []
        for cookie in cookies {
            storage.deleteCookie(cookie)
        }
    }

    // MARK: - Steps

    private struct CsrfResponse: Decodable {
        let csrfToken: String
    }

    private func fetchCsrfToken() async throws -> String {
        let request = URLRequest(url: baseURL.appendingPathComponent("api/auth/csrf"))
        let (data, response) = try await send(request)
        guard (200..<300).contains(response.statusCode) else {
            throw AuthServiceError.network("CSRF request failed (\(response.statusCode)).")
        }
        guard let decoded = try? JSONDecoder().decode(CsrfResponse.self, from: data) else {
            throw AuthServiceError.network("Malformed CSRF response.")
        }
        return decoded.csrfToken
    }

    private struct CallbackResponse: Decodable {
        let url: String?
    }

    private func postCredentialsCallback(csrfToken: String, email: String, password: String) async throws {
        let bodyData = formURLEncode([
            ("csrfToken", csrfToken),
            ("identifier", email),
            ("email", email),
            ("password", password),
            ("callbackUrl", baseURL.absoluteString),
            ("json", "true"),
        ])

        var request = URLRequest(url: baseURL.appendingPathComponent("api/auth/callback/credentials"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue("1", forHTTPHeaderField: "X-Auth-Return-Redirect")
        request.httpBody = bodyData

        let (data, response) = try await send(request)

        // Non-2xx (esp. >=500) is a retryable network/unavailable condition per the brief —
        // there is no Auth.js redirect payload to inspect in that case.
        guard (200..<300).contains(response.statusCode) else {
            throw AuthServiceError.network("Sign-in request failed (\(response.statusCode)).")
        }

        guard let decoded = try? JSONDecoder().decode(CallbackResponse.self, from: data), let urlString = decoded.url else {
            throw AuthServiceError.network("Missing redirect URL in sign-in response.")
        }

        if urlContainsErrorParam(urlString) {
            throw AuthServiceError.invalidCredentials
        }
    }

    /// Mirrors `signInWithCredentialsOnce`'s check: `resolveAuthRedirectUrl(payload.url)`
    /// then `url.searchParams.get('error')` truthy → invalid-credentials. Resolves
    /// relative to `baseURL` (Auth.js can return a relative callback path) and falls
    /// back to a raw substring check if the string doesn't parse as a URL at all, so a
    /// malformed-but-clearly-erroring payload still fails closed rather than being
    /// silently treated as success.
    private func urlContainsErrorParam(_ urlString: String) -> Bool {
        if let url = URL(string: urlString, relativeTo: baseURL),
           let components = URLComponents(url: url, resolvingAgainstBaseURL: true) {
            return components.queryItems?.contains { $0.name == "error" } ?? false
        }
        return urlString.contains("error")
    }

    private struct SessionResponse: Decodable {
        struct User: Decodable {
            let id: String?
            let email: String?
            let role: String?
            let isAdmin: Bool?
        }
        let user: User?
    }

    private func fetchSessionUser() async throws -> AuthSessionUser? {
        let request = URLRequest(url: baseURL.appendingPathComponent("api/auth/session"))
        let (data, response) = try await send(request)
        guard (200..<300).contains(response.statusCode) else {
            throw AuthServiceError.network("Session request failed (\(response.statusCode)).")
        }
        guard let decoded = try? JSONDecoder().decode(SessionResponse.self, from: data), let user = decoded.user else {
            return nil
        }
        return AuthSessionUser(id: user.id, email: user.email, role: user.role, isAdmin: user.isAdmin)
    }

    // MARK: - Helpers

    private func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            return try await transport.send(request)
        } catch let error as AuthServiceError {
            throw error
        } catch {
            throw AuthServiceError.network(String(describing: error))
        }
    }

    /// `application/x-www-form-urlencoded` serialization matching JS
    /// `URLSearchParams.toString()` (the encoder `lib/client/auth.ts` uses via
    /// `new URLSearchParams()`): unreserved characters pass through, everything
    /// else is percent-encoded, and space is encoded as `+` rather than `%20`.
    private func formURLEncode(_ pairs: [(String, String)]) -> Data {
        let unreserved = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.*")
        func encode(_ value: String) -> String {
            let percentEncoded = value.addingPercentEncoding(withAllowedCharacters: unreserved) ?? value
            return percentEncoded.replacingOccurrences(of: " ", with: "+")
        }
        let encodedPairs = pairs.map { "\(encode($0.0))=\(encode($0.1))" }
        return Data(encodedPairs.joined(separator: "&").utf8)
    }
}
