import ConsoleForms
import ConsoleModels
import CoreMotion
import Foundation
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

@MainActor
final class NativeCaptureFraudMetadataProvider: CaptureFraudMetadataProviding {
    private let motionManager = CMMotionManager()
    private var accelerometerSampleCount = 0
    private var motionDetectedDuringCapture = false
    private let deviceTimestamp: () -> Date

    init(deviceTimestamp: @escaping () -> Date = { Date() }) {
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
    }

    func stopCapture() {
        if motionManager.isAccelerometerActive {
            motionManager.stopAccelerometerUpdates()
        }
        if motionManager.isGyroActive {
            motionManager.stopGyroUpdates()
        }
    }

    func device(language: ConsoleLanguage) -> PlatformRecordEvidence.Device {
        let current = UIDevice.current
        return PlatformRecordEvidence.Device(
            deviceId: current.identifierForVendor?.uuidString ?? "ios-console-unknown",
            platform: "ios",
            userAgent: "AfricanDataLayer-Console-iOS-Swift/1",
            language: language.rawValue
        )
    }

    func photoMetadata(for dataURL: String, capturedAt: String) -> PlatformRecordEvidence.PhotoMetadata? {
        guard let parsed = Self.parseDataURL(dataURL) else { return nil }
        let image = UIImage(data: parsed.data)
        let pixelWidth = image.map { Int(($0.size.width * $0.scale).rounded()) }
        let pixelHeight = image.map { Int(($0.size.height * $0.scale).rounded()) }
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
        guard gps != nil else {
            return PlatformRecordEvidence.ClientExif(
                capturedAt: capturedAt,
                deviceMake: "Apple",
                deviceModel: UIDevice.current.model
            )
        }
        return PlatformRecordEvidence.ClientExif(
            latitude: gps?.latitude,
            longitude: gps?.longitude,
            capturedAt: capturedAt,
            deviceMake: "Apple",
            deviceModel: UIDevice.current.model
        )
    }

    func gpsIntegrity(gps: FormGpsValue?, capturedAt: Date) -> PlatformRecordEvidence.GpsIntegrity {
        let nowMs = Int(deviceTimestamp().timeIntervalSince1970 * 1000)
        let gpsMs = gps == nil ? nil : Int(capturedAt.timeIntervalSince1970 * 1000)
        return PlatformRecordEvidence.GpsIntegrity(
            mockLocationDetected: false,
            mockLocationMethod: nil,
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
