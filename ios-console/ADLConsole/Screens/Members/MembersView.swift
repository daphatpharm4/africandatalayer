import ConsoleModels
import SwiftUI

/// The MEMBERS destination (manager/owner-gated in `ConsoleShellView`):
/// member list with owner-only role change/remove, pending invites, and an
/// invite form for manager+. Mirrors `components/Console/MembersScreen.tsx`.
/// All load/guard/mutation logic lives in `MembersViewModel` — this view
/// only renders `@Published` state and confirms destructive actions
/// (the web's `window.confirm`, ported to a SwiftUI `.confirmationDialog`).
struct MembersView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: MembersViewModel

    @State private var memberPendingRemoval: PlatformMembership?
    @State private var invitePendingRevoke: PlatformInvite?

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> MembersViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        content
            .background(ADLConsoleColor.page)
            .task { await viewModel.load() }
            .confirmationDialog(
                t("Remove this member from the organization?", "Retirer ce membre de l'organisation ?"),
                isPresented: Binding(get: { memberPendingRemoval != nil }, set: { if !$0 { memberPendingRemoval = nil } }),
                titleVisibility: .visible
            ) {
                Button(t("Remove", "Retirer"), role: .destructive) {
                    if let member = memberPendingRemoval {
                        Task { await viewModel.remove(userId: member.userId) }
                    }
                    memberPendingRemoval = nil
                }
                Button(t("Cancel", "Annuler"), role: .cancel) { memberPendingRemoval = nil }
            }
            .confirmationDialog(
                revokeConfirmationTitle,
                isPresented: Binding(get: { invitePendingRevoke != nil }, set: { if !$0 { invitePendingRevoke = nil } }),
                titleVisibility: .visible
            ) {
                Button(t("Revoke", "Révoquer"), role: .destructive) {
                    if let invite = invitePendingRevoke {
                        Task { await viewModel.revokeInvite(invite) }
                    }
                    invitePendingRevoke = nil
                }
                Button(t("Cancel", "Annuler"), role: .cancel) { invitePendingRevoke = nil }
            }
    }

    private var revokeConfirmationTitle: String {
        guard let invite = invitePendingRevoke else { return "" }
        return t("Revoke the invitation for \(invite.email)?", "Révoquer l'invitation de \(invite.email) ?")
    }

    // MARK: - Content states

    @ViewBuilder
    private var content: some View {
        if viewModel.members == nil && viewModel.loadError == nil {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let loadError = viewModel.loadError {
            errorState(loadError)
        } else {
            memberAndInviteList
        }
    }

    private func errorState(_ message: String) -> some View {
        ADLConsoleErrorState(
            message: message,
            retryTitle: t("Try again", "Réessayer")
        ) {
            Task { await viewModel.load(force: true) }
        }
    }

    private var memberAndInviteList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ADLConsoleSectionHeader(
                    title: t("Members", "Membres"),
                    subtitle: t(
                        "Manage who has access to this organization and what each person can do.",
                        "Gérez qui a accès à cette organisation et ce que chacun peut faire."
                    )
                )

                VStack(spacing: 12) {
                    ForEach(viewModel.members ?? [], id: \.userId) { member in
                        memberRow(member)
                    }
                    if (viewModel.members ?? []).isEmpty {
                        Text(t("No members yet.", "Aucun membre pour le moment."))
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                    }
                    if let rowError = viewModel.rowError {
                        Text(rowError)
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.danger)
                    }
                }

                if let invites = viewModel.invites {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(t("Pending invites", "Invitations en attente"))
                            .font(ADLConsoleFont.headline)
                            .foregroundStyle(ADLConsoleColor.ink)
                        if invites.isEmpty {
                            Text(t("No pending invites.", "Aucune invitation en attente."))
                                .font(ADLConsoleFont.footnote)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                        }
                        ForEach(invites, id: \.id) { invite in
                            inviteRow(invite)
                        }
                    }
                }

                if viewModel.canInvite {
                    inviteForm
                }
            }
            .padding(20)
        }
        .refreshable { await viewModel.load(force: true) }
    }

    // MARK: - Member row

    private func memberRow(_ member: PlatformMembership) -> some View {
        ADLConsoleCard {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(member.userId)
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                        .lineLimit(1)
                    Text("\(t("Member since", "Membre depuis")) \(ADLConsoleDateFormatting.mediumDate(member.createdAt))")
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .monospacedDigit()
                }
                Spacer()

                if viewModel.isOwner {
                    Menu {
                        ForEach(viewModel.roleOptions(for: member), id: \.self) { role in
                            Button {
                                Task { await viewModel.changeRole(userId: member.userId, role: role) }
                            } label: {
                                Text(roleLabel(role))
                            }
                            .disabled(viewModel.isRoleOptionDisabled(role))
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(roleLabel(member.role))
                            Image(systemName: "chevron.down")
                                .accessibilityHidden(true)
                        }
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.navy)
                    }
                    .disabled(!viewModel.canEditRole(for: member) || viewModel.rowBusyUserId == member.userId)
                } else {
                    Text(roleLabel(member.role).uppercased())
                        .font(ADLConsoleFont.microLabel)
                        .foregroundStyle(ADLConsoleColor.navy)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(ADLConsoleColor.navyWash)
                        .clipShape(Capsule())
                }

                if viewModel.isOwner {
                    Button {
                        memberPendingRemoval = member
                    } label: {
                        Image(systemName: "trash")
                            .frame(width: 44, height: 44)
                    }
                    .disabled(!viewModel.canRemove(member) || viewModel.rowBusyUserId == member.userId)
                    .accessibilityLabel(t("Remove member", "Retirer le membre"))
                }
            }
            .padding(16)
        }
    }

    // MARK: - Invite row

    private func inviteRow(_ invite: PlatformInvite) -> some View {
        let accepted = invite.acceptedAt != nil
        return ADLConsoleCard {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(invite.email)
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                        .lineLimit(1)
                    Text(inviteSubtitle(invite, accepted: accepted))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .monospacedDigit()
                }
                Spacer()
                Text((accepted ? t("Accepted", "Acceptée") : t("Pending", "En attente")).uppercased())
                    .font(ADLConsoleFont.microLabel)
                    .foregroundStyle(accepted ? ADLConsoleColor.forestDark : ADLConsoleColor.navy)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(accepted ? ADLConsoleColor.forestWash : ADLConsoleColor.navyWash)
                    .clipShape(Capsule())

                if viewModel.canRevokeInvite(invite) {
                    Button {
                        invitePendingRevoke = invite
                    } label: {
                        Image(systemName: "trash")
                            .frame(width: 44, height: 44)
                    }
                    .disabled(viewModel.revokingInviteId == invite.id)
                    .accessibilityLabel(t("Revoke invitation", "Révoquer l'invitation"))
                }
            }
            .padding(16)
        }
    }

    private func inviteSubtitle(_ invite: PlatformInvite, accepted: Bool) -> String {
        let rolePart = roleLabel(invite.role)
        if accepted, let acceptedAt = invite.acceptedAt {
            return "\(rolePart) · \(t("Accepted", "Acceptée")) \(ADLConsoleDateFormatting.mediumDate(acceptedAt))"
        }
        return "\(rolePart) · \(t("Expires", "Expire le")) \(ADLConsoleDateFormatting.mediumDate(invite.expiresAt))"
    }

    // MARK: - Invite form

    private var inviteForm: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    Image(systemName: "person.badge.plus")
                    Text(t("Invite someone", "Inviter quelqu'un"))
                        .font(ADLConsoleFont.headline)
                }
                .foregroundStyle(ADLConsoleColor.ink)

                VStack(alignment: .leading, spacing: 6) {
                    ADLConsoleMicroLabel(text: t("Email", "Email"))
                    ADLConsoleInputField(
                        placeholder: "teammate@example.com",
                        text: $viewModel.inviteEmail,
                        disabled: viewModel.isInviting,
                        contentType: .emailAddress,
                        autocapitalization: .never,
                        autocorrectionDisabled: true
                    )
                }

                VStack(alignment: .leading, spacing: 6) {
                    ADLConsoleMicroLabel(text: t("Role", "Rôle"))
                    Picker(t("Role", "Rôle"), selection: $viewModel.inviteRole) {
                        ForEach(MembersViewModel.inviteRoles, id: \.self) { role in
                            Text(roleLabel(role)).tag(role)
                        }
                    }
                    .pickerStyle(.segmented)
                    .disabled(viewModel.isInviting)
                }

                if let inviteError = viewModel.inviteError {
                    Text(inviteError)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                }

                ADLConsolePrimaryButton(
                    title: t("Send invite", "Envoyer l'invitation"),
                    isBusy: viewModel.isInviting,
                    isDisabled: viewModel.isInviting || viewModel.inviteEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                    pressAnimationEnabled: false
                ) {
                    Task { await viewModel.invite() }
                }
            }
            .padding(16)
        }
    }

    // MARK: - Role copy

    private func roleLabel(_ role: PlatformRole) -> String {
        role.label(t)
    }
}
