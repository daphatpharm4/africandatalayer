import SwiftUI
import UIKit

extension Color {
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
///
/// Surface tokens add warmth — pure `Color.white` feels clinical;
/// a barely-tinted surface reads as premium and intentional.
enum ADLConsoleColor {
    static let navy = Color(hex: 0x0f2b46)
    static let navyDark = Color(hex: 0x0b2236)
    static let navyMid = Color(hex: 0x1d4565)
    static let navyWash = dynamic(0xf2f6fa, 0x0d1b2a)
    static let navyBorder = dynamic(0xd5e1eb, 0x1a3048)

    static let terra = Color(hex: 0xc86b4a)
    static let terraDark = Color(hex: 0xb85f3f)
    static let terraWash = dynamic(0xfff8f4, 0x1f1210)

    static let forest = Color(hex: 0x4c7c59)
    static let forestDark = Color(hex: 0x3a6145)
    static let forestWash = dynamic(0xeaf3ee, 0x0f1f14)

    static let gold = Color(hex: 0xf4c317)        // gold.DEFAULT
    static let goldDark = Color(hex: 0xb45309)    // gold.dark (text on goldWash)
    static let goldWash = Color(hex: 0xfef9e7)    // gold.wash

    static let danger = Color(hex: 0xb91c1c)
    static let dangerWash = dynamic(0xfef2f2, 0x1f0c0c)

    static let ink = Color(hex: 0x0f1f2e)
    static let inkMuted = Color(hex: 0x5b6b7a)
    static let page = Color(hex: 0xf7f9fb)

    // MARK: - Surface tokens (warm white alternatives)
    /// Card/surface background — barely warm off-white. Replaces raw Color.white.
    static let surface = Color(hex: 0xfdfefe)
    /// Elevated surface (hero cards, modals) — slightly more warm.
    static let surfaceElevated = Color(hex: 0xffffff)
}
