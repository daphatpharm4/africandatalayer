import ConsoleForms
import ConsoleModels
import CoreLocation
import MapKit
import SwiftUI

/// The collector's primary map destination: every approved company point
/// (one pin per point-chain — `CompanyMapViewModel.points`) on a MapKit map,
/// tap a pin for its per-update history (`CompanyPointDetailView`), and a
/// floating "+" that reuses `CaptureView` to capture a fresh point. All
/// network/grouping logic lives in `CompanyMapViewModel` /
/// `PointChainGrouping` (`ConsoleForms`) — this view is a thin renderer.
struct CompanyMapView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: CompanyMapViewModel

    @State private var cameraPosition: MapCameraPosition = .automatic
    @State private var isCapturePresented = false
    @State private var captureAttachPointId: String?

    private var t: (String, String) -> String { appState.language.t }

    init(viewModel: @autoclosure @escaping () -> CompanyMapViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            content
            floatingCaptureButton
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
    }

    // MARK: - Content states

    @ViewBuilder
    private var content: some View {
        switch viewModel.loadState {
        case .idle, .loading:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed:
            errorState
        case .loaded:
            if viewModel.annotations.isEmpty {
                emptyState
            } else {
                mapView
            }
        }
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

    private var emptyState: some View {
        ADLConsoleCard(padding: 24) {
            ADLConsoleEmptyState(
                systemImage: "map",
                headline: t("No points on the map yet", "Aucun point sur la carte pour le moment"),
                description: t(
                    "Tap + to capture your company's first point.",
                    "Appuyez sur + pour capturer le premier point de votre entreprise."
                )
            )
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Map

    private var mapView: some View {
        Map(position: $cameraPosition) {
            ForEach(viewModel.annotations) { collapsedPoint in
                if let gps = collapsedPoint.representative.evidence.gps {
                    Annotation(
                        pinTitle(for: collapsedPoint),
                        coordinate: CLLocationCoordinate2D(latitude: gps.latitude, longitude: gps.longitude)
                    ) {
                        pin(for: collapsedPoint)
                    }
                }
            }
        }
        .mapControls {
            MapUserLocationButton()
            MapCompass()
        }
        .onAppear { focusCamera() }
        .onChange(of: viewModel.annotations.map(\.id)) { _, _ in focusCamera() }
    }

    private func pinTitle(for collapsedPoint: CollapsedPlatformPoint) -> String {
        collapsedPoint.representative.recordTypeKey.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func pin(for collapsedPoint: CollapsedPlatformPoint) -> some View {
        Button {
            viewModel.select(collapsedPoint)
        } label: {
            ZStack(alignment: .topTrailing) {
                Circle()
                    .fill(pinColor(for: collapsedPoint))
                    .frame(width: 18, height: 18)
                    .overlay(Circle().stroke(Color.white, lineWidth: 2))
                    .shadow(color: ADLConsoleColor.navy.opacity(0.28), radius: 5, x: 0, y: 4)
                if collapsedPoint.chainCount > 1 {
                    Text("\(collapsedPoint.chainCount)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(3)
                        .background(ADLConsoleColor.terra)
                        .clipShape(Circle())
                        .offset(x: 6, y: -6)
                }
            }
        }
        .accessibilityLabel(
            collapsedPoint.chainCount > 1
                ? "\(pinTitle(for: collapsedPoint)) · \(collapsedPoint.chainCount) \(t("updates", "mises à jour"))"
                : pinTitle(for: collapsedPoint)
        )
    }

    private func pinColor(for collapsedPoint: CollapsedPlatformPoint) -> Color {
        let palette: [Color] = [
            ADLConsoleColor.navy,
            ADLConsoleColor.forest,
            ADLConsoleColor.terra,
            ADLConsoleColor.gold,
        ]
        let hash = abs(collapsedPoint.representative.recordTypeKey.hashValue)
        return palette[hash % palette.count]
    }

    private func focusCamera() {
        let coordinates = viewModel.annotations.compactMap(\.representative.evidence.gps)
            .map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        guard !coordinates.isEmpty else { return }

        if coordinates.count == 1, let only = coordinates.first {
            cameraPosition = .region(MKCoordinateRegion(center: only, latitudinalMeters: 800, longitudinalMeters: 800))
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
        cameraPosition = .region(MKCoordinateRegion(center: center, span: span))
    }

    // MARK: - Capture ("+" and "Update this point")

    private var floatingCaptureButton: some View {
        Button {
            beginNewCapture()
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(ADLConsoleColor.terra)
                .clipShape(Circle())
                .shadow(color: ADLConsoleColor.terra.opacity(0.35), radius: 10, x: 0, y: 4)
        }
        .padding(20)
        .accessibilityLabel(t("Capture a record", "Capturer un enregistrement"))
    }

    /// Floating "+" — a brand-new point, no `pointId` attached.
    private func beginNewCapture() {
        captureAttachPointId = nil
        isCapturePresented = true
    }

    /// The detail sheet's "Update this point" — attaches the fresh capture
    /// to this point's chain via `CollapsedPlatformPoint.rootId`, so it joins
    /// the same point instead of starting a new one.
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
