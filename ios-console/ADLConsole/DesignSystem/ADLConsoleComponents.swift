import SwiftUI

/// Standard console card — white surface, soft navy border, continuous corners.
struct ADLConsoleCard<Content: View>: View {
    var padding: CGFloat = 0
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .padding(padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(ADLConsoleColor.navyBorder.opacity(0.9), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }
}

/// Navy hero card used for workspace headers (matches web RoleWorkspaceScreen).
struct ADLConsoleHeroCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(
            LinearGradient(
                colors: [ADLConsoleColor.navy, ADLConsoleColor.navyDark],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: ADLConsoleColor.navy.opacity(0.25), radius: 12, x: 0, y: 6)
    }
}

/// Primary navy action button — mirrors web `.btn-primary`.
struct ADLConsolePrimaryButton: View {
    let title: String
    var systemImage: String? = nil
    var isBusy: Bool = false
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if isBusy {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                } else {
                    HStack(spacing: 8) {
                        if let systemImage {
                            Image(systemName: systemImage)
                        }
                        Text(title)
                            .font(ADLConsoleFont.headline)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
        }
        .background(isDisabled ? ADLConsoleColor.navy.opacity(0.45) : ADLConsoleColor.navy)
        .foregroundStyle(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .disabled(isDisabled || isBusy)
        .buttonStyle(ADLConsolePressStyle())
    }
}

/// Outlined secondary button — language toggle, refresh, etc.
struct ADLConsoleSecondaryButton: View {
    let title: String
    var systemImage: String? = nil
    var tint: Color = ADLConsoleColor.navy
    var border: Color = ADLConsoleColor.navyBorder
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .font(ADLConsoleFont.subheadline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .foregroundStyle(tint)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(border, lineWidth: 1)
            )
        }
        .buttonStyle(ADLConsolePressStyle())
    }
}

/// Destructive outline button (sign out / delete).
struct ADLConsoleDestructiveButton: View {
    let title: String
    var systemImage: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .font(ADLConsoleFont.subheadline)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .foregroundStyle(ADLConsoleColor.danger)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ADLConsoleColor.danger.opacity(0.45), lineWidth: 1)
            )
        }
        .buttonStyle(ADLConsolePressStyle())
    }
}

struct ADLConsolePressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct ADLConsoleMicroLabel: View {
    let text: String
    var color: Color = ADLConsoleColor.inkMuted

    var body: some View {
        Text(text.uppercased())
            .font(ADLConsoleFont.microLabel)
            .tracking(0.7)
            .foregroundStyle(color)
    }
}

/// Status / role pill matching web badges.
struct ADLConsolePill: View {
    let text: String
    var foreground: Color = ADLConsoleColor.navy
    var background: Color = ADLConsoleColor.navyWash

    var body: some View {
        Text(text.uppercased())
            .font(ADLConsoleFont.microLabel)
            .tracking(0.4)
            .foregroundStyle(foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(background)
            .clipShape(Capsule())
    }
}

/// Horizontal filter chip (review filters, map/list toggle).
struct ADLConsoleChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(ADLConsoleFont.subheadline)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .foregroundStyle(isSelected ? Color.white : ADLConsoleColor.ink)
                .background(isSelected ? ADLConsoleColor.navy : Color.white)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Color.clear : ADLConsoleColor.navyBorder, lineWidth: 1)
                )
        }
        .buttonStyle(ADLConsolePressStyle())
    }
}

/// Tappable workspace action row (web RoleWorkspaceScreen cards).
struct ADLConsoleActionRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(ADLConsoleColor.navyWash)
                        .frame(width: 44, height: 44)
                    Image(systemName: systemImage)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(ADLConsoleColor.navy)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                        .multilineTextAlignment(.leading)
                    Text(subtitle)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            .padding(16)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
            )
        }
        .buttonStyle(ADLConsolePressStyle())
    }
}

/// Soft text field chrome matching web inputs.
struct ADLConsoleFieldChrome<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(14)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
            )
    }
}
