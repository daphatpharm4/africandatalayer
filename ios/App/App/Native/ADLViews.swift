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
                Text("DOUALA · CAMEROON")
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

    private struct Slide: Identifiable {
        let id = UUID()
        let eyebrow: String
        let title: String
        let body: String
    }

    private let slides: [Slide] = [
        Slide(eyebrow: "Welcome",
              title: "The city, mapped\nfrom the ground up.",
              body: "African Data Layer turns everyday movement in Bonamoussadi into verified infrastructure data."),
        Slide(eyebrow: "Before you start",
              title: "Camera + GPS,\nverified at capture.",
              body: "We need your camera and location to verify each capture. Only live photos are accepted — no gallery uploads."),
        Slide(eyebrow: "7 Verticals",
              title: "Every corner\nof the city counts.",
              body: "Pharmacies, mobile money, fuel, alcohol, billboards, roads, buildings — all mapped and verified in real time."),
        Slide(eyebrow: "Rewards",
              title: "Map more.\nClimb higher.",
              body: "Earn XP on every verified submission. Rise up the leaderboard. Unlock badges and real rewards."),
        Slide(eyebrow: "Ready?",
              title: "Join the\nmission.",
              body: "Sign in or create your account to start contributing. Data collection starts now."),
    ]

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
                            Text("Skip")
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
                        Text("Sign In · Connexion")
                            .font(ADLFont.inter(13, .bold))
                            .tracking(1.4)
                            .textCase(.uppercase)
                    }
                    .buttonStyle(CTAButtonStyle())

                    Button { onContinue() } label: {
                        Text("Create Account · Créer un compte")
                            .font(ADLFont.inter(13, .bold))
                            .tracking(1.0)
                            .textCase(.uppercase)
                    }
                    .buttonStyle(SecondaryButtonStyle())

                    Button { onGuest() } label: {
                        Text("Browse as Guest")
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
                        Text("Next")
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
                Text("Be the first verified.")
                    .font(ADLFont.inter(14, .semibold))
                    .foregroundColor(.white.opacity(0.85))
            }
        }
    }
}

private struct HeroReady: View {
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
                Text("DOUALA · CAMEROON")
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
    var onBack: (() -> Void)? = nil

    private enum Mode { case signin, signup }
    @State private var mode: Mode = .signin
    @State private var identifier = ""
    @State private var password = ""
    @State private var showPassword = false

    private var title: String { mode == .signin ? "Welcome back" : "Join the network" }
    private var subtitle: String {
        mode == .signin
            ? "Sign in to continue capturing verified field data on the ground."
            : "Create a field account to capture locations, services, and infrastructure changes on the ground."
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
                    Button { appState.authError = "Apple sign-in is available in the production build." } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "applelogo").font(.system(size: 17, weight: .medium))
                            Text("Sign in with Apple").font(ADLFont.inter(15, .semibold))
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, 28)

                    Button { appState.authError = "Google sign-in is available in the production build." } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "globe").font(.system(size: 16, weight: .semibold))
                            Text("Continue with Google").font(ADLFont.inter(15, .semibold))
                        }
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .padding(.top, 12)

                    // Credentials form
                    VStack(alignment: .leading, spacing: 16) {
                        fieldLabel("Phone number or email")
                        ADLInputField(icon: "envelope", placeholder: "+2376XXXXXXXX or name@email.com", text: $identifier, isSecure: false, keyboard: .emailAddress)

                        fieldLabel("Password")
                        ADLInputField(
                            icon: "lock",
                            placeholder: mode == .signup ? "Min. 10 chars, A-Z, a-z, 0-9" : "Your password",
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

                        Button {
                            Task { await appState.signIn(identifier: identifier, password: password) }
                        } label: {
                            HStack(spacing: 8) {
                                if appState.isSigningIn {
                                    ProgressView().tint(.white)
                                } else {
                                    Text(mode == .signin ? "Sign in" : "Create account")
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
                        Button { } label: {
                            Text("Forgot your password?")
                                .font(ADLFont.inter(13, .semibold))
                                .foregroundColor(ADLColor.navy)
                        }
                        .padding(.top, 12)
                    }

                    // Shield reassurance
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.shield.fill").font(.system(size: 12))
                        Text("Encrypted sign-in keeps your field account secure.")
                            .font(ADLFont.inter(12, .semibold))
                    }
                    .foregroundColor(ADLColor.inkMuted)
                    .padding(.top, 28)

                    // Mode toggle
                    HStack(spacing: 4) {
                        Text(mode == .signin ? "Don't have an account?" : "Already have an account?")
                            .font(ADLFont.inter(12))
                            .foregroundColor(ADLColor.inkMuted)
                        Button {
                            withAnimation { mode = mode == .signin ? .signup : .signin }
                            appState.authError = nil
                        } label: {
                            Text(mode == .signin ? "Create an account" : "Sign in instead")
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
        .onChange(of: appState.selectedRole) { _ in appState.enforceVisibleNavigation() }
        .onChange(of: appState.selectedTab) { _ in appState.enforceVisibleNavigation() }
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
        case .analytics: AnalyticsView()
        }
    }
}

/// Green "all synced" status strip mirroring the web SyncStatusBar.
struct ADLSyncBar: View {
    let message: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 14))
                .foregroundColor(ADLColor.forest)
            Text(message.isEmpty ? "All synced. Ready to capture." : message)
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

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            ForEach(routes) { route in
                let active = route == selection
                let isContribute = route == .contribute
                Button { onSelect(route) } label: {
                    VStack(spacing: 4) {
                        Image(systemName: icon(for: route))
                            .font(.system(size: 19, weight: .medium))
                        Text(title(for: route))
                            .font(ADLFont.inter(11, .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .foregroundColor(active ? ADLColor.navy : (isContribute ? ADLColor.terracotta : Color(hex: 0x6b7280)))
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background(
                        RoundedRectangle(cornerRadius: 21, style: .continuous)
                            .fill(active ? ADLColor.navyWash : Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 21, style: .continuous)
                            .stroke(active ? ADLColor.navy.opacity(0.06) : Color.clear, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .background(
            Color.white
                .overlay(Rectangle().fill(ADLColor.lineStrong).frame(height: 1), alignment: .top)
                .shadow(color: ADLColor.navy.opacity(0.1), radius: 16, x: 0, y: -8)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func title(for route: AppRoute) -> String {
        switch route {
        case .home: return isAdmin ? "Map" : "Explore"
        case .contribute: return "Contribute"
        case .queue: return "Queue"
        case .rewards: return "Rewards"
        case .profile: return "Profile"
        case .adminReview: return "Queue"
        case .agentPerformance: return "Agents"
        case .clientDashboard: return "Delta"
        case .analytics: return isAdmin ? "Impact" : "Leaderboard"
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
        case .analytics: return isAdmin ? "chart.bar" : "medal"
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
    @State private var trackingMode: MapUserTrackingMode = .none
    @State private var selectedPoint: DataPoint?
    @State private var activeCategory: SubmissionCategory?

    private let collectionZone = [
        CLLocationCoordinate2D(latitude: 4.0933, longitude: 9.7342),
        CLLocationCoordinate2D(latitude: 4.0938, longitude: 9.7454),
        CLLocationCoordinate2D(latitude: 4.0858, longitude: 9.7472),
        CLLocationCoordinate2D(latitude: 4.0829, longitude: 9.7371)
    ]

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
            .accessibilityLabel("Apple Maps field map")

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
                        Text("Loading backend points")
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
                    .accessibilityLabel("Center on user location")

                    Button {
                        region = MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: 4.0887, longitude: 9.7403),
                            span: MKCoordinateSpan(latitudeDelta: 0.018, longitudeDelta: 0.018)
                        )
                        trackingMode = .none
                    } label: {
                        Image(systemName: "scope")
                            .frame(width: 46, height: 46)
                    }
                    .background(Color.white)
                    .foregroundColor(ADLColor.navy)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .shadow(color: .black.opacity(0.16), radius: 10, y: 4)
                    .accessibilityLabel("Recenter Bonamoussadi zone")

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
        .navigationTitle("Field Map")
        .task { await appState.loadPoints() }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    appState.startMapCapture(at: region.center)
                } label: {
                    Image(systemName: "plus.circle.fill")
                }
                .accessibilityLabel("Start capture")
            }
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
    @Binding var trackingMode: MapUserTrackingMode
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
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.parent = self
        updateTrackingMode(on: mapView)

        if !mapView.region.isClose(to: region) {
            mapView.setRegion(region, animated: true)
        }

        mapView.removeAnnotations(mapView.annotations.filter { !($0 is MKUserLocation) })
        mapView.addAnnotations(points.map(FieldPointAnnotation.init(point:)))

        mapView.removeOverlays(mapView.overlays)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    private func updateTrackingMode(on mapView: MKMapView) {
        let nextMode: MKUserTrackingMode
        switch trackingMode {
        case .follow:
            nextMode = .follow
        case .followWithHeading:
            nextMode = .followWithHeading
        default:
            nextMode = .none
        }

        if mapView.userTrackingMode != nextMode {
            mapView.setUserTrackingMode(nextMode, animated: true)
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
    let point: DataPoint

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
        abs(center.latitude - other.center.latitude) < 0.000_001 &&
            abs(center.longitude - other.center.longitude) < 0.000_001 &&
            abs(span.latitudeDelta - other.span.latitudeDelta) < 0.000_001 &&
            abs(span.longitudeDelta - other.span.longitudeDelta) < 0.000_001
    }
}

struct FieldMapHeader: View {
    let pointCount: Int
    let refreshCount: Int
    let locationStatus: String
    let activeCategory: SubmissionCategory?
    let onSelectCategory: (SubmissionCategory?) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Bonamoussadi field map")
                        .font(.headline.weight(.bold))
                        .foregroundColor(ADLColor.ink)
                    Text("Collection zone, trusted points, and next captures.")
                        .font(.footnote.weight(.medium))
                        .foregroundColor(.secondary)
                }
                Spacer()
                StatusPill(title: "Apple Maps", tint: ADLColor.forest)
            }

            HStack(spacing: 8) {
                StatusPill(title: "\(pointCount) points", tint: ADLColor.navy)
                StatusPill(title: "\(refreshCount) refresh", tint: refreshCount > 0 ? ADLColor.terracotta : ADLColor.forest)
                StatusPill(title: locationStatus, tint: ADLColor.gold)
            }

            Menu {
                Button("All verticals") { onSelectCategory(nil) }
                ForEach(SubmissionCategory.allCases) { category in
                    Button(category.title) { onSelectCategory(category) }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: activeCategory?.systemImage ?? "square.grid.2x2")
                        .font(.system(size: 14, weight: .semibold))
                    Text(activeCategory?.title ?? "All verticals")
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
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(ADLColor.ink)
                        Text(selectedPoint.requiresRefresh ? "Ready for refresh capture" : "Verified point")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }

                Button {
                    onCaptureSelectedPoint(selectedPoint)
                } label: {
                    Label("Capture Selected Point", systemImage: "camera.fill")
                }
                .buttonStyle(PrimaryButtonStyle())
            } else {
                Button {
                    onCaptureMapCenter()
                } label: {
                    Label("Capture Map Center", systemImage: "camera.viewfinder")
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

    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 16) {
                pointPhoto

                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: point.category.systemImage)
                        .font(.title3.weight(.bold))
                        .foregroundColor(.white)
                        .frame(width: 48, height: 48)
                        .background(point.category.tint)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                    VStack(alignment: .leading, spacing: 5) {
                        Text(point.name)
                            .font(.title3.weight(.bold))
                            .foregroundColor(ADLColor.ink)
                        Text(point.subtitle)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }

                HStack(spacing: 8) {
                    StatusPill(title: point.category.title, tint: point.category.tint)
                    StatusPill(title: "\(point.trustScore)% trust", tint: point.trustScore >= 85 ? ADLColor.forest : ADLColor.gold)
                    if point.requiresRefresh {
                        StatusPill(title: "Refresh due", tint: ADLColor.terracotta)
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    DetailRow(title: "Events", value: "\(point.eventsCount)")
                    DetailRow(title: "Latitude", value: String(format: "%.5f", point.location.latitude))
                    DetailRow(title: "Longitude", value: String(format: "%.5f", point.location.longitude))
                    if let accuracy = point.location.accuracyMeters {
                        DetailRow(title: "Accuracy", value: "\(Int(accuracy)) m")
                    }
                }
                .padding(12)
                .background(ADLColor.paper)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                Spacer()

                if canContribute {
                    Button {
                        dismiss()
                        onCapture()
                    } label: {
                        Label(point.requiresRefresh ? "Capture Refresh" : "Enrich Point", systemImage: "camera.fill")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }

                Button {
                    dismiss()
                    onCenter()
                } label: {
                    Label("Center on Map", systemImage: "scope")
                }
                .buttonStyle(SecondaryButtonStyle())
            }
            .padding(16)
            .background(Color.white.ignoresSafeArea())
            .navigationTitle("Point Detail")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
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
            Text("Field photo")
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
                .font(.footnote.weight(.medium))
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.footnote.weight(.semibold))
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

    private var contributionForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ADLCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Capture point")
                            .font(.title2.weight(.bold))
                            .foregroundColor(ADLColor.ink)

                        Picker("Vertical", selection: $category) {
                            ForEach(SubmissionCategory.allCases) { item in
                                Label(item.title, systemImage: item.systemImage).tag(item)
                            }
                        }

                        RequiredFieldsView(category: category)
                        detailsFields

                        TextEditor(text: $notes)
                            .frame(minHeight: 110)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(ADLColor.line, lineWidth: 1)
                            )
                            .accessibilityLabel("Notes")

                        Picker("Consent", selection: $consentStatus) {
                            ForEach(ConsentStatus.allCases) { status in
                                Text(status.title).tag(status)
                            }
                        }
                        .pickerStyle(.menu)

                        HStack(spacing: 10) {
                            Button {
                                locationProvider.requestCurrentLocation()
                            } label: {
                                Label("GPS", systemImage: "location.fill")
                            }
                            .buttonStyle(SecondaryButtonStyle())

                            Button {
                                showingCamera = true
                            } label: {
                                Label("Photo", systemImage: "camera.fill")
                            }
                            .buttonStyle(SecondaryButtonStyle())
                        }

                        HStack {
                            StatusPill(title: locationProvider.statusText, tint: ADLColor.forest)
                            if capturedImage != nil {
                                StatusPill(title: "Photo ready", tint: ADLColor.gold)
                            }
                        }

                        if let validationMessage {
                            Text(validationMessage)
                                .font(.footnote.weight(.semibold))
                                .foregroundColor(ADLColor.terracotta)
                        }

                        if let capturedImage {
                            Image(uiImage: capturedImage)
                                .resizable()
                                .scaledToFill()
                                .frame(height: 180)
                                .clipped()
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }

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
                            siteName = ""
                            roadName = ""
                            notes = ""
                            capturedImage = nil
                            validationMessage = nil
                            mapPointId = nil
                        } label: {
                            Label("Queue Contribution", systemImage: "tray.and.arrow.down.fill")
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                }
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Capture")
        .sheet(isPresented: $showingCamera) {
            CameraPicker(image: $capturedImage)
        }
        .onAppear {
            applyMapCaptureContextIfNeeded()
        }
    }

    @ViewBuilder
    private var detailsFields: some View {
        switch category {
        case .pharmacy:
            TextField("Pharmacy name", text: $siteName)
                .textFieldStyle(.roundedBorder)
            Toggle("Open now", isOn: $isOpenNow)
            Toggle("On duty", isOn: $isOnDuty)
            TextField("Opening hours", text: $openingHours)
                .textFieldStyle(.roundedBorder)
        case .mobileMoney:
            TextField("Providers", text: $providerText)
                .textFieldStyle(.roundedBorder)
            TextField("Merchant ID", text: $merchantId)
                .textFieldStyle(.roundedBorder)
            TextField("Payment methods", text: $paymentMethodsText)
                .textFieldStyle(.roundedBorder)
            TextField("Opening hours", text: $openingHours)
                .textFieldStyle(.roundedBorder)
        case .fuelStation:
            TextField("Station name", text: $siteName)
                .textFieldStyle(.roundedBorder)
            Toggle("Fuel available", isOn: $hasFuelAvailable)
            TextField("Fuel types", text: $fuelTypesText)
                .textFieldStyle(.roundedBorder)
            TextField("Super price", text: $fuelPriceText)
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
            TextField("Quality", text: $quality)
                .textFieldStyle(.roundedBorder)
        case .alcoholOutlet:
            TextField("Outlet name", text: $siteName)
                .textFieldStyle(.roundedBorder)
            TextField("Outlet type", text: $outletType)
                .textFieldStyle(.roundedBorder)
            Toggle("Formal outlet", isOn: $isFormal)
            TextField("Payment methods", text: $paymentMethodsText)
                .textFieldStyle(.roundedBorder)
        case .billboard:
            TextField("Billboard name", text: $siteName)
                .textFieldStyle(.roundedBorder)
            TextField("Billboard type", text: $billboardType)
                .textFieldStyle(.roundedBorder)
            Toggle("Occupied", isOn: $isOccupied)
            TextField("Advertiser brand", text: $advertiserBrand)
                .textFieldStyle(.roundedBorder)
        case .transportRoad:
            TextField("Road name", text: $roadName)
                .textFieldStyle(.roundedBorder)
            TextField("Condition", text: $roadCondition)
                .textFieldStyle(.roundedBorder)
            TextField("Surface", text: $roadSurface)
                .textFieldStyle(.roundedBorder)
            Toggle("Blocked", isOn: $roadBlocked)
            if roadBlocked {
                TextField("Blockage type", text: $blockageType)
                    .textFieldStyle(.roundedBorder)
            }
        case .censusProxy:
            TextField("Building type", text: $buildingType)
                .textFieldStyle(.roundedBorder)
            TextField("Occupancy status", text: $occupancyStatus)
                .textFieldStyle(.roundedBorder)
            TextField("Storey count", text: $storeyCount)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
            TextField("Estimated units", text: $estimatedUnits)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
        }
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
            pointId: mapPointId ?? "ios-\(UUID().uuidString)",
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
    let category: SubmissionCategory

    var body: some View {
        let fields = VerticalConfig.all[category]?.requiredFields ?? []
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "checklist")
                .foregroundColor(category.tint)
            Text(fields.isEmpty ? "No required fields" : "Required: \(fields.joined(separator: ", "))")
                .font(.footnote.weight(.medium))
                .foregroundColor(.secondary)
            Spacer()
        }
        .padding(10)
        .background(category.tint.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct SubmissionQueueView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            Section {
                MetricTile(title: "Queued", value: "\(appState.queueSnapshot.queued)", systemImage: "tray.full.fill", tint: ADLColor.forest)
                MetricTile(title: "Failed", value: "\(appState.queueSnapshot.failed)", systemImage: "exclamationmark.triangle.fill", tint: ADLColor.terracotta)
                Text(appState.lastSyncMessage)
                    .font(.footnote)
                    .foregroundColor(.secondary)
            }

            Section("Drafts") {
                if appState.drafts.isEmpty {
                    Text("No offline drafts")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(appState.drafts) { draft in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Label(draft.displayTitle, systemImage: draft.category.systemImage)
                                    .font(.headline)
                                Spacer()
                                StatusPill(title: draft.syncState.title, tint: draft.syncState == .failed ? ADLColor.terracotta : ADLColor.forest)
                            }
                            Text(draft.notes.isEmpty ? draft.category.title : draft.notes)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            if let lastError = draft.lastError {
                                Text(lastError)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(ADLColor.terracotta)
                            }
                            if draft.syncState != .synced {
                                Button {
                                    Task {
                                        await appState.syncDraft(draft)
                                    }
                                } label: {
                                    Label("Sync Draft", systemImage: "arrow.triangle.2.circlepath")
                                }
                                .buttonStyle(.bordered)
                                .disabled(draft.syncState == .syncing)
                            }
                        }
                        .padding(.vertical, 6)
                    }
                }
            }
        }
        .navigationTitle("Offline Queue")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    Task {
                        await appState.syncQueuedDrafts()
                    }
                } label: {
                    if appState.isSyncingQueue {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                }
                .accessibilityLabel("Sync all")
            }
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
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 40, height: 40)
                    .background(filled ? Color.white.opacity(0.12) : ADLColor.navyWash)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(ADLFont.inter(13, .bold))
                        .lineLimit(1)
                    Text(subtitle)
                        .font(ADLFont.inter(11, .regular))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                        .foregroundColor(filled ? Color.white.opacity(0.72) : .secondary)
                }
                Spacer(minLength: 8)
                Image(systemName: "arrow.right")
                    .font(.system(size: 15, weight: .bold))
            }
            .foregroundColor(filled ? .white : ADLColor.navy)
            .padding(16)
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
                        Text("Level \(level)")
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
                    Text("LEVEL")
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
    let xp: Int

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text("XP BALANCE")
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
    let streakDays: Int

    var body: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("STREAK")
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
                            .font(ADLFont.inter(13, .regular))
                            .foregroundColor(.secondary)
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
                Text("\(entry.contributions.formatted()) submissions - \(RelativeDate.short(entry.lastContributionAt))")
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(entry.lastLocation)
                    .font(ADLFont.inter(12, .regular))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                if !compact {
                    Text("Verified value score: \(entry.rankingScore.formatted())")
                        .font(ADLFont.inter(12, .regular))
                        .foregroundColor(.secondary)
                }
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 5) {
                Text("Score: \(entry.rankingScore.formatted())")
                    .font(ADLFont.inter(12, .bold))
                    .foregroundColor(ADLColor.navy)
                    .lineLimit(1)
                Text("\(entry.xp.formatted()) XP")
                    .font(ADLFont.inter(12, .bold))
                    .foregroundColor(ADLColor.forest)
                    .lineLimit(1)
                Text("\(entry.averageQualityScore)% quality")
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
    let entry: LeaderboardEntry
    let maxXP: Int

    private var rankBg: Color {
        switch entry.rank {
        case 1: return ADLColor.gold
        case 2: return Color(hex: 0xcbd5e1) // silver
        case 3: return ADLColor.terracotta  // bronze/terra
        default: return ADLColor.navyWash
        }
    }

    private var rankFg: Color {
        switch entry.rank {
        case 1: return Color.white
        case 2: return Color(hex: 0x374151)
        case 3: return Color.white
        default: return ADLColor.navy
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            // Rank circle
            Text("\(entry.rank)")
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
                    Text("Loading live metrics…")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }
            } else if let error = appState.analyticsError {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(ADLColor.terracotta)
                    Text(error)
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

struct AdminReviewView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            Section {
                HStack(spacing: 12) {
                    MetricTile(
                        title: "Pending review",
                        value: "\(appState.analyticsSummary?.reviewQueue.pendingReview ?? appState.points.filter(\.requiresRefresh).count)",
                        systemImage: "checkmark.shield.fill",
                        tint: ADLColor.terracotta
                    )
                    MetricTile(
                        title: "High-risk events",
                        value: "\(appState.analyticsSummary?.reviewQueue.highRiskEvents ?? 0)",
                        systemImage: "exclamationmark.octagon.fill",
                        tint: ADLColor.gold
                    )
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            if let summary = appState.analyticsSummary {
                Section {
                    HStack(spacing: 12) {
                        MetricTile(title: "Verified", value: KpiFormat.pct(summary.verification.verificationRatePct), systemImage: "checkmark.seal.fill", tint: ADLColor.forest)
                        MetricTile(title: "Fraud rate", value: KpiFormat.pct(summary.fraud.fraudRatePct), systemImage: "shield.lefthalf.filled", tint: ADLColor.terracotta)
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }

            if appState.analyticsSummary == nil {
                Section {
                    AnalyticsStatusNote()
                        .listRowBackground(Color.clear)
                }
            }

            Section("Review queue") {
                ForEach(appState.points) { point in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Label(point.name, systemImage: point.category.systemImage)
                                .font(.headline)
                            Spacer()
                            StatusPill(title: "\(point.trustScore)%", tint: point.trustScore >= 85 ? ADLColor.forest : ADLColor.gold)
                        }
                        Text(point.subtitle)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        HStack {
                            Button("Approve") {}
                                .buttonStyle(.borderedProminent)
                            Button("Hold") {}
                                .buttonStyle(.bordered)
                            Button("Reject") {}
                                .buttonStyle(.bordered)
                                .tint(ADLColor.terracotta)
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .navigationTitle("Review")
        .task { await appState.loadAnalytics() }
        .refreshable { await appState.loadAnalytics(force: true) }
    }
}

struct AgentPerformanceView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AnalyticsStatusNote()
                let summary = appState.analyticsSummary
                HStack(spacing: 12) {
                    MetricTile(
                        title: "Verified points",
                        value: "\(summary?.verification.verifiedPoints ?? 0)",
                        systemImage: "checkmark.seal.fill",
                        tint: ADLColor.forest
                    )
                    MetricTile(
                        title: "Active contributors",
                        value: "\(summary?.weeklyActiveContributors ?? 0)",
                        systemImage: "person.2.fill",
                        tint: ADLColor.navySoft
                    )
                }
                HStack(spacing: 12) {
                    MetricTile(
                        title: "Pending review",
                        value: "\(summary?.reviewQueue.pendingReview ?? 0)",
                        systemImage: "tray.full.fill",
                        tint: ADLColor.gold
                    )
                    MetricTile(
                        title: "Enrichment rate",
                        value: KpiFormat.pct(summary?.enrichmentRatePct ?? 0),
                        systemImage: "arrow.triangle.2.circlepath",
                        tint: ADLColor.terracotta
                    )
                }
                ADLCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Agent coaching")
                            .font(.headline)
                        Text("Reviewer notes, fraud signals, and quality trend detail stay in one operational workflow.")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Agents")
        .task { await appState.loadAnalytics() }
        .refreshable { await appState.loadAnalytics(force: true) }
    }
}

struct ClientDashboardView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                AnalyticsStatusNote()
                let summary = appState.analyticsSummary
                HStack(spacing: 12) {
                    MetricTile(
                        title: "Verified",
                        value: KpiFormat.pct(summary?.verification.verificationRatePct ?? 0),
                        systemImage: "checkmark.seal.fill",
                        tint: ADLColor.forest
                    )
                    MetricTile(
                        title: "Total points",
                        value: "\(summary?.verification.totalPoints ?? 0)",
                        systemImage: "map.fill",
                        tint: ADLColor.navySoft
                    )
                }
                HStack(spacing: 12) {
                    MetricTile(
                        title: "Median age",
                        value: KpiFormat.days(summary?.freshness.medianAgeDays ?? 0),
                        systemImage: "clock.arrow.circlepath",
                        tint: ADLColor.gold
                    )
                    MetricTile(
                        title: "Enriched",
                        value: KpiFormat.pct(summary?.enrichmentRatePct ?? 0),
                        systemImage: "arrow.triangle.2.circlepath",
                        tint: ADLColor.terracotta
                    )
                }
                ADLCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Presentation-ready deltas")
                            .font(.title3.weight(.bold))
                        Text("Monitor coverage, export deltas, and track trusted infrastructure changes.")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Delta")
        .task { await appState.loadAnalytics() }
        .refreshable { await appState.loadAnalytics(force: true) }
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
        if isAdmin { return "Investor Analytics" }
        if isClient { return "Insights Center" }
        return "Leaderboard"
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
                SectionLabel(text: "Leaderboard")
                Text("Top contributors near you")
                    .font(ADLFont.inter(20, .bold))
                    .foregroundColor(ADLColor.ink)
            }
            .padding(.horizontal, 4)
            .padding(.top, 4)

            // "How scoring works" card
            ADLCard {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: "How scoring works")
                    Text("Score = verified submissions × average quality")
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
                    Text("No contributor data yet.")
                        .font(ADLFont.inter(13, .semibold))
                        .foregroundColor(Color(hex: 0x374151))
                }
            } else {
                let maxXP = max(appState.leaderboard.map(\.xp).max() ?? 1, 1)
                VStack(spacing: 10) {
                    ForEach(appState.leaderboard.prefix(20)) { entry in
                        AgentLeaderboardRow(entry: entry, maxXP: maxXP)
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
                Text("CLIENT INSIGHTS")
                    .font(ADLFont.inter(11, .bold))
                    .foregroundColor(ADLColor.inkMuted)
                Text("Your data, two ways - map-level context or executive summary")
                    .font(ADLFont.inter(14, .semibold))
                    .foregroundColor(ADLColor.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 2)

            VStack(spacing: 12) {
                ADLShortcutTile(
                    title: "Delta Intelligence",
                    subtitle: "Neighborhood shifts, top cells, and export-ready map context",
                    systemImage: "map.fill",
                    filled: true
                ) {
                    appState.selectedTab = .clientDashboard
                }
                ADLShortcutTile(
                    title: "Investor Dashboard",
                    subtitle: "Executive KPIs for trust, growth, and reporting confidence",
                    systemImage: "chart.line.uptrend.xyaxis"
                )
            }

            clientKpiGrid

            ADLCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Label("HOW CLIENTS USE THIS SURFACE", systemImage: "chart.bar.fill")
                            .font(ADLFont.inter(11, .bold))
                            .foregroundColor(ADLColor.ink)
                        Spacer()
                        Text("ROLE-SPECIFIC")
                            .font(ADLFont.inter(11, .semibold))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text(clientTopCategoryText)
                            .font(ADLFont.inter(14, .semibold))
                            .foregroundColor(ADLColor.ink)
                        Text("Start with Delta Intelligence when you need exact map location, cluster drivers, and exportable context. Move to Investor Dashboard when the conversation shifts to trust, growth, and executive KPIs.")
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
                    Label("Senior Contributor", systemImage: "checkmark.shield.fill")
                        .font(ADLFont.inter(11, .semibold))
                        .foregroundColor(ADLColor.inkMuted)
                }
                Spacer()
                Text("ADMIN")
                    .font(ADLFont.inter(11, .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(ADLColor.ink)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            VStack(spacing: 12) {
                ADLShortcutTile(
                    title: "Delta Intelligence",
                    subtitle: "Snapshots, trends & anomalies",
                    systemImage: "chart.bar.fill",
                    filled: true
                ) {
                    appState.selectedTab = .clientDashboard
                }
                ADLShortcutTile(
                    title: "Agent Performance",
                    subtitle: "Quality, fraud & assignment pace",
                    systemImage: "person.2.fill"
                ) {
                    appState.selectedTab = .agentPerformance
                }
            }

            adminKpiGrid
            categoryBarsCard
            xpDistributionCard
            freshnessHeatmapCard
            leaderboardPanel(title: "Top Contributor Leaderboard", scope: "Monthly", entries: appState.leaderboard, compact: true)

            VStack(spacing: 10) {
                Text("ENTERPRISE API ACCESS")
                    .font(ADLFont.inter(11, .bold))
                    .foregroundColor(ADLColor.navy)
                Text("Structured data access for municipalities, NGOs, and logistics teams - with guaranteed uptime.")
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
            ADLMiniStat(label: "Tracked points", value: tracked.formatted(), suffix: "latest", suffixTint: ADLColor.navy)
            ADLMiniStat(label: "Completion rate", value: KpiFormat.pct(summary?.verification.verificationRatePct ?? 0), suffix: appState.isLoadingAnalytics ? "..." : "live")
            ADLMiniStat(label: "Anomaly flags", value: "\(summary?.reviewQueue.highRiskEvents ?? 0)", suffix: "watchlist", suffixTint: ADLColor.terracotta)
            ADLMiniStat(label: "Avg WoW growth", value: weeklyGrowth, suffix: "tracked", suffixTint: ADLColor.forest)
        }
    }

    private var adminKpiGrid: some View {
        let summary = appState.analyticsSummary
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ADLMiniStat(label: "Data complete", value: KpiFormat.pct(summary?.verification.verificationRatePct ?? 0), suffix: appState.isLoadingAnalytics ? "..." : "live")
            ADLMiniStat(label: "Active contributors", value: "\(summary?.weeklyActiveContributors ?? 0)", suffix: "30d", suffixTint: ADLColor.navy)
            ADLMiniStat(label: "Pending review", value: "\(summary?.reviewQueue.pendingReview ?? 0)", suffix: "queue", suffixTint: ADLColor.gold)
            ADLMiniStat(label: "Fraud rate", value: KpiFormat.pct(summary?.fraud.fraudRatePct ?? 0), suffix: "risk", suffixTint: ADLColor.terracotta)
        }
    }

    private var categoryBarsCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Label("CONTRIBUTIONS BY CATEGORY", systemImage: "chart.bar.fill")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    Text("LIVE")
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
                    Label("XP DISTRIBUTION", systemImage: "medal.fill")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    Text("ALL USERS")
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
                    Label("DATA FRESHNESS HEATMAP", systemImage: "thermometer.sun.fill")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    Text("LAST 24H")
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
                    Label("FIELD NETWORK PULSE", systemImage: "person.2.fill")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.ink)
                    Spacer()
                    Text("TOP 3 CONTRIBUTORS")
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
                Text("LIVE")
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("HOW RANKINGS WORK")
                    .font(ADLFont.inter(11, .semibold))
                    .foregroundColor(ADLColor.inkMuted)
                Text(compact ? "Ranking score = submissions x average quality" : "Score = verified submissions x average quality")
                    .font(ADLFont.inter(14, .semibold))
                    .foregroundColor(ADLColor.ink)
                if let topVerticalChampion {
                    Text("Busiest category: \(categoryTitle(topVerticalChampion.0)) (\(topVerticalChampion.1))")
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
            Text("Loading contributors...")
                .font(ADLFont.inter(11, .semibold))
                .foregroundColor(ADLColor.inkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(ADLColor.paper)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(ADLColor.line, lineWidth: 1))
        } else if entries.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("No contributors yet.")
                    .font(ADLFont.inter(13, .semibold))
                    .foregroundColor(Color(hex: 0x374151))
                Text("Score = verified submissions x average quality. Submit your first capture to appear here.")
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
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ADLGradientHero {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("YOUR BALANCE")
                                .font(.caption2.weight(.bold))
                                .tracking(1.2)
                                .foregroundColor(.white.opacity(0.75))
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text("\(appState.spendableXP)")
                                    .font(.system(size: 34, weight: .bold))
                                    .foregroundColor(.white)
                                Text("XP")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundColor(.white.opacity(0.7))
                            }
                            if appState.spentXP > 0 {
                                Text("\(appState.spentXP) XP redeemed so far")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.7))
                            }
                        }
                        Spacer()
                        Image(systemName: "gift.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding(12)
                            .background(Color.white.opacity(0.18))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }

                if let redeemError {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(ADLColor.terracotta)
                        Text(redeemError)
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(ADLColor.ink)
                    }
                }

                ADLSectionHeader(title: "Redeemable rewards")
                ForEach(appState.catalog) { reward in
                    RewardCard(reward: reward, affordable: appState.spendableXP >= reward.costXP) {
                        redeemError = nil
                        pendingReward = reward
                    }
                }

                if !appState.vouchers.isEmpty {
                    ADLSectionHeader(title: "Your wallet")
                    ForEach(appState.vouchers) { voucher in
                        VoucherRow(voucher: voucher)
                    }
                }
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Rewards")
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

    private var affordable: Bool { balance >= reward.costXP }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Confirm redemption")
                .font(.title3.weight(.bold))
                .foregroundColor(ADLColor.ink)

            ADLCard {
                VStack(alignment: .leading, spacing: 10) {
                    Label(reward.name, systemImage: reward.category.systemImage)
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(ADLColor.ink)
                    HStack {
                        Text("Cost")
                        Spacer()
                        Text("\(reward.costXP) XP").fontWeight(.bold)
                    }
                    .font(.footnote)
                    .foregroundColor(.secondary)
                    HStack {
                        Text("Balance after")
                        Spacer()
                        Text("\(max(0, balance - reward.costXP)) XP").fontWeight(.bold)
                    }
                    .font(.footnote)
                    .foregroundColor(.secondary)
                }
            }

            if !affordable {
                Text("You need \(reward.costXP - balance) more XP for this reward.")
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(ADLColor.terracotta)
            }

            Button {
                onConfirm()
            } label: {
                Label("Confirm redeem", systemImage: "checkmark.seal.fill")
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(!affordable)

            Button("Cancel") { dismiss() }
                .buttonStyle(SecondaryButtonStyle())
        }
        .padding(20)
    }
}

struct VoucherSuccessSheet: View {
    let voucher: Voucher
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 52))
                .foregroundColor(ADLColor.forest)
            Text("Reward redeemed")
                .font(.title3.weight(.bold))
                .foregroundColor(ADLColor.ink)
            Text(voucher.rewardName)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            ADLCard {
                VStack(spacing: 6) {
                    Text("VOUCHER CODE")
                        .font(.caption2.weight(.bold))
                        .tracking(1.2)
                        .foregroundColor(.secondary)
                    Text(voucher.code)
                        .font(.system(.title2, design: .monospaced).weight(.bold))
                        .foregroundColor(ADLColor.navy)
                }
                .frame(maxWidth: .infinity)
            }

            Text("Show this code to claim your reward. It's saved in your wallet.")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button("Done") { dismiss() }
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
                        .font(.footnote.weight(.bold))
                        .foregroundColor(ADLColor.ink)
                    Text(voucher.code)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("\(voucher.costXP) XP")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct BadgesView: View {
    @EnvironmentObject private var appState: AppState
    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                let earned = appState.badges.filter(\.unlocked).count
                Text("\(earned) of \(appState.badges.count) earned")
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(.secondary)
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(appState.badges) { badge in
                        BadgeTile(badge: badge)
                    }
                }
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Badges")
        .task { await appState.loadProfile() }
    }
}

struct MissionsView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ADLSectionHeader(title: "Daily")
                ForEach(appState.missions.filter { $0.period == .daily }) { mission in
                    MissionRow(mission: mission)
                }
                ADLSectionHeader(title: "Weekly")
                ForEach(appState.missions.filter { $0.period == .weekly }) { mission in
                    MissionRow(mission: mission)
                }
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Missions")
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
                .font(.subheadline.weight(.semibold))
                .foregroundColor(ADLColor.ink)
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.secondary)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
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

struct ProfileView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            // MARK: Header — title "Profile" + gear → SettingsView
            ADLScreenHeader(title: "Profile") {
                NavigationLink {
                    SettingsView()
                } label: {
                    Image(systemName: "gearshape")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(ADLColor.navy)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Settings")
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
                                KpiTile(label: "Points", value: pointsTotal.formatted(), tone: .navy)
                                KpiTile(label: "XP", value: xpCurrent.formatted(), tone: .terra)
                                KpiTile(label: "Streak", value: "\(appState.profile.streakDays)d", tone: .streak)
                                KpiTile(label: "Rank", value: rankDisplay, tone: .amber)
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
                            }

                            assignmentsCard
                            rewardActionRows
                            weeklyTargetCard
                            badgesSection
                            weekSummarySection
                            contributionHistorySection
                            uploadIssuesSection

                            // MARK: Sign-out — danger text, SecondaryButtonStyle
                            Button {
                                appState.signOut()
                            } label: {
                                Text("Sign Out")
                                    .foregroundColor(ADLColor.danger)
                            }
                            .buttonStyle(SecondaryButtonStyle())
                        }
                        .padding(16)
                        .padding(.bottom, 24)
                    }
                }
                .refreshable { await appState.loadProfile(force: true) }
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .task {
            if !appState.isGuest {
                await appState.loadProfile()
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
        if appState.isLoadingProfile { return "Loading profile" }
        return "\(appState.profile.role.title) · Bonamoussadi"
    }

    private var rankDisplay: String {
        "N/A"
    }

    private var pointsTotal: Int {
        appState.queueSnapshot.synced + appState.drafts.count
    }

    private var failedDrafts: [ContributionDraft] {
        appState.drafts.filter { $0.syncState == .failed }
    }

    private var pointsThisWeek: Int {
        let calendar = Calendar.current
        return appState.drafts.filter { calendar.isDate($0.createdAt, equalTo: Date(), toGranularity: .weekOfYear) }.count
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
                // 96-pt identity circle (web: h-[60px] w-[60px] in hero → plan specifies size:96)
                IdentityCircle(name: displayName, size: 96)

                VStack(alignment: .leading, spacing: 6) {
                    // Name + tier pill (web: text-xl font-bold + micro-label bg-gold/20 text-gold)
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(appState.isLoadingProfile ? "Loading profile" : displayName)
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
                    Text("Level \(level)")
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
                    Text("LEVEL")
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
        let nextTierName = progress.next?.title ?? "Max tier"
        return ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Trust Progress")
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
                     ? "\(xpToNext.formatted()) XP to \(nextTierName)"
                     : "You've reached the top tier!")
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
                            Text("Pending Uploads")
                                .font(ADLFont.inter(15, .semibold))
                                .foregroundColor(ADLColor.navy)
                            Text("\(appState.queueSnapshot.queued) queued · \(appState.queueSnapshot.failed) failed")
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

            // Help Center — gold-wash background
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
                        Text("Help Center")
                            .font(ADLFont.inter(15, .semibold))
                            .foregroundColor(ADLColor.navy)
                        Text("Guides for your current role and workflow.")
                            .font(ADLFont.inter(12))
                            .foregroundColor(ADLColor.inkMuted)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(ADLColor.inkMuted)
                }
            }
            .background(ADLColor.goldWash)
            .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
        }
    }

    // MARK: - Admin map access card

    private var adminMapAccessCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        SectionLabel(text: "Admin Map Access")
                        Text("Unlock worldwide map")
                            .font(ADLFont.inter(14, .bold))
                            .foregroundColor(ADLColor.ink)
                    }
                    Spacer()
                    StatusPill(title: "Enabled", tint: ADLColor.forest)
                }
                Text("Explorer map is unlocked worldwide.")
                    .font(ADLFont.inter(12))
                    .foregroundColor(ADLColor.inkMuted)
            }
        }
    }

    // MARK: - Assignments card

    private var assignmentsCard: some View {
        ADLCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        SectionLabel(text: "Assignments")
                        Text("My Weekly Assignments")
                            .font(ADLFont.inter(15, .semibold))
                            .foregroundColor(ADLColor.ink)
                    }
                    Spacer()
                    Text("0")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.navy)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(ADLColor.navyLight)
                        .clipShape(Capsule())
                }
                Text("No active assignments yet.")
                    .font(ADLFont.inter(12))
                    .foregroundColor(ADLColor.inkMuted)
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
                    Text("Redeem XP")
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
                    Text("Convert to Rewards")
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
                    SectionLabel(text: "Weekly Target")
                    Spacer()
                    Text("\(pointsThisWeek)/\(weeklyTarget)")
                        .font(ADLFont.inter(12, .bold))
                        .foregroundColor(ADLColor.ink)
                }
                ADLProgressBar(value: progress, tint: ADLColor.navy, height: 12)
                Text(pointsThisWeek >= weeklyTarget
                     ? "Target reached! +20 XP bonus earned."
                     : "Complete 50 this week for a 20 XP bonus!")
                    .font(ADLFont.inter(11))
                    .foregroundColor(ADLColor.inkMuted)
            }
        }
    }

    // MARK: - Badges section

    private var badgesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionLabel(text: "Badges", wide: true)
                Spacer()
                Text("\(appState.badges.filter(\.unlocked).count)/\(appState.badges.count) earned")
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
            SectionLabel(text: "This week", wide: true)
            ProfileWeekSummaryCard(rows: [
                ("Submitted", "\(pointsThisWeek)"),
                ("Verified", "\(appState.queueSnapshot.synced)"),
                ("XP earned", "\(xpCurrent.formatted()) XP"),
                ("Best day", pointsThisWeek > 0 ? "Today" : "No activity yet")
            ])
        }
    }

    // MARK: - Contribution history

    private var contributionHistorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionLabel(text: "Contribution History")
                Spacer()
            }

            if appState.drafts.isEmpty {
                ADLCard {
                    Text("No contributions yet. Add your first report to build your history.")
                        .font(ADLFont.inter(12))
                        .foregroundColor(ADLColor.inkMuted)
                }
            } else {
                VStack(spacing: 12) {
                    ForEach(appState.drafts.prefix(5)) { draft in
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
                SectionLabel(text: "Upload Issues")
                Spacer()
                if !failedDrafts.isEmpty {
                    Label("Clear", systemImage: "trash")
                        .font(ADLFont.inter(11, .bold))
                        .foregroundColor(ADLColor.terracotta)
                }
            }

            if failedDrafts.isEmpty {
                ADLCard {
                    Text("All clear! No upload issues.")
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


struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @AppStorage("adl_language") private var language = "fr"
    @AppStorage("adl_high_contrast") private var highContrast = false
    @AppStorage("adl_sms_notifications") private var smsNotifications = false

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: text("Settings", "Paramètres"), onBack: { dismiss() })

            ScrollView {
                VStack(spacing: 24) {
                    if appState.selectedRole == .client {
                        clientIdentityCard
                    }

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
    }

    private func text(_ en: String, _ fr: String) -> String {
        language == "fr" ? fr : en
    }

    private var clientIdentityCard: some View {
        HStack(spacing: 14) {
            IdentityCircle(name: "Client", size: 52)
            VStack(alignment: .leading, spacing: 4) {
                Text(text("Your Organization", "Votre organisation"))
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

    private var languageSection: some View {
        SettingsSection(title: text("Language", "Langue")) {
            VStack(spacing: 0) {
                SettingsChoiceRow(title: "English", isSelected: language == "en") {
                    language = "en"
                }
                Divider().background(ADLColor.line)
                SettingsChoiceRow(title: "Français", isSelected: language == "fr") {
                    language = "fr"
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

enum SettingsLegalKind {
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
}

struct SettingsLegalView: View {
    let kind: SettingsLegalKind
    let language: String
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 0) {
            ADLScreenHeader(title: kind.title(language: language), onBack: { dismiss() })
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ADLCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(kind.title(language: language))
                                .font(ADLFont.inter(18, .bold))
                                .foregroundColor(ADLColor.ink)
                            Text(kind.body(language: language))
                                .font(ADLFont.inter(14, .regular))
                                .foregroundColor(Color(hex: 0x4b5563))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    Button {
                        openURL(contactURL)
                    } label: {
                        Label(contactLabel, systemImage: contactIcon)
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                .padding(16)
            }
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationBarBackButtonHidden(true)
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
                        .font(.caption.weight(.bold))
                        .foregroundColor(ADLColor.ink)
                }
                .frame(width: 52, height: 52)

                VStack(alignment: .leading, spacing: 3) {
                    Text("Today's goal")
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(ADLColor.ink)
                    Text(goal.completed >= goal.target
                         ? "Goal complete — nice work."
                         : "\(goal.target - goal.completed) more captures to go.")
                        .font(.footnote)
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
                Text("Level up!")
                    .font(.title2.weight(.bold))
                    .foregroundColor(ADLColor.ink)
                Text("You reached \(tier.title)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Button("Keep going") { onDismiss() }
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
