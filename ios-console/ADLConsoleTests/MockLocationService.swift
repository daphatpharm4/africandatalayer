@testable import ADLConsole
import ConsoleForms
import Foundation

/// Test double for `LocationServiceProtocol` — returns a canned fix or
/// throws a canned error, so `CaptureViewModel` tests never touch real
/// CoreLocation hardware/permissions.
final class MockLocationService: LocationServiceProtocol, @unchecked Sendable {
    enum Behavior {
        case succeed(FormGpsValue)
        case fail(LocationServiceError)
    }

    var behavior: Behavior
    private(set) var requestCount = 0

    init(behavior: Behavior = .succeed(FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 8))) {
        self.behavior = behavior
    }

    func requestOneShotLocation() async throws -> FormGpsValue {
        requestCount += 1
        switch behavior {
        case .succeed(let value): return value
        case .fail(let error): throw error
        }
    }
}
