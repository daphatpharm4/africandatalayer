import SwiftUI

enum ADLColor {
    static let navy = Color(red: 15 / 255, green: 43 / 255, blue: 70 / 255)
    static let navySoft = Color(red: 31 / 255, green: 67 / 255, blue: 100 / 255)
    static let gold = Color(red: 209 / 255, green: 151 / 255, blue: 54 / 255)
    static let terracotta = Color(red: 190 / 255, green: 83 / 255, blue: 55 / 255)
    static let forest = Color(red: 37 / 255, green: 108 / 255, blue: 77 / 255)
    static let ink = Color(red: 20 / 255, green: 28 / 255, blue: 37 / 255)
    static let paper = Color(red: 246 / 255, green: 248 / 255, blue: 244 / 255)
    static let line = Color(red: 220 / 255, green: 226 / 255, blue: 232 / 255)
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
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(ADLColor.line, lineWidth: 1)
            )
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
                    .font(.title3.weight(.semibold))
                    .foregroundColor(tint)
                    .frame(width: 36, height: 36)
                    .background(tint.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(value)
                        .font(.title2.weight(.bold))
                        .foregroundColor(ADLColor.ink)
                    Text(title)
                        .font(.footnote.weight(.medium))
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
            .font(.caption.weight(.semibold))
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
                .font(.caption.weight(.bold))
                .tracking(1.1)
                .foregroundColor(.secondary)
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(.caption.weight(.semibold))
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
                .font(.title3.weight(.bold))
                .foregroundColor(tint)
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .tracking(0.8)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
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
                    .font(.title3.weight(.semibold))
                    .foregroundColor(ADLColor.navy)
                    .frame(width: 44, height: 44)
                    .background(ADLColor.navy.opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(reward.name)
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(ADLColor.ink)
                    Text(reward.category.title)
                        .font(.caption2.weight(.semibold))
                        .tracking(0.6)
                        .foregroundColor(.secondary)
                    Text(reward.stock.title)
                        .font(.caption2.weight(.bold))
                        .foregroundColor(stockTint)
                }

                Spacer()

                Button(action: action) {
                    Text("\(reward.costXP) XP")
                        .font(.caption.weight(.bold))
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

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: badge.unlocked ? badge.systemImage : "lock.fill")
                .font(.title2.weight(.semibold))
                .foregroundColor(badge.unlocked ? badge.tint : .secondary)
                .frame(width: 52, height: 52)
                .background((badge.unlocked ? badge.tint : ADLColor.line).opacity(0.14))
                .clipShape(Circle())

            Text(badge.title)
                .font(.caption.weight(.bold))
                .foregroundColor(ADLColor.ink)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            if badge.unlocked {
                Text("Earned")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(ADLColor.forest)
            } else {
                ADLProgressBar(value: badge.progress, tint: ADLColor.gold, height: 5)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .padding(.horizontal, 8)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
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
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    StatusPill(title: "+\(mission.rewardXP) XP", tint: mission.isComplete ? ADLColor.forest : ADLColor.gold)
                }
                Text(mission.detail)
                    .font(.footnote)
                    .foregroundColor(.secondary)
                ADLProgressBar(value: mission.fraction, tint: mission.isComplete ? ADLColor.forest : ADLColor.navy)
                Text("\(mission.current)/\(mission.goal)")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(configuration.isPressed ? ADLColor.navySoft : ADLColor.navy)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(ADLColor.navy)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(configuration.isPressed ? ADLColor.line : Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(ADLColor.line, lineWidth: 1)
            )
    }
}
