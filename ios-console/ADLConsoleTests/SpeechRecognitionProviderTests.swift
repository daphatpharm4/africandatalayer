@testable import ADLConsole
import Foundation
import Speech
import XCTest

/// Coverage for `SpeechRecognitionProviding` / `SFSpeechRecognizerService`:
/// the authorization-gating logic in `requestTranscription()` (authorized /
/// denied / notDetermined) and the availability check are exercised with
/// injected closures rather than the real `SFSpeechRecognizer`/microphone,
/// mirroring `DeviceProfilingProviderTests`'/`GPSIntegrityProviderTests`'
/// injected-closure pattern. A separate `MockSpeechRecognitionProvider`
/// exercises the protocol surface a field-binding caller (Task 7) will
/// consume, without depending on `SFSpeechRecognizerService` at all.
final class SpeechRecognitionProviderTests: XCTestCase {
    // MARK: - Protocol-level coverage via a simple mock

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

    // MARK: - SFSpeechRecognizerService: authorization gating

    func testRequestTranscriptionWhenAuthorizedPerformsRecognition() async throws {
        let service = SFSpeechRecognizerService(
            readAuthorizationStatus: { .authorized },
            requestSpeechAuthorization: {
                XCTFail("should not re-prompt when already authorized")
                return .denied
            },
            readIsRecognizerAvailable: { true },
            performAudioRecognition: { "transcribed text" }
        )
        let text = try await service.requestTranscription()
        XCTAssertEqual(text, "transcribed text")
    }

    func testRequestTranscriptionWhenDeniedThrowsPermissionDeniedWithoutPrompting() async {
        let service = SFSpeechRecognizerService(
            readAuthorizationStatus: { .denied },
            requestSpeechAuthorization: {
                XCTFail("should not re-prompt once denied — SFSpeechRecognizer never re-surfaces the system prompt")
                return .denied
            },
            readIsRecognizerAvailable: { true },
            performAudioRecognition: {
                XCTFail("should not attempt recognition when denied")
                return ""
            }
        )
        do {
            _ = try await service.requestTranscription()
            XCTFail("expected permissionDenied")
        } catch SpeechRecognitionError.permissionDenied {
            // expected
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testRequestTranscriptionWhenRestrictedThrowsPermissionDenied() async {
        let service = SFSpeechRecognizerService(
            readAuthorizationStatus: { .restricted },
            requestSpeechAuthorization: { .restricted },
            readIsRecognizerAvailable: { true },
            performAudioRecognition: { "" }
        )
        do {
            _ = try await service.requestTranscription()
            XCTFail("expected permissionDenied")
        } catch SpeechRecognitionError.permissionDenied {
            // expected
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testRequestTranscriptionWhenNotDeterminedPromptsThenProceedsIfGranted() async throws {
        let service = SFSpeechRecognizerService(
            readAuthorizationStatus: { .notDetermined },
            requestSpeechAuthorization: { .authorized },
            readIsRecognizerAvailable: { true },
            performAudioRecognition: { "granted after prompt" }
        )
        let text = try await service.requestTranscription()
        XCTAssertEqual(text, "granted after prompt")
    }

    func testRequestTranscriptionWhenNotDeterminedAndUserDeniesThrowsPermissionDenied() async {
        let service = SFSpeechRecognizerService(
            readAuthorizationStatus: { .notDetermined },
            requestSpeechAuthorization: { .denied },
            readIsRecognizerAvailable: { true },
            performAudioRecognition: {
                XCTFail("should not attempt recognition when the user denies at the prompt")
                return ""
            }
        )
        do {
            _ = try await service.requestTranscription()
            XCTFail("expected permissionDenied")
        } catch SpeechRecognitionError.permissionDenied {
            // expected
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    // MARK: - SFSpeechRecognizerService: availability

    func testRequestTranscriptionWhenAuthorizedButRecognizerUnavailableThrowsUnavailable() async {
        let service = SFSpeechRecognizerService(
            readAuthorizationStatus: { .authorized },
            requestSpeechAuthorization: { .authorized },
            readIsRecognizerAvailable: { false },
            performAudioRecognition: {
                XCTFail("should not attempt recognition when the recognizer is unavailable")
                return ""
            }
        )
        do {
            _ = try await service.requestTranscription()
            XCTFail("expected unavailable")
        } catch SpeechRecognitionError.unavailable {
            // expected
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testRequestTranscriptionPropagatesRecognitionFailure() async {
        let service = SFSpeechRecognizerService(
            readAuthorizationStatus: { .authorized },
            requestSpeechAuthorization: { .authorized },
            readIsRecognizerAvailable: { true },
            performAudioRecognition: {
                throw SpeechRecognitionError.recognitionFailed("no speech detected")
            }
        )
        do {
            _ = try await service.requestTranscription()
            XCTFail("expected recognitionFailed")
        } catch SpeechRecognitionError.recognitionFailed(let message) {
            XCTAssertEqual(message, "no speech detected")
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testIsAvailableTrueOnlyWhenAuthorizedAndRecognizerAvailable() {
        let authorizedAndAvailable = SFSpeechRecognizerService(
            readAuthorizationStatus: { .authorized },
            readIsRecognizerAvailable: { true }
        )
        XCTAssertTrue(authorizedAndAvailable.isAvailable)

        let authorizedButUnavailable = SFSpeechRecognizerService(
            readAuthorizationStatus: { .authorized },
            readIsRecognizerAvailable: { false }
        )
        XCTAssertFalse(authorizedButUnavailable.isAvailable)

        let availableButNotAuthorized = SFSpeechRecognizerService(
            readAuthorizationStatus: { .denied },
            readIsRecognizerAvailable: { true }
        )
        XCTAssertFalse(availableButNotAuthorized.isAvailable)

        let notDeterminedIsNotAvailable = SFSpeechRecognizerService(
            readAuthorizationStatus: { .notDetermined },
            readIsRecognizerAvailable: { true }
        )
        XCTAssertFalse(notDeterminedIsNotAvailable.isAvailable)
    }

    // MARK: - Default (production closures) initializer compiles and is usable

    func testDefaultInitializerUsesProductionRecognizer() {
        let service = SFSpeechRecognizerService()
        // No hardware/permission assertions here (simulator/CI dependent) —
        // this just proves the production closures wire up without
        // crashing, mirroring
        // `GPSIntegrityProviderTests.testDefaultInitializerUsesProductionMotionManager`.
        _ = service.isAvailable
    }
}

private final class MockSpeechRecognitionProvider: SpeechRecognitionProviding, @unchecked Sendable {
    var stubResult: String?
    var stubError: Error?
    var stubIsAvailable = true

    var isAvailable: Bool { stubIsAvailable }

    func requestTranscription() async throws -> String {
        if let error = stubError { throw error }
        return stubResult ?? ""
    }
}
