import SwiftUI

// MARK: - Typography (Inter, mirrors web font stack)

/// Inter is bundled as a variable font (`Inter-VariableFont.ttf`, family name "Inter").
/// `Font.custom(_:size:).weight(_:)` drives the `wght` axis on iOS 16+.
enum ADLFont {
    static let family = "Inter"

    static func inter(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        let textStyle: Font.TextStyle
        switch size {
        case 28...: textStyle = .largeTitle
        case 22...: textStyle = .title
        case 18...: textStyle = .title2
        case 15...: textStyle = .body
        case 13...: textStyle = .footnote
        case 12...: textStyle = .caption
        default: textStyle = .caption2
        }
        return .custom(family, size: size, relativeTo: textStyle).weight(weight)
    }

    // Scale roughly matching the web (Tailwind) type ramp.
    static var largeTitle: Font { inter(30, .bold) }   // text-3xl
    static var title: Font { inter(24, .bold) }        // text-2xl
    static var title2: Font { inter(20, .bold) }       // text-xl
    static var title3: Font { inter(18, .semibold) }   // text-lg
    static var headline: Font { inter(15, .semibold) } // btn / emphasis
    static var body: Font { inter(15, .regular) }      // text-base-ish
    static var subheadline: Font { inter(14, .semibold) }
    static var footnote: Font { inter(13, .regular) }  // text-sm
    static var caption: Font { inter(12, .medium) }    // text-xs
    static var caption2: Font { inter(11, .semibold) } // micro-label
}

extension View {
    /// Apply Inter as the cascading default font (overridden by explicit `.font` calls).
    func adlBaseFont() -> some View { self.font(ADLFont.body) }
}

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

/// Exact mirror of tailwind.config.js tokens.
enum ADLColor {
    static let navy = Color(hex: 0x0f2b46)        // navy.DEFAULT
    static let navyDark = Color(hex: 0x0b2236)    // navy.dark
    static let navyMid = Color(hex: 0x1d4565)     // navy.mid
    static let navyLight = Color(hex: 0xe7eef4)   // navy.light
    static let navyWash = Color(hex: 0xf2f6fa)    // navy.wash
    static let navyBorder = Color(hex: 0xd5e1eb)  // navy.border
    static let navySoft = Color(hex: 0x1d4565)    // alias → navy.mid

    static let terracotta = Color(hex: 0xc86b4a)  // terra.DEFAULT
    static let terraDark = Color(hex: 0xb85f3f)   // terra.dark
    static let terraWash = Color(hex: 0xfff8f4)   // terra.wash

    static let forest = Color(hex: 0x4c7c59)      // forest.DEFAULT
    static let forestDark = Color(hex: 0x3a6145)  // forest.dark
    static let forestWash = Color(hex: 0xeaf3ee)  // forest.wash

    static let gold = Color(hex: 0xf4c317)        // gold.DEFAULT
    static let goldWash = Color(hex: 0xfef9e7)    // gold.wash

    static let amber = Color(hex: 0xd97706)       // amber.DEFAULT
    static let amberWash = Color(hex: 0xfef3c7)   // amber.wash

    static let streak = Color(hex: 0x6b46c1)      // streak.DEFAULT (purple)
    static let streakWash = Color(hex: 0xf7f4ff)  // streak.wash

    static let ink = Color(hex: 0x1f2933)         // ink.DEFAULT
    static let inkMuted = Color(hex: 0x4b5563)    // ink.muted
    static let danger = Color(hex: 0xc53030)      // danger

    static let paper = Color(hex: 0xf9fafb)       // page.DEFAULT (bg)
    static let line = Color(hex: 0xf3f4f6)        // gray-100 (card border)
    static let lineStrong = Color(hex: 0xe5e7eb)  // gray-200 (ghost btn border)
}

/// Corner radii mirroring tailwind: rounded-2xl=16, rounded-[28px]=28, rounded-[14px]=14.
enum ADLRadius {
    static let card: CGFloat = 16        // rounded-2xl
    static let pill: CGFloat = 28        // rounded-[28px]
    static let statTile: CGFloat = 14    // rounded-[14px]
    static let button: CGFloat = 16      // rounded-2xl
}

extension SubmissionCategory {
    var tint: Color {
        switch self {
        case .pharmacy:
            return ADLColor.forest
        case .fuelStation:
            return ADLColor.gold
        case .mobileMoney:
            return ADLColor.navySoft
        case .alcoholOutlet:
            return ADLColor.terracotta
        case .billboard:
            return Color(red: 97 / 255, green: 73 / 255, blue: 150 / 255)
        case .transportRoad:
            return Color(red: 70 / 255, green: 87 / 255, blue: 105 / 255)
        case .censusProxy:
            return Color(red: 47 / 255, green: 122 / 255, blue: 125 / 255)
        }
    }
}

struct ADLCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous)
                    .stroke(ADLColor.line, lineWidth: 1)
            )
            // shadow-sm: 0 1px 2px rgba(0,0,0,0.05)
            .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let systemImage: String
    let tint: Color

    var body: some View {
        ADLCard {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(tint)
                    .frame(width: 36, height: 36)
                    .background(tint.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(value)
                        .font(ADLFont.inter(20, .bold))
                        .foregroundColor(ADLColor.ink)
                    Text(title)
                        .font(ADLFont.inter(13, .medium))
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

struct StatusPill: View {
    let title: String
    let tint: Color

    var body: some View {
        Text(title)
            .font(ADLFont.inter(12, .semibold))
            .foregroundColor(tint)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(tint.opacity(0.12))
            .clipShape(Capsule())
    }
}

// MARK: - Composed primitives

/// Navy gradient container used for balance / identity heroes.
struct ADLGradientHero<Content: View>: View {
    var colors: [Color]
    let content: Content

    init(colors: [Color] = [ADLColor.navy, ADLColor.navySoft], @ViewBuilder content: () -> Content) {
        self.colors = colors
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

/// Thin rounded progress track + fill.
struct ADLProgressBar: View {
    var value: Double
    var tint: Color = ADLColor.forest
    var height: CGFloat = 8
    var track: Color = ADLColor.line

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(track)
                Capsule()
                    .fill(tint)
                    .frame(width: max(0, min(1, value)) * geo.size.width)
            }
        }
        .frame(height: height)
        .accessibilityValue("\(Int((max(0, min(1, value))) * 100)) percent")
    }
}

/// Uppercase micro-label section header with optional trailing action.
struct ADLSectionHeader: View {
    let title: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(ADLFont.inter(12, .bold))
                .tracking(1.1)
                .foregroundColor(.secondary)
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(ADLFont.inter(12, .semibold))
                    .foregroundColor(ADLColor.terracotta)
            }
        }
    }
}

/// Letter-initial identity mark on a navy→terra gradient (per CLAUDE identity rule).
struct IdentityCircle: View {
    let name: String
    var size: CGFloat = 64

    private var initial: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return String(trimmed.first.map(Character.init) ?? "A").uppercased()
    }

    var body: some View {
        Text(initial)
            .font(.system(size: size * 0.42, weight: .bold))
            .foregroundColor(.white)
            .frame(width: size, height: size)
            .background(
                LinearGradient(
                    colors: [ADLColor.navy, ADLColor.terracotta],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(Circle())
            .accessibilityLabel("Profile for \(name)")
    }
}

/// Compact value + label stat block.
struct StatTile: View {
    let value: String
    let label: String
    var tint: Color = ADLColor.navy

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(ADLFont.inter(18, .bold))
                .foregroundColor(tint)
            Text(label.uppercased())
                .font(ADLFont.inter(11, .bold))
                .tracking(0.8)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: ADLRadius.statTile, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ADLRadius.statTile, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
    }
}

/// Catalog reward row with affordability state.
struct RewardCard: View {
    let reward: Reward
    let affordable: Bool
    let action: () -> Void

    private var enabled: Bool { affordable && reward.stock.isAvailable }

    var body: some View {
        ADLCard {
            HStack(spacing: 14) {
                Image(systemName: reward.category.systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(ADLColor.navy)
                    .frame(width: 44, height: 44)
                    .background(ADLColor.navy.opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(reward.name)
                        .font(ADLFont.inter(15, .semibold))
                        .foregroundColor(ADLColor.ink)
                    Text(reward.category.title)
                        .font(ADLFont.inter(11, .semibold))
                        .tracking(0.6)
                        .foregroundColor(.secondary)
                    Text(reward.stock.title)
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(stockTint)
                }

                Spacer()

                Button(action: action) {
                    Text("\(reward.costXP) XP")
                        .font(ADLFont.inter(12, .bold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                }
                .background(enabled ? ADLColor.navy : ADLColor.line)
                .foregroundColor(enabled ? .white : .secondary)
                .clipShape(Capsule())
                .disabled(!enabled)
            }
        }
    }

    private var stockTint: Color {
        switch reward.stock {
        case .inStock: return ADLColor.forest
        case .lowStock: return ADLColor.terracotta
        case .outOfStock: return .secondary
        }
    }
}

/// Square badge tile with locked/unlocked treatment.
struct BadgeTile: View {
    let badge: Badge
    let earnedTitle: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: badge.unlocked ? badge.systemImage : "lock.fill")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(badge.unlocked ? badge.tint : .secondary)
                .frame(width: 52, height: 52)
                .background((badge.unlocked ? badge.tint : ADLColor.line).opacity(0.14))
                .clipShape(Circle())

            Text(badge.title)
                .font(ADLFont.inter(12, .bold))
                .foregroundColor(ADLColor.ink)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            if badge.unlocked {
                Text(earnedTitle)
                    .font(ADLFont.inter(11, .bold))
                    .foregroundColor(ADLColor.forest)
            } else {
                ADLProgressBar(value: badge.progress, tint: ADLColor.gold, height: 5)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .padding(.horizontal, 8)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
        .opacity(badge.unlocked ? 1 : 0.85)
    }
}

/// Mission row with progress bar and reward chip.
struct MissionRow: View {
    let mission: Mission

    var body: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(mission.title)
                        .font(ADLFont.inter(15, .semibold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    StatusPill(title: "+\(mission.rewardXP) XP", tint: mission.isComplete ? ADLColor.forest : ADLColor.gold)
                }
                Text(mission.detail)
                    .font(ADLFont.inter(13))
                    .foregroundColor(.secondary)
                ADLProgressBar(value: mission.fraction, tint: mission.isComplete ? ADLColor.forest : ADLColor.navy)
                Text("\(mission.current)/\(mission.goal)")
                    .font(ADLFont.inter(11, .bold))
                    .foregroundColor(.secondary)
            }
        }
    }
}

/// Web `.btn-primary`: h-14 rounded-2xl bg-navy text-sm font-semibold shadow-sm hover:bg-navy-dark active:scale-95.
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(ADLFont.inter(15, .semibold))
            .tracking(0.15)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(configuration.isPressed ? ADLColor.navyDark : ADLColor.navy)
            .clipShape(RoundedRectangle(cornerRadius: ADLRadius.button, style: .continuous))
            .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Web `.btn-cta`: h-14 rounded-2xl bg-terra text-sm font-semibold shadow-sm hover:bg-terra-dark active:scale-95.
struct CTAButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(ADLFont.inter(15, .semibold))
            .tracking(0.15)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(configuration.isPressed ? ADLColor.terraDark : ADLColor.terracotta)
            .clipShape(RoundedRectangle(cornerRadius: ADLRadius.button, style: .continuous))
            .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Web `.btn-ghost`: h-14 rounded-2xl border border-gray-200 bg-white text-navy text-sm font-semibold.
struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(ADLFont.inter(15, .semibold))
            .tracking(0.15)
            .foregroundColor(ADLColor.navy)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(configuration.isPressed ? ADLColor.navyWash : Color.white)
            .clipShape(RoundedRectangle(cornerRadius: ADLRadius.button, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ADLRadius.button, style: .continuous)
                    .stroke(ADLColor.lineStrong, lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
