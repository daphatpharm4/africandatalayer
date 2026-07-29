import ConsoleModels
import SwiftUI

/// The COMMUNICATIONS destination (ADL-admin only — see
/// `CommunicationsViewModel`'s doc comment on the auth domain): email/SMS
/// campaign lists with a channel tab picker, and a "+" FAB that opens
/// `CampaignComposerView`'s template → audience → schedule → review flow.
/// Not wired into navigation yet (Task 9); this view is self-contained and
/// can be pushed/presented once that lands.
struct CommunicationsView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: CommunicationsViewModel

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> CommunicationsViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        content
            .background(ADLConsoleColor.page)
            .task { await viewModel.load() }
            .sheet(isPresented: $viewModel.isComposerPresented) {
                CampaignComposerView(viewModel: viewModel)
                    .task { await viewModel.loadTemplates() }
            }
    }

    // MARK: - Content

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ADLConsoleSectionHeader(
                    title: t("Communications", "Communications"),
                    subtitle: t(
                        "Send email and SMS campaigns to agents, admins, and clients.",
                        "Envoyez des campagnes email et SMS aux agents, admins et clients."
                    )
                )

                channelPicker

                if let loadError = viewModel.loadError {
                    ADLConsoleErrorState(
                        message: loadError,
                        retryTitle: t("Try again", "Réessayer")
                    ) {
                        Task { await viewModel.load(force: true) }
                    }
                } else {
                    campaignList
                }
            }
            .padding(20)
            .padding(.bottom, 80)
        }
        .refreshable { await viewModel.load(force: true) }
        .overlay(alignment: .bottomTrailing) {
            composeFAB
        }
    }

    private var channelPicker: some View {
        Picker(t("Channel", "Canal"), selection: $viewModel.channel) {
            Text(t("Email", "Email")).tag(CommunicationsViewModel.Channel.email)
            Text(t("SMS", "SMS")).tag(CommunicationsViewModel.Channel.sms)
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private var campaignList: some View {
        switch viewModel.channel {
        case .email:
            emailCampaignList
        case .sms:
            smsCampaignList
        }
    }

    private var emailCampaignList: some View {
        VStack(spacing: 12) {
            if let campaigns = viewModel.emailCampaigns {
                if campaigns.isEmpty {
                    ADLConsoleEmptyState(
                        systemImage: "envelope",
                        headline: t("No email campaigns yet", "Aucune campagne email"),
                        description: t(
                            "Tap + to send your first email campaign.",
                            "Appuyez sur + pour envoyer votre première campagne email."
                        )
                    )
                } else {
                    ForEach(campaigns) { campaign in
                        emailCampaignRow(campaign)
                    }
                }
            } else {
                ADLConsoleSkeleton()
            }
        }
    }

    private var smsCampaignList: some View {
        VStack(spacing: 12) {
            if let campaigns = viewModel.smsCampaigns {
                if campaigns.isEmpty {
                    ADLConsoleEmptyState(
                        systemImage: "message",
                        headline: t("No SMS campaigns yet", "Aucune campagne SMS"),
                        description: t(
                            "Tap + to send your first SMS campaign.",
                            "Appuyez sur + pour envoyer votre première campagne SMS."
                        )
                    )
                } else {
                    ForEach(campaigns) { campaign in
                        smsCampaignRow(campaign)
                    }
                }
            } else {
                ADLConsoleSkeleton()
            }
        }
    }

    // MARK: - Rows

    private func emailCampaignRow(_ campaign: EmailCampaign) -> some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(campaign.subject)
                            .font(ADLConsoleFont.headline)
                            .foregroundStyle(ADLConsoleColor.ink)
                            .lineLimit(2)
                        Text(ADLConsoleDateFormatting.mediumDateTime(campaign.createdAt))
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                            .monospacedDigit()
                    }
                    Spacer()
                    statusPill(for: campaign.status)
                }

                HStack(spacing: 14) {
                    metric(t("Recipients", "Destinataires"), "\(campaign.recipientCount)")
                    metric(t("Sent", "Envoyés"), "\(campaign.sentCount)")
                    if campaign.failedCount > 0 {
                        metric(t("Failed", "Échoués"), "\(campaign.failedCount)", color: ADLConsoleColor.danger)
                    }
                    Spacer()
                    if isCancellable(campaign.status) {
                        cancelButton(isBusy: viewModel.cancellingCampaignId == campaign.id) {
                            Task { await viewModel.cancelEmailCampaign(campaign) }
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func smsCampaignRow(_ campaign: SmsCampaign) -> some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(campaign.message)
                            .font(ADLConsoleFont.headline)
                            .foregroundStyle(ADLConsoleColor.ink)
                            .lineLimit(2)
                        Text(ADLConsoleDateFormatting.mediumDateTime(campaign.createdAt))
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                            .monospacedDigit()
                    }
                    Spacer()
                    statusPill(for: campaign.status)
                }

                HStack(spacing: 14) {
                    metric(t("Recipients", "Destinataires"), "\(campaign.recipientCount)")
                    metric(t("Sent", "Envoyés"), "\(campaign.sentCount)")
                    if campaign.failedCount > 0 {
                        metric(t("Failed", "Échoués"), "\(campaign.failedCount)", color: ADLConsoleColor.danger)
                    }
                    Spacer()
                    if isCancellable(campaign.status) {
                        cancelButton(isBusy: viewModel.cancellingCampaignId == campaign.id) {
                            Task { await viewModel.cancelSmsCampaign(campaign) }
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func metric(_ label: String, _ value: String, color: Color = ADLConsoleColor.ink) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(ADLConsoleFont.microLabel)
                .foregroundStyle(ADLConsoleColor.inkMuted)
            Text(value)
                .font(ADLConsoleFont.subheadline)
                .foregroundStyle(color)
                .monospacedDigit()
        }
    }

    private func cancelButton(isBusy: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            if isBusy {
                ProgressView().controlSize(.small)
            } else {
                Text(t("Cancel", "Annuler"))
                    .font(ADLConsoleFont.subheadline)
            }
        }
        .foregroundStyle(ADLConsoleColor.danger)
        .disabled(isBusy)
    }

    private func isCancellable(_ status: String) -> Bool {
        ["draft", "scheduled", "sending"].contains(status)
    }

    private func statusPill(for status: String) -> some View {
        let (fg, bg): (Color, Color) = {
            switch status {
            case "completed": return (ADLConsoleColor.forestDark, ADLConsoleColor.forestWash)
            case "sending": return (ADLConsoleColor.navy, ADLConsoleColor.navyWash)
            case "scheduled": return (ADLConsoleColor.goldDark, ADLConsoleColor.goldWash)
            case "cancelled": return (ADLConsoleColor.inkMuted, ADLConsoleColor.navyWash)
            case "failed": return (ADLConsoleColor.danger, ADLConsoleColor.dangerWash)
            default: return (ADLConsoleColor.inkMuted, ADLConsoleColor.navyWash)
            }
        }()
        return ADLConsolePill(text: statusLabel(status), foreground: fg, background: bg)
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "draft": return t("Draft", "Brouillon")
        case "scheduled": return t("Scheduled", "Planifiée")
        case "sending": return t("Sending", "Envoi en cours")
        case "completed": return t("Completed", "Terminée")
        case "cancelled": return t("Cancelled", "Annulée")
        case "failed": return t("Failed", "Échouée")
        default: return status
        }
    }

    // MARK: - FAB

    private var composeFAB: some View {
        Button {
            viewModel.beginCompose()
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(ADLConsoleColor.terra)
                .clipShape(Circle())
                .shadow(color: ADLConsoleColor.terra.opacity(0.35), radius: 10, x: 0, y: 6)
        }
        .padding(20)
        .accessibilityLabel(t("New campaign", "Nouvelle campagne"))
    }
}
