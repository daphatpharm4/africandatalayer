import ConsoleAPI
import ConsoleForms
import ConsolePersistence
import Foundation

struct AppDependencies {
    let baseURL: URL
    let session: URLSession
    let apiClient: PlatformAPIClient
    let authService: NetworkAuthService
    let recordLedger: RecordLedger
    let workspaceRepository: WorkspaceRepository
    let mediaStore: CaptureMediaStore
    let sessionRepository: SessionRepository
    let connectivityMonitor: ConnectivityMonitor
    let legacyQueueStore: FileRecordQueueStore

    init(environment: AppEnvironment) throws {
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

        let applicationSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? FileManager.default.temporaryDirectory
        let root = applicationSupport.appendingPathComponent("ADLConsole", isDirectory: true)
        let database = try RecordDatabase.at(root.appendingPathComponent("records.sqlite"))
        let workspaceRepository = WorkspaceRepository(database: database)
        let identityStore = UserDefaultsSessionIdentityStore()
        self.recordLedger = RecordLedger(database: database)
        self.workspaceRepository = workspaceRepository
        self.mediaStore = CaptureMediaStore(baseURL: root.appendingPathComponent("CaptureMedia", isDirectory: true))
        self.sessionRepository = SessionRepository(
            authService: self.authService,
            workspaceRepository: workspaceRepository,
            identityStore: identityStore
        )
        self.connectivityMonitor = ConnectivityMonitor()
        self.legacyQueueStore = FileRecordQueueStore(
            fileURL: applicationSupport.appendingPathComponent("adl-console-record-queue.json")
        )
    }
}
