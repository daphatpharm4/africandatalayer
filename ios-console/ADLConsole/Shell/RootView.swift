import SwiftUI

/// Top-level switch: bootstrapping → loading; unauthenticated → `AuthView`;
/// authenticated → `ConsoleShellView`. Mirrors the role `ConsoleApp.tsx`
/// plays on the web (its `sessionState === 'loading'` / unauthenticated /
/// authenticated branches).
struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            if !appState.isAuthenticated {
                AuthView()
            } else {
                switch appState.organizationsLoadState {
                case .idle, .loading:
                    LoadingView()
                case .failed(let message):
                    OrganizationsErrorView(message: message)
                case .loaded:
                    ConsoleShellView()
                }
            }
        }
        .animation(.default, value: appState.isAuthenticated)
    }
}

private struct LoadingView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(appState.language.t("Loading your workspace…", "Chargement de votre espace de travail…"))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ADLConsoleColor.page)
    }
}

private struct OrganizationsErrorView: View {
    @EnvironmentObject private var appState: AppState
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            Text(appState.language.t("Could not load your organizations.", "Impossible de charger vos organisations."))
                .font(ADLConsoleFont.headline)
                .foregroundStyle(ADLConsoleColor.ink)
            Text(message)
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .multilineTextAlignment(.center)
            ADLConsolePrimaryButton(title: appState.language.t("Retry", "Réessayer")) {
                Task { await appState.loadOrganizations() }
            }
            .frame(maxWidth: 220)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ADLConsoleColor.page)
    }
}
