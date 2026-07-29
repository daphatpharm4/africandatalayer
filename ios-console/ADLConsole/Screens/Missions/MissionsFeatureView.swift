import ConsoleAPI
import ConsoleModels
import SwiftUI

@MainActor
final class MissionsViewModel: ObservableObject {
    @Published private(set) var missions: [PlatformMission] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    let organizationId: String
    let role: PlatformRole
    let language: ConsoleLanguage
    private let apiClient: PlatformAPIClient

    init(apiClient: PlatformAPIClient, organizationId: String, role: PlatformRole, language: ConsoleLanguage) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.role = role
        self.language = language
    }

    var dailyMissions: [PlatformMission] { activeMissions(period: .daily) }
    var weeklyMissions: [PlatformMission] { activeMissions(period: .weekly) }
    var completedMissions: [PlatformMission] { missions.filter { $0.state == .completed } }
    var canCreate: Bool { role == .manager || role == .owner }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            missions = try await apiClient.listMissions(organizationId: organizationId)
        } catch {
            errorMessage = describePlatformError(error, language: language)
        }
    }

    func makeCreateMissionViewModel() -> CreateMissionViewModel {
        CreateMissionViewModel(apiClient: apiClient, organizationId: organizationId, language: language)
    }

    private func activeMissions(period: MissionPeriod) -> [PlatformMission] {
        missions.filter { $0.period == period && $0.state != .completed && $0.state != .expired }
    }
}

@MainActor
final class CreateMissionViewModel: ObservableObject {
    enum SubmitState: Equatable {
        case idle
        case submitting
        case success
        case failed(String)
    }

    @Published var titleEn = ""
    @Published var titleFr = ""
    @Published var notesEn = ""
    @Published var notesFr = ""
    @Published var quota = 10
    @Published var rewardXp = 20
    @Published var deadline = Date().addingTimeInterval(7 * 86_400)
    @Published var selectedUserIds: Set<String> = []
    @Published private(set) var collectors: [PlatformMembership] = []
    @Published private(set) var submitState: SubmitState = .idle

    let language: ConsoleLanguage
    private let apiClient: PlatformAPIClient
    private let organizationId: String

    init(apiClient: PlatformAPIClient, organizationId: String, language: ConsoleLanguage) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.language = language
    }

    var canSubmit: Bool {
        (!titleEn.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !titleFr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            && quota > 0
            && deadline > Date()
            && !selectedUserIds.isEmpty
    }

    func loadCollectors() async {
        do {
            collectors = try await apiClient.listOrgMembers(organizationId: organizationId)
                .members
                .filter { $0.role == .collector }
        } catch {
            submitState = .failed(describePlatformError(error, language: language))
        }
    }

    @discardableResult
    func submit() async -> Bool {
        guard canSubmit else { return false }
        submitState = .submitting
        let fallbackTitle = titleEn.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? titleFr : titleEn
        let fallbackFrenchTitle = titleFr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? titleEn : titleFr
        let input = PlatformMissionCreateInput(
            organizationId: organizationId,
            titleEn: fallbackTitle.trimmingCharacters(in: .whitespacesAndNewlines),
            titleFr: fallbackFrenchTitle.trimmingCharacters(in: .whitespacesAndNewlines),
            quota: quota,
            deadline: ISO8601DateFormatter().string(from: deadline),
            rewardXp: rewardXp,
            notesEn: notesEn.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            notesFr: notesFr.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            targetUserIds: Array(selectedUserIds).sorted()
        )
        do {
            _ = try await apiClient.createMission(input: input)
            submitState = .success
            return true
        } catch {
            submitState = .failed(describePlatformError(error, language: language))
            return false
        }
    }
}

struct MissionsView: View {
    @StateObject private var viewModel: MissionsViewModel
    @State private var createMissionPresented = false

    init(viewModel: @autoclosure @escaping () -> MissionsViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading, viewModel.missions.isEmpty {
                    ProgressView()
                } else if let message = viewModel.errorMessage, viewModel.missions.isEmpty {
                    ADLConsoleErrorState(message: message, retryTitle: t("Try again", "Réessayer")) {
                        Task { await viewModel.load() }
                    }
                } else if viewModel.missions.isEmpty {
                    ADLConsoleEmptyState(
                        systemImage: "scope",
                        headline: t("No active missions", "Aucune mission active"),
                        description: viewModel.canCreate
                            ? t("Create a weekly mission for collectors.", "Créez une mission hebdomadaire pour les collecteurs.")
                            : t("New missions will appear here when assigned.", "Les nouvelles missions apparaîtront ici après attribution.")
                    )
                } else {
                    missionList
                }
            }
            .navigationTitle(t("Missions", "Missions"))
            .toolbar {
                if viewModel.canCreate {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { createMissionPresented = true } label: {
                            Label(t("Create mission", "Créer une mission"), systemImage: "plus")
                        }
                    }
                }
            }
        }
        .task { if viewModel.missions.isEmpty { await viewModel.load() } }
        .sheet(isPresented: $createMissionPresented) {
            CreateMissionView(
                viewModel: viewModel.makeCreateMissionViewModel()
            ) {
                createMissionPresented = false
                Task { await viewModel.load() }
            }
        }
    }

    private var missionList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                missionSection(t("Today", "Aujourd’hui"), missions: viewModel.dailyMissions)
                missionSection(t("This week", "Cette semaine"), missions: viewModel.weeklyMissions)
                missionSection(t("Completed", "Terminées"), missions: viewModel.completedMissions)
            }
            .padding(20)
        }
        .refreshable { await viewModel.load() }
        .background(ADLConsoleColor.page)
    }

    @ViewBuilder
    private func missionSection(_ title: String, missions: [PlatformMission]) -> some View {
        if !missions.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text(title).font(ADLConsoleFont.title)
                ForEach(missions) { MissionCardView(mission: $0, language: viewModel.language) }
            }
        }
    }

    private var t: (String, String) -> String { viewModel.language.t }
}

struct MissionCardView: View {
    let mission: PlatformMission
    let language: ConsoleLanguage

    var body: some View {
        ADLConsoleCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    Image(systemName: mission.period == .daily ? "sun.max.fill" : "calendar.badge.clock")
                        .foregroundStyle(ADLConsoleColor.goldDark)
                        .frame(width: 28, height: 28)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(mission.title(language: language.rawValue))
                            .font(ADLConsoleFont.headline)
                            .foregroundStyle(ADLConsoleColor.ink)
                        if let notes = mission.notes(language: language.rawValue), !notes.isEmpty {
                            Text(notes)
                                .font(ADLConsoleFont.caption)
                                .foregroundStyle(ADLConsoleColor.inkMuted)
                                .lineLimit(2)
                        }
                    }
                    Spacer()
                    ADLConsolePill(
                        text: "+\(mission.rewardXp) XP",
                        foreground: ADLConsoleColor.forestDark,
                        background: ADLConsoleColor.forestWash
                    )
                }
                ProgressView(value: mission.progressFraction)
                    .tint(mission.state == .completed ? ADLConsoleColor.forestDark : ADLConsoleColor.goldDark)
                    .accessibilityValue("\(mission.current) / \(mission.quota)")
                HStack {
                    Label("\(mission.current)/\(mission.quota)", systemImage: "chart.bar.fill")
                    Spacer()
                    if let deadline = mission.deadline {
                        Label(ADLConsoleDateFormatting.mediumDateTime(deadline), systemImage: "clock")
                    }
                }
                .font(ADLConsoleFont.caption)
                .foregroundStyle(ADLConsoleColor.inkMuted)
            }
            .padding(16)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct CreateMissionView: View {
    @StateObject private var viewModel: CreateMissionViewModel
    @Environment(\.dismiss) private var dismiss
    let onCreated: () -> Void

    init(viewModel: @autoclosure @escaping () -> CreateMissionViewModel, onCreated: @escaping () -> Void) {
        _viewModel = StateObject(wrappedValue: viewModel())
        self.onCreated = onCreated
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(t("Mission", "Mission")) {
                    TextField(t("English title", "Titre anglais"), text: $viewModel.titleEn)
                    TextField(t("French title", "Titre français"), text: $viewModel.titleFr)
                    TextField(t("English notes", "Notes anglaises"), text: $viewModel.notesEn, axis: .vertical)
                    TextField(t("French notes", "Notes françaises"), text: $viewModel.notesFr, axis: .vertical)
                }
                Section(t("Target & reward", "Objectif et récompense")) {
                    Stepper("\(t("Quota", "Quota")): \(viewModel.quota)", value: $viewModel.quota, in: 1...100)
                    Stepper("\(t("Reward", "Récompense")): \(viewModel.rewardXp) XP", value: $viewModel.rewardXp, in: 0...500, step: 5)
                    DatePicker(t("Deadline", "Échéance"), selection: $viewModel.deadline, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                }
                Section(t("Collectors", "Collecteurs")) {
                    if viewModel.collectors.isEmpty {
                        Text(t("No current collectors available.", "Aucun collecteur actuel disponible."))
                            .foregroundStyle(ADLConsoleColor.inkMuted)
                    } else {
                        ForEach(viewModel.collectors, id: \.userId) { member in
                            Button {
                                if viewModel.selectedUserIds.contains(member.userId) {
                                    viewModel.selectedUserIds.remove(member.userId)
                                } else {
                                    viewModel.selectedUserIds.insert(member.userId)
                                }
                            } label: {
                                HStack {
                                    Text(member.userId)
                                    Spacer()
                                    Image(systemName: viewModel.selectedUserIds.contains(member.userId) ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(viewModel.selectedUserIds.contains(member.userId) ? ADLConsoleColor.forestDark : ADLConsoleColor.inkMuted)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                if case .failed(let message) = viewModel.submitState {
                    Section { Text(message).foregroundStyle(ADLConsoleColor.danger) }
                }
            }
            .navigationTitle(t("Create weekly mission", "Créer une mission hebdomadaire"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("Cancel", "Annuler")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(t("Create", "Créer")) {
                        Task { if await viewModel.submit() { onCreated() } }
                    }
                    .disabled(!viewModel.canSubmit || viewModel.submitState == .submitting)
                }
            }
            .task { await viewModel.loadCollectors() }
        }
    }

    private var t: (String, String) -> String { viewModel.language.t }
}

@MainActor
final class LeaderboardViewModel: ObservableObject {
    @Published private(set) var entries: [LeaderboardEntry] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    let language: ConsoleLanguage
    private let apiClient: PlatformAPIClient
    private let organizationId: String

    init(apiClient: PlatformAPIClient, organizationId: String, language: ConsoleLanguage) {
        self.apiClient = apiClient
        self.organizationId = organizationId
        self.language = language
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            entries = try await apiClient.leaderboard(organizationId: organizationId)
        } catch {
            errorMessage = describePlatformError(error, language: language)
        }
    }
}

struct LeaderboardView: View {
    @StateObject private var viewModel: LeaderboardViewModel

    init(viewModel: @autoclosure @escaping () -> LeaderboardViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading, viewModel.entries.isEmpty {
                    ProgressView()
                } else if let message = viewModel.errorMessage, viewModel.entries.isEmpty {
                    ADLConsoleErrorState(message: message, retryTitle: t("Try again", "Réessayer")) {
                        Task { await viewModel.load() }
                    }
                } else if viewModel.entries.isEmpty {
                    ADLConsoleEmptyState(
                        systemImage: "trophy",
                        headline: t("No rankings yet", "Aucun classement"),
                        description: t("Verified contributions will appear here.", "Les contributions vérifiées apparaîtront ici.")
                    )
                } else {
                    List(viewModel.entries) { entry in
                        HStack(spacing: 12) {
                            rankBadge(entry.rank)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.name).font(ADLConsoleFont.headline)
                                Text(t("\(entry.contributions) contributions", "\(entry.contributions) contributions"))
                                    .font(ADLConsoleFont.caption)
                                    .foregroundStyle(ADLConsoleColor.inkMuted)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text("\(entry.xp) XP").font(ADLConsoleFont.headline)
                                Label("\(entry.averageQualityScore)%", systemImage: "checkmark.seal.fill")
                                    .font(ADLConsoleFont.caption)
                                    .foregroundStyle(ADLConsoleColor.forestDark)
                            }
                        }
                        .padding(.vertical, 5)
                        .accessibilityElement(children: .combine)
                    }
                    .refreshable { await viewModel.load() }
                }
            }
            .navigationTitle(t("Leaderboard", "Classement"))
        }
        .task { if viewModel.entries.isEmpty { await viewModel.load() } }
    }

    private func rankBadge(_ rank: Int) -> some View {
        ZStack {
            Circle().fill(rank <= 3 ? ADLConsoleColor.goldWash : ADLConsoleColor.navyWash)
            Text("#\(rank)")
                .font(ADLConsoleFont.subheadline)
                .foregroundStyle(rank <= 3 ? ADLConsoleColor.goldDark : ADLConsoleColor.navy)
        }
        .frame(width: 44, height: 44)
    }

    private var t: (String, String) -> String { viewModel.language.t }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
