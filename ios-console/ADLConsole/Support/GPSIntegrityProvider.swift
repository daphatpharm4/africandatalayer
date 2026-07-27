import ConsoleForms
import CoreMotion
import Foundation

/// Seam between the capture flow's GPS-plausibility check and
/// `CMMotionManager` — mirrors the injectable `PhotoIntegrityProviding`/
/// `CoreImagePhotoIntegrityProvider` and `DeviceProfilingProviding`/
/// `SystemDeviceProfilingProvider` patterns used elsewhere in this app.
/// Sensor reads/writes are injected as `@escaping @Sendable` closures
/// (defaulted to real `CMMotionManager` calls) so the confidence-scoring
/// logic in `integrityScore(gps:capturedAt:)` can be unit-tested with
/// canned accelerometer/gyro samples, without real hardware or a live
/// motion session.
///
/// NOTE: this type only extracts/builds the provider and its scoring
/// logic. It is not yet wired into `NativeCaptureFraudMetadataProvider` —
/// that integration happens in a later task.
protocol GPSIntegrityProviding: Sendable {
    /// Begins listening for accelerometer/gyro updates for one capture
    /// session. Resets any sample state left over from a previous session.
    /// Always pair with `stopCapture()` — motion sessions drain battery if
    /// left running.
    func startCapture()

    /// Stops sensor updates started by `startCapture()`. Safe to call even
    /// if updates were never started (or already stopped).
    func stopCapture()

    /// Scores GPS plausibility against the motion samples collected since
    /// the last `startCapture()`.
    func integrityScore(gps: FormGpsValue?, capturedAt: Date) -> GPSIntegrityResult
}

/// Motion-derived GPS plausibility signal for a single capture.
///
/// - `isStationary`: whether the reported GPS accuracy reads like a device
///   that isn't moving (loose accuracy, e.g. > 50m, is typical of a stale
///   or indoor fix rather than an actively-tracking one).
/// - `motionConsistent`: whether the accelerometer's motion/no-motion
///   reading agrees with `isStationary`.
/// - `confidenceScore`: 0...1 confidence that the GPS fix is genuine.
///   Falls back to a neutral `0.5` when there's no GPS fix or no motion
///   samples were collected to reason about.
struct GPSIntegrityResult: Equatable, Sendable {
    let isStationary: Bool
    let motionConsistent: Bool
    let confidenceScore: Double
}

/// Production `GPSIntegrityProviding` backed by `CMMotionManager`.
///
/// Accelerometer magnitude near 1g (Earth's gravity, in g-units — the unit
/// `CMAccelerometerData` reports) indicates the device is at rest;
/// deviation beyond `motionThreshold` indicates movement. All sensor
/// reads/writes are injected as closures defaulted to a shared
/// `CMMotionManager`, so `GPSIntegrityProviderTests` can feed canned
/// samples deterministically instead of depending on real hardware.
final class MotionGPSIntegrityProvider: GPSIntegrityProviding, @unchecked Sendable {
    private let motionThreshold: Double

    private let readIsAccelerometerAvailable: @Sendable () -> Bool
    private let readIsAccelerometerActive: @Sendable () -> Bool
    private let beginAccelerometerUpdates: @Sendable (_ onSample: @escaping @Sendable (Double, Double, Double) -> Void) -> Void
    private let endAccelerometerUpdates: @Sendable () -> Void
    private let readIsGyroAvailable: @Sendable () -> Bool
    private let readIsGyroActive: @Sendable () -> Bool
    private let beginGyroUpdates: @Sendable () -> Void
    private let endGyroUpdates: @Sendable () -> Void

    /// Guards the two fields below, which are written from the
    /// accelerometer callback (main queue, see `productionBeginAccelerometerUpdates`)
    /// and read from `integrityScore`, potentially from a different queue.
    private let stateLock = NSLock()
    private nonisolated(unsafe) var accelerometerSampleCount = 0
    private nonisolated(unsafe) var motionDetectedDuringCapture = false

    init(
        motionThreshold: Double = 0.08,
        readIsAccelerometerAvailable: @escaping @Sendable () -> Bool = { MotionGPSIntegrityProvider.productionMotionManager.isAccelerometerAvailable },
        readIsAccelerometerActive: @escaping @Sendable () -> Bool = { MotionGPSIntegrityProvider.productionMotionManager.isAccelerometerActive },
        beginAccelerometerUpdates: @escaping @Sendable (@escaping @Sendable (Double, Double, Double) -> Void) -> Void = MotionGPSIntegrityProvider.productionBeginAccelerometerUpdates,
        endAccelerometerUpdates: @escaping @Sendable () -> Void = { MotionGPSIntegrityProvider.productionMotionManager.stopAccelerometerUpdates() },
        readIsGyroAvailable: @escaping @Sendable () -> Bool = { MotionGPSIntegrityProvider.productionMotionManager.isGyroAvailable },
        readIsGyroActive: @escaping @Sendable () -> Bool = { MotionGPSIntegrityProvider.productionMotionManager.isGyroActive },
        beginGyroUpdates: @escaping @Sendable () -> Void = {
            MotionGPSIntegrityProvider.productionMotionManager.gyroUpdateInterval = 0.25
            MotionGPSIntegrityProvider.productionMotionManager.startGyroUpdates()
        },
        endGyroUpdates: @escaping @Sendable () -> Void = { MotionGPSIntegrityProvider.productionMotionManager.stopGyroUpdates() }
    ) {
        self.motionThreshold = motionThreshold
        self.readIsAccelerometerAvailable = readIsAccelerometerAvailable
        self.readIsAccelerometerActive = readIsAccelerometerActive
        self.beginAccelerometerUpdates = beginAccelerometerUpdates
        self.endAccelerometerUpdates = endAccelerometerUpdates
        self.readIsGyroAvailable = readIsGyroAvailable
        self.readIsGyroActive = readIsGyroActive
        self.beginGyroUpdates = beginGyroUpdates
        self.endGyroUpdates = endGyroUpdates
    }

    /// Single app-wide `CMMotionManager`. `CMMotionManager` isn't
    /// `Sendable`, so this is opted out of the concurrency checker
    /// explicitly (`nonisolated(unsafe)`) — the same trade-off
    /// `NativeCaptureFraudMetadataProvider` makes by confining its own
    /// instance to `@MainActor`. All production start/stop calls below run
    /// against this one instance, matching real `CMMotionManager` usage
    /// (one manager per app, started/stopped per capture session).
    private nonisolated(unsafe) static let productionMotionManager = CMMotionManager()

    private static func productionBeginAccelerometerUpdates(
        onSample: @escaping @Sendable (Double, Double, Double) -> Void
    ) {
        let manager = productionMotionManager
        guard manager.isAccelerometerAvailable, !manager.isAccelerometerActive else { return }
        manager.accelerometerUpdateInterval = 0.25
        manager.startAccelerometerUpdates(to: .main) { data, _ in
            guard let acceleration = data?.acceleration else { return }
            onSample(acceleration.x, acceleration.y, acceleration.z)
        }
    }

    func startCapture() {
        stateLock.withLock {
            accelerometerSampleCount = 0
            motionDetectedDuringCapture = false
        }
        beginAccelerometerUpdates { [weak self] x, y, z in
            guard let self else { return }
            let magnitude = (x * x + y * y + z * z).squareRoot()
            self.stateLock.withLock {
                self.accelerometerSampleCount += 1
                if abs(magnitude - 1.0) > self.motionThreshold {
                    self.motionDetectedDuringCapture = true
                }
            }
        }
        if readIsGyroAvailable(), !readIsGyroActive() {
            beginGyroUpdates()
        }
    }

    func stopCapture() {
        if readIsAccelerometerActive() {
            endAccelerometerUpdates()
        }
        if readIsGyroActive() {
            endGyroUpdates()
        }
    }

    func integrityScore(gps: FormGpsValue?, capturedAt: Date) -> GPSIntegrityResult {
        let (samples, motionDetected) = stateLock.withLock {
            (accelerometerSampleCount, motionDetectedDuringCapture)
        }

        guard let gps else {
            return GPSIntegrityResult(isStationary: true, motionConsistent: false, confidenceScore: 0.5)
        }

        // Loose accuracy (> 50m) reads like a stale/indoor fix, typical of
        // a stationary device; tight accuracy reads like an actively
        // tracking fix, typical of a moving one.
        let isStationary = gps.accuracyMeters.map { $0 > 50 } ?? true

        guard samples > 0 else {
            return GPSIntegrityResult(isStationary: isStationary, motionConsistent: false, confidenceScore: 0.5)
        }

        let motionConsistent = isStationary == !motionDetected
        let confidence: Double
        if motionConsistent {
            confidence = 0.85
        } else if isStationary && motionDetected {
            confidence = 0.3
        } else {
            confidence = 0.6
        }
        return GPSIntegrityResult(isStationary: isStationary, motionConsistent: motionConsistent, confidenceScore: confidence)
    }
}
