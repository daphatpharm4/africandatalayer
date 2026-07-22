import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `SettingsView` — owner-only workspace name/logo/accent-color
/// editing. Source of truth for behavior: `components/Console/SettingsScreen.tsx`
/// (web, read-only reference) + `lib/client/platformApi.ts`.
///
/// Deliberately out of scope: `DeleteAccountPanel` (account deletion) —
/// there is no corresponding `PlatformAPIClient` method and it isn't part of
/// this task's stated API surface (`updateOrganization`/`getOrganization`).
@MainActor
final class SettingsViewModel: ObservableObject {
    /// Port of `DEFAULT_ACCENT`. `nonisolated` so `SettingsView`'s
    /// nonisolated hex-color helpers (which run outside the main actor, e.g.
    /// as free functions) can read it without hopping actors.
    nonisolated static let defaultAccent = "#c86b4a"
    /// Port of `MAX_LOGO_FILE_BYTES` — the raw file-size cap, checked before
    /// any base64 encoding happens.
    static let maxLogoFileBytes = 1_000_000
    /// Port of `MAX_LOGO_DATA_URL_LENGTH` — the server-side cap
    /// (`lib/server/platform/validation.ts`) on the base64 `data:` URL
    /// string itself, checked separately since a 1MB file base64-encodes to
    /// ~1.37MB of characters.
    static let maxLogoDataURLLength = 800_000

    @Published private(set) var organization: PlatformOrganization

    @Published var name: String
    @Published private(set) var nameBusy: Bool = false
    @Published private(set) var nameError: String?

    @Published private(set) var logoBusy: Bool = false
    @Published private(set) var logoError: String?

    @Published var colorHex: String
    @Published private(set) var colorBusy: Bool = false
    @Published private(set) var colorError: String?

    let language: ConsoleLanguage
    let role: PlatformRole

    private let apiClient: PlatformAPIClient
    private let organizationId: String
    private let mutationAllowed: @MainActor () -> Bool

    init(
        apiClient: PlatformAPIClient,
        organizationId: String,
        organization: PlatformOrganization,
        role: PlatformRole,
        language: ConsoleLanguage,
        mutationAllowed: @escaping @MainActor () -> Bool = { true }
    ) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.organization = organization
        self.role = role
        self.language = language
        self.mutationAllowed = mutationAllowed
        self.name = organization.name
        self.colorHex = organization.accentColor ?? Self.defaultAccent
    }

    // MARK: - Derived state

    var isOwner: Bool { role == .owner }
    var canMutate: Bool { mutationAllowed() }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Port of `isNameDirty`.
    var isNameDirty: Bool { !trimmedName.isEmpty && trimmedName != organization.name }

    /// Port of `isColorValid` (`/^#[0-9a-fA-F]{6}$/`).
    var isColorValid: Bool { Self.isValidHexColor(colorHex.trimmingCharacters(in: .whitespacesAndNewlines)) }

    /// Port of `isColorDirty`.
    var isColorDirty: Bool {
        guard isColorValid else { return false }
        let trimmed = colorHex.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return trimmed != (organization.accentColor ?? Self.defaultAccent).lowercased()
    }

    /// `nonisolated` — a pure string check, and `SettingsView`'s
    /// `colorFromHex` helper calls it from outside the main actor.
    nonisolated static func isValidHexColor(_ value: String) -> Bool {
        value.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) != nil
    }

    // MARK: - Load

    /// `view=platform_org_get`, GET, `organizationId`. Optional refresh hook
    /// — the view can also be seeded directly from an already-loaded
    /// membership (as `ConsoleApp.tsx` does), matching `SettingsScreenProps.organization`.
    func reload() async {
        do {
            let updated = try await apiClient.getOrganization(organizationId: organizationId)
            applyUpdated(updated)
        } catch {
            nameError = describePlatformError(error, language: language)
        }
    }

    // MARK: - Save name

    /// `view=platform_org_update`, POST, `{ organizationId, name }`. Port of
    /// `handleSaveName`.
    func saveName() async {
        guard canMutate, isOwner, isNameDirty else { return }
        nameError = nil
        nameBusy = true
        defer { nameBusy = false }
        do {
            let updated = try await apiClient.updateOrganization(organizationId: organizationId, name: trimmedName)
            applyUpdated(updated)
            name = updated.name
        } catch {
            nameError = describePlatformError(error, language: language)
        }
    }

    // MARK: - Logo

    /// `view=platform_org_update`, POST, `{ organizationId, logoDataUrl }`.
    /// Port of `handleFileChange`: `rawByteCount` is checked against
    /// `maxLogoFileBytes` *before* `logoBusy` is set (mirrors the web's early
    /// return before any state change other than the error), then — inside
    /// the busy window, matching the web's `readFileAsDataUrl` happening
    /// there — `dataURL` (the caller-supplied `data:` URL string, already
    /// base64-encoded) is checked against `maxLogoDataURLLength`.
    func uploadLogo(rawByteCount: Int, dataURL: String) async {
        guard canMutate, isOwner else { return }
        guard rawByteCount <= Self.maxLogoFileBytes else {
            logoError = logoSizeErrorMessage()
            return
        }
        logoError = nil
        logoBusy = true
        defer { logoBusy = false }
        guard dataURL.count <= Self.maxLogoDataURLLength else {
            logoError = logoSizeErrorMessage()
            return
        }
        do {
            let updated = try await apiClient.updateOrganization(organizationId: organizationId, logoDataUrl: dataURL)
            applyUpdated(updated)
        } catch {
            logoError = describePlatformError(error, language: language)
        }
    }

    /// `view=platform_org_update`, POST, `{ organizationId, clearLogo: true
    /// }`. Port of `handleRemoveLogo`.
    func removeLogo() async {
        guard canMutate, isOwner, organization.logoUrl != nil else { return }
        logoError = nil
        logoBusy = true
        defer { logoBusy = false }
        do {
            let updated = try await apiClient.updateOrganization(organizationId: organizationId, clearLogo: true)
            applyUpdated(updated)
        } catch {
            logoError = describePlatformError(error, language: language)
        }
    }

    private func logoSizeErrorMessage() -> String {
        language.t("Logo must be smaller than 1 MB.", "Le logo doit faire moins de 1 Mo.")
    }

    // MARK: - Accent color

    /// `view=platform_org_update`, POST, `{ organizationId, accentColor }`.
    /// Port of `handleSaveColor`.
    func saveColor() async {
        guard canMutate, isOwner else { return }
        let trimmed = colorHex.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.isValidHexColor(trimmed) else {
            colorError = language.t(
                "Enter a valid hex color, e.g. #c86b4a.",
                "Entrez une couleur hexadécimale valide, p. ex. #c86b4a."
            )
            return
        }
        colorError = nil
        colorBusy = true
        defer { colorBusy = false }
        do {
            let updated = try await apiClient.updateOrganization(organizationId: organizationId, accentColor: trimmed)
            applyUpdated(updated)
            colorHex = updated.accentColor ?? trimmed
        } catch {
            colorError = describePlatformError(error, language: language)
        }
    }

    /// Port of `handleOrganizationUpdated`'s merge-into-state — the local
    /// `organization` this view model reflects is always replaced with the
    /// server's response after a successful save, same as `ConsoleApp.tsx`
    /// merging the returned `PlatformOrganization` into its org list.
    private func applyUpdated(_ updated: PlatformOrganization) {
        organization = updated
    }
}
