import ConsoleModels
import SwiftUI

/// The create-campaign flow presented as a sheet from `CommunicationsView`'s
/// "+" FAB: template picker (email only) → audience picker with a live
/// preview count → schedule → review/send. All state lives on
/// `CommunicationsViewModel`; this view only renders the current
/// `composerStep` and calls back into the view model's async actions.
struct CampaignComposerView: View {
    @EnvironmentObject private var appState: AppState
    @ObservedObject var viewModel: CommunicationsViewModel
    @Environment(\.dismiss) private var dismiss

    private var t: (String, String) -> String { appState.language.t }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                stepIndicator
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        stepContent
                    }
                    .padding(20)
                }
                footerButtons
            }
            .background(ADLConsoleColor.page)
            .navigationTitle(t("New campaign", "Nouvelle campagne"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("Close", "Fermer")) { dismiss() }
                }
            }
        }
    }

    // MARK: - Step indicator

    private var stepIndicator: some View {
        HStack(spacing: 6) {
            ForEach(CommunicationsViewModel.ComposerStep.allCases, id: \.self) { step in
                Capsule()
                    .fill(step.rawValue <= viewModel.composerStep.rawValue ? ADLConsoleColor.navy : ADLConsoleColor.navyBorder)
                    .frame(height: 4)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.composerStep {
        case .template:
            channelSection
            templateStep
        case .audience:
            audienceStep
        case .schedule:
            scheduleStep
        case .review:
            reviewStep
        }
    }

    // MARK: - Channel (shown alongside the template step)

    private var channelSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            ADLConsoleMicroLabel(text: t("Channel", "Canal"))
            Picker(t("Channel", "Canal"), selection: $viewModel.channel) {
                Text(t("Email", "Email")).tag(CommunicationsViewModel.Channel.email)
                Text(t("SMS", "SMS")).tag(CommunicationsViewModel.Channel.sms)
            }
            .pickerStyle(.segmented)
        }
    }

    // MARK: - Step 1: template + message

    private var templateStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            if viewModel.channel == .email {
                ADLConsoleSectionHeader(
                    title: t("Choose a template", "Choisir un modèle"),
                    subtitle: t(
                        "Optional — pick a saved template to prefill the subject and body, or start blank.",
                        "Facultatif — choisissez un modèle enregistré pour préremplir le sujet et le corps, ou partez de zéro."
                    )
                )
                templatePicker
            }

            if viewModel.channel == .email {
                VStack(alignment: .leading, spacing: 6) {
                    ADLConsoleMicroLabel(text: t("Subject", "Sujet"))
                    ADLConsoleInputField(placeholder: t("Campaign subject", "Sujet de la campagne"), text: $viewModel.subject)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                ADLConsoleMicroLabel(text: viewModel.channel == .email ? t("Body", "Corps") : t("Message", "Message"))
                TextEditor(text: $viewModel.messageBody)
                    .frame(minHeight: 160)
                    .padding(10)
                    .background(ADLConsoleColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
                    .adlShadowBorder()
                if viewModel.channel == .sms {
                    Text(t("Plain text only — 160 characters per SMS segment.", "Texte brut uniquement — 160 caractères par segment SMS."))
                        .font(ADLConsoleFont.caption)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
        }
    }

    private var templatePicker: some View {
        Group {
            if let error = viewModel.templatesError {
                Text(error)
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.danger)
            } else if let templates = viewModel.templates {
                if templates.isEmpty {
                    Text(t("No saved templates yet.", "Aucun modèle enregistré."))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            templateChip(
                                title: t("Blank", "Vierge"),
                                isSelected: viewModel.selectedTemplate == nil
                            ) {
                                viewModel.clearSelectedTemplate()
                            }
                            ForEach(templates) { template in
                                templateChip(
                                    title: template.name,
                                    isSelected: viewModel.selectedTemplate?.id == template.id
                                ) {
                                    viewModel.selectTemplate(template)
                                }
                            }
                        }
                    }
                }
            } else {
                ProgressView()
            }
        }
    }

    private func templateChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        ADLConsoleChip(title: title, isSelected: isSelected, action: action)
    }

    // MARK: - Step 2: audience

    private var audienceStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            ADLConsoleSectionHeader(
                title: t("Choose your audience", "Choisissez votre audience"),
                subtitle: t(
                    "Leave a filter empty to include everyone for that dimension.",
                    "Laissez un filtre vide pour inclure tout le monde sur cette dimension."
                )
            )

            audienceFilterGroup(
                label: t("Roles", "Rôles"),
                options: CommunicationsViewModel.audienceRoleOptions,
                selection: $viewModel.audienceRoles
            )

            audienceFilterGroup(
                label: t("Trust tiers", "Niveaux de confiance"),
                options: CommunicationsViewModel.audienceTrustTierOptions,
                selection: $viewModel.audienceTrustTiers
            )

            VStack(alignment: .leading, spacing: 6) {
                ADLConsoleMicroLabel(text: t("Active within (days, optional)", "Actif depuis (jours, facultatif)"))
                ADLConsoleInputField(placeholder: t("e.g. 30", "ex. 30"), text: $viewModel.lastActiveDaysText)
                    .keyboardType(.numberPad)
            }

            if viewModel.channel == .email {
                Toggle(t("Require email opt-in", "Exiger le consentement email"), isOn: $viewModel.requireEmailOptIn)
                    .font(ADLConsoleFont.subheadline)
                    .tint(ADLConsoleColor.navy)
            }

            audiencePreviewCard
        }
    }

    private func audienceFilterGroup(label: String, options: [String], selection: Binding<Set<String>>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ADLConsoleMicroLabel(text: label)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(options, id: \.self) { option in
                        ADLConsoleChip(title: option.capitalized, isSelected: selection.wrappedValue.contains(option)) {
                            if selection.wrappedValue.contains(option) {
                                selection.wrappedValue.remove(option)
                            } else {
                                selection.wrappedValue.insert(option)
                            }
                        }
                    }
                }
            }
        }
    }

    private var audiencePreviewCard: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(t("Estimated recipients", "Destinataires estimés"))
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    Spacer()
                    Button {
                        Task { await viewModel.previewAudience() }
                    } label: {
                        if viewModel.isPreviewingAudience {
                            ProgressView().controlSize(.small)
                        } else {
                            Text(t("Preview", "Aperçu"))
                                .font(ADLConsoleFont.subheadline)
                        }
                    }
                    .foregroundStyle(ADLConsoleColor.navy)
                    .disabled(viewModel.isPreviewingAudience)
                }

                if let error = viewModel.previewError {
                    Text(error)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                } else if let preview = viewModel.audiencePreview {
                    HStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(t("Will receive", "Recevront"))
                                .font(ADLConsoleFont.microLabel)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                            Text("\(preview.recipientCount)")
                                .font(ADLConsoleFont.title2)
                                .foregroundStyle(ADLConsoleColor.ink)
                                .monospacedDigit()
                        }
                        if preview.suppressedCount > 0 {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(t("Suppressed", "Supprimés"))
                                    .font(ADLConsoleFont.microLabel)
                                    .foregroundStyle(ADLConsoleColor.inkMuted)
                                Text("\(preview.suppressedCount)")
                                    .font(ADLConsoleFont.title2)
                                    .foregroundStyle(ADLConsoleColor.danger)
                                    .monospacedDigit()
                            }
                        }
                        VStack(alignment: .leading, spacing: 1) {
                            Text(t("Max allowed", "Max autorisé"))
                                .font(ADLConsoleFont.microLabel)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                            Text("\(preview.maxRecipients)")
                                .font(ADLConsoleFont.title2)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                                .monospacedDigit()
                        }
                    }
                } else {
                    Text(t("Tap Preview to estimate how many people will receive this campaign.", "Appuyez sur Aperçu pour estimer le nombre de destinataires."))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
            .padding(16)
        }
    }

    // MARK: - Step 3: schedule

    private var scheduleStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            ADLConsoleSectionHeader(
                title: t("Schedule", "Planification"),
                subtitle: t(
                    "Send immediately, or schedule for a future date and time.",
                    "Envoyer immédiatement, ou planifier pour une date et heure futures."
                )
            )

            Toggle(t("Schedule for later", "Planifier pour plus tard"), isOn: $viewModel.scheduleForLater)
                .font(ADLConsoleFont.subheadline)
                .tint(ADLConsoleColor.navy)

            if viewModel.scheduleForLater {
                DatePicker(
                    t("Send at", "Envoyer le"),
                    selection: $viewModel.scheduledDate,
                    in: Date()...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .datePickerStyle(.graphical)
            } else {
                ADLConsoleStatusBanner(
                    message: t("This campaign will send as soon as you confirm on the review step.", "Cette campagne sera envoyée dès votre confirmation à l'étape de révision."),
                    systemImage: "paperplane"
                )
            }
        }
    }

    // MARK: - Step 4: review

    private var reviewStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            ADLConsoleSectionHeader(
                title: t("Review and send", "Vérifier et envoyer"),
                subtitle: t(
                    "Double-check the details below before sending.",
                    "Vérifiez les détails ci-dessous avant l'envoi."
                )
            )

            ADLConsoleCard {
                VStack(alignment: .leading, spacing: 10) {
                    ADLConsoleMetadataRow(label: t("Channel", "Canal"), value: viewModel.channel == .email ? t("Email", "Email") : t("SMS", "SMS"))
                    if viewModel.channel == .email {
                        ADLConsoleMetadataRow(label: t("Subject", "Sujet"), value: viewModel.subject.isEmpty ? "—" : viewModel.subject)
                    }
                    ADLConsoleMetadataRow(
                        label: t("Recipients", "Destinataires"),
                        value: viewModel.audiencePreview.map { "\($0.recipientCount)" } ?? t("Not previewed", "Aperçu non fait")
                    )
                    ADLConsoleMetadataRow(
                        label: t("Send time", "Heure d'envoi"),
                        value: viewModel.scheduleForLater
                            ? ADLConsoleDateFormatting.mediumDateTime(ISO8601DateFormatter().string(from: viewModel.scheduledDate))
                            : t("Immediately", "Immédiatement")
                    )
                }
                .padding(16)
            }

            if let sendError = viewModel.sendError {
                Text(sendError)
                    .font(ADLConsoleFont.footnote)
                    .foregroundStyle(ADLConsoleColor.danger)
            }
        }
    }

    // MARK: - Footer navigation

    private var footerButtons: some View {
        HStack(spacing: 12) {
            if viewModel.composerStep != .template {
                ADLConsoleSecondaryButton(title: t("Back", "Retour")) {
                    goBack()
                }
            }

            if viewModel.composerStep == .review {
                ADLConsolePrimaryButton(
                    title: t("Send campaign", "Envoyer la campagne"),
                    isBusy: viewModel.sendState == .sending,
                    isDisabled: viewModel.sendState == .sending || !viewModel.canAdvanceFromReviewStep
                ) {
                    Task { await viewModel.sendCampaign() }
                }
            } else {
                ADLConsolePrimaryButton(
                    title: t("Next", "Suivant"),
                    isDisabled: !canAdvance
                ) {
                    goNext()
                }
            }
        }
        .padding(16)
        .background(ADLConsoleColor.surface)
    }

    private var canAdvance: Bool {
        switch viewModel.composerStep {
        case .template:
            return !viewModel.messageBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                && (viewModel.channel == .sms || !viewModel.subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        case .audience, .schedule:
            return true
        case .review:
            return viewModel.canAdvanceFromReviewStep
        }
    }

    private func goNext() {
        switch viewModel.composerStep {
        case .template: viewModel.goToStep(.audience)
        case .audience: viewModel.goToStep(.schedule)
        case .schedule: viewModel.goToStep(.review)
        case .review: break
        }
    }

    private func goBack() {
        switch viewModel.composerStep {
        case .template: break
        case .audience: viewModel.goToStep(.template)
        case .schedule: viewModel.goToStep(.audience)
        case .review: viewModel.goToStep(.schedule)
        }
    }
}
