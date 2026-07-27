import ConsoleAPI
import ConsoleForms
import ConsoleModels
import ConsolePersistence
import CryptoKit
import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Drives `CaptureView` — the collector's schema-driven record-capture flow.
/// Every field-engine/validation/queue decision is delegated to the pure
/// `ConsoleForms` package (`FormEngine`, `FormValidator`, `RecordQueue`);
/// this type only owns UI-facing `@Published` state and the glue that wires
/// `RecordQueue`'s injected `submit` closure to
/// `PlatformAPIClient.createPlatformRecord`.
@MainActor
final class CaptureViewModel: ObservableObject {
    /// One capturable (project, published schema) pair — a collector can
    /// only capture against a project that has a *published* schema version;
    /// a draft-only schema is not yet live for field capture, same rule the
    /// web field context (`collectablePlatformProjects` in
    /// `lib/client/platformFieldContext.ts`) applies.
    struct ProjectOption: Identifiable, Equatable, Sendable {
        var id: String { project.id }
        let project: PlatformProject
        let schemaVersion: PlatformSchemaVersion
    }

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    enum SubmitState: Equatable {
        case idle
        case submitting
        /// Enqueued and the submit attempt succeeded synchronously.
        case synced
        /// Enqueued but not yet confirmed synced (offline, or a retryable
        /// failure) — the draft is safe in the offline queue and will retry.
        case queuedPendingSync
        case invalid
        case failed(String)
    }

    /// State of the pre-submit duplicate-candidate lookup
    /// (`PlatformAPIClient.dedupCandidates`, `GET
    /// api/submissions?view=dedup_candidates`). `.prompt` pauses `submit()`
    /// and surfaces `DedupWarningSheet`; every other case lets `submit()`
    /// proceed straight through — including a network/decode failure, which
    /// intentionally lands on `.clear` rather than any error case so a flaky
    /// dedup lookup never blocks a field submission ("fail open").
    enum DedupState: Equatable {
        case idle
        case checking
        case prompt(candidates: [DedupCandidate], bestPointId: String?)
        case clear
    }

    struct CaptureProgress: Equatable {
        var completed: Int
        var total: Int

        var fraction: Double {
            guard total > 0 else { return 1 }
            return min(max(Double(completed) / Double(total), 0), 1)
        }

        var percent: Int {
            Int((fraction * 100).rounded())
        }
    }

    @Published private(set) var projectOptions: [ProjectOption] = []
    @Published var selectedProjectId: String?
    @Published var selectedRecordTypeKey: String?

    @Published var values: FormValues = [:]
    @Published var evidenceGps: FormGpsValue?
    @Published var evidencePhotoRefs: [String] = []
    @Published var evidenceNotes: String = ""

    @Published private(set) var loadState: LoadState = .idle
    @Published private(set) var submitState: SubmitState = .idle
    @Published private(set) var lastValidation: FormValidationResult?
    @Published private(set) var queueSnapshot: RecordQueueSnapshot?
    @Published private(set) var isRequestingLocation = false
    @Published private(set) var locationErrorMessage: String?
    @Published private(set) var nearbyPoints: [PlatformNearbyPoint]?
    @Published private(set) var isLoadingNearbyPoints = false
    @Published private(set) var nearbyPointsErrorMessage: String?
    @Published private(set) var attachedPoint: PlatformNearbyPoint?
    @Published private(set) var preAttachPointId: String?
    @Published private(set) var attachmentViewStates: [CaptureAttachmentViewState] = []
    @Published private(set) var dedupState: DedupState = .idle

    /// Batch capture mode — lets a collector submit a run of records against
    /// the same project/record type back-to-back without re-navigating.
    /// `batchTarget` is typically seeded from a mission quota; `0` just means
    /// "no known target", the floating counter still tracks `batchCompleted`.
    @Published var isBatchMode: Bool = false
    @Published var batchTarget: Int = 0
    @Published private(set) var batchCompleted: Int = 0

    /// The field `key` currently mid-dictation via `requestVoiceInput(for:)`,
    /// or `nil` when no voice-input request is in flight — `CaptureView`
    /// binds this to the active field's mic-button state so at most one
    /// field's dictation runs (and shows as active) at a time.
    @Published private(set) var voiceInputActiveKey: String?
    @Published private(set) var voiceInputErrorMessage: String?

    let language: ConsoleLanguage

    private let apiClient: PlatformAPIClient
    private let organizationId: String
    private let queue: RecordQueue
    private let locationService: LocationServiceProtocol?
    private let now: () -> Date
    private let attachPointGps: FormGpsValue?
    private let offlineCache: ConsoleOfflineCacheProtocol
    private let onQueueSnapshotChanged: (@MainActor (RecordQueueSnapshot?) -> Void)?
    private let fraudMetadataProvider: CaptureFraudMetadataProviding
    /// `nil` disables the voice-input affordance entirely (e.g. tests that
    /// don't want `CaptureFieldControl` to render a mic button). Defaults to
    /// a real `SFSpeechRecognizerService` so existing callers (`AppState`)
    /// get working dictation without any change on their end.
    private let speechRecognitionProvider: SpeechRecognitionProviding?
    private var photoMetadataByRef: [String: PlatformRecordEvidence.PhotoMetadata] = [:]
    private let mediaStore: CaptureMediaStoreProtocol
    private let durableCoordinator: CaptureCoordinator?
    private let ownerUserID: String?
    private let onDurableRecordPersisted: (@MainActor (String) async -> Void)?
    private let creationAllowed: @MainActor () -> Bool
    private var pendingMedia: [String: CaptureIntentMedia] = [:]
    /// The `Task` backing the in-flight `requestVoiceInput(for:)` call, if
    /// any — retained so a second tap on the same field's mic button (which
    /// renders as a STOP affordance while `voiceInputActiveKey == key`, see
    /// `CaptureFieldControl`) can cancel it. `SFSpeechRecognizerService`'s
    /// production recognition path observes that cancellation via
    /// `withTaskCancellationHandler` and ends audio input, letting the
    /// recognizer settle on a final (possibly partial) transcript instead of
    /// listening forever.
    private var voiceInputTask: Task<Void, Never>?
    private static let enrichMaxDistanceMeters: Double = 250

    init(
        apiClient: PlatformAPIClient,
        organizationId: String,
        queue: RecordQueue,
        language: ConsoleLanguage,
        locationService: LocationServiceProtocol? = nil,
        attachPointId: String? = nil,
        attachPointGps: FormGpsValue? = nil,
        offlineCache: ConsoleOfflineCacheProtocol = ConsoleOfflineCache(),
        onQueueSnapshotChanged: (@MainActor (RecordQueueSnapshot?) -> Void)? = nil,
        fraudMetadataProvider: CaptureFraudMetadataProviding = NativeCaptureFraudMetadataProvider(),
        speechRecognitionProvider: SpeechRecognitionProviding? = SFSpeechRecognizerService(),
        mediaStore: CaptureMediaStoreProtocol = InMemoryCaptureMediaStore(),
        durableCoordinator: CaptureCoordinator? = nil,
        ownerUserID: String? = nil,
        onDurableRecordPersisted: (@MainActor (String) async -> Void)? = nil,
        creationAllowed: @escaping @MainActor () -> Bool = { true },
        now: @escaping () -> Date = { Date() }
    ) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.queue = queue
        self.language = language
        self.locationService = locationService
        self.preAttachPointId = attachPointId
        self.attachPointGps = attachPointGps
        self.offlineCache = offlineCache
        self.onQueueSnapshotChanged = onQueueSnapshotChanged
        self.fraudMetadataProvider = fraudMetadataProvider
        self.speechRecognitionProvider = speechRecognitionProvider
        self.mediaStore = mediaStore
        self.durableCoordinator = durableCoordinator
        self.ownerUserID = ownerUserID
        self.onDurableRecordPersisted = onDurableRecordPersisted
        self.creationAllowed = creationAllowed
        self.now = now
    }

    // MARK: - Derived state

    var selectedProjectOption: ProjectOption? {
        projectOptions.first { $0.id == selectedProjectId }
    }

    var recordTypes: [PlatformRecordType] {
        selectedProjectOption?.schemaVersion.definition.recordTypes ?? []
    }

    var selectedRecordType: PlatformRecordType? {
        recordTypes.first { $0.key == selectedRecordTypeKey }
    }

    /// The dynamic field list the view renders — one control per descriptor,
    /// in schema-authored order.
    var descriptors: [FormFieldDescriptor] {
        guard let recordType = selectedRecordType else { return [] }
        return FormEngine.descriptors(for: recordType)
    }

    var evidenceRules: PlatformEvidenceRules? {
        selectedRecordType?.evidence
    }

    private var submitAttachPointId: String? {
        attachedPoint?.pointId ?? preAttachPointId
    }

    var captureProgress: CaptureProgress {
        guard let recordType = selectedRecordType else {
            return CaptureProgress(completed: 0, total: 0)
        }

        var completed = 0
        var total = 0

        for descriptor in descriptors where descriptor.required {
            total += 1
            if isComplete(value(for: descriptor.key)) {
                completed += 1
            }
        }

        let rules = recordType.evidence
        if rules.gpsRequired {
            total += 1
            if evidenceGps != nil { completed += 1 }
        }
        if rules.minPhotos > 0 {
            total += 1
            if evidencePhotoRefs.count >= rules.minPhotos { completed += 1 }
        }
        if rules.notesRequired {
            total += 1
            if !evidenceNotes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { completed += 1 }
        }

        return CaptureProgress(completed: completed, total: total)
    }

    // MARK: - Loading projects + schemas

    /// Loads every active project in the org with a published schema —
    /// mirrors `collectablePlatformProjects` in
    /// `lib/client/platformFieldContext.ts`. Selects the first project and
    /// its first record type by default so the form is immediately usable.
    func loadProjects() async {
        guard loadState != .loading else { return }
        guard loadState != .loaded || projectOptions.isEmpty else { return }
        loadState = .loading
        do {
            let projects = try await apiClient.listProjects(organizationId: organizationId)
            let activeProjects = projects.filter { $0.status != .archived }
            let apiClient = apiClient
            let options = try await withThrowingTaskGroup(of: ProjectOption?.self) { group in
                for project in activeProjects {
                    group.addTask {
                        let schema = try await apiClient.getSchema(projectId: project.id)
                        guard let published = schema.published else { return nil }
                        return ProjectOption(project: project, schemaVersion: published)
                    }
                }

                var options: [ProjectOption] = []
                for try await option in group {
                    if let option { options.append(option) }
                }
                return options.sorted { $0.project.name.localizedCaseInsensitiveCompare($1.project.name) == .orderedAscending }
            }
            projectOptions = options
            try? offlineCache.saveProjectOptions(
                options.map { CachedProjectOption(project: $0.project, schemaVersion: $0.schemaVersion) },
                organizationId: organizationId
            )
            if selectedProjectId == nil {
                selectedProjectId = options.first?.id
            }
            if selectedRecordTypeKey == nil {
                selectedRecordTypeKey = recordTypes.first?.key
            }
            loadState = .loaded
        } catch {
            let cachedOptions = ((try? offlineCache.loadProjectOptions(organizationId: organizationId)) ?? [])
                .map { ProjectOption(project: $0.project, schemaVersion: $0.schemaVersion) }
            if !cachedOptions.isEmpty {
                projectOptions = cachedOptions
                if selectedProjectId == nil {
                    selectedProjectId = cachedOptions.first?.id
                }
                if selectedRecordTypeKey == nil {
                    selectedRecordTypeKey = recordTypes.first?.key
                }
                loadState = .loaded
            } else {
                loadState = .failed(String(describing: error))
            }
        }
    }

    private func isComplete(_ input: FormFieldInput) -> Bool {
        switch input {
        case .text(let value), .numberText(let value), .date(let value):
            return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .select(let value):
            return value != nil
        case .multiSelect(let values):
            return !values.isEmpty
        case .boolean:
            return true
        case .photo(let ref):
            return ref?.isEmpty == false
        case .gps(let gps):
            return gps != nil
        }
    }

    func refreshQueueSnapshot() async {
        queueSnapshot = try? await queue.snapshot()
        onQueueSnapshotChanged?(queueSnapshot)
    }

    func selectProject(_ projectId: String) {
        guard projectId != selectedProjectId else { return }
        selectedProjectId = projectId
        selectedRecordTypeKey = recordTypes.first?.key
        resetDraftValues()
    }

    func selectRecordType(_ key: String) {
        guard key != selectedRecordTypeKey else { return }
        selectedRecordTypeKey = key
        resetDraftValues()
    }

    /// Clears the entered field values + evidence — called both when
    /// switching project/record-type (where the fresh form should also read
    /// as `.idle`) and after a successful submit (where the caller sets
    /// `submitState` to `.synced` itself, *after* this returns, so a
    /// `resetSubmitState: false` call doesn't clobber that with `.idle`).
    private func resetDraftValues(resetSubmitState: Bool = true) {
        values = [:]
        evidenceGps = nil
        evidencePhotoRefs = []
        photoMetadataByRef = [:]
        pendingMedia = [:]
        attachmentViewStates = []
        evidenceNotes = ""
        nearbyPoints = nil
        nearbyPointsErrorMessage = nil
        attachedPoint = nil
        preAttachPointId = nil
        lastValidation = nil
        dedupState = .idle
        if resetSubmitState {
            submitState = .idle
        }
    }

    // MARK: - Field value editing

    func setValue(_ input: FormFieldInput, for key: String) {
        values[key] = input
    }

    func value(for key: String) -> FormFieldInput {
        guard let descriptor = descriptors.first(where: { $0.key == key }) else {
            return values[key] ?? .text("")
        }
        return values[key] ?? .empty(for: descriptor.control)
    }

    // MARK: - Evidence capture

    func startFraudMetadataCapture() {
        fraudMetadataProvider.startCapture()
    }

    func stopFraudMetadataCapture() {
        fraudMetadataProvider.stopCapture()
    }

    // MARK: - Voice input

    /// Whether `CaptureFieldControl` should render a mic-button affordance at
    /// all — `false` only when no `speechRecognitionProvider` was injected.
    var isVoiceInputAvailable: Bool {
        speechRecognitionProvider != nil
    }

    /// Requests one dictation pass via the injected `SpeechRecognitionProviding`
    /// and, on success, fills the field named `key` with the (trimmed)
    /// transcript — `.numberText` for a `.number` field, `.text` for every
    /// other control kind, matching `textBinding`/`numberTextBinding` in
    /// `CaptureFieldControl`. A no-op when no provider was injected or the
    /// field doesn't exist on the current record type; a transcript that's
    /// empty (e.g. the collector tapped the mic then said nothing) leaves the
    /// field untouched.
    ///
    /// A second call for the SAME field while its dictation is already in
    /// flight (`voiceInputActiveKey == key`) is treated as "stop" rather than
    /// "start again": it cancels the in-flight `voiceInputTask` instead of
    /// requesting a fresh transcription. `SFSpeechRecognizerService`'s
    /// production recognition path reacts to that cancellation by ending
    /// audio input and letting the recognizer resolve normally with whatever
    /// it had transcribed so far, so this still fills the field — it just
    /// stops listening early instead of running until a timeout.
    func requestVoiceInput(for key: String) {
        guard let speechRecognitionProvider else { return }

        if voiceInputActiveKey == key {
            voiceInputTask?.cancel()
            return
        }

        guard let descriptor = descriptors.first(where: { $0.key == key }) else { return }

        voiceInputErrorMessage = nil
        voiceInputActiveKey = key
        voiceInputTask = Task { [weak self] in
            guard let self else { return }
            defer { self.voiceInputActiveKey = nil }

            do {
                let transcript = try await speechRecognitionProvider.requestTranscription()
                let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { return }
                switch descriptor.control {
                case .number:
                    self.setValue(.numberText(trimmed), for: key)
                default:
                    self.setValue(.text(trimmed), for: key)
                }
            } catch let error as SpeechRecognitionError {
                self.voiceInputErrorMessage = error.message(self.language)
            } catch {
                self.voiceInputErrorMessage = self.language.t("Voice input failed.", "La saisie vocale a échoué.")
            }
        }
    }

    func addPhotoRef(_ ref: String, metadata: PlatformRecordEvidence.PhotoMetadata? = nil) {
        evidencePhotoRefs.append(ref)
        if let metadata {
            photoMetadataByRef[ref] = metadata
        }
    }

    func metadataForCapturedPhoto(_ ref: String) -> PlatformRecordEvidence.PhotoMetadata? {
        let capturedAt = ISO8601DateFormatter().string(from: now())
        return fraudMetadataProvider.photoMetadata(for: ref, capturedAt: capturedAt)
    }

    func removePhotoRef(_ ref: String) {
        evidencePhotoRefs.removeAll { $0 == ref }
        photoMetadataByRef[ref] = nil
    }

    func addPhoto(_ data: Data, placement: CaptureAttachmentPlacement) async throws -> LedgerAttachment {
        guard let image = UIImage(data: data) else {
            throw CaptureAttachmentPickerError.imageProcessingFailed
        }
        let prepared = try CaptureMediaPreparer.prepare(image)
        let recordLocalID = UUID().uuidString
        let attachment = try await mediaStore.stage(
            prepared,
            ownerUserID: ownerUserID ?? "anonymous",
            organizationID: organizationId,
            recordLocalID: recordLocalID
        )
        let viewState = CaptureAttachmentViewState(
            thumbnail: data,
            placement: placement,
            byteCount: data.count,
            localID: recordLocalID
        )
        attachmentViewStates.append(viewState)
        return attachment
    }

    @discardableResult
    func preparePhoto(_ data: Data, placement: CaptureAttachmentPlacement) throws -> String {
        guard let image = UIImage(data: data) else {
            throw CaptureAttachmentPickerError.imageProcessingFailed
        }
        let prepared = try CaptureMediaPreparer.prepare(image)
        let localID = UUID().uuidString
        let placementValue: String
        switch placement {
        case .recordEvidence: placementValue = "recordEvidence"
        case .schemaField(let key): placementValue = "schemaField:\(key)"
        }
        pendingMedia[localID] = CaptureIntentMedia(prepared: prepared, placement: placementValue)
        attachmentViewStates.append(CaptureAttachmentViewState(
            thumbnail: data,
            placement: placement,
            byteCount: prepared.data.count,
            localID: localID
        ))
        return localID
    }

    func preparePhotoDataURL(_ dataURL: String, placement: CaptureAttachmentPlacement) throws -> String {
        guard let marker = dataURL.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: marker)...])) else {
            throw CaptureAttachmentPickerError.imageProcessingFailed
        }
        return try preparePhoto(data, placement: placement)
    }

    func removePreparedPhoto(localID: String) {
        pendingMedia[localID] = nil
        attachmentViewStates.removeAll { $0.localID == localID }
        evidencePhotoRefs.removeAll { $0 == localID }
        photoMetadataByRef[localID] = nil
    }

    func removePhoto(localID: String) async throws {
        attachmentViewStates.removeAll { $0.localID == localID }
        try await mediaStore.discard(recordLocalID: localID)
    }

    func requestLocation() async {
        guard let locationService else {
            locationErrorMessage = LocationServiceError.unavailable.message(language)
            return
        }
        isRequestingLocation = true
        locationErrorMessage = nil
        do {
            evidenceGps = try await locationService.requestOneShotLocation()
        } catch let error as LocationServiceError {
            locationErrorMessage = error.message(language)
        } catch {
            locationErrorMessage = LocationServiceError.unavailable.message(language)
        }
        isRequestingLocation = false
    }

    func loadNearbyPoints() async {
        guard let projectOption = selectedProjectOption else {
            nearbyPointsErrorMessage = language.t("Choose a project first.", "Choisissez d'abord un projet.")
            return
        }

        isLoadingNearbyPoints = true
        nearbyPointsErrorMessage = nil
        do {
            if evidenceGps == nil {
                await requestLocation()
            }
            guard let gps = evidenceGps else {
                nearbyPointsErrorMessage = locationErrorMessage ?? language.t(
                    "Capture GPS before looking for nearby points.",
                    "Capturez la position GPS avant de chercher les points proches."
                )
                isLoadingNearbyPoints = false
                return
            }
            nearbyPoints = try await apiClient.nearbyPlatformPoints(
                projectId: projectOption.project.id,
                latitude: gps.latitude,
                longitude: gps.longitude
            )
        } catch {
            nearbyPointsErrorMessage = language.t(
                "Could not load nearby points.",
                "Impossible de charger les points à proximité."
            )
        }
        isLoadingNearbyPoints = false
    }

    func attach(to point: PlatformNearbyPoint) {
        attachedPoint = point
        preAttachPointId = nil
        nearbyPoints = nil
        nearbyPointsErrorMessage = nil
        if evidenceGps == nil {
            evidenceGps = FormGpsValue(
                latitude: point.location.latitude,
                longitude: point.location.longitude
            )
        }
    }

    func clearAttachedPoint() {
        attachedPoint = nil
        preAttachPointId = nil
    }

    // MARK: - Validation

    @discardableResult
    func validate() -> FormValidationResult {
        guard let recordType = selectedRecordType else {
            let empty = FormValidationResult(fieldErrors: [], evidenceErrors: [])
            lastValidation = empty
            return empty
        }
        let evidence = FormEvidenceInput(
            gps: evidenceGps,
            photoCount: evidencePhotoRefs.count,
            notes: evidenceNotes.isEmpty ? nil : evidenceNotes
        )
        let result = FormValidator.validate(recordType: recordType, values: values, evidence: evidence)
        lastValidation = result
        return result
    }

    // MARK: - Duplicate-candidate check

    /// The dedup endpoint's `category` query param goes straight to
    /// `normalizeCategory` in `api/submissions/index.ts`, which only accepts
    /// the legacy `SubmissionCategory` domain — the 7 vertical ids
    /// (`shared/verticals.ts`'s `VERTICALS` keys) or the legacy aliases in
    /// its `LEGACY_CATEGORY_MAP` — and 400s on anything else. A schema
    /// record-type `key` outside that set (e.g. an org's custom schema key
    /// like `"org_custom_survey"`) would 400 on every request; `checkDedup()`
    /// already fails open to `.clear` on any error, so that 400 would be
    /// silently swallowed and dedup would look "on" while actually never
    /// running. Gating on this mapping client-side avoids firing a request
    /// that's guaranteed to fail, rather than relying on fail-open to hide it.
    private static let legacyDedupCategoryKeys: Set<String> = [
        "pharmacy", "fuel_station", "mobile_money", "alcohol_outlet",
        "billboard", "transport_road", "census_proxy",
    ]

    /// Mirrors `LEGACY_CATEGORY_MAP` in `shared/verticals.ts` exactly —
    /// the uppercase legacy `Category` enum values `normalizeCategoryAlias`
    /// also accepts alongside an exact vertical-id match.
    private static let legacyDedupCategoryAliases: [String: String] = [
        "PHARMACY": "pharmacy",
        "FUEL": "fuel_station",
        "MOBILE_MONEY": "mobile_money",
        "ALCOHOL_OUTLET": "alcohol_outlet",
        "BILLBOARD": "billboard",
        "TRANSPORT_ROAD": "transport_road",
        "CENSUS_PROXY": "census_proxy",
        "KIOSK": "mobile_money",
    ]

    /// Resolves a schema record-type `key` to the legacy category string the
    /// dedup endpoint understands, or `nil` if there is no such mapping.
    private static func legacyDedupCategory(forRecordTypeKey key: String) -> String? {
        if legacyDedupCategoryKeys.contains(key) { return key }
        return legacyDedupCategoryAliases[key]
    }

    /// Looks up nearby possible-duplicate points for the in-progress capture
    /// — `GET api/submissions?view=dedup_candidates`, a geo + category + name
    /// proximity match (see `lib/server/dedup.ts:buildDedupCandidates`), NOT
    /// a hash lookup. Requires a selected record type and a captured GPS fix;
    /// without either there is nothing to check against, so `dedupState`
    /// goes straight to `.clear`. Likewise, when the selected record type's
    /// `key` has no legacy-category mapping (see `legacyDedupCategory`
    /// above), the lookup is skipped entirely rather than firing a request
    /// the server is guaranteed to reject.
    ///
    /// Any failure — network error or an unparsable/unexpected response —
    /// also lands on `.clear`, never `.prompt`: this check must fail OPEN.
    /// A flaky dedup lookup must never block a field agent's submission.
    func checkDedup() async {
        guard let recordType = selectedRecordType, let gps = evidenceGps else {
            dedupState = .clear
            return
        }
        guard let legacyCategory = Self.legacyDedupCategory(forRecordTypeKey: recordType.key) else {
            dedupState = .clear
            return
        }
        dedupState = .checking
        do {
            let result = try await apiClient.dedupCandidates(
                category: legacyCategory,
                latitude: gps.latitude,
                longitude: gps.longitude,
                name: currentNameFieldValue
            )
            dedupState = result.shouldPrompt
                ? .prompt(candidates: result.candidates, bestPointId: result.bestCandidatePointId)
                : .clear
        } catch {
            dedupState = .clear
        }
    }

    /// Best-effort "name-ish" value to pass as the dedup lookup's optional
    /// `name` query param. The schema-driven form has no fixed name field —
    /// unlike the original field app's fixed `SubmissionDetails.name` /
    /// `.siteName` / `.roadName` — so this scans the current record type's
    /// text descriptors for a key that reads like one, which is close enough
    /// to be useful without hard-coding a specific schema's field keys.
    private var currentNameFieldValue: String? {
        for descriptor in descriptors where descriptor.control == .text {
            guard descriptor.key.localizedCaseInsensitiveContains("name") else { continue }
            if case .text(let value) = values[descriptor.key] {
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { return trimmed }
            }
        }
        return nil
    }

    // MARK: - Submit

    /// Validates, then (on success) checks for duplicate candidates and,
    /// once clear, builds a `RecordDraft`, enqueues it, and triggers an
    /// immediate `RecordQueue.sync` wired to
    /// `PlatformAPIClient.createPlatformRecord`. A draft that fails to sync
    /// right away (offline, retryable server error) stays safely queued —
    /// `submitState` reflects that as `.queuedPendingSync`, not `.failed`.
    ///
    /// When `checkDedup()` lands on `.prompt`, this returns early without
    /// enqueueing anything — `CaptureView` presents `DedupWarningSheet`
    /// (informational-only: lists candidates, no "use existing" action),
    /// which resumes the flow via `resolveDedupPrompt()` ("Submit anyway")
    /// or aborts it via `cancelDedupPrompt()` ("Cancel").
    func submit() async {
        guard creationAllowed() else {
            submitState = .failed(language.t(
                "This action requires a verified session.",
                "Cette action nécessite une session vérifiée."
            ))
            return
        }
        guard let recordType = selectedRecordType, let projectOption = selectedProjectOption else {
            submitState = .failed(language.t("Choose a project and record type first.", "Choisissez d'abord un projet et un type d'enregistrement."))
            return
        }

        let result = validate()
        guard result.isValid else {
            submitState = .invalid
            return
        }

        guard await validateAttachedPointProximityIfNeeded() else {
            return
        }

        await checkDedup()
        if case .prompt = dedupState {
            return
        }

        await performSubmit(recordType: recordType, projectOption: projectOption)
    }

    /// Resumes a `submit()` that paused on `DedupState.prompt` — the
    /// collector reviewed the listed candidates on `DedupWarningSheet` and
    /// chose "Submit anyway". `DedupWarningSheet` is informational-only:
    /// dedup candidates are legacy public *projected points*, and
    /// `platform_record_create`'s `pointId` parameter only resolves org
    /// *platform records* (`lib/server/platform/pointLookup.ts`) — sending a
    /// candidate's `pointId` there is a guaranteed 409, not a valid "attach
    /// to existing" path. The only supported "this belongs to an existing
    /// point" mechanism for this flow is `attach(to:)`/`preAttachPointId`
    /// (company-map attachment), which `submitAttachPointId` still honors
    /// here unchanged — this method only ever proceeds as a new record.
    func resolveDedupPrompt() async {
        dedupState = .clear
        guard let recordType = selectedRecordType, let projectOption = selectedProjectOption else {
            submitState = .failed(language.t("Choose a project and record type first.", "Choisissez d'abord un projet et un type d'enregistrement."))
            return
        }
        await performSubmit(recordType: recordType, projectOption: projectOption)
        advanceBatchIfCompleted()
    }

    /// Dismisses `DedupWarningSheet` without submitting anything — the
    /// collector keeps editing the in-progress capture.
    func cancelDedupPrompt() {
        dedupState = .idle
        submitState = .idle
    }

    // MARK: - Batch capture

    /// Runs a normal `submit()` and, when it actually went through — synced
    /// immediately or safely queued offline — advances the batch counter and
    /// clears the draft so `CaptureView` is ready for the next entry.
    ///
    /// When `submit()` pauses on `DedupState.prompt` instead, `submitState`
    /// stays `.idle` (neither `.synced` nor `.queuedPendingSync`), so
    /// `advanceBatchIfCompleted()` below is a no-op here — the batch counter
    /// only advances once the collector resolves the prompt via
    /// `resolveDedupPrompt()`, which applies this same bookkeeping itself.
    func submitInBatch() async {
        await submit()
        advanceBatchIfCompleted()
    }

    /// Shared "did this submit actually complete" bookkeeping for
    /// `submitInBatch()` and `resolveDedupPrompt()` — both routes into
    /// `performSubmit` need the same batch-counter/draft-reset treatment on
    /// success so a record resolved through `DedupWarningSheet` in batch mode
    /// counts toward the batch the same as any other submit.
    ///
    /// `&&` binds tighter than `||` in Swift, so the `||` MUST stay
    /// parenthesized here: `isBatchMode && (a || b)`. Written as
    /// `isBatchMode && a || b` this would read as `(isBatchMode && a) || b`,
    /// which fires the "advance batch" branch on `.queuedPendingSync` even
    /// when `isBatchMode` is false. The original design spec had exactly
    /// this bug — do not reintroduce it.
    private func advanceBatchIfCompleted() {
        if isBatchMode && (submitState == .synced || submitState == .queuedPendingSync) {
            batchCompleted += 1
            resetDraftValues(resetSubmitState: false)
            submitState = .idle
        }
    }

    /// Exits batch mode and resets its counters — wired to the "Finish
    /// batch" button on `CaptureView`. Does not touch the in-progress draft;
    /// a collector who finishes mid-entry keeps whatever they had typed.
    func finishBatch() {
        isBatchMode = false
        batchCompleted = 0
        batchTarget = 0
    }

    private func performSubmit(recordType: PlatformRecordType, projectOption: ProjectOption) async {
        submitState = .submitting

        let data = FormValidator.recordData(recordType: recordType, values: values)
        let capturedAtDate = now()
        let capturedAt = ISO8601DateFormatter().string(from: capturedAtDate)
        let photoMetadata = evidencePhotoRefs.compactMap { photoMetadataByRef[$0] }
        let draft = RecordDraft(
            projectId: projectOption.project.id,
            schemaVersionId: projectOption.schemaVersion.id,
            recordTypeKey: recordType.key,
            data: data,
            photoRefs: evidencePhotoRefs,
            gps: evidenceGps,
            notes: evidenceNotes.isEmpty ? nil : evidenceNotes,
            pointId: submitAttachPointId,
            capturedAt: capturedAt,
            device: fraudMetadataProvider.device(language: language),
            photoMetadata: photoMetadata.isEmpty ? nil : photoMetadata,
            clientExif: fraudMetadataProvider.clientExif(gps: evidenceGps, capturedAt: capturedAt),
            gpsIntegrity: fraudMetadataProvider.gpsIntegrity(gps: evidenceGps, capturedAt: capturedAtDate)
        )

        if let durableCoordinator, let ownerUserID {
            do {
                // Persist the complete, already-validated submission envelope.
                // Encoding only `data` here would silently drop GPS, notes,
                // fraud metadata, capture time, and point enrichment while the
                // record waits for a later sync.
                let fieldValuesData = try JSONEncoder().encode(draft)
                guard let fieldValuesJSON = String(data: fieldValuesData, encoding: .utf8) else {
                    throw CaptureAttachmentPickerError.storageFailed
                }
                let intent = CaptureIntent(
                    projectID: projectOption.project.id,
                    schemaVersionID: projectOption.schemaVersion.id,
                    recordTypeKey: recordType.key,
                    fieldValuesJSON: fieldValuesJSON,
                    ownerUserID: ownerUserID,
                    organizationID: organizationId,
                    media: Array(pendingMedia.values)
                )
                let localID = try await durableCoordinator.persist(intent)
                resetDraftValues(resetSubmitState: false)
                pendingMedia = [:]
                attachmentViewStates = []
                submitState = .queuedPendingSync
                await onDurableRecordPersisted?(localID)
            } catch {
                submitState = .failed(String(describing: error))
            }
            return
        }

        let enqueuedId: String
        do {
            enqueuedId = try await queue.enqueue(draft).id
        } catch RecordQueueError.full(let maxItems) {
            submitState = .failed(
                language.t(
                    "Offline queue is full (\(maxItems) items). Sync or clear older items first.",
                    "La file hors-ligne est pleine (\(maxItems) éléments). Synchronisez ou supprimez d'anciens éléments d'abord."
                )
            )
            return
        } catch {
            submitState = .failed(String(describing: error))
            return
        }

        let summary = await queue.sync { [apiClient] draft, idempotencyKey in
            try await Self.submitDraft(draft, idempotencyKey: idempotencyKey, apiClient: apiClient)
        }
        queueSnapshot = try? await queue.snapshot()
        onQueueSnapshotChanged?(queueSnapshot)

        if summary.syncedIds.contains(enqueuedId) {
            resetDraftValues(resetSubmitState: false)
            submitState = .synced
        } else if summary.permanentFailureIds.contains(enqueuedId) {
            submitState = .failed(language.t("Could not submit this record.", "Impossible de soumettre cet enregistrement."))
        } else {
            // Still queued (offline, or a retryable failure this pass) —
            // the draft is safe and `SyncStatusBar`-equivalent UI can retry.
            submitState = .queuedPendingSync
        }
    }

    private func validateAttachedPointProximityIfNeeded() async -> Bool {
        guard submitAttachPointId != nil, let attachPointGps else { return true }
        if evidenceGps == nil {
            await requestLocation()
        }
        guard let captureGps = evidenceGps else {
            submitState = .failed(language.t(
                "Capture GPS before updating an existing point.",
                "Capturez la position GPS avant de mettre à jour un point existant."
            ))
            return false
        }
        let distance = Self.distanceMeters(from: captureGps, to: attachPointGps)
        guard distance <= Self.enrichMaxDistanceMeters else {
            submitState = .failed(language.t(
                "You are too far from this point to update it. Move within \(Int(Self.enrichMaxDistanceMeters))m and refresh GPS.",
                "Vous êtes trop loin de ce point pour le mettre à jour. Approchez-vous à moins de \(Int(Self.enrichMaxDistanceMeters)) m et actualisez le GPS."
            ))
            return false
        }
        return true
    }

    private static func distanceMeters(from start: FormGpsValue, to end: FormGpsValue) -> Double {
        let earthRadiusMeters = 6_371_000.0
        let startLatitude = start.latitude * .pi / 180
        let endLatitude = end.latitude * .pi / 180
        let latitudeDelta = (end.latitude - start.latitude) * .pi / 180
        let longitudeDelta = (end.longitude - start.longitude) * .pi / 180
        let a = sin(latitudeDelta / 2) * sin(latitudeDelta / 2)
            + cos(startLatitude) * cos(endLatitude) * sin(longitudeDelta / 2) * sin(longitudeDelta / 2)
        return earthRadiusMeters * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    /// Wires one `RecordDraft` to `PlatformAPIClient.createPlatformRecord`,
    /// translating `PlatformAPIError` into `RecordSubmitError.retryable` for
    /// transient/server failures (5xx, no-network `-1`) or `.permanent` for
    /// anything else (4xx validation/auth failures a retry can't fix) —
    /// mirrors `toQueueErrorInfo`'s retryable-by-default posture in
    /// `offlineQueue.ts` while still giving permanent 4xx failures a fast
    /// exit instead of exhausting all 6 retries first.
    private static func submitDraft(
        _ draft: RecordDraft,
        idempotencyKey: String,
        apiClient: PlatformAPIClient
    ) async throws {
        do {
            _ = try await apiClient.createPlatformRecord(
                projectId: draft.projectId,
                schemaVersionId: draft.schemaVersionId,
                recordTypeKey: draft.recordTypeKey,
                data: draft.data,
                evidence: PlatformRecordEvidence(
                    gps: draft.gps.map {
                        PlatformRecordGps(latitude: $0.latitude, longitude: $0.longitude, accuracyMeters: $0.accuracyMeters)
                    },
                    photos: draft.photoRefs,
                    notes: draft.notes,
                    capturedAt: draft.capturedAt,
                    device: draft.device,
                    photoMetadata: draft.photoMetadata,
                    clientExif: draft.clientExif,
                    gpsIntegrity: draft.gpsIntegrity
                ),
                idempotencyKey: idempotencyKey,
                pointId: draft.pointId
            )
        } catch let error as PlatformAPIError {
            if error.status == -1 || (500..<600).contains(error.status) {
                throw RecordSubmitError.retryable(error.message)
            }
            throw RecordSubmitError.permanent(error.message)
        }
    }
}
