import Foundation

enum FailurePoint: String, CaseIterable, Sendable {
    case afterMediaWrite
    case afterLedgerCommit
    case duringSend
    case afterResponse
    case beforeAcknowledgement
    case diskFull
    case unreadableMedia
    case checksumMismatch
    case migrationInterrupted
    case clockRollback
}
