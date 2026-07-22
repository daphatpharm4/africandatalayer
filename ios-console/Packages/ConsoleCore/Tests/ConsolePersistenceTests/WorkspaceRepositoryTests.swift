import ConsoleModels
import GRDB
import XCTest
@testable import ConsolePersistence

final class WorkspaceRepositoryTests: XCTestCase {
    func testSnapshotIsScopedByOwnerAndOrganization() async throws {
        let repository = try WorkspaceRepository(database: .inMemory())
        try await repository.save(WorkspaceSnapshot.fixture(ownerUserID: "u1", organizationID: "o1"))
        let loaded = try await repository.load(ownerUserID: "u1", organizationID: "o1")
        XCTAssertNotNil(loaded)
        let otherUser = try await repository.load(ownerUserID: "u2", organizationID: "o1")
        XCTAssertNil(otherUser)
        let otherOrg = try await repository.load(ownerUserID: "u1", organizationID: "o2")
        XCTAssertNil(otherOrg)
    }

    func testLockHidesWorkspaceUntilSameIdentityUnlocks() async throws {
        let repository = try WorkspaceRepository(database: .inMemory())
        try await repository.save(WorkspaceSnapshot.fixture(ownerUserID: "u1", organizationID: "o1"))
        try await repository.lock(ownerUserID: "u1")
        let afterLock = try await repository.loadUnlocked(ownerUserID: "u1", organizationID: "o1")
        XCTAssertNil(afterLock)
        let wrongUnlock = try await repository.unlock(ownerUserID: "u2", organizationID: "o1")
        XCTAssertFalse(wrongUnlock)
        let correctUnlock = try await repository.unlock(ownerUserID: "u1", organizationID: "o1")
        XCTAssertTrue(correctUnlock)
    }

    func testSaveOverwritesExistingSnapshot() async throws {
        let repository = try WorkspaceRepository(database: .inMemory())
        try await repository.save(WorkspaceSnapshot.fixture(ownerUserID: "u1", organizationID: "o1", locale: "en"))
        try await repository.save(WorkspaceSnapshot.fixture(ownerUserID: "u1", organizationID: "o1", locale: "fr"))
        let loaded = try await repository.load(ownerUserID: "u1", organizationID: "o1")
        XCTAssertEqual(loaded?.locale, "fr")
    }

    func testLoadUnlockedReturnsNilWhenNoSnapshot() async throws {
        let repository = try WorkspaceRepository(database: .inMemory())
        let result = try await repository.loadUnlocked(ownerUserID: "u1", organizationID: "o1")
        XCTAssertNil(result)
    }

    func testLockIsIdempotent() async throws {
        let repository = try WorkspaceRepository(database: .inMemory())
        try await repository.save(WorkspaceSnapshot.fixture(ownerUserID: "u1", organizationID: "o1"))
        try await repository.lock(ownerUserID: "u1")
        try await repository.lock(ownerUserID: "u1")
        let result = try await repository.loadUnlocked(ownerUserID: "u1", organizationID: "o1")
        XCTAssertNil(result)
    }

    func testUnlockReturnsFalseWhenNoSnapshot() async throws {
        let repository = try WorkspaceRepository(database: .inMemory())
        let result = try await repository.unlock(ownerUserID: "u1", organizationID: "o1")
        XCTAssertFalse(result)
    }

    func testRoleSurfaceCacheRoundTrip() async throws {
        let repository = try WorkspaceRepository(database: .inMemory())
        try await repository.saveRoleSurface("review", payload: Data("review-html".utf8), ownerUserID: "u1", organizationID: "o1")
        let payload = try await repository.loadRoleSurface("review", ownerUserID: "u1", organizationID: "o1")
        XCTAssertEqual(payload, Data("review-html".utf8))
    }

    func testRoleSurfaceCacheIsScoped() async throws {
        let repository = try WorkspaceRepository(database: .inMemory())
        try await repository.saveRoleSurface("review", payload: Data("review-html".utf8), ownerUserID: "u1", organizationID: "o1")
        let otherUser = try await repository.loadRoleSurface("review", ownerUserID: "u2", organizationID: "o1")
        XCTAssertNil(otherUser)
        let wrongSurface = try await repository.loadRoleSurface("overview", ownerUserID: "u1", organizationID: "o1")
        XCTAssertNil(wrongSurface)
    }
}
