@testable import ADLConsole
import ConsoleForms
import Foundation
import XCTest

/// Coverage for `GPSIntegrityProviding` / `MotionGPSIntegrityProvider`: the
/// confidence-scoring logic is exercised with injected accelerometer/gyro
/// closures (canned samples) rather than a real `CMMotionManager`, mirroring
/// `DeviceProfilingProviderTests`'/`PhotoIntegrityProviderTests`' injected-
/// closure pattern so hardware is never required.
///
/// The injected closures are typed `@Sendable`, so tests that need to
/// observe a side effect from inside one (e.g. "was `stopCapture`'s end
/// closure invoked?") capture a `Box` rather than a bare local `var` —
/// Swift 6 forbids mutating a captured local across an `@Sendable`
/// boundary even when the closure is actually invoked synchronously.
private final class Box<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Value
    init(_ value: Value) { self.value = value }
    var wrapped: Value {
        get { lock.withLock { value } }
        set { lock.withLock { value = newValue } }
    }
}

final class GPSIntegrityProviderTests: XCTestCase {
    // MARK: - Baseline (no signal to reason about)

    func testNoGpsReturnsBaselineConfidence() {
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { false },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { _ in },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )
        let result = provider.integrityScore(gps: nil, capturedAt: Date())
        XCTAssertTrue(result.isStationary)
        XCTAssertFalse(result.motionConsistent)
        XCTAssertEqual(result.confidenceScore, 0.5)
    }

    func testNoMotionSamplesReturnsBaselineConfidenceEvenWithGps() {
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { _ in /* never samples */ },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )
        provider.startCapture()
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 8)
        let result = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertFalse(result.motionConsistent)
        XCTAssertEqual(result.confidenceScore, 0.5)
    }

    func testIntegrityScoreWithoutStartingCaptureStaysBaseline() {
        // startCapture() never called: sample count is 0 regardless of
        // what the accelerometer closures could have produced.
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { onSample in onSample(0, 0, 1) },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 8)
        let result = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertEqual(result.confidenceScore, 0.5)
    }

    // MARK: - Stationary device (loose GPS accuracy => isStationary == true)

    func testStationaryDeviceWithNoMotionIsConsistentAndHighConfidence() {
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { onSample in
                // Gravity-only readings (magnitude ~1g): device at rest.
                onSample(0.0, 0.0, 1.0)
                onSample(0.01, -0.01, 0.99)
            },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )
        provider.startCapture()
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 120)
        let result = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertTrue(result.isStationary)
        XCTAssertTrue(result.motionConsistent)
        XCTAssertEqual(result.confidenceScore, 0.85)
    }

    func testStationaryDeviceWithMotionDetectedIsInconsistentAndLowConfidence() {
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { onSample in
                // Sharp deviation from 1g: device is being moved/shaken
                // while GPS accuracy is loose — suspicious combination.
                onSample(1.4, 0.9, 0.2)
            },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )
        provider.startCapture()
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 120)
        let result = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertTrue(result.isStationary)
        XCTAssertFalse(result.motionConsistent)
        XCTAssertEqual(result.confidenceScore, 0.3)
    }

    // MARK: - Moving device (tight GPS accuracy => isStationary == false)

    func testMovingDeviceWithMotionDetectedIsConsistentAndHighConfidence() {
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { onSample in
                onSample(1.4, 0.9, 0.2)
            },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )
        provider.startCapture()
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 8)
        let result = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertFalse(result.isStationary)
        XCTAssertTrue(result.motionConsistent)
        XCTAssertEqual(result.confidenceScore, 0.85)
    }

    func testMovingDeviceWithNoMotionIsInconsistentAndMediumConfidence() {
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { onSample in
                onSample(0.0, 0.0, 1.0)
            },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )
        provider.startCapture()
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 8)
        let result = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertFalse(result.isStationary)
        XCTAssertFalse(result.motionConsistent)
        XCTAssertEqual(result.confidenceScore, 0.6)
    }

    // MARK: - accuracyMeters nil defaults to stationary

    func testNilAccuracyDefaultsToStationary() {
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { onSample in onSample(0.0, 0.0, 1.0) },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )
        provider.startCapture()
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: nil)
        let result = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertTrue(result.isStationary)
        XCTAssertTrue(result.motionConsistent)
    }

    // MARK: - startCapture/stopCapture lifecycle wiring

    func testStartCaptureResetsSampleStateBetweenSessions() {
        let sampleHandler = Box<(@Sendable (Double, Double, Double) -> Void)?>(nil)
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { onSample in sampleHandler.wrapped = onSample },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )

        provider.startCapture()
        sampleHandler.wrapped?(1.5, 1.5, 1.5) // large deviation: motion detected
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 120)
        let firstResult = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertFalse(firstResult.motionConsistent) // stationary GPS + motion = inconsistent

        // A fresh capture session should reset sample count/motion flag,
        // not accumulate across sessions.
        provider.startCapture()
        let secondResult = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertEqual(secondResult.confidenceScore, 0.5, "no samples reported yet in the new session")
    }

    func testStopCaptureInvokesEndClosuresOnlyWhenActive() {
        let accelerometerStopped = Box(false)
        let gyroStopped = Box(false)
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { true },
            beginAccelerometerUpdates: { _ in },
            endAccelerometerUpdates: { accelerometerStopped.wrapped = true },
            readIsGyroAvailable: { true },
            readIsGyroActive: { true },
            beginGyroUpdates: {},
            endGyroUpdates: { gyroStopped.wrapped = true }
        )
        provider.stopCapture()
        XCTAssertTrue(accelerometerStopped.wrapped)
        XCTAssertTrue(gyroStopped.wrapped)
    }

    func testStopCaptureSkipsEndClosuresWhenInactive() {
        let accelerometerStopped = Box(false)
        let gyroStopped = Box(false)
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { _ in },
            endAccelerometerUpdates: { accelerometerStopped.wrapped = true },
            readIsGyroAvailable: { true },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: { gyroStopped.wrapped = true }
        )
        provider.stopCapture()
        XCTAssertFalse(accelerometerStopped.wrapped)
        XCTAssertFalse(gyroStopped.wrapped)
    }

    func testStartCaptureSkipsGyroWhenUnavailable() {
        let gyroStarted = Box(false)
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { _ in },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: { gyroStarted.wrapped = true },
            endGyroUpdates: {}
        )
        provider.startCapture()
        XCTAssertFalse(gyroStarted.wrapped)
    }

    // MARK: - motionCaptureStats (Task I2: single motion session)

    /// `motionCaptureStats` is the raw (non-distilled) counterpart to
    /// `integrityScore`'s confidence value — `NativeCaptureFraudMetadataProvider`
    /// consumes this instead of running its own second `CMMotionManager`
    /// session for the same fields.
    func testMotionCaptureStatsReflectsSamplesCollectedSinceStartCapture() {
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { onSample in
                onSample(1.4, 0.9, 0.2) // large deviation: motion detected
                onSample(1.3, 0.8, 0.3)
            },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { true },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )

        provider.startCapture()
        let stats = provider.motionCaptureStats

        XCTAssertTrue(stats.isAccelerometerAvailable)
        XCTAssertTrue(stats.isGyroAvailable)
        XCTAssertEqual(stats.accelerometerSampleCount, 2)
        XCTAssertTrue(stats.motionDetectedDuringCapture)
    }

    func testMotionCaptureStatsIsZeroSampleCountBeforeStartCapture() {
        let provider = MotionGPSIntegrityProvider(
            readIsAccelerometerAvailable: { true },
            readIsAccelerometerActive: { false },
            beginAccelerometerUpdates: { onSample in onSample(0, 0, 1) },
            endAccelerometerUpdates: {},
            readIsGyroAvailable: { false },
            readIsGyroActive: { false },
            beginGyroUpdates: {},
            endGyroUpdates: {}
        )

        let stats = provider.motionCaptureStats

        XCTAssertEqual(stats.accelerometerSampleCount, 0)
        XCTAssertFalse(stats.motionDetectedDuringCapture)
    }

    // MARK: - Production default initializer compiles and is usable

    func testDefaultInitializerUsesProductionMotionManager() {
        let provider = MotionGPSIntegrityProvider()
        // No hardware assertions here (simulator/device dependent) — this
        // just proves the production closures wire up without crashing.
        provider.startCapture()
        provider.stopCapture()
        let result = provider.integrityScore(gps: nil, capturedAt: Date())
        XCTAssertEqual(result.confidenceScore, 0.5)
    }
}
