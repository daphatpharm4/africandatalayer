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

/// Distinguishes the kind of unavailability so the session repository can
/// decide whether to fall back to cached workspace data.
enum AuthUnavailability: Equatable, Sendable {
    case transport
    case server(status: Int)
}

/// Typed result for session restoration — preserves the distinction between
/// "no session exists", "session is invalid/expired", "the server is
/// reachable but returned a non-2xx status", and "the transport itself
/// failed (network unavailable)".
enum AuthSessionRestoreResult: Equatable, Sendable {
    case authenticated(AuthSessionUser)
    case noSession
    case unauthorized
    case unavailable(AuthUnavailability)
}

/// Optional capability for auth services that can check an existing persisted
/// session, such as the cookie-backed network implementation.
protocol AuthSessionRestoring: Sendable {
    func restoreSession() async -> AuthSessionRestoreResult
}

/// Optional capability for auth services that can invalidate a server-side
/// session cookie (e.g. `POST /api/auth/signout`). Without this, logging out
/// only clears local state — the cookie survives and `restoreSession()` on the
/// next app launch re-authenticates the user silently.
protocol AuthSigningOut: Sendable {
    func signOut() async throws
}

/// Optional capability for auth services that can synchronously clear
/// client-side session state (cookies, tokens) on sign-out. Called before
/// the async server-side signout so the cookie jar is empty even if the
/// server call never completes (e.g. app killed immediately after logout).
protocol AuthLocalSessionClearing: Sendable {
    func clearLocalSession()
}

/// STUB, not the real native auth integration — kept around (and wired to
/// `AppState` in tests/previews) purely as a fast, deterministic input-shape
/// validator. The real handshake against @auth/core's credentials provider —
/// `GET /api/auth/csrf` → `POST /api/auth/callback/credentials` → `GET
/// /api/auth/session`, sharing `URLSession.shared`'s cookie jar with
/// `URLSessionPlatformTransport` — now lives in `NetworkAuthService.swift`
/// (see also `AuthTransport.swift` for its injectable transport seam). This
/// stub validates input shape only (non-empty, syntactically-plausible
/// email) and always succeeds.
struct StubAuthService: AuthServiceProtocol {
    func signIn(email: String, password: String) async throws {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.contains("@"), trimmed.contains("."), !password.isEmpty else {
            throw AuthServiceError.invalidCredentials
        }
    }
}
