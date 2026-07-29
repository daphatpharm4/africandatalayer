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
    /// Microphone permission — a *separate* iOS permission from speech
    /// recognition (`readAuthorizationStatus` above). Checked (and, if
    /// undetermined, requested) before `performAudioRecognition()` so a
    /// collector who has speech recognition authorized but has denied (or
    /// never been asked for) microphone access gets a clean
    /// `.permissionDenied` instead of `AVAudioEngine.start()` silently
    /// producing no audio and the recognition task hanging with nothing to
    /// transcribe.
    private let readRecordPermission: @Sendable () -> AVAudioApplication.recordPermission
    private let requestRecordPermission: @Sendable () async -> Bool
    private let performAudioRecognition: @Sendable () async throws -> String

    init(
        readAuthorizationStatus: @escaping @Sendable () -> SFSpeechRecognizerAuthorizationStatus =
            { SFSpeechRecognizer.authorizationStatus() },
        requestSpeechAuthorization: @escaping @Sendable () async -> SFSpeechRecognizerAuthorizationStatus =
            SFSpeechRecognizerService.productionRequestAuthorization,
        readIsRecognizerAvailable: @escaping @Sendable () -> Bool =
            SFSpeechRecognizerService.productionIsRecognizerAvailable,
        readRecordPermission: @escaping @Sendable () -> AVAudioApplication.recordPermission =
            { AVAudioApplication.shared.recordPermission },
        requestRecordPermission: @escaping @Sendable () async -> Bool =
            SFSpeechRecognizerService.productionRequestRecordPermission,
        performAudioRecognition: @escaping @Sendable () async throws -> String =
            SFSpeechRecognizerService.productionPerformRecognition
    ) {
        self.readAuthorizationStatus = readAuthorizationStatus
        self.requestSpeechAuthorization = requestSpeechAuthorization
        self.readIsRecognizerAvailable = readIsRecognizerAvailable
        self.readRecordPermission = readRecordPermission
        self.requestRecordPermission = requestRecordPermission
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
        guard await resolvedRecordPermissionGranted() else {
            throw SpeechRecognitionError.permissionDenied
        }
        return try await performAudioRecognition()
    }

    /// Reads the current microphone permission; if it's still
    /// `.undetermined`, prompts the user via `requestRecordPermission` and
    /// resolves to whatever they chose. `.denied` is returned as `false`
    /// without re-prompting, matching `resolvedAuthorizationStatus()`'s
    /// no-re-prompt behavior for speech-recognition authorization above.
    private func resolvedRecordPermissionGranted() async -> Bool {
        switch readRecordPermission() {
        case .granted:
            return true
        case .denied:
            return false
        case .undetermined:
            return await requestRecordPermission()
        @unknown default:
            return false
        }
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

    private static func productionRequestRecordPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    /// Hard ceiling on how long one dictation pass listens before it forces
    /// itself to finish, ending audio input the same way a manual STOP tap
    /// does (see `RecognitionAudioSession.endAudio()` below). Without this,
    /// a collector who taps the mic and is interrupted (or a recognizer that
    /// never emits a final result for some audio) leaves the capture flow
    /// hung indefinitely — there was previously no `endAudio()` call and no
    /// stop affordance at all.
    private static let maxDictationDurationSeconds: UInt64 = 10

    /// Performs one recognition pass: starts the audio session, races the
    /// recognizer's own completion against a max-duration timeout, and
    /// resolves cooperatively with the enclosing `Task`'s cancellation (the
    /// STOP path — see `CaptureViewModel.requestVoiceInput(for:)`). All three
    /// completion routes — recognizer result/error, timeout, and outer-task
    /// cancellation — go through `ResumeOnce` so the continuation is resumed
    /// exactly once no matter which one "wins" the race.
    private static func productionPerformRecognition() async throws -> String {
        guard let recognizer = productionRecognizer else {
            throw SpeechRecognitionError.unavailable
        }

        let session = RecognitionAudioSession()
        try session.start()

        return try await withTaskCancellationHandler(
            operation: {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
                    let resumeOnce = ResumeOnce(continuation)

                    recognizer.recognitionTask(with: session.recognitionRequest) { result, error in
                        if let error {
                            session.finish()
                            resumeOnce.resume(throwing: SpeechRecognitionError.recognitionFailed(error.localizedDescription))
                            return
                        }
                        guard let result, result.isFinal else { return }
                        session.finish()
                        resumeOnce.resume(returning: result.bestTranscription.formattedString)
                    }

                    Task {
                        try? await Task.sleep(nanoseconds: maxDictationDurationSeconds * 1_000_000_000)
                        // Idempotent: if the recognizer already produced a
                        // final result (and `session.finish()` already ran),
                        // this is a harmless no-op — `resumeOnce` guarantees
                        // the continuation itself only resolves once either
                        // way.
                        session.endAudio()
                    }
                }
            },
            onCancel: {
                // Fires when the enclosing `Task` is cancelled — the manual
                // STOP path. Ending audio input lets the recognizer settle
                // on a final result (or error) through the normal
                // completion-handler path above, so the transcript captured
                // so far still comes back instead of the call hanging.
                session.endAudio()
            }
        )
    }
}

/// Guards a `CheckedContinuation` so exactly one of the racing completions —
/// the recognizer's result/error callback, the max-duration timeout, or
/// outer-task cancellation — actually resumes it. Resuming a
/// `CheckedContinuation` more than once is a runtime trap, so every
/// completion route in `productionPerformRecognition` must go through this.
private final class ResumeOnce<Value: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var didResume = false
    private let continuation: CheckedContinuation<Value, Error>

    init(_ continuation: CheckedContinuation<Value, Error>) {
        self.continuation = continuation
    }

    func resume(returning value: Value) {
        guard claim() else { return }
        continuation.resume(returning: value)
    }

    func resume(throwing error: Error) {
        guard claim() else { return }
        continuation.resume(throwing: error)
    }

    /// Returns `true` exactly once — the first caller across any thread wins
    /// and is responsible for resuming the continuation; every later caller
    /// gets `false` and must no-op.
    private func claim() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !didResume else { return false }
        didResume = true
        return true
    }
}

/// Owns the `AVAudioEngine`/`AVAudioInputNode`/`AVAudioSession`/
/// `SFSpeechAudioBufferRecognitionRequest` state for a single recognition
/// request. None of `AVAudioEngine`, `AVAudioInputNode`, or
/// `SFSpeechAudioBufferRecognitionRequest` is `Sendable`, so wrapping them
/// all in one `@unchecked Sendable` type (rather than capturing them as loose
/// locals) is what lets `productionPerformRecognition` pass `finish()` into
/// `SFSpeechRecognizer.recognitionTask(with:resultHandler:)`'s `@Sendable`
/// completion handler and `endAudio()` into both the timeout `Task` and the
/// `withTaskCancellationHandler` cancellation closure — the same trade-off
/// `SFSpeechRecognizerService` itself makes at the class level, and
/// `MotionGPSIntegrityProvider` makes for its `CMMotionManager`.
private final class RecognitionAudioSession: @unchecked Sendable {
    let recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
    private let audioEngine = AVAudioEngine()
    private let audioSession = AVAudioSession.sharedInstance()

    init() {
        recognitionRequest.shouldReportPartialResults = false
    }

    func start() throws {
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        let recognitionRequest = recognitionRequest
        inputNode.installTap(onBus: 0, bufferSize: 1_024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
    }

    /// Ends audio input so the in-flight recognition task settles on a final
    /// result instead of continuing to listen — called from both the
    /// max-duration timeout and a manual STOP (task cancellation). Safe to
    /// call more than once or after `finish()`;
    /// `SFSpeechAudioBufferRecognitionRequest.endAudio()` is documented as
    /// tolerant of redundant calls.
    func endAudio() {
        recognitionRequest.endAudio()
    }

    func finish() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
    }
}
