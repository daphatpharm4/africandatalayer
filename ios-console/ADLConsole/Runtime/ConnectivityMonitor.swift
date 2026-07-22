import Foundation
import Network

enum ConnectivityState: Equatable, Sendable {
    case unsatisfied
    case requiresConnection
    case satisfied
}

protocol ConnectivityMonitoring: Sendable {
    var state: ConnectivityState { get }
    var stateStream: AsyncStream<ConnectivityState> { get }
    func start()
    func stop()
}

final class ConnectivityMonitor: ConnectivityMonitoring, @unchecked Sendable {
    private let monitor: NWPathMonitor
    private let queue: DispatchQueue
    private var continuation: AsyncStream<ConnectivityState>.Continuation?
    private let _stateStream: AsyncStream<ConnectivityState>

    var state: ConnectivityState {
        convert(monitor.currentPath)
    }

    var stateStream: AsyncStream<ConnectivityState> {
        _stateStream
    }

    init(monitor: NWPathMonitor = NWPathMonitor(), queue: DispatchQueue = DispatchQueue(label: "com.africandatalayer.connectivity")) {
        self.monitor = monitor
        self.queue = queue
        var cont: AsyncStream<ConnectivityState>.Continuation?
        _stateStream = AsyncStream { cont = $0 }
        continuation = cont
    }

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            let state = self.convert(path)
            self.continuation?.yield(state)
        }
        monitor.start(queue: queue)
    }

    func stop() {
        monitor.cancel()
        continuation?.finish()
    }

    private func convert(_ path: NWPath) -> ConnectivityState {
        if path.status == .satisfied { return .satisfied }
        if path.status == .requiresConnection { return .requiresConnection }
        return .unsatisfied
    }
}
