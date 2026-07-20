import SwiftUI

// MARK: - Brand color tokens
//
// Values COPIED from `ios/App/App/Native/ADLDesignSystem.swift` /
// `tailwind.config.js` per the task-4 brief (read-only reference; this app
// target has no dependency on `ios/`). Console register is clinical/premium
// per CLAUDE.md — no gamification colors (streak purple, etc.) are ported.

extension Color {
    /// Hex like 0x0f2b46 — mirrors web hex tokens exactly.
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// Exact mirror of the brand tokens in `tailwind.config.js` used by the
/// company console surfaces (navy authority, terra accent, forest success,
/// gold achievement).
enum ADLConsoleColor {
    static let navy = Color(hex: 0x0f2b46)        // navy.DEFAULT
    static let navyDark = Color(hex: 0x0b2236)    // navy.dark
    static let navyMid = Color(hex: 0x1d4565)     // navy.mid
    static let navyWash = Color(hex: 0xf2f6fa)    // navy.wash
    static let navyBorder = Color(hex: 0xd5e1eb)  // navy.border

    static let terra = Color(hex: 0xc86b4a)       // terra.DEFAULT
    static let terraDark = Color(hex: 0xb85f3f)   // terra.dark
    static let terraWash = Color(hex: 0xfff8f4)   // terra.wash

    static let forest = Color(hex: 0x4c7c59)      // forest.DEFAULT
    static let forestDark = Color(hex: 0x3a6145)  // forest.dark
    static let forestWash = Color(hex: 0xeaf3ee)  // forest.wash

    static let gold = Color(hex: 0xf4c317)        // gold.DEFAULT
    static let goldWash = Color(hex: 0xfef9e7)    // gold.wash

    static let danger = Color(hex: 0xb91c1c)
    static let dangerWash = Color(hex: 0xfef2f2)

    static let ink = Color(hex: 0x0f1f2e)
    static let inkMuted = Color(hex: 0x5b6b7a)
    static let page = Color(hex: 0xf7f9fb)
}
