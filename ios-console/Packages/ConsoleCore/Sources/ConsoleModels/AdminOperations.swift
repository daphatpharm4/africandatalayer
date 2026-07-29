import Foundation

public struct IpReport: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var reporterName: String
    public var reporterEmail: String
    public var reporterUser: String?
    public var targetKind: String
    public var targetRef: String?
    public var description: String
    public var sworn: Bool
    public var status: String
    public var resolutionNotes: String?
    public var createdAt: String
    public var updatedAt: String

    public init(
        id: String,
        reporterName: String,
        reporterEmail: String,
        reporterUser: String? = nil,
        targetKind: String,
        targetRef: String? = nil,
        description: String,
        sworn: Bool,
        status: String,
        resolutionNotes: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.reporterName = reporterName
        self.reporterEmail = reporterEmail
        self.reporterUser = reporterUser
        self.targetKind = targetKind
        self.targetRef = targetRef
        self.description = description
        self.sworn = sworn
        self.status = status
        self.resolutionNotes = resolutionNotes
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
