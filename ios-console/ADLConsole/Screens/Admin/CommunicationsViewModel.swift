import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `CommunicationsView` — the ADL-admin communications panel: email
/// and SMS campaign lists plus a template → audience → schedule → review
/// composer flow. Unlike `MembersViewModel` and friends, this is **not**
/// organization-scoped: every endpoint it calls lives on `api/privacy`
/// (`GET|POST api/privacy?view=campaigns|sms-campaigns|email-templates|
/// audience-preview`, gated by `requireUser` + `toSubmissionAuthContext(...).isAdmin`
/// in `api/privacy/index.ts`), which is the ADL platform's own admin gate —
/// a different auth domain from the multi-tenant `platform_*` surface
/// `PlatformAPIClient`'s other methods hit. There is accordingly no
/// `organizationId` anywhere in this view model.
///
/// Composer note: subject/body are plain text fields for both the HTML and
/// text variants of an email send (`htmlBody`/`textBody` both receive the
/// same trimmed text) — a rich HTML editor is out of scope here per the
/// task brief ("Task 4").
@MainActor
final class CommunicationsViewModel: ObservableObject {
    enum Channel: String, CaseIterable, Sendable {
        case email
        case sms
    }

    enum ComposerStep: Int, CaseIterable, Sendable {
        case template
        case audience
        case schedule
        case review
    }

    enum SendState: Equatable, Sendable {
        case idle
        case sending
        case success
        case failure(String)
    }

    /// Options surfaced by the audience-filter UI. Mirrors the string
    /// literals `audienceSchema` validates server-side (`roles`:
    /// `"agent" | "admin" | "client"`; `trustTiers`: `"new" | "standard" |
    /// "trusted" | "elite" | "restricted"`).
    static let audienceRoleOptions = ["agent", "admin", "client"]
    static let audienceTrustTierOptions = ["new", "standard", "trusted", "elite", "restricted"]

    // MARK: - Campaign lists

    @Published private(set) var emailCampaigns: [EmailCampaign]?
    @Published private(set) var smsCampaigns: [SmsCampaign]?
    @Published private(set) var maxEmailRecipients: Int = 0
    @Published private(set) var maxSmsRecipients: Int = 0
    @Published private(set) var loadError: String?
    @Published private(set) var cancellingCampaignId: String?

    @Published var channel: Channel = .email

    // MARK: - Templates

    @Published private(set) var templates: [EmailTemplate]?
    @Published private(set) var templatesError: String?

    // MARK: - Composer

    @Published var isComposerPresented = false
    @Published var composerStep: ComposerStep = .template
    @Published var selectedTemplate: EmailTemplate?
    @Published var subject: String = ""
    @Published var messageBody: String = ""
    @Published var messageHTMLBody: String = ""

    @Published var audienceRoles: Set<String> = []
    @Published var audienceTrustTiers: Set<String> = []
    @Published var requireEmailOptIn: Bool = true
    @Published var lastActiveDaysText: String = ""

    @Published var scheduleForLater = false
    @Published var scheduledDate: Date = Date().addingTimeInterval(3600)

    @Published private(set) var audiencePreview: AudiencePreview?
    @Published private(set) var isPreviewingAudience = false
    @Published private(set) var previewError: String?

    @Published private(set) var sendState: SendState = .idle
    @Published private(set) var sendError: String?

    let language: ConsoleLanguage
    private let apiClient: PlatformAPIClient

    init(apiClient: PlatformAPIClient, language: ConsoleLanguage) {
        self.apiClient = apiClient
        self.language = language
    }

    // MARK: - Load

    /// Loads both campaign lists concurrently. Port of no single web
    /// function — `api/privacy?view=campaigns` and `view=sms-campaigns` are
    /// independent GETs, mirrored here as independent published lists that
    /// happen to load together on `.task`.
    func load(force: Bool = false) async {
        async let emailLoad: Void = loadEmailCampaigns(force: force)
        async let smsLoad: Void = loadSmsCampaigns(force: force)
        _ = await (emailLoad, smsLoad)
    }

    func loadEmailCampaigns(force: Bool = false) async {
        guard force || emailCampaigns == nil else { return }
        loadError = nil
        do {
            let result = try await apiClient.listEmailCampaigns()
            emailCampaigns = result.campaigns
            maxEmailRecipients = result.maxRecipients
        } catch {
            loadError = describePlatformError(error, language: language)
        }
    }

    func loadSmsCampaigns(force: Bool = false) async {
        guard force || smsCampaigns == nil else { return }
        loadError = nil
        do {
            let result = try await apiClient.listSmsCampaigns()
            smsCampaigns = result.campaigns
            maxSmsRecipients = result.maxRecipients
        } catch {
            loadError = describePlatformError(error, language: language)
        }
    }

    func loadTemplates(force: Bool = false) async {
        guard force || templates == nil else { return }
        templatesError = nil
        do {
            templates = try await apiClient.listEmailTemplates()
        } catch {
            templatesError = describePlatformError(error, language: language)
        }
    }

    // MARK: - Cancel

    /// `view=campaigns:cancel`, POST, `{ id }`. Port of `cancelCampaign`.
    func cancelEmailCampaign(_ campaign: EmailCampaign) async {
        cancellingCampaignId = campaign.id
        defer { cancellingCampaignId = nil }
        do {
            let cancelled = try await apiClient.cancelEmailCampaign(id: campaign.id)
            guard cancelled else { return }
            emailCampaigns = emailCampaigns?.map { existing in
                guard existing.id == campaign.id else { return existing }
                return EmailCampaign(
                    id: existing.id,
                    subject: existing.subject,
                    status: "cancelled",
                    recipientCount: existing.recipientCount,
                    sentCount: existing.sentCount,
                    failedCount: existing.failedCount,
                    suppressedCount: existing.suppressedCount,
                    createdAt: existing.createdAt,
                    startedAt: existing.startedAt,
                    completedAt: existing.completedAt
                )
            }
        } catch {
            loadError = describePlatformError(error, language: language)
        }
    }

    /// `view=sms-campaigns:cancel`, POST, `{ id }`. Port of `cancelSmsCampaign`.
    func cancelSmsCampaign(_ campaign: SmsCampaign) async {
        cancellingCampaignId = campaign.id
        defer { cancellingCampaignId = nil }
        do {
            let cancelled = try await apiClient.cancelSmsCampaign(id: campaign.id)
            guard cancelled else { return }
            smsCampaigns = smsCampaigns?.map { existing in
                guard existing.id == campaign.id else { return existing }
                return SmsCampaign(
                    id: existing.id,
                    message: existing.message,
                    status: "cancelled",
                    recipientCount: existing.recipientCount,
                    sentCount: existing.sentCount,
                    failedCount: existing.failedCount,
                    suppressedCount: existing.suppressedCount,
                    createdAt: existing.createdAt,
                    startedAt: existing.startedAt,
                    completedAt: existing.completedAt
                )
            }
        } catch {
            loadError = describePlatformError(error, language: language)
        }
    }

    // MARK: - Composer lifecycle

    func beginCompose() {
        selectedTemplate = nil
        subject = ""
        messageBody = ""
        messageHTMLBody = ""
        audienceRoles = []
        audienceTrustTiers = []
        requireEmailOptIn = true
        lastActiveDaysText = ""
        scheduleForLater = false
        scheduledDate = Date().addingTimeInterval(3600)
        audiencePreview = nil
        previewError = nil
        sendState = .idle
        sendError = nil
        composerStep = .template
        isComposerPresented = true
    }

    func selectTemplate(_ template: EmailTemplate) {
        selectedTemplate = template
        subject = language == .fr ? template.subjectFr : template.subjectEn
        messageBody = language == .fr ? template.textFr : template.textEn
        messageHTMLBody = language == .fr ? template.htmlFr : template.htmlEn
    }

    func clearSelectedTemplate() {
        selectedTemplate = nil
    }

    func goToStep(_ step: ComposerStep) {
        composerStep = step
    }

    var canAdvanceFromReviewStep: Bool {
        let trimmedBody = messageBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedBody.isEmpty else { return false }
        if channel == .email {
            return !subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        return true
    }

    // MARK: - Audience

    /// The `CommsAudienceFilter` built from the composer's current
    /// selections — shared by `previewAudience()` and `sendCampaign()` so
    /// the count the admin reviewed matches what actually gets sent.
    var currentAudienceFilter: CommsAudienceFilter {
        CommsAudienceFilter(
            roles: audienceRoles.isEmpty ? nil : Array(audienceRoles).sorted(),
            trustTiers: audienceTrustTiers.isEmpty ? nil : Array(audienceTrustTiers).sorted(),
            mapScopes: nil,
            requireEmailOptIn: channel == .email ? requireEmailOptIn : nil,
            lastActiveDays: Int(lastActiveDaysText.trimmingCharacters(in: .whitespaces))
        )
    }

    /// `view=audience-preview`, GET. Port of the `audience-preview` handler
    /// via `resolveAudience`.
    func previewAudience() async {
        isPreviewingAudience = true
        previewError = nil
        defer { isPreviewingAudience = false }
        do {
            audiencePreview = try await apiClient.previewAudience(currentAudienceFilter)
        } catch {
            previewError = describePlatformError(error, language: language)
        }
    }

    private var scheduledAtISO: String? {
        guard scheduleForLater else { return nil }
        return ISO8601DateFormatter().string(from: scheduledDate)
    }

    // MARK: - Send

    /// Creates (and, for an immediate send, fast-path-dispatches) a
    /// campaign on the currently selected `channel`. Port of `createCampaign`
    /// / `createSmsCampaign`'s POST handlers in `api/privacy/index.ts`.
    @discardableResult
    func sendCampaign() async -> Bool {
        guard canAdvanceFromReviewStep else { return false }
        sendState = .sending
        sendError = nil
        do {
            switch channel {
            case .email:
                let trimmedSubject = subject.trimmingCharacters(in: .whitespacesAndNewlines)
                let trimmedBody = messageBody.trimmingCharacters(in: .whitespacesAndNewlines)
                let created = try await apiClient.createEmailCampaign(
                    subject: trimmedSubject,
                    htmlBody: messageHTMLBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ? trimmedBody
                        : messageHTMLBody,
                    textBody: trimmedBody,
                    language: language.rawValue,
                    recipientMode: "audience",
                    audience: currentAudienceFilter,
                    scheduledAt: scheduledAtISO
                )
                let newCampaign = EmailCampaign(
                    id: created.id,
                    subject: trimmedSubject,
                    status: created.status,
                    recipientCount: created.recipientCount,
                    sentCount: 0,
                    failedCount: 0,
                    suppressedCount: created.suppressedCount,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                )
                emailCampaigns = [newCampaign] + (emailCampaigns ?? [])
            case .sms:
                let trimmedBody = messageBody.trimmingCharacters(in: .whitespacesAndNewlines)
                let created = try await apiClient.createSmsCampaign(
                    message: trimmedBody,
                    language: language.rawValue,
                    audience: currentAudienceFilter,
                    scheduledAt: scheduledAtISO,
                    acknowledgeCost: true
                )
                let newCampaign = SmsCampaign(
                    id: created.id,
                    message: trimmedBody,
                    status: created.status,
                    recipientCount: created.recipientCount,
                    sentCount: 0,
                    failedCount: 0,
                    suppressedCount: 0,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                )
                smsCampaigns = [newCampaign] + (smsCampaigns ?? [])
            }
            sendState = .success
            isComposerPresented = false
            return true
        } catch {
            let message = describePlatformError(error, language: language)
            sendError = message
            sendState = .failure(message)
            return false
        }
    }
}
