import ConsoleAPI
import SwiftUI

@main
struct ADLConsoleApp: App {
    @State private var configurationError: String?
    @StateObject private var appState: AppState

    init() {
        do {
            let environment = try AppEnvironment.load()
            let dependencies = try AppDependencies(environment: environment)
            let state = AppState(
                apiClient: dependencies.apiClient,
                authService: dependencies.authService,
                recordLedger: dependencies.recordLedger,
                workspaceRepository: dependencies.workspaceRepository,
                mediaStore: dependencies.mediaStore,
                sessionRepository: dependencies.sessionRepository,
                connectivityMonitor: dependencies.connectivityMonitor,
                legacyQueueStore: dependencies.legacyQueueStore
            )
            #if DEBUG
            if let role = UserDefaults.standard.string(forKey: "uiTestRole") {
                state.configureForUITest(
                    role: role,
                    locale: UserDefaults.standard.string(forKey: "uiTestLocale") ?? "en",
                    connectivity: UserDefaults.standard.string(forKey: "uiTestConnectivity") ?? "online"
                )
            }
            #endif
            _appState = StateObject(wrappedValue: state)
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
