import SwiftUI

/// Standard console card container. Mirrors the web `.card` component class
/// (`rounded-2xl`, subtle border, white surface) — clinical register, no
/// gamification chrome.
struct ADLConsoleCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
        )
    }
}

/// Primary navy action button. Mirrors the web `.btn-primary` class
/// (`h-14 rounded-2xl`, navy fill, `active:scale-95` press feedback).
struct ADLConsolePrimaryButton: View {
    let title: String
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
                    Text(title)
                        .font(ADLConsoleFont.headline)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
        }
        .background(isDisabled ? ADLConsoleColor.navy.opacity(0.5) : ADLConsoleColor.navy)
        .foregroundStyle(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .disabled(isDisabled || isBusy)
        .buttonStyle(ADLConsolePressStyle())
    }
}

/// Subtle press scale, matching the web `active:scale-95 transition-all`.
struct ADLConsolePressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Small uppercase, bold, tracked label — the console's micro-label pattern
/// used throughout the web design system for section headers and metadata.
struct ADLConsoleMicroLabel: View {
    let text: String
    var color: Color = ADLConsoleColor.inkMuted

    var body: some View {
        Text(text.uppercased())
            .font(ADLConsoleFont.microLabel)
            .tracking(0.6)
            .foregroundStyle(color)
    }
}
