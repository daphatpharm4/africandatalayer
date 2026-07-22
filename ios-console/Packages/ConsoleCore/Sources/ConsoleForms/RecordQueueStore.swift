import Foundation

/// Persistence seam for `RecordQueue` — mirrors the role IndexedDB plays for
/// `lib/client/offlineQueue.ts`, abstracted behind a protocol so
/// `RecordQueueTests` can run entirely in memory (no filesystem, no
/// `UserDefaults`) while the app wires a durable implementation. The whole
/// queue is read/written as one array, same granularity as the web queue's
/// "list all items" IndexedDB access pattern — there is no per-item CRUD at
/// this layer, `RecordQueue` owns all mutation logic and just persists its
/// resulting state.
public protocol RecordQueueStore: Sendable {
    func load() throws -> [RecordQueueItem]
    func save(_ items: [RecordQueueItem]) throws
}

public protocol LegacyQueueArchivingStore: RecordQueueStore {
    func archiveAfterMigration() throws
}

/// Test/preview double — holds the queue in memory for the lifetime of the
/// process. Thread-safe via a simple lock since `RecordQueue` (an actor)
/// already serializes access to its store, but this makes the type safe to
/// use even if a caller reaches in directly during tests.
public final class InMemoryRecordQueueStore: RecordQueueStore, @unchecked Sendable {
    private var items: [RecordQueueItem]
    private let lock = NSLock()

    public init(initial: [RecordQueueItem] = []) {
        self.items = initial
    }

    public func load() throws -> [RecordQueueItem] {
        lock.lock()
        defer { lock.unlock() }
        return items
    }

    public func save(_ items: [RecordQueueItem]) throws {
        lock.lock()
        defer { lock.unlock() }
        self.items = items
    }
}

/// Production store: the queue serialized as one JSON array at a file URL —
/// the app points this at a file inside its app-support/caches directory so
/// queued drafts (including any not-yet-uploaded photo refs) survive a
/// relaunch, same durability guarantee IndexedDB gives the web queue.
public final class FileRecordQueueStore: LegacyQueueArchivingStore, @unchecked Sendable {
    private let fileURL: URL
    private let lock = NSLock()

    public init(fileURL: URL) {
        self.fileURL = fileURL
    }

    public func load() throws -> [RecordQueueItem] {
        lock.lock()
        defer { lock.unlock() }
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return [] }
        let data = try Data(contentsOf: fileURL)
        guard !data.isEmpty else { return [] }
        return try Self.decoder.decode([RecordQueueItem].self, from: data)
    }

    public func save(_ items: [RecordQueueItem]) throws {
        lock.lock()
        defer { lock.unlock() }
        let data = try Self.encoder.encode(items)
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: fileURL, options: .atomic)
    }

    public func archiveAfterMigration() throws {
        lock.lock()
        defer { lock.unlock() }
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        var backupURL = fileURL.appendingPathExtension("migrated-backup")
        if FileManager.default.fileExists(atPath: backupURL.path) {
            backupURL = fileURL.appendingPathExtension("migrated-backup-\(Int(Date().timeIntervalSince1970))")
        }
        try FileManager.default.moveItem(at: fileURL, to: backupURL)
    }

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

/// Production store alternative: the queue serialized as one JSON blob under
/// a single `UserDefaults` key — an option for callers that would rather not
/// manage a file (e.g. to piggy-back on an existing `UserDefaults(suiteName:)`
/// app-group container). Functionally identical to `FileRecordQueueStore`.
public final class UserDefaultsRecordQueueStore: RecordQueueStore, @unchecked Sendable {
    private let defaults: UserDefaults
    private let key: String
    private let lock = NSLock()

    public init(defaults: UserDefaults = .standard, key: String = "adl_console_record_queue") {
        self.defaults = defaults
        self.key = key
    }

    public func load() throws -> [RecordQueueItem] {
        lock.lock()
        defer { lock.unlock() }
        guard let data = defaults.data(forKey: key), !data.isEmpty else { return [] }
        return try Self.decoder.decode([RecordQueueItem].self, from: data)
    }

    public func save(_ items: [RecordQueueItem]) throws {
        lock.lock()
        defer { lock.unlock() }
        let data = try Self.encoder.encode(items)
        defaults.set(data, forKey: key)
    }

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}
