@testable import ADLConsole
import ConsoleAPI
import ConsoleModels
import XCTest

@MainActor
final class MissionsViewModelTests: XCTestCase {
    private let baseURL = URL(string: "https://example.com")!

    func testLoadSplitsActiveDailyWeeklyAndCompletedMissions() async {
        let transport = MockPlatformTransport()
        transport.responseData = Data("""
        {"missions":[
          {"id":"d1","organizationId":"o1","period":"daily","state":"in_progress","titleEn":"Daily","titleFr":"Quotidienne","quota":5,"current":2,"rewardXp":10,"deadline":"2026-08-01T00:00:00Z","projectId":null,"category":null,"notesEn":null,"notesFr":null,"assignedUserIds":["u1"],"createdAt":"2026-07-29T00:00:00Z","updatedAt":"2026-07-29T00:00:00Z"},
          {"id":"w1","organizationId":"o1","period":"weekly","state":"pending","titleEn":"Weekly","titleFr":"Hebdomadaire","quota":10,"current":0,"rewardXp":20,"deadline":"2026-08-05T00:00:00Z","projectId":null,"category":null,"notesEn":null,"notesFr":null,"assignedUserIds":["u1"],"createdAt":"2026-07-29T00:00:00Z","updatedAt":"2026-07-29T00:00:00Z"},
          {"id":"c1","organizationId":"o1","period":"daily","state":"completed","titleEn":"Done","titleFr":"Terminée","quota":1,"current":1,"rewardXp":5,"deadline":"2026-07-30T00:00:00Z","projectId":null,"category":null,"notesEn":null,"notesFr":null,"assignedUserIds":["u1"],"createdAt":"2026-07-29T00:00:00Z","updatedAt":"2026-07-29T00:00:00Z"}
        ]}
        """.utf8)
        let viewModel = MissionsViewModel(
            apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport),
            organizationId: "o1",
            role: .collector,
            language: .en
        )

        await viewModel.load()

        XCTAssertEqual(viewModel.dailyMissions.map(\.id), ["d1"])
        XCTAssertEqual(viewModel.weeklyMissions.map(\.id), ["w1"])
        XCTAssertEqual(viewModel.completedMissions.map(\.id), ["c1"])
        XCTAssertFalse(viewModel.canCreate)
    }

    func testLeaderboardUsesOrganizationScopedEndpoint() async {
        let transport = MockPlatformTransport()
        transport.responseData = Data("""
        [{"rank":1,"userId":"ali***","name":"Alice","xp":120,"contributions":12,"lastContributionAt":"2026-07-29T00:00:00Z","lastLocation":"Douala","averageQualityScore":92,"rankingScore":1104,"verticalBreakdown":{"pharmacy":12}}]
        """.utf8)
        let viewModel = LeaderboardViewModel(
            apiClient: PlatformAPIClient(baseURL: baseURL, transport: transport),
            organizationId: "o1",
            language: .en
        )

        await viewModel.load()

        XCTAssertEqual(viewModel.entries.first?.name, "Alice")
        let components = URLComponents(url: transport.lastRequest!.url!, resolvingAgainstBaseURL: false)
        XCTAssertEqual(components?.queryItems?.first(where: { $0.name == "organizationId" })?.value, "o1")
    }
}
