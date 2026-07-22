import ConsoleModels
import Foundation
import GRDB

public protocol WorkspaceRepositoryProtocol: Sendable {
    func save(_ snapshot: WorkspaceSnapshot) async throws
    func load(ownerUserID: String, organizationID: String) async throws -> WorkspaceSnapshot?
    func loadUnlocked(ownerUserID: String, organizationID: String) async throws -> WorkspaceSnapshot?
    func loadAnyUnlocked() async throws -> WorkspaceSnapshot?
    func lock(ownerUserID: String) async throws
    func unlock(ownerUserID: String, organizationID: String) async throws -> Bool
    func saveRoleSurface(_ surface: String, payload: Data, ownerUserID: String, organizationID: String) async throws
    func loadRoleSurface(_ surface: String, ownerUserID: String, organizationID: String) async throws -> Data?
}

public final class WorkspaceRepository: WorkspaceRepositoryProtocol {
    private let database: RecordDatabase

    public init(database: RecordDatabase) {
        self.database = database
    }

    public static func inMemory() throws -> WorkspaceRepository {
        WorkspaceRepository(database: try RecordDatabase.inMemory())
    }

    public func save(_ snapshot: WorkspaceSnapshot) async throws {
        try await database.writer.write { db in
            try db.execute(
                sql: """
                INSERT OR REPLACE INTO workspace_snapshots
                (owner_user_id, organization_id, role, verified_at, expires_at,
                 verified_system_uptime, organization_json, projects_json,
                 published_schemas_json, locale, is_locked)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [
                    snapshot.ownerUserID, snapshot.organizationID, snapshot.role.rawValue,
                    snapshot.verifiedAt, snapshot.expiresAt, snapshot.verifiedSystemUptime,
                    snapshot.organizationJSON, snapshot.projectsJSON,
                    snapshot.publishedSchemasJSON, snapshot.locale, snapshot.isLocked,
                ]
            )
        }
    }

    public func load(ownerUserID: String, organizationID: String) async throws -> WorkspaceSnapshot? {
        try database.reader.read { db in
            try Row.fetchOne(db, sql: """
                SELECT * FROM workspace_snapshots
                WHERE owner_user_id = ? AND organization_id = ?
                """, arguments: [ownerUserID, organizationID])
        }.map(Self.rowToSnapshot)
    }

    public func loadUnlocked(ownerUserID: String, organizationID: String) async throws -> WorkspaceSnapshot? {
        try database.reader.read { db in
            try Row.fetchOne(db, sql: """
                SELECT * FROM workspace_snapshots
                WHERE owner_user_id = ? AND organization_id = ? AND is_locked = 0
                """, arguments: [ownerUserID, organizationID])
        }.map(Self.rowToSnapshot)
    }

    public func loadAnyUnlocked() async throws -> WorkspaceSnapshot? {
        try database.reader.read { db in
            try Row.fetchOne(db, sql: """
                SELECT * FROM workspace_snapshots WHERE is_locked = 0
                """)
        }.map(Self.rowToSnapshot)
    }

    public func lock(ownerUserID: String) async throws {
        try await database.writer.write { db in
            try db.execute(sql: """
                UPDATE workspace_snapshots SET is_locked = 1
                WHERE owner_user_id = ?
                """, arguments: [ownerUserID])
        }
    }

    public func unlock(ownerUserID: String, organizationID: String) async throws -> Bool {
        try await database.writer.write { db in
            try db.execute(sql: """
                UPDATE workspace_snapshots SET is_locked = 0
                WHERE owner_user_id = ? AND organization_id = ?
                """, arguments: [ownerUserID, organizationID])
            return db.changesCount > 0
        }
    }

    public func saveRoleSurface(_ surface: String, payload: Data, ownerUserID: String, organizationID: String) async throws {
        try await database.writer.write { db in
            try db.execute(
                sql: """
                INSERT OR REPLACE INTO role_surface_caches
                (surface, owner_user_id, organization_id, payload, fetched_at, byte_count)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                arguments: [surface, ownerUserID, organizationID, payload, Date(), payload.count]
            )
        }
    }

    public func loadRoleSurface(_ surface: String, ownerUserID: String, organizationID: String) async throws -> Data? {
        try database.reader.read { db in
            try Row.fetchOne(db, sql: """
                SELECT payload FROM role_surface_caches
                WHERE surface = ? AND owner_user_id = ? AND organization_id = ?
                """, arguments: [surface, ownerUserID, organizationID])
        }.map { $0["payload"] as Data }
    }

    private static func rowToSnapshot(_ row: Row) -> WorkspaceSnapshot {
        WorkspaceSnapshot(
            ownerUserID: row["owner_user_id"],
            organizationID: row["organization_id"],
            role: PlatformRole(rawValue: row["role"]) ?? .viewer,
            verifiedAt: row["verified_at"],
            expiresAt: row["expires_at"],
            verifiedSystemUptime: row["verified_system_uptime"],
            organizationJSON: row["organization_json"],
            projectsJSON: row["projects_json"],
            publishedSchemasJSON: row["published_schemas_json"],
            locale: row["locale"],
            isLocked: row["is_locked"]
        )
    }
}
