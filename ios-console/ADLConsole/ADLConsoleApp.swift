import ConsoleAPI
import SwiftUI

/// Base URL for the Data Ops Platform API this console talks to. Points at
/// the production ADL deployment; a later task should make this
/// build-config-driven (e.g. a debug scheme pointed at a preview
/// deployment).
private let consoleAPIBaseURL = URL(string: "https://www.app.africandatalayer.com")!

@main
struct ADLConsoleApp: App {
    @StateObject private var appState = AppState(
        apiClient: PlatformAPIClient(baseURL: consoleAPIBaseURL),
        authService: NetworkAuthService(baseURL: consoleAPIBaseURL)
    )

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
        }
    }
}
