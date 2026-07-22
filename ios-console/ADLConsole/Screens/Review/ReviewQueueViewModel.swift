import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `ReviewQueueView` — the reviewer/manager/owner's pending-records
/// queue: load, inspect, approve/reject a single record, or mass-approve a
/// selection. Every network call and state transition lives here; the view
/// only renders `@Published` state and forwards user intents.
///
/// Source of truth for behavior: `components/Console/ReviewQueueScreen.tsx`
/// (web, read-only reference) + `lib/client/platformApi.ts`. Two documented,
/// deliberate differences from the web screen:
///
///  1. **Pending filter, applied server-side.** The web screen calls
///     `listPlatformRecordsRequest(organizationId)` with NO `status` param
///     and filters the full result set client-side by `filter ===
///     'pending_review'` (its default `Filter` state for the non-`readOnly`
///     route the console's REVIEW screen always renders with — see
///     `ConsoleApp.tsx`'s `<ReviewQueueScreen organizationId=... language=...
///     />` call with no `readOnly` prop). This view-model instead calls
///     `PlatformAPIClient.listPlatformRecords(organizationId:status:)` with
///     `status: .pendingReview` — the exact same `view=platform_record_list`
///     endpoint and the exact same `status=pending_review` query value
///     (`PlatformRecordStatus.pendingReview.rawValue`), just supplied as a
///     server-side filter instead of a client-side one. `listPlatformRecords`
///     already supports this (`if let status { params["status"] =
///     status.rawValue }`); the web screen simply never happened to pass it
///     for this particular call. A mobile reviewer queue only ever shows
///     pending records, so narrowing server-side avoids transferring
///     approved/rejected history the queue never displays.
///  2. **Resolved records are removed, not replaced in place.** On a
///     successful decision, the web screen does `records.map(record =>
///     record.id === recordId ? updated : record)` because its `records`
///     array can hold every status (the user can flip `filter` to
///     "Approved"/"Rejected"/"All" and see history). This view-model's
///     `records` only ever holds pending records (see point 1), so a
///     resolved record no longer belongs in it — it is removed instead,
///     which is the pending-only-queue equivalent of that same update.
///
/// Review decision payload (`reviewPlatformRecord`) matches
/// `reviewPlatformRecordRequest` exactly: POST `view=platform_record_review`
/// with `{ organizationId, recordId, status: "approved" | "rejected",
/// reviewNotes? }`. Reject requires a non-empty trimmed reason — enforced
/// client-side before the network call, mirroring the web screen's
/// `decide()` guard ("Add a rejection reason before rejecting this
/// record.") exactly, including the copy.
@MainActor
final class ReviewQueueViewModel: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    @Published private(set) var records: [PlatformRecord] = []
    @Published private(set) var loadState: LoadState = .idle
    @Published var selection: Set<String> = []
    @Published private(set) var busyRecordId: String?
    @Published private(set) var isBulkBusy: Bool = false
    @Published var notificationTitle: String = ""
    @Published var notificationBody: String = ""
    @Published var selectedNotificationAudienceId: String?
    @Published private(set) var isSendingNotification = false
    @Published private(set) var notificationError: String?
    @Published private(set) var notificationResult: PlatformNotificationBroadcastResponse?

    /// Per-record decision error, keyed by record id — set when that
    /// record's `approve`/`reject`/mass-approve attempt fails; cleared the
    /// next time a decision is attempted for that record. Scoped per-row
    /// (rather than one shared banner, as the web screen has) so one failing
    /// item in a mass-approve batch doesn't obscure the others' state.
    @Published private(set) var itemErrors: [String: String] = [:]

    let language: ConsoleLanguage
    let viewerRole: PlatformRole

    private let apiClient: PlatformAPIClient
    private let organizationId: String

    struct NotificationAudience: Identifiable, Equatable {
        var id: String
        var title: String
        var subtitle: String
        var roles: [PlatformRole]
    }

    init(apiClient: PlatformAPIClient, organizationId: String, viewerRole: PlatformRole = .reviewer, language: ConsoleLanguage) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.viewerRole = viewerRole
        self.language = language
        self.selectedNotificationAudienceId = Self.notificationAudiences(for: viewerRole, language: language).first?.id
    }

    // MARK: - Derived state

    var isEmpty: Bool { loadState == .loaded && records.isEmpty }

    var loadErrorMessage: String? {
        if case .failed(let message) = loadState { return message }
        return nil
    }

    func isSelected(_ recordId: String) -> Bool { selection.contains(recordId) }

    func itemError(for recordId: String) -> String? { itemErrors[recordId] }

    var notificationAudiences: [NotificationAudience] {
        Self.notificationAudiences(for: viewerRole, language: language)
    }

    var selectedNotificationAudience: NotificationAudience? {
        notificationAudiences.first { $0.id == selectedNotificationAudienceId }
    }

    var canSendNotifications: Bool {
        !notificationAudiences.isEmpty
    }

    var isNotificationValid: Bool {
        selectedNotificationAudience != nil
            && !notificationTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !notificationBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private static func notificationAudiences(for role: PlatformRole, language: ConsoleLanguage) -> [NotificationAudience] {
        let lowerRoles = [PlatformRole.manager, .reviewer, .collector, .viewer].filter { candidate in
            (PlatformRoleRank.rank[role] ?? 0) > (PlatformRoleRank.rank[candidate] ?? 0)
        }
        guard !lowerRoles.isEmpty else { return [] }

        var audiences: [NotificationAudience] = [
            NotificationAudience(
                id: "lower_roles",
                title: language.t("All lower roles", "Tous les rôles inférieurs"),
                subtitle: lowerRoles.map { roleLabel($0, language: language) }.joined(separator: ", "),
                roles: lowerRoles
            )
        ]

        if lowerRoles.contains(.collector) {
            audiences.append(
                NotificationAudience(
                    id: "collectors",
                    title: language.t("Collectors", "Collecteurs"),
                    subtitle: language.t("Field contributors only", "Contributeurs terrain uniquement"),
                    roles: [.collector]
                )
            )
        }

        for targetRole in lowerRoles where targetRole != .collector {
            audiences.append(
                NotificationAudience(
                    id: targetRole.rawValue,
                    title: roleLabel(targetRole, language: language),
                    subtitle: language.t("Only this role", "Uniquement ce rôle"),
                    roles: [targetRole]
                )
            )
        }
        return audiences
    }

    private static func roleLabel(_ role: PlatformRole, language: ConsoleLanguage) -> String {
        switch role {
        case .owner: return language.t("Owners", "Propriétaires")
        case .manager: return language.t("Managers", "Managers")
        case .reviewer: return language.t("Reviewers", "Réviseurs")
        case .collector: return language.t("Collectors", "Collecteurs")
        case .viewer: return language.t("Viewers", "Lecteurs")
        }
    }

    // MARK: - Load

    /// `view=platform_record_list`, GET, `organizationId` + `status=pending_review`.
    /// Port of `listPlatformRecordsRequest`/`PlatformAPIClient.listPlatformRecords`
    /// — see the type doc above for why `status` is supplied here.
    func load(force: Bool = false) async {
        guard force || loadState != .loading else { return }
        guard force || loadState != .loaded else { return }
        loadState = .loading
        do {
            records = try await apiClient.listPlatformRecords(organizationId: organizationId, status: .pendingReview)
            selection.removeAll()
            itemErrors.removeAll()
            loadState = .loaded
        } catch {
            loadState = .failed(loadFailureMessage(for: error))
        }
    }

    // MARK: - Selection (mass-action support)

    func toggleSelection(_ recordId: String) {
        if selection.contains(recordId) {
            selection.remove(recordId)
        } else {
            selection.insert(recordId)
        }
    }

    func clearSelection() {
        selection.removeAll()
    }

    // MARK: - Notifications

    func resetNotificationComposer() {
        notificationTitle = ""
        notificationBody = ""
        selectedNotificationAudienceId = notificationAudiences.first?.id
        notificationError = nil
        notificationResult = nil
    }

    @discardableResult
    func sendNotification() async -> Bool {
        guard let audience = selectedNotificationAudience, isNotificationValid else { return false }
        let title = notificationTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = notificationBody.trimmingCharacters(in: .whitespacesAndNewlines)
        notificationError = nil
        notificationResult = nil
        isSendingNotification = true
        defer { isSendingNotification = false }
        do {
            notificationResult = try await apiClient.sendNotificationBroadcast(
                organizationId: organizationId,
                targetRoles: audience.roles,
                title: title,
                body: body
            )
            notificationTitle = ""
            notificationBody = ""
            return true
        } catch {
            notificationError = describePlatformError(error, language: language)
            return false
        }
    }

    // MARK: - Decisions

    /// Port of `decide(recordId, 'approved')`. `reviewNotes` is optional on
    /// approve, matching the web's "optional when approving" placeholder
    /// copy — an empty/whitespace-only note is sent as `nil`, not `""`.
    @discardableResult
    func approve(_ recordId: String, reviewNotes: String? = nil) async -> Bool {
        await decide(recordId, status: .approved, reviewNotes: nonEmpty(reviewNotes))
    }

    /// Port of `decide(recordId, 'rejected')`, including the web screen's
    /// client-side guard: a trimmed-empty `reason` is rejected before any
    /// network call, with the same message the web shows
    /// ("Add a rejection reason before rejecting this record.").
    @discardableResult
    func reject(_ recordId: String, reason: String) async -> Bool {
        guard let trimmed = nonEmpty(reason) else {
            itemErrors[recordId] = language.t(
                "Add a rejection reason before rejecting this record.",
                "Ajoutez un motif avant de rejeter cette donnée."
            )
            return false
        }
        return await decide(recordId, status: .rejected, reviewNotes: trimmed)
    }

    /// Mass-approve every currently-selected record. There is no bulk
    /// endpoint on the web either — `ReviewQueueScreen.tsx`'s `decide` is
    /// always one record at a time; this iterates the selection (in a
    /// stable, sorted order) and calls the same per-record `reviewPlatformRecord`
    /// decision for each id, exactly as if a reviewer approved each row by
    /// hand. A failing item's error lands in `itemErrors[id]` and that item
    /// stays in both `records` and `selection` (still visible, still
    /// selected, ready for a retry); every other selected item is still
    /// attempted regardless — one failure never aborts the batch. Returns
    /// the number of records that were successfully approved.
    @discardableResult
    func approveSelected() async -> Int {
        isBulkBusy = true
        defer { isBulkBusy = false }
        var succeededCount = 0
        for recordId in selection.sorted() where records.contains(where: { $0.id == recordId }) {
            if await decide(recordId, status: .approved, reviewNotes: nil) {
                succeededCount += 1
            }
        }
        return succeededCount
    }

    /// Port of `decide()`'s network call + local-state update. POST
    /// `view=platform_record_review` with `{ organizationId, recordId,
    /// status, reviewNotes }` — see the type doc above for why success
    /// removes the record instead of replacing it in place.
    private func decide(_ recordId: String, status: PlatformRecordReviewStatus, reviewNotes: String?) async -> Bool {
        busyRecordId = recordId
        itemErrors[recordId] = nil
        defer { busyRecordId = nil }
        do {
            _ = try await apiClient.reviewPlatformRecord(
                organizationId: organizationId,
                recordId: recordId,
                status: status,
                reviewNotes: reviewNotes
            )
            records.removeAll { $0.id == recordId }
            selection.remove(recordId)
            return true
        } catch {
            itemErrors[recordId] = decisionFailureMessage(for: error)
            return false
        }
    }

    // MARK: - Error messages (mirrors ReviewQueueScreen.tsx's two fallback strings)

    private func loadFailureMessage(for error: Error) -> String {
        if let apiError = error as? PlatformAPIError, apiError.status < 500 {
            return apiError.message
        }
        return language.t(
            "Could not load company records. Check your connection and try again.",
            "Impossible de charger les données entreprise. Vérifiez votre connexion et réessayez."
        )
    }

    private func decisionFailureMessage(for error: Error) -> String {
        if let apiError = error as? PlatformAPIError, apiError.status < 500 {
            return apiError.message
        }
        return language.t(
            "The review decision was not saved. Check your connection and try again.",
            "La décision n'a pas été enregistrée. Vérifiez votre connexion et réessayez."
        )
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        return trimmed
    }
}
