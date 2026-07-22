import ConsoleAPI
import ConsoleModels
import Foundation

struct CachedProjectOption: Codable, Equatable, Sendable {
    var project: PlatformProject
    var schemaVersion: PlatformSchemaVersion
}

protocol ConsoleOfflineCacheProtocol: Sendable {
    func loadOrganizations() throws -> [PlatformOrganizationMembership]
    func saveOrganizations(_ memberships: [PlatformOrganizationMembership]) throws
    func loadProjectOptions(organizationId: String) throws -> [CachedProjectOption]
    func saveProjectOptions(_ options: [CachedProjectOption], organizationId: String) throws
    func loadApprovedRecords(organizationId: String) throws -> [PlatformRecord]
    func saveApprovedRecords(_ records: [PlatformRecord], organizationId: String) throws
}

final class ConsoleOfflineCache: ConsoleOfflineCacheProtocol, @unchecked Sendable {
    private let directory: URL
    private let lock = NSLock()

    init(directory: URL = ConsoleOfflineCache.defaultDirectory()) {
        self.directory = directory
    }

    func loadOrganizations() throws -> [PlatformOrganizationMembership] {
        try load([PlatformOrganizationMembership].self, filename: "organizations.json") ?? []
    }

    func saveOrganizations(_ memberships: [PlatformOrganizationMembership]) throws {
        try save(memberships, filename: "organizations.json")
    }

    func loadProjectOptions(organizationId: String) throws -> [CachedProjectOption] {
        try load([CachedProjectOption].self, filename: "project-options-\(safeKey(organizationId)).json") ?? []
    }

    func saveProjectOptions(_ options: [CachedProjectOption], organizationId: String) throws {
        try save(options, filename: "project-options-\(safeKey(organizationId)).json")
    }

    func loadApprovedRecords(organizationId: String) throws -> [PlatformRecord] {
        try load([PlatformRecord].self, filename: "approved-records-\(safeKey(organizationId)).json") ?? []
    }

    func saveApprovedRecords(_ records: [PlatformRecord], organizationId: String) throws {
        try save(records, filename: "approved-records-\(safeKey(organizationId)).json")
    }

    private func load<T: Decodable>(_ type: T.Type, filename: String) throws -> T? {
        lock.lock()
        defer { lock.unlock() }
        let url = directory.appendingPathComponent(filename)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let data = try Data(contentsOf: url)
        guard !data.isEmpty else { return nil }
        return try Self.decoder.decode(type, from: data)
    }

    private func save<T: Encodable>(_ value: T, filename: String) throws {
        lock.lock()
        defer { lock.unlock() }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try Self.encoder.encode(value)
        try data.write(to: directory.appendingPathComponent(filename), options: .atomic)
    }

    private func safeKey(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        return String(value.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" })
    }

    private static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent("ADLConsoleOfflineCache", isDirectory: true)
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

final class InMemoryConsoleOfflineCache: ConsoleOfflineCacheProtocol, @unchecked Sendable {
    private var organizations: [PlatformOrganizationMembership]
    private var projectOptionsByOrganizationId: [String: [CachedProjectOption]]
    private var approvedRecordsByOrganizationId: [String: [PlatformRecord]]
    private let lock = NSLock()

    init(
        organizations: [PlatformOrganizationMembership] = [],
        projectOptionsByOrganizationId: [String: [CachedProjectOption]] = [:],
        approvedRecordsByOrganizationId: [String: [PlatformRecord]] = [:]
    ) {
        self.organizations = organizations
        self.projectOptionsByOrganizationId = projectOptionsByOrganizationId
        self.approvedRecordsByOrganizationId = approvedRecordsByOrganizationId
    }

    func loadOrganizations() throws -> [PlatformOrganizationMembership] {
        lock.withLock { organizations }
    }

    func saveOrganizations(_ memberships: [PlatformOrganizationMembership]) throws {
        lock.withLock { organizations = memberships }
    }

    func loadProjectOptions(organizationId: String) throws -> [CachedProjectOption] {
        lock.withLock { projectOptionsByOrganizationId[organizationId] ?? [] }
    }

    func saveProjectOptions(_ options: [CachedProjectOption], organizationId: String) throws {
        lock.withLock { projectOptionsByOrganizationId[organizationId] = options }
    }

    func loadApprovedRecords(organizationId: String) throws -> [PlatformRecord] {
        lock.withLock { approvedRecordsByOrganizationId[organizationId] ?? [] }
    }

    func saveApprovedRecords(_ records: [PlatformRecord], organizationId: String) throws {
        lock.withLock { approvedRecordsByOrganizationId[organizationId] = records }
    }
}
