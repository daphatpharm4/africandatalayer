import AVFoundation
import Foundation
import Speech

/// Seam between the capture flow's voice-to-text field input and
/// `SFSpeechRecognizer`/`AVAudioEngine` — mirrors the injectable
/// `PhotoIntegrityProviding`/`CoreImagePhotoIntegrityProvider`,
/// `DeviceProfilingProviding`/`SystemDeviceProfilingProvider`, and
/// `GPSIntegrityProviding`/`MotionGPSIntegrityProvider` patterns used
/// elsewhere in this app. Authorization status reads/requests, recognizer
/// availability, and the actual audio-capture-and-transcribe work are all
/// injected as `@escaping @Sendable` closures (defaulted to the real
/// `SFSpeechRecognizer`/`AVAudioEngine` calls) so the authorization-gating
/// logic in `requestTranscription()` can be unit-tested deterministically —
/// without a microphone, without prompting for permission, and without
/// depending on whatever authorization state the test runner happens to
/// have.
///
/// NOTE: this type only provides the transcription seam. It is not yet
/// wired into `CaptureFieldControl`/`CaptureViewModel` — that field-binding
/// integration happens in a later task.
protocol SpeechRecognitionProviding: Sendable {
    /// Whether a transcription request is likely to succeed right now:
    /// speech recognition is authorized and the recognizer has a usable
    /// (on-device or server) route for the current locale/connectivity.
    /// Callers should still handle `requestTranscription()` throwing even
    /// when this reads `true` — state can change between the check and the
    /// request (e.g. connectivity drops for a server-backed recognizer).
    var isAvailable: Bool { get }

    /// Requests speech-recognition authorization if not already determined,
    /// captures audio from the microphone, and returns the final
    /// transcription. Throws `SpeechRecognitionError.permissionDenied` if
    /// authorization is denied/restricted, `.unavailable` if the recognizer
    /// has no usable route, or `.recognitionFailed` if the recognition task
    /// itself errors.
    func requestTranscription() async throws -> String
}

enum SpeechRecognitionError: Error, Equatable {
    case unavailable
    case permissionDenied
    case recognitionFailed(String)

    /// Bilingual, user-facing message for `CaptureViewModel.requestVoiceInput`
    /// to surface — mirrors `LocationServiceError.message(_:)`'s pattern for
    /// the capture flow's other permission-gated hardware seam.
    func message(_ language: ConsoleLanguage) -> String {
        switch self {
        case .permissionDenied:
            return language.t(
                "Microphone access is denied. Enable it in Settings to use voice input.",
                "L'accès au microphone est refusé. Activez-le dans Réglages pour utiliser la saisie vocale."
            )
        case .unavailable:
            return language.t(
                "Voice input is unavailable right now.",
                "La saisie vocale est indisponible pour le moment."
            )
        case .recognitionFailed:
            return language.t(
                "Could not understand the audio. Try again.",
                "Impossible de comprendre l'audio. Réessayez."
            )
        }
    }
}

/// Production `SpeechRecognitionProviding` backed by `SFSpeechRecognizer`
/// (authorization + availability) and `AVAudioEngine` +
/// `SFSpeechAudioBufferRecognitionRequest` (audio capture + transcription).
/// All system interaction points are injected as closures defaulted to the
/// real implementations, so `SpeechRecognitionProviderTests` can drive the
/// authorization-gating branches (`authorized` / `denied` / `notDetermined`)
/// and the availability check deterministically, and supply a canned
/// transcription result, without touching the microphone or the system
/// permission prompt.
final class SFSpeechRecognizerService: SpeechRecognitionProviding, @unchecked Sendable {
    private let readAuthorizationStatus: @Sendable () -> SFSpeechRecognizerAuthorizationStatus
    private let requestSpeechAuthorization: @Sendable () async -> SFSpeechRecognizerAuthorizationStatus
    private let readIsRecognizerAvailable: @Sendable () -> Bool
    private let performAudioRecognition: @Sendable () async throws -> String

    init(
        readAuthorizationStatus: @escaping @Sendable () -> SFSpeechRecognizerAuthorizationStatus =
            { SFSpeechRecognizer.authorizationStatus() },
        requestSpeechAuthorization: @escaping @Sendable () async -> SFSpeechRecognizerAuthorizationStatus =
            SFSpeechRecognizerService.productionRequestAuthorization,
        readIsRecognizerAvailable: @escaping @Sendable () -> Bool =
            SFSpeechRecognizerService.productionIsRecognizerAvailable,
        performAudioRecognition: @escaping @Sendable () async throws -> String =
            SFSpeechRecognizerService.productionPerformRecognition
    ) {
        self.readAuthorizationStatus = readAuthorizationStatus
        self.requestSpeechAuthorization = requestSpeechAuthorization
        self.readIsRecognizerAvailable = readIsRecognizerAvailable
        self.performAudioRecognition = performAudioRecognition
    }

    var isAvailable: Bool {
        readAuthorizationStatus() == .authorized && readIsRecognizerAvailable()
    }

    func requestTranscription() async throws -> String {
        let status = try await resolvedAuthorizationStatus()
        guard status == .authorized else {
            throw SpeechRecognitionError.permissionDenied
        }
        guard readIsRecognizerAvailable() else {
            throw SpeechRecognitionError.unavailable
        }
        return try await performAudioRecognition()
    }

    /// Reads the current authorization status; if it's still
    /// `.notDetermined`, prompts the user via `requestSpeechAuthorization`
    /// and resolves to whatever the user chose. `.denied`/`.restricted`
    /// status is returned as-is without re-prompting — matching
    /// `SFSpeechRecognizer.requestAuthorization`'s own behavior of not
    /// re-surfacing a system prompt once the user has already answered.
    private func resolvedAuthorizationStatus() async throws -> SFSpeechRecognizerAuthorizationStatus {
        let currentStatus = readAuthorizationStatus()
        guard currentStatus == .notDetermined else {
            return currentStatus
        }
        return await requestSpeechAuthorization()
    }

    // MARK: - Production defaults

    /// Single app-wide recognizer instance for the device's current locale.
    /// `SFSpeechRecognizer` isn't `Sendable`, so this is opted out of the
    /// concurrency checker explicitly (`nonisolated(unsafe)`) — the same
    /// trade-off `MotionGPSIntegrityProvider.productionMotionManager` makes
    /// for its own single app-wide `CMMotionManager`. `SFSpeechRecognizer`
    /// also isn't guaranteed non-nil (e.g. unsupported locale), so callers
    /// must treat a nil recognizer as unavailable rather than
    /// force-unwrapping it.
    private nonisolated(unsafe) static let productionRecognizer: SFSpeechRecognizer? = SFSpeechRecognizer()

    private static func productionIsRecognizerAvailable() -> Bool {
        productionRecognizer?.isAvailable ?? false
    }

    private static func productionRequestAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }

    private static func productionPerformRecognition() async throws -> String {
        guard let recognizer = productionRecognizer else {
            throw SpeechRecognitionError.unavailable
        }

        let recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        recognitionRequest.shouldReportPartialResults = false

        let session = RecognitionAudioSession()
        try session.start(appendingBuffersTo: recognitionRequest)

        return try await withCheckedThrowingContinuation { continuation in
            let hasResumedLock = NSLock()
            var hasResumed = false
            recognizer.recognitionTask(with: recognitionRequest) { result, error in
                hasResumedLock.lock()
                let alreadyResumed = hasResumed
                if !alreadyResumed, error != nil || result?.isFinal == true {
                    hasResumed = true
                }
                hasResumedLock.unlock()
                guard !alreadyResumed else { return }

                if let error {
                    session.finish()
                    continuation.resume(throwing: SpeechRecognitionError.recognitionFailed(error.localizedDescription))
                    return
                }
                guard let result, result.isFinal else { return }
                session.finish()
                continuation.resume(returning: result.bestTranscription.formattedString)
            }
        }
    }
}

/// Owns the `AVAudioEngine`/`AVAudioInputNode`/`AVAudioSession` state for a
/// single recognition request. Neither `AVAudioEngine` nor
/// `AVAudioInputNode` is `Sendable`, so wrapping them in their own
/// `@unchecked Sendable` type (rather than capturing them as loose locals)
/// is what lets `productionPerformRecognition` pass a `finish()` call into
/// `SFSpeechRecognizer.recognitionTask(with:resultHandler:)`'s `@Sendable`
/// completion handler — the same trade-off `SFSpeechRecognizerService`
/// itself makes at the class level, and `MotionGPSIntegrityProvider` makes
/// for its `CMMotionManager`.
private final class RecognitionAudioSession: @unchecked Sendable {
    private let audioEngine = AVAudioEngine()
    private let audioSession = AVAudioSession.sharedInstance()

    func start(appendingBuffersTo recognitionRequest: SFSpeechAudioBufferRecognitionRequest) throws {
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1_024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
    }

    func finish() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
    }
}
