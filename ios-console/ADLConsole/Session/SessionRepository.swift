import ConsolePersistence
import Foundation

struct SessionIdentity: Codable, Equatable, Sendable {
    let ownerUserID: String
    let organizationID: String
}

protocol SessionIdentityStoreProtocol: Sendable {
    func load() -> SessionIdentity?
    func save(_ identity: SessionIdentity)
    func clear()
}

final class UserDefaultsSessionIdentityStore: SessionIdentityStoreProtocol, @unchecked Sendable {
    private let defaults: UserDefaults
    private let key: String
    private let lock = NSLock()

    init(defaults: UserDefaults = .standard, key: String = "adl-console.last-session-identity") {
        self.defaults = defaults
        self.key = key
    }

    func load() -> SessionIdentity? {
        lock.withLock {
            guard let data = defaults.data(forKey: key) else { return nil }
            return try? JSONDecoder().decode(SessionIdentity.self, from: data)
        }
    }

    func save(_ identity: SessionIdentity) {
        lock.withLock { defaults.set(try? JSONEncoder().encode(identity), forKey: key) }
    }

    func clear() { lock.withLock { defaults.removeObject(forKey: key) } }
}

final class InMemorySessionIdentityStore: SessionIdentityStoreProtocol, @unchecked Sendable {
    private let lock = NSLock()
    private var identity: SessionIdentity?

    init(identity: SessionIdentity? = nil) { self.identity = identity }
    func load() -> SessionIdentity? { lock.withLock { identity } }
    func save(_ identity: SessionIdentity) { lock.withLock { self.identity = identity } }
    func clear() { lock.withLock { identity = nil } }
}

final class SessionRepository: Sendable {
    private let authService: any AuthSessionRestoring
    private let workspaceRepository: any WorkspaceRepositoryProtocol
    private let clock: AuthorizationClock
    private let identityStore: any SessionIdentityStoreProtocol
    private let now: @Sendable () -> Date
    private let systemUptime: @Sendable () -> TimeInterval

    init(
        authService: any AuthSessionRestoring,
        workspaceRepository: any WorkspaceRepositoryProtocol,
        clock: AuthorizationClock = AuthorizationClock(),
        identityStore: any SessionIdentityStoreProtocol = InMemorySessionIdentityStore(),
        now: @escaping @Sendable () -> Date = { Date() },
        systemUptime: @escaping @Sendable () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }
    ) {
        self.authService = authService
        self.workspaceRepository = workspaceRepository
        self.clock = clock
        self.identityStore = identityStore
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

        case .unavailable(let unavailable):
            if case .server(let status) = unavailable, !(500..<600).contains(status) {
                return .reauthenticationRequired(reason: .unauthorized)
            }
            guard let identity = identityStore.load() else {
                return .reauthenticationRequired(reason: .identityMismatch)
            }
            let snapshot = try? await workspaceRepository.loadUnlocked(
                ownerUserID: identity.ownerUserID,
                organizationID: identity.organizationID
            )
            guard let snapshot else {
                return .reauthenticationRequired(reason: .authorizationExpired)
            }
            guard clock.isValid(snapshot: snapshot, now: now(), systemUptime: systemUptime()) else {
                return .reauthenticationRequired(reason: .authorizationExpired)
            }
            return .offlineAuthorized(snapshot: snapshot)
        }
    }

    func selectIdentity(ownerUserID: String, organizationID: String) {
        identityStore.save(SessionIdentity(ownerUserID: ownerUserID, organizationID: organizationID))
    }

    func signOut(ownerUserID: String?) async {
        if let localClearing = authService as? AuthLocalSessionClearing {
            localClearing.clearLocalSession()
        }
        if let ownerUserID {
            try? await workspaceRepository.lock(ownerUserID: ownerUserID)
        }
        identityStore.clear()
        if let signingOut = authService as? AuthSigningOut {
            try? await signingOut.signOut()
        }
    }
}
