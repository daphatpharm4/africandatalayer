import ConsolePersistence
import Foundation

final class SessionRepository: Sendable {
    private let authService: any AuthSessionRestoring
    private let workspaceRepository: any WorkspaceRepositoryProtocol
    private let clock: AuthorizationClock
    private let now: @Sendable () -> Date
    private let systemUptime: @Sendable () -> TimeInterval

    init(
        authService: any AuthSessionRestoring,
        workspaceRepository: any WorkspaceRepositoryProtocol,
        clock: AuthorizationClock = AuthorizationClock(),
        now: @escaping @Sendable () -> Date = { Date() },
        systemUptime: @escaping @Sendable () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }
    ) {
        self.authService = authService
        self.workspaceRepository = workspaceRepository
        self.clock = clock
        self.now = now
        self.systemUptime = systemUptime
    }

    func restore() async -> SessionAvailability {
        let restoreResult = await authService.restoreSession()

        switch restoreResult {
        case .authenticated(let user):
            return .onlineVerified(user: user)

        case .noSession:
            return .reauthenticationRequired(reason: .noSession)

        case .unauthorized:
            return .reauthenticationRequired(reason: .unauthorized)

        case .unavailable:
            let snapshot = try? await workspaceRepository.loadAnyUnlocked()
            guard let snapshot else {
                return .reauthenticationRequired(reason: .authorizationExpired)
            }
            guard clock.isValid(snapshot: snapshot, now: now(), systemUptime: systemUptime()) else {
                return .reauthenticationRequired(reason: .authorizationExpired)
            }
            return .offlineAuthorized(expiresAt: snapshot.expiresAt)
        }
    }
}
