import SwiftUI
import UserNotifications

struct SettingsView: View {
    @AppStorage("notificationsEnabled") private var notificationsEnabled: Bool = true

    var body: some View {
        Form {
            Toggle(
                NSLocalizedString("Enable notifications", comment: "Activer les notifications"),
                isOn: $notificationsEnabled
            )
            .onChange(of: notificationsEnabled) { _, isOn in
                if isOn { requestNotificationAuthorizationIfNeeded() }
            }
        }
        .navigationTitle(NSLocalizedString("Settings", comment: "Réglages"))
    }
}

private func requestNotificationAuthorizationIfNeeded() {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
        if settings.authorizationStatus == .notDetermined {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        }
    }
}
