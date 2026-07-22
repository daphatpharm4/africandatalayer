@testable import ADLConsole
import Foundation

/// Test double for `AuthServiceProtocol` — lets `AppState` auth-flow tests
/// drive success/failure deterministically without any stub-validation
/// heuristics (unlike `StubAuthService`, which is exercised separately by
/// `StubAuthServiceTests`).
final class MockAuthService: AuthServiceProtocol, AuthSessionRestoring, @unchecked Sendable {
    enum Behavior {
        case succeed
        case throwError(AuthServiceError)
    }

    var behavior: Behavior = .succeed
    var restoredResult: AuthSessionRestoreResult?
    private(set) var signInCallCount = 0
    private(set) var restoreSessionCallCount = 0
    private(set) var lastEmail: String?
    private(set) var lastPassword: String?

    func signIn(email: String, password: String) async throws {
        signInCallCount += 1
        lastEmail = email
        lastPassword = password
        switch behavior {
        case .succeed:
            return
        case .throwError(let error):
            throw error
        }
    }

    func restoreSession() async -> AuthSessionRestoreResult {
        restoreSessionCallCount += 1
        return restoredResult ?? .noSession
    }
}
