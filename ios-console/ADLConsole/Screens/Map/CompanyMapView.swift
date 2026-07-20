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
        .onChange(of: viewModel.annotations) { _, newAnnotations in
            if !cameraFocused {
                focusCamera(for: newAnnotations)
                cameraFocused = true
            }
        }
    }

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
