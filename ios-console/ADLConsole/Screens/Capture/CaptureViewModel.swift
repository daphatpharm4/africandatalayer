import ConsoleAPI
import ConsoleForms
import ConsoleModels
import Foundation

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
    struct ProjectOption: Identifiable, Equatable {
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

    let language: ConsoleLanguage

    private let apiClient: PlatformAPIClient
    private let organizationId: String
    private let queue: RecordQueue
    private let locationService: LocationServiceProtocol?
    private let now: () -> Date

    init(
        apiClient: PlatformAPIClient,
        organizationId: String,
        queue: RecordQueue,
        language: ConsoleLanguage,
        locationService: LocationServiceProtocol? = nil,
        now: @escaping () -> Date = { Date() }
    ) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.queue = queue
        self.language = language
        self.locationService = locationService
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

    // MARK: - Loading projects + schemas

    /// Loads every active project in the org with a published schema —
    /// mirrors `collectablePlatformProjects` in
    /// `lib/client/platformFieldContext.ts`. Selects the first project and
    /// its first record type by default so the form is immediately usable.
    func loadProjects() async {
        loadState = .loading
        do {
            let projects = try await apiClient.listProjects(organizationId: organizationId)
            var options: [ProjectOption] = []
            for project in projects where project.status != .archived {
                let schema = try await apiClient.getSchema(projectId: project.id)
                if let published = schema.published {
                    options.append(ProjectOption(project: project, schemaVersion: published))
                }
            }
            projectOptions = options
            if selectedProjectId == nil {
                selectedProjectId = options.first?.id
            }
            if selectedRecordTypeKey == nil {
                selectedRecordTypeKey = recordTypes.first?.key
            }
            loadState = .loaded
        } catch {
            loadState = .failed(String(describing: error))
        }
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
        evidenceNotes = ""
        lastValidation = nil
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

    func addPhotoRef(_ ref: String) {
        evidencePhotoRefs.append(ref)
    }

    func removePhotoRef(_ ref: String) {
        evidencePhotoRefs.removeAll { $0 == ref }
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

    // MARK: - Submit

    /// Validates, then (on success) builds a `RecordDraft`, enqueues it, and
    /// triggers an immediate `RecordQueue.sync` wired to
    /// `PlatformAPIClient.createPlatformRecord`. A draft that fails to sync
    /// right away (offline, retryable server error) stays safely queued —
    /// `submitState` reflects that as `.queuedPendingSync`, not `.failed`.
    func submit() async {
        guard let recordType = selectedRecordType, let projectOption = selectedProjectOption else {
            submitState = .failed(language.t("Choose a project and record type first.", "Choisissez d'abord un projet et un type d'enregistrement."))
            return
        }

        let result = validate()
        guard result.isValid else {
            submitState = .invalid
            return
        }

        submitState = .submitting

        let data = FormValidator.recordData(recordType: recordType, values: values)
        let draft = RecordDraft(
            projectId: projectOption.project.id,
            schemaVersionId: projectOption.schemaVersion.id,
            recordTypeKey: recordType.key,
            data: data,
            photoRefs: evidencePhotoRefs,
            gps: evidenceGps,
            notes: evidenceNotes.isEmpty ? nil : evidenceNotes,
            capturedAt: ISO8601DateFormatter().string(from: now())
        )

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
                    capturedAt: draft.capturedAt
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
