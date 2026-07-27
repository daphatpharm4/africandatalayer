@testable import ADLConsole
import ConsoleForms
import ConsoleModels
import Foundation
import ImageIO
import XCTest

/// Task 7: `NativeCaptureFraudMetadataProvider` is a thin adapter over the
/// injected `GPSIntegrityProviding`/`DeviceProfilingProviding`/
/// `PhotoIntegrityProviding` seams built in earlier tasks. These tests prove
/// it actually delegates — i.e. the values in `PlatformRecordEvidence` come
/// from whatever the injected provider returns, not a hardcoded/mock value —
/// using fakes that record calls and return canned results.
@MainActor
final class CaptureFraudMetadataTests: XCTestCase {
    // MARK: - device(language:) <- DeviceProfilingProviding

    func testDeviceDelegatesToDeviceProfilingProvider() {
        let deviceProfiling = FakeDeviceProfilingProvider(profile: DeviceProfile(
            model: "iPhone99,9",
            systemVersion: "26.0",
            totalMemoryMB: 8_192,
            isLowPowerMode: false,
            thermalState: "nominal",
            lowEndDevice: false,
            language: "fr"
        ))
        let provider = NativeCaptureFraudMetadataProvider(
            gpsIntegrityProvider: FakeGPSIntegrityProvider(),
            deviceProfilingProvider: deviceProfiling,
            photoIntegrityProvider: FakePhotoIntegrityProvider()
        )

        let device = provider.device(language: .fr)

        XCTAssertEqual(deviceProfiling.requestedLanguages, [.fr])
        XCTAssertEqual(device.language, "fr")
        let userAgent = try? XCTUnwrap(device.userAgent)
        XCTAssertTrue(userAgent?.contains("iPhone99,9") ?? false, "userAgent should carry the injected profile's model, not a hardcoded one")
        XCTAssertTrue(userAgent?.contains("26.0") ?? false, "userAgent should carry the injected profile's systemVersion")
    }

    // MARK: - clientExif(gps:capturedAt:) <- DeviceProfilingProviding

    func testClientExifDeviceModelDelegatesToDeviceProfilingProvider() {
        let deviceProfiling = FakeDeviceProfilingProvider(profile: DeviceProfile(
            model: "iPhone14,5",
            systemVersion: "17.4",
            totalMemoryMB: 4_096,
            isLowPowerMode: false,
            thermalState: "nominal",
            lowEndDevice: false,
            language: "en"
        ))
        let provider = NativeCaptureFraudMetadataProvider(
            gpsIntegrityProvider: FakeGPSIntegrityProvider(),
            deviceProfilingProvider: deviceProfiling,
            photoIntegrityProvider: FakePhotoIntegrityProvider()
        )

        let exif = provider.clientExif(gps: nil, capturedAt: "2026-07-24T00:00:00Z")

        XCTAssertEqual(exif?.deviceModel, "iPhone14,5")
    }

    // MARK: - photoMetadata(for:capturedAt:) <- PhotoIntegrityProviding

    func testPhotoMetadataUsesPixelDimensionsFromPhotoIntegrityProviderExif() {
        let photoIntegrity = FakePhotoIntegrityProvider(exif: [
            kCGImagePropertyPixelWidth as String: 4_032,
            kCGImagePropertyPixelHeight as String: 3_024,
        ])
        let provider = NativeCaptureFraudMetadataProvider(
            gpsIntegrityProvider: FakeGPSIntegrityProvider(),
            deviceProfilingProvider: FakeDeviceProfilingProvider(),
            photoIntegrityProvider: photoIntegrity
        )
        let dataURL = "data:image/jpeg;base64," + Data("fake-photo-bytes".utf8).base64EncodedString()

        let metadata = provider.photoMetadata(for: dataURL, capturedAt: "2026-07-24T00:00:00Z")

        XCTAssertEqual(photoIntegrity.extractExifCallCount, 1)
        XCTAssertEqual(metadata?.width, 4_032)
        XCTAssertEqual(metadata?.height, 3_024)
        XCTAssertEqual(metadata?.mimeType, "image/jpeg")
    }

    // MARK: - startCapture()/stopCapture() <- GPSIntegrityProviding

    func testStartAndStopCaptureDelegateToGpsIntegrityProvider() {
        let gpsIntegrity = FakeGPSIntegrityProvider()
        let provider = NativeCaptureFraudMetadataProvider(
            gpsIntegrityProvider: gpsIntegrity,
            deviceProfilingProvider: FakeDeviceProfilingProvider(),
            photoIntegrityProvider: FakePhotoIntegrityProvider()
        )

        provider.startCapture()
        provider.stopCapture()

        XCTAssertEqual(gpsIntegrity.startCaptureCallCount, 1)
        XCTAssertEqual(gpsIntegrity.stopCaptureCallCount, 1)
    }

    // MARK: - gpsIntegrity(gps:capturedAt:) <- GPSIntegrityProviding

    func testGpsIntegrityFlagsMockLocationWhenProviderReportsLowConfidenceMismatch() {
        let gpsIntegrity = FakeGPSIntegrityProvider(result: GPSIntegrityResult(
            isStationary: true,
            motionConsistent: false,
            confidenceScore: 0.3
        ))
        let provider = NativeCaptureFraudMetadataProvider(
            gpsIntegrityProvider: gpsIntegrity,
            deviceProfilingProvider: FakeDeviceProfilingProvider(),
            photoIntegrityProvider: FakePhotoIntegrityProvider()
        )
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 5)

        let integrity = provider.gpsIntegrity(gps: gps, capturedAt: Date())

        XCTAssertEqual(gpsIntegrity.integrityScoreCallCount, 1)
        XCTAssertTrue(integrity.mockLocationDetected, "a low-confidence motion/GPS mismatch from the injected provider should flag mockLocationDetected — it must not stay hardcoded false")
        XCTAssertEqual(integrity.mockLocationMethod, "motion_gps_mismatch")
    }

    func testGpsIntegrityDoesNotFlagMockLocationWhenProviderReportsConsistentMotion() {
        let gpsIntegrity = FakeGPSIntegrityProvider(result: GPSIntegrityResult(
            isStationary: true,
            motionConsistent: true,
            confidenceScore: 0.85
        ))
        let provider = NativeCaptureFraudMetadataProvider(
            gpsIntegrityProvider: gpsIntegrity,
            deviceProfilingProvider: FakeDeviceProfilingProvider(),
            photoIntegrityProvider: FakePhotoIntegrityProvider()
        )
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.7, accuracyMeters: 60)

        let integrity = provider.gpsIntegrity(gps: gps, capturedAt: Date())

        XCTAssertFalse(integrity.mockLocationDetected)
        XCTAssertNil(integrity.mockLocationMethod)
    }

    func testGpsIntegrityDoesNotFlagMockLocationWhenThereIsNoGpsFix() {
        let gpsIntegrity = FakeGPSIntegrityProvider(result: GPSIntegrityResult(
            isStationary: true,
            motionConsistent: false,
            confidenceScore: 0.5
        ))
        let provider = NativeCaptureFraudMetadataProvider(
            gpsIntegrityProvider: gpsIntegrity,
            deviceProfilingProvider: FakeDeviceProfilingProvider(),
            photoIntegrityProvider: FakePhotoIntegrityProvider()
        )

        let integrity = provider.gpsIntegrity(gps: nil, capturedAt: Date())

        XCTAssertFalse(integrity.mockLocationDetected)
        XCTAssertNil(integrity.mockLocationMethod)
    }
}

// MARK: - Fakes

private final class FakeGPSIntegrityProvider: GPSIntegrityProviding, @unchecked Sendable {
    private(set) var startCaptureCallCount = 0
    private(set) var stopCaptureCallCount = 0
    private(set) var integrityScoreCallCount = 0
    private let result: GPSIntegrityResult

    init(result: GPSIntegrityResult = GPSIntegrityResult(isStationary: true, motionConsistent: true, confidenceScore: 0.5)) {
        self.result = result
    }

    func startCapture() { startCaptureCallCount += 1 }
    func stopCapture() { stopCaptureCallCount += 1 }

    func integrityScore(gps: FormGpsValue?, capturedAt: Date) -> GPSIntegrityResult {
        integrityScoreCallCount += 1
        return result
    }
}

private final class FakeDeviceProfilingProvider: DeviceProfilingProviding, @unchecked Sendable {
    private(set) var requestedLanguages: [ConsoleLanguage] = []
    private let profile: DeviceProfile

    init(profile: DeviceProfile = DeviceProfile(
        model: "iPhone-test",
        systemVersion: "17.0",
        totalMemoryMB: 4_096,
        isLowPowerMode: false,
        thermalState: "nominal",
        lowEndDevice: false,
        language: "en"
    )) {
        self.profile = profile
    }

    func deviceProfile(language: ConsoleLanguage) -> DeviceProfile {
        requestedLanguages.append(language)
        return profile
    }
}

private final class FakePhotoIntegrityProvider: PhotoIntegrityProviding, @unchecked Sendable {
    private(set) var extractExifCallCount = 0
    private let exif: [String: Any]

    init(exif: [String: Any] = [:]) {
        self.exif = exif
    }

    func extractExif(from photoData: Data) -> [String: Any] {
        extractExifCallCount += 1
        return exif
    }

    func sha256Hash(of photoData: Data) -> String {
        "fake-hash"
    }
}
