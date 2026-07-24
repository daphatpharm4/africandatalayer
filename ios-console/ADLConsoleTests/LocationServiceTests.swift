@testable import ADLConsole
import ConsoleForms
import XCTest

/// Regression coverage for L1: a re-entrant `requestOneShotLocation()` call
/// used to overwrite `CoreLocationService.continuation` without resuming
/// the previous one, leaking the earlier caller's continuation so it hung
/// forever. Task cancellation was also unhandled, with the same hang risk.
///
/// Neither test here waits on a real CoreLocation fix — both exercise pure
/// continuation bookkeeping (the lock-guarded swap/resume in
/// `requestOneShotLocation` and `finish`), so they resolve promptly even
/// though `CoreLocationService` still dispatches a real
/// `CLLocationManager` authorization/location request in the background.
final class LocationServiceTests: XCTestCase {
    /// A second, re-entrant call must resume the first call's pending
    /// continuation with `CancellationError` instead of silently replacing
    /// it — otherwise the first awaiting caller hangs forever.
    func testReentrantCallResumesPriorContinuationWithCancellationError() async throws {
        let service = CoreLocationService()

        let firstTask = Task { try await service.requestOneShotLocation() }
        // Give the first call's continuation setup (a synchronous section
        // guarded by `lock`) a chance to run before the second call fires,
        // so the re-entrancy path is actually exercised.
        try await Task.sleep(nanoseconds: 50_000_000)
        let secondTask = Task { try await service.requestOneShotLocation() }

        do {
            _ = try await firstTask.value
            XCTFail("Expected the first call to be cancelled by the re-entrant second call")
        } catch is CancellationError {
            // Expected: requestOneShotLocation resumed the stale
            // continuation instead of leaking it.
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }

        // The second call now owns the only live continuation. Cancel the
        // task so the test doesn't depend on a real GPS fix or permission
        // prompt ever resolving.
        secondTask.cancel()
        do {
            _ = try await secondTask.value
            XCTFail("Expected the cancelled second call to throw")
        } catch is CancellationError {
            // Expected: withTaskCancellationHandler's onCancel (or the
            // Task.isCancelled guard inside the continuation setup, if
            // cancellation raced ahead of it) resumed the continuation.
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }
    }

    /// Cancelling the calling task before any re-entrant call arrives must
    /// still resume the continuation exactly once with `CancellationError`
    /// rather than hanging.
    func testCancellationResumesContinuationWithCancellationError() async throws {
        let service = CoreLocationService()

        let task = Task { try await service.requestOneShotLocation() }
        try await Task.sleep(nanoseconds: 50_000_000)
        task.cancel()

        do {
            _ = try await task.value
            XCTFail("Expected the cancelled call to throw")
        } catch is CancellationError {
            // Expected.
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }
    }
}
