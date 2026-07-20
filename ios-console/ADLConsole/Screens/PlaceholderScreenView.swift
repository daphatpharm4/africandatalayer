import ConsoleState
import SwiftUI

/// "Coming soon" placeholder for every gated screen except Overview, per the
/// task-4 scope ("Only the Overview destination needs a real screen this
/// task; others can be labeled placeholders"). Nav visibility is still
/// correctly role-gated by `ConsoleShellView` — this view only renders once
/// a destination has already been deemed accessible.
struct PlaceholderScreenView: View {
    @EnvironmentObject private var appState: AppState
    let screen: ConsoleScreen
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "hourglass")
                .font(.system(size: 32))
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .rotationEffect(.degrees(isAnimating ? 15 : -15))
                .animation(.easeInOut(duration: 2).repeatForever(autoreverses: true), value: isAnimating)
                .onAppear { isAnimating = true }
                .accessibilityHidden(true)
            Text(appState.language.t("Coming soon", "Bientôt disponible"))
                .font(ADLConsoleFont.headline)
                .foregroundStyle(ADLConsoleColor.ink)
            Text(appState.language.t(
                "This section of the console is under construction.",
                "Cette section de la console est en cours de construction."
            ))
            .font(ADLConsoleFont.footnote)
            .foregroundStyle(ADLConsoleColor.inkMuted)
            .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ADLConsoleColor.page)
    }
}
