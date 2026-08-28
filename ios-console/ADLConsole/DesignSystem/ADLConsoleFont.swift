import SwiftUI

/// Type ramp for the console. Uses the system font (San Francisco) rather
/// than bundling Inter — the console register is clinical/premium and reads
/// fine on the system face; Inter can be added in a later task if a pixel
/// match to the marketing surfaces becomes a requirement.
///
/// Every token is anchored to a semantic text style so the whole ramp
/// scales with the user's Dynamic Type setting (nominal size at the
/// default setting noted per token). Screens with layouts that cannot
/// absorb the largest accessibility sizes cap themselves with
/// `.dynamicTypeSize(...)` at the container level rather than opting the
/// ramp out of scaling.
enum ADLConsoleFont {
    static let largeTitle = Font.system(.title, weight: .bold)          // 28pt at default
    static let title = Font.system(.title2, weight: .bold)              // 22pt
    static let title2 = Font.system(.body, weight: .semibold)           // 17pt
    static let headline = Font.system(.callout, weight: .semibold)      // 16pt
    static let body = Font.system(.subheadline, weight: .regular)       // 15pt
    static let callout = Font.system(.footnote, weight: .regular)       // 13pt
    static let subheadline = Font.system(.footnote, weight: .medium)    // 13pt, medium
    static let footnote = Font.system(.footnote, weight: .regular)      // 13pt
    static let caption = Font.system(.caption, weight: .regular)        // 12pt
    static let microLabel = Font.system(.caption2, weight: .bold)       // 11pt
}
