# ADL Console Intelligent Capture Design

**Status:** Draft design

**Tracking:** Sub-project 2 of bug-fixes → intelligent-capture → missions → analytics → admin

## Objective

Close the feature gap between the web/Capacitor CaptureView and the iOS console CaptureView by adding six advanced capture capabilities: voice-to-text field input, EXIF extraction and SHA-256 photo hashing for fraud detection, accelerometer/gyroscope-based GPS integrity validation, device profiling for low-end detection, submission deduplication checks, and batch capture mode for rapid-field data collection.

## Current State

The iOS console `CaptureView` (`Screens/Capture/CaptureViewModel.swift`) supports schema-driven dynamic forms, GPS evidence capture, photo evidence (via camera/photos picker), and durable offline submission. Fraud metadata is collected via `CaptureFraudMetadataProviding` (`NativeCaptureFraudMetadataProvider`) but uses mock values for GPS integrity. Voice input, EXIF extraction, device profiling, dedup checks, and batch mode are absent.

## Scope

**In scope:**
- Voice-to-text for text and number fields using `SFSpeechRecognizer`
- EXIF extraction on captured photos (`CGImageSource` properties) + SHA-256 hashing (already done in `CaptureMediaStore`)
- Accelerometer/gyroscope GPS integrity via `CMMotionManager`
- Device profiling (`UIDevice`, `ProcessInfo`, `NSProcessInfo.thermalState`)
- Dedup check: hash field values + search existing records via API before submit
- Batch capture mode: multi-record loop without returning to list
- Integration with existing `CaptureFraudMetadataProviding` protocol

**Out of scope:**
- AI field extraction from photos (belongs to AI Features sub-project)
- Changes to the backend dedup API (reuse existing)
- Non-capture features (missions, dashboards, admin tools)

## Components

### Voice-to-Text Input

**Protocol:**
```swift
protocol SpeechRecognitionProviding: Sendable {
    func requestTranscription() async throws -> String
    var isAvailable: Bool { get }
}
```

**iOS Implementation:** `SFSpeechRecognizer` with `SFSpeechAudioBufferRecognitionRequest`. Request authorization on first use. Returns transcribed text that `CaptureViewModel.setValue` inserts into the currently focused field.

**Integration:** Add a mic button (`ADLMicButton`) next to text/number fields in `CaptureFieldControl.swift`. On tap, request audio and pipe the result to the field's value binding.

**Availability:** Requires speech recognition entitlement; gate with `SFSpeechRecognizer.authorizationStatus()`.

### EXIF Extraction & Photo Hashing

**Protocol:**
```swift
protocol PhotoIntegrityProviding: Sendable {
    func extractExif(from photoData: Data) -> [String: Any]
    func sha256Hash(of photoData: Data) -> String
}
```

**iOS Implementation:** 
- EXIF: Use `CGImageSource` properties dictionary (`kCGImageSourceExifDictionary`, `kCGImageSourceTIFFDictionary`, `kCGImageSourceGPSDictionary`). Extract make, model, datetimeOriginal, GPS lat/lon/altitude, orientation, flash, focal length, ISO.
- SHA-256: Already computed in `CaptureMediaStore.stage()` via `CryptoKit.SHA256` and stored in `LedgerAttachment.sha256`. Expose through the existing attachment model.

**Integration:** Extend `CaptureFraudMetadataProviding` protocol with `clientExif(gps:capturedAt:)` — replace the current stub with real extracted values. Pass `photoData` through to the integrity provider after capture.

### Accelerometer/Gyroscope GPS Integrity

**Protocol:**
```swift
protocol GPSIntegrityProviding: Sendable {
    func integrityScore(gps: FormGpsValue, capturedAt: Date) -> GPSIntegrityResult
}

struct GPSIntegrityResult: Equatable, Sendable {
    let isStationary: Bool
    let motionConsistent: Bool
    let confidenceScore: Double // 0.0–1.0
}
```

**iOS Implementation:** Use `CMMotionManager` to sample accelerometer and gyroscope data during the capture window. Compare motion patterns with GPS-reported speed. High confidence = device was moving and GPS speed matches accelerometer data. Low confidence = stationary device reporting movement or vice versa.

**Integration:** Replace `NativeCaptureFraudMetadataProvider.gpsIntegrity()` current mock values (`false`) with real sensor-driven results. Start motion collection when `CaptureView` appears, stop on submit.

### Device Profiling

**Protocol:**
```swift
protocol DeviceProfilingProviding: Sendable {
    func deviceProfile(language: ConsoleLanguage) -> DeviceProfile
}

struct DeviceProfile: Equatable, Sendable, Codable {
    let model: String           // e.g. "iPhone 13,2"
    let systemVersion: String    // e.g. "17.4"
    let totalMemoryMB: UInt64
    let isLowPowerMode: Bool
    let thermalState: String     // "nominal", "fair", "serious", "critical"
    let lowEndDevice: Bool       // iPhone SE (1st gen), iPhone 6s/7, or < 2GB RAM
}
```

**iOS Implementation:** 
- Model: `UIDevice.current.model` + `sysctlbyname("hw.machine")`
- Memory: `ProcessInfo.processInfo.physicalMemory`
- Low power: `ProcessInfo.processInfo.isLowPowerModeEnabled`
- Thermal: `ProcessInfo.processInfo.thermalState`
- Low-end detection: hardcoded set of low-end model identifiers OR < 2GB RAM

**Integration:** Extend `CaptureFraudMetadataProviding` with `device(language:)` — replace current stub.

### Dedup Check Before Submission

**Reuse the existing backend endpoint.** The web app already exposes duplicate detection at `GET /api/submissions?view=dedup_candidates` (handler in `api/submissions/index.ts`, logic in `lib/server/dedup.ts:buildDedupCandidates`). It is **geo + category + name proximity** matching, **not** a hash lookup — there is no `fieldValuesHash`. The iOS console consumes it as-is; no backend change.

**Integration:** After `validate()` succeeds and before enqueueing, call the endpoint with the record's category, the capture GPS coordinates, and (optionally) the site/road name field. If the response's `shouldPrompt` is `true`, show a bottom sheet listing the nearby candidates ("This looks like an existing point nearby. Add to it, or submit as new?").

**API contract (real — verified against `api/submissions/index.ts` + `lib/server/dedup.ts`):**
```
GET /api/submissions?view=dedup_candidates&category=<SubmissionCategory>&lat=<double>&lng=<double>&name=<optional string>
Auth: required (401 if unauthenticated). 400 if category invalid or lat/lng non-finite.
Response (DedupCheckResult):
{
  shouldPrompt: boolean,          // true when a candidate is close/similar enough to warrant a prompt
  radiusMeters: number,           // search radius used (category-dependent)
  bestCandidatePointId: string | null,
  candidates: [
    { pointId, category, siteName, latitude, longitude, distanceMeters, similarityScore, matchScore }
  ]
}
```

Note: matching is server-side against projected points (name similarity 55% · distance 35% · brand 10%); the client only supplies category + coordinates + optional name. This aligns with dedup on the CREATE path already implemented in `api/submissions` (`dedupDecision` / `dedupTargetPointId`), so an "add to existing" action should submit with `dedupDecision: "use_existing"` and `dedupTargetPointId: <chosen pointId>`.

**UI:** Add a `dedupCheckTask` to `CaptureViewModel`. Run it after validation, before enqueueing. When `shouldPrompt`, show `DedupWarningSheet` with submit-as-new / add-to-existing (per candidate) / cancel actions.

### Batch Capture Mode

**Integration:** Add a `isBatchMode` toggle to `CaptureView`. In batch mode:
1. Submit a record → reset form → auto-select same project/record type → focus first empty field
2. Show a batch progress counter ("3 of 12 collected") in a floating bar
3. Add a "Finish batch" button to exit batch mode back to the record list
4. Quota targets from missions feed into the batch counter

**CaptureViewModel changes:**
```swift
@Published var isBatchMode: Bool = false
@Published var batchTarget: Int = 0
@Published var batchCompleted: Int = 0

func submitInBatch() async {
    await submit()
    // Parenthesize: && binds tighter than ||, but the intent is "in batch mode AND
    // (synced OR queued)". Without the parens the queued branch fires even outside batch mode.
    if isBatchMode && (submitState == .synced || submitState == .queuedPendingSync) {
        batchCompleted += 1
        resetDraftValues()
    }
}
```

## Testing Strategy

- **Voice-to-text:** Mock `SpeechRecognitionProviding` with canned text; test authorization gating
- **EXIF extraction:** Test with known EXIF-bearing JPEG + test with stripped image
- **SHA-256:** Already tested in `CaptureMediaStoreTests`
- **GPS integrity:** Mock `CMMotionManager` with canned accelerometer data; test stationary vs moving
- **Device profiling:** Test model detection, memory reading, thermal state
- **Dedup:** Mock API client with duplicate/clean responses; test warning sheet presentation
- **Batch mode:** Test form reset after submit, progress counter, finish-exit
- **Accessibility:** VoiceOver on mic button, batch progress announcements

## Risk

- `SFSpeechRecognizer` requires a network connection for best results (on-device recognition is limited)
- `CMMotionManager` drains battery if left running; must be started on capture begin and stopped promptly
- EXIF GPS data may reflect the camera's GPS fix, not the device's — need to compare evidence GPS with EXIF GPS and flag significant discrepancies
- Low-end device detection requires a maintained device list; prefer RAM-based heuristic (< 2GB = low-end)
- Dedup endpoint **already exists** (`GET /api/submissions?view=dedup_candidates`) — no backend work. Risk is instead client-side: the check needs a valid GPS fix and category before it can run, so gate it to run only after GPS evidence is captured; on network failure, fail open (allow submit) rather than blocking the field agent.
