import ConsoleForms
import ConsoleModels
import CoreLocation
import MapKit
import SwiftUI

struct CompanyMapView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: CompanyMapViewModel

    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 4.0887, longitude: 9.7403),
        span: MKCoordinateSpan(latitudeDelta: 0.018, longitudeDelta: 0.018)
    )
    @State private var isCapturePresented = false
    @State private var captureAttachPointId: String?
    @State private var cameraFocused = false

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> CompanyMapViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ZStack {
            mapLayer
            overlayLayer
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
                withAnimation(.easeInOut(duration: 0.4)) {
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
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(ADLConsoleColor.terra)
                Text("\(viewModel.annotations.count)")
                    .font(ADLConsoleFont.headline)
                    .foregroundStyle(ADLConsoleColor.ink)
                Text(t("points", "points"))
                    .font(ADLConsoleFont.caption)
                    .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(ADLConsoleColor.surface)
            .clipShape(Capsule())
            .shadow(color: Color.black.opacity(0.08), radius: 8, y: 3)

            Spacer()

            ADLConsoleDailyProgressWidget(
                capturedToday: viewModel.capturedTodayCount,
                dailyGoal: 5,
                t: t
            )
            .frame(maxWidth: 200)
            .shadow(color: Color.black.opacity(0.08), radius: 8, y: 3)
        }
    }

    private var loadingPill: some View {
        HStack(spacing: 8) {
            ProgressView()
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
                Task { await viewModel.load() }
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
                            Task { await viewModel.load() }
                        }
                    }
                }
            }
        }
    }
}
