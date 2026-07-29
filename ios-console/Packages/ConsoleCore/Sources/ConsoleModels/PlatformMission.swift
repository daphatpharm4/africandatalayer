import Foundation

public enum MissionPeriod: String, Codable, CaseIterable, Sendable, Equatable {
    case daily
    case weekly
}

public enum MissionState: String, Codable, CaseIterable, Sendable, Equatable {
    case pending
    case inProgress = "in_progress"
    case completed
    case expired
}

public struct PlatformMission: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var organizationId: String
    public var period: MissionPeriod
    public var state: MissionState
    public var titleEn: String
    public var titleFr: String
    public var quota: Int
    public var current: Int
    public var rewardXp: Int
    public var deadline: String?
    public var projectId: String?
    public var category: String?
    public var notesEn: String?
    public var notesFr: String?
    public var assignedUserIds: [String]?
    public var createdAt: String
    public var updatedAt: String

    public init(
        id: String,
        organizationId: String,
        period: MissionPeriod,
        state: MissionState,
        titleEn: String,
        titleFr: String,
        quota: Int,
        current: Int,
        rewardXp: Int,
        deadline: String?,
        projectId: String? = nil,
        category: String? = nil,
        notesEn: String? = nil,
        notesFr: String? = nil,
        assignedUserIds: [String]? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.organizationId = organizationId
        self.period = period
        self.state = state
        self.titleEn = titleEn
        self.titleFr = titleFr
        self.quota = quota
        self.current = current
        self.rewardXp = rewardXp
        self.deadline = deadline
        self.projectId = projectId
        self.category = category
        self.notesEn = notesEn
        self.notesFr = notesFr
        self.assignedUserIds = assignedUserIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var progressFraction: Double {
        guard quota > 0 else { return 1 }
        return min(max(Double(current) / Double(quota), 0), 1)
    }

    public func title(language: String) -> String {
        language == "fr" ? titleFr : titleEn
    }

    public func notes(language: String) -> String? {
        language == "fr" ? notesFr : notesEn
    }
}

public struct PlatformMissionCreateInput: Codable, Equatable, Sendable {
    public var organizationId: String
    public var titleEn: String
    public var titleFr: String
    public var quota: Int
    public var deadline: String
    public var rewardXp: Int
    public var projectId: String?
    public var category: String?
    public var notesEn: String?
    public var notesFr: String?
    public var targetUserIds: [String]

    public init(
        organizationId: String,
        titleEn: String,
        titleFr: String,
        quota: Int,
        deadline: String,
        rewardXp: Int,
        projectId: String? = nil,
        category: String? = nil,
        notesEn: String? = nil,
        notesFr: String? = nil,
        targetUserIds: [String] = []
    ) {
        self.organizationId = organizationId
        self.titleEn = titleEn
        self.titleFr = titleFr
        self.quota = quota
        self.deadline = deadline
        self.rewardXp = rewardXp
        self.projectId = projectId
        self.category = category
        self.notesEn = notesEn
        self.notesFr = notesFr
        self.targetUserIds = targetUserIds
    }
}

public struct PlatformMissionProgressEntry: Codable, Equatable, Sendable, Identifiable {
    public var userId: String
    public var current: Int
    public var state: MissionState
    public var id: String { userId }

    public init(userId: String, current: Int, state: MissionState) {
        self.userId = userId
        self.current = current
        self.state = state
    }
}
