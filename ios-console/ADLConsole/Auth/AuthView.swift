import SwiftUI

/// Credential sign-in — mirrors web `ConsoleAuthScreen` two-tone card.
struct AuthView: View {
    @EnvironmentObject private var appState: AppState

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var isPasswordVisible: Bool = false

    private var t: (String, String) -> String { appState.language.t }

    var body: some View {
        ZStack {
            pageBackground

            ScrollView {
                VStack(spacing: 24) {
                    brandHeader

                    signInCard

                    Button {
                        appState.toggleLanguage()
                    } label: {
                        Text(appState.language == .fr
                            ? "FR · \(t("Switch to English", "Passer en anglais"))"
                            : "EN · \(t("Switch to French", "Passer en français"))")
                            .font(ADLConsoleFont.subheadline)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                    }
                    .padding(.bottom, 12)
                }
                .padding(.horizontal, 20)
                .padding(.top, 28)
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private var pageBackground: some View {
        ZStack {
            ADLConsoleColor.page
            GeometryReader { geo in
                Path { path in
                    let step: CGFloat = 28
                    for x in stride(from: 0, through: geo.size.width, by: step) {
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: geo.size.height))
                    }
                    for y in stride(from: 0, through: geo.size.height, by: step) {
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: geo.size.width, y: y))
                    }
                }
                .stroke(ADLConsoleColor.navyBorder.opacity(0.35), lineWidth: 0.5)
            }
        }
        .ignoresSafeArea()
    }

    private var brandHeader: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: "shield.lefthalf.filled")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(ADLConsoleColor.gold)
                VStack(alignment: .leading, spacing: 2) {
                    Text("African Data Layer")
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.navy)
                    ADLConsoleMicroLabel(text: t("Company Console", "Console Entreprise"), color: ADLConsoleColor.inkMuted)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }

    private var signInCard: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color.white.opacity(0.12))
                        .frame(width: 48, height: 48)
                    Image(systemName: "building.2.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(.white)
                }

                Text(t("Sign in to your company", "Connectez-vous à votre entreprise"))
                    .font(ADLConsoleFont.title)
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)

                Text(t(
                    "Access only your authorized company projects, reviews and data.",
                    "Accédez uniquement aux projets, revues et données autorisés de votre entreprise."
                ))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(Color.white.opacity(0.78))
                .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(22)
            .background(
                LinearGradient(
                    colors: [ADLConsoleColor.navy, ADLConsoleColor.navyDark],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )

            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(t("Work email", "Adresse e-mail professionnelle"))
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    ADLConsoleFieldChrome {
                        HStack(spacing: 10) {
                            Image(systemName: "envelope")
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                            TextField("name@company.com", text: $email)
                                .textContentType(.username)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled(true)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(t("Password", "Mot de passe"))
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    ADLConsoleFieldChrome {
                        HStack(spacing: 10) {
                            Image(systemName: "lock")
                                .foregroundStyle(ADLConsoleColor.inkMuted)
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
                    }
                }

                if let error = appState.authErrorMessage {
                    Text(error)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.danger)
                }

                ADLConsolePrimaryButton(
                    title: t("Open company console", "Ouvrir la console entreprise"),
                    systemImage: "shield.checkered",
                    isBusy: appState.isAuthenticating,
                    isDisabled: email.isEmpty || password.isEmpty
                ) {
                    Task { await appState.signIn(email: email, password: password) }
                }

                Text(t(
                    "New users must use the invitation link sent by their manager.",
                    "Les nouveaux utilisateurs doivent utiliser le lien d'invitation envoyé par leur gestionnaire."
                ))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
            }
            .padding(20)
            .background(Color.white)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(ADLConsoleColor.navyBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.08), radius: 20, x: 0, y: 10)
    }
}

#Preview {
    AuthView()
        .environmentObject(AppState(
            apiClient: .init(baseURL: URL(string: "https://example.com")!),
            authService: StubAuthService()
        ))
}
