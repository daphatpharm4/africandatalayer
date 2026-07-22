import ConsoleAPI
import Foundation

struct AppDependencies {
    let baseURL: URL
    let session: URLSession
    let apiClient: PlatformAPIClient
    let authService: NetworkAuthService

    init(environment: AppEnvironment) {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = environment.network.requestTimeout
        configuration.timeoutIntervalForResource = environment.network.resourceTimeout
        configuration.httpCookieStorage = .shared
        let session = URLSession(configuration: configuration)
        self.baseURL = environment.apiBaseURL
        self.session = session
        self.apiClient = PlatformAPIClient(
            baseURL: environment.apiBaseURL,
            transport: URLSessionPlatformTransport(session: session)
        )
        self.authService = NetworkAuthService(
            baseURL: environment.apiBaseURL,
            transport: URLSessionAuthTransport(session: session)
        )
    }
}
