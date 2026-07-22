import Foundation
import GRDB

public final class RecordDatabase: Sendable {
    public let reader: DatabaseReader
    public let writer: DatabaseWriter

    public init(_ writer: DatabaseWriter, skipMigration: Bool = false) throws {
        self.writer = writer
        self.reader = writer
        if !skipMigration {
            try Self.migrator.migrate(writer)
        }
    }

    public static func inMemory() throws -> RecordDatabase {
        let queue = try DatabaseQueue(configuration: Self.configuration)
        try Self.migrator.migrate(queue)
        return try RecordDatabase(queue, skipMigration: true)
    }

    public static func at(_ url: URL) throws -> RecordDatabase {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let pool = try DatabasePool(path: url.path, configuration: fileConfiguration)
        return try RecordDatabase(pool)
    }

    public static let migrator: DatabaseMigrator = {
        var migrator = DatabaseMigrator()
        migrator.registerMigration("record-ledger-v1") { db in
            try db.create(table: "queued_records") { t in
                t.column("local_id", .text).primaryKey()
                t.column("owner_user_id", .text).notNull()
                t.column("organization_id", .text).notNull()
                t.column("project_id", .text).notNull()
                t.column("schema_version_id", .text).notNull()
                t.column("record_type_key", .text).notNull()
                t.column("field_values_json", .text).notNull()
                t.column("state", .text).notNull().defaults(to: RecordState.pending.rawValue)
                t.column("automatic_attempt_count", .integer).notNull().defaults(to: 0)
                t.column("next_attempt_at", .datetime)
                t.column("last_error_classification", .text)
                t.column("last_error_code", .text)
                t.column("last_error_safe_message", .text)
                t.column("server_record_id", .text)
                t.column("acknowledged_at", .datetime)
                t.column("discarded_at", .datetime)
                t.column("created_at", .datetime).notNull()
                t.column("updated_at", .datetime).notNull()
            }

            try db.create(table: "media_attachments") { t in
                t.autoIncrementedPrimaryKey("id")
                t.column("record_local_id", .text).notNull()
                t.column("placement", .text).notNull()
                t.column("ordinal", .integer).notNull()
                t.column("relative_path", .text).notNull()
                t.column("sha256", .text).notNull()
                t.column("mime_type", .text).notNull()
                t.column("pixel_width", .integer)
                t.column("pixel_height", .integer)
                t.column("byte_count", .integer).notNull()
                t.column("created_at", .datetime).notNull()
                t.foreignKey(["record_local_id"], references: "queued_records", columns: ["local_id"], onDelete: .cascade)
            }

            try db.create(table: "queue_migrations") { t in
                t.column("name", .text).primaryKey()
                t.column("executed_at", .datetime).notNull()
                t.column("source_sha256", .text)
                t.column("imported_count", .integer)
            }

            try db.create(index: "idx_queued_records_owner_state", on: "queued_records", columns: ["owner_user_id", "organization_id", "state", "next_attempt_at"])
            try db.create(index: "idx_media_attachments_record", on: "media_attachments", columns: ["record_local_id", "placement", "ordinal"])
        }
        migrator.registerMigration("workspace-v2") { db in
            try db.create(table: "workspace_snapshots") { t in
                t.column("owner_user_id", .text).notNull()
                t.column("organization_id", .text).notNull()
                t.column("role", .text).notNull()
                t.column("verified_at", .datetime).notNull()
                t.column("expires_at", .datetime).notNull()
                t.column("verified_system_uptime", .double).notNull()
                t.column("organization_json", .blob).notNull()
                t.column("projects_json", .blob).notNull()
                t.column("published_schemas_json", .blob).notNull()
                t.column("locale", .text).notNull()
                t.column("is_locked", .boolean).notNull().defaults(to: false)
                t.primaryKey(["owner_user_id", "organization_id"])
            }

            try db.create(table: "role_surface_caches") { t in
                t.column("surface", .text).notNull()
                t.column("owner_user_id", .text).notNull()
                t.column("organization_id", .text).notNull()
                t.column("payload", .blob).notNull()
                t.column("fetched_at", .datetime).notNull()
                t.column("byte_count", .integer).notNull()
                t.primaryKey(["surface", "owner_user_id", "organization_id"])
            }

            try db.create(index: "idx_role_surface_caches_owner", on: "role_surface_caches", columns: ["owner_user_id", "organization_id", "fetched_at"])
        }
        return migrator
    }()

    public static let configuration: Configuration = {
        var config = Configuration()
        config.busyMode = .timeout(5.0)
        config.journalMode = .wal
        return config
    }()

    public static var fileConfiguration: Configuration {
        var config = configuration
        config.prepareDatabase { db in
            try db.execute(sql: "PRAGMA journal_mode=WAL")
        }
        return config
    }
}
