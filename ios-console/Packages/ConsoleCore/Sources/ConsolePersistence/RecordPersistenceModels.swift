import Foundation

public enum RecordState: String, Codable, CaseIterable, Sendable {
    case pending, sending, retryScheduled
    case blockedAuthentication, blockedAuthorization, blockedValidation, blockedStorage
    case acknowledged, discarded
}

public extension RecordState {
    var isRecoverable: Bool {
        switch self {
        case .pending, .sending, .retryScheduled, .blockedAuthentication, .blockedAuthorization, .blockedValidation, .blockedStorage: true
        case .acknowledged, .discarded: false
        }
    }
}

public enum RecordErrorClass: String, Codable, Sendable {
    case network, server, authentication, authorization, validation, storage, unknown
}

public struct LedgerError: Codable, Equatable, Sendable {
    public let classification: RecordErrorClass
    public let code: String
    public let safeMessage: String

    public init(_ classification: RecordErrorClass, code: String, safeMessage: String) {
        self.classification = classification
        self.code = code
        self.safeMessage = safeMessage
    }
}

public struct RecordLedgerSnapshot: Equatable, Sendable {
    public let pending: Int
    public let sending: Int
    public let retrying: Int
    public let blocked: Int
    public let acknowledgedThisSession: Int

    public init(pending: Int, sending: Int, retrying: Int, blocked: Int, acknowledgedThisSession: Int) {
        self.pending = pending
        self.sending = sending
        self.retrying = retrying
        self.blocked = blocked
        self.acknowledgedThisSession = acknowledgedThisSession
    }
}
