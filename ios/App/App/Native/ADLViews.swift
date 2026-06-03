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
                        Text("Capture, review, and export trusted infrastructure data.")
                            .font(.body)
                            .foregroundColor(.secondary)
                    }

                    ADLCard {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Demo role")
                                .font(.headline)
                                .foregroundColor(ADLColor.ink)
                            Picker("Role", selection: $selectedRole) {
                                ForEach(UserRole.allCases) { role in
                                    Text(role.title).tag(role)
                                }
                            }
                            .pickerStyle(.segmented)

                            Button {
                                appState.switchRole(selectedRole)
                                appState.signInDemo()
                            } label: {
                                Label("Enter App", systemImage: "arrow.right.circle.fill")
                            }
                            .buttonStyle(PrimaryButtonStyle())
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
            ForEach(tabs(for: appState.selectedRole)) { route in
                NavigationView {
                    screen(for: route)
                }
                .tabItem {
                    Label(tabTitle(for: route), systemImage: tabImage(for: route))
                }
                .tag(route)
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

    private func tabs(for role: UserRole) -> [AppRoute] {
        switch role {
        case .agent:
            return [.home, .contribute, .queue, .profile]
        case .admin:
            return [.adminReview, .agentPerformance, .profile]
        case .client:
            return [.clientDashboard, .analytics, .profile]
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
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 4.0887, longitude: 9.7403),
        span: MKCoordinateSpan(latitudeDelta: 0.018, longitudeDelta: 0.018)
    )

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ADLCard {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Bonamoussadi field map")
                                    .font(.title2.weight(.bold))
                                    .foregroundColor(ADLColor.ink)
                                Text("Next useful captures are marked in operational order.")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            StatusPill(title: "Live", tint: ADLColor.forest)
                        }

                        Map(coordinateRegion: $region, annotationItems: appState.points) { point in
                            MapMarker(coordinate: point.location.coordinate, tint: point.category.tint)
                        }
                        .frame(height: 260)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }

                ForEach(appState.points) { point in
                    PointCard(point: point)
                }
            }
            .padding(16)
        }
        .background(ADLColor.paper.ignoresSafeArea())
        .navigationTitle("Field Work")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    appState.selectedTab = .contribute
                } label: {
                    Image(systemName: "plus.circle.fill")
                }
                .accessibilityLabel("Start capture")
            }
        }
    }
}

struct PointCard: View {
    let point: DataPoint

    var body: some View {
        ADLCard {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: point.category.systemImage)
                    .foregroundColor(point.category.tint)
                    .frame(width: 42, height: 42)
                    .background(point.category.tint.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(point.name)
                            .font(.headline)
                            .foregroundColor(ADLColor.ink)
                        Spacer()
                        Text("\(point.trustScore)%")
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(point.trustScore >= 85 ? ADLColor.forest : ADLColor.gold)
                    }

                    Text(point.subtitle)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    HStack(spacing: 8) {
                        StatusPill(title: point.category.title, tint: point.category.tint)
                        if point.requiresRefresh {
                            StatusPill(title: "Refresh", tint: ADLColor.terracotta)
                        }
                    }
                }
            }
        }
    }
}

struct ContributionView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var locationProvider = LocationProvider()
    @State private var category: SubmissionCategory = .pharmacy
    @State private var title = ""
    @State private var notes = ""
    @State private var capturedImage: UIImage?
    @State private var showingCamera = false

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

                        TextField("Site name", text: $title)
                            .textFieldStyle(.roundedBorder)

                        TextEditor(text: $notes)
                            .frame(minHeight: 110)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(ADLColor.line, lineWidth: 1)
                            )
                            .accessibilityLabel("Notes")

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

                        if let capturedImage {
                            Image(uiImage: capturedImage)
                                .resizable()
                                .scaledToFill()
                                .frame(height: 180)
                                .clipped()
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }

                        Button {
                            appState.enqueueContribution(
                                title: title,
                                notes: notes,
                                category: category,
                                location: locationProvider.lastLocation,
                                image: capturedImage
                            )
                            title = ""
                            notes = ""
                            capturedImage = nil
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
    }
}

struct SubmissionQueueView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            Section {
                MetricTile(title: "Queued", value: "\(appState.queueSnapshot.queued)", systemImage: "tray.full.fill", tint: ADLColor.forest)
                MetricTile(title: "Failed", value: "\(appState.queueSnapshot.failed)", systemImage: "exclamationmark.triangle.fill", tint: ADLColor.terracotta)
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
                        }
                        .padding(.vertical, 6)
                    }
                }
            }
        }
        .navigationTitle("Offline Queue")
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

            Section("Role") {
                Picker("Role", selection: Binding(
                    get: { appState.selectedRole },
                    set: { appState.switchRole($0) }
                )) {
                    ForEach(UserRole.allCases) { role in
                        Text(role.title).tag(role)
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
