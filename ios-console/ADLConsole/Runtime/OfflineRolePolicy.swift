import ConsoleModels
import Foundation

enum OfflineCapability: Sendable {
    case createLocalRecord, inspectPendingRecord, exportPendingRecord, discardPendingRecord
    case inspectCachedReview, reviewMutation
    case inspectCachedAdministration, administrationMutation
}

struct OfflineRolePolicy: Sendable {
    func allows(_ capability: OfflineCapability, role: PlatformRole, session: SessionAvailability) -> Bool {
        switch session {
        case .onlineVerified:
            return true

        case .offlineAuthorized:
            switch role {
            case .collector:
                switch capability {
                case .createLocalRecord, .inspectPendingRecord, .exportPendingRecord, .discardPendingRecord:
                    return true
                default:
                    return false
                }
            case .reviewer:
                switch capability {
                case .inspectCachedReview:
                    return true
                default:
                    return false
                }
            case .manager, .owner:
                switch capability {
                case .inspectCachedAdministration:
                    return true
                default:
                    return false
                }
            case .viewer:
                return false
            }

        case .reauthenticationRequired:
            switch capability {
            case .exportPendingRecord:
                return true
            default:
                return false
            }

        case .restoring, .signedOut:
            return false
        }
    }
}
