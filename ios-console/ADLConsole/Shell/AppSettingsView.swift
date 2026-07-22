import SwiftUI
import UserNotifications

struct AppSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var appState: AppState

    @AppStorage("highContrastEnabled") private var highContrastEnabled: Bool = false
    @AppStorage("notificationsEnabled") private var notificationsEnabled: Bool = true
    @AppStorage("smsNotificationsEnabled") private var smsNotificationsEnabled: Bool = false
    @AppStorage("hasCompletedADLOnboarding") private var hasCompletedOnboarding: Bool = false
    @AppStorage("shouldReplayADLOnboardingSplash") private var shouldReplayOnboardingSplash: Bool = false

    private var t: (String, String) -> String { appState.language.t }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                syncBanner
                languageSection
                displaySection
                notificationSection
                onboardingSection
                legalSection
                accountSection
                deleteAccountSection
                versionFooter
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .background(ADLConsoleColor.page)
        .navigationTitle(t("Settings", "Paramètres"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(t("Done", "Terminé")) {
                    dismiss()
                }
            }
        }
        .tint(highContrastEnabled ? ADLConsoleColor.navyDark : ADLConsoleColor.navy)
    }

    private var syncBanner: some View {
        ADLConsoleCard {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(ADLConsoleColor.forestWash)
                        .frame(width: 44, height: 44)
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(ADLConsoleColor.forestDark)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(t("All synced. Ready to capture.", "Tout synchronisé. Prêt à capturer."))
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    Text(t("Operational settings for language, alerts, legal access, and account control.", "Paramètres opérationnels pour la langue, les alertes, les accès légaux et le compte."))
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(16)
        }
    }

    private var languageSection: some View {
        settingsSection(title: t("Language", "Langue")) {
            settingsButton(title: "English", systemImage: "textformat", trailing: appState.language == .en ? "checkmark" : nil) {
                appState.language = .en
            }
            Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.35))
            settingsButton(title: "Français", systemImage: "textformat", trailing: appState.language == .fr ? "checkmark" : nil) {
                appState.language = .fr
            }
        }
    }

    private var displaySection: some View {
        settingsSection(title: t("Display", "Affichage")) {
            Toggle(isOn: $highContrastEnabled) {
                Label {
                    Text(t("High Contrast", "Contraste élevé"))
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.ink)
                } icon: {
                    Image(systemName: "circle.lefthalf.filled")
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 54)
        }
    }

    private var notificationSection: some View {
        settingsSection(title: t("Notifications", "Notifications")) {
            Toggle(isOn: $notificationsEnabled) {
                Label {
                    Text(t("Push notifications", "Notifications push"))
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.ink)
                } icon: {
                    Image(systemName: "bell.fill")
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 54)
            .onChange(of: notificationsEnabled) { _, isOn in
                if isOn { requestNotificationAuthorizationIfNeeded() }
            }

            Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.35))

            Toggle(isOn: $smsNotificationsEnabled) {
                VStack(alignment: .leading, spacing: 4) {
                    Label {
                        Text(t("SMS notifications", "Notifications SMS"))
                            .font(ADLConsoleFont.subheadline)
                            .foregroundStyle(ADLConsoleColor.ink)
                    } icon: {
                        Image(systemName: "message.fill")
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                    }
                    Text(t(
                        "Receive operational SMS (assignments, payouts, system notices). Reply STOP anytime to opt out.",
                        "Recevez des SMS opérationnels (missions, paiements, avis système). Répondez STOP à tout moment."
                    ))
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(minHeight: 64)
        }
    }

    private var onboardingSection: some View {
        settingsSection(title: t("Onboarding", "Accueil")) {
            settingsButton(title: t("Replay onboarding", "Revoir l'accueil"), systemImage: "sparkles", trailing: nil) {
                hasCompletedOnboarding = false
                shouldReplayOnboardingSplash = true
                dismiss()
            }
        }
    }

    private var legalSection: some View {
        settingsSection(title: t("Legal", "Légal")) {
            linkRow(title: t("Privacy Policy", "Politique de confidentialité"), systemImage: "hand.raised.fill", url: "https://africandatalayer.com/privacy")
            Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.35))
            linkRow(title: t("Terms of Use", "Conditions d'utilisation"), systemImage: "doc.text.fill", url: "https://africandatalayer.com/terms")
            Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.35))
            linkRow(title: t("Data & Compliance", "Données et conformité"), systemImage: "checkmark.shield.fill", url: "https://africandatalayer.com/data-compliance")
            Divider().overlay(ADLConsoleColor.navyBorder.opacity(0.35))
            linkRow(title: t("Report IP Infringement", "Signaler une atteinte PI"), systemImage: "exclamationmark.shield.fill", url: "https://africandatalayer.com/ip-report")
        }
    }

    private var accountSection: some View {
        settingsSection(title: t("Account", "Compte")) {
            Button(role: .destructive) {
                appState.signOut()
                dismiss()
            } label: {
                Label(t("Sign Out", "Déconnexion"), systemImage: "rectangle.portrait.and.arrow.right")
                    .font(ADLConsoleFont.subheadline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(minHeight: 54)
                    .padding(.horizontal, 14)
            }
        }
    }

    private var deleteAccountSection: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "trash.fill")
                        .foregroundStyle(ADLConsoleColor.danger)
                    Text(t("Delete account", "Supprimer le compte"))
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                }
                Text(t(
                    "Permanently remove your identity, credentials and company access.",
                    "Supprimez définitivement votre identité, vos identifiants et vos accès entreprise."
                ))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)

                Button(role: .destructive) {
                    startAccountDeletion()
                } label: {
                    Text(t("Start account deletion", "Démarrer la suppression du compte"))
                        .font(ADLConsoleFont.subheadline)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 46)
                }
                .buttonStyle(.bordered)
            }
            .padding(16)
        }
    }

    private var versionFooter: some View {
        VStack(spacing: 8) {
            ADLLogoMark(size: 22)
            Text("African Data Layer v\(appVersion)")
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 4)
    }

    private func settingsSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ADLConsoleMicroLabel(text: title)
                .padding(.horizontal, 4)
            ADLConsoleCard {
                VStack(spacing: 0) {
                    content()
                }
            }
        }
    }

    private func settingsButton(title: String, systemImage: String, trailing: String?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .frame(width: 22)
                Text(title)
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.ink)
                Spacer()
                if let trailing {
                    Image(systemName: trailing)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ADLConsoleColor.navy)
                }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 54)
        }
        .buttonStyle(ADLConsolePressStyle())
    }

    private func linkRow(title: String, systemImage: String, url: String) -> some View {
        Link(destination: URL(string: url)!) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .frame(width: 22)
                Text(title)
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.ink)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 54)
        }
    }

    private func startAccountDeletion() {
        let subject = "African Data Layer account deletion request"
        let body = "Please start account deletion for my African Data Layer account."
        var components = URLComponents(string: "mailto:privacy@africandatalayer.com")
        components?.queryItems = [
            URLQueryItem(name: "subject", value: subject),
            URLQueryItem(name: "body", value: body)
        ]
        if let url = components?.url {
            openURL(url)
        }
    }

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "2.4.0"
    }
}

private func requestNotificationAuthorizationIfNeeded() {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
        if settings.authorizationStatus == .notDetermined {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        }
    }
}
