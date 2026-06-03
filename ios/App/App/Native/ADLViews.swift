import MapKit
import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            if appState.isBootstrapping {
                SplashView()
            } else if appState.isAuthenticated {
                AppShellView()
            } else {
                AuthView()
            }
        }
        .task {
            await appState.bootstrap()
        }
    }
}

struct SplashView: View {
    var body: some View {
        ZStack {
            ADLColor.navy.ignoresSafeArea()
            VStack(spacing: 18) {
                Image(systemName: "map.fill")
                    .font(.system(size: 54, weight: .bold))
                    .foregroundColor(ADLColor.gold)
                Text("African Data Layer")
                    .font(.largeTitle.weight(.bold))
                    .foregroundColor(.white)
                Text("Ground truth capture for field teams")
                    .font(.headline)
                    .foregroundColor(.white.opacity(0.76))
            }
            .padding(28)
        }
    }
}

struct AuthView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedRole: UserRole = .agent
    @State private var identifier = ""
    @State private var password = ""

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Field Operations")
                            .font(.caption.weight(.bold))
                            .foregroundColor(ADLColor.gold)
                            .textCase(.uppercase)
                        Text("African Data Layer")
                            .font(.largeTitle.weight(.bold))
                            .foregroundColor(ADLColor.ink)
                        Text(AppReleaseMode.allowsDemoAccess ? "Capture, review, and export trusted infrastructure data." : "Capture and sync trusted infrastructure data.")
                            .font(.body)
                            .foregroundColor(.secondary)
                    }

                    if AppReleaseMode.allowsDemoAccess {
                        ADLCard {
                            VStack(alignment: .leading, spacing: 14) {
                                Text("Demo role")
                                    .font(.headline)
                                    .foregroundColor(ADLColor.ink)
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
                                    Label("Enter Demo", systemImage: "arrow.right.circle.fill")
                                }
                                .buttonStyle(SecondaryButtonStyle())
                            }
                        }
                    }

                    ADLCard {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Production sign in")
                                .font(.headline)
                                .foregroundColor(ADLColor.ink)
                            TextField("Phone or email", text: $identifier)
                                .textContentType(.username)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .textFieldStyle(.roundedBorder)
                            SecureField("Password", text: $password)
                                .textContentType(.password)
                                .textFieldStyle(.roundedBorder)

                            if let authError = appState.authError {
                                Text(authError)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundColor(ADLColor.terracotta)
                            }

                            Button {
                                Task {
                                    await appState.signIn(identifier: identifier, password: password)
                                }
                            } label: {
                                if appState.isSigningIn {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Label("Sign In", systemImage: "lock.fill")
                                }
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .disabled(appState.isSigningIn)
                        }
                    }

                    HStack(spacing: 12) {
                        MetricTile(title: "Queued offline", value: "\(appState.queueSnapshot.queued)", systemImage: "tray.full.fill", tint: ADLColor.forest)
                        MetricTile(title: "Seed points", value: "\(appState.points.count)", systemImage: "mappin.and.ellipse", tint: ADLColor.terracotta)
                    }
                }
                .padding(20)
            }
            .background(ADLColor.paper.ignoresSafeArea())
            .navigationBarHidden(true)
        }
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

struct AdminReviewView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            Section {
                HStack(spacing: 12) {
                    MetricTile(title: "Needs review", value: "\(appState.points.filter(\.requiresRefresh).count)", systemImage: "checkmark.shield.fill", tint: ADLColor.terracotta)
                    MetricTile(title: "Trusted avg", value: "84%", systemImage: "gauge.with.dots.needle.67percent", tint: ADLColor.forest)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
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
    }
}

struct AgentPerformanceView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                MetricTile(title: "Verified submissions", value: "148", systemImage: "checkmark.seal.fill", tint: ADLColor.forest)
                MetricTile(title: "Median review time", value: "18m", systemImage: "timer", tint: ADLColor.gold)
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
    }
}

struct ClientDashboardView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    MetricTile(title: "Coverage", value: "72%", systemImage: "map.fill", tint: ADLColor.forest)
                    MetricTile(title: "Deltas", value: "31", systemImage: "arrow.triangle.2.circlepath", tint: ADLColor.gold)
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
    }
}

struct AnalyticsView: View {
    private let values = [0.42, 0.68, 0.54, 0.81, 0.76, 0.93, 0.72]

    var body: some View {
        ScrollView {
            ADLCard {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Coverage trend")
                        .font(.title3.weight(.bold))
                    HStack(alignment: .bottom, spacing: 10) {
                        ForEach(Array(values.enumerated()), id: \.offset) { _, value in
                            RoundedRectangle(cornerRadius: 4)
                                .fill(ADLColor.forest)
                                .frame(height: CGFloat(value) * 150)
                        }
                    }
                    .frame(height: 170, alignment: .bottom)
                }
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Analytics")
    }
}

struct RewardsView: View {
    var body: some View {
        List {
            Label("Quality streak bonus", systemImage: "flame.fill")
            Label("Verified refresh reward", systemImage: "star.circle.fill")
            Label("Zone completion bonus", systemImage: "mappin.circle.fill")
        }
        .navigationTitle("Rewards")
    }
}

struct ProfileView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(appState.profile.name)
                        .font(.title2.weight(.bold))
                    Text(appState.profile.role.title)
                        .foregroundColor(.secondary)
                    StatusPill(title: appState.profile.trustTier.capitalized, tint: ADLColor.forest)
                }
                .padding(.vertical, 8)
            }

            if AppReleaseMode.allowsRoleSwitching {
                Section("Role") {
                    Picker("Role", selection: Binding(
                        get: { appState.selectedRole },
                        set: { appState.switchRole($0) }
                    )) {
                        ForEach(AppReleaseMode.demoRoles) { role in
                            Text(role.title).tag(role)
                        }
                    }
                }
            }

            Section("Progress") {
                HStack {
                    Text("XP")
                    Spacer()
                    Text("\(appState.profile.xp)")
                        .fontWeight(.semibold)
                }
                HStack {
                    Text("Streak")
                    Spacer()
                    Text("\(appState.profile.streakDays) days")
                        .fontWeight(.semibold)
                }
            }

            Section {
                Button("Sign Out") {
                    appState.signOut()
                }
                .foregroundColor(ADLColor.terracotta)
            }
        }
        .navigationTitle("Profile")
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
