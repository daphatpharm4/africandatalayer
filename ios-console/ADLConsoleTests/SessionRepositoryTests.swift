@testable import ADLConsole
import ConsolePersistence
import XCTest

final class SessionRepositoryTests: XCTestCase {
    private func makeAuthService(restoreResult: AuthSessionRestoreResult) -> MockAuthService {
        let auth = MockAuthService()
        auth.restoredResult = restoreResult
        return auth
    }

    private func makeRepository(
        restore: AuthSessionRestoreResult,
        snapshot: WorkspaceSnapshot? = nil,
        now: Date = Date(timeIntervalSince1970: 0),
        systemUptime: TimeInterval = 1000
    ) async throws -> SessionRepository {
        let auth = makeAuthService(restoreResult: restore)
        let workspaceRepo = MockWorkspaceRepository()
        if let snapshot {
            try await workspaceRepo.save(snapshot)
        }
        let identityStore = InMemorySessionIdentityStore(identity: snapshot.map {
            SessionIdentity(ownerUserID: $0.ownerUserID, organizationID: $0.organizationID)
        })
        return SessionRepository(
            authService: auth,
            workspaceRepository: workspaceRepo,
            clock: AuthorizationClock(),
            identityStore: identityStore,
            now: { now },
            systemUptime: { systemUptime }
        )
    }

    func testOnlineVerifiedWhenAuthSucceeds() async throws {
        let user = AuthSessionUser(id: "u1", email: "a@b.com", role: "collector", isAdmin: false)
        let repository = try await makeRepository(restore: .authenticated(user))

        let result = await repository.restore()

        guard case .onlineVerified(let returnedUser) = result else {
            return XCTFail("Expected .onlineVerified, got \(result)")
        }
        XCTAssertEqual(returnedUser.id, "u1")
    }

    func testTransportFailureUsesUnexpiredSnapshot() async throws {
        let expiringNow = Date(timeIntervalSince1970: AuthorizationClock.window - 1)
        let repository = try await makeRepository(
            restore: .unavailable(.transport),
            snapshot: WorkspaceSnapshot.fixture(
                ownerUserID: "u1",
                organizationID: "o1",
                verifiedAt: Date(timeIntervalSince1970: 0),
                expiresAt: Date(timeIntervalSince1970: AuthorizationClock.window)
            ),
            now: expiringNow,
            systemUptime: AuthorizationClock.window - 1
        )

        let result = await repository.restore()

        guard case .offlineAuthorized(let snapshot) = result else {
            return XCTFail("Expected .offlineAuthorized, got \(result)")
        }
        XCTAssertEqual(snapshot.expiresAt.timeIntervalSince1970, AuthorizationClock.window)
    }

    func testExpiryAndClockRollbackRequireReauthentication() async throws {
        let expired = try await makeRepository(
            restore: .unavailable(.transport),
            snapshot: WorkspaceSnapshot.fixture(
                ownerUserID: "u1",
                organizationID: "o1",
                verifiedAt: Date(timeIntervalSince1970: 0),
                expiresAt: Date(timeIntervalSince1970: AuthorizationClock.window)
            ),
            now: Date(timeIntervalSince1970: AuthorizationClock.window + 1),
            systemUptime: AuthorizationClock.window + 1
        )
        let result = await expired.restore()
        XCTAssertEqual(result, .reauthenticationRequired(reason: .authorizationExpired))
    }

    func testNoSessionRequiresReauthentication() async throws {
        let repository = try await makeRepository(restore: .noSession)

        let result = await repository.restore()

        XCTAssertEqual(result, .reauthenticationRequired(reason: .noSession))
    }

    func testUnauthorizedRequiresReauthentication() async throws {
        let repository = try await makeRepository(restore: .unauthorized)

        let result = await repository.restore()

        XCTAssertEqual(result, .reauthenticationRequired(reason: .unauthorized))
    }

    func testTransportUnavailableWithoutSnapshot() async throws {
        let repository = try await makeRepository(restore: .unavailable(.transport))

        let result = await repository.restore()

        XCTAssertEqual(result, .reauthenticationRequired(reason: .identityMismatch))
    }
}

final class MockWorkspaceRepository: WorkspaceRepositoryProtocol, @unchecked Sendable {
    private var snapshots: [String: WorkspaceSnapshot] = [:]

    func save(_ snapshot: WorkspaceSnapshot) async throws {
        snapshots["\(snapshot.ownerUserID)/\(snapshot.organizationID)"] = snapshot
    }

    func load(ownerUserID: String, organizationID: String) async throws -> WorkspaceSnapshot? {
        snapshots["\(ownerUserID)/\(organizationID)"]
    }

    func loadUnlocked(ownerUserID: String, organizationID: String) async throws -> WorkspaceSnapshot? {
        snapshots["\(ownerUserID)/\(organizationID)"].flatMap { $0.isLocked ? nil : $0 }
    }

    func loadAnyUnlocked() async throws -> WorkspaceSnapshot? {
        snapshots.values.first { !$0.isLocked }
    }

    func lock(ownerUserID: String) async throws {
        for key in snapshots.keys where key.hasPrefix("\(ownerUserID)/") {
            snapshots[key] = WorkspaceSnapshot(
                ownerUserID: snapshots[key]!.ownerUserID,
                organizationID: snapshots[key]!.organizationID,
                role: snapshots[key]!.role,
                verifiedAt: snapshots[key]!.verifiedAt,
                expiresAt: snapshots[key]!.expiresAt,
                verifiedSystemUptime: snapshots[key]!.verifiedSystemUptime,
                organizationJSON: snapshots[key]!.organizationJSON,
                projectsJSON: snapshots[key]!.projectsJSON,
                publishedSchemasJSON: snapshots[key]!.publishedSchemasJSON,
                locale: snapshots[key]!.locale,
                isLocked: true
            )
        }
    }

    func unlock(ownerUserID: String, organizationID: String) async throws -> Bool {
        guard let existing = snapshots["\(ownerUserID)/\(organizationID)"] else { return false }
        snapshots["\(ownerUserID)/\(organizationID)"] = WorkspaceSnapshot(
            ownerUserID: existing.ownerUserID,
            organizationID: existing.organizationID,
            role: existing.role,
            verifiedAt: existing.verifiedAt,
            expiresAt: existing.expiresAt,
            verifiedSystemUptime: existing.verifiedSystemUptime,
            organizationJSON: existing.organizationJSON,
            projectsJSON: existing.projectsJSON,
            publishedSchemasJSON: existing.publishedSchemasJSON,
            locale: existing.locale,
            isLocked: false
        )
        return true
    }

    func saveRoleSurface(_ surface: String, payload: Data, ownerUserID: String, organizationID: String) async throws {}

    func loadRoleSurface(_ surface: String, ownerUserID: String, organizationID: String) async throws -> Data? { nil }
}
