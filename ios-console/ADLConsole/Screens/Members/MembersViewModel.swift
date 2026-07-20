import ConsoleAPI
import ConsoleModels
import Foundation

/// Drives `MembersView` — the org's member list, pending invites, and
/// (owner-only) role-change/remove/invite/revoke actions. Source of truth
/// for behavior: `components/Console/MembersScreen.tsx` (web, read-only
/// reference) + `lib/client/platformApi.ts` + `shared/platformSchema.ts`
/// (`roleAtLeast`, ported as `PlatformRoleRank.atLeast`).
///
/// Guard rules ported from the web screen:
///
///  1. **Role-change/remove controls are owner-only.** `MembersScreen.tsx`
///     only renders the role `<select>` and remove button when `isOwner`
///     (`viewerRole === 'owner'`) — a non-owner manager sees a static role
///     badge and no remove button at all. `canEditRole`/`canRemove` below
///     gate the same way; `changeRole`/`remove` also guard defensively so a
///     stray call from a misbehaving view can never reach the network.
///  2. **Self-removal guard.** `handleRemove` has an explicit code-level
///     early return: `if (viewerUserId !== null && userId === viewerUserId)
///     return;` — ported verbatim as `isSelf(userId)` in `remove`.
///  3. **Self role-change: UI-disable-only on the web**, not a function-level
///     guard (`handleRoleChange` has no self check; only the `<select
///     disabled={isSelf || isRowBusy}>` prevents the interaction). This VM
///     still exposes `isSelf` as part of `canEditRole` so a thin SwiftUI view
///     disables the same way, and additionally guards `changeRole` itself —
///     a defensive strengthening of the same disablement, not a new rule.
///  4. **Last-owner protection.** The *server* is the actual source of truth
///     (`lib/server/platform/api.ts` returns 409 `{ code: "last_owner" }` for
///     both `member_update` demoting the last owner and `member_remove`
///     removing them), and the web screen only reacts to that 409
///     (`describeError(error, t, { lastOwnerHint: true })`). Since this VM
///     already holds the full member list client-side, it additionally
///     pre-empts the doomed call entirely — `isLastOwner(member)` (the only
///     `.owner` in `members`) blocks `changeRole` (to a non-owner role) and
///     `remove` with **no API call**, showing the identical copy the 409
///     path would. The 409 catch path is kept as a defense-in-depth fallback
///     for a stale client list (e.g. another manager just removed the other
///     owner in a race).
///  5. **Role option list for the owner's `<select>`:** `[...(viewerIsAdlAdmin
///     || member.role === 'owner' ? ['owner'] : []), ...MEMBER_ROLES]`, with
///     the `owner` option `disabled={role === 'owner' && !viewerIsAdlAdmin}`
///     — ported as `roleOptions(for:)` + `isRoleOptionDisabled(_:)`.
///  6. **Invite / revoke-invite visibility:** `roleAtLeast(viewerRole,
///     'manager')` — ported as `canInvite` / `canRevokeInvite(_:)`.
@MainActor
final class MembersViewModel: ObservableObject {
    /// Port of `MEMBER_ROLES` / `INVITE_ROLES` in `MembersScreen.tsx`
    /// (`Exclude<PlatformRole, 'owner'>`, identical arrays in the source).
    static let memberRoles: [PlatformRole] = [.manager, .reviewer, .collector, .viewer]
    static let inviteRoles: [PlatformRole] = [.manager, .reviewer, .collector, .viewer]

    @Published private(set) var members: [PlatformMembership]?
    @Published private(set) var invites: [PlatformInvite]?
    @Published private(set) var loadError: String?

    @Published private(set) var rowBusyUserId: String?
    @Published private(set) var rowError: String?

    @Published var inviteEmail: String = ""
    @Published var inviteRole: PlatformRole = .collector
    @Published private(set) var isInviting: Bool = false
    @Published private(set) var inviteError: String?
    @Published private(set) var revokingInviteId: String?

    let language: ConsoleLanguage
    let viewerRole: PlatformRole
    let viewerUserId: String?
    let viewerIsAdlAdmin: Bool

    private let apiClient: PlatformAPIClient
    private let organizationId: String

    init(
        apiClient: PlatformAPIClient,
        organizationId: String,
        viewerRole: PlatformRole,
        viewerUserId: String? = nil,
        viewerIsAdlAdmin: Bool = false,
        language: ConsoleLanguage
    ) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.viewerRole = viewerRole
        self.viewerUserId = viewerUserId
        self.viewerIsAdlAdmin = viewerIsAdlAdmin
        self.language = language
    }

    // MARK: - Derived state

    var isOwner: Bool { viewerRole == .owner }

    /// Port of `roleAtLeast(viewerRole, "manager")` gating the "Invite
    /// someone" card.
    var canInvite: Bool { PlatformRoleRank.atLeast(viewerRole, .manager) }

    func isSelf(_ userId: String) -> Bool { viewerUserId != nil && userId == viewerUserId }

    /// Port of the `<select>`'s visibility+disable rule: shown only when
    /// `isOwner`, disabled when the row is the viewer themselves.
    func canEditRole(for member: PlatformMembership) -> Bool { isOwner && !isSelf(member.userId) }

    /// Port of the remove button's visibility+disable rule: shown only when
    /// `isOwner`, disabled when the row is the viewer themselves.
    func canRemove(_ member: PlatformMembership) -> Bool { isOwner && !isSelf(member.userId) }

    /// Port of the role `<option>` list assembly (see rule 5 above).
    func roleOptions(for member: PlatformMembership) -> [PlatformRole] {
        var options: [PlatformRole] = []
        if viewerIsAdlAdmin || member.role == .owner {
            options.append(.owner)
        }
        options.append(contentsOf: Self.memberRoles)
        return options
    }

    /// Port of `disabled={role === 'owner' && !viewerIsAdlAdmin}` on the
    /// `owner` `<option>`.
    func isRoleOptionDisabled(_ role: PlatformRole) -> Bool {
        role == .owner && !viewerIsAdlAdmin
    }

    /// Port of `!accepted && roleAtLeast(viewerRole, 'manager')` gating the
    /// revoke button on a pending invite row.
    func canRevokeInvite(_ invite: PlatformInvite) -> Bool {
        invite.acceptedAt == nil && PlatformRoleRank.atLeast(viewerRole, .manager)
    }

    private var ownerCount: Int { members?.filter { $0.role == .owner }.count ?? 0 }

    /// True when `member` is the organization's only remaining owner — see
    /// guard rule 4 above.
    func isLastOwner(_ member: PlatformMembership) -> Bool {
        member.role == .owner && ownerCount <= 1
    }

    // MARK: - Load

    /// `view=platform_org_members`, GET, `organizationId`. Port of
    /// `listOrgMembersRequest`/`PlatformAPIClient.listOrgMembers`.
    func load() async {
        members = nil
        invites = nil
        loadError = nil
        do {
            let result = try await apiClient.listOrgMembers(organizationId: organizationId)
            members = result.members
            invites = result.invites
        } catch {
            loadError = describePlatformError(error, language: language)
        }
    }

    // MARK: - Role change

    /// `view=platform_member_update`, POST, `{ organizationId, userId, role
    /// }`. Port of `handleRoleChange`, plus the pre-emptive last-owner guard
    /// (rule 4) and a defensive owner/self guard (rules 1, 3) not present as
    /// function-level checks on the web but consistent with its UI gating.
    func changeRole(userId: String, role: PlatformRole) async {
        guard isOwner, !isSelf(userId) else { return }
        guard let member = members?.first(where: { $0.userId == userId }) else { return }
        if role != .owner && isLastOwner(member) {
            rowError = lastOwnerMessage(language: language)
            return
        }
        rowError = nil
        rowBusyUserId = userId
        defer { rowBusyUserId = nil }
        do {
            try await apiClient.updateMember(organizationId: organizationId, userId: userId, role: role)
            members = members?.map { existing in
                guard existing.userId == userId else { return existing }
                return PlatformMembership(
                    organizationId: existing.organizationId,
                    userId: existing.userId,
                    role: role,
                    createdAt: existing.createdAt
                )
            }
        } catch {
            rowError = describePlatformError(error, language: language, lastOwnerHint: true)
        }
    }

    // MARK: - Remove

    /// `view=platform_member_remove`, POST, `{ organizationId, userId }`.
    /// Port of `handleRemove`'s network call + local-state update (the
    /// `window.confirm` prompt is a view-layer concern, not ported here),
    /// plus the pre-emptive last-owner guard (rule 4).
    func remove(userId: String) async {
        guard isOwner, !isSelf(userId) else { return }
        guard let member = members?.first(where: { $0.userId == userId }) else { return }
        if isLastOwner(member) {
            rowError = lastOwnerMessage(language: language)
            return
        }
        rowError = nil
        rowBusyUserId = userId
        defer { rowBusyUserId = nil }
        do {
            try await apiClient.removeMember(organizationId: organizationId, userId: userId)
            members = members?.filter { $0.userId != userId }
        } catch {
            rowError = describePlatformError(error, language: language, lastOwnerHint: true)
        }
    }

    // MARK: - Invite

    /// `view=platform_invite_create`, POST, `{ organizationId, email, role
    /// }`. Port of `handleInvite`.
    @discardableResult
    func invite() async -> Bool {
        let email = inviteEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !email.isEmpty else { return false }
        inviteError = nil
        isInviting = true
        defer { isInviting = false }
        do {
            let invite = try await apiClient.createInvite(organizationId: organizationId, email: email, role: inviteRole.rawValue)
            invites = [invite] + (invites ?? [])
            inviteEmail = ""
            return true
        } catch {
            inviteError = describePlatformError(error, language: language)
            return false
        }
    }

    // MARK: - Revoke invite

    /// `view=platform_invite_revoke`, POST, `{ organizationId, inviteId }`.
    /// Port of `handleRevokeInvite`'s network call + local-state update (the
    /// `window.confirm` prompt is a view-layer concern, not ported here).
    func revokeInvite(_ invite: PlatformInvite) async {
        inviteError = nil
        revokingInviteId = invite.id
        defer { revokingInviteId = nil }
        do {
            try await apiClient.revokeInvite(organizationId: organizationId, inviteId: invite.id)
            invites = invites?.filter { $0.id != invite.id }
        } catch {
            inviteError = describePlatformError(error, language: language)
        }
    }
}
