# Intelligent Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the feature gap between the web/Capacitor CaptureView and the iOS console CaptureView by adding voice-to-text field input, EXIF extraction, GPS integrity validation, device profiling, submission deduplication, and batch capture mode.

**Architecture:** Each capability gets a protocol-based provider (matching `LocationServiceProtocol` / `CoreLocationService` pattern). Providers are injected into `NativeCaptureFraudMetadataProvider` and `CaptureViewModel`. The fraud metadata provider delegates to specialized providers. Dedup and batch mode are CaptureViewModel-level integrations with API and UI additions.

**Tech Stack:** Swift 6, SwiftUI, CMMotionManager, SFSpeechRecognizer, CGImageSource, CryptoKit, sysctl, XCTest

## Global Constraints

- All new providers follow the existing `LocationServiceProtocol` pattern: a `Sendable` protocol and a concrete `final class` implementation in `ADLConsole/Support/`, with a mock in `ADLConsoleTests/`.
- Every new feature must have tests in the existing XCTest target at `ADLConsoleTests/`.
- No new dependencies. Use only Apple frameworks already imported by the target (UIKit, CoreMotion, CryptoKit, AVFoundation, Speech).
- All new Info.plist usage descriptions go into `project.yml` (XcodeGen generates Info.plist).
- GPS integrity: CMMotionManager must start on capture begin and stop on submit to avoid battery drain.
- SHA-256 hashing already exists in `CaptureMediaStore` — the photo integrity provider wraps or reuses it rather than duplicating.

---

### Task 1: Photo Integrity Provider (EXIF Extraction + SHA-256)

**Files:**
- Create: `ADLConsole/Support/PhotoIntegrityProvider.swift`
- Test: `ADLConsoleTests/PhotoIntegrityProviderTests.swift`

**Interfaces:**
- Consumes: `Data` (raw image bytes)
- Produces: `PhotoIntegrityProviding` protocol, `CoreImagePhotoIntegrityProvider` implementation, EXIF dictionary, SHA-256 string

- [ ] **Step 1: Write the failing tests**
```swift
@testable import ADLConsole
import XCTest

final class PhotoIntegrityProviderTests: XCTestCase {
    func testExtractExifReturnsKnownKeys() throws {
        let provider = CoreImagePhotoIntegrityProvider()
        let testJPEG = try XCTUnwrap(testImageData())
        let exif = provider.extractExif(from: testJPEG)
        XCTAssertNotNil(exif["Make"])
        XCTAssertNotNil(exif["Model"])
        XCTAssertNotNil(exif[kCGImagePropertyExifDateTimeOriginal as String])
    }

    func testExtractExifReturnsNilForStrippedImage() {
        let provider = CoreImagePhotoIntegrityProvider()
        let stripped = Data("not an image".utf8)
        let exif = provider.extractExif(from: stripped)
        XCTAssertTrue(exif.isEmpty)
    }

    func testSha256HashReturnsConsistentValue() {
        let provider = CoreImagePhotoIntegrityProvider()
        let data = Data("hello".utf8)
        let hash1 = provider.sha256Hash(of: data)
        let hash2 = provider.sha256Hash(of: data)
        XCTAssertEqual(hash1, hash2)
        XCTAssertEqual(hash1.count, 64)
    }

    func testSha256HashDiffersForDifferentData() {
        let provider = CoreImagePhotoIntegrityProvider()
        let hash1 = provider.sha256Hash(of: Data("hello".utf8))
        let hash2 = provider.sha256Hash(of: Data("world".utf8))
        XCTAssertNotEqual(hash1, hash2)
    }

    /// Creates a minimal JPEG with EXIF metadata for testing.
    private func testImageData() -> Data? {
        // Build minimal JPEG with EXIF via CGImageDestination
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let context = CGContext(
            data: nil,
            width: 2,
            height: 2,
            bitsPerComponent: 8,
            bytesPerRow: 8,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        )
        guard let cgImage = context?.makeImage() else { return nil }
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, "public.jpeg" as CFString, 1, nil) else {
            return nil
        }
        let exif: [CFString: Any] = [
            kCGImagePropertyExifDictionary: [
                kCGImagePropertyExifDateTimeOriginal: "2026:07:24 10:00:00",
                kCGImagePropertyExifISOSpeedRatings: [100],
                kCGImagePropertyExifFocalLength: 4.25,
            ],
            kCGImagePropertyTIFFDictionary: [
                kCGImagePropertyTIFFMake: "Apple",
                kCGImagePropertyTIFFModel: "iPhone 15,2",
            ],
            kCGImagePropertyGPSDictionary: [
                kCGImagePropertyGPSLatitude: 4.05,
                kCGImagePropertyGPSLongitude: 9.70,
            ],
        ]
        CGImageDestinationAddImage(destination, cgImage, exif as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return data as Data
    }
}
```
- [ ] **Step 2: Run to verify failure** (no provider to import yet)
```bash
cd /Users/charlesvictormahouve/GitHub/africandatalayer/ios-console && xcodebuild test -scheme ADLConsole-Debug -target ADLConsoleTests -only-testing:PhotoIntegrityProviderTests 2>&1 | tail -20
```
- [ ] **Step 3: Write minimal implementation**
```swift
import CoreGraphics
import CryptoKit
import Foundation
import ImageIO

protocol PhotoIntegrityProviding: Sendable {
    func extractExif(from photoData: Data) -> [String: Any]
    func sha256Hash(of photoData: Data) -> String
}

final class CoreImagePhotoIntegrityProvider: PhotoIntegrityProviding {
    func extractExif(from photoData: Data) -> [String: Any] {
        guard let source = CGImageSourceCreateWithData(photoData as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any] else {
            return [:]
        }
        return properties
    }

    func sha256Hash(of photoData: Data) -> String {
        SHA256.hash(data: photoData).compactMap { String(format: "%02x", $0) }.joined()
    }
}
```
- [ ] **Step 4: Run to verify pass**
```bash
cd /Users/charlesvictormahouve/GitHub/africandatalayer/ios-console && xcodebuild test -scheme ADLConsole-Debug -target ADLConsoleTests -only-testing:PhotoIntegrityProviderTests 2>&1 | tail -20
```
- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(intelligent-capture): add PhotoIntegrityProviding protocol and CoreImagePhotoIntegrityProvider"
```

---

### Task 2: Device Profiling Provider

**Files:**
- Create: `ADLConsole/Support/DeviceProfilingProvider.swift`
- Test: `ADLConsoleTests/DeviceProfilingProviderTests.swift`

**Interfaces:**
- Consumes: `ConsoleLanguage`
- Produces: `DeviceProfilingProviding` protocol, `DeviceProfile` struct, `SystemDeviceProfilingProvider` implementation

- [ ] **Step 1: Write the failing tests**
```swift
@testable import ADLConsole
import XCTest

final class DeviceProfilingProviderTests: XCTestCase {
    func testDeviceProfileReturnsPopulatedValues() {
        let provider = SystemDeviceProfilingProvider()
        let profile = provider.deviceProfile(language: .en)
        XCTAssertFalse(profile.model.isEmpty)
        XCTAssertFalse(profile.systemVersion.isEmpty)
        XCTAssertGreaterThan(profile.totalMemoryMB, 0)
    }

    func testDeviceProfileLowEndDetectionBelow2GB() {
        let provider = SystemDeviceProfilingProvider()
        let profile = provider.deviceProfile(language: .en)
        // On real hardware this will be false for modern devices.
        // The heuristic: < 2048 MB = low end.
        let expectedLowEnd = profile.totalMemoryMB < 2048
        XCTAssertEqual(profile.lowEndDevice, expectedLowEnd)
    }

    func testDeviceProfileIncludesLanguage() {
        let provider = SystemDeviceProfilingProvider()
        let enProfile = provider.deviceProfile(language: .en)
        let frProfile = provider.deviceProfile(language: .fr)
        XCTAssertEqual(enProfile.language, "en")
        XCTAssertEqual(frProfile.language, "fr")
    }

    func testDeviceProfileThermalStateIsKnown() {
        let provider = SystemDeviceProfilingProvider()
        let profile = provider.deviceProfile(language: .en)
        let validStates = ["nominal", "fair", "serious", "critical"]
        XCTAssertTrue(validStates.contains(profile.thermalState))
    }
}
```
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Write minimal implementation**
```swift
import Foundation
#if canImport(UIKit)
import UIKit
#endif

protocol DeviceProfilingProviding: Sendable {
    func deviceProfile(language: ConsoleLanguage) -> DeviceProfile
}

struct DeviceProfile: Equatable, Sendable, Codable {
    var model: String
    var systemVersion: String
    var totalMemoryMB: UInt64
    var isLowPowerMode: Bool
    var thermalState: String
    var lowEndDevice: Bool
    var language: String
}

final class SystemDeviceProfilingProvider: DeviceProfilingProviding {
    private let lowMemoryThresholdMB: UInt64 = 2048
    private let lowEndModels: Set<String> = [
        "iPhone8,1", "iPhone8,2",     // iPhone 6s, 6s Plus
        "iPhone8,4",                   // iPhone SE (1st gen)
        "iPhone9,1", "iPhone9,3",     // iPhone 7
        "iPhone9,2", "iPhone9,4",     // iPhone 7 Plus
    ]

    func deviceProfile(language: ConsoleLanguage) -> DeviceProfile {
        let model = Self.readMachineModel()
        let memoryMB = ProcessInfo.processInfo.physicalMemory / 1_024 / 1_024
        let thermalState = Self.thermalStateString(ProcessInfo.processInfo.thermalState)
        let isLowEnd = lowEndModels.contains(model) || memoryMB < lowMemoryThresholdMB

        return DeviceProfile(
            model: model,
            systemVersion: UIDevice.current.systemVersion,
            totalMemoryMB: memoryMB,
            isLowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled,
            thermalState: thermalState,
            lowEndDevice: isLowEnd,
            language: language.rawValue
        )
    }

    private static func readMachineModel() -> String {
        var size = 0
        sysctlbyname("hw.machine", nil, &size, nil, 0)
        guard size > 0 else { return UIDevice.current.model }
        var machine = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.machine", &machine, &size, nil, 0)
        return String(cString: machine).trimmingCharacters(in: .controlCharacters)
    }

    private static func thermalStateString(_ state: ProcessInfo.ThermalState) -> String {
        switch state {
        case .nominal: return "nominal"
        case .fair: return "fair"
        case .serious: return "serious"
        case .critical: return "critical"
        @unknown default: return "nominal"
        }
    }
}
```
- [ ] **Step 4: Run to verify pass**
- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(intelligent-capture): add DeviceProfilingProviding protocol and SystemDeviceProfilingProvider"
```

---

### Task 3: GPS Integrity Provider (Extract from NativeCaptureFraudMetadataProvider)

**Files:**
- Create: `ADLConsole/Support/GPSIntegrityProvider.swift`
- Test: `ADLConsoleTests/GPSIntegrityProviderTests.swift`

**Interfaces:**
- Consumes: `FormGpsValue`, `Date`, motion sensor data
- Produces: `GPSIntegrityProviding` protocol, `GPSIntegrityResult` struct, `MotionGPSIntegrityProvider` implementation

- [ ] **Step 1: Write the failing tests**
```swift
@testable import ADLConsole
import ConsoleForms
import XCTest

final class GPSIntegrityProviderTests: XCTestCase {
    func testIntegrityScoreWhenNoMotionData() {
        let provider = MotionGPSIntegrityProvider(motionManager: MockCMMotionManager())
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 8)
        let result = provider.integrityScore(gps: gps, capturedAt: Date())
        XCTAssertFalse(result.motionConsistent)
        XCTAssertEqual(result.confidenceScore, 0.5)
    }

    func testIntegrityScoreWithStationaryData() {
        let mockManager = MockCMMotionManager()
        mockManager.stubAccelerometerData = CMAccelerometerData()
        let provider = MotionGPSIntegrityProvider(motionManager: mockManager)
        let gps = FormGpsValue(latitude: 4.05, longitude: 9.70, accuracyMeters: 8)
        let result = provider.integrityScore(gps: gps, capturedAt: Date())
        // Without motion samples processed, confidence stays baseline
        XCTAssertEqual(result.confidenceScore, 0.5)
    }

    func testIntegrityScoreWithNoGps() {
        let provider = MotionGPSIntegrityProvider(motionManager: MockCMMotionManager())
        let result = provider.integrityScore(gps: nil, capturedAt: Date())
        XCTAssertFalse(result.motionConsistent)
        XCTAssertEqual(result.confidenceScore, 0.5)
    }
}

/// A mock CMMotionManager that returns canned data without hardware.
private final class MockCMMotionManager: CMMotionManager {
    var stubAccelerometerData: CMAccelerometerData?
    var stubGyroData: CMGyroData?
    override var isAccelerometerAvailable: Bool { true }
    override var isAccelerometerActive: Bool { false }
    override var isGyroAvailable: Bool { true }
    override var isGyroActive: Bool { false }
    override func startAccelerometerUpdates(to queue: OperationQueue, withHandler handler: @escaping CMAccelerometerHandler) {
        handler(stubAccelerometerData, nil)
    }
    override func startGyroUpdates() {}
    override func stopAccelerometerUpdates() {}
    override func stopGyroUpdates() {}
}
```
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Write minimal implementation**
```swift
import ConsoleForms
import CoreMotion
import Foundation

protocol GPSIntegrityProviding: Sendable {
    func integrityScore(gps: FormGpsValue?, capturedAt: Date) -> GPSIntegrityResult
    var accelerometerSampleCount: Int { get }
    var motionDetectedDuringCapture: Bool { get }
}

struct GPSIntegrityResult: Equatable, Sendable {
    let isStationary: Bool
    let motionConsistent: Bool
    let confidenceScore: Double
}

final class MotionGPSIntegrityProvider: GPSIntegrityProviding {
    private let motionManager: CMMotionManager
    private(set) var accelerometerSampleCount = 0
    private(set) var motionDetectedDuringCapture = false
    private let lock = NSLock()

    init(motionManager: CMMotionManager = CMMotionManager()) {
        self.motionManager = motionManager
    }

    func startCapture() {
        lock.withLock {
            accelerometerSampleCount = 0
            motionDetectedDuringCapture = false
        }
        guard motionManager.isAccelerometerAvailable, !motionManager.isAccelerometerActive else { return }
        motionManager.accelerometerUpdateInterval = 0.25
        motionManager.startAccelerometerUpdates(to: .main) { [weak self] data, _ in
            guard let self, let acceleration = data?.acceleration else { return }
            self.lock.withLock {
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

    func integrityScore(gps: FormGpsValue?, capturedAt: Date) -> GPSIntegrityResult {
        let samples: Int
        let motion: Bool
        lock.withLock {
            samples = accelerometerSampleCount
            motion = motionDetectedDuringCapture
        }
        guard let gps else {
            return GPSIntegrityResult(isStationary: true, motionConsistent: false, confidenceScore: 0.5)
        }
        let hasMotionData = samples > 0
        let isStationary = gps.accuracyMeters.map { $0 > 50 } ?? true
        let motionConsistent = hasMotionData ? (isStationary == !motion) : false
        let confidence: Double = {
            guard hasMotionData else { return 0.4 }
            if motionConsistent { return 0.85 }
            if isStationary && motion { return 0.3 }
            return 0.6
        }()
        return GPSIntegrityResult(isStationary: isStationary, motionConsistent: motionConsistent, confidenceScore: confidence)
    }
}
```
- [ ] **Step 4: Run to verify pass**
- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(intelligent-capture): add GPSIntegrityProviding protocol and MotionGPSIntegrityProvider"
```

---

### Task 4: Speech Recognition Provider (Voice-to-Text)

**Files:**
- Create: `ADLConsole/Support/SpeechRecognitionProvider.swift`
- Test: `ADLConsoleTests/SpeechRecognitionProviderTests.swift`
- Modify: `ADLConsole/Screens/Capture/CaptureFieldControl.swift` (add mic button to text/number fields)
- Modify: `ios-console/project.yml` (add `NSSpeechRecognitionUsageDescription`)

**Interfaces:**
- Consumes: Audio input, user authorization
- Produces: `SpeechRecognitionProviding` protocol, `SFSpeechRecognizerService` implementation, mic button UI in text/number fields

- [ ] **Step 1: Write the failing tests**
```swift
@testable import ADLConsole
import XCTest

final class SpeechRecognitionProviderTests: XCTestCase {
    func testRequestTranscriptionReturnsCannedText() async throws {
        let provider = MockSpeechRecognitionProvider()
        provider.stubResult = "Hello from mock"
        let text = try await provider.requestTranscription()
        XCTAssertEqual(text, "Hello from mock")
    }

    func testRequestTranscriptionThrowsWhenNotAvailable() async {
        let provider = MockSpeechRecognitionProvider()
        provider.stubError = SpeechRecognitionError.unavailable
        do {
            _ = try await provider.requestTranscription()
            XCTFail("expected error")
        } catch SpeechRecognitionError.unavailable {
            // expected
        } catch {
            XCTFail("wrong error type")
        }
    }

    func testIsAvailableReflectsAvailability() {
        let provider = MockSpeechRecognitionProvider()
        provider.stubIsAvailable = true
        XCTAssertTrue(provider.isAvailable)
        provider.stubIsAvailable = false
        XCTAssertFalse(provider.isAvailable)
    }
}

private final class MockSpeechRecognitionProvider: SpeechRecognitionProviding {
    var stubResult: String?
    var stubError: Error?
    var stubIsAvailable = true

    var isAvailable: Bool { stubIsAvailable }

    func requestTranscription() async throws -> String {
        if let error = stubError { throw error }
        return stubResult ?? ""
    }
}
```
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Write minimal implementation**

**`ADLConsole/Support/SpeechRecognitionProvider.swift`:**
```swift
import AVFoundation
import Foundation
import Speech

enum SpeechRecognitionError: Error {
    case unavailable
    case permissionDenied
    case recognitionFailed(String)
}

protocol SpeechRecognitionProviding: Sendable {
    var isAvailable: Bool { get }
    func requestTranscription() async throws -> String
}

final class SFSpeechRecognizerService: NSObject, SpeechRecognitionProviding, @unchecked Sendable {
    private let recognizer: SFSpeechRecognizer
    private var recognitionTask: SFSpeechRecognitionTask?
    private var audioEngine = AVAudioEngine()

    override init() {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en_US")) else {
            self.recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en_US"))!
            super.init()
            return
        }
        self.recognizer = recognizer
        super.init()
    }

    var isAvailable: Bool {
        SFSpeechRecognizer.authorizationStatus() == .authorized && recognizer.isAvailable
    }

    func requestTranscription() async throws -> String {
        let status = SFSpeechRecognizer.authorizationStatus()
        if status != .authorized {
            let granted = await requestAuthorization()
            guard granted else { throw SpeechRecognitionError.permissionDenied }
        }
        guard recognizer.isAvailable else { throw SpeechRecognitionError.unavailable }
        return try await performRecognition()
    }

    private func requestAuthorization() async -> Bool {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
    }

    private func performRecognition() async throws -> String {
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        let recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        recognitionRequest.shouldReportPartialResults = false
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        audioEngine.prepare()
        try audioEngine.start()
        return try await withCheckedThrowingContinuation { [weak self] continuation in
            guard let self else {
                continuation.resume(throwing: SpeechRecognitionError.recognitionFailed("Deallocated"))
                return
            }
            self.recognitionTask = self.recognizer.recognitionTask(with: recognitionRequest) { result, error in
                self.audioEngine.stop()
                inputNode.removeTap(onBus: 0)
                try? audioSession.setActive(false)
                if let error {
                    continuation.resume(throwing: SpeechRecognitionError.recognitionFailed(error.localizedDescription))
                    return
                }
                guard let result, result.isFinal else { return }
                continuation.resume(returning: result.bestTranscription.formattedString)
            }
        }
    }
}
```

**Modify `CaptureFieldControl.swift` — add speech recognition callback and mic buttons:**
- Add `onVoiceInput: ((String) -> Void)? = nil` parameter
- Add mic button overlay to `.text` and `.number` cases

- [ ] **Step 4: Run to verify pass**
- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(intelligent-capture): add SpeechRecognitionProviding protocol and mic button UI"
```

---

### Task 5: Dedup Check Before Submission

**Files:**
- Modify: `Packages/ConsoleCore/Sources/ConsoleAPI/PlatformAPIClient.swift`
- Create: `ADLConsole/Screens/Capture/DedupWarningSheet.swift`
- Modify: `ADLConsole/Screens/Capture/CaptureViewModel.swift`
- Modify: `ADLConsole/Screens/Capture/CaptureView.swift`
- Modify: `ADLConsoleTests/CaptureViewModelTests.swift`

**Interfaces:**
- Consumes: `PlatformAPIClient`, field values hash
- Produces: Dedup API method, `@Published dedupState`, `DedupWarningSheet` UI

- [ ] **Step 1: Write the failing tests**

```swift
// In CaptureViewModelTests.swift, add to `testSubmitIncludesFraudMetadataEvidence` section:

func testSubmitChecksDedupBeforeEnqueueing() async { ... }
func testSubmitWarnsOnDuplicateFound() async { ... }
func testSubmitProceedsWhenDedupClean() async { ... }

```
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Write minimal implementation**

**PlatformAPIClient addition (in existing file, add after `nearbyPlatformPoints`):**
```swift
public struct DedupCheckRequest: Encodable {
    public var projectId: String
    public var recordTypeKey: String
    public var fieldValuesHash: String
    public var organizationId: String
}

public struct DedupCheckResponse: Decodable {
    public var isDuplicate: Bool
    public var existingSubmission: ExistingSubmission?
}

public struct ExistingSubmission: Decodable, Equatable, Sendable {
    public var id: String
    public var capturedAt: String
    public var capturedBy: String
}

public func checkDedup(projectId: String, recordTypeKey: String, fieldValuesHash: String, organizationId: String) async throws -> DedupCheckResponse {
    let bodyData = try JSONEncoder().encode(
        DedupCheckRequest(projectId: projectId, recordTypeKey: recordTypeKey, fieldValuesHash: fieldValuesHash, organizationId: organizationId)
    )
    return try await callPlatform("record_dedup", method: .post, bodyData: bodyData)
}
```

**CaptureViewModel additions:**
```swift
enum DedupState: Equatable {
    case idle
    case checking
    case clean
    case duplicate(existing: DedupExisting?)
}

struct DedupExisting: Equatable {
    var id: String
    var capturedAt: Date
    var capturedBy: String
}

@Published private(set) var dedupState: DedupState = .idle

func checkDedup(for draft: RecordDraft) async {
    guard let projectOption = selectedProjectOption else { return }
    dedupState = .checking
    do {
        let data = try JSONEncoder().encode(draft.data)
        let hash = SHA256.hash(data: data).compactMap { String(format: "%02x", $0) }.joined()
        let response = try await apiClient.checkDedup(
            projectId: projectOption.project.id,
            recordTypeKey: draft.recordTypeKey,
            fieldValuesHash: hash,
            organizationId: organizationId
        )
        if response.isDuplicate, let existing = response.existingSubmission {
            let formatter = ISO8601DateFormatter()
            dedupState = .duplicate(existing: DedupExisting(
                id: existing.id,
                capturedAt: formatter.date(from: existing.capturedAt) ?? Date(),
                capturedBy: existing.capturedBy
            ))
        } else {
            dedupState = .clean
        }
    } catch {
        // Dedup API unavailable — proceed without blocking
        dedupState = .clean
    }
}
```

Modify `submit()` to run dedup check after validation, before enqueueing.
- [ ] **Step 4: Run to verify pass**
- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(intelligent-capture): add dedup check before submission"
```

---

### Task 6: Batch Capture Mode

**Files:**
- Modify: `ADLConsole/Screens/Capture/CaptureViewModel.swift`
- Modify: `ADLConsole/Screens/Capture/CaptureView.swift`
- Modify: `ADLConsoleTests/CaptureViewModelTests.swift`

**Interfaces:**
- Consumes: Submit success signal, mission quota target
- Produces: `isBatchMode`, `batchTarget`, `batchCompleted`, `submitInBatch()`, batch progress UI

- [ ] **Step 1: Write the failing tests**

```swift
// Add to CaptureViewModelTests.swift:

func testBatchModeIncrementsProgressAfterSubmit() async { ... }
func testBatchModeResetsFormAfterSubmit() async { ... }
func testBatchModeFinishExitsBatchMode() async { ... }
```
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Write minimal implementation**

**CaptureViewModel additions:**
```swift
@Published var isBatchMode: Bool = false
@Published var batchTarget: Int = 0
@Published var batchCompleted: Int = 0

func submitInBatch() async {
    await submit()
    if isBatchMode, submitState == .synced || submitState == .queuedPendingSync {
        batchCompleted += 1
        resetDraftValues(resetSubmitState: false)
        submitState = .idle
    }
}

func finishBatch() {
    isBatchMode = false
    batchCompleted = 0
    batchTarget = 0
}
```

**CaptureView additions:**
- Batch mode toggle button
- Batch progress floating bar ("3 of 12 collected")
- "Finish batch" button when batch mode active
- Wire submit to `submitInBatch()` when `isBatchMode`
- [ ] **Step 4: Run to verify pass**
- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(intelligent-capture): add batch capture mode"
```

---

### Task 7: Wire Providers into Fraud Metadata Provider + CaptureViewModel

**Files:**
- Modify: `ADLConsole/Support/CaptureFraudMetadata.swift`
- Modify: `ADLConsole/Screens/Capture/CaptureViewModel.swift`
- Modify: `ADLConsole/Screens/Capture/CaptureView.swift`
- Modify: `ADLConsoleTests/CaptureViewModelTests.swift` (update stub, add integration tests)
- Modify: `ADLConsoleTests/CaptureFraudMetadataTests.swift` (create if needed)
- Modify: `ios-console/project.yml` (add `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription`)

**Interfaces:**
- Consumes: All providers from Tasks 1-4
- Produces: Updated `NativeCaptureFraudMetadataProvider` using real providers, updated `CaptureViewModel` injecting them

- [ ] **Step 1: Write the failing tests**

```swift
// New file: ADLConsoleTests/CaptureFraudMetadataTests.swift
// Test that NativeCaptureFraudMetadataProvider delegates to injected providers
```
- [ ] **Step 2: Run to verify failure**
- [ ] **Step 3: Update implementations**

**`NativeCaptureFraudMetadataProvider` refactored to use injected providers:**
```swift
@MainActor
final class NativeCaptureFraudMetadataProvider: CaptureFraudMetadataProviding {
    private let gpsIntegrityProvider: GPSIntegrityProviding
    private let deviceProfilingProvider: DeviceProfilingProviding
    private let photoIntegrityProvider: PhotoIntegrityProviding
    private let motionProvider: MotionGPSIntegrityProvider  // for start/stop
    private let deviceTimestamp: () -> Date

    init(
        gpsIntegrityProvider: GPSIntegrityProviding = MotionGPSIntegrityProvider(),
        deviceProfilingProvider: DeviceProfilingProviding = SystemDeviceProfilingProvider(),
        photoIntegrityProvider: PhotoIntegrityProviding = CoreImagePhotoIntegrityProvider(),
        deviceTimestamp: @escaping () -> Date = { Date() }
    ) {
        self.gpsIntegrityProvider = gpsIntegrityProvider
        self.deviceProfilingProvider = deviceProfilingProvider
        self.photoIntegrityProvider = photoIntegrityProvider
        self.motionProvider = gpsIntegrityProvider as? MotionGPSIntegrityProvider ?? MotionGPSIntegrityProvider()
        self.deviceTimestamp = deviceTimestamp
    }
    // ... delegate to providers in each method
}
```

**Update `CaptureViewModel` to accept and wire speech recognition:**
- Add `speechRecognitionProvider: SpeechRecognitionProviding?` parameter
- Add `func requestVoiceInput(for key: String)` method
- Wire mic button in `CaptureFieldControl` via `onVoiceInput` callback
- [ ] **Step 4: Run to verify pass**
- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(intelligent-capture): wire all providers into CaptureViewModel and fraud metadata"
```
