import SwiftUI

/// Type ramp for the console. Uses the system font (San Francisco) rather
/// than bundling Inter — the console register is clinical/premium and reads
/// fine on the system face; Inter can be added in a later task if a pixel
/// match to the marketing surfaces becomes a requirement.
///
/// All sizes are fixed-point (not Dynamic Type) to maintain the precise
/// clinical hierarchy of the console UI. For accessibility, screens use
/// sufficient contrast ratios (≥4.5:1) and large enough touch targets
/// that font scaling is not the primary accommodation path.
enum ADLConsoleFont {
    static let largeTitle = Font.system(size: 28, weight: .bold)
    static let title = Font.system(size: 22, weight: .bold)
    static let title2 = Font.system(size: 18, weight: .semibold)
    static let headline = Font.system(size: 16, weight: .semibold)
    static let body = Font.system(size: 15, weight: .regular)
    static let callout = Font.system(size: 14, weight: .regular)
    static let subheadline = Font.system(size: 14, weight: .medium)
    static let footnote = Font.system(size: 13, weight: .regular)
    static let caption = Font.system(size: 12, weight: .regular)
    static let microLabel = Font.system(size: 11, weight: .bold)
}
