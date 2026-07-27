import ConsoleForms
import ConsoleModels
import CoreMotion
import Foundation
import ImageIO
import UIKit

@MainActor
protocol CaptureFraudMetadataProviding: AnyObject {
    func startCapture()
    func stopCapture()
    func device(language: ConsoleLanguage) -> PlatformRecordEvidence.Device
    func photoMetadata(for dataURL: String, capturedAt: String) -> PlatformRecordEvidence.PhotoMetadata?
    func clientExif(gps: FormGpsValue?, capturedAt: String) -> PlatformRecordEvidence.ClientExif?
    func gpsIntegrity(gps: FormGpsValue?, capturedAt: Date) -> PlatformRecordEvidence.GpsIntegrity
}

/// Production `CaptureFraudMetadataProviding` — the adapter between the
/// capture flow's evidence-building step and the individually-testable
/// fraud/integrity providers (`GPSIntegrityProviding`,
/// `DeviceProfilingProviding`, `PhotoIntegrityProviding`) built in earlier
/// tasks. Each provider is injected with a real production default, so this
/// type only maps their outputs onto `PlatformRecordEvidence`'s wire shape —
/// it doesn't own any fraud-detection logic itself.
@MainActor
final class NativeCaptureFraudMetadataProvider: CaptureFraudMetadataProviding {
    private let gpsIntegrityProvider: GPSIntegrityProviding
    private let deviceProfilingProvider: DeviceProfilingProviding
    private let photoIntegrityProvider: PhotoIntegrityProviding
    private let deviceTimestamp: () -> Date

    /// Raw per-capture accelerometer/gyro telemetry (availability, sample
    /// count, "was the device moving" flag). `GPSIntegrityProviding` only
    /// exposes a distilled `GPSIntegrityResult` (confidence score, not raw
    /// sample counts) — since `PlatformRecordEvidence.GpsIntegrity` mirrors
    /// the backend's `GpsIntegrityReport` and needs the raw counts, this
    /// provider keeps its own lightweight `CMMotionManager` session
    /// specifically for those fields, run alongside `gpsIntegrityProvider`'s
    /// own session (started/stopped together in `startCapture`/`stopCapture`
    /// below).
    private let motionManager = CMMotionManager()
    private var accelerometerSampleCount = 0
    private var motionDetectedDuringCapture = false

    /// A motion/GPS-fix mismatch this confident (accelerometer says the
    /// device is moving while the GPS fix reads as a stationary/loose-accuracy
    /// one, or vice versa) is the same "spoofed location" signature
    /// `MotionGPSIntegrityProvider.integrityScore` scores at `0.3` — below
    /// this threshold, flag it as a likely mock-location fix.
    private static let mockLocationConfidenceThreshold: Double = 0.3

    init(
        gpsIntegrityProvider: GPSIntegrityProviding = MotionGPSIntegrityProvider(),
        deviceProfilingProvider: DeviceProfilingProviding = SystemDeviceProfilingProvider(),
        photoIntegrityProvider: PhotoIntegrityProviding = CoreImagePhotoIntegrityProvider(),
        deviceTimestamp: @escaping () -> Date = { Date() }
    ) {
        self.gpsIntegrityProvider = gpsIntegrityProvider
        self.deviceProfilingProvider = deviceProfilingProvider
        self.photoIntegrityProvider = photoIntegrityProvider
        self.deviceTimestamp = deviceTimestamp
    }

    func startCapture() {
        accelerometerSampleCount = 0
        motionDetectedDuringCapture = false

        if motionManager.isAccelerometerAvailable, !motionManager.isAccelerometerActive {
            motionManager.accelerometerUpdateInterval = 0.25
            motionManager.startAccelerometerUpdates(to: .main) { [weak self] data, _ in
                guard let self, let acceleration = data?.acceleration else { return }
                self.accelerometerSampleCount += 1
                let magnitude = sqrt(
                    acceleration.x * acceleration.x
                    + acceleration.y * acceleration.y
                    + acceleration.z * acceleration.z
                )
                if abs(magnitude - 1.0) > 0.08 {
                    self.motionDetectedDuringCapture = true
                }
            }
        }

        if motionManager.isGyroAvailable, !motionManager.isGyroActive {
            motionManager.gyroUpdateInterval = 0.25
            motionManager.startGyroUpdates()
        }

        gpsIntegrityProvider.startCapture()
    }

    func stopCapture() {
        if motionManager.isAccelerometerActive {
            motionManager.stopAccelerometerUpdates()
        }
        if motionManager.isGyroActive {
            motionManager.stopGyroUpdates()
        }
        gpsIntegrityProvider.stopCapture()
    }

    func device(language: ConsoleLanguage) -> PlatformRecordEvidence.Device {
        let profile = deviceProfilingProvider.deviceProfile(language: language)
        let current = UIDevice.current
        return PlatformRecordEvidence.Device(
            deviceId: current.identifierForVendor?.uuidString ?? "ios-console-unknown",
            platform: "ios",
            userAgent: "AfricanDataLayer-Console-iOS-Swift/1 (\(profile.model); iOS \(profile.systemVersion))",
            language: profile.language
        )
    }

    func photoMetadata(for dataURL: String, capturedAt: String) -> PlatformRecordEvidence.PhotoMetadata? {
        guard let parsed = Self.parseDataURL(dataURL) else { return nil }
        let exif = photoIntegrityProvider.extractExif(from: parsed.data)
        let exifWidth = (exif[kCGImagePropertyPixelWidth as String] as? NSNumber)?.intValue
        let exifHeight = (exif[kCGImagePropertyPixelHeight as String] as? NSNumber)?.intValue
        let image = exifWidth == nil || exifHeight == nil ? UIImage(data: parsed.data) : nil
        let pixelWidth = exifWidth ?? image.map { Int(($0.size.width * $0.scale).rounded()) }
        let pixelHeight = exifHeight ?? image.map { Int(($0.size.height * $0.scale).rounded()) }
        return PlatformRecordEvidence.PhotoMetadata(
            mimeType: parsed.mimeType,
            originalBytes: parsed.data.count,
            storedBytes: parsed.data.count,
            width: pixelWidth,
            height: pixelHeight,
            capturedAt: capturedAt
        )
    }

    func clientExif(gps: FormGpsValue?, capturedAt: String) -> PlatformRecordEvidence.ClientExif? {
        // `.language` only affects `DeviceProfile.language`, which this method
        // doesn't use — only `.model` does, so the language argument here is
        // arbitrary.
        let deviceModel = deviceProfilingProvider.deviceProfile(language: .en).model
        guard gps != nil else {
            return PlatformRecordEvidence.ClientExif(
                capturedAt: capturedAt,
                deviceMake: "Apple",
                deviceModel: deviceModel
            )
        }
        return PlatformRecordEvidence.ClientExif(
            latitude: gps?.latitude,
            longitude: gps?.longitude,
            capturedAt: capturedAt,
            deviceMake: "Apple",
            deviceModel: deviceModel
        )
    }

    func gpsIntegrity(gps: FormGpsValue?, capturedAt: Date) -> PlatformRecordEvidence.GpsIntegrity {
        let nowMs = Int(deviceTimestamp().timeIntervalSince1970 * 1000)
        let gpsMs = gps == nil ? nil : Int(capturedAt.timeIntervalSince1970 * 1000)
        let integrity = gpsIntegrityProvider.integrityScore(gps: gps, capturedAt: capturedAt)
        // `confidenceScore` only falls back to the neutral `0.5` default when
        // there's no GPS fix or no motion samples to reason about — anything
        // else means the provider had a genuine accelerometer/gyro reading.
        let hasMotionSamples = gps != nil && integrity.confidenceScore != 0.5
        let mockLocationDetected = hasMotionSamples
            && !integrity.motionConsistent
            && integrity.confidenceScore <= Self.mockLocationConfidenceThreshold

        return PlatformRecordEvidence.GpsIntegrity(
            mockLocationDetected: mockLocationDetected,
            mockLocationMethod: mockLocationDetected ? "motion_gps_mismatch" : nil,
            hasAccelerometerData: motionManager.isAccelerometerAvailable && accelerometerSampleCount > 0,
            hasGyroscopeData: motionManager.isGyroAvailable,
            accelerometerSampleCount: accelerometerSampleCount,
            motionDetectedDuringCapture: motionDetectedDuringCapture,
            gpsAccuracyMeters: gps?.accuracyMeters,
            networkType: nil,
            gpsTimestamp: gpsMs,
            deviceTimestamp: nowMs,
            timeDeltaMs: gpsMs.map { nowMs - $0 }
        )
    }

    private static func parseDataURL(_ dataURL: String) -> (mimeType: String, data: Data)? {
        guard let commaIndex = dataURL.firstIndex(of: ",") else { return nil }
        let header = String(dataURL[..<commaIndex])
        guard header.hasPrefix("data:"), header.contains(";base64") else { return nil }
        let mimeStart = header.index(header.startIndex, offsetBy: 5)
        let mimeEnd = header.firstIndex(of: ";") ?? header.endIndex
        let mimeType = String(header[mimeStart..<mimeEnd])
        let encoded = String(dataURL[dataURL.index(after: commaIndex)...])
        guard let data = Data(base64Encoded: encoded) else { return nil }
        return (mimeType, data)
    }
}
