import SwiftUI

/// Credential sign-in screen. Mirrors `ConsoleAuthScreen.tsx`'s sign-in mode
/// (registration/invite-accept is out of scope for this task — the console
/// app targets already-invited company users).
struct AuthView: View {
    @EnvironmentObject private var appState: AppState

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var isPasswordVisible: Bool = false

    private var t: (String, String) -> String { appState.language.t }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                header

                ADLConsoleCard {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(t("Sign in to your company", "Connectez-vous à votre entreprise"))
                                .font(ADLConsoleFont.title2)
                                .foregroundStyle(ADLConsoleColor.ink)
                            Text(t(
                                "Access only your authorized company projects, reviews and data.",
                                "Accédez uniquement aux projets, revues et données autorisés de votre entreprise."
                            ))
                            .font(ADLConsoleFont.footnote)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            ADLConsoleMicroLabel(text: t("Work email", "Adresse e-mail professionnelle"))
                            TextField(t("you@company.com", "vous@entreprise.com"), text: $email)
                                .textContentType(.username)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled(true)
                                .padding(12)
                                .background(ADLConsoleColor.navyWash)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            ADLConsoleMicroLabel(text: t("Password", "Mot de passe"))
                            HStack {
                                Group {
                                    if isPasswordVisible {
                                        TextField(t("Password", "Mot de passe"), text: $password)
                                    } else {
                                        SecureField(t("Password", "Mot de passe"), text: $password)
                                    }
                                }
                                .textContentType(.password)
                                Button {
                                    isPasswordVisible.toggle()
                                } label: {
                                    Image(systemName: isPasswordVisible ? "eye.slash" : "eye")
                                        .foregroundStyle(ADLConsoleColor.inkMuted)
                                }
                                .accessibilityLabel(t("Toggle password visibility", "Basculer la visibilité du mot de passe"))
                            }
                            .padding(12)
                            .background(ADLConsoleColor.navyWash)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }

                        if let error = appState.authErrorMessage {
                            Text(error)
                                .font(ADLConsoleFont.footnote)
                                .foregroundStyle(ADLConsoleColor.danger)
                                .accessibilityAddTraits(.isStaticText)
                        }

                        ADLConsolePrimaryButton(
                            title: t("Sign in", "Se connecter"),
                            isBusy: appState.isAuthenticating,
                            isDisabled: email.isEmpty || password.isEmpty
                        ) {
                            Task { await appState.signIn(email: email, password: password) }
                        }
                    }
                    .padding(20)
                }

                Button {
                    appState.toggleLanguage()
                } label: {
                    ADLConsoleMicroLabel(text: appState.language == .fr ? "FR · \(t("Switch to English", "Passer en anglais"))" : "EN · \(t("Switch to French", "Passer en français"))")
                }
            }
            .padding(20)
            .frame(maxWidth: 480)
        }
        .frame(maxWidth: .infinity)
        .background(ADLConsoleColor.page)
    }

    private var header: some View {
        VStack(spacing: 6) {
            Text("African Data Layer")
                .font(ADLConsoleFont.headline)
                .foregroundStyle(ADLConsoleColor.navy)
            ADLConsoleMicroLabel(text: t("Company Console", "Console Entreprise"))
        }
        .padding(.top, 24)
    }
}

#Preview {
    AuthView()
        .environmentObject(AppState(
            apiClient: .init(baseURL: URL(string: "https://example.com")!),
            authService: StubAuthService()
        ))
}
