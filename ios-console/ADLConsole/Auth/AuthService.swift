import Foundation

/// Errors surfaced by `AuthServiceProtocol.signIn`. Mirrors the
/// `AuthClientError` codes handled by `ConsoleAuthScreen.tsx`'s `mapError`
/// (`invalid_credentials`, `access_denied`) closely enough for the console
/// shell to present a bilingual message, without depending on the web
/// client's error type.
enum AuthServiceError: Error, Equatable, Sendable {
    case invalidCredentials
    case accessDenied
    case network(String)

    func message(_ language: ConsoleLanguage) -> String {
        switch self {
        case .invalidCredentials:
            return language.t("Invalid email or password.", "Adresse e-mail ou mot de passe invalide.")
        case .accessDenied:
            return language.t("Access is disabled for this account.", "L'accès est désactivé pour ce compte.")
        case .network(let detail):
            return language.t(
                "Company sign-in is temporarily unavailable. Check your connection and try again.",
                "La connexion entreprise est temporairement indisponible. Vérifiez votre connexion et réessayez."
            ) + (detail.isEmpty ? "" : " (\(detail))")
        }
    }
}

/// Seam between the console shell's auth flow and the credential
/// sign-in/session mechanics — injected so tests can drive `AppState`
/// without a network round trip. Mirrors the role the injectable
/// `PlatformTransport` plays for `PlatformAPIClient`.
protocol AuthServiceProtocol: Sendable {
    /// Signs in with email/password. On success the caller (`AppState`) is
    /// expected to have an authenticated session — i.e. subsequent
    /// `PlatformAPIClient` calls through the shared cookie-jar-backed
    /// `URLSession` will be authorized. Throws `AuthServiceError` on failure.
    func signIn(email: String, password: String) async throws
}

/// TODO(real-cookie-handshake): This is a STUB, not the real native auth
/// integration. The web client (`lib/client/auth.ts`) does a three-step
/// dance against the @auth/core credentials provider:
///   1. `GET /api/auth/csrf` → `{ csrfToken }`
///   2. `POST /api/auth/callback/credentials` (form-encoded: identifier,
///      password, csrfToken, json:true) — on success the server sets the
///      session cookie via `Set-Cookie`.
///   3. `GET /api/auth/session` → `{ user }` to confirm the session landed.
///
/// A native port needs to:
///   - Use a `URLSession` whose `HTTPCookieStorage` is shared with (or
///     configured identically to) the one `URLSessionPlatformTransport`
///     uses, so the session cookie set in step 2 is replayed by every
///     subsequent `PlatformAPIClient` call.
///   - Confirm the console API's cookie is not marked `SameSite=Strict` in
///     a way that blocks a native (non-browser) client — this needs
///     validation against a live preview deployment, which is out of scope
///     for this task per the brief ("Do NOT block on backend auth
///     details").
///   - Decide how CSRF token fetch + form encoding is done from
///     `URLSession` (no cookie jar quirks expected there, but untested).
///
/// Until that lands, this stub validates input shape only (non-empty,
/// syntactically-plausible email) and always succeeds — letting the rest of
/// the shell (role bootstrap, nav gating, Overview) be built and tested
/// against a real `AppState` flow.
struct StubAuthService: AuthServiceProtocol {
    func signIn(email: String, password: String) async throws {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.contains("@"), trimmed.contains("."), !password.isEmpty else {
            throw AuthServiceError.invalidCredentials
        }
    }
}
