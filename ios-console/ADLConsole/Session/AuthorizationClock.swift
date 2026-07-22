import ConsolePersistence
import Foundation

enum ReauthenticationReason: Equatable, Sendable {
    case noSession
    case unauthorized
    case authorizationExpired
    case identityMismatch
    case membershipRevoked
}

enum SessionAvailability: Equatable, Sendable {
    case restoring
    case onlineVerified(user: AuthSessionUser)
    case offlineAuthorized(expiresAt: Date)
    case reauthenticationRequired(reason: ReauthenticationReason)
    case signedOut
}

struct AuthorizationClock: Sendable {
    static let window: TimeInterval = 72 * 60 * 60

    init() {}

    func isValid(snapshot: WorkspaceSnapshot, now: Date, systemUptime: TimeInterval) -> Bool {
        let wallElapsed = max(0, now.timeIntervalSince(snapshot.verifiedAt))
        let monotonicElapsed = systemUptime >= snapshot.verifiedSystemUptime
            ? systemUptime - snapshot.verifiedSystemUptime
            : wallElapsed
        return max(wallElapsed, monotonicElapsed) <= Self.window && now <= snapshot.expiresAt
    }
}
