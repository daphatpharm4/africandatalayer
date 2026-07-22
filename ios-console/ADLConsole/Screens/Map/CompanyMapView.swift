import ConsoleForms
import ConsoleModels
import CoreLocation
import MapKit
import SwiftUI

struct CompanyMapView: View {
    private enum DisplayMode: String, CaseIterable {
        case map
        case list
    }

    @EnvironmentObject private var appState: AppState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var viewModel: CompanyMapViewModel

    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 4.0887, longitude: 9.7403),
        span: MKCoordinateSpan(latitudeDelta: 0.018, longitudeDelta: 0.018)
    )
    @State private var isCapturePresented = false
    @State private var captureAttachPointId: String?
    @State private var cameraFocused = false
    @State private var displayMode: DisplayMode = .map

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> CompanyMapViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ZStack {
            if displayMode == .map {
                mapLayer
                overlayLayer
            } else {
                listLayer
            }
            captureButton
        }
        .background(ADLConsoleColor.page)
        .task { await viewModel.load() }
        .sheet(item: $viewModel.selectedPoint) { collapsedPoint in
            CompanyPointDetailView(
                collapsedPoint: collapsedPoint,
                language: appState.language,
                onUpdate: { beginUpdate(for: collapsedPoint) }
            )
        }
        .fullScreenCover(isPresented: $isCapturePresented) {
            captureSheet
        }
        .onChange(of: viewModel.annotations) { _, newAnnotations in
            if !cameraFocused && !newAnnotations.isEmpty {
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.4)) {
                    focusCamera(for: newAnnotations)
                }
                cameraFocused = true
            }
        }
    }

    @ViewBuilder
    private var mapLayer: some View {
        switch viewModel.loadState {
        case .idle, .loading:
            if !cameraFocused {
                ConsoleMapKitView(
                    points: [],
                    region: $region,
                    selectedPoint: Binding(
                        get: { viewModel.selectedPoint },
                        set: { viewModel.selectedPoint = $0 }
                    )
                )
                .ignoresSafeArea(edges: .bottom)
            } else {
                ConsoleMapKitView(
                    points: viewModel.annotations,
                    region: $region,
                    selectedPoint: Binding(
                        get: { viewModel.selectedPoint },
                        set: { viewModel.selectedPoint = $0 }
                    )
                )
                .ignoresSafeArea(edges: .bottom)
            }
        case .failed:
            errorState
        case .loaded:
            ConsoleMapKitView(
                points: viewModel.annotations,
                region: $region,
                selectedPoint: Binding(
                    get: { viewModel.selectedPoint },
                    set: { viewModel.selectedPoint = $0 }
                )
            )
            .ignoresSafeArea(edges: .bottom)
        }
    }

    @ViewBuilder
    private var overlayLayer: some View {
        VStack(spacing: 10) {
            headerCard
            if viewModel.loadState == .loading {
                loadingPill
            }
            Spacer()
            if viewModel.loadState == .loaded && viewModel.annotations.isEmpty {
                emptyPill
            }
            if let selected = viewModel.selectedPoint {
                actionBar(selected: selected)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 16)
        .allowsHitTesting(true)
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                pointsPill
                Spacer(minLength: 8)
                modeToggle
                dailyProgressCircle
            }
        }
    }

    private var pointsPill: some View {
        HStack(spacing: 7) {
            Image(systemName: "mappin.circle.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(ADLConsoleColor.terra)
            Text("\(viewModel.annotations.count)")
                .font(ADLConsoleFont.headline)
                .foregroundStyle(ADLConsoleColor.ink)
                .monospacedDigit()
            Text(t("points", "points"))
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .lineLimit(1)
        }
        .padding(.horizontal, 13)
        .frame(height: 48)
        .background(ADLConsoleColor.surface)
        .clipShape(Capsule())
        .shadow(color: Color.black.opacity(0.08), radius: 8, y: 3)
        .accessibilityElement(children: .combine)
    }

    private var dailyProgressCircle: some View {
        let goal = 5
        let captured = viewModel.capturedTodayCount
        let fraction = goal > 0 ? min(Double(captured) / Double(goal), 1) : 0

        return ZStack {
            Circle()
                .stroke(ADLConsoleColor.navyWash, lineWidth: 5)
            Circle()
                .trim(from: 0, to: fraction)
                .stroke(
                    ADLConsoleColor.gold,
                    style: StrokeStyle(lineWidth: 5, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(reduceMotion ? nil : .easeOut(duration: 0.35), value: fraction)
            Text("\(captured)")
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.ink)
                .monospacedDigit()
        }
        .frame(width: 48, height: 48)
        .background(ADLConsoleColor.surface)
        .clipShape(Circle())
        .shadow(color: Color.black.opacity(0.08), radius: 8, y: 3)
        .accessibilityLabel(t("Today's progress", "Progrès du jour"))
        .accessibilityValue("\(captured) / \(goal)")
    }

    private var modeToggle: some View {
        HStack(spacing: 2) {
            modeButton(.map, icon: "map.fill", label: t("Map", "Carte"))
            modeButton(.list, icon: "list.bullet", label: t("List", "Liste"))
        }
        .padding(3)
        .background(ADLConsoleColor.surface)
        .clipShape(Capsule())
        .adlShadowBorder()
    }

    private func modeButton(_ mode: DisplayMode, icon: String, label: String) -> some View {
        Button {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.18)) {
                displayMode = mode
            }
        } label: {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .frame(width: 44, height: 36)
                .foregroundStyle(displayMode == mode ? .white : ADLConsoleColor.navy)
                .background(displayMode == mode ? ADLConsoleColor.navy : Color.clear)
                .clipShape(Capsule())
        }
        .buttonStyle(ADLConsolePressStyle())
        .accessibilityLabel(label)
    }

    private var listLayer: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                listHeader

                switch viewModel.loadState {
                case .idle, .loading:
                    ADLConsoleCard(padding: 18) {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text(t("Loading records", "Chargement des données"))
                                .font(ADLConsoleFont.footnote)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                        }
                    }
                case .failed:
                    errorState
                case .loaded:
                    if viewModel.points.isEmpty {
                        ADLConsoleCard(padding: 20) {
                            ADLConsoleEmptyState(
                                systemImage: "location.viewfinder",
                                headline: t("No company points yet", "Aucun point entreprise pour le moment"),
                                description: t("Tap + to capture the first tracked point.", "Appuyez sur + pour capturer le premier point suivi."),
                                iconColor: ADLConsoleColor.terra
                            )
                        }
                    } else {
                        ForEach(viewModel.points, id: \.rootId) { point in
                            companyPointListRow(point)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 96)
        }
        .background(ADLConsoleColor.page)
        .refreshable { await viewModel.load(force: true) }
    }

    private var listHeader: some View {
        ADLConsoleHeroCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 5) {
                        ADLConsoleMicroLabel(text: t("Company points", "Points entreprise"), color: Color.white.opacity(0.68))
                        Text(t("Tracked infrastructure", "Infrastructure suivie"))
                            .font(ADLConsoleFont.title)
                            .foregroundStyle(.white)
                    }
                    Spacer()
                    modeToggle
                }

                HStack(spacing: 8) {
                    listMetric(value: "\(viewModel.points.count)", label: t("points", "points"), icon: "mappin.circle.fill")
                    listMetric(value: "\(viewModel.annotations.count)", label: t("mapped", "sur carte"), icon: "map.fill")
                    listMetric(value: "\(viewModel.capturedTodayCount)", label: t("today", "aujourd'hui"), icon: "clock.fill")
                }
            }
        }
    }

    private func listMetric(value: String, label: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.75))
            Text(value)
                .font(ADLConsoleFont.headline)
                .foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(ADLConsoleFont.caption)
                .foregroundStyle(Color.white.opacity(0.72))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.white.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func companyPointListRow(_ point: CollapsedPlatformPoint) -> some View {
        ADLConsoleCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(ADLConsoleColor.terra)
                        .frame(width: 44, height: 44)
                        .background(ADLConsoleColor.terraWash)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    VStack(alignment: .leading, spacing: 4) {
                        Text(point.representative.recordTypeKey.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(ADLConsoleFont.headline)
                            .foregroundStyle(ADLConsoleColor.ink)
                            .lineLimit(1)
                        Text(point.representative.capturedBy)
                            .font(ADLConsoleFont.caption)
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                            .lineLimit(1)
                    }

                    Spacer()

                    ADLConsolePill(
                        text: "\(point.chainCount) \(t("updates", "mises à jour"))",
                        foreground: ADLConsoleColor.forestDark,
                        background: ADLConsoleColor.forestWash
                    )
                }

                HStack(spacing: 12) {
                    if let gps = point.representative.evidence.gps {
                        Label(String(format: "%.4f, %.4f", gps.latitude, gps.longitude), systemImage: "location.fill")
                            .monospacedDigit()
                    } else {
                        Label(t("No GPS", "Sans GPS"), systemImage: "location.slash")
                    }
                    Label("\(point.photos.count) \(t("photos", "photos"))", systemImage: "camera.fill")
                        .monospacedDigit()
                }
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.inkMuted)

                HStack(spacing: 10) {
                    Button {
                        viewModel.select(point)
                    } label: {
                        Text(t("Open details", "Ouvrir le détail"))
                            .font(ADLConsoleFont.subheadline)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(ADLConsolePressStyle())
                    .foregroundStyle(ADLConsoleColor.navy)
                    .background(ADLConsoleColor.navyWash)
                    .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))

                    Button {
                        beginUpdate(for: point)
                    } label: {
                        Label(t("Update", "Mettre à jour"), systemImage: "plus.circle.fill")
                            .font(ADLConsoleFont.subheadline)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(ADLConsolePressStyle())
                    .foregroundStyle(.white)
                    .background(ADLConsoleColor.navy)
                    .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.input, style: .continuous))
                }
            }
        }
    }

    private var loadingPill: some View {
        HStack(spacing: 8) {
            Image(systemName: "hourglass")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(ADLConsoleColor.inkMuted)
                .accessibilityHidden(true)
            Text(t("Loading records", "Chargement des données"))
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.ink)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(ADLConsoleColor.surface)
        .clipShape(Capsule())
        .shadow(color: Color.black.opacity(0.08), radius: 8, y: 3)
    }

    private var emptyPill: some View {
        HStack(spacing: 8) {
            Image(systemName: "location.viewfinder")
                .font(.system(size: 14))
                .foregroundStyle(ADLConsoleColor.terra)
            Text(t("No points yet — tap + to capture", "Aucun point — appuyez sur + pour capturer"))
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.ink)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(ADLConsoleColor.surface)
        .clipShape(Capsule())
        .shadow(color: Color.black.opacity(0.08), radius: 8, y: 3)
    }

    private func actionBar(selected: CollapsedPlatformPoint) -> some View {
        let title = selected.representative.recordTypeKey.replacingOccurrences(of: "_", with: " ").capitalized
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(ADLConsoleFont.subheadline)
                    .foregroundStyle(ADLConsoleColor.ink)
                    .lineLimit(1)
                Text("\(selected.chainCount) \(t("updates", "mises à jour"))")
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
                    .monospacedDigit()
            }
            Spacer()
            Button {
                beginUpdate(for: selected)
            } label: {
                Text(t("Update", "Mettre à jour"))
                    .font(ADLConsoleFont.subheadline)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .foregroundStyle(.white)
                    .background(ADLConsoleColor.navy)
                    .clipShape(Capsule())
            }
            .buttonStyle(ADLConsolePressStyle())
        }
        .padding(14)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: ADLConsoleRadius.card, style: .continuous))
        .shadow(color: Color.black.opacity(0.12), radius: 14, y: 6)
    }

    private var errorState: some View {
        ADLConsoleCard(padding: 16) {
            ADLConsoleErrorState(
                message: viewModel.loadErrorMessage ?? "",
                retryTitle: t("Try again", "Réessayer")
            ) {
                Task { await viewModel.load(force: true) }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func focusCamera(for annotations: [CollapsedPlatformPoint]) {
        let coordinates = annotations.compactMap(\.representative.evidence.gps)
            .map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        guard !coordinates.isEmpty else { return }

        if coordinates.count == 1, let only = coordinates.first {
            region = MKCoordinateRegion(center: only, latitudinalMeters: 800, longitudinalMeters: 800)
            return
        }

        let latitudes = coordinates.map(\.latitude)
        let longitudes = coordinates.map(\.longitude)
        guard let minLat = latitudes.min(), let maxLat = latitudes.max(),
              let minLon = longitudes.min(), let maxLon = longitudes.max()
        else { return }

        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2)
        let span = MKCoordinateSpan(
            latitudeDelta: max((maxLat - minLat) * 1.4, 0.01),
            longitudeDelta: max((maxLon - minLon) * 1.4, 0.01)
        )
        region = MKCoordinateRegion(center: center, span: span)
    }

    private var captureButton: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                Button {
                    beginNewCapture()
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 56, height: 56)
                        .background(ADLConsoleColor.terra)
                        .clipShape(Circle())
                        .shadow(color: Color.black.opacity(0.25), radius: 12, x: 0, y: 6)
                }
                .accessibilityLabel(t("Capture a record", "Capturer un enregistrement"))
                .padding(20)
            }
        }
    }

    private func beginNewCapture() {
        captureAttachPointId = nil
        isCapturePresented = true
    }

    private func beginUpdate(for collapsedPoint: CollapsedPlatformPoint) {
        viewModel.clearSelection()
        captureAttachPointId = collapsedPoint.rootId
        isCapturePresented = true
    }

    @ViewBuilder
    private var captureSheet: some View {
        if let organizationId = appState.organization?.id {
            NavigationStack {
                CaptureView(
                    viewModel: appState.makeCaptureViewModel(
                        organizationId: organizationId,
                        attachPointId: captureAttachPointId
                    )
                )
                .navigationTitle(
                    captureAttachPointId == nil
                        ? t("Capture a record", "Capturer un enregistrement")
                        : t("Update this point", "Mettre à jour ce point")
                )
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(t("Close", "Fermer")) {
                            isCapturePresented = false
                            Task { await viewModel.load(force: true) }
                        }
                    }
                }
            }
        }
    }
}
