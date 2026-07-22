import ConsoleAPI
import SwiftUI

@main
struct ADLConsoleApp: App {
    @State private var configurationError: String?
    @StateObject private var appState: AppState

    init() {
        do {
            let environment = try AppEnvironment.load()
            let dependencies = AppDependencies(environment: environment)
            _appState = StateObject(wrappedValue: AppState(
                apiClient: dependencies.apiClient,
                authService: dependencies.authService
            ))
        } catch {
            _configurationError = State(initialValue: "ADL Console is not configured for this build.")
            _appState = StateObject(wrappedValue: AppState(
                apiClient: PlatformAPIClient(baseURL: URL(string: "about:blank")!),
                authService: NetworkAuthService(baseURL: URL(string: "about:blank")!)
            ))
        }
    }

    var body: some Scene {
        WindowGroup {
            if let message = configurationError {
                ConfigurationErrorView(message: message)
            } else {
                RootView()
                    .environmentObject(appState)
            }
        }
    }
}
