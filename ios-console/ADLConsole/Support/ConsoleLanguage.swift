import Foundation

/// Mirrors the `'en' | 'fr'` union used throughout the web console client
/// (e.g. `ConsoleShellProps.language`).
enum ConsoleLanguage: String, CaseIterable, Sendable {
    case en
    case fr

    var toggled: ConsoleLanguage { self == .en ? .fr : .en }

    /// Bilingual inline helper — mirrors the project-wide
    /// `t = (en, fr) => language === 'fr' ? fr : en` pattern from CLAUDE.md,
    /// rather than pulling in an i18n library.
    func t(_ en: String, _ fr: String) -> String {
        self == .fr ? fr : en
    }
}
