import Charts
import MapKit
import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    /// Persisted so the onboarding splash shows only on first launch (mirrors web localStorage flag).
    @AppStorage("adl_has_seen_splash") private var hasSeenSplash = false
    @State private var showAuth = ProcessInfo.processInfo.environment["ADL_START_AUTH"] == "1"

    var body: some View {
        Group {
            if appState.isBootstrapping {
                BootSplashView()
            } else if appState.isAuthRequested || showAuth {
                AuthView(onBack: {
                    showAuth = false
                    hasSeenSplash = true
                    appState.continueAsGuest()
                })
            } else if appState.isAuthenticated || appState.isGuest {
                AppShellView()
            } else {
                AppShellView()
                    .onAppear { appState.continueAsGuest() }
            }
        }
        .task {
            await appState.bootstrap()
        }
    }
}

/// Brief navy loading splash shown only during bootstrap.
struct BootSplashView: View {
    @EnvironmentObject private var appState: AppState
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [ADLColor.navyDark, ADLColor.navy, ADLColor.navyMid],
                startPoint: .top, endPoint: .bottom
            ).ignoresSafeArea()
            VStack(spacing: 14) {
                BrandDiamond(size: 84)
                Text("African Data Layer")
                    .font(ADLFont.inter(17, .bold))
                    .foregroundColor(.white)
                Text(appState.t("DOUALA · CAMEROON", "DOUALA · CAMEROUN"))
                    .font(ADLFont.inter(11, .bold))
                    .tracking(2)
                    .foregroundColor(.white.opacity(0.55))
            }
        }
    }
}

// MARK: - Layered ADL brand diamond (mirrors BrandLogo SVG)

struct BrandDiamond: View {
    var size: CGFloat = 88

    var body: some View {
        Canvas { ctx, sz in
            let s = sz.width / 128
            func diamond(cx: CGFloat, cy: CGFloat, hw: CGFloat, hh: CGFloat) -> Path {
                var p = Path()
                p.move(to: CGPoint(x: cx, y: cy - hh))
                p.addLine(to: CGPoint(x: cx + hw, y: cy))
                p.addLine(to: CGPoint(x: cx, y: cy + hh))
                p.addLine(to: CGPoint(x: cx - hw, y: cy))
                p.closeSubpath()
                return p
            }
            let stroke = 6 * s
            // bottom navy
            let bottom = diamond(cx: 64 * s, cy: 88 * s, hw: 48 * s, hh: 26 * s)
            ctx.fill(bottom, with: .color(ADLColor.navy))
            ctx.stroke(bottom, with: .color(.white), lineWidth: stroke)
            // middle gold
            let mid = diamond(cx: 64 * s, cy: 70 * s, hw: 48 * s, hh: 26 * s)
            ctx.fill(mid, with: .color(ADLColor.gold))
            ctx.stroke(mid, with: .color(.white), lineWidth: stroke)
            // top navy
            let top = diamond(cx: 64 * s, cy: 40 * s, hw: 48 * s, hh: 26 * s)
            ctx.fill(top, with: .color(ADLColor.navy))
            ctx.stroke(top, with: .color(.white), lineWidth: stroke)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Splash onboarding carousel (mirrors web Splash.tsx)

struct SplashView: View {
    let onContinue: () -> Void
    var onGuest: () -> Void = {}
    @State private var idx = 0
    @EnvironmentObject private var appState: AppState

    private struct Slide: Identifiable {
        let id = UUID()
        let eyebrow: String
        let title: String
        let body: String
    }

    private var slides: [Slide] {
        [
            Slide(eyebrow: appState.t("Welcome", "Bienvenue"),
                  title: appState.t("The city, mapped\nfrom the ground up.", "La ville cartographiée\ndepuis le terrain."),
                  body: appState.t(
                      "African Data Layer turns everyday movement in Bonamoussadi into verified infrastructure data.",
                      "African Data Layer transforme les déplacements quotidiens à Bonamoussadi en données d'infrastructure vérifiées."
                  )),
            Slide(eyebrow: appState.t("Before you start", "Avant de commencer"),
                  title: appState.t("Camera + GPS,\nverified at capture.", "Caméra + GPS,\nvérifiés à la capture."),
                  body: appState.t(
                      "We need your camera and location to verify each capture. Only live photos are accepted — no gallery uploads.",
                      "Nous avons besoin de votre caméra et de votre position pour vérifier chaque capture. Seules les photos en direct sont acceptées."
                  )),
            Slide(eyebrow: appState.t("7 Verticals", "7 catégories"),
                  title: appState.t("Every corner\nof the city counts.", "Chaque coin\nde la ville compte."),
                  body: appState.t(
                      "Pharmacies, mobile money, fuel, alcohol, billboards, roads, buildings — all mapped and verified in real time.",
                      "Pharmacies, mobile money, carburant, alcool, panneaux, routes, bâtiments — tout cartographié et vérifié en temps réel."
                  )),
            Slide(eyebrow: appState.t("Rewards", "Récompenses"),
                  title: appState.t("Map more.\nClimb higher.", "Cartographiez plus.\nMontez plus haut."),
                  body: appState.t(
                      "Earn XP on every verified submission. Rise up the leaderboard. Unlock badges and real rewards.",
                      "Gagnez des XP à chaque contribution vérifiée. Grimpez le classement. Débloquez des badges et de vraies récompenses."
                  )),
            Slide(eyebrow: appState.t("Ready?", "Prêt ?"),
                  title: appState.t("Join the\nmission.", "Rejoignez la\nmission."),
                  body: appState.t(
                      "Sign in or create your account to start contributing. Data collection starts now.",
                      "Connectez-vous ou créez un compte pour commencer à contribuer. La collecte démarre maintenant."
                  )),
        ]
    }

    private var isFinal: Bool { idx == slides.count - 1 }

    var body: some View {
        GeometryReader { geo in
            let heroH = geo.size.height * 0.58
            ZStack(alignment: .top) {
                Color.white.ignoresSafeArea()

                VStack(spacing: 0) {
                    heroRegion(height: heroH)
                    Spacer(minLength: 0)
                }

                sheet
                    .padding(.top, heroH - 24)
            }
            .ignoresSafeArea(edges: .top)
        }
    }

    // MARK: Hero

    private func heroRegion(height: CGFloat) -> some View {
        ZStack {
            LinearGradient(
                stops: [
                    .init(color: ADLColor.navyDark, location: 0),
                    .init(color: ADLColor.navy, location: 0.6),
                    .init(color: ADLColor.navyMid, location: 1),
                ],
                startPoint: .top, endPoint: .bottom
            )

            TabView(selection: $idx) {
                ForEach(Array(slides.enumerated()), id: \.offset) { pair in
                    heroScene(for: pair.offset)
                        .tag(pair.offset)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            // top chrome
            VStack {
                HStack {
                    HStack(spacing: 6) {
                        BrandDiamond(size: 18)
                        Text("ADL")
                            .font(ADLFont.inter(11, .bold))
                            .tracking(1.6)
                            .foregroundColor(.white.opacity(0.9))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Color.white.opacity(0.1))
                    .clipShape(Capsule())

                    Spacer()

                    if !isFinal {
                        Button {
                            withAnimation { idx = slides.count - 1 }
                        } label: {
                            Text(appState.t("Skip", "Passer"))
                                .font(ADLFont.inter(11, .bold))
                                .tracking(1.6)
                                .foregroundColor(.white.opacity(0.9))
                                .padding(.horizontal, 16)
                                .frame(height: 36)
                                .background(Color.white.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 56)
                Spacer()
            }
        }
        .frame(height: height)
        .clipped()
    }

    @ViewBuilder
    private func heroScene(for index: Int) -> some View {
        switch index {
        case 0: HeroWelcome()
        case 1: HeroPermissions()
        case 2: HeroVerticals()
        case 3: HeroRewards()
        default: HeroReady()
        }
    }

    // MARK: Sheet

    private var sheet: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(slides[idx].eyebrow.uppercased())
                .font(ADLFont.inter(11, .bold))
                .tracking(2.2)
                .foregroundColor(ADLColor.terracotta)

            Text(slides[idx].title)
                .font(ADLFont.inter(28, .heavy))
                .tracking(-0.4)
                .foregroundColor(ADLColor.ink)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            Text(slides[idx].body)
                .font(ADLFont.inter(14))
                .foregroundColor(Color(hex: 0x4b5563))
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)

            Spacer(minLength: 24)

            // dots
            HStack(spacing: 8) {
                ForEach(0..<slides.count, id: \.self) { j in
                    Capsule()
                        .fill(j == idx ? ADLColor.navy : (j < idx ? ADLColor.terracotta.opacity(0.6) : Color(hex: 0xe5e7eb)))
                        .frame(width: j == idx ? 24 : 12, height: 6)
                        .animation(.easeOut(duration: 0.3), value: idx)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 20)

            // CTA
            if isFinal {
                VStack(spacing: 12) {
                    Button { onContinue() } label: {
                        Text(appState.t("Sign In", "Connexion"))
                            .font(ADLFont.inter(13, .bold))
                            .tracking(1.4)
                            .textCase(.uppercase)
                    }
                    .buttonStyle(CTAButtonStyle())

                    Button { onContinue() } label: {
                        Text(appState.t("Create Account", "Créer un compte"))
                            .font(ADLFont.inter(13, .bold))
                            .tracking(1.0)
                            .textCase(.uppercase)
                    }
                    .buttonStyle(SecondaryButtonStyle())

                    Button { onGuest() } label: {
                        Text(appState.t("Browse as Guest", "Continuer en invité"))
                            .font(ADLFont.inter(11, .bold))
                            .tracking(1.6)
                            .textCase(.uppercase)
                            .foregroundColor(Color(hex: 0x6b7280))
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                }
            } else {
                Button {
                    withAnimation { idx = min(idx + 1, slides.count - 1) }
                } label: {
                    HStack(spacing: 8) {
                        Text(appState.t("Next", "Suivant"))
                            .font(ADLFont.inter(13, .bold))
                            .tracking(1.6)
                            .textCase(.uppercase)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 16, weight: .bold))
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 28)
        .padding(.bottom, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(
            UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28, style: .continuous)
                .fill(Color.white)
                .shadow(color: ADLColor.navy.opacity(0.12), radius: 22, x: 0, y: -12)
        )
    }
}

// MARK: - Splash hero scenes

private struct HeroWelcome: View {
    var body: some View {
        ZStack {
            // faint grid
            GeometryReader { g in
                Path { p in
                    let step: CGFloat = 38
                    var y: CGFloat = 40
                    while y < g.size.height { p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: g.size.width, y: y)); y += step }
                    var x: CGFloat = 20
                    while x < g.size.width { p.move(to: CGPoint(x: x, y: 0)); p.addLine(to: CGPoint(x: x, y: g.size.height)); x += 40 }
                }
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
            }
            // gold glow
            Circle()
                .fill(RadialGradient(colors: [ADLColor.gold.opacity(0.4), ADLColor.gold.opacity(0)], center: .center, startRadius: 0, endRadius: 170))
                .frame(width: 360, height: 360)
            // pulse ring
            Circle().stroke(ADLColor.gold.opacity(0.35), lineWidth: 1.5).frame(width: 128, height: 128)
            Circle().fill(ADLColor.navy).overlay(Circle().stroke(ADLColor.gold.opacity(0.5), lineWidth: 1)).frame(width: 96, height: 96)
            BrandDiamond(size: 64)
        }
    }
}

private struct HeroPermissions: View {
    var body: some View {
        ZStack {
            Ellipse()
                .fill(RadialGradient(colors: [ADLColor.terracotta.opacity(0.35), ADLColor.terracotta.opacity(0)], center: .center, startRadius: 0, endRadius: 180))
                .frame(width: 360, height: 280)
            HStack(spacing: 24) {
                glassIcon("camera.fill")
                glassIcon("location.fill")
            }
        }
    }

    private func glassIcon(_ name: String) -> some View {
        Image(systemName: name)
            .font(.system(size: 40, weight: .semibold))
            .foregroundColor(.white)
            .frame(width: 96, height: 96)
            .background(Color.white.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .shadow(color: ADLColor.navy.opacity(0.6), radius: 20, x: 0, y: 18)
    }
}

private struct HeroVerticals: View {
    private let cats = SubmissionCategory.allCases
    private let cols = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    var body: some View {
        VStack {
            LazyVGrid(columns: cols, spacing: 8) {
                ForEach(cats) { cat in
                    VStack(spacing: 6) {
                        Image(systemName: cat.systemImage)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(cat.tint)
                            .frame(width: 28, height: 28)
                            .background(Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        Text(cat.title)
                            .font(ADLFont.inter(9, .bold))
                            .foregroundColor(.white.opacity(0.85))
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(height: 78)
                    .frame(maxWidth: .infinity)
                    .background(cat.tint.opacity(0.13))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.white.opacity(0.1), lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 64)
            Spacer()
        }
    }
}

private struct HeroRewards: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ZStack {
            Ellipse()
                .fill(RadialGradient(colors: [ADLColor.gold.opacity(0.35), ADLColor.gold.opacity(0)], center: .center, startRadius: 0, endRadius: 180))
                .frame(width: 360, height: 280)
            VStack(spacing: 18) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 46, weight: .semibold))
                    .foregroundColor(ADLColor.gold)
                    .frame(width: 112, height: 112)
                    .background(Color.white.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
                    .shadow(color: ADLColor.gold.opacity(0.4), radius: 20, x: 0, y: 18)
                Text(appState.t("Be the first verified.", "Soyez le premier vérifié."))
                    .font(ADLFont.inter(14, .semibold))
                    .foregroundColor(.white.opacity(0.85))
            }
        }
    }
}

private struct HeroReady: View {
    @EnvironmentObject private var appState: AppState
    private let pills: [SubmissionCategory] = [.pharmacy, .fuelStation, .mobileMoney, .transportRoad, .censusProxy]

    var body: some View {
        ZStack {
            ForEach([60, 110, 160, 220], id: \.self) { r in
                Circle().stroke(Color.white.opacity(0.04), lineWidth: 1)
                    .frame(width: CGFloat(r) * 2, height: CGFloat(r) * 2)
            }
            VStack(spacing: 0) {
                Spacer().frame(height: 56)
                BrandDiamond(size: 88)
                Text("African Data Layer")
                    .font(ADLFont.inter(16, .heavy))
                    .foregroundColor(.white)
                    .padding(.top, 12)
                Text(appState.t("DOUALA · CAMEROON", "DOUALA · CAMEROUN"))
                    .font(ADLFont.inter(11, .bold))
                    .tracking(2.2)
                    .foregroundColor(.white.opacity(0.55))
                    .padding(.top, 4)
                Spacer()
                HStack {
                    FlowPills(items: pills.map { $0.title })
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
            }
        }
    }
}

/// Simple centered wrapping pill row.
private struct FlowPills: View {
    let items: [String]
    var body: some View {
        HStack(spacing: 6) {
            ForEach(items.prefix(3), id: \.self) { pill($0) }
        }
        .overlay(alignment: .bottom) {
            HStack(spacing: 6) {
                ForEach(items.dropFirst(3), id: \.self) { pill($0) }
            }
            .offset(y: 32)
        }
    }
    private func pill(_ text: String) -> some View {
        Text(text.uppercased())
            .font(ADLFont.inter(10, .bold))
            .tracking(0.8)
            .foregroundColor(.white.opacity(0.85))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.white.opacity(0.1))
            .overlay(Capsule().stroke(Color.white.opacity(0.2), lineWidth: 1))
            .clipShape(Capsule())
    }
}

/// Auth screen mirroring web Auth.tsx — centered, light, OAuth + credentials.
struct AuthView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.openURL) private var openURL
    var onBack: (() -> Void)? = nil

    private enum Mode { case signin, signup }
    @State private var mode: Mode = .signin
    @State private var identifier = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var smsOptIn = false
    @State private var emailNoticeAccepted = false
    @State private var acceptedTerms = false
    @State private var showForgotPassword = false

    private var title: String {
        mode == .signin
            ? appState.t("Welcome back", "Bon retour")
            : appState.t("Join the network", "Rejoignez le réseau")
    }
    private var subtitle: String {
        mode == .signin
            ? appState.t(
                "Sign in to continue capturing verified field data on the ground.",
                "Connectez-vous pour continuer à capturer des données terrain vérifiées."
              )
            : appState.t(
                "Create a field account to capture locations, services, and infrastructure changes on the ground.",
                "Créez un compte terrain pour capturer des lieux, services et changements d'infrastructure."
              )
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            ADLColor.paper.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    // Logo tile
                    BrandDiamond(size: 40)
                        .frame(width: 72, height: 72)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .shadow(color: ADLColor.navy.opacity(0.08), radius: 12, x: 0, y: 6)
                        .padding(.top, 40)

                    Text(title)
                        .font(ADLFont.inter(28, .heavy))
                        .tracking(-0.4)
                        .foregroundColor(ADLColor.ink)
                        .padding(.top, 20)

                    Text(subtitle)
                        .font(ADLFont.inter(14))
                        .foregroundColor(ADLColor.inkMuted)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 8)
                        .padding(.horizontal, 8)

                    // OAuth buttons
                    Button { appState.authError = appState.t("Apple sign-in is available in the production build.", "La connexion Apple est disponible dans la version de production.") } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "applelogo").font(.system(size: 17, weight: .medium))
                            Text(appState.t("Sign in with Apple", "Se connecter avec Apple")).font(ADLFont.inter(15, .semibold))
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, 28)

                    Button { appState.authError = appState.t("Google sign-in is available in the production build.", "La connexion Google est disponible dans la version de production.") } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "globe").font(.system(size: 16, weight: .semibold))
                            Text(appState.t("Continue with Google", "Continuer avec Google")).font(ADLFont.inter(15, .semibold))
                        }
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .padding(.top, 12)

                    // Credentials form
                    VStack(alignment: .leading, spacing: 16) {
                        fieldLabel(appState.t("Phone number or email", "Numéro de téléphone ou email"))
                        ADLInputField(icon: "envelope", placeholder: "+2376XXXXXXXX or name@email.com", text: $identifier, isSecure: false, keyboard: .emailAddress)

                        fieldLabel(appState.t("Password", "Mot de passe"))
                        ADLInputField(
                            icon: "lock",
                            placeholder: mode == .signup ? appState.t("Min. 10 chars, A-Z, a-z, 0-9", "Min. 10 caractères, A-Z, a-z, 0-9") : appState.t("Your password", "Votre mot de passe"),
                            text: $password,
                            isSecure: !showPassword,
                            keyboard: .default,
                            trailingToggle: { showPassword.toggle() },
                            trailingIcon: showPassword ? "eye.slash" : "eye"
                        )

                        if let authError = appState.authError {
                            Text(authError)
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(ADLColor.terracotta)
                        }

                        if mode == .signup {
                            VStack(alignment: .leading, spacing: 12) {
                                AuthConsentRow(
                                    isOn: $smsOptIn,
                                    text: appState.t(
                                        "I agree to receive operational SMS for assignments, payouts, and system notices. Message frequency varies. Reply STOP anytime.",
                                        "J'accepte de recevoir des SMS pour les missions, paiements et avis système. Fréquence variable. Répondez STOP à tout moment."
                                    )
                                )
                                AuthConsentRow(
                                    isOn: $emailNoticeAccepted,
                                    text: appState.t(
                                        "I agree to receive operational email for account, security, payout, and policy notices.",
                                        "J'accepte de recevoir des emails opérationnels pour le compte, la sécurité, les paiements et les politiques."
                                    )
                                )
                                termsConsentRow
                            }
                            .padding(.top, 2)
                        }

                        Button {
                            Task {
                                if mode == .signin {
                                    await appState.signIn(identifier: identifier, password: password)
                                } else {
                                    await appState.register(
                                        identifier: identifier,
                                        password: password,
                                        acceptedTerms: acceptedTerms,
                                        smsOptIn: smsOptIn,
                                        emailNoticeAccepted: emailNoticeAccepted
                                    )
                                }
                            }
                        } label: {
                            HStack(spacing: 8) {
                                if appState.isSigningIn {
                                    ProgressView().tint(.white)
                                } else {
                                    Text(mode == .signin ? appState.t("Sign in", "Connexion") : appState.t("Create account", "Créer un compte"))
                                        .font(ADLFont.inter(15, .semibold))
                                    Image(systemName: "arrow.right").font(.system(size: 16, weight: .bold))
                                }
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(appState.isSigningIn)
                    }
                    .padding(.top, 24)

                    if mode == .signin {
                        Button { showForgotPassword = true } label: {
                            Text(appState.t("Forgot your password?", "Mot de passe oublié ?"))
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(ADLColor.navy)
                        }
                        .padding(.top, 12)
                        .sheet(isPresented: $showForgotPassword) {
                            ForgotPasswordView()
                                .environmentObject(appState)
                        }
                    }

                    // Shield reassurance
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.shield.fill").font(.system(size: 12))
                        Text(appState.t("Encrypted sign-in keeps your field account secure.", "La connexion chiffrée sécurise votre compte terrain."))
                            .font(ADLFont.inter(12, .semibold))
                    }
                    .foregroundColor(ADLColor.inkMuted)
                    .padding(.top, 28)

                    // Mode toggle
                    HStack(spacing: 4) {
                        Text(mode == .signin ? appState.t("Don't have an account?", "Vous n'avez pas de compte ?") : appState.t("Already have an account?", "Vous avez déjà un compte ?"))
                            .font(ADLFont.inter(12))
                            .foregroundColor(ADLColor.inkMuted)
                        Button {
                            withAnimation { mode = mode == .signin ? .signup : .signin }
                            appState.authError = nil
                            smsOptIn = false
                            emailNoticeAccepted = false
                            acceptedTerms = false
                        } label: {
                            Text(mode == .signin ? appState.t("Create an account", "Créer un compte") : appState.t("Sign in instead", "Se connecter plutôt"))
                                .font(ADLFont.inter(12, .bold))
                                .foregroundColor(ADLColor.navy)
                        }
                    }
                    .padding(.top, 20)

                }
                .frame(maxWidth: 440)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }

            if let onBack {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(ADLColor.ink)
                        .frame(width: 44, height: 44)
                }
                .padding(.leading, 8)
                .padding(.top, 8)
            }
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(ADLFont.inter(13, .semibold))
            .foregroundColor(ADLColor.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var termsConsentRow: some View {
        HStack(alignment: .top, spacing: 10) {
            Button {
                acceptedTerms.toggle()
            } label: {
                Image(systemName: acceptedTerms ? "checkmark.square.fill" : "square")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(acceptedTerms ? ADLColor.navy : Color(hex: 0x9ca3af))
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 4) {
                Text(appState.t(
                    "I agree to the Terms of Use and Privacy Policy.",
                    "J'accepte les Conditions d'utilisation et la Politique de confidentialité."
                ))
                .font(ADLFont.inter(12))
                .foregroundColor(Color(hex: 0x4b5563))
                .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 12) {
                    Button(appState.t("Terms", "Conditions")) {
                        openURL(URL(string: "https://www.app.africandatalayer.com/")!)
                    }
                    Button(appState.t("Privacy", "Confidentialité")) {
                        openURL(URL(string: "https://www.app.africandatalayer.com/")!)
                    }
                }
                .font(ADLFont.inter(12, .bold))
                .foregroundColor(ADLColor.navy)
            }
        }
    }
}

// MARK: - Forgot Password flow

struct ForgotPasswordView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    private enum Step { case request, confirm, done }
    @State private var step: Step = .request
    @State private var identifier = ""
    @State private var token = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var showNewPassword = false
    @State private var showConfirmPassword = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .topLeading) {
                ADLColor.paper.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 0) {
                        // Header
                        HStack {
                            Button { dismiss() } label: {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(ADLColor.ink)
                                    .frame(width: 44, height: 44)
                            }
                            Spacer()
                            BrandDiamond(size: 24)
                                .frame(width: 44, height: 44)
                                .background(Color.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .shadow(color: ADLColor.navy.opacity(0.08), radius: 6, x: 0, y: 3)
                            Spacer()
                            Color.clear.frame(width: 44, height: 44)
                        }
                        .padding(.horizontal, 12)
                        .padding(.top, 12)

                        // Title
                        VStack(spacing: 6) {
                            Text(appState.t("Reset password", "Réinitialiser le mot de passe"))
                                .font(ADLFont.inter(24, .heavy))
                                .tracking(-0.3)
                                .foregroundColor(ADLColor.ink)
                            Text(stepSubtitle)
                                .font(ADLFont.inter(13))
                                .foregroundColor(ADLColor.inkMuted)
                                .multilineTextAlignment(.center)
                                .lineSpacing(3)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.horizontal, 16)
                        }
                        .padding(.top, 20)

                        // Form card
                        VStack(alignment: .leading, spacing: 16) {
                            if step == .request {
                                requestForm
                            } else if step == .confirm {
                                confirmForm
                            } else {
                                doneView
                            }

                            // Error / info banners
                            if let err = appState.resetError {
                                HStack(spacing: 8) {
                                    Image(systemName: "exclamationmark.circle.fill")
                                        .font(.system(size: 14))
                                    Text(err)
                                        .font(ADLFont.inter(13))
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .foregroundColor(ADLColor.terracotta)
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(ADLColor.terraWash)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            if let info = appState.resetInfo {
                                HStack(spacing: 8) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 14))
                                    Text(info)
                                        .font(ADLFont.inter(13))
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .foregroundColor(ADLColor.forest)
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(ADLColor.forestWash)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                        }
                        .padding(20)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .shadow(color: ADLColor.navy.opacity(0.06), radius: 12, x: 0, y: 4)
                        .padding(.horizontal, 20)
                        .padding(.top, 24)

                        // Back to sign in
                        Button { dismiss() } label: {
                            Text(appState.t("Back to sign in", "Retour à la connexion"))
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(ADLColor.navy)
                                .underline()
                        }
                        .padding(.top, 20)
                        .padding(.bottom, 40)
                    }
                    .frame(maxWidth: 440)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 4)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .onDisappear {
            appState.resetError = nil
            appState.resetInfo = nil
        }
    }

    private var stepSubtitle: String {
        switch step {
        case .request:
            return appState.t(
                "Enter the phone or email tied to your account. We'll send a reset code.",
                "Entrez le téléphone ou e-mail lié à votre compte. Nous enverrons un code."
            )
        case .confirm:
            return appState.t(
                "Enter the code from your email or SMS, then choose a new password.",
                "Entrez le code reçu par email ou SMS, puis choisissez un nouveau mot de passe."
            )
        case .done:
            return appState.t(
                "Your password has been updated.",
                "Votre mot de passe a été mis à jour."
            )
        }
    }

    // MARK: Step 1 – request

    private var requestForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(appState.t("Phone or email", "Téléphone ou e-mail"))
                .font(ADLFont.inter(13, .semibold))
                .foregroundColor(ADLColor.ink)
            ADLInputField(
                icon: "envelope",
                placeholder: appState.t("+237699000000 or you@example.com", "+237699000000 ou vous@exemple.com"),
                text: $identifier,
                isSecure: false,
                keyboard: .emailAddress
            )

            Button {
                Task { await submitRequest() }
            } label: {
                HStack(spacing: 8) {
                    if appState.isResetting {
                        ProgressView().tint(.white)
                    } else {
                        Text(appState.t("Send reset code", "Envoyer le code"))
                            .font(ADLFont.inter(15, .semibold))
                        Image(systemName: "arrow.right").font(.system(size: 16, weight: .bold))
                    }
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(appState.isResetting)
        }
    }

    // MARK: Step 2 – confirm

    private var confirmForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(appState.t("Reset code", "Code de réinitialisation"))
                .font(ADLFont.inter(13, .semibold))
                .foregroundColor(ADLColor.ink)
            ADLInputField(
                icon: "number",
                placeholder: appState.t("Code from email / SMS", "Code reçu par email / SMS"),
                text: $token,
                isSecure: false,
                keyboard: .default
            )

            Text(appState.t("New password", "Nouveau mot de passe"))
                .font(ADLFont.inter(13, .semibold))
                .foregroundColor(ADLColor.ink)
            ADLInputField(
                icon: "lock",
                placeholder: appState.t("At least 8 characters", "Au moins 8 caractères"),
                text: $newPassword,
                isSecure: !showNewPassword,
                keyboard: .default,
                trailingToggle: { showNewPassword.toggle() },
                trailingIcon: showNewPassword ? "eye.slash" : "eye"
            )

            Text(appState.t("Confirm password", "Confirmer le mot de passe"))
                .font(ADLFont.inter(13, .semibold))
                .foregroundColor(ADLColor.ink)
            ADLInputField(
                icon: "lock",
                placeholder: appState.t("Re-enter new password", "Saisissez à nouveau"),
                text: $confirmPassword,
                isSecure: !showConfirmPassword,
                keyboard: .default,
                trailingToggle: { showConfirmPassword.toggle() },
                trailingIcon: showConfirmPassword ? "eye.slash" : "eye"
            )

            Button {
                Task { await submitConfirm() }
            } label: {
                HStack(spacing: 8) {
                    if appState.isResetting {
                        ProgressView().tint(.white)
                    } else {
                        Text(appState.t("Update password", "Mettre à jour le mot de passe"))
                            .font(ADLFont.inter(15, .semibold))
                        Image(systemName: "checkmark").font(.system(size: 16, weight: .bold))
                    }
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(appState.isResetting)
        }
    }

    // MARK: Step 3 – done

    private var doneView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 40))
                .foregroundColor(ADLColor.forest)
            Text(appState.t(
                "Password updated. You can now sign in with your new password.",
                "Mot de passe mis à jour. Vous pouvez vous connecter avec votre nouveau mot de passe."
            ))
            .font(ADLFont.inter(14))
            .foregroundColor(ADLColor.ink)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)

            Button { dismiss() } label: {
                Text(appState.t("Back to sign in", "Retour à la connexion"))
                    .font(ADLFont.inter(15, .semibold))
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: Actions

    private func submitRequest() async {
        await appState.requestPasswordReset(identifier: identifier)
        if appState.resetInfo != nil {
            withAnimation { step = .confirm }
        }
    }

    private func submitConfirm() async {
        await appState.confirmPasswordReset(token: token, password: newPassword, confirmPassword: confirmPassword)
        if appState.resetInfo != nil {
            withAnimation { step = .done }
        }
    }
}

struct AuthConsentRow: View {
    @Binding var isOn: Bool
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Button {
                isOn.toggle()
            } label: {
                Image(systemName: isOn ? "checkmark.square.fill" : "square")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(isOn ? ADLColor.navy : Color(hex: 0x9ca3af))
            }
            .buttonStyle(.plain)

            Text(text)
                .font(ADLFont.inter(12))
                .foregroundColor(Color(hex: 0x4b5563))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Web-style input: h56 rounded-2xl, leading icon, gray-100 border, shadow-sm, optional trailing toggle.
struct ADLInputField: View {
    let icon: String
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool = false
    var keyboard: UIKeyboardType = .default
    var trailingToggle: (() -> Void)? = nil
    var trailingIcon: String? = nil

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .regular))
                .foregroundColor(ADLColor.inkMuted)
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .font(ADLFont.inter(16))
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            if let trailingToggle, let trailingIcon {
                Button(action: trailingToggle) {
                    Image(systemName: trailingIcon)
                        .font(.system(size: 16))
                        .foregroundColor(ADLColor.inkMuted)
                }
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 56)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous).stroke(ADLColor.line, lineWidth: 1))
        .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
    }
}

struct AppShellView: View {
    @EnvironmentObject private var appState: AppState

    private var routes: [AppRoute] { AppReleaseMode.tabs(for: appState.selectedRole) }

    var body: some View {
        VStack(spacing: 0) {
            ADLSyncBar(message: appState.lastSyncMessage)
            NavigationStack {
                screen(for: appState.selectedTab)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(ADLColor.paper)
                    .toolbar(.hidden, for: .navigationBar)
            }
            ADLTabBar(
                routes: routes,
                selection: appState.selectedTab,
                isAdmin: appState.selectedRole == .admin,
                onSelect: { route in
                    if appState.isGuest && (route == .contribute || route == .profile) {
                        appState.requestAuth()
                    } else {
                        appState.selectedTab = route
                    }
                }
            )
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .onAppear { appState.enforceVisibleNavigation() }
        .onChange(of: appState.selectedRole) { appState.enforceVisibleNavigation() }
        .onChange(of: appState.selectedTab) { appState.enforceVisibleNavigation() }
        .overlay {
            if let event = appState.levelUpEvent {
                LevelUpCelebration(tier: event.tier) {
                    appState.dismissLevelUp()
                }
                .transition(.opacity)
            }
        }
    }

    @ViewBuilder
    private func screen(for route: AppRoute) -> some View {
        switch route {
        case .home: AgentHomeView()
        case .contribute: ContributionView()
        case .queue: SubmissionQueueView()
        case .rewards: RewardsView()
        case .profile: ProfileView()
        case .adminReview: AdminReviewView()
        case .agentPerformance: AgentPerformanceView()
        case .clientDashboard: ClientDashboardView()
        case .investor: InvestorDashboardView()
        case .analytics: AnalyticsView()
        }
    }
}

/// Green "all synced" status strip mirroring the web SyncStatusBar.
struct ADLSyncBar: View {
    let message: String
    @EnvironmentObject private var appState: AppState

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 14))
                .foregroundColor(ADLColor.forest)
            Text(message.isEmpty ? appState.t("All synced. Ready to capture.", "Tout synchronisé. Prêt à capturer.") : message)
                .font(ADLFont.inter(12, .semibold))
                .foregroundColor(ADLColor.forestDark)
            Spacer()
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(ADLColor.forest)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .background(ADLColor.forestWash)
    }
}

/// Custom bottom tab bar mirroring web Navigation.tsx (navy-wash active pill, terra Contribute).
struct ADLTabBar: View {
    let routes: [AppRoute]
    let selection: AppRoute
    let isAdmin: Bool
    let onSelect: (AppRoute) -> Void
    @EnvironmentObject private var appState: AppState

    var body: some View {
        let compact = routes.count >= 5
        HStack(alignment: .top, spacing: compact ? 2 : 4) {
            ForEach(routes) { route in
                let active = route == selection
                let isContribute = route == .contribute
                Button { onSelect(route) } label: {
                    VStack(spacing: compact ? 3 : 4) {
                        Image(systemName: icon(for: route))
                            .font(.system(size: compact ? 17 : 19, weight: .medium))
                        Text(title(for: route))
                            .font(ADLFont.inter(compact ? 10 : 11, .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .foregroundColor(active ? ADLColor.navy : (isContribute ? ADLColor.terracotta : Color(hex: 0x6b7280)))
                    .frame(maxWidth: .infinity, minHeight: compact ? 50 : 54)
                    .background(
                        RoundedRectangle(cornerRadius: compact ? 18 : 21, style: .continuous)
                            .fill(active ? ADLColor.navyWash : Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: compact ? 18 : 21, style: .continuous)
                            .stroke(active ? ADLColor.navy.opacity(0.06) : Color.clear, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, compact ? 8 : 12)
        .padding(.top, compact ? 6 : 8)
        .background(
            Color.white
                .overlay(Rectangle().fill(ADLColor.lineStrong).frame(height: 1), alignment: .top)
                .shadow(color: ADLColor.navy.opacity(0.1), radius: 16, x: 0, y: -8)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func title(for route: AppRoute) -> String {
        switch route {
        case .home:
            if isAdmin || appState.selectedRole == .client { return appState.t("Map", "Carte") }
            return appState.t("Explore", "Explorer")
        case .contribute: return appState.t("Contribute", "Contribuer")
        case .queue: return appState.t("Queue", "File")
        case .rewards: return appState.t("Rewards", "Récompenses")
        case .profile: return appState.t("Profile", "Profil")
        case .adminReview: return appState.t("Queue", "File")
        case .agentPerformance: return appState.t("Agents", "Agents")
        case .clientDashboard: return "Delta"
        case .investor: return appState.t("Dashboard", "Tableau")
        case .analytics:
            if isAdmin { return appState.t("Impact", "Impact") }
            if appState.selectedRole == .client { return appState.t("Insights", "Analyses") }
            return appState.t("Leaderboard", "Classement")
        }
    }

    private func icon(for route: AppRoute) -> String {
        switch route {
        case .home: return "map"
        case .contribute: return "plus.circle.fill"
        case .queue: return "tray.full"
        case .rewards: return "star.circle"
        case .profile: return "person"
        case .adminReview: return "checkmark.square"
        case .agentPerformance: return "person.2"
        case .clientDashboard: return "chart.bar"
        case .investor: return "square.grid.2x2"
        case .analytics:
            if isAdmin { return "chart.bar" }
            if appState.selectedRole == .client { return "chart.line.uptrend.xyaxis" }
            return "medal"
        }
    }
}

struct AgentHomeView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var locationProvider = LocationProvider()
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 4.0887, longitude: 9.7403),
        span: MKCoordinateSpan(latitudeDelta: 0.018, longitudeDelta: 0.018)
    )
    @State private var trackingMode: MKUserTrackingMode = .none
    @State private var selectedPoint: DataPoint?
    @State private var activeCategory: SubmissionCategory?

    private let collectionZone = [
        CLLocationCoordinate2D(latitude: 4.0933, longitude: 9.7342),
        CLLocationCoordinate2D(latitude: 4.0938, longitude: 9.7454),
        CLLocationCoordinate2D(latitude: 4.0858, longitude: 9.7472),
        CLLocationCoordinate2D(latitude: 4.0829, longitude: 9.7371)
    ]

    private var isAdminGlobalMap: Bool {
        appState.selectedRole == .admin
    }

    private var defaultRegion: MKCoordinateRegion {
        isAdminGlobalMap
            ? MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 4.2, longitude: 9.3),
                span: MKCoordinateSpan(latitudeDelta: 5.8, longitudeDelta: 5.8)
            )
            : MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 4.0887, longitude: 9.7403),
                span: MKCoordinateSpan(latitudeDelta: 0.018, longitudeDelta: 0.018)
            )
    }

    var body: some View {
        ZStack(alignment: .top) {
            FieldMapKitView(
                points: filteredPoints,
                collectionZone: collectionZone,
                region: $region,
                trackingMode: $trackingMode,
                selectedPoint: $selectedPoint
            )
            .ignoresSafeArea(edges: .bottom)
            .accessibilityLabel(appState.t("Apple Maps field map", "Carte terrain Apple Maps"))

            VStack(spacing: 12) {
                FieldMapHeader(
                    pointCount: filteredPoints.count,
                    refreshCount: filteredPoints.filter(\.requiresRefresh).count,
                    locationStatus: locationProvider.statusText,
                    activeCategory: activeCategory,
                    onSelectCategory: { category in
                        activeCategory = category
                        if let selectedPoint, let category, selectedPoint.category != category {
                            self.selectedPoint = nil
                        }
                    }
                )

                if !appState.isGuest {
                    DailyProgressWidget(goal: appState.dailyGoal)
                }

                if appState.isLoadingPoints {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text(appState.t("Loading backend points", "Chargement des points"))
                            .font(ADLFont.inter(12, .semibold))
                            .foregroundColor(ADLColor.navy)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Color.white)
                    .clipShape(Capsule())
                    .shadow(color: Color.black.opacity(0.08), radius: 8, y: 3)
                } else if let pointsError = appState.pointsError {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(ADLColor.terracotta)
                        Text(pointsError)
                            .font(ADLFont.inter(12, .semibold))
                            .foregroundColor(ADLColor.ink)
                            .lineLimit(2)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
                    .shadow(color: Color.black.opacity(0.08), radius: 8, y: 3)
                }

                HStack(spacing: 10) {
                    Button {
                        locationProvider.requestCurrentLocation()
                        trackingMode = .follow
                    } label: {
                        Image(systemName: "location.fill")
                            .frame(width: 46, height: 46)
                    }
                    .background(Color.white)
                    .foregroundColor(ADLColor.navy)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .shadow(color: .black.opacity(0.16), radius: 10, y: 4)
                    .accessibilityLabel(appState.t("Center on user location", "Centrer sur votre position"))

                    Button {
                        region = defaultRegion
                        trackingMode = .none
                    } label: {
                        Image(systemName: "scope")
                            .frame(width: 46, height: 46)
                    }
                    .background(Color.white)
                    .foregroundColor(ADLColor.navy)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .shadow(color: .black.opacity(0.16), radius: 10, y: 4)
                    .accessibilityLabel(isAdminGlobalMap
                                        ? appState.t("Recenter admin map", "Recentrer la carte admin")
                                        : appState.t("Recenter Bonamoussadi zone", "Recentrer la zone Bonamoussadi"))

                    Spacer()
                }

                Spacer()

                if !appState.isGuest {
                    FieldMapActionBar(
                        selectedPoint: selectedPoint,
                        onCaptureMapCenter: {
                            appState.startMapCapture(at: region.center)
                        },
                        onCaptureSelectedPoint: { point in
                            appState.startMapCapture(for: point)
                        }
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task {
            if !appState.isGuest {
                await appState.loadProfile()
            }
            if isAdminGlobalMap {
                region = defaultRegion
            }
            await appState.loadPoints()
        }
        .sheet(item: $selectedPoint) { point in
            PointDetailSheet(
                point: point,
                canContribute: !appState.isGuest,
                onCapture: {
                    selectedPoint = nil
                    appState.startMapCapture(for: point)
                },
                onCenter: {
                    region = MKCoordinateRegion(
                        center: point.location.coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.006, longitudeDelta: 0.006)
                    )
                    selectedPoint = nil
                }
            )
        }
    }

    private var filteredPoints: [DataPoint] {
        guard let activeCategory else { return appState.points }
        return appState.points.filter { $0.category == activeCategory }
    }
}

struct FieldMapKitView: UIViewRepresentable {
    let points: [DataPoint]
    let collectionZone: [CLLocationCoordinate2D]
    @Binding var region: MKCoordinateRegion
    @Binding var trackingMode: MKUserTrackingMode
    @Binding var selectedPoint: DataPoint?

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.mapType = .standard
        mapView.pointOfInterestFilter = .excludingAll
        mapView.showsCompass = true
        mapView.showsScale = true
        mapView.showsUserLocation = true
        mapView.setRegion(region, animated: false)

        // CARTO light_all basemap — matches web Home map tile layer
        let cartoTiles = MKTileOverlay(
            urlTemplate: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
        )
        cartoTiles.canReplaceMapContent = true
        mapView.addOverlay(cartoTiles, level: .aboveLabels)

        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.parent = self
        updateTrackingMode(on: mapView)

        if !mapView.region.isClose(to: region) {
            mapView.setRegion(region, animated: true)
        }

        let existingAnnotations = mapView.annotations.compactMap { $0 as? FieldPointAnnotation }
        let nextIds = Set(points.map(\.id))
        let staleAnnotations = existingAnnotations.filter { !nextIds.contains($0.point.id) }
        if !staleAnnotations.isEmpty {
            mapView.removeAnnotations(staleAnnotations)
        }

        let existingIds = Set(existingAnnotations.map { $0.point.id })
        let pointsById = Dictionary(points.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for annotation in existingAnnotations {
            if let nextPoint = pointsById[annotation.point.id], nextPoint != annotation.point {
                annotation.point = nextPoint
            }
        }
        let newAnnotations = points
            .filter { !existingIds.contains($0.id) }
            .map(FieldPointAnnotation.init(point:))
        if !newAnnotations.isEmpty {
            mapView.addAnnotations(newAnnotations)
        }

        // Geofence polygon intentionally not drawn (removed yellow zone outline).
        // Strip any stray polygon overlays while preserving the CARTO tile overlay.
        let polygonsToRemove = mapView.overlays.filter { $0 is MKPolygon }
        mapView.removeOverlays(polygonsToRemove)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    private func updateTrackingMode(on mapView: MKMapView) {
        if mapView.userTrackingMode != trackingMode {
            mapView.setUserTrackingMode(trackingMode, animated: true)
        }
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var parent: FieldMapKitView

        init(parent: FieldMapKitView) {
            self.parent = parent
        }

        func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
            DispatchQueue.main.async {
                self.parent.region = mapView.region
            }
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            guard let annotation = view.annotation as? FieldPointAnnotation else { return }
            DispatchQueue.main.async {
                self.parent.selectedPoint = annotation.point
            }
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let pointAnnotation = annotation as? FieldPointAnnotation else { return nil }

            let identifier = "field-point-dot-\(pointAnnotation.point.category.rawValue)"
            let dotView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? FieldPointAnnotationView
                ?? FieldPointAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            dotView.annotation = annotation
            return dotView
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let tileOverlay = overlay as? MKTileOverlay {
                return MKTileOverlayRenderer(tileOverlay: tileOverlay)
            }

            guard let polygon = overlay as? MKPolygon else {
                return MKOverlayRenderer(overlay: overlay)
            }

            let renderer = MKPolygonRenderer(polygon: polygon)
            renderer.fillColor = UIColor(ADLColor.forest).withAlphaComponent(0.13)
            renderer.strokeColor = UIColor(ADLColor.gold)
            renderer.lineWidth = 2
            renderer.lineDashPattern = [8, 5]
            return renderer
        }
    }
}

final class FieldPointAnnotationView: MKAnnotationView {
    private static let markerDiameter: CGFloat = 18
    private static let hitInset: CGFloat = -13

    override var annotation: MKAnnotation? {
        didSet { configure() }
    }

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        configureBase()
        configure()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        configureBase()
        configure()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = bounds.width / 2
        layer.shadowPath = UIBezierPath(ovalIn: bounds).cgPath
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        bounds.insetBy(dx: Self.hitInset, dy: Self.hitInset).contains(point)
    }

    private func configureBase() {
        bounds = CGRect(x: 0, y: 0, width: Self.markerDiameter, height: Self.markerDiameter)
        backgroundColor = .clear
        canShowCallout = false
        collisionMode = .circle
        layer.borderWidth = 2
        layer.borderColor = UIColor.white.cgColor
        layer.shadowColor = UIColor(ADLColor.navy).cgColor
        layer.shadowOpacity = 0.28
        layer.shadowRadius = 5
        layer.shadowOffset = CGSize(width: 0, height: 4)
        layer.masksToBounds = false
    }

    private func configure() {
        guard let pointAnnotation = annotation as? FieldPointAnnotation else { return }
        layer.backgroundColor = UIColor(pointAnnotation.point.category.tint).cgColor
        displayPriority = pointAnnotation.point.requiresRefresh ? .required : .defaultHigh
    }
}

final class FieldPointAnnotation: NSObject, MKAnnotation {
    var point: DataPoint

    var coordinate: CLLocationCoordinate2D {
        point.location.coordinate
    }

    var title: String? {
        point.name
    }

    var subtitle: String? {
        point.subtitle
    }

    init(point: DataPoint) {
        self.point = point
    }
}

private extension MKCoordinateRegion {
    func isClose(to other: MKCoordinateRegion) -> Bool {
        abs(center.latitude - other.center.latitude) < 0.000_08 &&
            abs(center.longitude - other.center.longitude) < 0.000_08 &&
            abs(span.latitudeDelta - other.span.latitudeDelta) < 0.000_08 &&
            abs(span.longitudeDelta - other.span.longitudeDelta) < 0.000_08
    }
}

struct FieldMapHeader: View {
    let pointCount: Int
    let refreshCount: Int
    let locationStatus: String
    let activeCategory: SubmissionCategory?
    let onSelectCategory: (SubmissionCategory?) -> Void
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(appState.selectedRole == .admin
                         ? appState.t("Worldwide admin map", "Carte admin mondiale")
                         : appState.t("Bonamoussadi field map", "Carte terrain Bonamoussadi"))
                        .font(ADLFont.inter(17, .bold))
                        .foregroundColor(ADLColor.ink)
                    Text(appState.selectedRole == .admin
                         ? appState.t("Global scope, reviewer context, and trusted points.", "Vue globale, contexte revue et points vérifiés.")
                         : appState.t("Collection zone, trusted points, and next captures.", "Zone de collecte, points vérifiés et prochaines captures."))
                        .font(ADLFont.inter(13, .medium))
                        .foregroundColor(.secondary)
                }
                Spacer()
                StatusPill(title: "Apple Maps", tint: ADLColor.forest)
            }

            HStack(spacing: 8) {
                StatusPill(title: appState.t("\(pointCount) points", "\(pointCount) points"), tint: ADLColor.navy)
                StatusPill(title: appState.t("\(refreshCount) refresh", "\(refreshCount) à actualiser"), tint: refreshCount > 0 ? ADLColor.terracotta : ADLColor.forest)
                StatusPill(title: locationStatus, tint: ADLColor.gold)
            }

            Menu {
                Button(appState.t("All verticals", "Toutes les catégories")) { onSelectCategory(nil) }
                ForEach(SubmissionCategory.allCases) { category in
                    Button(category.title) { onSelectCategory(category) }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: activeCategory?.systemImage ?? "square.grid.2x2")
                        .font(.system(size: 14, weight: .semibold))
                    Text(activeCategory?.title ?? appState.t("All verticals", "Toutes les catégories"))
                        .font(ADLFont.inter(13, .bold))
                        .lineLimit(1)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundColor(ADLColor.navy)
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(ADLColor.navyWash)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(Color.white.opacity(0.96))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.12), radius: 12, y: 5)
    }
}

struct FieldMapActionBar: View {
    let selectedPoint: DataPoint?
    let onCaptureMapCenter: () -> Void
    let onCaptureSelectedPoint: (DataPoint) -> Void
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let selectedPoint {
                HStack(spacing: 10) {
                    Image(systemName: selectedPoint.category.systemImage)
                        .foregroundColor(selectedPoint.category.tint)
                        .frame(width: 38, height: 38)
                        .background(selectedPoint.category.tint.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedPoint.name)
                            .font(ADLFont.inter(15, .semibold))
                            .foregroundColor(ADLColor.ink)
                        Text(selectedPoint.requiresRefresh ? appState.t("Ready for refresh capture", "Prêt pour une nouvelle capture") : appState.t("Verified point", "Point vérifié"))
                            .font(ADLFont.inter(12, .medium))
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }

                Button {
                    onCaptureSelectedPoint(selectedPoint)
                } label: {
                    Label(appState.t("Capture Selected Point", "Capturer le point sélectionné"), systemImage: "camera.fill")
                }
                .buttonStyle(PrimaryButtonStyle())
            } else {
                Button {
                    onCaptureMapCenter()
                } label: {
                    Label(appState.t("Capture Map Center", "Capturer le centre de la carte"), systemImage: "camera.viewfinder")
                }
                .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.97))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.18), radius: 14, y: 6)
    }
}

struct PointDetailSheet: View {
    let point: DataPoint
    let canContribute: Bool
    let onCapture: () -> Void
    let onCenter: () -> Void
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    // Staleness: web uses 7-day default threshold
    private var staleDays: Int {
        max(0, Calendar.current.dateComponents([.day], from: point.updatedAt, to: Date()).day ?? 0)
    }
    private var stalenessThreshold: Int { 7 }
    private var isStale: Bool { staleDays >= stalenessThreshold }
    private var staleTier: String {
        if !isStale { return "fresh" }
        if staleDays >= stalenessThreshold * 4 { return "critical" }
        if staleDays >= stalenessThreshold * 2 { return "warning" }
        return "stale"
    }
    private var staleXP: Int {
        staleTier == "critical" ? 25 : staleTier == "warning" ? 15 : 10
    }
    private var freshnessBg: Color {
        switch staleTier {
        case "critical": return Color(hex: 0xfee2e2)
        case "warning":  return ADLColor.amberWash
        case "stale":    return ADLColor.goldWash
        default:         return ADLColor.forestWash
        }
    }
    private var freshnessFg: Color {
        switch staleTier {
        case "critical": return ADLColor.danger
        case "warning":  return ADLColor.amber
        case "stale":    return ADLColor.terracotta
        default:         return ADLColor.forestDark
        }
    }
    private var freshnessLabel: String {
        if isStale {
            return appState.t("\(staleDays)d old", "\(staleDays)j")
        }
        return appState.t("Recently verified", "Vérifié récemment")
    }
    private var freshnessCaption: String {
        if isStale {
            return appState.t("Needs a fresh field check", "Demande une nouvelle vérification")
        }
        return appState.t("Recently verified on the ground", "Récemment vérifié sur le terrain")
    }
    private var primaryCtaLabel: String {
        if !canContribute {
            return appState.t("Sign in to contribute", "Connectez-vous pour contribuer")
        }
        if point.requiresRefresh {
            return appState.t("Complete this point · +15 XP", "Compléter · +15 XP")
        }
        return appState.t("Update this point · +15 XP", "Mettre à jour · +15 XP")
    }

    var body: some View {
        NavigationView {
            ZStack(alignment: .bottom) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Gold→terra accent stripe (web: mx-4 h-1 gradient from-gold to-terra)
                        LinearGradient(
                            colors: [ADLColor.gold, ADLColor.terracotta.opacity(0.70)],
                            startPoint: .leading, endPoint: .trailing
                        )
                        .frame(height: 4)
                        .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))

                        // Photo
                        pointPhoto

                        // Name + category chips card (web: card-soft)
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(point.name)
                                        .font(ADLFont.inter(18, .bold))
                                        .foregroundColor(ADLColor.ink)
                                        .fixedSize(horizontal: false, vertical: true)
                                    HStack(spacing: 6) {
                                        ADLPill(
                                            text: point.category.title,
                                            bg: point.category.tint.opacity(0.15),
                                            fg: point.category.tint
                                        )
                                        if point.trustScore >= 85 {
                                            ADLPill(
                                                text: appState.t("Verified", "Vérifié"),
                                                bg: ADLColor.forestWash,
                                                fg: ADLColor.forestDark
                                            )
                                        }
                                    }
                                }
                                Spacer()
                                // Availability badge: derived from requiresRefresh
                                ADLPill(
                                    text: point.requiresRefresh
                                        ? appState.t("Needs Refresh", "À actualiser")
                                        : appState.t("Current", "À jour"),
                                    bg: point.requiresRefresh ? ADLColor.terraWash : ADLColor.forestWash,
                                    fg: point.requiresRefresh ? ADLColor.terracotta : ADLColor.forestDark
                                )
                            }

                            // Info rows (web: <dl> with label/value pairs)
                            Divider()
                            VStack(spacing: 0) {
                                detailInfoRow(
                                    label: appState.t("Last updated", "Dernière mise à jour"),
                                    value: point.updatedAt.formatted(date: .abbreviated, time: .omitted)
                                )
                                Divider().padding(.vertical, 8)
                                detailInfoRow(
                                    label: appState.t("Trust score", "Score de confiance"),
                                    value: "\(point.trustScore) / 100"
                                )
                                Divider().padding(.vertical, 8)
                                detailInfoRow(
                                    label: appState.t("Events captured", "Événements capturés"),
                                    value: "\(point.eventsCount)"
                                )
                            }
                        }
                        .padding(16)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(ADLColor.line, lineWidth: 1)
                        )

                        // Missing info section — terra wash, matching web's rounded-[28px]
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text(appState.t("Missing info", "Infos manquantes").uppercased())
                                    .font(ADLFont.inter(11, .bold))
                                    .tracking(2.0)
                                    .foregroundColor(ADLColor.terracotta.opacity(0.70))
                                Spacer()
                                if isStale {
                                    Text("+\(staleXP) XP")
                                        .font(ADLFont.inter(12, .bold))
                                        .tracking(1.4)
                                        .foregroundColor(ADLColor.terracotta)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 4)
                                        .background(Color.white)
                                        .clipShape(Capsule())
                                }
                            }
                            Text(point.subtitle.isEmpty
                                 ? appState.t(
                                    "No missing fields. You can still update this point.",
                                    "Aucun champ manquant. Vous pouvez quand même le mettre à jour."
                                 )
                                 : point.subtitle)
                                .font(ADLFont.inter(14))
                                .foregroundColor(ADLColor.terracotta.opacity(0.85))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(20)
                        .background(ADLColor.terraWash)
                        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 28, style: .continuous)
                                .stroke(ADLColor.terracotta.opacity(0.10), lineWidth: 1)
                        )

                        // GPS card
                        HStack(spacing: 12) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(ADLColor.navy)
                                .frame(width: 40, height: 40)
                                .background(ADLColor.navyWash)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(appState.t("GPS Validated", "GPS validé"))
                                    .font(ADLFont.inter(13, .semibold))
                                    .foregroundColor(ADLColor.ink)
                                let lat = point.location.latitude
                                let lng = point.location.longitude
                                let accuracy = point.location.accuracyMeters.map { Int($0) } ?? 5
                                Text("\(String(format: "%.4f", abs(lat)))°\(lat >= 0 ? "N" : "S"), \(String(format: "%.4f", abs(lng)))°\(lng >= 0 ? "E" : "W") · ±\(accuracy)m")
                                    .font(ADLFont.inter(11))
                                    .foregroundColor(Color(hex: 0x9ca3af))
                            }
                            Spacer()
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(ADLColor.forest)
                        }
                        .padding(14)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(ADLColor.line, lineWidth: 1)
                        )

                        // Trust score + Freshness grid (2 cols)
                        HStack(spacing: 12) {
                            // Trust score tile
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(spacing: 6) {
                                    Image(systemName: "shield.checkered")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(Color(hex: 0x9ca3af))
                                    Text(appState.t("Trust score", "Score de confiance").uppercased())
                                        .font(ADLFont.inter(11, .bold))
                                        .tracking(1.6)
                                        .foregroundColor(Color(hex: 0x9ca3af))
                                }
                                Text("\(point.trustScore)%")
                                    .font(ADLFont.inter(24, .bold))
                                    .foregroundColor(ADLColor.ink)
                                Text(appState.t("Community confidence", "Confiance de la communauté"))
                                    .font(ADLFont.inter(12))
                                    .foregroundColor(Color(hex: 0x6b7280))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(ADLColor.line, lineWidth: 1)
                            )

                            // Freshness tile — tinted like web
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(spacing: 6) {
                                    Image(systemName: isStale ? "arrow.clockwise" : "clock")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(freshnessFg)
                                    Text(appState.t("Freshness", "Fraîcheur").uppercased())
                                        .font(ADLFont.inter(11, .bold))
                                        .tracking(1.6)
                                        .foregroundColor(freshnessFg)
                                }
                                Text(freshnessLabel)
                                    .font(ADLFont.inter(20, .bold))
                                    .foregroundColor(ADLColor.ink)
                                Text(freshnessCaption)
                                    .font(ADLFont.inter(12))
                                    .foregroundColor(Color(hex: 0x6b7280))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(freshnessBg)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(freshnessFg.opacity(0.20), lineWidth: 1)
                            )
                        }

                        // Critical staleness alert (web: border-danger/20 bg-red-50)
                        if staleTier == "critical" {
                            HStack(spacing: 12) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(ADLColor.danger)
                                Text(appState.t(
                                    "Critical: this data may be inaccurate. Re-verify it before relying on it.",
                                    "Critique : ces données peuvent être inexactes. Revalidez-les avant de vous y fier."
                                ))
                                .font(ADLFont.inter(14, .semibold))
                                .foregroundColor(ADLColor.danger)
                                .fixedSize(horizontal: false, vertical: true)
                            }
                            .padding(16)
                            .background(Color(hex: 0xfee2e2))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(ADLColor.danger.opacity(0.20), lineWidth: 1)
                            )
                        }

                        // Bottom padding so content clears the fixed CTAs
                        Color.clear.frame(height: 120)
                    }
                    .padding(16)
                }

                // Fixed CTAs at bottom matching web's btn-cta / btn-ghost
                VStack(spacing: 10) {
                    Button {
                        dismiss()
                        onCapture()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "shield.checkered")
                                .font(.system(size: 18, weight: .semibold))
                            Text(primaryCtaLabel)
                                .font(ADLFont.inter(15, .semibold))
                        }
                        .frame(maxWidth: .infinity, minHeight: 56)
                    }
                    .background(ADLColor.terracotta)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Button {
                        dismiss()
                        onCenter()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "plus.circle")
                                .font(.system(size: 18, weight: .semibold))
                            Text(appState.t("Add a new point", "Ajouter un nouveau point"))
                                .font(ADLFont.inter(15, .semibold))
                        }
                        .frame(maxWidth: .infinity, minHeight: 56)
                    }
                    .background(Color.white)
                    .foregroundColor(ADLColor.ink)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(ADLColor.lineStrong, lineWidth: 1)
                    )
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .padding(.top, 8)
                .background(.ultraThinMaterial)
            }
            .background(ADLColor.paper.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(appState.t("Close", "Fermer")) { dismiss() }
                        .font(ADLFont.inter(14, .semibold))
                        .foregroundColor(ADLColor.navy)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    ADLPill(text: point.category.title, bg: ADLColor.navyWash, fg: ADLColor.navy)
                }
            }
        }
    }

    @ViewBuilder
    private func detailInfoRow(label: String, value: String) -> some View {
        HStack(alignment: .center) {
            Text(label)
                .font(ADLFont.inter(12, .medium))
                .foregroundColor(Color(hex: 0x9ca3af))
            Spacer()
            Text(value)
                .font(ADLFont.inter(13, .semibold))
                .foregroundColor(ADLColor.ink)
                .multilineTextAlignment(.trailing)
        }
    }

    @ViewBuilder
    private var pointPhoto: some View {
        if let url = resolvedPhotoURL {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    photoPlaceholder
                case .empty:
                    ZStack {
                        photoPlaceholder
                        ProgressView()
                    }
                @unknown default:
                    photoPlaceholder
                }
            }
            .frame(height: 200)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        } else {
            photoPlaceholder
        }
    }

    private var resolvedPhotoURL: URL? {
        guard let raw = point.photoUrl?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        if let absolute = URL(string: raw), absolute.scheme != nil {
            return absolute
        }
        let base = ProcessInfo.processInfo.environment["ADL_API_BASE"] ?? "https://www.app.africandatalayer.com"
        return URL(string: raw.hasPrefix("/") ? "\(base)\(raw)" : "\(base)/\(raw)")
    }

    private var photoPlaceholder: some View {
        VStack(spacing: 8) {
            Image(systemName: "camera.fill")
                .font(.system(size: 36, weight: .semibold))
                .foregroundColor(Color(hex: 0x9ca3af))
            Text(appState.t("Field photo", "Photo terrain"))
                .font(ADLFont.inter(12, .medium))
                .foregroundColor(Color(hex: 0x9ca3af))
        }
        .frame(height: 200)
        .frame(maxWidth: .infinity)
        .background(ADLColor.paper)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(ADLColor.lineStrong, lineWidth: 1)
        )
    }
}

struct DetailRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .font(ADLFont.inter(13, .medium))
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(ADLFont.inter(13, .semibold))
                .foregroundColor(ADLColor.ink)
        }
    }
}

struct ContributionView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var locationProvider = LocationProvider()
    @State private var category: SubmissionCategory = .pharmacy
    @State private var siteName = ""
    @State private var roadName = ""
    @State private var notes = ""
    @State private var openingHours = ""
    @State private var isOpenNow = true
    @State private var isOnDuty = false
    @State private var providerText = "Orange Money, MTN MoMo"
    @State private var merchantId = ""
    @State private var paymentMethodsText = "Cash, Mobile Money"
    @State private var hasFuelAvailable = true
    @State private var fuelTypesText = "Super, Gasoil"
    @State private var fuelPriceText = ""
    @State private var quality = "Standard"
    @State private var outletType = "Bar"
    @State private var isFormal = true
    @State private var billboardType = "Standard"
    @State private var isOccupied = true
    @State private var advertiserBrand = ""
    @State private var roadCondition = "Good"
    @State private var roadSurface = "Asphalt"
    @State private var roadBlocked = false
    @State private var blockageType = "Flooding"
    @State private var buildingType = "Residential"
    @State private var occupancyStatus = "Occupied"
    @State private var storeyCount = ""
    @State private var estimatedUnits = ""
    @State private var consentStatus: ConsentStatus = .notRequired
    @State private var capturedImage: UIImage?
    @State private var showingCamera = false
    @State private var validationMessage: String?
    @State private var mapPointId: String?
    // Step machine: 0=category, 1=photo, 2=location, 3=fields, 4=review
    @State private var currentStep: Int = 0

    private let totalSteps = 5

    var body: some View {
        Group {
            if appState.isGuest {
                Color.clear
                    .onAppear { appState.requestAuth() }
            } else {
                contributionForm
            }
        }
    }

    // MARK: - Step progress indicator (dots)
    private var stepProgressBar: some View {
        HStack(spacing: 6) {
            ForEach(0..<totalSteps, id: \.self) { idx in
                if idx < currentStep {
                    // Completed step: filled terra pill
                    Capsule()
                        .fill(ADLColor.terracotta)
                        .frame(width: 20, height: 4)
                } else if idx == currentStep {
                    // Active step: wide navy pill
                    Capsule()
                        .fill(ADLColor.navy)
                        .frame(width: 28, height: 4)
                } else {
                    // Future step: gray dot
                    Capsule()
                        .fill(ADLColor.lineStrong)
                        .frame(width: 12, height: 4)
                }
            }
            Spacer()
            Text(appState.t("Step \(currentStep + 1) of \(totalSteps)", "Étape \(currentStep + 1) sur \(totalSteps)"))
                .font(ADLFont.inter(11, .semibold))
                .foregroundColor(ADLColor.inkMuted)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .animation(.easeInOut(duration: 0.2), value: currentStep)
    }

    // MARK: - Main form shell
    private var contributionForm: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(
                title: appState.t("Capture", "Capture"),
                subtitle: stepSubtitle,
                onBack: currentStep > 0 ? { currentStep -= 1 } : nil
            )
            stepProgressBar
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Group {
                        switch currentStep {
                        case 0: step0CategoryPicker
                        case 1: step1Photo
                        case 2: step2Location
                        case 3: step3Fields
                        default: step4Review
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
                }
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .sheet(isPresented: $showingCamera) {
            CameraPicker(image: $capturedImage)
        }
        .onAppear {
            applyMapCaptureContextIfNeeded()
        }
    }

    private var stepSubtitle: String {
        switch currentStep {
        case 0: return appState.t("Choose category", "Choisir la catégorie")
        case 1: return appState.t("Capture photo", "Capturer la photo")
        case 2: return appState.t("Confirm location", "Confirmer la position")
        case 3: return appState.t("Required fields", "Champs requis")
        default: return appState.t("Review & submit", "Vérifier et envoyer")
        }
    }

    // MARK: - Step 0: Category / Vertical Picker
    private var step0CategoryPicker: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel(text: appState.t("Category", "Catégorie"), wide: true)
            VerticalPickerBar(
                categories: SubmissionCategory.allCases,
                selected: $category
            )
            // Selected category description card
            ADLCard {
                HStack(spacing: 14) {
                    Image(systemName: category.systemImage)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 48, height: 48)
                        .background(category.tint)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(category.title)
                            .font(ADLFont.inter(16, .bold))
                            .foregroundColor(ADLColor.ink)
                        let fields = VerticalConfig.all[category]?.requiredFields ?? []
                        Text(appState.t("Required: \(fields.joined(separator: ", "))",
                                        "Requis : \(fields.joined(separator: ", "))"))
                            .font(ADLFont.inter(12))
                            .foregroundColor(ADLColor.inkMuted)
                            .lineLimit(2)
                    }
                    Spacer()
                }
            }
            // Notes field
            VStack(alignment: .leading, spacing: 6) {
                SectionLabel(text: appState.t("Notes (optional)", "Notes (optionnel)"))
                ZStack(alignment: .topLeading) {
                    if notes.isEmpty {
                        Text(appState.t("Add any observations...", "Ajoutez vos observations..."))
                            .font(ADLFont.inter(15))
                            .foregroundColor(ADLColor.inkMuted.opacity(0.5))
                            .padding(.top, 12)
                            .padding(.leading, 4)
                    }
                    TextEditor(text: $notes)
                        .font(ADLFont.inter(15))
                        .frame(minHeight: 88)
                        .scrollContentBackground(.hidden)
                }
                .padding(12)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(ADLColor.lineStrong, lineWidth: 1)
                )
            }
            Button {
                currentStep = 1
            } label: {
                HStack {
                    Text(appState.t("Continue", "Continuer"))
                    Image(systemName: "arrow.right")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }

    // MARK: - Step 1: Photo Capture
    private var step1Photo: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel(text: appState.t("Step 1 — Capture photo", "Étape 1 — Capturer la photo"), wide: true)
            // Capture surface
            Button {
                showingCamera = true
            } label: {
                ZStack {
                    if let img = capturedImage {
                        Image(uiImage: img)
                            .resizable()
                            .scaledToFill()
                            .frame(maxWidth: .infinity, minHeight: 220)
                            .clipped()
                            .overlay(
                                LinearGradient(
                                    colors: [Color.black.opacity(0), Color.black.opacity(0.38)],
                                    startPoint: .top, endPoint: .bottom
                                )
                            )
                        // Captured checkmark overlay
                        VStack(spacing: 6) {
                            Spacer()
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 20, weight: .semibold))
                                    .foregroundColor(ADLColor.terracotta)
                                Text(appState.t("Photo captured — tap to retake", "Photo capturée — appuyez pour reprendre"))
                                    .font(ADLFont.inter(12, .semibold))
                                    .foregroundColor(.white)
                            }
                            .padding(.bottom, 12)
                        }
                    } else {
                        VStack(spacing: 12) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 36, weight: .medium))
                                .foregroundColor(Color(hex: 0x6b7280))
                            Text(appState.t("Tap to capture", "Appuyez pour capturer"))
                                .font(ADLFont.inter(14, .semibold))
                                .foregroundColor(Color(hex: 0x4b5563))
                            Text(appState.t("Photo required for verification", "Photo requise pour vérification"))
                                .font(ADLFont.inter(11))
                                .foregroundColor(Color(hex: 0x9ca3af))
                        }
                        .frame(maxWidth: .infinity, minHeight: 220)
                        .background(ADLColor.line)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(capturedImage != nil ? ADLColor.terracotta : ADLColor.lineStrong,
                            style: StrokeStyle(lineWidth: 2, dash: capturedImage != nil ? [] : [6, 4]))
            )
            .buttonStyle(.plain)
            // Camera-only note
            Text(capturedImage != nil
                ? appState.t("Tap to retake if the frame changed.", "Appuyez pour reprendre si le cadrage a changé.")
                : appState.t("Camera capture only. Gallery uploads are blocked.", "Capture caméra uniquement. Import galerie bloqué."))
                .font(ADLFont.inter(11, .medium))
                .foregroundColor(Color(hex: 0x6b7280))
            // GPS status mini-card
            ADLCard {
                HStack(spacing: 12) {
                    Image(systemName: locationProvider.lastLocation != nil ? "checkmark.circle.fill" : "mappin.circle")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(locationProvider.lastLocation != nil ? ADLColor.forest : Color(hex: 0x6b7280))
                        .frame(width: 32, height: 32)
                        .background(locationProvider.lastLocation != nil ? ADLColor.forestWash : ADLColor.line)
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(locationProvider.lastLocation != nil
                             ? appState.t("GPS locked", "GPS verrouillé")
                             : appState.t("Waiting for GPS lock", "En attente du GPS"))
                            .font(ADLFont.inter(13, .bold))
                            .foregroundColor(ADLColor.ink)
                        if let loc = locationProvider.lastLocation {
                            Text(String(format: "%.4f°, %.4f°%@", loc.latitude, loc.longitude,
                                        loc.accuracyMeters.map { " · ±\(Int($0))m" } ?? ""))
                                .font(ADLFont.inter(11))
                                .foregroundColor(ADLColor.inkMuted)
                        } else {
                            Text(appState.t("Tap GPS on next step to capture location", "GPS capturé à l'étape suivante"))
                                .font(ADLFont.inter(11))
                                .foregroundColor(ADLColor.inkMuted)
                        }
                    }
                    Spacer()
                }
            }
            if let validationMessage {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(ADLColor.terracotta)
                    Text(validationMessage)
                        .font(ADLFont.inter(12, .semibold))
                        .foregroundColor(ADLColor.terracotta)
                }
                .padding(12)
                .background(ADLColor.terraWash)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            Button {
                if capturedImage == nil {
                    validationMessage = appState.t("Please capture a photo before continuing.", "Veuillez capturer une photo avant de continuer.")
                } else {
                    validationMessage = nil
                    currentStep = 2
                }
            } label: {
                HStack {
                    Text(appState.t("Continue", "Continuer"))
                    Image(systemName: "arrow.right")
                }
            }
            .buttonStyle(CTAButtonStyle())
        }
    }

    // MARK: - Step 2: GPS / Location
    private var step2Location: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel(text: appState.t("Step 3 — Confirm location", "Étape 3 — Confirmer la position"), wide: true)
            // Location card
            ADLCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 12) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(locationProvider.lastLocation != nil ? ADLColor.forest : ADLColor.inkMuted)
                            .frame(width: 36, height: 36)
                            .background(locationProvider.lastLocation != nil ? ADLColor.forestWash : ADLColor.line)
                            .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 3) {
                            Text(locationProvider.lastLocation != nil
                                 ? appState.t("GPS locked", "GPS verrouillé")
                                 : appState.t("GPS pending", "GPS en attente"))
                                .font(ADLFont.inter(14, .bold))
                                .foregroundColor(ADLColor.ink)
                            Text(locationProvider.statusText)
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.inkMuted)
                        }
                        Spacer()
                    }
                    if let loc = locationProvider.lastLocation {
                        // Coordinate display strip
                        HStack(spacing: 0) {
                            coordChip(label: "LAT", value: String(format: "%.5f°", loc.latitude))
                            Divider().frame(height: 28).padding(.horizontal, 8)
                            coordChip(label: "LNG", value: String(format: "%.5f°", loc.longitude))
                            if let acc = loc.accuracyMeters {
                                Divider().frame(height: 28).padding(.horizontal, 8)
                                coordChip(label: appState.t("ACC", "PRÉC"), value: "±\(Int(acc))m")
                            }
                        }
                        .padding(10)
                        .background(ADLColor.navyWash)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
            }
            // Capture GPS button
            Button {
                locationProvider.requestCurrentLocation()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "location.fill")
                    Text(locationProvider.lastLocation != nil
                         ? appState.t("Refresh GPS", "Actualiser le GPS")
                         : appState.t("Capture GPS", "Capturer le GPS"))
                }
            }
            .buttonStyle(SecondaryButtonStyle())
            if let validationMessage {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(ADLColor.terracotta)
                    Text(validationMessage)
                        .font(ADLFont.inter(12, .semibold))
                        .foregroundColor(ADLColor.terracotta)
                }
                .padding(12)
                .background(ADLColor.terraWash)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            Button {
                if locationProvider.lastLocation == nil {
                    validationMessage = appState.t("Capture GPS before continuing.", "Capturez le GPS avant de continuer.")
                } else {
                    validationMessage = nil
                    currentStep = 3
                }
            } label: {
                HStack {
                    Text(appState.t("Continue", "Continuer"))
                    Image(systemName: "arrow.right")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }

    private func coordChip(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(ADLFont.inter(9, .bold))
                .tracking(1.4)
                .foregroundColor(ADLColor.navy)
            Text(value)
                .font(ADLFont.inter(12, .bold))
                .foregroundColor(ADLColor.ink)
        }
    }

    // MARK: - Step 3: Required Fields
    private var step3Fields: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel(text: appState.t("Step 2 — \(category.title) details", "Étape 2 — Détails \(category.title)"), wide: true)
            RequiredFieldsView(category: category)
            detailsFieldsStyled
            // Consent picker
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: appState.t("Consent & Privacy", "Consentement et confidentialité"))
                ForEach(ConsentStatus.allCases) { status in
                    let isActive = consentStatus == status
                    Button {
                        consentStatus = status
                    } label: {
                        HStack {
                            Text(status.title)
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(isActive ? ADLColor.navy : ADLColor.inkMuted)
                            Spacer()
                            if isActive {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(ADLColor.navy)
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(isActive ? ADLColor.navyWash : Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(isActive ? ADLColor.navyBorder : ADLColor.lineStrong, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            if let validationMessage {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(ADLColor.terracotta)
                    Text(validationMessage)
                        .font(ADLFont.inter(12, .semibold))
                        .foregroundColor(ADLColor.terracotta)
                }
                .padding(12)
                .background(ADLColor.terraWash)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            Button {
                // Validate required field presence before moving to review
                if let msg = validateRequiredFields() {
                    validationMessage = msg
                } else {
                    validationMessage = nil
                    currentStep = 4
                }
            } label: {
                HStack {
                    Text(appState.t("Review", "Vérifier"))
                    Image(systemName: "arrow.right")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }

    // Validate required fields for current category; returns error string or nil
    private func validateRequiredFields() -> String? {
        switch category {
        case .pharmacy:
            if trimmed(siteName).isEmpty {
                return appState.t("Pharmacy name is required.", "Le nom de la pharmacie est requis.")
            }
        case .mobileMoney:
            if csv(providerText).isEmpty {
                return appState.t("Select at least one provider.", "Sélectionnez au moins un opérateur.")
            }
        case .fuelStation:
            if trimmed(siteName).isEmpty {
                return appState.t("Fuel station name is required.", "Le nom de la station-service est requis.")
            }
        case .alcoholOutlet:
            if trimmed(siteName).isEmpty {
                return appState.t("Alcohol outlet name is required.", "Le nom du point de vente est requis.")
            }
        case .billboard:
            if trimmed(siteName).isEmpty {
                return appState.t("Billboard name is required.", "Le nom du panneau est requis.")
            }
        case .transportRoad:
            if trimmed(roadName).isEmpty {
                return appState.t("Road segment name is required.", "Le nom du segment routier est requis.")
            }
        case .censusProxy:
            if trimmed(buildingType).isEmpty {
                return appState.t("Building type is required.", "Le type de bâtiment est requis.")
            }
        }
        return nil
    }

    // MARK: - Styled fields (replaces old detailsFields)
    @ViewBuilder
    private var detailsFieldsStyled: some View {
        switch category {
        case .pharmacy:
            styledField(label: appState.t("Pharmacy name", "Nom de la pharmacie"),
                        placeholder: appState.t("Enter pharmacy name", "Nom de la pharmacie"),
                        text: $siteName)
            yesNoToggle(label: appState.t("Open now", "Ouvert maintenant"), value: $isOpenNow)
            yesNoToggle(label: appState.t("On duty", "De garde"), value: $isOnDuty)
            styledField(label: appState.t("Opening hours", "Heures d'ouverture"),
                        placeholder: appState.t("e.g. 08:00–20:00", "ex. 08:00–20:00"),
                        text: $openingHours)
        case .mobileMoney:
            styledField(label: appState.t("Providers", "Opérateurs"),
                        placeholder: "Orange Money, MTN MoMo",
                        text: $providerText)
            styledField(label: appState.t("Merchant ID", "ID marchand"),
                        placeholder: "MID-XXXX",
                        text: $merchantId)
            styledField(label: appState.t("Payment methods", "Méthodes de paiement"),
                        placeholder: appState.t("Cash, Mobile Money", "Espèces, Mobile Money"),
                        text: $paymentMethodsText)
            styledField(label: appState.t("Opening hours", "Heures d'ouverture"),
                        placeholder: appState.t("e.g. 08:00–20:00", "ex. 08:00–20:00"),
                        text: $openingHours)
        case .fuelStation:
            styledField(label: appState.t("Station name", "Nom de la station"),
                        placeholder: appState.t("Enter station name", "Nom de la station"),
                        text: $siteName)
            yesNoToggle(label: appState.t("Fuel available", "Carburant disponible"), value: $hasFuelAvailable)
            styledField(label: appState.t("Fuel types", "Types de carburant"),
                        placeholder: "Super, Gasoil",
                        text: $fuelTypesText)
            styledField(label: appState.t("Super price (FCFA)", "Prix Super (FCFA)"),
                        placeholder: "e.g. 730",
                        text: $fuelPriceText,
                        keyboardType: .decimalPad)
            styledField(label: appState.t("Quality", "Qualité"),
                        placeholder: "Standard",
                        text: $quality)
        case .alcoholOutlet:
            styledField(label: appState.t("Outlet name", "Nom du point de vente"),
                        placeholder: appState.t("Enter outlet name", "Nom du point de vente"),
                        text: $siteName)
            styledField(label: appState.t("Outlet type", "Type de point de vente"),
                        placeholder: "Bar, Restaurant…",
                        text: $outletType)
            yesNoToggle(label: appState.t("Formal outlet", "Point de vente formel"), value: $isFormal)
            styledField(label: appState.t("Payment methods", "Méthodes de paiement"),
                        placeholder: appState.t("Cash, Mobile Money", "Espèces, Mobile Money"),
                        text: $paymentMethodsText)
        case .billboard:
            styledField(label: appState.t("Billboard name", "Nom du panneau"),
                        placeholder: appState.t("Enter billboard name", "Nom du panneau"),
                        text: $siteName)
            styledField(label: appState.t("Billboard type", "Type de panneau"),
                        placeholder: "Standard, Digital…",
                        text: $billboardType)
            yesNoToggle(label: appState.t("Occupied", "Occupé"), value: $isOccupied)
            styledField(label: appState.t("Advertiser brand", "Marque annonceur"),
                        placeholder: appState.t("Brand name (optional)", "Nom de la marque (optionnel)"),
                        text: $advertiserBrand)
        case .transportRoad:
            styledField(label: appState.t("Road name", "Nom de la route"),
                        placeholder: appState.t("Enter road name", "Nom de la route"),
                        text: $roadName)
            styledField(label: appState.t("Condition", "État"),
                        placeholder: "Good, Fair, Poor…",
                        text: $roadCondition)
            styledField(label: appState.t("Surface type", "Type de surface"),
                        placeholder: "Asphalt, Gravel…",
                        text: $roadSurface)
            yesNoToggle(label: appState.t("Road blocked", "Route bloquée"), value: $roadBlocked)
            if roadBlocked {
                styledField(label: appState.t("Blockage type", "Type de blocage"),
                            placeholder: "Flooding, Construction…",
                            text: $blockageType)
            }
        case .censusProxy:
            styledField(label: appState.t("Building type", "Type de bâtiment"),
                        placeholder: "Residential, Commercial…",
                        text: $buildingType)
            styledField(label: appState.t("Occupancy status", "Statut d'occupation"),
                        placeholder: "Occupied, Vacant…",
                        text: $occupancyStatus)
            styledField(label: appState.t("Storey count", "Nombre d'étages"),
                        placeholder: "e.g. 3",
                        text: $storeyCount,
                        keyboardType: .numberPad)
            styledField(label: appState.t("Estimated units", "Unités estimées"),
                        placeholder: "e.g. 12",
                        text: $estimatedUnits,
                        keyboardType: .numberPad)
        }
    }

    // Reusable styled text field (web: h-12 rounded-xl border-gray-200)
    private func styledField(label: String, placeholder: String, text: Binding<String>,
                             keyboardType: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(ADLFont.inter(12, .semibold))
                .foregroundColor(Color(hex: 0x374151))
            TextField(placeholder, text: text)
                .font(ADLFont.inter(15))
                .keyboardType(keyboardType)
                .autocorrectionDisabled()
                .frame(height: 48)
                .padding(.horizontal, 14)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(ADLColor.lineStrong, lineWidth: 1)
                )
        }
    }

    // Yes/No toggle buttons (web: min-h-[44px] navy active / gray-200 inactive)
    private func yesNoToggle(label: String, value: Binding<Bool>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(ADLFont.inter(12, .semibold))
                .foregroundColor(Color(hex: 0x374151))
            HStack(spacing: 8) {
                Button {
                    value.wrappedValue = true
                } label: {
                    Text(appState.t("Yes", "Oui"))
                        .font(ADLFont.inter(13, .semibold))
                        .foregroundColor(value.wrappedValue ? .white : ADLColor.inkMuted)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(value.wrappedValue ? ADLColor.navy : Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(value.wrappedValue ? ADLColor.navy : ADLColor.lineStrong, lineWidth: 1.5)
                        )
                }
                .buttonStyle(.plain)
                Button {
                    value.wrappedValue = false
                } label: {
                    Text(appState.t("No", "Non"))
                        .font(ADLFont.inter(13, .semibold))
                        .foregroundColor(!value.wrappedValue ? .white : ADLColor.inkMuted)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(!value.wrappedValue ? ADLColor.navy : Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(!value.wrappedValue ? ADLColor.navy : ADLColor.lineStrong, lineWidth: 1.5)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Step 4: Review & Submit
    private var step4Review: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel(text: appState.t("Review & Submit", "Vérifier et envoyer"), wide: true)
            // Summary card
            ADLCard {
                VStack(alignment: .leading, spacing: 14) {
                    // Category + title row
                    HStack(spacing: 12) {
                        Image(systemName: category.systemImage)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 40, height: 40)
                            .background(category.tint)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(displayTitle)
                                .font(ADLFont.inter(15, .bold))
                                .foregroundColor(ADLColor.ink)
                            Text(category.title)
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.inkMuted)
                        }
                        Spacer()
                    }
                    Divider()
                    // Evidence checklist
                    reviewRow(icon: "camera.fill",
                              label: appState.t("Photo", "Photo"),
                              value: capturedImage != nil ? appState.t("Captured", "Capturée") : appState.t("Missing", "Manquante"),
                              pass: capturedImage != nil)
                    reviewRow(icon: "location.fill",
                              label: appState.t("GPS", "GPS"),
                              value: locationProvider.lastLocation.map {
                                  String(format: "%.4f°, %.4f°", $0.latitude, $0.longitude)
                              } ?? appState.t("Not captured", "Non capturé"),
                              pass: locationProvider.lastLocation != nil)
                    reviewRow(icon: "doc.text.fill",
                              label: appState.t("Consent", "Consentement"),
                              value: consentStatus.title,
                              pass: true)
                    if !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        reviewRow(icon: "note.text",
                                  label: appState.t("Notes", "Notes"),
                                  value: notes.trimmingCharacters(in: .whitespacesAndNewlines),
                                  pass: true)
                    }
                }
            }
            // XP teaser
            HStack(spacing: 10) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(ADLColor.gold)
                Text(appState.t("Earn XP for this capture", "Gagnez des XP pour cette capture"))
                    .font(ADLFont.inter(13, .semibold))
                    .foregroundColor(ADLColor.ink)
                Spacer()
                Text("+XP")
                    .font(ADLFont.inter(14, .bold))
                    .foregroundColor(ADLColor.forest)
            }
            .padding(12)
            .background(ADLColor.forestWash)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            if let validationMessage {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(ADLColor.terracotta)
                    Text(validationMessage)
                        .font(ADLFont.inter(12, .semibold))
                        .foregroundColor(ADLColor.terracotta)
                }
                .padding(12)
                .background(ADLColor.terraWash)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            // Submit CTA
            Button {
                guard let payload = buildPayload() else { return }
                appState.enqueueContribution(
                    title: displayTitle,
                    notes: notes,
                    category: category,
                    location: locationProvider.lastLocation,
                    image: capturedImage,
                    payload: payload
                )
                resetFormAfterSubmit()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "tray.and.arrow.down.fill")
                    Text(appState.t("Queue Contribution", "Mettre en file d'attente"))
                }
            }
            .buttonStyle(PrimaryButtonStyle())
        }
    }

    private func reviewRow(icon: String, label: String, value: String, pass: Bool) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(pass ? ADLColor.forest : ADLColor.terracotta)
                .frame(width: 28, height: 28)
                .background(pass ? ADLColor.forestWash : ADLColor.terraWash)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            Text(label)
                .font(ADLFont.inter(13, .semibold))
                .foregroundColor(ADLColor.ink)
            Spacer()
            Text(value)
                .font(ADLFont.inter(12))
                .foregroundColor(ADLColor.inkMuted)
                .lineLimit(1)
        }
    }

    private func resetFormAfterSubmit() {
        currentStep = 0
        siteName = ""
        roadName = ""
        notes = ""
        capturedImage = nil
        validationMessage = nil
        mapPointId = nil
    }

    private var displayTitle: String {
        let site = siteName.trimmingCharacters(in: .whitespacesAndNewlines)
        let road = roadName.trimmingCharacters(in: .whitespacesAndNewlines)
        if category == .transportRoad && !road.isEmpty { return road }
        if !site.isEmpty { return site }
        if category == .censusProxy { return "\(buildingType) building" }
        return category.title
    }

    private func buildPayload() -> SubmissionPayload? {
        guard let location = locationProvider.lastLocation else {
            validationMessage = "Capture GPS before queuing."
            return nil
        }
        guard capturedImage != nil else {
            validationMessage = "Capture a photo before queuing."
            return nil
        }

        var details = SubmissionDetails()
        details.clientDevice = ClientDeviceInfo.current()
        details.consentStatus = consentStatus
        let recordedAt = ISO8601DateFormatter().string(from: Date())
        details.consentRecordedAt = recordedAt

        switch category {
        case .pharmacy:
            let name = trimmed(siteName)
            guard !name.isEmpty else {
                validationMessage = "Pharmacy name is required."
                return nil
            }
            details.name = name
            details.siteName = name
            details.isOpenNow = isOpenNow
            details.isOnDuty = isOnDuty
            details.openingHours = optionalTrimmed(openingHours)
        case .mobileMoney:
            let providers = csv(providerText)
            guard !providers.isEmpty else {
                validationMessage = "At least one provider is required."
                return nil
            }
            details.providers = providers
            details.paymentMethods = csv(paymentMethodsText)
            details.openingHours = optionalTrimmed(openingHours)
            if let provider = providers.first, let merchant = optionalTrimmed(merchantId) {
                details.merchantIdByProvider = [provider: merchant]
            }
        case .fuelStation:
            let name = trimmed(siteName)
            guard !name.isEmpty else {
                validationMessage = "Station name is required."
                return nil
            }
            details.name = name
            details.siteName = name
            details.hasFuelAvailable = hasFuelAvailable
            details.fuelTypes = csv(fuelTypesText)
            details.quality = optionalTrimmed(quality)
            details.paymentMethods = csv(paymentMethodsText)
            if let price = Double(trimmed(fuelPriceText)), price > 0 {
                details.pricesByFuel = ["super": price]
            }
        case .alcoholOutlet:
            let name = trimmed(siteName)
            guard !name.isEmpty else {
                validationMessage = "Outlet name is required."
                return nil
            }
            details.name = name
            details.siteName = name
            details.outletType = optionalTrimmed(outletType)
            details.isFormal = isFormal
            details.paymentMethods = csv(paymentMethodsText)
        case .billboard:
            let name = trimmed(siteName)
            guard !name.isEmpty else {
                validationMessage = "Billboard name is required."
                return nil
            }
            details.name = name
            details.billboardType = optionalTrimmed(billboardType)
            details.isOccupied = isOccupied
            details.advertiserBrand = optionalTrimmed(advertiserBrand)
        case .transportRoad:
            let road = trimmed(roadName)
            guard !road.isEmpty else {
                validationMessage = "Road name is required."
                return nil
            }
            details.roadName = road
            details.name = road
            details.condition = optionalTrimmed(roadCondition)
            details.surfaceType = optionalTrimmed(roadSurface)
            details.isBlocked = roadBlocked
            details.blockageType = roadBlocked ? optionalTrimmed(blockageType) : nil
        case .censusProxy:
            details.buildingType = optionalTrimmed(buildingType)
            details.occupancyStatus = optionalTrimmed(occupancyStatus)
            details.storeyCount = Int(trimmed(storeyCount))
            details.estimatedUnits = Int(trimmed(estimatedUnits))
        }

        validationMessage = nil
        let eventType: SubmissionEventType = mapPointId == nil ? .create : .enrich
        return SubmissionPayload(
            eventType: eventType,
            pointId: mapPointId,
            category: category,
            location: location,
            details: details,
            imageBase64: nil,
            consentStatus: consentStatus,
            consentRecordedAt: recordedAt,
            gpsIntegrity: GpsIntegrityReport.from(location: location),
            photoEvidenceSha256: nil
        )
    }

    private func trimmed(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func optionalTrimmed(_ value: String) -> String? {
        let trimmed = trimmed(value)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func csv(_ value: String) -> [String] {
        value
            .split(separator: ",")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func applyMapCaptureContextIfNeeded() {
        guard let context = appState.consumeMapCaptureContext() else { return }

        if context.pointId == nil {
            resetFormForNewCapture()
        }

        mapPointId = context.pointId

        if let contextCategory = context.category {
            category = contextCategory
        }

        let contextTitle = trimmed(context.title)
        if !contextTitle.isEmpty {
            if context.category == .transportRoad {
                roadName = contextTitle
            } else {
                siteName = contextTitle
            }
        }

        locationProvider.setLocation(context.location, status: "Map location selected")
        validationMessage = nil
    }

    private func resetFormForNewCapture() {
        category = .pharmacy
        siteName = ""
        roadName = ""
        notes = ""
        openingHours = ""
        isOpenNow = true
        isOnDuty = false
        providerText = "Orange Money, MTN MoMo"
        merchantId = ""
        paymentMethodsText = "Cash, Mobile Money"
        hasFuelAvailable = true
        fuelTypesText = "Super, Gasoil"
        fuelPriceText = ""
        quality = "Standard"
        outletType = "Bar"
        isFormal = true
        billboardType = "Standard"
        isOccupied = true
        advertiserBrand = ""
        roadCondition = "Good"
        roadSurface = "Asphalt"
        roadBlocked = false
        blockageType = "Flooding"
        buildingType = "Residential"
        occupancyStatus = "Occupied"
        storeyCount = ""
        estimatedUnits = ""
        consentStatus = .notRequired
        capturedImage = nil
        validationMessage = nil
        mapPointId = nil
    }
}

struct RequiredFieldsView: View {
    @EnvironmentObject private var appState: AppState
    let category: SubmissionCategory

    var body: some View {
        let fields = VerticalConfig.all[category]?.requiredFields ?? []
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "checklist")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(category.tint)
                .frame(width: 28, height: 28)
                .background(category.tint.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(appState.t("Required Fields", "Champs requis").uppercased())
                    .font(ADLFont.inter(10, .bold))
                    .tracking(1.4)
                    .foregroundColor(category.tint)
                Text(fields.isEmpty ? appState.t("No required fields", "Aucun champ requis") : fields.joined(separator: " · "))
                    .font(ADLFont.inter(12, .medium))
                    .foregroundColor(ADLColor.inkMuted)
                    .lineLimit(2)
            }
            Spacer()
        }
        .padding(12)
        .background(category.tint.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(category.tint.opacity(0.15), lineWidth: 1)
        )
    }
}

struct SubmissionQueueView: View {
    @EnvironmentObject private var appState: AppState
    @State private var actionMessage: String?
    @State private var actionError: String?
    @State private var activeItemId: UUID?

    private var failedDrafts: [ContributionDraft] {
        appState.drafts.filter { $0.syncState == .failed }
    }
    private var pendingDrafts: [ContributionDraft] {
        appState.drafts.filter { $0.syncState == .queued || $0.syncState == .syncing }
    }

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: appState.t("Pending Uploads", "Envois en attente")) {
                Button {
                    Task { await handleForceSync() }
                } label: {
                    if appState.isSyncingQueue {
                        ProgressView()
                            .frame(width: 20, height: 20)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(ADLColor.navy)
                    }
                }
                .frame(width: 44, height: 44)
                .accessibilityLabel(appState.t("Upload now", "Envoyer maintenant"))
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // KPI stat tiles — 3-col grid matching web
                    HStack(spacing: 12) {
                        queueStatTile(
                            label: appState.t("Pending", "En attente"),
                            value: "\(appState.queueSnapshot.queued)",
                            color: ADLColor.navy
                        )
                        queueStatTile(
                            label: appState.t("Failed", "Échecs"),
                            value: "\(appState.queueSnapshot.failed)",
                            color: ADLColor.terracotta
                        )
                        queueStatTile(
                            label: appState.t("Uploaded", "Envoyés"),
                            value: "\(appState.queueSnapshot.synced)",
                            color: ADLColor.forest
                        )
                    }

                    // Connectivity card
                    ADLCard {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(appState.t("Sync Queue", "File de synchro").uppercased())
                                        .font(ADLFont.inter(11, .bold))
                                        .tracking(1.6)
                                        .foregroundColor(Color(hex: 0x9ca3af))
                                    Text(appState.lastSyncMessage.isEmpty
                                         ? appState.t("Tap ↻ to upload all pending.", "Appuyez sur ↻ pour envoyer.")
                                         : appState.lastSyncMessage)
                                        .font(ADLFont.inter(13, .semibold))
                                        .foregroundColor(ADLColor.ink)
                                }
                                Spacer()
                                HStack(spacing: 6) {
                                    Image(systemName: "wifi")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(ADLColor.forest)
                                    Text(appState.t("Online", "En ligne"))
                                        .font(ADLFont.inter(12, .semibold))
                                        .foregroundColor(Color(hex: 0x4b5563))
                                }
                            }
                            // progress bar: pending / total
                            let total = appState.queueSnapshot.queued + appState.queueSnapshot.synced + appState.queueSnapshot.failed
                            let pending = appState.queueSnapshot.queued
                            let fraction = total > 0 ? Double(pending) / Double(total) : 0
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                                        .fill(ADLColor.line)
                                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                                        .fill(ADLColor.navy)
                                        .frame(width: geo.size.width * fraction)
                                }
                            }
                            .frame(height: 8)
                        }
                    }

                    // Action feedback banners
                    if let msg = actionMessage {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(ADLColor.forest)
                            Text(msg)
                                .font(ADLFont.inter(13))
                                .foregroundColor(ADLColor.forestDark)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(ADLColor.forestWash)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    if let err = actionError {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(ADLColor.danger)
                            Text(err)
                                .font(ADLFont.inter(13))
                                .foregroundColor(ADLColor.danger)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(hex: 0xfee2e2))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    // FAILED UPLOADS section
                    HStack {
                        Text(appState.t("Failed Uploads", "Envois échoués").uppercased())
                            .font(ADLFont.inter(12, .bold))
                            .tracking(1.6)
                            .foregroundColor(ADLColor.navy)
                        Spacer()
                        Text("\(failedDrafts.count)")
                            .font(ADLFont.inter(12, .bold))
                            .tracking(1.6)
                            .foregroundColor(Color(hex: 0x9ca3af))
                    }

                    if failedDrafts.isEmpty {
                        ADLCard {
                            Text(appState.t(
                                "No issues here. All uploads are good.",
                                "Aucun problème. Tous les envois sont bons."
                            ))
                            .font(ADLFont.inter(13))
                            .foregroundColor(Color(hex: 0x6b7280))
                        }
                    } else {
                        VStack(spacing: 12) {
                            ForEach(failedDrafts) { draft in
                                failedDraftRow(draft)
                            }
                        }
                    }

                    // WAITING TO UPLOAD section
                    HStack {
                        Text(appState.t("Waiting to Upload", "En attente d'envoi").uppercased())
                            .font(ADLFont.inter(12, .bold))
                            .tracking(1.6)
                            .foregroundColor(ADLColor.navy)
                        Spacer()
                        Text("\(pendingDrafts.count)")
                            .font(ADLFont.inter(12, .bold))
                            .tracking(1.6)
                            .foregroundColor(Color(hex: 0x9ca3af))
                    }

                    if pendingDrafts.isEmpty {
                        ADLCard {
                            Text(appState.t(
                                "All clear! No uploads waiting.",
                                "Tout est envoyé ! Rien en attente."
                            ))
                            .font(ADLFont.inter(13))
                            .foregroundColor(Color(hex: 0x6b7280))
                        }
                    } else {
                        VStack(spacing: 8) {
                            ForEach(pendingDrafts) { draft in
                                pendingDraftRow(draft)
                            }
                        }
                    }
                }
                .padding(16)
                .padding(.bottom, 32)
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
    }

    // MARK: - Sub-views

    @ViewBuilder
    private func queueStatTile(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(ADLFont.inter(11, .bold))
                .tracking(1.6)
                .foregroundColor(Color(hex: 0x9ca3af))
            Text(value)
                .font(ADLFont.inter(24, .bold))
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func failedDraftRow(_ draft: ContributionDraft) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(draft.displayTitle)
                        .font(ADLFont.inter(14, .bold))
                        .foregroundColor(ADLColor.ink)
                    Text(draft.category.title.uppercased())
                        .font(ADLFont.inter(11, .bold))
                        .tracking(1.6)
                        .foregroundColor(ADLColor.terracotta)
                    Text(draft.createdAt, style: .relative)
                        .font(ADLFont.inter(11))
                        .foregroundColor(Color(hex: 0x6b7280))
                }
                Spacer()
                ADLPill(
                    text: appState.t("Failed", "Échoué"),
                    bg: ADLColor.terraWash,
                    fg: ADLColor.terracotta
                )
            }

            if let lastError = draft.lastError, !lastError.isEmpty {
                Text(lastError)
                    .font(ADLFont.inter(12))
                    .foregroundColor(ADLColor.danger)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(hex: 0xfee2e2))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            HStack(spacing: 8) {
                Button {
                    Task {
                        activeItemId = draft.id
                        actionError = nil; actionMessage = nil
                        await appState.syncDraft(draft)
                        actionMessage = appState.t("Retrying now…", "Nouvelle tentative…")
                        activeItemId = nil
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 12, weight: .bold))
                        Text(appState.t("Retry", "Relancer"))
                            .font(ADLFont.inter(12, .bold))
                            .tracking(1.2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .background(activeItemId == draft.id ? ADLColor.line : ADLColor.navy)
                .foregroundColor(activeItemId == draft.id ? Color(hex: 0x9ca3af) : .white)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .disabled(activeItemId == draft.id)

                Button {
                    actionError = nil; actionMessage = nil
                    appState.deleteDraft(draft)
                    actionMessage = appState.t("Upload removed.", "Envoi supprimé.")
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "trash")
                            .font(.system(size: 12, weight: .bold))
                        Text(appState.t("Delete", "Supprimer"))
                            .font(ADLFont.inter(12, .bold))
                            .tracking(1.2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .background(Color(hex: 0xfee2e2))
                .foregroundColor(ADLColor.danger)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .disabled(activeItemId == draft.id)
            }
        }
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(ADLColor.terraWash, lineWidth: 1.5)
        )
    }

    @ViewBuilder
    private func pendingDraftRow(_ draft: ContributionDraft) -> some View {
        ADLCard {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(draft.displayTitle)
                        .font(ADLFont.inter(14, .bold))
                        .foregroundColor(ADLColor.ink)
                    Text(draft.category.title.uppercased())
                        .font(ADLFont.inter(11, .bold))
                        .tracking(1.6)
                        .foregroundColor(ADLColor.navy)
                    Text(draft.createdAt, style: .relative)
                        .font(ADLFont.inter(11))
                        .foregroundColor(Color(hex: 0x6b7280))
                }
                Spacer()
                ADLPill(
                    text: draft.syncState == .syncing
                        ? appState.t("Uploading", "Envoi")
                        : appState.t("Waiting", "En attente"),
                    bg: ADLColor.navyWash,
                    fg: ADLColor.navy
                )
            }
        }
    }

    // MARK: - Actions

    private func handleForceSync() async {
        actionError = nil; actionMessage = nil
        await appState.syncQueuedDrafts()
        if appState.queueSnapshot.synced > 0 {
            actionMessage = appState.t(
                "\(appState.queueSnapshot.synced) item(s) uploaded.",
                "\(appState.queueSnapshot.synced) élément(s) envoyé(s)."
            )
        } else {
            actionMessage = appState.t(
                "Everything is already uploaded.",
                "Tout est déjà envoyé."
            )
        }
    }
}

// MARK: - Web parity primitives (ADLScreenHeader, KpiTile etc. defined in ADLComponents.swift)

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? subviews.reduce(CGFloat.zero) { total, subview in
            total + subview.sizeThatFits(.unspecified).width + spacing
        }
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }

        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(
                at: CGPoint(x: x, y: y),
                proposal: ProposedViewSize(width: size.width, height: size.height)
            )
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

private enum ADLKpiTone {
    case navy, terra, forest, streak, amber, gold

    var background: Color {
        switch self {
        case .navy: return ADLColor.navyWash
        case .terra: return ADLColor.terraWash
        case .forest: return ADLColor.forestWash
        case .streak: return ADLColor.streakWash
        case .amber: return ADLColor.amberWash
        case .gold: return ADLColor.goldWash
        }
    }

    var foreground: Color {
        switch self {
        case .navy: return ADLColor.navy
        case .terra: return ADLColor.terracotta
        case .forest: return ADLColor.forestDark
        case .streak: return ADLColor.streak
        case .amber, .gold: return ADLColor.amber
        }
    }
}

private struct ADLKpiTile: View {
    let label: String
    let value: String
    var tone: ADLKpiTone = .navy
    var systemImage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(tone.foreground)
                    .frame(width: 28, height: 28)
                    .background(Color.white.opacity(0.7))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            Text(value)
                .font(ADLFont.inter(22, .black))
                .foregroundColor(tone.foreground)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(label.uppercased())
                .font(ADLFont.inter(11, .semibold))
                .tracking(2.2)
                .foregroundColor(tone.foreground.opacity(0.7))
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(tone.background)
        .clipShape(RoundedRectangle(cornerRadius: ADLRadius.statTile, style: .continuous))
    }
}

private struct ADLShortcutTile: View {
    let title: String
    let subtitle: String
    let systemImage: String
    var filled = false
    var action: (() -> Void)?

    var body: some View {
        Button {
            action?()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 36, height: 36)
                    .background(filled ? Color.white.opacity(0.12) : ADLColor.navyWash)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(ADLFont.inter(12, .bold))
                        .lineLimit(1)
                    Text(subtitle)
                        .font(ADLFont.inter(10, .regular))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                        .foregroundColor(filled ? Color.white.opacity(0.72) : .secondary)
                }
                Spacer(minLength: 8)
                Image(systemName: "arrow.right")
                    .font(.system(size: 15, weight: .bold))
            }
            .foregroundColor(filled ? .white : ADLColor.navy)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(filled ? ADLColor.navy : Color.white)
            .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous)
                    .stroke(filled ? Color.clear : ADLColor.line, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
    }
}

private struct ADLMiniStat: View {
    let label: String
    let value: String
    var suffix: String?
    var suffixTint: Color = ADLColor.forest

    var body: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(label.uppercased())
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(value)
                        .font(ADLFont.inter(22, .bold))
                        .foregroundColor(ADLColor.ink)
                    if let suffix {
                        Text(suffix)
                            .font(ADLFont.inter(11, .bold))
                            .foregroundColor(suffixTint)
                            .lineLimit(1)
                    }
                }
            }
        }
    }
}

private struct ProfileHeroCard: View {
    @EnvironmentObject private var appState: AppState
    let name: String
    let subtitle: String
    let tier: String
    let level: Int
    let rank: String?
    let xp: Int
    let xpTarget: Int
    let progress: Double

    private var initial: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return String(trimmed.first.map(Character.init) ?? "A").uppercased()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top, spacing: 14) {
                Text(initial)
                    .font(ADLFont.inter(22, .bold))
                    .foregroundColor(.white)
                    .frame(width: 60, height: 60)
                    .background(
                        LinearGradient(colors: [ADLColor.terracotta, ADLColor.navy], startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 3))
                    .shadow(color: ADLColor.navy.opacity(0.3), radius: 8, x: 0, y: 4)

                VStack(alignment: .leading, spacing: 7) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(name)
                            .font(ADLFont.inter(20, .bold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                        Text(tier)
                            .font(ADLFont.inter(11, .bold))
                            .foregroundColor(ADLColor.gold)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(ADLColor.gold.opacity(0.2))
                            .clipShape(Capsule())
                    }
                    HStack(spacing: 6) {
                        Text(appState.t("Level \(level)", "Niveau \(level)"))
                            .font(ADLFont.inter(11, .bold))
                            .foregroundColor(.white.opacity(0.72))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.white.opacity(0.1))
                            .clipShape(Capsule())
                        Text(subtitle)
                            .font(ADLFont.inter(14, .regular))
                            .foregroundColor(.white.opacity(0.72))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                }

                Spacer(minLength: 8)

                if let rank {
                    Text(rank)
                        .font(ADLFont.inter(22, .black))
                        .foregroundColor(ADLColor.gold)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(appState.t("Level", "Niveau").uppercased())
                    Spacer()
                    Text("\(xp.formatted()) / \(xpTarget.formatted()) XP")
                }
                .font(ADLFont.inter(11, .bold))
                .tracking(0.7)
                .foregroundColor(.white.opacity(0.72))

                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.15))
                        Capsule()
                            .fill(LinearGradient(colors: [ADLColor.gold, ADLColor.amber], startPoint: .leading, endPoint: .trailing))
                            .frame(width: max(0, min(1, progress)) * proxy.size.width)
                    }
                }
                .frame(height: 8)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 28)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ADLColor.navy)
    }
}

private struct ProfileBalanceCard: View {
    @EnvironmentObject private var appState: AppState
    let xp: Int

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text(appState.t("XP Balance", "Solde XP").uppercased())
                    .font(ADLFont.inter(11, .bold))
                    .tracking(0.9)
                    .foregroundColor(.white.opacity(0.78))
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(xp.formatted())
                        .font(ADLFont.inter(30, .black))
                        .foregroundColor(.white)
                    Text("XP")
                        .font(ADLFont.inter(18, .bold))
                        .foregroundColor(.white.opacity(0.62))
                }
            }
            Spacer()
            Image(systemName: "medal.fill")
                .font(.system(size: 24, weight: .semibold))
                .foregroundColor(.white)
                .frame(width: 48, height: 48)
                .background(Color.white.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.white.opacity(0.3), lineWidth: 1)
                )
        }
        .padding(24)
        .background(ADLColor.navy)
        .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
        .shadow(color: ADLColor.navy.opacity(0.18), radius: 18, x: 0, y: 8)
    }
}

private struct ProfileBadgeChip: View {
    let badge: Badge

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: badge.unlocked ? badge.systemImage : "lock.fill")
                .font(.system(size: 12, weight: .bold))
            Text(badge.title)
                .font(ADLFont.inter(11, .semibold))
                .lineLimit(1)
        }
        .foregroundColor(foreground)
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(background)
        .clipShape(Capsule())
    }

    private var foreground: Color {
        if !badge.unlocked { return ADLColor.inkMuted }
        return badge.tint
    }

    private var background: Color {
        if !badge.unlocked { return ADLColor.line }
        return badge.tint.opacity(0.12)
    }
}

private struct ProfileStreakTracker: View {
    @EnvironmentObject private var appState: AppState
    let streakDays: Int

    var body: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(appState.t("Streak", "Série").uppercased())
                        .font(ADLFont.inter(11, .bold))
                        .tracking(0.9)
                        .foregroundColor(ADLColor.inkMuted)
                    Spacer()
                    Text("\(streakDays)d")
                        .font(ADLFont.inter(13, .bold))
                        .foregroundColor(ADLColor.terracotta)
                }
                HStack(spacing: 8) {
                    ForEach(0..<7, id: \.self) { index in
                        Circle()
                            .fill(index < min(streakDays, 7) ? ADLColor.terracotta : ADLColor.line)
                            .frame(width: 28, height: 28)
                            .overlay(
                                Text(String(Calendar.current.shortWeekdaySymbols[(index + 1) % 7].prefix(1)))
                                    .font(ADLFont.inter(10, .bold))
                                    .foregroundColor(index < min(streakDays, 7) ? .white : .secondary)
                            )
                    }
                }
            }
        }
    }
}

private struct ProfileWeekSummaryCard: View {
    let rows: [(String, String)]

    var body: some View {
        ADLCard {
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    HStack {
                        Text(row.0)
                            .font(ADLFont.inter(13, .medium))
                            .foregroundColor(ADLColor.inkMuted)
                        Spacer()
                        Text(row.1)
                            .font(ADLFont.inter(13, .bold))
                            .foregroundColor(ADLColor.ink)
                    }
                    .padding(.vertical, 9)
                    if index < rows.count - 1 {
                        Divider().background(ADLColor.line)
                    }
                }
            }
        }
    }
}

private struct ADLLeaderboardRow: View {
    @EnvironmentObject private var appState: AppState
    let entry: LeaderboardEntry
    var compact = false

    private var rankTint: Color {
        switch entry.rank {
        case 1: return ADLColor.gold
        case 2: return ADLColor.navyMid
        case 3: return ADLColor.terracotta
        default: return ADLColor.ink
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("#\(entry.rank) \(entry.name)")
                    .font(ADLFont.inter(compact ? 14.0 : 16.0, .bold))
                    .foregroundColor(ADLColor.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(appState.t(
                    "\(entry.contributions.formatted()) submissions - \(RelativeDate.short(entry.lastContributionAt))",
                    "\(entry.contributions.formatted()) soumissions - \(RelativeDate.short(entry.lastContributionAt))"
                ))
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(entry.lastLocation)
                    .font(ADLFont.inter(12, .regular))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                if !compact {
                    Text(appState.t(
                        "Verified value score: \(entry.rankingScore.formatted())",
                        "Score valeur vérifiée : \(entry.rankingScore.formatted())"
                    ))
                        .font(ADLFont.inter(12, .regular))
                        .foregroundColor(.secondary)
                }
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 5) {
                Text(appState.t("Score: \(entry.rankingScore.formatted())", "Score : \(entry.rankingScore.formatted())"))
                    .font(ADLFont.inter(12, .bold))
                    .foregroundColor(ADLColor.navy)
                    .lineLimit(1)
                Text("\(entry.xp.formatted()) XP")
                    .font(ADLFont.inter(12, .bold))
                    .foregroundColor(ADLColor.forest)
                    .lineLimit(1)
                Text(appState.t("\(entry.averageQualityScore)% quality", "\(entry.averageQualityScore)% qualité"))
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
                    .lineLimit(1)
            }
        }
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(entry.rank <= 3 ? rankTint : Color.clear)
                .frame(width: 3)
                .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        }
        .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
    }
}

/// Agent-leaderboard row: rank circle + initials + name + XP bar + XP value.
/// Matches the plan Task 2.2 design and web Analytics.tsx contributorMode rows.
private struct AgentLeaderboardRow: View {
    let rank: Int
    let entry: LeaderboardEntry
    let maxXP: Int

    private var rankBg: Color {
        switch rank {
        case 1: return ADLColor.gold
        case 2: return Color(hex: 0xcbd5e1) // silver
        case 3: return ADLColor.terracotta  // bronze/terra
        default: return ADLColor.navyWash
        }
    }

    private var rankFg: Color {
        switch rank {
        case 1: return Color.white
        case 2: return Color(hex: 0x374151)
        case 3: return Color.white
        default: return ADLColor.navy
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            // Rank circle
            Text("\(rank)")
                .font(ADLFont.inter(12, .bold))
                .foregroundColor(rankFg)
                .frame(width: 28, height: 28)
                .background(rankBg)
                .clipShape(Circle())

            // Initials circle
            IdentityCircle(name: entry.name, size: 32)

            // Name + XP bar
            VStack(alignment: .leading, spacing: 5) {
                Text(entry.name)
                    .font(ADLFont.inter(13, .bold))
                    .foregroundColor(ADLColor.ink)
                    .lineLimit(1)

                let ratio = maxXP > 0 ? Double(max(0, entry.xp)) / Double(maxXP) : 0
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(ADLColor.line).frame(height: 6)
                        Capsule()
                            .fill(LinearGradient(
                                colors: [ADLColor.gold, ADLColor.terracotta],
                                startPoint: .leading,
                                endPoint: .trailing
                            ))
                            .frame(width: max(6, geo.size.width * ratio), height: 6)
                    }
                }
                .frame(height: 6)
            }

            Spacer(minLength: 4)

            // XP value
            Text("\(entry.xp.formatted()) XP")
                .font(ADLFont.inter(11, .bold))
                .foregroundColor(ADLColor.navy)
                .lineLimit(1)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 1, x: 0, y: 1)
    }
}

private enum RelativeDate {
    static func short(_ iso: String?) -> String {
        guard let iso, let date = parse(iso) else { return "No recent activity" }
        let minutes = max(1, Int(Date().timeIntervalSince(date) / 60))
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = max(1, minutes / 60)
        if hours < 24 { return "\(hours)h ago" }
        return "\(max(1, hours / 24))d ago"
    }

    private static func parse(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }
}

/// Percentage and day formatting shared by the analytics-backed dashboards.
private enum KpiFormat {
    static func pct(_ value: Double) -> String { "\(Int(value.rounded()))%" }
    static func days(_ value: Double) -> String { "\(Int(value.rounded()))d" }
}

/// Subtle inline banner shown while live analytics load or when they fail.
private struct AnalyticsStatusNote: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        if appState.analyticsSummary == nil {
            if appState.isLoadingAnalytics {
                HStack(spacing: 8) {
                    ProgressView()
                    Text(appState.t("Loading live metrics…", "Chargement des métriques…"))
                        .font(ADLFont.inter(13))
                        .foregroundColor(.secondary)
                }
            } else if let error = appState.analyticsError {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(ADLColor.terracotta)
                    Text(error)
                        .font(ADLFont.inter(13))
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

struct AdminReviewView: View {
    @EnvironmentObject private var appState: AppState
    @State private var activeMode: AdminNativeMode = .review
    @State private var reviewRiskFilter = "all"
    @State private var reviewAgentFilter = "all"
    @State private var selectedReviewEventIds: Set<String> = []

    private var filteredReviewQueue: [AdminReviewGroup] {
        appState.reviewQueue.filter { group in
            if reviewRiskFilter != "all", group.summary.riskBucket != reviewRiskFilter { return false }
            if reviewAgentFilter != "all", group.latestUser?.id != reviewAgentFilter { return false }
            return true
        }
    }

    private var reviewAgentOptions: [AdminReviewUser] {
        var seen = Set<String>()
        return appState.reviewQueue.compactMap { group in
            guard let user = group.latestUser, !user.id.isEmpty, !seen.contains(user.id) else { return nil }
            seen.insert(user.id)
            return user
        }
        .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private var selectedBulkEventIds: [String] {
        filteredReviewQueue
            .filter { selectedReviewEventIds.contains($0.latestEventId) && isBulkEligible($0) }
            .map(\.latestEventId)
    }

    private func isBulkEligible(_ group: AdminReviewGroup) -> Bool {
        !group.latestEventId.isEmpty && AdminResolvedStatus.from(group.summary.reviewStatus) == nil
    }

    private func riskTitle(_ risk: String) -> String {
        switch risk {
        case "flagged": return appState.t("High risk", "Risque élevé")
        case "pending": return appState.t("Pending", "En attente")
        case "low_risk": return appState.t("Low risk", "Faible risque")
        default: return appState.t("All risk", "Tous risques")
        }
    }

    private func agentTitle(_ agentId: String) -> String {
        if agentId == "all" { return appState.t("All agents", "Tous agents") }
        return reviewAgentOptions.first { $0.id == agentId }?.name ?? agentId
    }

    // Map riskBucket String → RiskLevel
    private func riskLevel(for group: AdminReviewGroup) -> RiskLevel {
        switch group.summary.riskBucket {
        case "flagged": return .high
        case "pending": return .medium
        default:        return .low
        }
    }

    // Map trustTier String → TrustTier (UI enum)
    private func trustTier(for group: AdminReviewGroup) -> TrustTier {
        switch group.summary.trustTier?.lowercased() ?? "" {
        case "gold", "elite":          return .gold
        case "silver", "trusted":      return .silver
        default:                       return .bronze
        }
    }

    // MARK: - Weekly assignment grouping (africandatalayer-jau)

    private static let assignmentDueFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private func assignmentDueDate(_ a: CollectionAssignment) -> Date? {
        if let d = Self.assignmentDueFormatter.date(from: a.dueDate) { return d }
        // dueDate may be plain YYYY-MM-DD
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = TimeZone(identifier: "UTC")
        return df.date(from: String(a.dueDate.prefix(10)))
    }

    private var thisWeekAssignments: [CollectionAssignment] {
        let cal = Calendar(identifier: .iso8601)
        return appState.assignments.filter { a in
            guard let due = assignmentDueDate(a) else { return false }
            return cal.isDate(due, equalTo: Date(), toGranularity: .weekOfYear)
        }
    }

    private var otherAssignments: [CollectionAssignment] {
        let thisWeekIds = Set(thisWeekAssignments.map(\.id))
        return appState.assignments.filter { !thisWeekIds.contains($0.id) }
    }

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: "African Data Layer",
                            subtitle: appState.t("Admin · Submission Queue", "Admin · File de soumissions")) {
                ADLPill(text: "Admin", bg: ADLColor.navyWash, fg: ADLColor.navy)
                    .padding(.trailing, 4)
            }

            adminModeTabs

            switch activeMode {
            case .review:
                reviewCockpitContent
            case .assignments:
                assignmentsCockpitContent
            case .automation:
                automationCockpitContent
            case .ipReports:
                ipReportsCockpitContent
            case .communications:
                CommunicationsCockpitView()
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task {
            await appState.loadReviewQueue()
            await appState.loadAnalytics()
        }
        .refreshable {
            await appState.loadReviewQueue(force: true)
            await appState.loadAnalytics(force: true)
        }
    }

    private var adminModeTabs: some View {
        VStack(spacing: 10) {
            Menu {
                ForEach(AdminNativeMode.allCases, id: \.self) { mode in
                    Button {
                        activeMode = mode
                    } label: {
                        Label(mode.title(appState.language), systemImage: mode.systemImage)
                    }
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: activeMode.systemImage)
                        .font(.system(size: 16, weight: .bold))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(appState.t("Cockpit", "Cockpit").uppercased())
                            .font(ADLFont.inter(10, .bold))
                            .tracking(1.4)
                            .foregroundColor(ADLColor.inkMuted)
                        Text(activeMode.title(appState.language))
                            .font(ADLFont.inter(15, .bold))
                            .foregroundColor(ADLColor.ink)
                    }
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(ADLColor.navy)
                }
                .padding(.horizontal, 16)
                .frame(height: 58)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(ADLColor.lineStrong, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 10)
        }
        .background(Color.white)
        .overlay(Rectangle().fill(ADLColor.line).frame(height: 1), alignment: .bottom)
    }

    private var reviewCockpitContent: some View {
        ScrollView {
                VStack(alignment: .leading, spacing: 16) {

                    // KPI grid (2×2): prefer live reviewStats, fall back to analyticsSummary
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        KpiTile(
                            label: appState.t("Pending Review", "En attente"),
                            value: "\(appState.reviewStats?.pending ?? appState.analyticsSummary?.reviewQueue.pendingReview ?? 0)",
                            tone: .navy,
                            systemIcon: "checkmark.square"
                        )
                        KpiTile(
                            label: appState.t("High-Risk", "Risque élevé"),
                            value: "\(appState.reviewStats?.flagged ?? appState.analyticsSummary?.reviewQueue.highRiskEvents ?? 0)",
                            tone: .amber,
                            systemIcon: "exclamationmark.octagon.fill"
                        )
                        KpiTile(
                            label: appState.t("Verified", "Vérifiés"),
                            value: KpiFormat.pct(appState.analyticsSummary?.verification.verificationRatePct ?? 0),
                            tone: .forest,
                            systemIcon: "checkmark.seal.fill"
                        )
                        KpiTile(
                            label: appState.t("Fraud Rate", "Taux fraude"),
                            value: KpiFormat.pct(appState.analyticsSummary?.fraud.fraudRatePct ?? 0),
                            tone: .terra,
                            systemIcon: "shield.lefthalf.filled"
                        )
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                    // Loading / error state for the review queue
                    if appState.isLoadingReview {
                        ADLCard {
                            HStack(spacing: 10) {
                                ProgressView()
                                Text(appState.t("Loading queue…", "Chargement de la file…"))
                                    .font(ADLFont.inter(13))
                                    .foregroundColor(ADLColor.inkMuted)
                            }
                        }
                        .padding(.horizontal, 16)
                    } else if let err = appState.reviewError, appState.reviewQueue.isEmpty {
                        ADLCard {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(appState.t("Queue unavailable", "File indisponible"))
                                    .font(ADLFont.inter(13, .semibold))
                                    .foregroundColor(ADLColor.ink)
                                Text(err)
                                    .font(ADLFont.inter(12))
                                    .foregroundColor(ADLColor.inkMuted)
                            }
                        }
                        .padding(.horizontal, 16)
                    }

                    // Status note (loading/error for analytics)
                    AnalyticsStatusNote()
                        .padding(.horizontal, 16)

                    reviewFiltersCard
                        .padding(.horizontal, 16)

                    // Section label
                    SectionLabel(text: appState.t("Review Queue", "File de révision"), wide: true)
                        .padding(.horizontal, 16)
                        .padding(.top, 4)

                    // Submission cards
                    if !appState.isLoadingReview && filteredReviewQueue.isEmpty {
                        ADLCard {
                            Text(appState.reviewQueue.isEmpty
                                 ? appState.t("No submissions in queue.", "Aucune soumission dans la file.")
                                 : appState.t("No submissions match these filters.", "Aucune soumission ne correspond à ces filtres."))
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(Color(hex: 0x374151))
                        }
                        .padding(.horizontal, 16)
                    } else {
                        VStack(spacing: 10) {
                            ForEach(filteredReviewQueue) { group in
                                HStack(alignment: .top, spacing: 10) {
                                    Button {
                                        if selectedReviewEventIds.contains(group.latestEventId) {
                                            selectedReviewEventIds.remove(group.latestEventId)
                                        } else {
                                            selectedReviewEventIds.insert(group.latestEventId)
                                        }
                                    } label: {
                                        Image(systemName: selectedReviewEventIds.contains(group.latestEventId) ? "checkmark.square.fill" : "square")
                                            .font(.system(size: 22, weight: .bold))
                                            .foregroundColor(isBulkEligible(group) ? ADLColor.navy : Color(hex: 0x9ca3af))
                                            .frame(width: 36, height: 44)
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(!isBulkEligible(group))
                                    .accessibilityLabel(appState.t("Select for mass approval", "Sélectionner pour approbation en lot"))

                                    AdminSubmissionCard(
                                        group: group,
                                        riskLevel: riskLevel(for: group),
                                        trustTier: trustTier(for: group)
                                    )
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
                .padding(.bottom, 24)
            }
    }

    private var reviewFiltersCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    SectionLabel(text: appState.t("Filters", "Filtres"), wide: true)
                    Spacer()
                    Text("\(filteredReviewQueue.count)")
                        .font(ADLFont.inter(12, .bold))
                        .foregroundColor(ADLColor.navy)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(ADLColor.navyLight)
                        .clipShape(Capsule())
                }

                HStack(spacing: 10) {
                    Menu {
                        ForEach(["all", "flagged", "pending", "low_risk"], id: \.self) { risk in
                            Button(riskTitle(risk)) { reviewRiskFilter = risk }
                        }
                    } label: {
                        filterButtonLabel(
                            title: appState.t("Risk", "Risque"),
                            value: riskTitle(reviewRiskFilter),
                            systemImage: "shield.lefthalf.filled"
                        )
                    }

                    Menu {
                        Button(agentTitle("all")) { reviewAgentFilter = "all" }
                        ForEach(reviewAgentOptions, id: \.id) { agent in
                            Button(agent.name) { reviewAgentFilter = agent.id }
                        }
                    } label: {
                        filterButtonLabel(
                            title: appState.t("Agent", "Agent"),
                            value: agentTitle(reviewAgentFilter),
                            systemImage: "person.crop.circle"
                        )
                    }
                }

                HStack(spacing: 10) {
                    Button {
                        selectedReviewEventIds = Set(filteredReviewQueue.filter(isBulkEligible).map(\.latestEventId))
                    } label: {
                        Text(appState.t("Select visible", "Sélectionner visibles"))
                            .font(ADLFont.inter(12, .bold))
                            .frame(maxWidth: .infinity)
                            .frame(height: 42)
                            .foregroundColor(ADLColor.navy)
                            .background(ADLColor.navyWash)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    Button {
                        selectedReviewEventIds.removeAll()
                    } label: {
                        Text(appState.t("Clear", "Effacer"))
                            .font(ADLFont.inter(12, .bold))
                            .frame(width: 84, height: 42)
                            .foregroundColor(ADLColor.inkMuted)
                            .background(ADLColor.line)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    let ids = selectedBulkEventIds
                    Task {
                        await appState.batchApproveReview(eventIds: ids)
                        selectedReviewEventIds.subtract(ids)
                    }
                } label: {
                    HStack(spacing: 8) {
                        if appState.isBatchApprovingReview {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "checkmark.seal.fill")
                        }
                        Text(appState.t("Mass approve", "Approuver en lot"))
                            .font(ADLFont.inter(13, .bold))
                        Text("(\(selectedBulkEventIds.count))")
                            .font(ADLFont.inter(12, .bold))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .foregroundColor(.white)
                    .background(selectedBulkEventIds.isEmpty || appState.isBatchApprovingReview ? Color(hex: 0x9ca3af) : ADLColor.forest)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(selectedBulkEventIds.isEmpty || appState.isBatchApprovingReview)

                if let message = appState.reviewActionMessage {
                    Text(message)
                        .font(ADLFont.inter(12, .semibold))
                        .foregroundColor(ADLColor.forest)
                }
            }
        }
    }

    private func filterButtonLabel(title: String, value: String, systemImage: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .bold))
            VStack(alignment: .leading, spacing: 1) {
                Text(title.uppercased())
                    .font(ADLFont.inter(9, .bold))
                    .tracking(1.1)
                    .foregroundColor(ADLColor.inkMuted)
                Text(value)
                    .font(ADLFont.inter(12, .bold))
                    .foregroundColor(ADLColor.ink)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(ADLColor.navy)
        }
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity)
        .frame(height: 48)
        .background(ADLColor.paper)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - Assignments cockpit (africandatalayer-955)

    private var assignmentsCockpitContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                SectionLabel(text: appState.t("Collection Assignments", "Affectations terrain"), wide: true)
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                if appState.isLoadingAssignments {
                    ADLCard {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text(appState.t("Loading assignments…", "Chargement des affectations…"))
                                .font(ADLFont.inter(13))
                                .foregroundColor(ADLColor.inkMuted)
                        }
                    }
                    .padding(.horizontal, 16)
                } else if let err = appState.assignmentsError, appState.assignments.isEmpty {
                    ADLCard {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(appState.t("Assignments unavailable", "Affectations indisponibles"))
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(ADLColor.ink)
                            Text(err)
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.inkMuted)
                            Button {
                                Task { await appState.loadAssignments(force: true) }
                            } label: {
                                Text(appState.t("Retry", "Réessayer"))
                                    .font(ADLFont.inter(12, .bold))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 40)
                                    .foregroundColor(.white)
                                    .background(ADLColor.navy)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .padding(.top, 6)
                        }
                    }
                    .padding(.horizontal, 16)
                } else if appState.assignments.isEmpty {
                    ADLCard {
                        Text(appState.t("No assignments found.", "Aucune affectation trouvée."))
                            .font(ADLFont.inter(13, .semibold))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                    .padding(.horizontal, 16)
                } else {
                    if !thisWeekAssignments.isEmpty {
                        SectionLabel(text: appState.t("This week", "Cette semaine"), wide: true)
                            .padding(.horizontal, 16)
                        VStack(spacing: 10) {
                            ForEach(thisWeekAssignments) { assignment in
                                AssignmentCard(
                                    assignment: assignment,
                                    context: appState.assignmentsContext
                                )
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    if !otherAssignments.isEmpty {
                        SectionLabel(text: appState.t("Later & overdue", "À venir & en retard"), wide: true)
                            .padding(.horizontal, 16)
                            .padding(.top, 4)
                        VStack(spacing: 10) {
                            ForEach(otherAssignments) { assignment in
                                AssignmentCard(
                                    assignment: assignment,
                                    context: appState.assignmentsContext
                                )
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
            }
            .padding(.bottom, 24)
        }
        .task { await appState.loadAssignments() }
        .refreshable { await appState.loadAssignments(force: true) }
    }

    // MARK: - Automation cockpit (africandatalayer-955)

    private var automationCockpitContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                SectionLabel(text: appState.t("Automation Leads", "Leads automatisés"), wide: true)
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                if appState.isLoadingLeads {
                    ADLCard {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text(appState.t("Loading leads…", "Chargement des leads…"))
                                .font(ADLFont.inter(13))
                                .foregroundColor(ADLColor.inkMuted)
                        }
                    }
                    .padding(.horizontal, 16)
                } else if let err = appState.leadsError, appState.leads.isEmpty {
                    ADLCard {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(appState.t("Leads unavailable", "Leads indisponibles"))
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(ADLColor.ink)
                            Text(err)
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.inkMuted)
                        }
                    }
                    .padding(.horizontal, 16)
                } else if appState.leads.isEmpty {
                    ADLCard {
                        Text(appState.t("No leads to review.", "Aucun lead à réviser."))
                            .font(ADLFont.inter(13, .semibold))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                    .padding(.horizontal, 16)
                } else {
                    VStack(spacing: 10) {
                        ForEach(appState.leads) { lead in
                            LeadCard(lead: lead) { action in
                                Task { await appState.applyLeadAction(id: lead.id, action: action) }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.bottom, 24)
        }
        .task { await appState.loadLeads() }
        .refreshable { await appState.loadLeads(force: true) }
    }

    // MARK: - IP Reports cockpit (africandatalayer-955)

    private var ipReportsCockpitContent: some View {
        IpReportsFormView()
    }

    private var adminModePlaceholder: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ADLCard {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 10) {
                            Image(systemName: activeMode.systemImage)
                                .font(.system(size: 20, weight: .bold))
                                .foregroundColor(activeMode.tint)
                                .frame(width: 42, height: 42)
                                .background(activeMode.tint.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(activeMode.title(appState.language))
                                    .font(ADLFont.inter(18, .bold))
                                    .foregroundColor(ADLColor.ink)
                                Text(activeMode.subtitle(appState.language))
                                    .font(ADLFont.inter(13))
                                    .foregroundColor(ADLColor.inkMuted)
                            }
                            Spacer()
                        }

                        Divider().background(ADLColor.line)

                        ForEach(activeMode.bullets(appState.language), id: \.self) { bullet in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(ADLColor.forest)
                                    .padding(.top, 1)
                                Text(bullet)
                                    .font(ADLFont.inter(13))
                                    .foregroundColor(ADLColor.ink)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    KpiTile(label: activeMode.primaryMetricLabel(appState.language), value: activeMode.primaryMetricValue(stats: appState.reviewStats), tone: .navy)
                    KpiTile(label: activeMode.secondaryMetricLabel(appState.language), value: activeMode.secondaryMetricValue(language: appState.language, stats: appState.reviewStats), tone: .forest)
                }
            }
            .padding(16)
            .padding(.bottom, 24)
        }
    }
}

private enum AdminNativeMode: String, CaseIterable, Hashable {
    case review
    case assignments
    case automation
    case ipReports
    case communications

    /// Bilingual helper (enum avoids a MainActor-crossing Identifiable conformance).
    private static func adlTr(_ language: String, _ en: String, _ fr: String) -> String {
        language == "fr" ? fr : en
    }

    func title(_ language: String) -> String {
        switch self {
        case .review: return Self.adlTr(language, "Review Cockpit", "Cockpit de révision")
        case .assignments: return Self.adlTr(language, "Assignments", "Affectations")
        case .automation: return Self.adlTr(language, "Automation", "Automatisation")
        case .ipReports: return Self.adlTr(language, "IP Reports", "Signalements PI")
        case .communications: return Self.adlTr(language, "Communications", "Communications")
        }
    }

    func subtitle(_ language: String) -> String {
        switch self {
        case .review:
            return Self.adlTr(language, "Server-filtered risk queue and submission triage.", "File de risque serveur et triage des soumissions.")
        case .assignments:
            return Self.adlTr(language, "Plan collection zones and monitor agent work.", "Planifier les zones de collecte et suivre les agents.")
        case .automation:
            return Self.adlTr(language, "Review machine-originated leads before assignment.", "Réviser les leads automatisés avant affectation.")
        case .ipReports:
            return Self.adlTr(language, "Track intellectual-property reports from users.", "Suivre les signalements de propriété intellectuelle.")
        case .communications:
            return Self.adlTr(language, "Coordinate email, SMS, and in-app notices.", "Coordonner email, SMS et avis in-app.")
        }
    }

    var systemImage: String {
        switch self {
        case .review: return "checkmark.square"
        case .assignments: return "map"
        case .automation: return "sparkles"
        case .ipReports: return "shield.lefthalf.filled"
        case .communications: return "message.badge.fill"
        }
    }

    var tint: Color {
        switch self {
        case .review: return ADLColor.navy
        case .assignments: return ADLColor.forest
        case .automation: return ADLColor.gold
        case .ipReports: return ADLColor.terracotta
        case .communications: return ADLColor.navyMid
        }
    }

    func bullets(_ language: String) -> [String] {
        switch self {
        case .review:
            return [
                Self.adlTr(language, "Open grouped submissions and expand each record for evidence.", "Ouvrir les soumissions groupées et développer chaque dossier."),
                Self.adlTr(language, "Approve, reject, or flag from the server-backed queue.", "Approuver, rejeter ou signaler depuis la file serveur.")
            ]
        case .assignments:
            return [
                Self.adlTr(language, "Create and monitor collection assignments by zone.", "Créer et suivre les affectations par zone."),
                Self.adlTr(language, "Track expected points, submitted points, and due dates.", "Suivre les points attendus, soumis et les échéances.")
            ]
        case .automation:
            return [
                Self.adlTr(language, "Filter imported candidates by source, risk, and category.", "Filtrer les candidats importés par source, risque et catégorie."),
                Self.adlTr(language, "Promote useful leads into assignments for field verification.", "Transformer les bons leads en affectations terrain.")
            ]
        case .ipReports:
            return [
                Self.adlTr(language, "Review open IP reports and resolution status.", "Réviser les signalements PI ouverts et leur statut."),
                Self.adlTr(language, "Keep legal follow-up separate from submission review.", "Séparer le suivi juridique de la revue des soumissions.")
            ]
        case .communications:
            return [
                Self.adlTr(language, "Prepare operational notices for agents and clients.", "Préparer des avis opérationnels pour agents et clients."),
                Self.adlTr(language, "Respect SMS and email consent before campaign sends.", "Respecter les consentements SMS et email avant envoi.")
            ]
        }
    }

    func primaryMetricLabel(_ language: String) -> String {
        switch self {
        case .review: return Self.adlTr(language, "Pending", "En attente")
        case .assignments: return Self.adlTr(language, "Active", "Actives")
        case .automation: return Self.adlTr(language, "Ready", "Prêts")
        case .ipReports: return Self.adlTr(language, "Open", "Ouverts")
        case .communications: return Self.adlTr(language, "Channels", "Canaux")
        }
    }

    func primaryMetricValue(stats: AdminReviewStats?) -> String {
        switch self {
        case .review: return "\(stats?.pending ?? 0)"
        case .assignments: return "0"
        case .automation: return "0"
        case .ipReports: return "0"
        case .communications: return "3"
        }
    }

    func secondaryMetricLabel(_ language: String) -> String {
        switch self {
        case .review: return Self.adlTr(language, "Flagged", "Signalés")
        case .assignments: return Self.adlTr(language, "Due Soon", "Échéance")
        case .automation: return Self.adlTr(language, "Sources", "Sources")
        case .ipReports: return Self.adlTr(language, "Resolved", "Résolus")
        case .communications: return Self.adlTr(language, "Consent", "Consentement")
        }
    }

    func secondaryMetricValue(language: String, stats: AdminReviewStats?) -> String {
        switch self {
        case .review: return "\(stats?.flagged ?? 0)"
        case .assignments: return "0"
        case .automation: return "0"
        case .ipReports: return "0"
        case .communications: return Self.adlTr(language, "Required", "Requis")
        }
    }
}

// MARK: - AdminSubmissionCard helpers

/// Resolved display state derived from group.summary.reviewStatus (server-canonical).
private enum AdminResolvedStatus {
    case approved, rejected, flagged

    /// Returns nil when the status is still pending (actions should show).
    static func from(_ reviewStatus: String) -> AdminResolvedStatus? {
        let s = reviewStatus.lowercased()
        if s == "approved" || s == "auto_approved" { return .approved }
        if s == "rejected" || s.hasPrefix("rejected_") { return .rejected }
        if s == "flagged" { return .flagged }
        return nil
    }

    var systemImage: String {
        switch self {
        case .approved: return "checkmark.seal.fill"
        case .rejected: return "xmark.octagon.fill"
        case .flagged:  return "flag.fill"
        }
    }
    var tint: Color {
        switch self {
        case .approved: return ADLColor.forest
        case .rejected: return ADLColor.terracotta
        case .flagged:  return ADLColor.amber
        }
    }
    // Labels are computed in the View (MainActor) to avoid calling t() from enum context.
    var labelEN: String {
        switch self {
        case .approved: return "Approved"
        case .rejected: return "Rejected"
        case .flagged:  return "Flagged"
        }
    }
    var labelFR: String {
        switch self {
        case .approved: return "Approuvé"
        case .rejected: return "Rejeté"
        case .flagged:  return "Signalé"
        }
    }
}

/// Single submission card in the admin review queue — wired to AdminReviewGroup.
private struct AdminSubmissionCard: View {
    @EnvironmentObject private var appState: AppState
    let group: AdminReviewGroup
    let riskLevel: RiskLevel
    let trustTier: TrustTier
    @State private var isSubmitting = false
    @State private var isExpanded = false

    // Resolved status from server — drives already-decided display.
    private var resolvedStatus: AdminResolvedStatus? {
        AdminResolvedStatus.from(group.summary.reviewStatus)
    }

    // Photo thumbnail
    @ViewBuilder private var submissionThumbnail: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(group.category.tint.opacity(0.13))
                .frame(width: 60, height: 60)
            if let raw = group.photoURL, let url = URL(string: raw) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .empty:
                        ProgressView().tint(group.category.tint)
                    case .failure:
                        Image(systemName: group.category.systemImage)
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundColor(group.category.tint)
                    @unknown default:
                        Image(systemName: group.category.systemImage)
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundColor(group.category.tint)
                    }
                }
                .frame(width: 60, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                Image(systemName: group.category.systemImage)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(group.category.tint)
            }
        }
    }

    private var accentColor: Color {
        switch riskLevel {
        case .high: return ADLColor.terracotta
        case .medium: return ADLColor.amber
        case .low: return ADLColor.forest
        }
    }

    private var displayName: String {
        group.siteName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? group.siteName!
            : group.category.title
    }

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            // Left accent strip
            Rectangle()
                .fill(accentColor)
                .frame(width: 4)
                .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))

            HStack(alignment: .top, spacing: 12) {
                submissionThumbnail

                VStack(alignment: .leading, spacing: 6) {
                    // Row 1: name + RiskBadge
                    HStack(alignment: .top, spacing: 8) {
                        Text(displayName)
                            .font(ADLFont.inter(15, .bold))
                            .foregroundColor(ADLColor.ink)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        RiskBadge(level: riskLevel)
                    }

                    // Row 2: category • riskBucket
                    Text("\(group.category.title) • \(group.summary.riskBucket.replacingOccurrences(of: "_", with: " "))")
                        .font(ADLFont.inter(13))
                        .foregroundColor(ADLColor.inkMuted)
                        .lineLimit(2)

                    // Row 3: TrustBadge + evidence + contributor chips
                    HStack(spacing: 6) {
                        TrustBadge(tier: trustTier)
                        ADLPill(
                            text: "\(group.summary.evidenceCount) \(appState.t("evidence", "preuves"))",
                            bg: ADLColor.line,
                            fg: Color(hex: 0x4b5563)
                        )
                        if let score = group.summary.trustScore {
                            ADLPill(
                                text: "Score \(Int(score))",
                                bg: ADLColor.navyWash,
                                fg: ADLColor.navy
                            )
                        }
                    }

                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            isExpanded.toggle()
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Text(isExpanded
                                 ? appState.t("Hide review details", "Masquer les détails")
                                 : appState.t("Show review details", "Afficher les détails"))
                                .font(ADLFont.inter(12, .bold))
                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                .font(.system(size: 11, weight: .bold))
                        }
                        .foregroundColor(ADLColor.navy)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 2)

                    if isExpanded {
                        expandedReviewDetails
                            .padding(.top, 8)
                    }

                    // Row 4: already-decided pill OR action buttons
                    if let status = resolvedStatus {
                        HStack(spacing: 6) {
                            Image(systemName: status.systemImage)
                                .font(.system(size: 12, weight: .bold))
                            Text(appState.t(status.labelEN, status.labelFR))
                                .font(ADLFont.inter(12, .bold))
                        }
                        .foregroundColor(status.tint)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(status.tint.opacity(0.12))
                        .clipShape(Capsule())
                        .padding(.top, 2)
                    } else {
                        HStack(spacing: 8) {
                            Button {
                                guard !isSubmitting else { return }
                                isSubmitting = true
                                Task {
                                    await appState.submitReviewDecision(
                                        eventId: group.latestEventId,
                                        decision: .approved
                                    )
                                    isSubmitting = false
                                }
                            } label: {
                                Text(appState.t("Approve", "Approuver"))
                                    .font(ADLFont.inter(12, .bold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 12).padding(.vertical, 7)
                                    .background(isSubmitting ? Color.gray : ADLColor.forest)
                                    .clipShape(Capsule())
                            }.buttonStyle(.plain).disabled(isSubmitting)

                            Button {
                                guard !isSubmitting else { return }
                                isSubmitting = true
                                Task {
                                    await appState.submitReviewDecision(
                                        eventId: group.latestEventId,
                                        decision: .flagged
                                    )
                                    isSubmitting = false
                                }
                            } label: {
                                Text(appState.t("Flag", "Signaler"))
                                    .font(ADLFont.inter(12, .bold))
                                    .foregroundColor(ADLColor.ink)
                                    .padding(.horizontal, 12).padding(.vertical, 7)
                                    .overlay(Capsule().stroke(ADLColor.lineStrong, lineWidth: 1.5))
                            }.buttonStyle(.plain).disabled(isSubmitting)

                            Button {
                                guard !isSubmitting else { return }
                                isSubmitting = true
                                Task {
                                    await appState.submitReviewDecision(
                                        eventId: group.latestEventId,
                                        decision: .rejected
                                    )
                                    isSubmitting = false
                                }
                            } label: {
                                Text(appState.t("Reject", "Rejeter"))
                                    .font(ADLFont.inter(12, .bold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 12).padding(.vertical, 7)
                                    .background(isSubmitting ? Color.gray : ADLColor.terracotta)
                                    .clipShape(Capsule())
                            }.buttonStyle(.plain).disabled(isSubmitting)
                        }
                        .padding(.top, 2)
                    }
                }
            }
            .padding(12)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 2, x: 0, y: 1)
    }

    private var expandedReviewDetails: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let raw = group.photoURL, let url = URL(string: raw) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .empty:
                        ZStack {
                            reviewPhotoPlaceholder
                            ProgressView()
                        }
                    default:
                        reviewPhotoPlaceholder
                    }
                }
                .frame(height: 170)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(reviewRows, id: \.0) { label, value in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(label.uppercased())
                            .font(ADLFont.inter(9, .bold))
                            .tracking(1.2)
                            .foregroundColor(Color(hex: 0x9ca3af))
                        Text(value)
                            .font(ADLFont.inter(12, .semibold))
                            .foregroundColor(ADLColor.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(ADLColor.paper)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }

            if !detailRows.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: appState.t("Submission Details", "Détails de soumission"))
                    ForEach(detailRows, id: \.0) { label, value in
                        HStack(alignment: .top, spacing: 10) {
                            Text(label)
                                .font(ADLFont.inter(12, .bold))
                                .foregroundColor(ADLColor.inkMuted)
                                .frame(width: 116, alignment: .leading)
                            Text(value)
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 7)
                        .overlay(Rectangle().fill(ADLColor.line).frame(height: 1), alignment: .bottom)
                    }
                }
            }
        }
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(ADLColor.lineStrong, lineWidth: 1)
        )
    }

    private var reviewPhotoPlaceholder: some View {
        ZStack {
            ADLColor.paper
            Image(systemName: group.category.systemImage)
                .font(.system(size: 30, weight: .semibold))
                .foregroundColor(group.category.tint)
        }
    }

    private var reviewRows: [(String, String)] {
        var rows: [(String, String)] = [
            (appState.t("Point ID", "ID point"), group.pointId),
            (appState.t("Event ID", "ID événement"), group.latestEventId.isEmpty ? appState.t("Unavailable", "Indisponible") : group.latestEventId),
            (appState.t("Category", "Catégorie"), group.category.title),
            (appState.t("Risk score", "Score risque"), String(format: "%.0f", group.summary.riskScore)),
            (appState.t("Evidence", "Preuves"), "\(group.summary.evidenceCount)"),
            (appState.t("Contributors", "Contributeurs"), "\(group.summary.contributorCount)"),
            (appState.t("Age", "Âge"), "\(group.summary.staleHours)h"),
            (appState.t("Status", "Statut"), group.summary.reviewStatus.replacingOccurrences(of: "_", with: " "))
        ]
        if let user = group.latestUser {
            rows.append((appState.t("Submitted by", "Soumis par"), user.name.isEmpty ? user.id : user.name))
        }
        if let createdAt = group.latestEvent?.createdAt {
            rows.append((appState.t("Time", "Heure"), formattedDate(createdAt)))
        }
        if let location = group.latestEvent?.location {
            rows.append((appState.t("GPS", "GPS"), String(format: "%.5f, %.5f", location.latitude, location.longitude)))
            rows.append((appState.t("Accuracy", "Précision"), location.accuracyMeters.map { String(format: "%.0fm", $0) } ?? appState.t("Unavailable", "Indisponible")))
        }
        rows.append((appState.t("GPS drift", "Dérive GPS"), group.summary.submissionDistanceKm.map { String(format: "%.2f km", $0) } ?? appState.t("Unavailable", "Indisponible")))
        rows.append((appState.t("IP drift", "Dérive IP"), group.summary.ipDistanceKm.map { String(format: "%.2f km", $0) } ?? appState.t("Unavailable", "Indisponible")))
        if group.summary.hasSubmissionMismatch {
            rows.append((appState.t("GPS match", "Correspondance GPS"), appState.t("Mismatch", "Écart")))
        }
        if group.summary.hasIpMismatch {
            rows.append((appState.t("IP match", "Correspondance IP"), appState.t("Mismatch", "Écart")))
        }
        if group.summary.isLowEndDevice {
            rows.append((appState.t("Device", "Appareil"), appState.t("Low-end device", "Appareil bas de gamme")))
        }
        return rows
    }

    private var detailRows: [(String, String)] {
        guard let details = group.latestEvent?.details else { return [] }
        var rows: [(String, String)] = []
        add("Name", "Nom", details.name, to: &rows)
        add("Site name", "Nom du site", details.siteName, to: &rows)
        if let score = details.confidenceScore {
            rows.append((appState.t("Confidence", "Confiance"), String(format: "%.0f%%", score)))
        }
        add("Opening hours", "Horaires", details.openingHours, to: &rows)
        add("Open now", "Ouvert maintenant", details.isOpenNow, to: &rows)
        add("On duty", "De garde", details.isOnDuty, to: &rows)
        add("Providers", "Fournisseurs", details.providers, to: &rows)
        add("Payments", "Paiements", details.paymentMethods, to: &rows)
        add("Fuel available", "Carburant disponible", details.hasFuelAvailable, to: &rows)
        add("Fuel types", "Types carburant", details.fuelTypes, to: &rows)
        if let prices = details.pricesByFuel, !prices.isEmpty {
            rows.append((appState.t("Fuel prices", "Prix carburant"), prices.map { "\($0.key): \(Int($0.value))" }.joined(separator: ", ")))
        }
        add("Quality", "Qualité", details.quality, to: &rows)
        add("Outlet type", "Type de point", details.outletType, to: &rows)
        add("Formal", "Formel", details.isFormal, to: &rows)
        add("Billboard type", "Type panneau", details.billboardType, to: &rows)
        add("Occupied", "Occupé", details.isOccupied, to: &rows)
        add("Advertiser", "Annonceur", details.advertiserBrand, to: &rows)
        add("Road name", "Nom route", details.roadName, to: &rows)
        add("Condition", "État", details.condition, to: &rows)
        add("Surface", "Surface", details.surfaceType, to: &rows)
        add("Blocked", "Bloqué", details.isBlocked, to: &rows)
        add("Blockage", "Blocage", details.blockageType, to: &rows)
        add("Building type", "Type bâtiment", details.buildingType, to: &rows)
        add("Occupancy", "Occupation", details.occupancyStatus, to: &rows)
        if let storeyCount = details.storeyCount {
            rows.append((appState.t("Storeys", "Étages"), "\(storeyCount)"))
        }
        if let estimatedUnits = details.estimatedUnits {
            rows.append((appState.t("Estimated units", "Unités estimées"), "\(estimatedUnits)"))
        }
        if let consent = details.consentStatus {
            rows.append((appState.t("Consent", "Consentement"), consent.title))
        }
        add("Consent date", "Date consentement", details.consentRecordedAt, to: &rows)
        return rows
    }

    private func formattedDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        return date?.formatted(date: .abbreviated, time: .shortened) ?? iso
    }

    private func add(_ en: String, _ fr: String, _ value: String?, to rows: inout [(String, String)]) {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return }
        rows.append((appState.t(en, fr), trimmed))
    }

    private func add(_ en: String, _ fr: String, _ value: Bool?, to rows: inout [(String, String)]) {
        guard let value else { return }
        rows.append((appState.t(en, fr), value ? appState.t("Yes", "Oui") : appState.t("No", "Non")))
    }

    private func add(_ en: String, _ fr: String, _ value: [String]?, to rows: inout [(String, String)]) {
        guard let values = value?.filter({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }), !values.isEmpty else { return }
        rows.append((appState.t(en, fr), values.joined(separator: ", ")))
    }
}

// MARK: - AssignmentCard (africandatalayer-955)

private struct AssignmentCard: View {
    @EnvironmentObject private var appState: AppState
    let assignment: CollectionAssignment
    let context: AssignmentPlannerContext

    private var agentName: String {
        context.agents.first(where: { $0.id == assignment.agentUserId })?.name
            ?? assignment.agentUserId
    }

    private var statusPill: some View {
        let (bg, fg): (Color, Color) = {
            switch assignment.status {
            case .pending:    return (ADLColor.amberWash, ADLColor.amber)
            case .inProgress: return (ADLColor.navyWash,  ADLColor.navy)
            case .completed:  return (ADLColor.forestWash, ADLColor.forestDark)
            case .cancelled:  return (ADLColor.terraWash, ADLColor.terracotta)
            }
        }()
        return ADLPill(text: assignment.status.title, bg: bg, fg: fg)
    }

    private var progress: Double {
        guard assignment.pointsExpected > 0 else { return 0 }
        return min(1, Double(assignment.pointsSubmitted) / Double(assignment.pointsExpected))
    }

    var body: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 10) {
                // Header row
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(assignment.zoneLabel)
                            .font(ADLFont.inter(15, .bold))
                            .foregroundColor(ADLColor.ink)
                        Text(agentName)
                            .font(ADLFont.inter(13))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                    Spacer()
                    statusPill
                }

                // Vertical chips
                if !assignment.assignedVerticals.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(assignment.assignedVerticals, id: \.self) { cat in
                                HStack(spacing: 4) {
                                    Image(systemName: cat.systemImage)
                                        .font(.system(size: 11, weight: .semibold))
                                    Text(cat.title)
                                        .font(ADLFont.inter(11, .semibold))
                                }
                                .foregroundColor(cat.tint)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(cat.tint.opacity(0.10))
                                .clipShape(Capsule())
                            }
                        }
                    }
                }

                // Progress bar + counts
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(appState.t("Progress", "Avancement"))
                            .font(ADLFont.inter(11, .bold))
                            .foregroundColor(ADLColor.inkMuted)
                        Spacer()
                        Text("\(assignment.pointsSubmitted)/\(assignment.pointsExpected) pts")
                            .font(ADLFont.inter(11, .semibold))
                            .foregroundColor(ADLColor.ink)
                    }
                    ADLProgressBar(value: progress, tint: ADLColor.forest)
                }

                // Due date row
                HStack {
                    Image(systemName: "calendar")
                        .font(.system(size: 12))
                        .foregroundColor(ADLColor.inkMuted)
                    Text("\(appState.t("Due", "Échéance")): \(assignment.dueDate.prefix(10))")
                        .font(ADLFont.inter(12))
                        .foregroundColor(ADLColor.inkMuted)
                }

                if let notes = assignment.notes, !notes.isEmpty {
                    Text(notes)
                        .font(ADLFont.inter(12))
                        .foregroundColor(ADLColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

private struct AssignmentCompactRow: View {
    @EnvironmentObject private var appState: AppState
    let assignment: CollectionAssignment
    let context: AssignmentPlannerContext

    private var agentName: String {
        context.agents.first(where: { $0.id == assignment.agentUserId })?.name
            ?? assignment.agentUserId
    }

    private var progress: Double {
        guard assignment.pointsExpected > 0 else { return 0 }
        return min(1, Double(assignment.pointsSubmitted) / Double(assignment.pointsExpected))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "map.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(ADLColor.forest)
                    .frame(width: 34, height: 34)
                    .background(ADLColor.forestWash)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(assignment.zoneLabel)
                        .font(ADLFont.inter(13, .bold))
                        .foregroundColor(ADLColor.ink)
                    Text(appState.selectedRole == .admin ? agentName : "\(appState.t("Due", "Échéance")) \(assignment.dueDate.prefix(10))")
                        .font(ADLFont.inter(11, .medium))
                        .foregroundColor(ADLColor.inkMuted)
                        .lineLimit(1)
                }
                Spacer()
                Text("\(assignment.pointsSubmitted)/\(assignment.pointsExpected)")
                    .font(ADLFont.inter(11, .bold))
                    .foregroundColor(ADLColor.navy)
            }
            ADLProgressBar(value: progress, tint: ADLColor.forest, height: 7)
        }
        .padding(10)
        .background(ADLColor.paper)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

// MARK: - LeadCard (africandatalayer-955)

private struct LeadCard: View {
    @EnvironmentObject private var appState: AppState
    let lead: LeadCandidate
    let onAction: (String) -> Void
    @State private var isActing = false

    private var priorityPill: some View {
        let (bg, fg): (Color, Color) = {
            switch lead.priority {
            case .high:   return (Color(hex: 0xfee2e2), Color(hex: 0x991b1b))
            case .medium: return (ADLColor.amberWash, ADLColor.amber)
            case .low:    return (ADLColor.forestWash, ADLColor.forestDark)
            }
        }()
        return ADLPill(text: lead.priority.title, bg: bg, fg: fg)
    }

    private var statusPill: some View {
        let isActive = lead.status == .readyForAssignment || lead.status == .needsFieldVerify
        return ADLPill(
            text: lead.status.title,
            bg: isActive ? ADLColor.navyWash : ADLColor.line,
            fg: isActive ? ADLColor.navy : ADLColor.inkMuted
        )
    }

    var body: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 10) {
                // Header
                HStack(alignment: .top) {
                    HStack(spacing: 8) {
                        Image(systemName: lead.category.systemImage)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(lead.category.tint)
                            .frame(width: 32, height: 32)
                            .background(lead.category.tint.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(lead.category.title)
                                .font(ADLFont.inter(14, .bold))
                                .foregroundColor(ADLColor.ink)
                            Text(lead.sourceSystem)
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.inkMuted)
                        }
                    }
                    Spacer()
                    priorityPill
                }

                statusPill

                // Match confidence if present
                if let confidence = lead.matchConfidence {
                    HStack(spacing: 6) {
                        Text(appState.t("Match confidence", "Confiance correspondance"))
                            .font(ADLFont.inter(11))
                            .foregroundColor(ADLColor.inkMuted)
                        Text(String(format: "%.0f%%", confidence * 100))
                            .font(ADLFont.inter(11, .bold))
                            .foregroundColor(ADLColor.navy)
                    }
                }

                // Location
                HStack(spacing: 4) {
                    Image(systemName: "location.fill")
                        .font(.system(size: 11))
                        .foregroundColor(ADLColor.inkMuted)
                    Text(String(format: "%.5f, %.5f", lead.location.latitude, lead.location.longitude))
                        .font(ADLFont.inter(11))
                        .foregroundColor(ADLColor.inkMuted)
                }

                // Action buttons — only for actionable statuses
                if lead.status == .readyForAssignment || lead.status == .needsFieldVerify || lead.status == .importCandidate {
                    HStack(spacing: 8) {
                        Button {
                            guard !isActing else { return }
                            isActing = true
                            onAction("reject")
                        } label: {
                            Text(appState.t("Reject", "Rejeter"))
                                .font(ADLFont.inter(12, .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(isActing ? Color.gray : ADLColor.terracotta)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(isActing)

                        Button {
                            guard !isActing else { return }
                            isActing = true
                            onAction("mark_assigned")
                        } label: {
                            Text(appState.t("Assign", "Affecter"))
                                .font(ADLFont.inter(12, .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .background(isActing ? Color.gray : ADLColor.forest)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(isActing)

                        Button {
                            guard !isActing else { return }
                            isActing = true
                            onAction("promote_to_import_candidate")
                        } label: {
                            Text(appState.t("Promote", "Promouvoir"))
                                .font(ADLFont.inter(12, .bold))
                                .foregroundColor(ADLColor.navy)
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .overlay(Capsule().stroke(ADLColor.navyBorder, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                        .disabled(isActing)
                    }
                }
            }
        }
    }
}

// MARK: - IpReportsFormView (africandatalayer-955)

private struct IpReportsFormView: View {
    @EnvironmentObject private var appState: AppState
    @State private var reporterName = ""
    @State private var reporterEmail = ""
    @State private var targetRef = ""
    @State private var description = ""
    @State private var rightsBasis = ""
    @State private var sworn = false
    @State private var isSubmitting = false
    @State private var submitError: String?
    @State private var didSubmit = false

    var body: some View {
        ScrollView {
            if didSubmit {
                successView
            } else {
                formView
            }
        }
    }

    private var successView: some View {
        VStack(spacing: 20) {
            Spacer().frame(height: 32)
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 56))
                .foregroundColor(ADLColor.forest)
            Text(appState.t("Report Submitted", "Signalement soumis"))
                .font(ADLFont.inter(20, .bold))
                .foregroundColor(ADLColor.ink)
            Text(appState.t(
                "Your IP report has been received and will be reviewed by our team.",
                "Votre signalement de propriété intellectuelle a été reçu et sera examiné par notre équipe."
            ))
            .font(ADLFont.inter(14))
            .foregroundColor(ADLColor.inkMuted)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 24)

            Button(appState.t("Submit another", "Nouveau signalement")) {
                resetForm()
            }
            .buttonStyle(SecondaryButtonStyle())
            .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 40)
    }

    private var formView: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel(text: appState.t("IP Report", "Signalement PI"), wide: true)
                .padding(.horizontal, 16)
                .padding(.top, 16)

            ADLCard {
                VStack(alignment: .leading, spacing: 4) {
                    Text(appState.t(
                        "Report content that you believe infringes your intellectual property rights.",
                        "Signalez un contenu qui porte atteinte à vos droits de propriété intellectuelle."
                    ))
                    .font(ADLFont.inter(13))
                    .foregroundColor(ADLColor.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 16)

            VStack(spacing: 10) {
                ADLInputField(
                    icon: "person.fill",
                    placeholder: appState.t("Your full name", "Votre nom complet"),
                    text: $reporterName
                )
                ADLInputField(
                    icon: "envelope.fill",
                    placeholder: appState.t("Your email address", "Votre adresse e-mail"),
                    text: $reporterEmail,
                    keyboard: .emailAddress
                )
                ADLInputField(
                    icon: "link",
                    placeholder: appState.t("Infringing content URL or reference", "URL ou référence du contenu contrefaisant"),
                    text: $targetRef
                )
                ADLInputField(
                    icon: "text.alignleft",
                    placeholder: appState.t("Describe the infringement", "Décrivez la violation"),
                    text: $description
                )
                ADLInputField(
                    icon: "checkmark.shield.fill",
                    placeholder: appState.t("Rights basis (copyright, trademark…)", "Fondement des droits (droits d'auteur, marque…)"),
                    text: $rightsBasis
                )
            }
            .padding(.horizontal, 16)

            // Sworn declaration toggle
            ADLCard {
                Toggle(isOn: $sworn) {
                    Text(appState.t(
                        "I swear the information above is accurate to the best of my knowledge.",
                        "Je certifie que les informations ci-dessus sont exactes à ma connaissance."
                    ))
                    .font(ADLFont.inter(13))
                    .foregroundColor(ADLColor.ink)
                    .fixedSize(horizontal: false, vertical: true)
                }
                .tint(ADLColor.navy)
            }
            .padding(.horizontal, 16)

            if let err = submitError {
                ADLCard {
                    Text(err)
                        .font(ADLFont.inter(13))
                        .foregroundColor(ADLColor.danger)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 16)
            }

            Button {
                Task { await submitReport() }
            } label: {
                if isSubmitting {
                    HStack(spacing: 8) {
                        ProgressView().tint(.white)
                        Text(appState.t("Submitting…", "Envoi…"))
                    }
                } else {
                    Text(appState.t("Submit Report", "Soumettre le signalement"))
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!canSubmit || isSubmitting)
            .padding(.horizontal, 16)
            .padding(.bottom, 32)
        }
    }

    private var canSubmit: Bool {
        !reporterName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !reporterEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        sworn
    }

    private func submitReport() async {
        guard canSubmit, !isSubmitting else { return }
        isSubmitting = true
        submitError = nil
        let payload = IpReportPayload(
            reporterName: reporterName.trimmingCharacters(in: .whitespacesAndNewlines),
            reporterEmail: reporterEmail.trimmingCharacters(in: .whitespacesAndNewlines),
            targetKind: "url",
            targetRef: targetRef.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : targetRef.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            sworn: sworn
        )
        do {
            try await appState.submitIpReport(payload)
            didSubmit = true
        } catch {
            submitError = (error as? APIError)?.message ?? appState.t("Submission failed. Please try again.", "Échec de soumission. Veuillez réessayer.")
        }
        isSubmitting = false
    }

    private func resetForm() {
        reporterName = ""
        reporterEmail = ""
        targetRef = ""
        description = ""
        rightsBasis = ""
        sworn = false
        submitError = nil
        didSubmit = false
    }
}

// MARK: - Communications cockpit (africandatalayer-955)

/// Admin Communications cockpit — channel toggle (Email/SMS), audience summary,
/// campaign history list, and a composer sheet. Mirrors CommunicationsPanel.tsx.
private struct CommunicationsCockpitView: View {
    @EnvironmentObject private var appState: AppState
    @State private var channel: CommsChannel = .email
    @State private var showComposer = false

    private var campaigns: [CampaignRow] {
        channel == .email ? appState.emailCampaigns : appState.smsCampaigns
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                channelToggle
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                audienceCard
                    .padding(.horizontal, 16)

                if let msg = appState.commsActionMessage {
                    ADLCard {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(ADLColor.forest)
                            Text(msg)
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(ADLColor.ink)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.horizontal, 16)
                }

                newCampaignButton
                    .padding(.horizontal, 16)

                SectionLabel(text: appState.t("Campaigns", "Campagnes"), wide: true)
                    .padding(.horizontal, 16)
                    .padding(.top, 4)

                campaignList
            }
            .padding(.bottom, 24)
        }
        .task {
            await appState.loadCommunications()
            await appState.previewAudience()
        }
        .refreshable {
            await appState.loadCommunications(force: true)
            await appState.previewAudience()
        }
        .sheet(isPresented: $showComposer) {
            CampaignComposerSheet(channel: channel)
                .environmentObject(appState)
        }
    }

    private var channelToggle: some View {
        HStack(spacing: 8) {
            ForEach(CommsChannel.allCases, id: \.self) { ch in
                let active = ch == channel
                Button {
                    channel = ch
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: ch.systemImage)
                            .font(.system(size: 13, weight: .semibold))
                        Text(ch.title(appState.language))
                            .font(ADLFont.inter(13, .bold))
                    }
                    .foregroundColor(active ? .white : ADLColor.inkMuted)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(active ? ADLColor.navy : Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(active ? ADLColor.navy : ADLColor.lineStrong, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var audienceCard: some View {
        let preview = appState.audiencePreview
        let recipients = preview?.recipientCount ?? campaigns.first?.recipientCount ?? 0
        let suppressed = preview?.suppressedCount ?? campaigns.first?.suppressedCount ?? 0
        let maxRecipients = preview?.maxRecipients ?? appState.commsMaxRecipients
        return ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(ADLColor.navy)
                    Text(appState.t("Audience", "Audience"))
                        .font(ADLFont.inter(13, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    ADLPill(text: appState.t("Opt-in", "Consentement"), bg: ADLColor.forestWash, fg: ADLColor.forestDark)
                }
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    KpiTile(label: appState.t("Recipients", "Destinataires"), value: "\(recipients)", tone: .navy)
                    KpiTile(label: appState.t("Suppressed", "Supprimés"), value: "\(suppressed)", tone: .amber)
                    KpiTile(label: appState.t("Max", "Max"), value: "\(maxRecipients)", tone: .forest)
                }
            }
        }
    }

    private var newCampaignButton: some View {
        Button {
            appState.commsActionMessage = nil
            showComposer = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus.circle.fill")
                Text(appState.t("New campaign", "Nouvelle campagne"))
            }
        }
        .buttonStyle(PrimaryButtonStyle())
    }

    @ViewBuilder
    private var campaignList: some View {
        if appState.isLoadingComms && campaigns.isEmpty {
            ADLCard {
                HStack(spacing: 10) {
                    ProgressView()
                    Text(appState.t("Loading campaigns…", "Chargement des campagnes…"))
                        .font(ADLFont.inter(13))
                        .foregroundColor(ADLColor.inkMuted)
                }
            }
            .padding(.horizontal, 16)
        } else if let err = appState.commsError, campaigns.isEmpty {
            ADLCard {
                VStack(alignment: .leading, spacing: 4) {
                    Text(appState.t("Communications unavailable", "Communications indisponibles"))
                        .font(ADLFont.inter(13, .semibold))
                        .foregroundColor(ADLColor.ink)
                    Text(err)
                        .font(ADLFont.inter(12))
                        .foregroundColor(ADLColor.inkMuted)
                }
            }
            .padding(.horizontal, 16)
        } else if campaigns.isEmpty {
            ADLCard {
                Text(appState.t("No campaigns yet.", "Aucune campagne pour l'instant."))
                    .font(ADLFont.inter(13, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
            }
            .padding(.horizontal, 16)
        } else {
            VStack(spacing: 10) {
                ForEach(campaigns) { row in
                    CampaignCard(row: row, channel: channel)
                }
            }
            .padding(.horizontal, 16)
        }
    }
}

/// A single campaign row card: headline, status pill, and counts.
private struct CampaignCard: View {
    @EnvironmentObject private var appState: AppState
    let row: CampaignRow
    let channel: CommsChannel

    private var statusPill: (bg: Color, fg: Color) {
        switch row.status {
        case "completed", "sent":
            return (ADLColor.forestWash, ADLColor.forestDark)
        case "failed", "cancelled":
            return (Color(hex: 0xfee2e2), Color(hex: 0x991b1b))
        case "sending", "queued":
            return (ADLColor.amberWash, ADLColor.amber)
        default:
            return (ADLColor.navyWash, ADLColor.navy)
        }
    }

    var body: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: channel.systemImage)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(ADLColor.navy)
                        .frame(width: 28, height: 28)
                        .background(ADLColor.navyWash)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    Text(row.headline.isEmpty ? appState.t("(no subject)", "(sans objet)") : row.headline)
                        .font(ADLFont.inter(14, .semibold))
                        .foregroundColor(ADLColor.ink)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 6)
                    ADLPill(text: row.status, bg: statusPill.bg, fg: statusPill.fg)
                }

                HStack(spacing: 14) {
                    countLabel(icon: "person.2.fill", value: row.recipientCount, label: appState.t("recipients", "destinataires"))
                    countLabel(icon: "paperplane.fill", value: row.sentCount, label: appState.t("sent", "envoyés"))
                    countLabel(icon: "exclamationmark.triangle.fill", value: row.failedCount, label: appState.t("failed", "échecs"))
                }

                if !row.createdAt.isEmpty {
                    Text(row.createdAt)
                        .font(ADLFont.inter(11))
                        .foregroundColor(ADLColor.inkMuted)
                }
            }
        }
    }

    private func countLabel(icon: String, value: Int, label: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(ADLColor.inkMuted)
            Text("\(value)")
                .font(ADLFont.inter(12, .bold))
                .foregroundColor(ADLColor.ink)
            Text(label)
                .font(ADLFont.inter(11))
                .foregroundColor(ADLColor.inkMuted)
        }
    }
}

/// Composer sheet — subject+body for email, message for SMS.
private struct CampaignComposerSheet: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    let channel: CommsChannel

    @State private var subject = ""
    @State private var messageBody = ""

    private var canSend: Bool {
        let trimmedBody = messageBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedBody.isEmpty, !appState.isSendingCampaign else { return false }
        if channel == .email {
            return !subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        return true
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SectionLabel(
                        text: channel == .email
                            ? appState.t("New email campaign", "Nouvelle campagne e-mail")
                            : appState.t("New SMS campaign", "Nouvelle campagne SMS"),
                        wide: true
                    )

                    if channel == .email {
                        ADLInputField(
                            icon: "textformat",
                            placeholder: appState.t("Subject", "Objet"),
                            text: $subject
                        )
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        SectionLabel(text: channel == .email
                            ? appState.t("Body", "Corps")
                            : appState.t("Message", "Message"))
                        TextField(
                            channel == .email
                                ? appState.t("Write your email…", "Rédigez votre e-mail…")
                                : appState.t("Write your SMS…", "Rédigez votre SMS…"),
                            text: $messageBody,
                            axis: .vertical
                        )
                        .font(ADLFont.inter(15))
                        .lineLimit(6...12)
                        .padding(12)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous).stroke(ADLColor.line, lineWidth: 1))
                    }

                    if channel == .sms {
                        Text(appState.t(
                            "SMS sends incur per-segment cost across the selected audience.",
                            "Les SMS génèrent un coût par segment pour l'audience sélectionnée."
                        ))
                        .font(ADLFont.inter(12))
                        .foregroundColor(ADLColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    }

                    if let err = appState.commsError {
                        ADLCard {
                            Text(err)
                                .font(ADLFont.inter(13))
                                .foregroundColor(ADLColor.danger)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    Button {
                        Task {
                            let ok = await appState.createCampaign(
                                channel: channel,
                                subject: subject.trimmingCharacters(in: .whitespacesAndNewlines),
                                body: messageBody.trimmingCharacters(in: .whitespacesAndNewlines)
                            )
                            if ok { dismiss() }
                        }
                    } label: {
                        if appState.isSendingCampaign {
                            HStack(spacing: 8) {
                                ProgressView().tint(.white)
                                Text(appState.t("Sending…", "Envoi…"))
                            }
                        } else {
                            HStack(spacing: 8) {
                                Image(systemName: "paperplane.fill")
                                Text(appState.t("Send campaign", "Envoyer la campagne"))
                            }
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!canSend)
                }
                .padding(16)
            }
            .background(ADLColor.paper.ignoresSafeArea())
            .navigationTitle(channel.title(appState.language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(appState.t("Cancel", "Annuler")) { dismiss() }
                }
            }
        }
    }
}

struct AgentPerformanceView: View {
    @EnvironmentObject private var appState: AppState

    // Compute per-agent rows from leaderboard + analytics summary.
    // In demo mode the leaderboard is populated from /api/leaderboard.
    // activeAgents / totalSubs / avgQuality are derived the same way as AgentPerformance.tsx.
    private var agentRows: [LeaderboardEntry] { appState.leaderboard }
    private var activeAgents: Int { agentRows.filter { $0.xp > 0 }.count }
    private var totalSubs: Int { agentRows.reduce(0) { $0 + $1.contributions } }
    private var avgQuality: Int {
        guard !agentRows.isEmpty else { return 0 }
        let total = agentRows.reduce(0) { $0 + $1.averageQualityScore }
        return total / agentRows.count
    }

    // Trust tier from avgQuality (mirrors web tier logic)
    private func tier(for entry: LeaderboardEntry) -> TrustTier {
        if entry.averageQualityScore >= 85 { return .gold }
        if entry.averageQualityScore >= 70 { return .silver }
        return .bronze
    }

    // Tier gradient colors
    private func tierColors(for t: TrustTier) -> [Color] {
        switch t {
        case .gold: return [ADLColor.gold, Color(hex: 0xd97706)]
        case .silver: return [Color(hex: 0x9ca3af), Color(hex: 0x6b7280)]
        case .bronze: return [ADLColor.terracotta, Color(hex: 0x9b2c2c)]
        }
    }

    // Quality bar tint
    private func barTint(quality: Int) -> Color {
        if quality >= 90 { return ADLColor.forestDark }
        if quality >= 70 { return ADLColor.amber }
        return Color(hex: 0x991b1b)
    }

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: appState.t("Agent Performance", "Performance agents"))

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {

                    // KPI grid — 3 columns (mirrors web grid-cols-3)
                    HStack(spacing: 8) {
                        KpiTile(
                            label: appState.t("Active", "Actifs"),
                            value: appState.isLoadingLeaderboard ? "--" : "\(activeAgents)",
                            tone: .navy
                        )
                        KpiTile(
                            label: appState.t("Total Subs", "Soumissions"),
                            value: appState.isLoadingLeaderboard ? "--" : "\(totalSubs)",
                            tone: .forest
                        )
                        KpiTile(
                            label: appState.t("Avg Quality", "Qualité moy."),
                            value: appState.isLoadingLeaderboard ? "--" : "\(avgQuality)%",
                            tone: .amber
                        )
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)

                    // Section label
                    SectionLabel(text: appState.t("Agent Rankings", "Classement des agents"), wide: true)
                        .padding(.horizontal, 16)

                    // Agent rows
                    if appState.isLoadingLeaderboard && agentRows.isEmpty {
                        ADLCard {
                            Text(appState.t("Loading agent metrics...", "Chargement des métriques agents..."))
                                .font(ADLFont.inter(13))
                                .foregroundColor(Color(hex: 0x6b7280))
                        }
                        .padding(.horizontal, 16)
                    } else if agentRows.isEmpty {
                        ADLCard {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(appState.t("No agent data yet.", "Aucune donnée agent pour l'instant."))
                                    .font(ADLFont.inter(13, .semibold))
                                    .foregroundColor(Color(hex: 0x374151))
                                Text(appState.t(
                                    "Rankings populate after submissions are approved in the review queue.",
                                    "Les classements se remplissent après approbation des soumissions dans la file de revue."
                                ))
                                .font(ADLFont.inter(12))
                                .foregroundColor(Color(hex: 0x6b7280))
                                .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .padding(.horizontal, 16)
                    } else {
                        VStack(spacing: 10) {
                            ForEach(Array(agentRows.prefix(30).enumerated()), id: \.offset) { index, entry in
                                agentRow(rank: index + 1, entry: entry)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
                .padding(.bottom, 24)
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task {
            await appState.loadAnalytics()
            await appState.loadLeaderboard()
        }
        .refreshable {
            await appState.loadAnalytics(force: true)
            await appState.loadLeaderboard(force: true)
        }
    }

    @ViewBuilder
    private func agentRow(rank: Int, entry: LeaderboardEntry) -> some View {
        let t = tier(for: entry)
        let gradColors = tierColors(for: t)
        let initial = String((entry.name.first ?? "?").uppercased())

        // card-soft: white bg, border gray-100 (ADLColor.line)
        HStack(spacing: 12) {
            // Rank number
            Text("#\(rank)")
                .font(ADLFont.inter(13, .bold))
                .foregroundColor(Color(hex: 0xd1d5db))
                .frame(width: 28, alignment: .center)

            // Identity circle with tier gradient
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: gradColors, startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 40, height: 40)
                Text(initial)
                    .font(ADLFont.inter(15, .bold))
                    .foregroundColor(.white)
            }

            // Name + badges + metrics
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(entry.name)
                        .font(ADLFont.inter(13, .semibold))
                        .foregroundColor(ADLColor.ink)
                        .lineLimit(1)
                    TrustBadge(tier: t)
                }

                HStack(spacing: 10) {
                    Text("\(entry.contributions) \(appState.t("subs", "soum."))")
                        .font(ADLFont.inter(11))
                        .foregroundColor(Color(hex: 0x6b7280))
                    Text("\(entry.averageQualityScore)% \(appState.t("quality", "qualité"))")
                        .font(ADLFont.inter(11, .semibold))
                        .foregroundColor(ADLColor.forestDark)
                    Text("\(entry.xp) XP")
                        .font(ADLFont.inter(11, .semibold))
                        .foregroundColor(ADLColor.navy)
                }

                // Quality bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(ADLColor.line).frame(height: 4)
                        Capsule()
                            .fill(barTint(quality: entry.averageQualityScore))
                            .frame(width: max(0, min(1, Double(entry.averageQualityScore) / 100.0)) * geo.size.width, height: 4)
                    }
                }
                .frame(height: 4)
                .padding(.top, 4)
            }
        }
        .padding(12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
    }
}

struct ClientDashboardView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: appState.t("Delta Intelligence", "Intelligence Delta")) {
                Button(action: {}) {
                    Image(systemName: "square.and.arrow.down")
                        .font(.system(size: 20, weight: .regular))
                        .foregroundColor(ADLColor.navy)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Hero card — mirrors the navy gradient hero in DeltaDashboard.tsx
                    let summary = appState.analyticsSummary
                    VStack(alignment: .leading, spacing: 12) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(appState.t("Client Dashboard", "Tableau client").uppercased())
                                .font(ADLFont.inter(11, .bold))
                                .tracking(2.2)
                                .foregroundColor(.white.opacity(0.7))
                            Text(appState.t(
                                "What changed across the monitored network",
                                "Ce qui a changé sur le réseau suivi"
                            ))
                            .font(ADLFont.inter(22, .heavy))
                            .foregroundColor(.white)
                            .fixedSize(horizontal: false, vertical: true)
                            Text(appState.t(
                                "Exports inherit the exact current filter state.",
                                "Les exports reprennent exactement l'état courant des filtres."
                            ))
                            .font(ADLFont.inter(14))
                            .foregroundColor(.white.opacity(0.8))
                        }

                        // "Latest Report" badge aligned trailing
                        HStack {
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(appState.t("Latest Report", "Dernier rapport").uppercased())
                                    .font(ADLFont.inter(10, .bold))
                                    .tracking(1.2)
                                    .foregroundColor(.white.opacity(0.7))
                                Text(summary != nil
                                     ? appState.t("This week", "Cette semaine")
                                     : appState.t("No data yet", "Aucune donnée"))
                                    .font(ADLFont.inter(15, .bold))
                                    .foregroundColor(.white)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Color.white.opacity(0.15))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .background(
                        LinearGradient(
                            colors: [ADLColor.navy, ADLColor.navyMid],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

                    // KPI grid — mirrors the 4-tile grid in DeltaDashboard.tsx
                    let totalPoints = summary?.verification.totalPoints ?? 0
                    let wowDelta: Int? = {
                        guard appState.weeklyTrend.count >= 2 else { return nil }
                        let prev = appState.weeklyTrend[appState.weeklyTrend.count - 2].totalEvents
                        let curr = appState.weeklyTrend[appState.weeklyTrend.count - 1].totalEvents
                        guard prev > 0 else { return nil }
                        return Int(Double(curr - prev) / Double(prev) * 100)
                    }()
                    let verificationRate = summary?.verification.verificationRatePct ?? 0
                    let fraudRate = summary?.fraud.fraudRatePct ?? 0

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        KpiTile(
                            label: appState.t("Total Points", "Points totaux"),
                            value: "\(totalPoints)",
                            tone: .navy
                        )
                        KpiTile(
                            label: appState.t("vs Last Week", "vs semaine passée"),
                            value: wowDelta != nil ? "\(wowDelta! >= 0 ? "+" : "")\(wowDelta!)%" : "--",
                            tone: .forest
                        )
                        KpiTile(
                            label: appState.t("Verification", "Vérification"),
                            value: String(format: "%.0f%%", verificationRate),
                            tone: .navy
                        )
                        KpiTile(
                            label: appState.t("Fraud Rate", "Taux de fraude"),
                            value: String(format: "%.1f%%", fraudRate),
                            tone: .amber
                        )
                    }

                    // Weekly bar chart — mirrors WeeklyBarChart.tsx (7 bars, navy/navyLight, latest highlighted)
                    VStack(alignment: .leading, spacing: 10) {
                        SectionLabel(text: appState.t(
                            "Recent weekly submissions",
                            "Soumissions hebdomadaires récentes"
                        ))

                        let trend = appState.weeklyTrend
                        let dayLabels = ["S", "M", "T", "W", "T", "F", "S"]

                        // Pad or trim to exactly 7 entries
                        let bars: [WeeklyTrendBar] = {
                            let raw = trend.suffix(7)
                            if raw.count < 7 {
                                let padding = (0..<(7 - raw.count)).map {
                                    WeeklyTrendBar(weekStart: "pad-\($0)", totalEvents: 0)
                                }
                                return padding + Array(raw)
                            }
                            return Array(raw)
                        }()

                        let maxVal = max(bars.map(\.totalEvents).max() ?? 1, 1)

                        ADLCard {
                            HStack(alignment: .bottom, spacing: 6) {
                                ForEach(Array(bars.enumerated()), id: \.offset) { index, bar in
                                    let isHighlight = index == 6  // last bar = terra (latest week)
                                    let heightFraction = max(CGFloat(bar.totalEvents) / CGFloat(maxVal), 0.03)

                                    VStack(spacing: 4) {
                                        if bar.totalEvents > 0 {
                                            Text("\(bar.totalEvents)")
                                                .font(ADLFont.inter(9, .bold))
                                                .foregroundColor(Color(hex: 0x9ca3af))
                                        } else {
                                            Spacer().frame(height: 12)
                                        }
                                        GeometryReader { geo in
                                            VStack(spacing: 0) {
                                                Spacer()
                                                RoundedRectangle(cornerRadius: 3, style: .continuous)
                                                    .fill(isHighlight ? ADLColor.navy : ADLColor.navyLight)
                                                    .frame(height: geo.size.height * heightFraction)
                                            }
                                        }
                                        .frame(maxWidth: .infinity)
                                        Text(dayLabels[index])
                                            .font(ADLFont.inter(9))
                                            .foregroundColor(Color(hex: 0x9ca3af))
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                            }
                            .frame(height: 90)
                        }
                    }

                    // Data quality row
                    ADLCard {
                        HStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 4) {
                                SectionLabel(text: appState.t("Active Contributors", "Agents actifs"), wide: true)
                                Text("\(summary?.weeklyActiveContributors ?? 0)")
                                    .font(ADLFont.inter(22, .heavy))
                                    .foregroundColor(ADLColor.navy)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            Rectangle()
                                .fill(ADLColor.line)
                                .frame(width: 1, height: 40)

                            VStack(alignment: .leading, spacing: 4) {
                                SectionLabel(text: appState.t("Enrichment", "Enrichissement"), wide: true)
                                Text(String(format: "%.0f%%", summary?.enrichmentRatePct ?? 0))
                                    .font(ADLFont.inter(22, .heavy))
                                    .foregroundColor(ADLColor.terracotta)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.vertical, 4)
                    }
                }
                .padding(16)
                .padding(.bottom, 24)
            }
            .refreshable { await appState.loadAnalytics(force: true) }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task { await appState.loadAnalytics() }
    }
}

// MARK: - Investor Dashboard

struct InvestorDashboardView: View {
    @EnvironmentObject private var appState: AppState

    // MARK: - Derived data

    private var summary: AnalyticsSummary? { appState.analyticsSummary }

    private var totalPoints: Int { summary?.verification.totalPoints ?? 0 }
    private var verifiedPoints: Int { summary?.verification.verifiedPoints ?? 0 }
    private var verificationRate: Double { summary?.verification.verificationRatePct ?? 0 }
    private var fraudRate: Double { summary?.fraud.fraudRatePct ?? 0 }
    private var enrichmentRate: Double { summary?.enrichmentRatePct ?? 0 }
    private var activeContributors: Int { summary?.weeklyActiveContributors ?? 0 }

    private var wowDelta: Int? {
        guard appState.weeklyTrend.count >= 2 else { return nil }
        let prev = appState.weeklyTrend[appState.weeklyTrend.count - 2].totalEvents
        let curr = appState.weeklyTrend[appState.weeklyTrend.count - 1].totalEvents
        guard prev > 0 else { return nil }
        return Int(Double(curr - prev) / Double(prev) * 100)
    }

    private var weeklyBars: [WeeklyTrendBar] {
        let raw = appState.weeklyTrend.suffix(7)
        if raw.count < 7 {
            let padding = (0..<(7 - raw.count)).map {
                WeeklyTrendBar(weekStart: "pad-\($0)", totalEvents: 0)
            }
            return padding + Array(raw)
        }
        return Array(raw)
    }

    // Quality distribution derived from leaderboard
    private struct DistBucket: Identifiable {
        let id: String
        let label: String
        let value: Int
        let color: Color
    }

    private var qualityBuckets: [DistBucket] {
        var excellent = 0, high = 0, medium = 0, low = 0
        for entry in appState.leaderboard {
            let q = entry.averageQualityScore
            if q >= 80 { excellent += 1 }
            else if q >= 60 { high += 1 }
            else if q >= 40 { medium += 1 }
            else { low += 1 }
        }
        return [
            DistBucket(id: "excellent", label: appState.t("Excellent", "Excellent"), value: excellent, color: Color(hex: 0x4c7c59)),
            DistBucket(id: "high",      label: appState.t("High", "Haut"),            value: high,      color: Color(hex: 0x0f2b46)),
            DistBucket(id: "medium",    label: appState.t("Medium", "Moyen"),          value: medium,    color: Color(hex: 0xc86b4a)),
            DistBucket(id: "low",       label: appState.t("Low", "Bas"),              value: low,       color: Color(hex: 0xd69e2e)),
        ].filter { $0.value > 0 }
    }

    private var trustTierBuckets: [DistBucket] {
        var elite = 0, trusted = 0, standard = 0, newTier = 0
        for entry in appState.leaderboard {
            let q = entry.averageQualityScore
            if q >= 75 { elite += 1 }
            else if q >= 50 { trusted += 1 }
            else if q >= 30 { standard += 1 }
            else { newTier += 1 }
        }
        return [
            DistBucket(id: "elite",    label: appState.t("Elite", "Élite"),          value: elite,    color: Color(hex: 0x4c7c59)),
            DistBucket(id: "trusted",  label: appState.t("Trusted", "Confiance"),    value: trusted,  color: Color(hex: 0x0f2b46)),
            DistBucket(id: "standard", label: appState.t("Standard", "Standard"),   value: standard, color: Color(hex: 0xc86b4a)),
            DistBucket(id: "new",      label: appState.t("New", "Nouveau"),          value: newTier,  color: Color(hex: 0xd5e1eb)),
        ].filter { $0.value > 0 }
    }

    private var verificationDonut: [DistBucket] {
        let unverified = max(0, totalPoints - verifiedPoints)
        return [
            DistBucket(id: "verified",   label: appState.t("Verified", "Vérifié"),       value: verifiedPoints, color: Color(hex: 0x4c7c59)),
            DistBucket(id: "unverified", label: appState.t("Unverified", "Non vérifié"), value: unverified,     color: Color(hex: 0xd5e1eb)),
        ].filter { $0.value > 0 }
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: appState.t("Investor Dashboard", "Tableau investisseur")) {
                Color.clear.frame(width: 44, height: 44)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {

                    // MARK: Network-status hero (navy)
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("AFRICAN DATA LAYER")
                                    .font(ADLFont.inter(13, .bold))
                                    .foregroundColor(.white)
                                Text(appState.t("Client Dashboard", "Tableau client"))
                                    .font(ADLFont.inter(11))
                                    .foregroundColor(.white.opacity(0.5))
                            }
                            Spacer()
                            Text(appState.t("Client", "Client").uppercased())
                                .font(ADLFont.inter(10, .bold))
                                .tracking(1.2)
                                .foregroundColor(.white.opacity(0.7))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Color.white.opacity(0.12))
                                .clipShape(Capsule())
                        }

                        // Network status sub-card
                        VStack(alignment: .leading, spacing: 6) {
                            Text(appState.t("Network status", "Statut réseau").uppercased())
                                .font(ADLFont.inter(9, .bold))
                                .tracking(1.8)
                                .foregroundColor(.white.opacity(0.5))

                            if totalPoints > 0 {
                                Text("\(appState.t("Active network", "Réseau actif")) · \(totalPoints.formatted()) \(appState.t("points mapped", "points cartographiés"))")
                                    .font(ADLFont.inter(17, .bold))
                                    .foregroundColor(.white)
                                    .fixedSize(horizontal: false, vertical: true)
                                if let delta = wowDelta {
                                    HStack(spacing: 4) {
                                        Image(systemName: delta >= 0 ? "arrow.up.right" : "arrow.down.right")
                                            .font(.system(size: 11, weight: .semibold))
                                        Text("\(delta >= 0 ? "+" : "")\(delta)% \(appState.t("this week", "cette semaine"))")
                                            .font(ADLFont.inter(11, .semibold))
                                    }
                                    .foregroundColor(delta >= 0 ? Color(hex: 0x4ade80) : Color(hex: 0xf87171))
                                }
                            } else {
                                Text(appState.t("Awaiting first capture", "En attente de la première capture"))
                                    .font(ADLFont.inter(17, .bold))
                                    .foregroundColor(.white.opacity(0.6))
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(appState.t("Field agents are being onboarded.", "Les agents terrain sont en cours d'intégration."))
                                    .font(ADLFont.inter(11))
                                    .foregroundColor(.white.opacity(0.4))
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .background(Color.white.opacity(0.08))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Color.white.opacity(0.1), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                        // Stats pair
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(appState.t("Verified", "Vérifiés").uppercased())
                                    .font(ADLFont.inter(9, .bold))
                                    .tracking(1.6)
                                    .foregroundColor(.white.opacity(0.5))
                                Text("\(verifiedPoints.formatted())")
                                    .font(ADLFont.inter(22, .heavy))
                                    .foregroundColor(.white)
                                Text("/ \(totalPoints.formatted()) \(appState.t("total", "total"))")
                                    .font(ADLFont.inter(11))
                                    .foregroundColor(.white.opacity(0.4))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(Color.white.opacity(0.08))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.white.opacity(0.1), lineWidth: 1))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                            VStack(alignment: .leading, spacing: 4) {
                                Text(appState.t("Coverage", "Couverture").uppercased())
                                    .font(ADLFont.inter(9, .bold))
                                    .tracking(1.6)
                                    .foregroundColor(.white.opacity(0.5))
                                Text(String(format: "%.0f%%", verificationRate))
                                    .font(ADLFont.inter(22, .heavy))
                                    .foregroundColor(verificationRate > 0 ? Color(hex: 0xf4c317) : .white.opacity(0.4))
                                Text(appState.t("Bonamoussadi", "Bonamoussadi"))
                                    .font(ADLFont.inter(11))
                                    .foregroundColor(.white.opacity(0.4))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(verificationRate > 0 ? Color(hex: 0xf4c317).opacity(0.15) : Color.white.opacity(0.08))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(verificationRate > 0 ? Color(hex: 0xf4c317).opacity(0.2) : Color.white.opacity(0.1), lineWidth: 1))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(ADLColor.navy)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

                    // MARK: KPI tile grid
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        KpiTile(
                            label: appState.t("Total Points", "Points totaux"),
                            value: "\(totalPoints.formatted())",
                            tone: .navy,
                            systemIcon: "mappin.and.ellipse"
                        )
                        KpiTile(
                            label: appState.t("Active Agents", "Agents actifs"),
                            value: "\(activeContributors)",
                            tone: .forest,
                            systemIcon: "person.2.fill"
                        )
                        KpiTile(
                            label: appState.t("Verification", "Vérification"),
                            value: String(format: "%.0f%%", verificationRate),
                            tone: .navy,
                            systemIcon: "checkmark.seal.fill"
                        )
                        KpiTile(
                            label: appState.t("Fraud Rate", "Taux fraude"),
                            value: String(format: "%.1f%%", fraudRate),
                            tone: .amber,
                            systemIcon: "exclamationmark.shield.fill"
                        )
                    }

                    // MARK: Weekly submission bars
                    VStack(alignment: .leading, spacing: 10) {
                        SectionLabel(text: appState.t("Weekly submissions", "Soumissions hebdo."))
                        let bars = weeklyBars
                        let maxVal = max(bars.map(\.totalEvents).max() ?? 1, 1)
                        let dayLabels = ["S", "M", "T", "W", "T", "F", "S"]
                        ADLCard {
                            HStack(alignment: .bottom, spacing: 6) {
                                ForEach(Array(bars.enumerated()), id: \.offset) { index, bar in
                                    let isHighlight = index == 6
                                    let heightFraction = max(CGFloat(bar.totalEvents) / CGFloat(maxVal), 0.03)
                                    VStack(spacing: 4) {
                                        if bar.totalEvents > 0 {
                                            Text("\(bar.totalEvents)")
                                                .font(ADLFont.inter(9, .bold))
                                                .foregroundColor(Color(hex: 0x9ca3af))
                                        } else {
                                            Spacer().frame(height: 12)
                                        }
                                        GeometryReader { geo in
                                            VStack(spacing: 0) {
                                                Spacer()
                                                RoundedRectangle(cornerRadius: 3, style: .continuous)
                                                    .fill(isHighlight ? ADLColor.terracotta : ADLColor.navyLight)
                                                    .frame(height: geo.size.height * heightFraction)
                                            }
                                        }
                                        .frame(maxWidth: .infinity)
                                        Text(dayLabels[index])
                                            .font(ADLFont.inter(9))
                                            .foregroundColor(Color(hex: 0x9ca3af))
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                            }
                            .frame(height: 90)
                        }
                    }

                    // MARK: Quality distribution bar chart
                    if !qualityBuckets.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionLabel(text: appState.t("Quality distribution", "Distribution qualité"))
                            ADLCard {
                                let maxQ = max(qualityBuckets.map(\.value).max() ?? 1, 1)
                                VStack(spacing: 10) {
                                    ForEach(qualityBuckets) { bucket in
                                        HStack(spacing: 10) {
                                            Text(bucket.label)
                                                .font(ADLFont.inter(11, .semibold))
                                                .foregroundColor(.secondary)
                                                .frame(width: 68, alignment: .leading)
                                                .lineLimit(1)
                                            GeometryReader { proxy in
                                                RoundedRectangle(cornerRadius: 5, style: .continuous)
                                                    .fill(bucket.color)
                                                    .frame(width: max(8, CGFloat(bucket.value) / CGFloat(maxQ) * proxy.size.width))
                                            }
                                            .frame(height: 18)
                                            Text("\(bucket.value)")
                                                .font(ADLFont.inter(11, .bold))
                                                .foregroundColor(ADLColor.inkMuted)
                                                .frame(width: 28, alignment: .trailing)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // MARK: Trust tier distribution (SectorMark donut) + Verification donut side by side
                    if !trustTierBuckets.isEmpty || !verificationDonut.isEmpty {
                        HStack(alignment: .top, spacing: 10) {
                            // Trust tiers
                            if !trustTierBuckets.isEmpty {
                                investorDonutCard(
                                    title: appState.t("Trust Tiers", "Niveaux confiance"),
                                    buckets: trustTierBuckets
                                )
                            }
                            // Verification split
                            if !verificationDonut.isEmpty {
                                investorDonutCard(
                                    title: appState.t("Verification", "Vérification"),
                                    buckets: verificationDonut
                                )
                            }
                        }
                    }

                    // MARK: Enrichment + pending row
                    ADLCard {
                        HStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 4) {
                                SectionLabel(text: appState.t("Enrichment", "Enrichissement"), wide: true)
                                Text(String(format: "%.0f%%", enrichmentRate))
                                    .font(ADLFont.inter(22, .heavy))
                                    .foregroundColor(ADLColor.terracotta)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            Rectangle()
                                .fill(ADLColor.line)
                                .frame(width: 1, height: 40)

                            VStack(alignment: .leading, spacing: 4) {
                                SectionLabel(text: appState.t("Pending review", "En attente"), wide: true)
                                Text("\(summary?.reviewQueue.pendingReview ?? 0)")
                                    .font(ADLFont.inter(22, .heavy))
                                    .foregroundColor(ADLColor.navy)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.vertical, 4)
                    }
                }
                .padding(16)
                .padding(.bottom, 24)
            }
            .refreshable { await appState.loadAnalytics(force: true) }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task {
            await appState.loadAnalytics()
            await appState.loadLeaderboard()
        }
    }

    @ViewBuilder
    private func investorDonutCard(title: String, buckets: [DistBucket]) -> some View {
        let total = max(buckets.map(\.value).reduce(0, +), 1)
        ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                SectionLabel(text: title)
                Chart {
                    ForEach(buckets) { bucket in
                        SectorMark(
                            angle: .value(bucket.label, bucket.value),
                            innerRadius: .ratio(0.52),
                            angularInset: 1.5
                        )
                        .foregroundStyle(bucket.color)
                        .cornerRadius(3)
                    }
                }
                .frame(height: 90)
                .chartLegend(.hidden)

                VStack(alignment: .leading, spacing: 4) {
                    ForEach(buckets) { bucket in
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(bucket.color)
                                .frame(width: 8, height: 8)
                            Text(bucket.label)
                                .font(ADLFont.inter(10, .semibold))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                            Spacer()
                            Text("\(Int(Double(bucket.value) / Double(total) * 100))%")
                                .font(ADLFont.inter(10, .bold))
                                .foregroundColor(ADLColor.ink)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct AnalyticsView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: headerTitle, onBack: goBack) {
                if isClient {
                    Color.clear
                } else {
                    Button(action: {}) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundColor(Color(hex: 0x9ca3af))
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                }
            }

            ScrollView {
                Group {
                    if isAdmin {
                        adminContent
                    } else if isClient {
                        clientContent
                    } else {
                        contributorContent
                    }
                }
            }
            .refreshable {
                await appState.loadAnalytics(force: true)
                await appState.loadLeaderboard(force: true)
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task {
            await appState.loadAnalytics()
            await appState.loadLeaderboard()
        }
    }

    private var isAdmin: Bool { appState.selectedRole == .admin }
    private var isClient: Bool { appState.selectedRole == .client }

    private var headerTitle: String {
        if isAdmin { return appState.t("Investor Analytics", "Analytique investisseur") }
        if isClient { return appState.t("Insights Center", "Centre d'insights") }
        return appState.t("Leaderboard", "Classement")
    }

    private func goBack() {
        appState.selectedTab = AppReleaseMode.defaultTab(for: appState.selectedRole)
    }

    private var topVerticalChampion: (String, Int)? {
        var totals: [String: Int] = [:]
        for entry in appState.leaderboard {
            for (vertical, count) in entry.verticalBreakdown {
                totals[vertical, default: 0] += count
            }
        }
        return totals.max { $0.value < $1.value }
    }

    private var categoryRows: [(SubmissionCategory, Int)] {
        let grouped = Dictionary(grouping: appState.points, by: \.category).mapValues(\.count)
        return SubmissionCategory.allCases.map { ($0, grouped[$0] ?? 0) }
    }

    private var contributorContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Section eyebrow + title — mirrors web Analytics contributorMode header
            VStack(alignment: .leading, spacing: 5) {
                SectionLabel(text: appState.t("Leaderboard", "Classement"))
                Text(appState.t("Top contributors near you", "Top contributeurs près de vous"))
                    .font(ADLFont.inter(20, .bold))
                    .foregroundColor(ADLColor.ink)
            }
            .padding(.horizontal, 4)
            .padding(.top, 4)

            // "How scoring works" card
            ADLCard {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: appState.t("How scoring works", "Comment fonctionne le classement"))
                    Text(appState.t("Score = verified submissions × average quality", "Score = soumissions vérifiées × qualité moyenne"))
                        .font(ADLFont.inter(14, .semibold))
                        .foregroundColor(ADLColor.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            // Loading / empty / rows
            if appState.isLoadingLeaderboard && appState.leaderboard.isEmpty {
                ADLCard {
                    ProgressView()
                        .tint(ADLColor.terracotta)
                        .frame(maxWidth: .infinity)
                        .padding(8)
                }
            } else if let errorMsg = appState.leaderboardError {
                ADLCard {
                    Text(errorMsg)
                        .font(ADLFont.inter(13, .semibold))
                        .foregroundColor(ADLColor.terracotta)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else if appState.leaderboard.isEmpty {
                ADLCard {
                    Text(appState.t("No contributor data yet.", "Aucun contributeur pour l'instant."))
                        .font(ADLFont.inter(13, .semibold))
                        .foregroundColor(Color(hex: 0x374151))
                }
            } else {
                let maxXP = max(appState.leaderboard.map(\.xp).max() ?? 1, 1)
                VStack(spacing: 10) {
                    ForEach(Array(appState.leaderboard.prefix(20).enumerated()), id: \.offset) { index, entry in
                        AgentLeaderboardRow(rank: index + 1, entry: entry, maxXP: maxXP)
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 24)
    }

    private var clientContent: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 5) {
                Text(appState.t("CLIENT INSIGHTS", "ANALYSES CLIENT"))
                    .font(ADLFont.inter(11, .bold))
                    .foregroundColor(ADLColor.inkMuted)
                Text(appState.t(
                    "Your data, two ways - map-level context or executive summary",
                    "Vos données en deux vues - contexte cartographique ou résumé exécutif"
                ))
                    .font(ADLFont.inter(14, .semibold))
                    .foregroundColor(ADLColor.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 2)

            clientKpiGrid

            ADLCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Label(appState.t("HOW CLIENTS USE THIS SURFACE", "UTILISATION CLIENT"), systemImage: "chart.bar.fill")
                            .font(ADLFont.inter(11, .bold))
                            .foregroundColor(ADLColor.ink)
                        Spacer()
                        Text(appState.t("ROLE-SPECIFIC", "PAR RÔLE"))
                            .font(ADLFont.inter(11, .semibold))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text(clientTopCategoryText)
                            .font(ADLFont.inter(14, .semibold))
                            .foregroundColor(ADLColor.ink)
                        Text(appState.t(
                            "Use the Delta and Dashboard tabs for the full dedicated views. This Insights page summarizes the live signals those pages are built from.",
                            "Utilisez les onglets Delta et Dashboard pour les vues complètes. Cette page Insights résume les signaux live qui alimentent ces pages."
                        ))
                            .font(ADLFont.inter(12, .regular))
                            .foregroundColor(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16)
                    .background(ADLColor.paper)
                    .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
                }
            }

            networkPulsePanel
        }
        .padding(16)
        .padding(.bottom, 24)
    }

    private var adminContent: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 12) {
                IdentityCircle(name: appState.profile.name, size: 48)
                    .overlay(Circle().stroke(Color.white, lineWidth: 2))
                    .shadow(color: Color.black.opacity(0.12), radius: 3, x: 0, y: 1)
                VStack(alignment: .leading, spacing: 4) {
                    Text(appState.profile.name)
                        .font(ADLFont.inter(14, .bold))
                        .foregroundColor(ADLColor.ink)
                    Label(appState.t("Senior Contributor", "Contributeur senior"), systemImage: "checkmark.shield.fill")
                        .font(ADLFont.inter(11, .semibold))
                        .foregroundColor(ADLColor.inkMuted)
                }
                Spacer()
                Text(appState.t("Admin", "Admin").uppercased())
                    .font(ADLFont.inter(11, .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(ADLColor.ink)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            adminKpiGrid
            categoryBarsCard
            xpDistributionCard
            freshnessHeatmapCard
            leaderboardPanel(
                title: appState.t("Top Contributor Leaderboard", "Classement des meilleurs contributeurs"),
                scope: appState.t("Monthly", "Mensuel"),
                entries: appState.leaderboard,
                compact: true
            )

            VStack(spacing: 10) {
                Text(appState.t("Enterprise API Access", "Accès API entreprise").uppercased())
                    .font(ADLFont.inter(11, .bold))
                    .foregroundColor(ADLColor.navy)
                Text(appState.t(
                    "Structured data access for municipalities, NGOs, and logistics teams - with guaranteed uptime.",
                    "Accès structuré aux données pour municipalités, ONG et équipes logistiques - avec disponibilité garantie."
                ))
                    .font(ADLFont.inter(12, .regular))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(ADLColor.paper)
            .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous)
                    .stroke(ADLColor.lineStrong, style: StrokeStyle(lineWidth: 2, dash: [7, 5]))
            )
        }
        .padding(16)
        .padding(.bottom, 24)
    }

    private var clientKpiGrid: some View {
        let summary = appState.analyticsSummary
        let tracked = summary?.verification.totalPoints ?? appState.points.count
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ADLMiniStat(label: appState.t("Tracked points", "Points suivis"), value: tracked.formatted(), suffix: appState.t("latest", "récent"), suffixTint: ADLColor.navy)
            ADLMiniStat(label: appState.t("Completion rate", "Taux d'achèvement"), value: KpiFormat.pct(summary?.verification.verificationRatePct ?? 0), suffix: appState.isLoadingAnalytics ? "..." : appState.t("live", "direct"))
            ADLMiniStat(label: appState.t("Anomaly flags", "Alertes anomalie"), value: "\(summary?.reviewQueue.highRiskEvents ?? 0)", suffix: appState.t("watchlist", "surveillance"), suffixTint: ADLColor.terracotta)
            ADLMiniStat(label: appState.t("Avg WoW growth", "Croissance hebdo. moy."), value: weeklyGrowth, suffix: appState.t("tracked", "suivi"), suffixTint: ADLColor.forest)
        }
    }

    private var adminKpiGrid: some View {
        let summary = appState.analyticsSummary
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ADLMiniStat(label: appState.t("Data complete", "Données complètes"), value: KpiFormat.pct(summary?.verification.verificationRatePct ?? 0), suffix: appState.isLoadingAnalytics ? "..." : appState.t("live", "direct"))
            ADLMiniStat(label: appState.t("Active contributors", "Contributeurs actifs"), value: "\(summary?.weeklyActiveContributors ?? 0)", suffix: "30j", suffixTint: ADLColor.navy)
            ADLMiniStat(label: appState.t("Pending review", "En attente"), value: "\(summary?.reviewQueue.pendingReview ?? 0)", suffix: appState.t("queue", "file"), suffixTint: ADLColor.gold)
            ADLMiniStat(label: appState.t("Fraud rate", "Taux fraude"), value: KpiFormat.pct(summary?.fraud.fraudRatePct ?? 0), suffix: appState.t("risk", "risque"), suffixTint: ADLColor.terracotta)
        }
    }

    private var categoryBarsCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Label(appState.t("Contributions by Category", "Contributions par catégorie").uppercased(), systemImage: "chart.bar.fill")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    Text(appState.t("Live", "Direct").uppercased())
                        .font(ADLFont.inter(11, .semibold))
                        .foregroundColor(ADLColor.inkMuted)
                }
                let maxValue = max(categoryRows.map(\.1).max() ?? 1, 1)
                VStack(spacing: 10) {
                    ForEach(categoryRows, id: \.0.id) { category, value in
                        HStack(spacing: 10) {
                            Text(category.title)
                                .font(ADLFont.inter(10, .semibold))
                                .foregroundColor(.secondary)
                                .frame(width: 86, alignment: .leading)
                                .lineLimit(1)
                                .minimumScaleFactor(0.65)
                            GeometryReader { proxy in
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(category.tint)
                                    .frame(width: max(8, CGFloat(value) / CGFloat(maxValue) * proxy.size.width))
                            }
                            .frame(height: 18)
                            Text("\(value)")
                                .font(ADLFont.inter(11, .bold))
                                .foregroundColor(ADLColor.inkMuted)
                                .frame(width: 24, alignment: .trailing)
                        }
                    }
                }
            }
        }
    }

    private var xpDistributionCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Label(appState.t("XP Distribution", "Distribution XP").uppercased(), systemImage: "medal.fill")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    Text(appState.t("All Users", "Tous utilisateurs").uppercased())
                        .font(ADLFont.inter(11, .semibold))
                        .foregroundColor(ADLColor.inkMuted)
                }
                HStack(spacing: 14) {
                    ForEach(xpBuckets, id: \.label) { bucket in
                        VStack(spacing: 8) {
                            ZStack(alignment: .bottom) {
                                Capsule().fill(ADLColor.line)
                                Capsule()
                                    .fill(bucket.color)
                                    .frame(height: CGFloat(max(bucket.count, 1)) / CGFloat(maxXPBucketCount) * 92)
                            }
                            .frame(width: 32, height: 92)
                            Text(bucket.label)
                                .font(ADLFont.inter(10, .bold))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }

    private var freshnessHeatmapCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Label(appState.t("Data Freshness Heatmap", "Carte de fraîcheur").uppercased(), systemImage: "thermometer.sun.fill")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    Text(appState.t("Last 24h", "24 h").uppercased())
                        .font(ADLFont.inter(11, .semibold))
                        .foregroundColor(ADLColor.inkMuted)
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                    ForEach(0..<16, id: \.self) { index in
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(heatColor(index))
                            .frame(height: 32)
                    }
                }
            }
        }
    }

    private var networkPulsePanel: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Label(appState.t("Field Network Pulse", "Pulse du réseau terrain").uppercased(), systemImage: "person.2.fill")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    Text(appState.t("Top 3 Contributors", "Top 3 contributeurs").uppercased())
                        .font(ADLFont.inter(11, .semibold))
                        .foregroundColor(ADLColor.inkMuted)
                }
                leaderboardRows(entries: Array(appState.leaderboard.prefix(3)), compact: true)
            }
        }
    }

    private func leaderboardPanel(title: String, scope: String, entries: [LeaderboardEntry], compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title.uppercased())
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.ink)
                    Text(scope.uppercased())
                        .font(ADLFont.inter(11, .semibold))
                        .foregroundColor(ADLColor.inkMuted)
                }
                Spacer()
                Text(appState.t("Live", "Direct").uppercased())
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(appState.t("How Rankings Work", "Fonctionnement du classement").uppercased())
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
                Text(compact
                     ? appState.t("Ranking score = submissions x average quality", "Score classement = soumissions x qualité moyenne")
                     : appState.t("Score = verified submissions x average quality", "Score = soumissions vérifiées x qualité moyenne"))
                    .font(ADLFont.inter(14, .semibold))
                    .foregroundColor(ADLColor.ink)
                if let topVerticalChampion {
                    Text(appState.t(
                        "Busiest category: \(categoryTitle(topVerticalChampion.0)) (\(topVerticalChampion.1))",
                        "Catégorie la plus active : \(categoryTitle(topVerticalChampion.0)) (\(topVerticalChampion.1))"
                    ))
                        .font(ADLFont.inter(12, .regular))
                        .foregroundColor(.secondary)
                }
            }
            .padding(16)
            .background(ADLColor.paper)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(ADLColor.line, lineWidth: 1)
            )

            leaderboardRows(entries: entries, compact: compact)
        }
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: compact ? ADLRadius.card : ADLRadius.pill, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: compact ? ADLRadius.card : ADLRadius.pill, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
    }

    @ViewBuilder
    private func leaderboardRows(entries: [LeaderboardEntry], compact: Bool) -> some View {
        if appState.isLoadingLeaderboard && entries.isEmpty {
            Text(appState.t("Loading contributors...", "Chargement des contributeurs..."))
                .font(ADLFont.inter(11, .semibold))
                .foregroundColor(ADLColor.inkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(ADLColor.paper)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(ADLColor.line, lineWidth: 1))
        } else if entries.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(appState.t("No contributors yet.", "Aucun contributeur pour le moment."))
                    .font(ADLFont.inter(13, .semibold))
                    .foregroundColor(Color(hex: 0x374151))
                Text(appState.t(
                    "Score = verified submissions x average quality. Submit your first capture to appear here.",
                    "Score = soumissions vérifiées x qualité moyenne. Envoyez votre première capture pour apparaître ici."
                ))
                    .font(ADLFont.inter(12, .regular))
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(ADLColor.paper)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(ADLColor.line, lineWidth: 1))
        } else {
            VStack(spacing: 12) {
                ForEach(entries.prefix(compact ? 6 : 20)) { entry in
                    ADLLeaderboardRow(entry: entry, compact: compact)
                }
            }
        }
    }

    private var clientTopCategoryText: String {
        guard let topVerticalChampion else { return "No category data yet" }
        return "Top tracked category: \(categoryTitle(topVerticalChampion.0))"
    }

    private var weeklyGrowth: String {
        guard appState.weeklyTrend.count >= 2,
              let previous = appState.weeklyTrend.dropLast().last?.totalEvents,
              let latest = appState.weeklyTrend.last?.totalEvents,
              previous > 0
        else { return "0%" }
        let growth = (Double(latest - previous) / Double(previous)) * 100
        return KpiFormat.pct(growth)
    }

    private func categoryTitle(_ raw: String) -> String {
        SubmissionCategory(rawValue: raw)?.title ?? raw
    }

    private var xpBuckets: [(label: String, count: Int, color: Color)] {
        let rows = appState.leaderboard
        let buckets = [
            ("0-1k", rows.filter { $0.xp < 1_000 }.count, ADLColor.navy),
            ("1-5k", rows.filter { (1_000..<5_000).contains($0.xp) }.count, ADLColor.terracotta),
            ("5-10k", rows.filter { (5_000..<10_000).contains($0.xp) }.count, ADLColor.forest),
            ("10k+", rows.filter { $0.xp >= 10_000 }.count, ADLColor.gold)
        ]
        return buckets
    }

    private var maxXPBucketCount: Int {
        max(xpBuckets.map(\.count).max() ?? 1, 1)
    }

    private func heatColor(_ index: Int) -> Color {
        let total = appState.weeklyTrend.map(\.totalEvents).reduce(0, +)
        let level = (index + total) % 4
        switch level {
        case 0: return ADLColor.line
        case 1: return ADLColor.forestWash
        case 2: return ADLColor.gold.opacity(0.55)
        default: return ADLColor.terracotta.opacity(0.72)
        }
    }
}

struct RewardsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var pendingReward: Reward?
    @State private var redeemedVoucher: Voucher?
    @State private var redeemError: String?

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: appState.t("Rewards", "Récompenses"))
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    // XP balance hero — navy card matching web's bg-navy p-6 rounded-2xl
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(appState.t("Your Balance", "Votre solde").uppercased())
                                .font(ADLFont.inter(11, .bold))
                                .tracking(2.0)
                                .foregroundColor(.white.opacity(0.80))
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text("\(appState.spendableXP.formatted())")
                                    .font(ADLFont.inter(30, .bold))
                                    .foregroundColor(.white)
                                Text("XP")
                                    .font(ADLFont.inter(14, .medium))
                                    .foregroundColor(.white.opacity(0.60))
                            }
                            if appState.spentXP > 0 {
                                Text(appState.t("\(appState.spentXP) XP redeemed so far",
                                               "\(appState.spentXP) XP échangés jusqu'ici"))
                                    .font(ADLFont.inter(12))
                                    .foregroundColor(.white.opacity(0.70))
                            }
                        }
                        Spacer()
                        Image(systemName: "gift.fill")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(12)
                            .background(Color.white.opacity(0.20))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .padding(24)
                    .background(ADLColor.navy)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .shadow(color: ADLColor.navy.opacity(0.28), radius: 14, x: 0, y: 6)

                    if let redeemError {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(ADLColor.terracotta)
                            Text(redeemError)
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(ADLColor.ink)
                        }
                        .padding(12)
                        .background(ADLColor.terraWash)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    SectionLabel(text: appState.t("Redeemable Rewards", "Récompenses échangeables"))
                        .padding(.horizontal, 4)

                    VStack(spacing: 12) {
                        ForEach(appState.catalog) { reward in
                            RewardCard(reward: reward, affordable: appState.spendableXP >= reward.costXP) {
                                redeemError = nil
                                pendingReward = reward
                            }
                        }
                    }

                    if !appState.vouchers.isEmpty {
                        SectionLabel(text: appState.t("Your Wallet", "Votre portefeuille"))
                            .padding(.horizontal, 4)
                        VStack(spacing: 8) {
                            ForEach(appState.vouchers) { voucher in
                                VoucherRow(voucher: voucher)
                            }
                        }
                    }
                }
                .padding(16)
                .padding(.bottom, 32)
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task { await appState.loadProfile() }
        .refreshable { await appState.loadProfile(force: true) }
        .sheet(item: $pendingReward) { reward in
            RedeemConfirmSheet(reward: reward, balance: appState.spendableXP) {
                do {
                    let voucher = try appState.redeem(reward)
                    pendingReward = nil
                    redeemedVoucher = voucher
                } catch {
                    pendingReward = nil
                    redeemError = error.localizedDescription
                }
            }
        }
        .sheet(item: $redeemedVoucher) { voucher in
            VoucherSuccessSheet(voucher: voucher)
        }
    }
}

struct RedeemConfirmSheet: View {
    let reward: Reward
    let balance: Int
    let onConfirm: () -> Void
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    private var affordable: Bool { balance >= reward.costXP }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text(appState.t("Confirm Redemption", "Confirmer l'échange"))
                    .font(ADLFont.inter(15, .bold))
                    .foregroundColor(ADLColor.ink)
                Spacer()
                Button(appState.t("Close", "Fermer")) { dismiss() }
                    .font(ADLFont.inter(12, .bold))
                    .foregroundColor(Color(hex: 0x9ca3af))
            }

            ADLCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text(reward.name)
                        .font(ADLFont.inter(14, .bold))
                        .foregroundColor(ADLColor.ink)
                    HStack {
                        Text(appState.t("Cost", "Coût").uppercased())
                            .font(ADLFont.inter(11, .bold))
                            .tracking(1.6)
                            .foregroundColor(Color(hex: 0x9ca3af))
                        Spacer()
                        Text("\(reward.costXP) XP")
                            .font(ADLFont.inter(13, .bold))
                            .foregroundColor(ADLColor.ink)
                    }
                    HStack {
                        Text(appState.t("Balance after", "Solde restant").uppercased())
                            .font(ADLFont.inter(11, .bold))
                            .tracking(1.6)
                            .foregroundColor(Color(hex: 0x9ca3af))
                        Spacer()
                        Text("\(max(0, balance - reward.costXP)) XP")
                            .font(ADLFont.inter(13, .bold))
                            .foregroundColor(ADLColor.ink)
                    }
                }
            }

            if !affordable {
                Text(appState.t(
                    "You need \(reward.costXP - balance) more XP for this reward.",
                    "Il vous faut \(reward.costXP - balance) XP supplémentaires."
                ))
                .font(ADLFont.inter(13, .semibold))
                .foregroundColor(ADLColor.terracotta)
            }

            Button {
                onConfirm()
            } label: {
                Label(appState.t("Confirm Redeem", "Confirmer échange"),
                      systemImage: "checkmark.seal.fill")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!affordable)
        }
        .padding(20)
    }
}

struct VoucherSuccessSheet: View {
    let voucher: Voucher
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 52))
                .foregroundColor(ADLColor.forest)
                .padding(16)
                .background(ADLColor.forestWash)
                .clipShape(Circle())

            Text(appState.t("Reward Redeemed", "Récompense échangée"))
                .font(ADLFont.inter(18, .bold))
                .foregroundColor(ADLColor.ink)
            Text(voucher.rewardName)
                .font(ADLFont.inter(14))
                .foregroundColor(Color(hex: 0x6b7280))
                .multilineTextAlignment(.center)

            ADLCard {
                VStack(spacing: 6) {
                    Text(appState.t("VOUCHER CODE", "CODE BON"))
                        .font(ADLFont.inter(11, .bold))
                        .tracking(2.0)
                        .foregroundColor(Color(hex: 0x9ca3af))
                    Text(voucher.code)
                        .font(.system(.title2, design: .monospaced).weight(.bold))
                        .foregroundColor(ADLColor.navy)
                }
                .frame(maxWidth: .infinity)
            }

            Text(appState.t(
                "Your voucher is available in the Rewards wallet.",
                "Votre bon est disponible dans le portefeuille récompenses."
            ))
            .font(ADLFont.inter(12))
            .foregroundColor(Color(hex: 0x6b7280))
            .multilineTextAlignment(.center)

            Button(appState.t("Done", "Terminé")) { dismiss() }
                .buttonStyle(PrimaryButtonStyle())
        }
        .padding(24)
    }
}

struct VoucherRow: View {
    let voucher: Voucher

    var body: some View {
        ADLCard {
            HStack(spacing: 12) {
                Image(systemName: "ticket.fill")
                    .foregroundColor(ADLColor.gold)
                    .frame(width: 36, height: 36)
                    .background(ADLColor.gold.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(voucher.rewardName)
                        .font(ADLFont.inter(13, .bold))
                        .foregroundColor(ADLColor.ink)
                    Text(voucher.code)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("\(voucher.costXP) XP")
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct BadgesView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: appState.t("Badges", "Badges"), onBack: { dismiss() }) {
                EmptyView()
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    let earned = appState.badges.filter(\.unlocked).count
                    Text(appState.t("\(earned) of \(appState.badges.count) earned", "\(earned) sur \(appState.badges.count) obtenus"))
                        .font(ADLFont.inter(13, .semibold))
                        .foregroundColor(.secondary)
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(appState.badges) { badge in
                            BadgeTile(badge: badge)
                        }
                    }
                }
                .padding(16)
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task { await appState.loadProfile() }
    }
}

struct MissionsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: appState.t("Missions", "Missions"), onBack: { dismiss() }) {
                EmptyView()
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ADLSectionHeader(title: appState.t("Daily", "Quotidien"))
                    ForEach(appState.missions.filter { $0.period == .daily }) { mission in
                        MissionRow(mission: mission)
                    }
                    ADLSectionHeader(title: appState.t("Weekly", "Hebdomadaire"))
                    ForEach(appState.missions.filter { $0.period == .weekly }) { mission in
                        MissionRow(mission: mission)
                    }
                }
                .padding(16)
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task { await appState.loadProfile() }
    }
}

struct ProfileRow: View {
    let title: String
    let systemImage: String
    var trailing: String?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .foregroundColor(ADLColor.navy)
                .frame(width: 26)
            Text(title)
                .font(ADLFont.inter(15, .semibold))
                .foregroundColor(ADLColor.ink)
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(ADLFont.inter(12, .semibold))
                    .foregroundColor(.secondary)
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(.secondary)
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(ADLColor.line, lineWidth: 1)
        )
    }
}

struct ProfileAvatarMark: View {
    @EnvironmentObject private var appState: AppState
    let name: String
    var image: String?
    var preset: String?
    var size: CGFloat = 64

    private var normalizedPreset: String {
        if let preset = preset?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !preset.isEmpty {
            return preset
        }
        if let image = image?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
           image.hasPrefix("preset:") {
            return String(image.dropFirst("preset:".count))
        }
        return "baobab"
    }

    private var imageURL: URL? {
        guard let raw = image?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty,
              !raw.lowercased().hasPrefix("preset:")
        else { return nil }
        return URL(string: raw)
    }

    var body: some View {
        Group {
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        presetAvatar
                    }
                }
            } else {
                presetAvatar
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 2))
        .accessibilityLabel(appState.t("Profile picture for \(name)", "Photo de profil de \(name)"))
    }

    private var presetAvatar: some View {
        ZStack {
            Circle().fill(background)
            Circle()
                .fill(accent.opacity(0.24))
                .frame(width: size * 0.42, height: size * 0.42)
                .offset(x: -size * 0.22, y: -size * 0.22)
            Circle()
                .fill(accent.opacity(0.16))
                .frame(width: size * 0.34, height: size * 0.34)
                .offset(x: size * 0.24, y: size * 0.22)
            Text(initial)
                .font(.system(size: size * 0.42, weight: .bold))
                .foregroundColor(textColor)
        }
    }

    private var initial: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return String(trimmed.first.map(Character.init) ?? "A").uppercased()
    }

    private var background: Color {
        switch normalizedPreset {
        case "sunrise": return Color(hex: 0xfde6cb)
        case "lagoon": return Color(hex: 0xddeff6)
        default: return Color(hex: 0xe7f1e6)
        }
    }

    private var accent: Color {
        switch normalizedPreset {
        case "sunrise": return ADLColor.terracotta
        case "lagoon": return Color(hex: 0x0f6b8c)
        default: return ADLColor.forest
        }
    }

    private var textColor: Color {
        switch normalizedPreset {
        case "sunrise": return ADLColor.terraDark
        case "lagoon": return ADLColor.navy
        default: return ADLColor.forestDark
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 0) {
            // MARK: Header — title "Profile" + gear → SettingsView
            ADLScreenHeader(title: appState.t("Profile", "Profil")) {
                NavigationLink {
                    SettingsView()
                } label: {
                    Image(systemName: "gearshape")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(ADLColor.navy)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(appState.t("Settings", "Paramètres"))
            }

            if appState.isGuest {
                Color.clear
                    .onAppear { appState.requestAuth() }
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        // MARK: Hero banner — navy, IdentityCircle(96), name inter(24,.bold)
                        profileHero

                        VStack(alignment: .leading, spacing: 24) {
                            if let profileError = appState.profileError {
                                Text(profileError)
                                    .font(ADLFont.inter(11, .semibold))
                                    .foregroundColor(ADLColor.terracotta)
                                    .padding(.top, 2)
                            }

                            // MARK: Trust-progress card
                            trustProgressCard

                            // MARK: KPI 2x2 grid — shared KpiTile (ADLComponents), spacing 12
                            LazyVGrid(
                                columns: [GridItem(.flexible()), GridItem(.flexible())],
                                spacing: 12
                            ) {
                                KpiTile(label: appState.t("Points", "Points"), value: pointsTotal.formatted(), tone: .navy)
                                KpiTile(label: appState.t("XP", "XP"), value: xpCurrent.formatted(), tone: .terra)
                                KpiTile(label: appState.t("Streak", "Série"), value: "\(appState.profile.streakDays)d", tone: .streak)
                                KpiTile(label: appState.t("Rank", "Rang"), value: rankDisplay, tone: .amber)
                            }

                            // MARK: Quick-action rows (Pending Uploads, Help Center)
                            quickActionRows

                            // MARK: XP Balance card
                            ProfileBalanceCard(xp: appState.spendableXP)

                            // MARK: Daily progress + streak tracker
                            DailyProgressWidget(goal: appState.dailyGoal)
                            ProfileStreakTracker(streakDays: appState.profile.streakDays)

                            if appState.selectedRole == .admin {
                                adminMapAccessCard
                                adminAccountAccessCard
                            }

                            assignmentsCard
                            rewardActionRows
                            weeklyTargetCard
                            badgesSection
                            weekSummarySection
                            contributionHistorySection
                            uploadIssuesSection
                            // Sign-out lives in Settings only (reached via the gear icon).
                        }
                        .padding(16)
                        .padding(.bottom, 24)
                    }
                }
                .refreshable {
                    await appState.loadProfile(force: true)
                    await appState.loadAssignments(force: true)
                    await appState.loadContributionEvents(force: true)
                }
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task {
            if !appState.isGuest {
                await appState.loadProfile()
                await appState.loadAssignments()
                await appState.loadContributionEvents()
            }
        }
    }

    // MARK: - Computed properties

    private var displayName: String {
        nonEmpty(appState.userProfile?.name) ?? appState.profile.name
    }

    private var xpCurrent: Int {
        appState.userProfile?.xp ?? appState.serverXP
    }

    private var level: Int {
        max(1, Int(floor(Double(xpCurrent) / 250.0)) + 1)
    }

    private var xpTarget: Int {
        max(level * 250, 250)
    }

    private var xpProgress: Double {
        guard xpTarget > 0 else { return 0 }
        return min(1, Double(xpCurrent) / Double(xpTarget))
    }

    private var tierLabel: String {
        nonEmpty(appState.userProfile?.trustTier)?.capitalized ?? appState.tierProgress.current.title
    }

    private var heroSubtitle: String {
        if appState.isLoadingProfile { return appState.t("Loading profile", "Chargement du profil") }
        return "\(appState.profile.role.title) · Bonamoussadi"
    }

    private var rankDisplay: String {
        "N/A"
    }

    private var pointsTotal: Int {
        appState.contributionEvents.count + appState.drafts.count
    }

    private var failedDrafts: [ContributionDraft] {
        appState.drafts.filter { $0.syncState == .failed }
    }

    private var pointsThisWeek: Int {
        let calendar = Calendar.current
        let localCount = appState.drafts.filter { calendar.isDate($0.createdAt, equalTo: Date(), toGranularity: .weekOfYear) }.count
        let serverCount = appState.contributionEvents.filter { calendar.isDate($0.createdDate, equalTo: Date(), toGranularity: .weekOfYear) }.count
        return localCount + serverCount
    }

    private var activeAssignments: [CollectionAssignment] {
        appState.assignments.filter { assignment in
            assignment.status != .completed && assignment.status != .cancelled
        }
    }

    private var weeklyTarget: Int { 50 }

    private func goBack() {
        appState.selectedTab = AppReleaseMode.defaultTab(for: appState.selectedRole)
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return nil }
        return trimmed
    }

    // MARK: - Hero banner (mirrors Profile.tsx hero section)

    /// Full-bleed navy banner: IdentityCircle(96) + name inter(24,.bold)
    /// + role/location inter(14) white/70 + tier pill gold/20 + level pill white/10
    /// + XP progress bar gold to amber gradient (web: h-2 rounded-full bg-gradient-to-r from-gold to-amber)
    private var profileHero: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 14) {
                ProfileAvatarMark(
                    name: displayName,
                    image: appState.userProfile?.image,
                    preset: appState.userProfile?.avatarPreset,
                    size: 96
                )

                VStack(alignment: .leading, spacing: 6) {
                    // Name + tier pill (web: text-xl font-bold + micro-label bg-gold/20 text-gold)
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(appState.isLoadingProfile ? appState.t("Loading profile", "Chargement du profil") : displayName)
                            .font(ADLFont.inter(24, .bold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                        Text(tierLabel)
                            .font(ADLFont.inter(11, .bold))
                            .tracking(1.2)
                            .foregroundColor(ADLColor.gold)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(ADLColor.gold.opacity(0.2))
                            .clipShape(Capsule())
                    }

                    // Role · location subtitle (web: text-sm text-white/70)
                    Text(heroSubtitle)
                        .font(ADLFont.inter(14))
                        .foregroundColor(.white.opacity(0.7))
                        .lineLimit(1)

                    // Level pill (web: micro-label bg-white/10 text-white/70)
                    Text(appState.t("Level \(level)", "Niveau \(level)"))
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(.white.opacity(0.7))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.white.opacity(0.1))
                        .clipShape(Capsule())
                }

                Spacer(minLength: 4)
            }
            .padding(.top, 20)
            .padding(.horizontal, 20)

            // XP progress bar (web: mt-5, LEVEL label xs tracking-wide, h-2 bar)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(appState.t("Level", "Niveau").uppercased())
                        .font(ADLFont.inter(11, .medium))
                        .tracking(0.9)
                        .foregroundColor(.white.opacity(0.7))
                    Spacer()
                    Text("\(xpCurrent.formatted()) / \(xpTarget.formatted()) XP")
                        .font(ADLFont.inter(11, .medium))
                        .foregroundColor(.white.opacity(0.7))
                }
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.15))
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [ADLColor.gold, ADLColor.amber],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: max(0, min(1, xpProgress)) * proxy.size.width)
                    }
                }
                .frame(height: 8)
            }
            .padding(.top, 20)
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ADLColor.navy)
    }

    // MARK: - Trust-progress card

    /// Tier label + ADLProgressBar(tint:.gold) + "X XP to next tier" caption
    private var trustProgressCard: some View {
        let progress = appState.tierProgress
        let xpToNext = progress.xpToNext
        let nextTierName = progress.next?.title ?? appState.t("Max tier", "Niveau maximum")
        return ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(appState.t("Trust Progress", "Progression de confiance"))
                        .font(ADLFont.inter(15, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    Text(progress.current.title.uppercased())
                        .font(ADLFont.inter(10, .bold))
                        .tracking(1.2)
                        .foregroundColor(ADLColor.amber)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(ADLColor.goldWash)
                        .clipShape(Capsule())
                }
                ADLProgressBar(value: progress.fraction, tint: ADLColor.gold, height: 8)
                Text(xpToNext > 0
                     ? appState.t("\(xpToNext.formatted()) XP to \(nextTierName)", "\(xpToNext.formatted()) XP vers \(nextTierName)")
                     : appState.t("You've reached the top tier!", "Vous avez atteint le niveau maximum !"))
                    .font(ADLFont.inter(12))
                    .foregroundColor(ADLColor.inkMuted)
            }
        }
    }

    // MARK: - Quick-action rows

    private var quickActionRows: some View {
        VStack(spacing: 12) {
            // Pending Uploads — leading icon + title inter(15,.semibold) + trailing chevron
            NavigationLink { SubmissionQueueView() } label: {
                ADLCard {
                    HStack(spacing: 12) {
                        Image(systemName: "icloud.and.arrow.up")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(ADLColor.navy)
                            .frame(width: 40, height: 40)
                            .background(ADLColor.navyWash)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(appState.t("Pending Uploads", "Envois en attente"))
                                .font(ADLFont.inter(15, .semibold))
                                .foregroundColor(ADLColor.navy)
                            Text(appState.t("\(appState.queueSnapshot.queued) queued · \(appState.queueSnapshot.failed) failed", "\(appState.queueSnapshot.queued) en file · \(appState.queueSnapshot.failed) échoués"))
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.inkMuted)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                }
            }
            .buttonStyle(.plain)

            Button {
                openURL(helpCenterURL)
            } label: {
                ADLCard {
                    HStack(spacing: 12) {
                        Image(systemName: "book.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(ADLColor.navy)
                            .frame(width: 40, height: 40)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(appState.t("Help Center", "Centre d'aide"))
                                .font(ADLFont.inter(15, .semibold))
                                .foregroundColor(ADLColor.navy)
                            Text(appState.t("Guides for your current role and workflow.", "Guides pour votre rôle et votre workflow."))
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.inkMuted)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                }
            }
            .buttonStyle(.plain)
            .background(ADLColor.goldWash)
            .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
        }
    }

    private var helpCenterURL: URL {
        let path: String
        switch appState.selectedRole {
        case .client: path = "/docs/client"
        case .admin: path = "/docs/admin"
        case .agent: path = "/docs/agent"
        }
        return URL(string: "https://www.app.africandatalayer.com\(path)")!
    }

    // MARK: - Admin map access card

    private var adminMapAccessCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        SectionLabel(text: appState.t("Admin Map Access", "Accès carte admin"))
                        Text(appState.t("Unlock worldwide map", "Débloquer la carte mondiale"))
                            .font(ADLFont.inter(14, .bold))
                            .foregroundColor(ADLColor.ink)
                    }
                    Spacer()
                    StatusPill(title: appState.t("Enabled", "Activé"), tint: ADLColor.forest)
                }
                Text(appState.t("Explorer map is unlocked worldwide.", "La carte Explorer est débloquée dans le monde entier."))
                    .font(ADLFont.inter(12))
                    .foregroundColor(ADLColor.inkMuted)
            }
        }
    }

    private var adminAccountAccessCard: some View {
        AdminAccountAccessCard()
    }

    // MARK: - Assignments card

    private var assignmentsCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        SectionLabel(text: appState.t("Assignments", "Missions"))
                        Text(appState.t("My Weekly Assignments", "Mes missions de la semaine"))
                            .font(ADLFont.inter(15, .semibold))
                            .foregroundColor(ADLColor.ink)
                    }
                    Spacer()
                    Text("\(activeAssignments.count)")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.navy)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(ADLColor.navyLight)
                        .clipShape(Capsule())
                }
                if appState.isLoadingAssignments {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text(appState.t("Loading assignments…", "Chargement des missions…"))
                            .font(ADLFont.inter(12))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                } else if let error = appState.assignmentsError, appState.assignments.isEmpty {
                    Text(error)
                        .font(ADLFont.inter(12, .semibold))
                        .foregroundColor(ADLColor.terracotta)
                } else if activeAssignments.isEmpty {
                    Text(appState.t("No active assignments yet.", "Aucune mission active pour le moment."))
                        .font(ADLFont.inter(12))
                        .foregroundColor(ADLColor.inkMuted)
                } else {
                    VStack(spacing: 10) {
                        ForEach(activeAssignments.prefix(3)) { assignment in
                            AssignmentCompactRow(assignment: assignment, context: appState.assignmentsContext)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Reward action rows (web: 2-col h-14 row)

    private var rewardActionRows: some View {
        HStack(spacing: 12) {
            // Redeem XP — white bg, navy border (web: border-navy-border bg-white)
            NavigationLink { RewardsView() } label: {
                HStack(spacing: 8) {
                    Image(systemName: "gift.fill")
                        .font(.system(size: 16, weight: .semibold))
                    Text(appState.t("Redeem XP", "Échanger des XP"))
                        .font(ADLFont.inter(14, .semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .foregroundColor(ADLColor.navy)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous)
                        .stroke(ADLColor.navyBorder, lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
            }
            .buttonStyle(.plain)

            // Convert to Rewards — terra CTA (web: bg-terra text-white shadow-lg)
            Button(action: {}) {
                HStack(spacing: 8) {
                    Image(systemName: "wallet.pass.fill")
                        .font(.system(size: 16, weight: .semibold))
                    Text(appState.t("Convert to Rewards", "Convertir en récompenses"))
                        .font(ADLFont.inter(14, .semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .foregroundColor(.white)
                .background(ADLColor.terracotta)
                .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
                .shadow(color: ADLColor.terracotta.opacity(0.3), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Weekly target card

    private var weeklyTargetCard: some View {
        let progress = min(1, Double(pointsThisWeek) / Double(weeklyTarget))
        return ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    SectionLabel(text: appState.t("Weekly Target", "Objectif hebdo."))
                    Spacer()
                    Text("\(pointsThisWeek)/\(weeklyTarget)")
                        .font(ADLFont.inter(12, .bold))
                        .foregroundColor(ADLColor.ink)
                }
                ADLProgressBar(value: progress, tint: ADLColor.navy, height: 12)
                Text(pointsThisWeek >= weeklyTarget
                     ? appState.t("Target reached! +20 XP bonus earned.", "Objectif atteint ! Bonus +20 XP gagné.")
                     : appState.t("Complete 50 this week for a 20 XP bonus!", "Complétez 50 cette semaine pour un bonus de 20 XP !"))
                    .font(ADLFont.inter(11))
                    .foregroundColor(ADLColor.inkMuted)
            }
        }
    }

    // MARK: - Badges section

    private var badgesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionLabel(text: appState.t("Badges", "Badges"), wide: true)
                Spacer()
                Text(appState.t("\(appState.badges.filter(\.unlocked).count)/\(appState.badges.count) earned", "\(appState.badges.filter(\.unlocked).count)/\(appState.badges.count) obtenus"))
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
            }
            FlowLayout(spacing: 8) {
                ForEach(appState.badges) { badge in
                    ProfileBadgeChip(badge: badge)
                }
            }
        }
    }

    // MARK: - This-week summary

    private var weekSummarySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: appState.t("This week", "Cette semaine"), wide: true)
            ProfileWeekSummaryCard(rows: [
                (appState.t("Submitted", "Soumissions"), "\(pointsThisWeek)"),
                (appState.t("Verified", "Vérifiées"), "\(appState.queueSnapshot.synced)"),
                (appState.t("XP earned", "XP gagnées"), "\(xpCurrent.formatted()) XP"),
                (appState.t("Best day", "Meilleur jour"), pointsThisWeek > 0 ? appState.t("Today", "Aujourd'hui") : appState.t("No activity yet", "Aucune activité pour le moment"))
            ])
        }
    }

    // MARK: - Contribution history

    private var contributionHistorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionLabel(text: appState.t("Contribution History", "Historique de contributions"))
                Spacer()
            }

            if appState.isLoadingContributionEvents {
                ADLCard {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text(appState.t("Loading contributions…", "Chargement des contributions…"))
                            .font(ADLFont.inter(12))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                }
            } else if appState.contributionEvents.isEmpty && appState.drafts.isEmpty {
                ADLCard {
                    Text(appState.contributionEventsError ?? appState.t("No contributions yet. Add your first report to build your history.", "Aucune contribution pour le moment. Ajoutez votre premier rapport pour commencer votre historique."))
                        .font(ADLFont.inter(12))
                        .foregroundColor(appState.contributionEventsError == nil ? ADLColor.inkMuted : ADLColor.terracotta)
                }
            } else {
                VStack(spacing: 12) {
                    ForEach(appState.contributionEvents.prefix(5)) { event in
                        ADLCard {
                            HStack(spacing: 12) {
                                Image(systemName: event.eventType == "ENRICH_EVENT" ? "plus.magnifyingglass" : "mappin.and.ellipse")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(ADLColor.navy)
                                    .frame(width: 40, height: 40)
                                    .background(ADLColor.navyWash)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(event.category.title)
                                        .font(ADLFont.inter(12, .bold))
                                        .foregroundColor(ADLColor.ink)
                                    Text(event.createdDate.formatted(date: .abbreviated, time: .omitted).uppercased())
                                        .font(ADLFont.inter(11, .bold))
                                        .foregroundColor(ADLColor.navy.opacity(0.5))
                                    Text(event.displayTitle)
                                        .font(ADLFont.inter(11, .medium))
                                        .foregroundColor(ADLColor.inkMuted)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Text(appState.t("Synced", "Synchronisé"))
                                    .font(ADLFont.inter(12, .bold))
                                    .foregroundColor(ADLColor.forest)
                            }
                        }
                    }
                    ForEach(appState.drafts.prefix(max(0, 5 - appState.contributionEvents.prefix(5).count))) { draft in
                        ADLCard {
                            HStack(spacing: 12) {
                                Image(systemName: "calendar")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(ADLColor.navy)
                                    .frame(width: 40, height: 40)
                                    .background(ADLColor.navyWash)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(draft.category.title)
                                        .font(ADLFont.inter(12, .bold))
                                        .foregroundColor(ADLColor.ink)
                                    Text(draft.createdAt.formatted(date: .abbreviated, time: .omitted).uppercased())
                                        .font(ADLFont.inter(11, .bold))
                                        .foregroundColor(ADLColor.navy.opacity(0.5))
                                    Text(draft.displayTitle)
                                        .font(ADLFont.inter(11, .medium))
                                        .foregroundColor(ADLColor.inkMuted)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Text(draft.syncState.rawValue.capitalized)
                                    .font(ADLFont.inter(12, .bold))
                                    .foregroundColor(draft.syncState == .failed ? ADLColor.terracotta : ADLColor.forest)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Upload issues

    private var uploadIssuesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionLabel(text: appState.t("Upload Issues", "Problèmes d'envoi"))
                Spacer()
                if !failedDrafts.isEmpty {
                    Label(appState.t("Clear", "Effacer"), systemImage: "trash")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.terracotta)
                }
            }

            if failedDrafts.isEmpty {
                ADLCard {
                    Text(appState.t("All clear! No upload issues.", "Tout est bon ! Aucun problème d'envoi."))
                        .font(ADLFont.inter(12))
                        .foregroundColor(ADLColor.inkMuted)
                }
            } else {
                VStack(spacing: 12) {
                    ForEach(failedDrafts) { draft in
                        ADLCard {
                            VStack(alignment: .leading, spacing: 8) {
                                Label(draft.lastError ?? "Upload failed", systemImage: "exclamationmark.triangle.fill")
                                    .font(ADLFont.inter(12, .semibold))
                                    .foregroundColor(ADLColor.danger)
                                Text("\(draft.createdAt.formatted(date: .abbreviated, time: .shortened)) · \(draft.category.title)")
                                    .font(ADLFont.inter(11, .bold))
                                    .foregroundColor(ADLColor.inkMuted)
                                if let location = draft.location {
                                    Text(String(format: "GPS: %.4f°, %.4f°", location.latitude, location.longitude))
                                        .font(ADLFont.inter(11))
                                        .foregroundColor(ADLColor.inkMuted)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

}

private struct AdminAccountAccessCard: View {
    @EnvironmentObject private var appState: AppState
    @State private var createIdentifier = ""
    @State private var createName = ""
    @State private var createRole: UserRole = .client
    @State private var createPassword = ""
    @State private var lookupIdentifier = ""
    @State private var managedAccount: UserProfile?
    @State private var managedRole: UserRole = .client
    @State private var isCreating = false
    @State private var isLookingUp = false
    @State private var isSavingAccess = false
    @State private var message: String?
    @State private var error: String?

    private var canCreate: Bool {
        !createIdentifier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            createPassword.count >= 10
    }

    private var canSaveAccess: Bool {
        guard let account = managedAccount else { return false }
        return account.role != managedRole || (account.isAdmin == true) != (managedRole == .admin)
    }

    var body: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    SectionLabel(text: appState.t("Account Access", "Accès aux comptes"))
                    Text(appState.t("Create or manage account access", "Créer ou gérer les accès aux comptes"))
                        .font(ADLFont.inter(15, .bold))
                        .foregroundColor(ADLColor.ink)
                    Text(appState.t(
                        "Create client accounts, then look up email or phone to adjust Agent, Client, or Admin access. Admin accounts automatically unlock worldwide map views.",
                        "Créez des comptes client, puis recherchez email ou téléphone pour régler les accès Agent, Client ou Admin. Les comptes admin débloquent automatiquement la vue mondiale."
                    ))
                    .font(ADLFont.inter(12))
                    .foregroundColor(ADLColor.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                }

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(appState.t("Create account", "Créer un compte"))
                            .font(ADLFont.inter(13, .bold))
                            .foregroundColor(ADLColor.ink)
                        Spacer()
                        rolePill(createRole)
                    }
                    Text(appState.t("Default role is Client. The user accepts policies on first login.", "Le rôle par défaut est Client. L'utilisateur accepte les politiques à la première connexion."))
                        .font(ADLFont.inter(11))
                        .foregroundColor(ADLColor.inkMuted)

                    adminTextField(
                        title: appState.t("Email or phone", "Email ou téléphone"),
                        text: $createIdentifier,
                        placeholder: "client@example.com / +237..."
                    )
                    adminTextField(
                        title: appState.t("Display name", "Nom affiché"),
                        text: $createName,
                        placeholder: appState.t("Client team name", "Nom équipe client")
                    )
                    roleMenu(title: appState.t("Role", "Rôle"), role: $createRole)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(appState.t("Temporary password", "Mot de passe temporaire").uppercased())
                            .font(ADLFont.inter(10, .bold))
                            .tracking(1.1)
                            .foregroundColor(ADLColor.inkMuted)
                        SecureField(appState.t("Minimum 10 chars, mixed case, number", "10 caractères min., majuscule, minuscule, chiffre"), text: $createPassword)
                            .font(ADLFont.inter(14))
                            .textContentType(.newPassword)
                            .padding(.horizontal, 12)
                            .frame(height: 46)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ADLColor.lineStrong, lineWidth: 1))
                    }

                    Button {
                        createAccount()
                    } label: {
                        actionLabel(
                            title: appState.t("Create account", "Créer le compte"),
                            loading: isCreating,
                            tint: canCreate ? ADLColor.navy : Color(hex: 0x9ca3af)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!canCreate || isCreating)
                }
                .padding(12)
                .background(ADLColor.paper)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                VStack(alignment: .leading, spacing: 10) {
                    adminTextField(
                        title: appState.t("Load account", "Charger le compte"),
                        text: $lookupIdentifier,
                        placeholder: "name@example.com / +237..."
                    )
                    Button {
                        lookupAccount()
                    } label: {
                        actionLabel(
                            title: appState.t("Load account", "Charger le compte"),
                            loading: isLookingUp,
                            tint: lookupIdentifier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color(hex: 0x9ca3af) : ADLColor.navy
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(lookupIdentifier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLookingUp)
                }

                if let account = managedAccount {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(account.name?.nilIfEmpty ?? account.id ?? appState.t("Loaded account", "Compte chargé"))
                            .font(ADLFont.inter(14, .bold))
                            .foregroundColor(ADLColor.ink)
                        Text(account.email?.nilIfEmpty ?? account.phone?.nilIfEmpty ?? account.id ?? "")
                            .font(ADLFont.inter(12))
                            .foregroundColor(ADLColor.inkMuted)
                        Text("\(appState.t("Current access", "Accès actuel")): \(roleTitle(account.role ?? .client)) · \(account.mapScope ?? "bonamoussadi")")
                            .font(ADLFont.inter(11, .bold))
                            .foregroundColor(ADLColor.inkMuted)
                        roleMenu(title: appState.t("Role", "Rôle"), role: $managedRole)
                        Button {
                            saveAccess()
                        } label: {
                            actionLabel(
                                title: appState.t("Save access", "Enregistrer l'accès"),
                                loading: isSavingAccess,
                                tint: canSaveAccess ? ADLColor.terracotta : Color(hex: 0x9ca3af)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(!canSaveAccess || isSavingAccess)
                    }
                    .padding(12)
                    .background(ADLColor.paper)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                if let error {
                    Text(error)
                        .font(ADLFont.inter(12, .semibold))
                        .foregroundColor(ADLColor.terracotta)
                }
                if let message {
                    Text(message)
                        .font(ADLFont.inter(12, .semibold))
                        .foregroundColor(ADLColor.forest)
                }
            }
        }
    }

    private func roleTitle(_ role: UserRole) -> String {
        switch role {
        case .client: return appState.t("Client", "Client")
        case .agent: return appState.t("Agent", "Agent")
        case .admin: return appState.t("Admin", "Admin")
        }
    }

    private func rolePill(_ role: UserRole) -> some View {
        Text(roleTitle(role))
            .font(ADLFont.inter(10, .bold))
            .tracking(1.1)
            .foregroundColor(ADLColor.amber)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(ADLColor.goldWash)
            .clipShape(Capsule())
    }

    private func roleMenu(title: String, role: Binding<UserRole>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(ADLFont.inter(10, .bold))
                .tracking(1.1)
                .foregroundColor(ADLColor.inkMuted)
            Menu {
                ForEach([UserRole.client, .agent, .admin], id: \.self) { option in
                    Button(roleTitle(option)) { role.wrappedValue = option }
                }
            } label: {
                HStack {
                    Text(roleTitle(role.wrappedValue))
                        .font(ADLFont.inter(14, .bold))
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .bold))
                }
                .foregroundColor(ADLColor.ink)
                .padding(.horizontal, 12)
                .frame(height: 46)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ADLColor.lineStrong, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private func adminTextField(title: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(ADLFont.inter(10, .bold))
                .tracking(1.1)
                .foregroundColor(ADLColor.inkMuted)
            TextField(placeholder, text: text)
                .font(ADLFont.inter(14))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
                .padding(.horizontal, 12)
                .frame(height: 46)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ADLColor.lineStrong, lineWidth: 1))
        }
    }

    private func actionLabel(title: String, loading: Bool, tint: Color) -> some View {
        HStack(spacing: 8) {
            if loading {
                ProgressView().tint(.white)
            }
            Text(title)
                .font(ADLFont.inter(13, .bold))
        }
        .frame(maxWidth: .infinity)
        .frame(height: 46)
        .foregroundColor(.white)
        .background(tint)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func createAccount() {
        let identifier = createIdentifier.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = createName.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        isCreating = true
        error = nil
        message = nil
        Task {
            do {
                let created = try await appState.apiClient.createAdminAccount(
                    identifier: identifier,
                    name: name,
                    role: createRole,
                    password: createPassword
                )
                managedAccount = created
                managedRole = created.role ?? createRole
                lookupIdentifier = created.email?.nilIfEmpty ?? created.phone?.nilIfEmpty ?? created.id ?? identifier
                createIdentifier = ""
                createName = ""
                createRole = .client
                createPassword = ""
                message = appState.t("Account created. Share the temporary password through a trusted channel.", "Compte créé. Partagez le mot de passe temporaire via un canal de confiance.")
            } catch {
                self.error = (error as? APIError)?.message ?? appState.t("Unable to create account.", "Impossible de créer le compte.")
            }
            isCreating = false
        }
    }

    private func lookupAccount() {
        let identifier = lookupIdentifier.trimmingCharacters(in: .whitespacesAndNewlines)
        isLookingUp = true
        error = nil
        message = nil
        Task {
            do {
                let account = try await appState.apiClient.lookupAdminAccount(identifier: identifier)
                managedAccount = account
                managedRole = account.role ?? (account.isAdmin == true ? .admin : .client)
            } catch {
                managedAccount = nil
                self.error = (error as? APIError)?.message ?? appState.t("Unable to load account.", "Impossible de charger le compte.")
            }
            isLookingUp = false
        }
    }

    private func saveAccess() {
        guard let account = managedAccount, let userId = account.id?.nilIfEmpty else { return }
        isSavingAccess = true
        error = nil
        message = nil
        Task {
            do {
                let updated = try await appState.apiClient.updateAdminAccountAccess(userId: userId, role: managedRole)
                managedAccount = updated
                managedRole = updated.role ?? managedRole
                message = appState.t("Account access updated.", "Accès du compte mis à jour.")
            } catch {
                self.error = (error as? APIError)?.message ?? appState.t("Unable to update account access.", "Impossible de mettre à jour l'accès du compte.")
            }
            isSavingAccess = false
        }
    }
}


struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @AppStorage("adl_high_contrast") private var highContrast = false
    @AppStorage("adl_sms_notifications") private var smsNotifications = false
    @State private var displayNameDraft = ""
    @State private var selectedAvatarPreset = "baobab"
    @State private var profileMessage: String?
    @State private var isSavingProfile = false
    @State private var profilePhotoDraft: UIImage?
    @State private var showProfilePhotoSource = false
    @State private var showProfileImagePicker = false
    @State private var profileImageSource: UIImagePickerController.SourceType = .photoLibrary

    private var language: String { appState.language }

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: text("Settings", "Paramètres"), onBack: { dismiss() })

            ScrollView {
                VStack(spacing: 24) {
                    if appState.selectedRole == .client {
                        clientIdentityCard
                    }

                    profileSection
                    languageSection
                    displaySection

                    if appState.selectedRole != .client {
                        notificationsSection
                    }

                    legalSection
                    accountSection
                    appVersion
                }
                .padding(16)
                .padding(.bottom, 24)
            }
        }
        .background((highContrast ? Color.white : ADLColor.paper).ignoresSafeArea())
        .navigationBarBackButtonHidden(true)
        .onAppear(perform: syncProfileDrafts)
        .confirmationDialog(text("Profile photo", "Photo de profil"), isPresented: $showProfilePhotoSource, titleVisibility: .visible) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button(text("Take Photo", "Prendre une photo")) {
                    profileImageSource = .camera
                    showProfileImagePicker = true
                }
            }
            Button(text("Choose Photo", "Choisir une photo")) {
                profileImageSource = .photoLibrary
                showProfileImagePicker = true
            }
            Button(text("Use preset avatar", "Utiliser un avatar")) {
                profilePhotoDraft = nil
            }
            Button(text("Cancel", "Annuler"), role: .cancel) {}
        }
        .sheet(isPresented: $showProfileImagePicker) {
            ProfileImagePicker(image: $profilePhotoDraft, sourceType: profileImageSource)
        }
    }

    private func text(_ en: String, _ fr: String) -> String {
        language == "fr" ? fr : en
    }

    private var clientIdentityCard: some View {
        HStack(spacing: 14) {
            ProfileAvatarMark(
                name: currentDisplayName,
                image: appState.userProfile?.image,
                preset: selectedAvatarPreset,
                size: 52
            )
            VStack(alignment: .leading, spacing: 4) {
                Text(currentDisplayName)
                    .font(ADLFont.inter(16, .bold))
                    .foregroundColor(.white)
                Text(text("Data client - Bonamoussadi", "Client data - Bonamoussadi"))
                    .font(ADLFont.inter(11, .medium))
                    .foregroundColor(.white.opacity(0.55))
                Text(text("Client", "Client").uppercased())
                    .font(ADLFont.inter(9, .bold))
                    .tracking(1.2)
                    .foregroundColor(.white.opacity(0.75))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.white.opacity(0.10))
                    .clipShape(Capsule())
            }
            Spacer()
        }
        .padding(20)
        .background(ADLColor.navy)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var profileSection: some View {
        SettingsSection(title: text("Profile", "Profil")) {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(appState.selectedRole == .client
                         ? text("Organization name", "Nom de l'organisation")
                         : text("Display name", "Nom affiché"))
                        .font(ADLFont.inter(12, .bold))
                        .foregroundColor(Color(hex: 0x6b7280))
                    TextField(
                        appState.selectedRole == .client
                            ? text("Your Organization", "Votre organisation")
                            : text("Display name", "Nom affiché"),
                        text: $displayNameDraft
                    )
                    .font(ADLFont.inter(15))
                    .textInputAutocapitalization(.words)
                    .padding(.horizontal, 12)
                    .frame(height: 48)
                    .background(ADLColor.paper)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text(text("Profile picture", "Photo de profil"))
                        .font(ADLFont.inter(12, .bold))
                        .foregroundColor(Color(hex: 0x6b7280))
                    HStack(spacing: 12) {
                        Button {
                            showProfilePhotoSource = true
                        } label: {
                            profilePhotoPreview
                                .overlay(
                                    Circle()
                                        .fill(ADLColor.navy)
                                        .frame(width: 26, height: 26)
                                        .overlay(
                                            Image(systemName: "camera.fill")
                                                .font(.system(size: 11, weight: .bold))
                                                .foregroundColor(.white)
                                        ),
                                    alignment: .bottomTrailing
                                )
                        }
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(text("Use a real account photo or a preset avatar.", "Utilisez une vraie photo de compte ou un avatar."))
                                .font(ADLFont.inter(12, .medium))
                                .foregroundColor(ADLColor.inkMuted)
                                .fixedSize(horizontal: false, vertical: true)
                            Button(text("Change photo", "Changer la photo")) {
                                showProfilePhotoSource = true
                            }
                            .font(ADLFont.inter(12, .bold))
                            .foregroundColor(ADLColor.navy)
                        }
                    }

                    Text(text("Preset avatars", "Avatars prédéfinis"))
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(Color(hex: 0x9ca3af))
                    HStack(spacing: 12) {
                        ForEach(["baobab", "sunrise", "lagoon"], id: \.self) { preset in
                            Button {
                                selectedAvatarPreset = preset
                                profilePhotoDraft = nil
                            } label: {
                                ProfileAvatarMark(name: currentDisplayName, preset: preset, size: 54)
                                    .overlay(
                                        Circle().stroke(profilePhotoDraft == nil && selectedAvatarPreset == preset ? ADLColor.navy : Color.clear, lineWidth: 3)
                                    )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(preset.capitalized)
                        }
                    }
                }

                if let profileMessage {
                    Text(profileMessage)
                        .font(ADLFont.inter(12, .semibold))
                        .foregroundColor(profileMessage == text("Saved", "Enregistré") ? ADLColor.forest : ADLColor.terracotta)
                }

                Button {
                    saveProfile()
                } label: {
                    if isSavingProfile {
                        ProgressView().tint(.white)
                    } else {
                        Text(text("Save profile", "Enregistrer le profil"))
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isSavingProfile)
            }
            .padding(16)
            .settingsCard()
        }
    }

    private var languageSection: some View {
        SettingsSection(title: text("Language", "Langue")) {
            VStack(spacing: 0) {
                SettingsChoiceRow(title: "English", isSelected: language == "en") {
                    appState.language = "en"
                }
                Divider().background(ADLColor.line)
                SettingsChoiceRow(title: "Français", isSelected: language == "fr") {
                    appState.language = "fr"
                }
            }
            .settingsCard()
        }
    }

    private var displaySection: some View {
        SettingsSection(title: text("Display", "Affichage")) {
            SettingsToggleRow(
                title: text("High Contrast", "Contraste élevé"),
                icon: "circle.lefthalf.filled",
                isOn: $highContrast
            )
            .settingsCard()
        }
    }

    private var notificationsSection: some View {
        SettingsSection(title: text("Notifications", "Notifications")) {
            SettingsToggleRow(
                title: text("SMS notifications", "Notifications SMS"),
                subtitle: text(
                    "Receive operational SMS for assignments, payouts, and system notices.",
                    "Recevoir des SMS pour les missions, paiements et avis système."
                ),
                icon: "message.fill",
                isOn: $smsNotifications
            )
            .settingsCard()
        }
    }

    private var legalSection: some View {
        SettingsSection(title: text("Legal", "Légal")) {
            VStack(spacing: 0) {
                SettingsNavigationRow(title: text("Privacy Policy", "Politique de confidentialité")) {
                    SettingsLegalView(kind: .privacy, language: language)
                }
                Divider().background(ADLColor.line)
                SettingsNavigationRow(title: text("Terms of Use", "Conditions d'utilisation")) {
                    SettingsLegalView(kind: .terms, language: language)
                }
                Divider().background(ADLColor.line)
                SettingsNavigationRow(title: text("Data & Compliance", "Données et conformité")) {
                    SettingsLegalView(kind: .compliance, language: language)
                }
                Divider().background(ADLColor.line)
                SettingsNavigationRow(title: text("Report IP Infringement", "Signaler une atteinte PI")) {
                    SettingsLegalView(kind: .ipReport, language: language)
                }
            }
            .settingsCard()
        }
    }

    private var accountSection: some View {
        SettingsSection(title: text("Account", "Compte")) {
            Button {
                appState.signOut()
                dismiss()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 16, weight: .semibold))
                    Text(text("Sign Out", "Déconnexion"))
                        .font(ADLFont.inter(14, .semibold))
                }
                .foregroundColor(ADLColor.danger)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 52)
            }
            .buttonStyle(.plain)
            .settingsCard()
        }
    }

    private var appVersion: some View {
        VStack(spacing: 8) {
            BrandDiamond(size: 18)
            Text("African Data Layer \(versionLabel)")
                .font(ADLFont.inter(11, .medium))
                .foregroundColor(Color(hex: 0x9ca3af))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 4)
    }

    private var versionLabel: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String
        let cleanVersion = version?.replacingOccurrences(of: "$(", with: "").replacingOccurrences(of: ")", with: "")
        guard let cleanVersion, !cleanVersion.isEmpty, cleanVersion != "MARKETING_VERSION" else {
            return "v2.4.0"
        }
        if let build, !build.isEmpty, build != "$(CURRENT_PROJECT_VERSION)" {
            return "v\(cleanVersion) (\(build))"
        }
        return "v\(cleanVersion)"
    }

    private var currentDisplayName: String {
        let candidate = displayNameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !candidate.isEmpty { return candidate }
        if let name = appState.userProfile?.name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            return name
        }
        return appState.selectedRole == .client
            ? text("Your Organization", "Votre organisation")
            : appState.profile.name
    }

    @ViewBuilder
    private var profilePhotoPreview: some View {
        if let profilePhotoDraft {
            Image(uiImage: profilePhotoDraft)
                .resizable()
                .scaledToFill()
                .frame(width: 72, height: 72)
                .clipShape(Circle())
        } else {
            ProfileAvatarMark(
                name: currentDisplayName,
                image: appState.userProfile?.image,
                preset: selectedAvatarPreset,
                size: 72
            )
        }
    }

    private func syncProfileDrafts() {
        displayNameDraft = appState.userProfile?.name ?? appState.profile.name
        selectedAvatarPreset = normalizedPreset(appState.userProfile?.avatarPreset ?? appState.userProfile?.image)
        profilePhotoDraft = nil
    }

    private func normalizedPreset(_ raw: String?) -> String {
        let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let preset = value.hasPrefix("preset:") ? String(value.dropFirst("preset:".count)) : value
        return ["baobab", "sunrise", "lagoon"].contains(preset) ? preset : "baobab"
    }

    private func saveProfile() {
        let name = displayNameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            profileMessage = text("Name cannot be empty.", "Le nom ne peut pas être vide.")
            return
        }
        isSavingProfile = true
        profileMessage = nil
        Task {
            do {
                let imageBase64 = profilePhotoDraft?.adlProfileImageDataURL()
                if profilePhotoDraft != nil && imageBase64 == nil {
                    throw APIError.requestFailed(text("Unable to prepare profile photo.", "Impossible de préparer la photo de profil."))
                }
                try await appState.updateProfile(
                    name: name,
                    avatarPreset: imageBase64 == nil ? selectedAvatarPreset : nil,
                    imageBase64: imageBase64
                )
                profileMessage = text("Saved", "Enregistré")
                profilePhotoDraft = nil
            } catch {
                profileMessage = (error as? APIError)?.message ?? text("Unable to save profile.", "Impossible d'enregistrer le profil.")
            }
            isSavingProfile = false
        }
    }
}

struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(ADLFont.inter(10, .bold))
                .tracking(1.2)
                .foregroundColor(Color(hex: 0x9ca3af))
                .padding(.horizontal, 4)
            content()
        }
    }
}

struct SettingsChoiceRow: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(ADLFont.inter(14, .medium))
                    .foregroundColor(ADLColor.ink)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(ADLColor.navy)
                }
            }
            .frame(minHeight: 52)
            .padding(.horizontal, 16)
        }
        .buttonStyle(.plain)
    }
}

struct SettingsToggleRow: View {
    let title: String
    var subtitle: String?
    let icon: String
    @Binding var isOn: Bool

    var body: some View {
        HStack(alignment: subtitle == nil ? .center : .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(Color(hex: 0x6b7280))
                .frame(width: 22)
                .padding(.top, subtitle == nil ? 0 : 2)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(ADLFont.inter(14, .medium))
                    .foregroundColor(ADLColor.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(ADLFont.inter(11, .regular))
                        .foregroundColor(Color(hex: 0x6b7280))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 12)
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(ADLColor.navy)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(minHeight: 52)
    }
}

struct SettingsNavigationRow<Destination: View>: View {
    let title: String
    @ViewBuilder let destination: () -> Destination

    var body: some View {
        NavigationLink {
            destination()
        } label: {
            HStack {
                Text(title)
                    .font(ADLFont.inter(14, .medium))
                    .foregroundColor(ADLColor.ink)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(hex: 0x9ca3af))
            }
            .frame(minHeight: 52)
            .padding(.horizontal, 16)
        }
        .buttonStyle(.plain)
    }
}

enum SettingsLegalKind: Equatable {
    case privacy
    case terms
    case compliance
    case ipReport

    func title(language: String) -> String {
        switch self {
        case .privacy:
            return language == "fr" ? "Politique de confidentialité" : "Privacy Policy"
        case .terms:
            return language == "fr" ? "Conditions d'utilisation" : "Terms of Use"
        case .compliance:
            return language == "fr" ? "Données et conformité" : "Data & Compliance"
        case .ipReport:
            return language == "fr" ? "Signaler une atteinte PI" : "Report IP Infringement"
        }
    }

    func body(language: String) -> String {
        switch self {
        case .privacy:
            return language == "fr"
                ? "Consultez comment African Data Layer collecte, protège et traite les données personnelles et les preuves terrain."
                : "Review how African Data Layer collects, protects, and processes personal data and field evidence."
        case .terms:
            return language == "fr"
                ? "Consultez les règles d'utilisation du service, les responsabilités des contributeurs et les conditions des récompenses."
                : "Review service rules, contributor responsibilities, and rewards terms."
        case .compliance:
            return language == "fr"
                ? "Demandez accès, rectification, effacement ou opposition. Notre équipe répond sous 30 jours."
                : "Request access, rectification, erasure, or objection. Our team responds within 30 days."
        case .ipReport:
            return language == "fr"
                ? "Signalez une atteinte à la propriété intellectuelle avec une description claire et vos coordonnées."
                : "Report intellectual-property infringement with a clear description and your contact details."
        }
    }

    func sections(language: String) -> [(String, String)] {
        switch self {
        case .privacy:
            return [
                (
                    language == "fr" ? "Ce que nous collectons" : "What we collect",
                    language == "fr"
                        ? "Identifiant de compte, nom affiché, rôle, paramètres, photos terrain, GPS, EXIF et journaux d'audit nécessaires à la vérification."
                        : "Account identifier, display name, role, settings, field photos, GPS, EXIF, and audit logs needed for verification."
                ),
                (
                    language == "fr" ? "Utilisation" : "Use",
                    language == "fr"
                        ? "Nous utilisons ces données pour vérifier les soumissions, prévenir la fraude, synchroniser les récompenses et fournir des rapports agrégés."
                        : "We use this data to verify submissions, prevent fraud, sync rewards, and provide aggregated reporting."
                ),
                (
                    language == "fr" ? "Vos droits" : "Your rights",
                    language == "fr"
                        ? "Vous pouvez demander accès, rectification, effacement ou opposition depuis Données et conformité."
                        : "You may request access, rectification, erasure, or objection from Data & Compliance."
                )
            ]
        case .terms:
            return [
                (
                    language == "fr" ? "Compte" : "Account",
                    language == "fr"
                        ? "Vous êtes responsable de la sécurité de vos identifiants et de l'exactitude des informations soumises."
                        : "You are responsible for keeping your credentials secure and submitting accurate information."
                ),
                (
                    language == "fr" ? "Soumissions terrain" : "Field submissions",
                    language == "fr"
                        ? "Les photos, positions GPS et détails doivent représenter l'état réel du terrain au moment de la capture."
                        : "Photos, GPS locations, and details must represent real field conditions at capture time."
                ),
                (
                    language == "fr" ? "Récompenses" : "Rewards",
                    language == "fr"
                        ? "XP, badges et récompenses dépendent de la qualité vérifiée et peuvent être annulés en cas de fraude."
                        : "XP, badges, and rewards depend on verified quality and may be revoked for fraud."
                )
            ]
        case .compliance:
            return [
                (
                    language == "fr" ? "Ce que nous stockons" : "What we store",
                    language == "fr"
                        ? "Identifiant, nom affiché, mot de passe haché, avatar, périmètre carte, XP, score de confiance, audit et soumissions."
                        : "Identifier, display name, hashed password, avatar, map scope, XP, trust score, audit trail, and submissions."
                ),
                (
                    language == "fr" ? "États de consentement" : "Consent states",
                    language == "fr"
                        ? "Obtenu, refusé PII uniquement, non requis ou retiré selon le contexte de collecte."
                        : "Obtained, refused PII only, not required, or withdrawn depending on the collection context."
                ),
                (
                    language == "fr" ? "Sous-traitants" : "Processors",
                    "Supabase · Vercel · Sentry · Google Identity · Resend."
                )
            ]
        case .ipReport:
            return []
        }
    }
}

struct SettingsLegalView: View {
    let kind: SettingsLegalKind
    let language: String
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var reporterName = ""
    @State private var reporterEmail = ""
    @State private var targetKind = "submission"
    @State private var targetRef = ""
    @State private var ipDescription = ""
    @State private var sworn = false
    @State private var signature = ""
    @State private var legalMessage: String?
    @State private var isSubmitting = false
    @State private var didSubmitIpReport = false

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: kind.title(language: language), onBack: { dismiss() })
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if didSubmitIpReport {
                        successCard
                    } else {
                        introCard
                        ForEach(Array(kind.sections(language: language).enumerated()), id: \.offset) { _, section in
                            ADLCard {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(section.0)
                                        .font(ADLFont.inter(15, .bold))
                                        .foregroundColor(ADLColor.ink)
                                    Text(section.1)
                                        .font(ADLFont.inter(13))
                                        .foregroundColor(ADLColor.inkMuted)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }

                        if kind == .compliance {
                            complianceActions
                        }

                        if kind == .ipReport {
                            ipReportForm
                        } else {
                            contactButtons
                        }

                        if let legalMessage {
                            Text(legalMessage)
                                .font(ADLFont.inter(12, .semibold))
                                .foregroundColor(legalMessageColor)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding(16)
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationBarBackButtonHidden(true)
        .onAppear(perform: seedReporterFields)
    }

    private var introCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 10) {
                Text(kind.title(language: language))
                    .font(ADLFont.inter(18, .bold))
                    .foregroundColor(ADLColor.ink)
                Text(kind.body(language: language))
                    .font(ADLFont.inter(14))
                    .foregroundColor(Color(hex: 0x4b5563))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var successCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundColor(ADLColor.forest)
                Text(language == "fr" ? "Signalement reçu" : "Report received")
                    .font(ADLFont.inter(18, .bold))
                    .foregroundColor(ADLColor.ink)
                Text(language == "fr"
                     ? "Merci. Notre équipe juridique examinera votre signalement et répondra sous 10 jours ouvrés."
                     : "Thank you. Our legal team will review your report and respond within 10 business days.")
                    .font(ADLFont.inter(13))
                    .foregroundColor(ADLColor.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Button(language == "fr" ? "Retour aux paramètres" : "Back to Settings") {
                    dismiss()
                }
                .buttonStyle(PrimaryButtonStyle())
            }
        }
    }

    private var complianceActions: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                Text(language == "fr" ? "Vos droits" : "Your rights")
                    .font(ADLFont.inter(15, .bold))
                    .foregroundColor(ADLColor.ink)
                complianceButton(
                    type: "access",
                    title: language == "fr" ? "Demander l'accès aux données" : "Request data access",
                    body: language == "fr" ? "Recevoir une copie de toutes les données personnelles détenues." : "Get a copy of all personal data we hold."
                )
                complianceButton(
                    type: "rectification",
                    title: language == "fr" ? "Demander une rectification" : "Request rectification",
                    body: language == "fr" ? "Corriger des données inexactes ou incomplètes." : "Correct inaccurate or incomplete data."
                )
                complianceButton(
                    type: "erasure",
                    title: language == "fr" ? "Demander l'effacement" : "Request erasure",
                    body: language == "fr" ? "Supprimer votre compte et vos soumissions personnelles." : "Delete your account and personal submissions."
                )
            }
        }
    }

    private func complianceButton(type: String, title: String, body: String) -> some View {
        Button {
            submitPrivacyRequest(type)
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "doc.badge.gearshape")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(ADLColor.navy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(ADLFont.inter(13, .bold))
                        .foregroundColor(ADLColor.ink)
                    Text(body)
                        .font(ADLFont.inter(12))
                        .foregroundColor(ADLColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(12)
            .background(ADLColor.paper)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting)
    }

    private var ipReportForm: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 14) {
                legalField(language == "fr" ? "Votre nom complet" : "Your full name", text: $reporterName)
                legalField(language == "fr" ? "Votre email" : "Your email", text: $reporterEmail, keyboard: .emailAddress)

                VStack(alignment: .leading, spacing: 6) {
                    Text(language == "fr" ? "Type de cible" : "Target kind")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(Color(hex: 0x6b7280))
                    Picker("", selection: $targetKind) {
                        Text(language == "fr" ? "Soumission" : "Submission").tag("submission")
                        Text("Point").tag("point")
                        Text(language == "fr" ? "Autre" : "Other").tag("other")
                    }
                    .pickerStyle(.segmented)
                }

                legalField(language == "fr" ? "Référence cible (facultatif)" : "Target reference (optional)", text: $targetRef)

                VStack(alignment: .leading, spacing: 6) {
                    Text(language == "fr" ? "Description de l'atteinte (min 20 car.)" : "Description of the infringement (min 20 chars)")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(Color(hex: 0x6b7280))
                    TextEditor(text: $ipDescription)
                        .font(ADLFont.inter(13))
                        .frame(minHeight: 112)
                        .padding(8)
                        .background(ADLColor.paper)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                Toggle(isOn: $sworn) {
                    Text(language == "fr"
                         ? "Je déclare sous serment que ces informations sont exactes et que je suis autorisé à agir."
                         : "I swear that this notice is accurate and that I am authorized to act.")
                        .font(ADLFont.inter(12))
                        .foregroundColor(ADLColor.inkMuted)
                }
                .tint(ADLColor.navy)

                legalField(language == "fr" ? "Signature (nom complet)" : "Signature (full name)", text: $signature)

                Button {
                    submitIpReport()
                } label: {
                    if isSubmitting {
                        ProgressView().tint(.white)
                    } else {
                        Text(language == "fr" ? "Envoyer le signalement" : "Submit report")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isSubmitting)
            }
        }
    }

    private func legalField(_ title: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(ADLFont.inter(11, .bold))
                .foregroundColor(Color(hex: 0x6b7280))
            TextField(title, text: text)
                .font(ADLFont.inter(13))
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
                .autocorrectionDisabled(keyboard == .emailAddress)
                .padding(.horizontal, 12)
                .frame(height: 46)
                .background(ADLColor.paper)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var contactButtons: some View {
        VStack(spacing: 10) {
            Button {
                openURL(contactURL)
            } label: {
                Label(contactLabel, systemImage: contactIcon)
            }
            .buttonStyle(SecondaryButtonStyle())
        }
    }

    private var contactURL: URL {
        switch kind {
        case .ipReport:
            return URL(string: "mailto:legal@africandatalayer.com")!
        default:
            return URL(string: "mailto:privacy@africandatalayer.com")!
        }
    }

    private var contactLabel: String {
        switch kind {
        case .ipReport:
            return language == "fr" ? "Contacter l'équipe juridique" : "Contact legal team"
        default:
            return language == "fr" ? "Contacter confidentialité" : "Contact privacy team"
        }
    }

    private var contactIcon: String {
        kind == .ipReport ? "envelope.badge.shield.half.filled" : "envelope.fill"
    }

    private var legalMessageColor: Color {
        guard let legalMessage else { return ADLColor.inkMuted }
        if legalMessage == successMessage { return ADLColor.forest }
        return ADLColor.terracotta
    }

    private var successMessage: String {
        language == "fr" ? "Demande envoyée. Notre équipe répondra sous 30 jours." : "Request submitted. Our team will respond within 30 days."
    }

    private func seedReporterFields() {
        if reporterName.isEmpty {
            reporterName = appState.userProfile?.name ?? appState.profile.name
        }
        if reporterEmail.isEmpty,
           let id = appState.userProfile?.id,
           id.contains("@") {
            reporterEmail = id
        }
    }

    private func submitPrivacyRequest(_ type: String) {
        isSubmitting = true
        legalMessage = nil
        Task {
            do {
                try await appState.submitPrivacyRequest(PrivacyRequestPayload(
                    requestType: type,
                    subjectReference: appState.userProfile?.id,
                    notes: language == "fr"
                        ? "Demande \(type) initiée depuis l'application native."
                        : "Self-service \(type) request from native app."
                ))
                legalMessage = successMessage
            } catch {
                legalMessage = (error as? APIError)?.message ?? (language == "fr" ? "La demande a échoué." : "Request failed.")
            }
            isSubmitting = false
        }
    }

    private func submitIpReport() {
        let name = reporterName.trimmingCharacters(in: .whitespacesAndNewlines)
        let email = reporterEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        let description = ipDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let signed = signature.trimmingCharacters(in: .whitespacesAndNewlines)

        guard name.count >= 2 else {
            legalMessage = language == "fr" ? "Entrez votre nom complet." : "Enter your full name."
            return
        }
        guard email.contains("@") && email.contains(".") else {
            legalMessage = language == "fr" ? "Entrez un email valide." : "Enter a valid email."
            return
        }
        guard description.count >= 20 else {
            legalMessage = language == "fr" ? "La description doit contenir au moins 20 caractères." : "Description must be at least 20 characters."
            return
        }
        guard sworn else {
            legalMessage = language == "fr" ? "Confirmez la déclaration sous serment." : "Confirm the sworn statement."
            return
        }
        guard !signed.isEmpty else {
            legalMessage = language == "fr" ? "Signez avec votre nom complet." : "Sign with your full name."
            return
        }

        isSubmitting = true
        legalMessage = nil
        Task {
            do {
                try await appState.submitIpReport(IpReportPayload(
                    reporterName: name,
                    reporterEmail: email,
                    targetKind: targetKind,
                    targetRef: targetRef.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : targetRef.trimmingCharacters(in: .whitespacesAndNewlines),
                    description: description,
                    sworn: true
                ))
                didSubmitIpReport = true
            } catch {
                legalMessage = (error as? APIError)?.message ?? (language == "fr" ? "La soumission a échoué." : "Submission failed.")
            }
            isSubmitting = false
        }
    }
}

private extension View {
    func settingsCard() -> some View {
        self
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous)
                    .stroke(ADLColor.line, lineWidth: 1)
            )
    }
}

struct DailyProgressWidget: View {
    let goal: DailyGoal
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ADLCard {
            HStack(spacing: 14) {
                ZStack {
                    Circle().stroke(ADLColor.line, lineWidth: 7)
                    Circle()
                        .trim(from: 0, to: goal.fraction)
                        .stroke(ADLColor.forest, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("\(goal.completed)/\(goal.target)")
                        .font(ADLFont.inter(12, .bold))
                        .foregroundColor(ADLColor.ink)
                }
                .frame(width: 52, height: 52)

                VStack(alignment: .leading, spacing: 3) {
                    Text(appState.t("Today's goal", "Objectif du jour"))
                        .font(ADLFont.inter(15, .semibold))
                        .foregroundColor(ADLColor.ink)
                    Text(goal.completed >= goal.target
                         ? appState.t("Goal complete — nice work.", "Objectif atteint — bien joué !")
                         : appState.t("\(goal.target - goal.completed) more captures to go.", "\(goal.target - goal.completed) captures restantes."))
                        .font(ADLFont.inter(13))
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
        }
    }
}

struct LevelUpCelebration: View {
    let tier: AgentTier
    let onDismiss: () -> Void
    @EnvironmentObject private var appState: AppState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture { onDismiss() }

            if !reduceMotion {
                ConfettiView()
                    .allowsHitTesting(false)
            }

            VStack(spacing: 14) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 52))
                    .foregroundColor(ADLColor.gold)
                Text(appState.t("Level up!", "Niveau supérieur !"))
                    .font(ADLFont.inter(20, .bold))
                    .foregroundColor(ADLColor.ink)
                Text(appState.t("You reached \(tier.title)", "Vous avez atteint \(tier.title)"))
                    .font(ADLFont.inter(15))
                    .foregroundColor(.secondary)
                Button(appState.t("Keep going", "Continuer")) { onDismiss() }
                    .buttonStyle(PrimaryButtonStyle())
            }
            .padding(28)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .padding(40)
            .scaleEffect(shown || reduceMotion ? 1 : 0.7)
            .opacity(shown || reduceMotion ? 1 : 0)
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.spring(response: 0.45, dampingFraction: 0.7)) { shown = true }
        }
    }
}

/// Lightweight falling-confetti layer for celebrations.
struct ConfettiView: View {
    private let pieces = 18
    private let palette: [Color] = [ADLColor.gold, ADLColor.terracotta, ADLColor.forest, ADLColor.navySoft]
    @State private var animate = false

    var body: some View {
        GeometryReader { geo in
            ForEach(0..<pieces, id: \.self) { index in
                let x = CGFloat.random(in: 0...geo.size.width)
                let delay = Double.random(in: 0...0.4)
                let size = CGFloat.random(in: 6...11)
                RoundedRectangle(cornerRadius: 2)
                    .fill(palette[index % palette.count])
                    .frame(width: size, height: size * 1.6)
                    .position(x: x, y: animate ? geo.size.height + 40 : -40)
                    .rotationEffect(.degrees(animate ? 220 : 0))
                    .opacity(animate ? 0 : 1)
                    .animation(.easeIn(duration: 1.6).delay(delay), value: animate)
            }
        }
        .onAppear { animate = true }
    }
}

struct CameraPicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        private let parent: CameraPicker

        init(_ parent: CameraPicker) {
            self.parent = parent
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            parent.image = info[.originalImage] as? UIImage
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

struct ProfileImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    let sourceType: UIImagePickerController.SourceType
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(sourceType) ? sourceType : .photoLibrary
        picker.allowsEditing = true
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        private let parent: ProfileImagePicker

        init(_ parent: ProfileImagePicker) {
            self.parent = parent
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            parent.image = (info[.editedImage] as? UIImage) ?? (info[.originalImage] as? UIImage)
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

private extension UIImage {
    func adlProfileImageDataURL(maxDimension: CGFloat = 768, compressionQuality: CGFloat = 0.68) -> String? {
        let source = adlScaledProfileImage(maxDimension: maxDimension)
        guard let data = source.jpegData(compressionQuality: compressionQuality) else { return nil }
        return "data:image/jpeg;base64,\(data.base64EncodedString())"
    }

    func adlScaledProfileImage(maxDimension: CGFloat) -> UIImage {
        let largest = max(size.width, size.height)
        guard largest > maxDimension, largest > 0 else { return self }

        let scale = maxDimension / largest
        let targetSize = CGSize(width: size.width * scale, height: size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: targetSize, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: targetSize))
        }
    }
}
