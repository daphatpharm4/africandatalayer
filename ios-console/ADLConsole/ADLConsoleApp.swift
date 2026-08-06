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
            let uiTestEnvironment = ProcessInfo.processInfo.environment
            if uiTestEnvironment["ADL_UI_TEST_MODE"] == "1",
               let role = uiTestEnvironment["ADL_UI_TEST_ROLE"] {
                state.configureForUITest(
                    role: role,
                    locale: uiTestEnvironment["ADL_UI_TEST_LOCALE"] ?? "en",
                    connectivity: uiTestEnvironment["ADL_UI_TEST_CONNECTIVITY"] ?? "online"
                )
            } else if uiTestEnvironment["ADL_UI_TEST_MODE"] == "1" {
                state.configureSignedOutForUITest(
                    locale: uiTestEnvironment["ADL_UI_TEST_LOCALE"] ?? "en"
                )
            }
            #endif
            _appState = StateObject(wrappedValue: state)
        } catch {
            let fallbackState = AppState(
                apiClient: PlatformAPIClient(baseURL: URL(string: "about:blank")!),
                authService: NetworkAuthService(baseURL: URL(string: "about:blank")!)
            )
            #if DEBUG
            let uiTestEnvironment = ProcessInfo.processInfo.environment
            if uiTestEnvironment["ADL_UI_TEST_MODE"] == "1" {
                if let role = uiTestEnvironment["ADL_UI_TEST_ROLE"] {
                    fallbackState.configureForUITest(
                        role: role,
                        locale: uiTestEnvironment["ADL_UI_TEST_LOCALE"] ?? "en",
                        connectivity: uiTestEnvironment["ADL_UI_TEST_CONNECTIVITY"] ?? "online"
                    )
                } else {
                    fallbackState.configureSignedOutForUITest(
                        locale: uiTestEnvironment["ADL_UI_TEST_LOCALE"] ?? "en"
                    )
                }
                _appState = StateObject(wrappedValue: fallbackState)
                return
            }
            #endif
            _configurationError = State(initialValue: "ADL Console is not configured for this build.")
            _appState = StateObject(wrappedValue: fallbackState)
        }
    }

    var body: some Scene {
        WindowGroup {
            if AppStoreCaptureConfiguration.isEnabled {
                AppStoreCaptureView(configuration: .current)
            } else if let message = configurationError {
                ConfigurationErrorView(message: message)
            } else {
                RootView()
                    .environmentObject(appState)
            }
        }
    }
}
