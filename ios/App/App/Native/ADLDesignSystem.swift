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
