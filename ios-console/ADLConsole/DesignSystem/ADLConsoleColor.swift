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

private func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
    Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(hex: dark)
            : UIColor(hex: light)
    })
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

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

    static let gold = Color(hex: 0xf4c317)
    static let goldDark = dynamic(0xb45309, 0xf4c317)
    static let goldWash = dynamic(0xfef9e7, 0x1f1a08)

    static let danger = Color(hex: 0xb91c1c)
    static let dangerWash = dynamic(0xfef2f2, 0x1f0c0c)

    static let ink = dynamic(0x0f1f2e, 0xe8edf2)
    static let inkMuted = dynamic(0x5b6b7a, 0x8b9bab)
    static let page = dynamic(0xf7f9fb, 0x0a0f14)

    static let surface = dynamic(0xfdfefe, 0x111820)
    static let surfaceElevated = dynamic(0xffffff, 0x161e28)
}
