import Foundation

/// Shared ISO 8601 date parsing and formatting used across all console screens.
/// Consolidates the 5+ duplicated `formattedDate` + `ISO8601DateFormatter` extensions
/// scattered across ReviewQueueView, ProjectsView, MembersView, DataBrowseView,
/// and CompanyPointDetailView.
enum ADLConsoleDateFormatting {
    nonisolated(unsafe) private static let fractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    nonisolated(unsafe) private static let plain: ISO8601DateFormatter = {
        ISO8601DateFormatter()
    }()

    /// Parse an ISO 8601 string (with or without fractional seconds) into a `Date`.
    static func parse(_ isoString: String) -> Date? {
        fractionalSeconds.date(from: isoString) ?? plain.date(from: isoString)
    }

    /// Format an ISO 8601 string into a medium-date, short-time localized string.
    static func mediumDateTime(_ isoString: String) -> String {
        guard let date = parse(isoString) else { return isoString }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    /// Format an ISO 8601 string into a medium-date-only localized string.
    static func mediumDate(_ isoString: String) -> String {
        guard let date = parse(isoString) else { return isoString }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}
