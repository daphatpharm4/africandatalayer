import SwiftUI
#if canImport(UIKit)
import UIKit
#endif
import UserNotifications
import ConsoleAPI
import ConsoleModels

/// Top-level switch: bootstrapping → loading; unauthenticated → `AuthView`;
/// authenticated → `ConsoleShellView`. Mirrors the role `ConsoleApp.tsx`
/// plays on the web (its `sessionState === 'loading'` / unauthenticated /
/// authenticated branches).
struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("notificationsEnabled") private var notificationsEnabled: Bool = false
    @AppStorage("hasCompletedADLOnboarding") private var hasCompletedOnboarding: Bool = false
    @AppStorage("shouldReplayADLOnboardingSplash") private var shouldReplayOnboardingSplash: Bool = false
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var isRestoringSession = false
    @State private var showingSettings = false
    @State private var isShowingOnboardingSplash = false
    @State private var hasShownOnboardingSplashThisSession = false

    #if os(macOS)
    private struct LocalAlert: Identifiable {
        let id = UUID()
        let title: String
        let message: String
    }
    @State private var pendingAlert: LocalAlert?
    #endif

    private func requestNotificationAuthorizationIfNeeded() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            if settings.authorizationStatus == .notDetermined {
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
            }
        }
    }

    private func scheduleLocalNotificationIfBackground(title: String, body: String) {
        guard notificationsEnabled, scenePhase != .active else { return }
        #if os(iOS)
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        let request = UNNotificationRequest(identifier: "orgs.\(UUID().uuidString)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
        #elseif os(macOS)
        pendingAlert = LocalAlert(title: title, message: body)
        #else
        // Other platforms: no-op
        #endif
    }

    private func restoreSessionIfNeeded() async {
        if isRestoringSession { return }
        if appState.isAuthenticated { return }
        isRestoringSession = true
        defer { isRestoringSession = false }
        await appState.tryRestoreSession()
    }

    private var shouldShowLaunchSplash: Bool {
        guard hasCompletedOnboarding else { return false }
        return appState.sessionState == .unknown || appState.sessionState == .restoring
    }

    var body: some View {
        Group {
            if shouldShowLaunchSplash || isShowingOnboardingSplash {
                ADLOnboardingSplashView()
            } else if !hasCompletedOnboarding {
                ADLOnboardingView {
                    withAnimation(.easeOut(duration: 0.22)) {
                        hasCompletedOnboarding = true
                    }
                }
            } else if !appState.isAuthenticated {
                AuthView()
            } else {
                switch appState.organizationsLoadState {
                case .idle, .loading:
                    LoadingView()
                case .failed(let message):
                    OrganizationsErrorView(message: message)
                case .loaded:
                    ConsoleShellView()
                }
            }
        }
        .animation(.default, value: appState.isAuthenticated)
        .animation(.default, value: appState.organizationsLoadState)
        .task { await showFirstRunSplashIfNeeded() }
        .task { appState.startRuntime() }
        .task { await restoreSessionIfNeeded() }
        .task { if notificationsEnabled { requestNotificationAuthorizationIfNeeded() } }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task { await appState.handleForeground() }
            }
        }
        .onChange(of: notificationsEnabled) { _, isOn in
            if isOn { requestNotificationAuthorizationIfNeeded() }
        }
        .onChange(of: appState.organizationsLoadState) { oldState, newState in
            switch newState {
            case .loaded:
                // Accessibility announcement
                UIAccessibility.post(notification: .announcement, argument: appState.language.t("Workspace loaded", "Espace de travail chargé"))
                // Local notification if not active
                let title = appState.language.t("Workspace ready", "Espace de travail prêt")
                let body = appState.language.t("Your workspace has loaded successfully.", "Votre espace de travail a été chargé avec succès.")
                scheduleLocalNotificationIfBackground(title: title, body: body)
            case .failed:
                // Accessibility announcement
                UIAccessibility.post(notification: .announcement, argument: appState.language.t("Failed to load workspace", "Échec du chargement de l’espace de travail"))
                // Local notification if not active
                let title = appState.language.t("Workspace failed to load", "Échec du chargement de l’espace de travail")
                let body = appState.language.t("Please open the app to try again.", "Veuillez ouvrir l’app pour réessayer.")
                scheduleLocalNotificationIfBackground(title: title, body: body)
            case .loading:
                if case .failed = oldState {
                    // Accessibility announcement for retry
                    UIAccessibility.post(notification: .announcement, argument: appState.language.t("Retrying to load workspace", "Nouvelle tentative de chargement de l’espace de travail"))
                    // Local notification if not active
                    let title = appState.language.t("Retrying to load workspace", "Nouvelle tentative de chargement de l’espace de travail")
                    let body = appState.language.t("Attempting to load your workspace again.", "Tentative de nouveau chargement de votre espace de travail.")
                    scheduleLocalNotificationIfBackground(title: title, body: body)
                } else if case .idle = oldState {
                    // Accessibility announcement for initial loading
                    UIAccessibility.post(notification: .announcement, argument: appState.language.t("Loading workspace", "Chargement de l’espace de travail"))
                }
            default:
                break
            }
        }
        #if os(iOS)
        .fullScreenCover(isPresented: $showingSettings) {
            SettingsSplitViewContainer()
        }
        #endif
        
        #if os(macOS)
        .overlay {
            if showingSettings {
                ZStack {
                    Color.black.opacity(0.2).ignoresSafeArea()
                    NavigationSplitView {
                        List(selection: .constant("general")) {
                            Label(NSLocalizedString("General", comment: "Général"), systemImage: "gearshape").tag("general")
                        }
                        .navigationTitle(NSLocalizedString("Settings", comment: "Réglages"))
                    } detail: {
                        AppSettingsView()
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .overlay(alignment: .topTrailing) {
                        Button {
                            showingSettings = false
                        } label: {
                            Image(systemName: "xmark.circle.fill").imageScale(.large)
                        }
                        .buttonStyle(.plain)
                        .padding()
                    }
                }
            }
        }
        #endif
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel(appState.language.t("Settings", "Réglages"))
                .accessibilityHint(appState.language.t("Open settings", "Ouvrir les réglages"))
            }
        }
        #if os(macOS)
        .alert(pendingAlert?.title ?? "", isPresented: Binding(get: { pendingAlert != nil }, set: { if !$0 { pendingAlert = nil } })) {
            Button(appState.language.t("OK", "OK")) { pendingAlert = nil }
        } message: {
            Text(pendingAlert?.message ?? "")
        }
        #endif
    }

    private func showFirstRunSplashIfNeeded() async {
        guard !hasCompletedOnboarding, !isShowingOnboardingSplash else { return }
        guard shouldReplayOnboardingSplash || !hasShownOnboardingSplashThisSession else { return }
        shouldReplayOnboardingSplash = false
        hasShownOnboardingSplashThisSession = true
        isShowingOnboardingSplash = true
        try? await Task.sleep(nanoseconds: 950_000_000)
        withAnimation(.easeOut(duration: 0.24)) {
            isShowingOnboardingSplash = false
        }
    }
}

private struct LoadingView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .accessibilityLabel(appState.language.t("Loading your workspace…", "Chargement de votre espace de travail…"))
            Text(appState.language.t("Loading your workspace…", "Chargement de votre espace de travail…"))
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ADLConsoleColor.page)
    }
}

private struct OrganizationsErrorView: View {
    @EnvironmentObject private var appState: AppState
    let message: String

    private var isLoading: Bool {
        if case .loading = appState.organizationsLoadState { return true }
        return false
    }

    var body: some View {
        VStack(spacing: 16) {
            Text(appState.language.t("Could not load your organizations.", "Impossible de charger vos organisations."))
                .font(ADLConsoleFont.headline)
                .foregroundStyle(ADLConsoleColor.ink)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .font(ADLConsoleFont.footnote)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .multilineTextAlignment(.center)

            ADLConsolePrimaryButton(title: appState.language.t(isLoading ? "Retrying…" : "Retry", isLoading ? "Nouvelle tentative…" : "Réessayer")) {
                Task { await appState.loadOrganizations() }
            }
            .disabled(isLoading)
            .accessibilityLabel(appState.language.t(isLoading ? "Retrying loading organizations" : "Retry loading organizations", isLoading ? "Nouvelle tentative de chargement des organisations" : "Réessayer le chargement des organisations"))
            .accessibilityHint(appState.language.t(isLoading ? "Currently attempting to load your organizations" : "Attempts to load your organizations again", isLoading ? "Tentative en cours de chargement de vos organisations" : "Tente de charger vos organisations à nouveau"))
            .frame(maxWidth: 220)
            .overlay(alignment: .leading) {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                        .padding(.leading, 12)
                        .accessibilityHidden(true)
                }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ADLConsoleColor.page)
    }
}

private struct SettingsSplitViewContainer: View {
    var body: some View {
        NavigationSplitView {
            List(selection: .constant("general")) {
                Label(NSLocalizedString("General", comment: "Général"), systemImage: "gearshape").tag("general")
            }
            .navigationTitle(NSLocalizedString("Settings", comment: "Réglages"))
        } detail: {
            AppSettingsView()
        }
    }
}

private struct ADLOnboardingView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let onComplete: () -> Void

    @State private var selectedPage = 0
    @State private var contentVisible = false

    private var t: (String, String) -> String { appState.language.t }

    private var pages: [ADLOnboardingPage] {
        [
            ADLOnboardingPage(
                eyebrow: t("COMMAND CENTER", "CENTRE DE COMMANDE"),
                title: t("The pulse of Africa's built environment.", "Le pouls des infrastructures africaines."),
                body: t("Monitor field activity, coverage, and review status from one operational workspace.", "Suivez l'activité terrain, la couverture et les validations depuis un espace opérationnel."),
                visual: .commandCenter,
                chips: [t("Real-time oversight", "Supervision en temps réel"), t("Verified submissions", "Soumissions vérifiées")]
            ),
            ADLOnboardingPage(
                eyebrow: t("METHODOLOGY", "MÉTHODOLOGIE"),
                title: t("Structured for scale.", "Structuré pour passer à l'échelle."),
                body: t("Turn raw field captures into clean, trusted infrastructure records your team can act on.", "Transformez les captures terrain en données d'infrastructure fiables et exploitables."),
                visual: .structuredMap,
                chips: [t("Before: fragmented", "Avant : fragmenté"), t("After: verified", "Après : vérifié")]
            ),
            ADLOnboardingPage(
                eyebrow: t("DATA ADVANTAGE", "AVANTAGE DATA"),
                title: t("Data that drives action.", "Des données qui déclenchent l'action."),
                body: t("Prioritize the next capture, see progress clearly, and keep contributors moving.", "Priorisez la prochaine capture, visualisez les progrès et gardez les contributeurs en mouvement."),
                visual: .metrics,
                chips: [t("1.2M+ points verified", "1,2 M+ points vérifiés"), t("54 countries covered", "54 pays couverts")]
            ),
            ADLOnboardingPage(
                eyebrow: t("TRUST LAYER", "COUCHE DE CONFIANCE"),
                title: t("Built for trusted operations.", "Conçu pour des opérations fiables."),
                body: t("Security, provenance, and review workflows protect the quality of every infrastructure record.", "La sécurité, la traçabilité et les revues protègent la qualité de chaque donnée d'infrastructure."),
                visual: .trust,
                chips: [t("ISO 27001 aligned", "Aligné ISO 27001"), t("Review-ready evidence", "Preuves prêtes à revoir")]
            )
        ]
    }

    private var isLastPage: Bool {
        selectedPage == pages.count - 1
    }

    var body: some View {
        GeometryReader { proxy in
            let isWide = proxy.size.width >= 700
            ZStack {
                ADLOnboardingBackground()

                VStack(spacing: 0) {
                    topBar

                    TabView(selection: $selectedPage) {
                        ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                            ADLOnboardingPageView(page: page, isWide: isWide, isVisible: contentVisible && selectedPage == index)
                                .tag(index)
                                .padding(.horizontal, isWide ? 48 : 24)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))

                    footer
                        .padding(.horizontal, isWide ? 48 : 24)
                        .padding(.bottom, 20)
                }
            }
        }
        .onAppear { revealContent() }
        .onChange(of: selectedPage) { _, _ in revealContent() }
    }

    private var topBar: some View {
        HStack {
            HStack(spacing: 10) {
                ADLLogoMark(size: 44, showsBackground: true)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .adlShadowBorder()
                VStack(alignment: .leading, spacing: 1) {
                    ADLConsoleMicroLabel(text: "AFRICAN DATA LAYER", color: ADLConsoleColor.inkMuted)
                    Text("ADL Console")
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                }
            }

            Spacer()

            Button(t("Skip", "Ignorer")) {
                onComplete()
            }
            .font(ADLConsoleFont.subheadline)
            .foregroundStyle(ADLConsoleColor.navy)
            .frame(minWidth: 44, minHeight: 44)
            .accessibilityHint(t("Go directly to sign in", "Aller directement à la connexion"))
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
    }

    private var footer: some View {
        VStack(spacing: 16) {
            ADLOnboardingPageIndicator(count: pages.count, selectedIndex: selectedPage)

            ADLConsolePrimaryButton(
                title: isLastPage ? t("Get started", "Commencer") : t("Continue", "Continuer"),
                systemImage: isLastPage ? "arrow.right.circle.fill" : "arrow.right"
            ) {
                if isLastPage {
                    onComplete()
                } else {
                    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.24)) {
                        selectedPage += 1
                    }
                }
            }
            .accessibilityHint(isLastPage ? t("Finish onboarding", "Terminer l'accueil") : t("Show the next onboarding screen", "Afficher l'écran d'accueil suivant"))
        }
    }

    private func revealContent() {
        contentVisible = false
        if reduceMotion {
            contentVisible = true
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            withAnimation(.easeOut(duration: 0.28)) {
                contentVisible = true
            }
        }
    }
}

private struct ADLOnboardingSplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @EnvironmentObject private var appState: AppState

    @State private var markVisible = false
    @State private var goldLineExpanded = false

    private var t: (String, String) -> String { appState.language.t }

    var body: some View {
        ZStack {
            ADLConsoleColor.navyDark.ignoresSafeArea()

            VStack(spacing: 22) {
                Spacer()

                ZStack {
                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [ADLConsoleColor.navyMid, ADLConsoleColor.navy],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 146, height: 146)
                        .shadow(color: Color.black.opacity(0.18), radius: 18, x: 0, y: 12)

                    ADLLogoMark(size: 106)
                        .accessibilityHidden(true)
                }
                .scaleEffect(markVisible ? 1 : 0.92)
                .opacity(markVisible ? 1 : 0)

                VStack(spacing: 12) {
                    Text("ADL Console")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(.white)

                    Capsule()
                        .fill(ADLConsoleColor.gold)
                        .frame(width: goldLineExpanded ? 48 : 14, height: 5)
                }
                .opacity(markVisible ? 1 : 0)

                Spacer()

                ADLConsoleMicroLabel(text: t("AFRICAN DATA LAYER", "AFRICAN DATA LAYER"), color: Color.white.opacity(0.52))
                    .padding(.bottom, 40)
            }
            .padding(32)
        }
        .onAppear {
            guard !reduceMotion else {
                markVisible = true
                goldLineExpanded = true
                return
            }

            withAnimation(.easeOut(duration: 0.32)) {
                markVisible = true
            }
            withAnimation(.easeOut(duration: 0.36).delay(0.18)) {
                goldLineExpanded = true
            }
        }
    }
}

private struct ADLOnboardingPage {
    enum Visual {
        case commandCenter
        case structuredMap
        case metrics
        case trust
    }

    let eyebrow: String
    let title: String
    let body: String
    let visual: Visual
    let chips: [String]
}

private struct ADLOnboardingPageView: View {
    let page: ADLOnboardingPage
    let isWide: Bool
    let isVisible: Bool

    var body: some View {
        Group {
            if isWide {
                HStack(alignment: .center, spacing: 36) {
                    copy
                        .frame(maxWidth: 430, alignment: .leading)
                    visual
                        .frame(maxWidth: 430)
                }
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 28) {
                        copy
                        visual
                    }
                    .padding(.vertical, 28)
                }
            }
        }
        .opacity(isVisible ? 1 : 0)
        .offset(y: isVisible ? 0 : 12)
    }

    private var copy: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 12) {
                Capsule()
                    .fill(ADLConsoleColor.navy)
                    .frame(width: 48, height: 5)

                ADLConsoleMicroLabel(text: page.eyebrow, color: ADLConsoleColor.terra)

                Text(page.title)
                    .font(.system(size: isWide ? 42 : 38, weight: .bold))
                    .lineSpacing(2)
                    .foregroundStyle(ADLConsoleColor.ink)
                    .minimumScaleFactor(0.82)
                    .accessibilityAddTraits(.isHeader)
            }

            Text(page.body)
                .font(.system(size: 17, weight: .regular))
                .lineSpacing(5)
                .foregroundStyle(ADLConsoleColor.ink)
                .fixedSize(horizontal: false, vertical: true)

            FlowChips(chips: page.chips)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var visual: some View {
        switch page.visual {
        case .commandCenter:
            CommandCenterVisual()
        case .structuredMap:
            StructuredMapVisual()
        case .metrics:
            MetricsVisual()
        case .trust:
            TrustVisual()
        }
    }
}

private struct FlowChips: View {
    let chips: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(chips, id: \.self) { chip in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(ADLConsoleColor.forestDark)
                    Text(chip)
                        .font(ADLConsoleFont.subheadline)
                        .foregroundStyle(ADLConsoleColor.ink)
                }
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .background(ADLConsoleColor.surface)
                .clipShape(Capsule())
                .adlShadowBorder()
            }
        }
    }
}

private struct CommandCenterVisual: View {
    var body: some View {
        ADLConsoleHeroCard {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(ADLConsoleColor.gold)
                        .frame(width: 8, height: 8)
                    ADLConsoleMicroLabel(text: "REAL-TIME OVERSIGHT", color: ADLConsoleColor.gold)
                }

                Text("ADL Console")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(.white)

                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.white.opacity(0.08))
                        .adlImageOutline(cornerRadius: 16)

                    VStack(spacing: 14) {
                        HStack(spacing: 12) {
                            MiniPanel(color: ADLConsoleColor.terra, icon: "map.fill")
                            MiniPanel(color: ADLConsoleColor.gold, icon: "chart.line.uptrend.xyaxis")
                        }
                        HStack(spacing: 12) {
                            MiniPanel(color: ADLConsoleColor.forest, icon: "checkmark.seal.fill")
                            MiniPanel(color: Color.white.opacity(0.85), icon: "antenna.radiowaves.left.and.right")
                        }
                    }
                    .padding(22)
                }
                .frame(height: 230)
            }
        }
    }
}

private struct MiniPanel: View {
    let color: Color
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(color)
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(Color.white.opacity(0.42))
                .frame(height: 8)
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(Color.white.opacity(0.22))
                .frame(width: 70, height: 8)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
        .background(Color.white.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct StructuredMapVisual: View {
    var body: some View {
        ADLConsoleCard(padding: 18) {
            VStack(spacing: 18) {
                AfricaNetworkIllustration()
                    .frame(height: 260)

                HStack {
                    VStack(spacing: 6) {
                        ADLConsoleMicroLabel(text: "BEFORE", color: ADLConsoleColor.ink)
                        Text("Fragmented")
                            .font(ADLConsoleFont.title)
                            .foregroundStyle(ADLConsoleColor.terra)
                    }
                    Spacer()
                    VStack(spacing: 6) {
                        ADLConsoleMicroLabel(text: "AFTER", color: ADLConsoleColor.ink)
                        Text("Verified")
                            .font(ADLConsoleFont.title)
                            .foregroundStyle(ADLConsoleColor.forestDark)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }
}

private struct AfricaNetworkIllustration: View {
    private let points: [CGPoint] = [
        CGPoint(x: 0.48, y: 0.13), CGPoint(x: 0.62, y: 0.23),
        CGPoint(x: 0.53, y: 0.35), CGPoint(x: 0.68, y: 0.43),
        CGPoint(x: 0.59, y: 0.56), CGPoint(x: 0.72, y: 0.66),
        CGPoint(x: 0.50, y: 0.73), CGPoint(x: 0.58, y: 0.86),
        CGPoint(x: 0.42, y: 0.48), CGPoint(x: 0.36, y: 0.62)
    ]

    var body: some View {
        Canvas { context, size in
            let rect = CGRect(origin: .zero, size: size)
            let mapPath = africaPath(in: rect.insetBy(dx: size.width * 0.18, dy: size.height * 0.06))

            context.fill(mapPath, with: .color(ADLConsoleColor.forestWash))
            context.stroke(mapPath, with: .color(ADLConsoleColor.navy.opacity(0.55)), lineWidth: 2)

            for index in points.indices.dropLast() {
                let start = point(points[index], in: rect)
                let end = point(points[index + 1], in: rect)
                var path = Path()
                path.move(to: start)
                path.addLine(to: end)
                context.stroke(path, with: .color(ADLConsoleColor.navy.opacity(0.35)), lineWidth: 1.4)
            }

            for point in points {
                let center = self.point(point, in: rect)
                context.fill(Path(ellipseIn: CGRect(x: center.x - 5, y: center.y - 5, width: 10, height: 10)), with: .color(ADLConsoleColor.forestDark))
                context.stroke(Path(ellipseIn: CGRect(x: center.x - 10, y: center.y - 10, width: 20, height: 20)), with: .color(ADLConsoleColor.navy.opacity(0.18)), lineWidth: 1)
            }

            let splitX = size.width * 0.43
            var split = Path()
            split.move(to: CGPoint(x: splitX, y: 18))
            split.addLine(to: CGPoint(x: splitX, y: size.height - 18))
            context.stroke(split, with: .color(ADLConsoleColor.gold.opacity(0.65)), style: StrokeStyle(lineWidth: 2, dash: [5, 6]))
        }
        .background(ADLConsoleColor.navyWash)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .adlImageOutline(cornerRadius: 12)
    }

    private func point(_ point: CGPoint, in rect: CGRect) -> CGPoint {
        CGPoint(x: rect.width * point.x, y: rect.height * point.y)
    }

    private func africaPath(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.midX - rect.width * 0.08, y: rect.minY))
            path.addCurve(to: CGPoint(x: rect.maxX - rect.width * 0.1, y: rect.minY + rect.height * 0.22), control1: CGPoint(x: rect.maxX - rect.width * 0.18, y: rect.minY + rect.height * 0.02), control2: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.08))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.42))
            path.addCurve(to: CGPoint(x: rect.maxX - rect.width * 0.20, y: rect.midY), control1: CGPoint(x: rect.maxX - rect.width * 0.02, y: rect.minY + rect.height * 0.5), control2: CGPoint(x: rect.maxX - rect.width * 0.12, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.maxX - rect.width * 0.34, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.midX - rect.width * 0.10, y: rect.maxY - rect.height * 0.18))
            path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.18, y: rect.maxY - rect.height * 0.28))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.midY + rect.height * 0.04))
            path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.18, y: rect.minY + rect.height * 0.22))
            path.addLine(to: CGPoint(x: rect.midX - rect.width * 0.08, y: rect.minY))
            path.closeSubpath()
        }
    }
}

private struct MetricsVisual: View {
    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 16) {
                MetricTile(value: "1.2M+", label: "POINTS VERIFIED", color: ADLConsoleColor.gold, icon: "target")
                MetricTile(value: "99.8%", label: "ACCURACY", color: ADLConsoleColor.forestDark, icon: "checkmark.circle")
            }

            ADLConsoleCard(padding: 20) {
                HStack {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("54")
                            .font(.system(size: 34, weight: .bold))
                            .foregroundStyle(ADLConsoleColor.navy)
                            .monospacedDigit()
                        ADLConsoleMicroLabel(text: "COUNTRIES COVERED", color: ADLConsoleColor.ink)
                    }
                    Spacer()
                    HStack(spacing: -8) {
                        ForEach(0..<3) { index in
                            Circle()
                                .fill(index == 2 ? ADLConsoleColor.ink.opacity(0.18) : ADLConsoleColor.ink.opacity(0.10))
                                .frame(width: 42, height: 42)
                                .overlay {
                                    if index == 2 {
                                        Text("+51")
                                            .font(ADLConsoleFont.caption)
                                            .fontWeight(.bold)
                                            .foregroundStyle(ADLConsoleColor.ink)
                                            .monospacedDigit()
                                    }
                                }
                        }
                    }
                }
            }
        }
    }
}

private struct MetricTile: View {
    let value: String
    let label: String
    let color: Color
    let icon: String

    var body: some View {
        ADLConsoleCard(padding: 18) {
            VStack(alignment: .leading, spacing: 16) {
                ZStack {
                    Circle()
                        .stroke(color.opacity(0.24), lineWidth: 7)
                    Circle()
                        .trim(from: 0, to: 0.78)
                        .stroke(color, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Image(systemName: icon)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(ADLConsoleColor.ink)
                }
                .frame(width: 58, height: 58)

                Text(value)
                    .font(.system(size: 31, weight: .bold))
                    .foregroundStyle(ADLConsoleColor.navy)
                    .monospacedDigit()
                    .minimumScaleFactor(0.75)
                    .lineLimit(1)

                ADLConsoleMicroLabel(text: label, color: ADLConsoleColor.ink)
            }
        }
    }
}

private struct TrustVisual: View {
    var body: some View {
        VStack(spacing: 16) {
            TrustRow(icon: "shield.checkered", title: "ISO 27001 aligned", subtitle: "Security and access controls for infrastructure data")
            TrustRow(icon: "globe.europe.africa.fill", title: "Partner-ready protocols", subtitle: "Clear provenance for teams, reviewers, and clients")
            TrustRow(icon: "camera.metering.center.weighted", title: "Evidence-first review", subtitle: "Photos, GPS, and schema fields stay linked to the record")
        }
    }
}

private struct TrustRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        ADLConsoleCard(padding: 18) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(ADLConsoleColor.navy)
                    .frame(width: 44, height: 44)
                    .background(ADLConsoleColor.navyWash)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(ADLConsoleFont.headline)
                        .foregroundStyle(ADLConsoleColor.ink)
                    Text(subtitle)
                        .font(ADLConsoleFont.footnote)
                        .foregroundStyle(ADLConsoleColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

private struct ADLOnboardingPageIndicator: View {
    let count: Int
    let selectedIndex: Int

    var body: some View {
        HStack(spacing: 7) {
            ForEach(0..<count, id: \.self) { index in
                Capsule()
                    .fill(index == selectedIndex ? ADLConsoleColor.navy : ADLConsoleColor.navyBorder)
                    .frame(width: index == selectedIndex ? 26 : 8, height: 8)
                    .animation(.easeOut(duration: 0.2), value: selectedIndex)
            }
        }
        .accessibilityLabel("Onboarding page \(selectedIndex + 1) of \(count)")
    }
}

private struct ADLOnboardingBackground: View {
    var body: some View {
        LinearGradient(
            colors: [ADLConsoleColor.page, ADLConsoleColor.navyWash],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }
}

#if DEBUG

private final class PreviewAuthService: AuthServiceProtocol {
    func signIn(email: String, password: String) async throws {}
}

/// Minimal transport that returns empty, well-formed responses for previews
private final class PreviewPlatformTransport: PlatformTransport, @unchecked Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let data = Data("{}".utf8)
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["content-type": "application/json"])!
        return (data, response)
    }
}

@MainActor
private func makePreviewAppState(loadState: AppState.LoadState = .idle) -> AppState {
    let api = PlatformAPIClient(baseURL: URL(string: "https://example.com")!, transport: PreviewPlatformTransport())
    let app = AppState(apiClient: api, authService: PreviewAuthService())
    app.seedPreviewOrganizationsLoadState(loadState)
    return app
}

#Preview("Unauthenticated") {
    RootView()
        .environmentObject(makePreviewAppState())
}

#Preview("Loading") {
    RootView()
        .environmentObject(makePreviewAppState(loadState: .loading))
}

#Preview("Failed") {
    RootView()
        .environmentObject(makePreviewAppState(loadState: .failed("Network timeout. Please try again.")))
}

#Preview("Loaded") {
    RootView()
        .environmentObject(makePreviewAppState(loadState: .loaded))
}
#endif
