import MapKit
import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @State private var passedSplash = ProcessInfo.processInfo.environment["ADL_START_AUTH"] == "1"

    var body: some View {
        Group {
            if appState.isBootstrapping {
                BootSplashView()
            } else if appState.isAuthenticated {
                AppShellView()
            } else if !passedSplash {
                SplashView(onContinue: { passedSplash = true })
            } else {
                AuthView()
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

                    Button { onContinue() } label: {
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

    private enum Mode { case signin, signup }
    @State private var mode: Mode = .signin
    @State private var selectedRole: UserRole = .agent
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
        ZStack(alignment: .top) {
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

                    // Demo role access (gated) — preserves multi-role testing
                    if AppReleaseMode.allowsDemoAccess {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("DEMO ACCESS")
                                .font(ADLFont.inter(11, .bold))
                                .tracking(1.6)
                                .foregroundColor(ADLColor.inkMuted)
                            Picker("Role", selection: $selectedRole) {
                                ForEach(AppReleaseMode.demoRoles) { role in
                                    Text(role.title).tag(role)
                                }
                            }
                            .pickerStyle(.segmented)
                            Button {
                                appState.switchRole(selectedRole)
                                appState.signInDemo()
                            } label: {
                                Text("Enter Demo").font(ADLFont.inter(15, .semibold))
                            }
                            .buttonStyle(SecondaryButtonStyle())
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: ADLRadius.card, style: .continuous).stroke(ADLColor.line, lineWidth: 1))
                        .padding(.top, 28)
                    }
                }
                .frame(maxWidth: 440)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
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

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            ForEach(AppReleaseMode.tabs(for: appState.selectedRole)) { route in
                NavigationView {
                    screen(for: route)
                }
                .tabItem {
                    Label(tabTitle(for: route), systemImage: tabImage(for: route))
                }
                .tag(route)
            }
        }
        .onAppear {
            appState.enforceVisibleNavigation()
        }
        .onChange(of: appState.selectedRole) { _ in
            appState.enforceVisibleNavigation()
        }
        .onChange(of: appState.selectedTab) { _ in
            appState.enforceVisibleNavigation()
        }
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
        case .home:
            AgentHomeView()
        case .contribute:
            ContributionView()
        case .queue:
            SubmissionQueueView()
        case .rewards:
            RewardsView()
        case .profile:
            ProfileView()
        case .adminReview:
            AdminReviewView()
        case .agentPerformance:
            AgentPerformanceView()
        case .clientDashboard:
            ClientDashboardView()
        case .analytics:
            AnalyticsView()
        }
    }

    private func tabTitle(for route: AppRoute) -> String {
        switch route {
        case .home:
            return "Map"
        case .contribute:
            return "Capture"
        case .queue:
            return "Queue"
        case .rewards:
            return "Rewards"
        case .profile:
            return "Profile"
        case .adminReview:
            return "Review"
        case .agentPerformance:
            return "Agents"
        case .clientDashboard:
            return "Delta"
        case .analytics:
            return "Analytics"
        }
    }

    private func tabImage(for route: AppRoute) -> String {
        switch route {
        case .home:
            return "map.fill"
        case .contribute:
            return "camera.fill"
        case .queue:
            return "tray.full.fill"
        case .rewards:
            return "star.circle.fill"
        case .profile:
            return "person.crop.circle.fill"
        case .adminReview:
            return "checkmark.shield.fill"
        case .agentPerformance:
            return "chart.bar.fill"
        case .clientDashboard:
            return "chart.line.uptrend.xyaxis"
        case .analytics:
            return "waveform.path.ecg.rectangle.fill"
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

    private let collectionZone = [
        CLLocationCoordinate2D(latitude: 4.0933, longitude: 9.7342),
        CLLocationCoordinate2D(latitude: 4.0938, longitude: 9.7454),
        CLLocationCoordinate2D(latitude: 4.0858, longitude: 9.7472),
        CLLocationCoordinate2D(latitude: 4.0829, longitude: 9.7371)
    ]

    var body: some View {
        ZStack(alignment: .top) {
            FieldMapKitView(
                points: appState.points,
                collectionZone: collectionZone,
                region: $region,
                trackingMode: $trackingMode,
                selectedPoint: $selectedPoint
            )
            .ignoresSafeArea(edges: .bottom)
            .accessibilityLabel("Apple Maps field map")

            VStack(spacing: 12) {
                FieldMapHeader(
                    pointCount: appState.points.count,
                    refreshCount: appState.points.filter(\.requiresRefresh).count,
                    locationStatus: locationProvider.statusText
                )

                DailyProgressWidget(goal: appState.dailyGoal)

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
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Field Map")
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
        mapView.pointOfInterestFilter = .includingAll
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
        let polygon = MKPolygon(coordinates: collectionZone, count: collectionZone.count)
        mapView.addOverlay(polygon, level: .aboveRoads)
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

            let identifier = "field-point-\(pointAnnotation.point.category.rawValue)"
            let markerView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? MKMarkerAnnotationView
                ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            markerView.annotation = annotation
            markerView.canShowCallout = false
            markerView.markerTintColor = UIColor(pointAnnotation.point.category.tint)
            markerView.glyphImage = UIImage(systemName: pointAnnotation.point.category.systemImage)
            markerView.glyphTintColor = .white
            markerView.displayPriority = pointAnnotation.point.requiresRefresh ? .required : .defaultHigh
            return markerView
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
    let onCapture: () -> Void
    let onCenter: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 16) {
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

                Button {
                    dismiss()
                    onCapture()
                } label: {
                    Label(point.requiresRefresh ? "Capture Refresh" : "Enrich Point", systemImage: "camera.fill")
                }
                .buttonStyle(PrimaryButtonStyle())

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
        ScrollView {
            ADLCard {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Weekly capture trend")
                        .font(.title3.weight(.bold))

                    if appState.weeklyTrend.isEmpty {
                        AnalyticsStatusNote()
                        Text("No weekly activity yet.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    } else {
                        let maxValue = max(appState.weeklyTrend.map(\.totalEvents).max() ?? 1, 1)
                        HStack(alignment: .bottom, spacing: 10) {
                            ForEach(appState.weeklyTrend) { bar in
                                VStack(spacing: 6) {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(ADLColor.forest)
                                        .frame(height: CGFloat(bar.totalEvents) / CGFloat(maxValue) * 150 + 4)
                                    Text(bar.totalEvents.description)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .frame(height: 190, alignment: .bottom)
                    }
                }
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Analytics")
        .task { await appState.loadAnalytics() }
        .refreshable { await appState.loadAnalytics(force: true) }
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
        ScrollView {
            VStack(spacing: 18) {
                VStack(spacing: 10) {
                    IdentityCircle(name: appState.profile.name, size: 78)
                    Text(appState.profile.name)
                        .font(.title2.weight(.bold))
                        .foregroundColor(ADLColor.ink)
                    Text(appState.profile.role.title)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    HStack(spacing: 8) {
                        StatusPill(title: appState.tierProgress.current.title, tint: ADLColor.gold)
                        StatusPill(title: appState.profile.trustTier.capitalized, tint: ADLColor.forest)
                    }
                }
                .padding(.top, 8)

                ADLCard {
                    let tier = appState.tierProgress
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(tier.current.title)
                                .font(.subheadline.weight(.bold))
                                .foregroundColor(ADLColor.ink)
                            Spacer()
                            if let next = tier.next {
                                Text(next.title)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(.secondary)
                            }
                        }
                        ADLProgressBar(value: tier.fraction, tint: ADLColor.gold)
                        Text(tier.next != nil ? "\(tier.xpToNext) XP to \(tier.next!.title)" : "Top tier reached")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                HStack(spacing: 12) {
                    StatTile(value: "\(appState.serverXP)", label: "XP", tint: ADLColor.navy)
                    StatTile(value: "\(appState.profile.streakDays)", label: "Day streak", tint: ADLColor.terracotta)
                }
                HStack(spacing: 12) {
                    StatTile(value: "\(appState.badges.filter(\.unlocked).count)", label: "Badges", tint: ADLColor.gold)
                    StatTile(value: "\(appState.queueSnapshot.synced)", label: "Synced", tint: ADLColor.forest)
                }

                VStack(spacing: 10) {
                    NavigationLink { RewardsView() } label: {
                        ProfileRow(title: "Rewards wallet", systemImage: "gift.fill", trailing: "\(appState.spendableXP) XP")
                    }
                    NavigationLink { BadgesView() } label: {
                        ProfileRow(title: "Badges", systemImage: "rosette", trailing: "\(appState.badges.filter(\.unlocked).count)/\(appState.badges.count)")
                    }
                    NavigationLink { MissionsView() } label: {
                        ProfileRow(title: "Missions", systemImage: "target", trailing: nil)
                    }
                }

                if AppReleaseMode.allowsRoleSwitching {
                    ADLCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Demo role")
                                .font(.caption.weight(.bold))
                                .foregroundColor(.secondary)
                            Picker("Role", selection: Binding(
                                get: { appState.selectedRole },
                                set: { appState.switchRole($0) }
                            )) {
                                ForEach(AppReleaseMode.demoRoles) { role in
                                    Text(role.title).tag(role)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                    }
                }

                Button {
                    appState.signOut()
                } label: {
                    Text("Sign Out")
                        .foregroundColor(ADLColor.terracotta)
                }
                .buttonStyle(SecondaryButtonStyle())
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Profile")
        .task { await appState.loadProfile() }
        .refreshable { await appState.loadProfile(force: true) }
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
