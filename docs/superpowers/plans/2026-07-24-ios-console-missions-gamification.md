# Missions & Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mission cards (daily/weekly), manager assignment system, and public leaderboard to the iOS console.

**Architecture:** Missions are backed by two new server tables (mission_definitions, mission_assignments) via new PlatformAPI endpoints. The iOS app uses existing `PlatformAPIClient` patterns, adds two new Swift model types in ConsoleModels, and renders mission cards in a new MissionsView with daily/weekly sections. The leaderboard extends the existing `GET /api/leaderboard` with org-scoped filtering.

**Tech Stack:** Swift 6, SwiftUI, Swift Charts, PlatformAPIClient, PostgreSQL, Auth.js

## Global Constraints

- All new API routes follow existing `/api/user?view=platform_*` convention
- Role gating uses existing `PlatformRole` ranking system
- Swift models go in `ConsoleModels` package; API methods go in `ConsoleAPI` package
- iOS 17+ deployment target

---

### Task 1: Data models (Swift + SQL)

**Files:**
- Create: `ios-console/Packages/ConsoleCore/Sources/ConsoleModels/PlatformMission.swift`
- Create: `api/migrations/XXXXX_create_missions.sql`
- Test: `ios-console/Packages/ConsoleCore/Tests/ConsoleModelsTests/PlatformMissionTests.swift`

**Interfaces:**
- Produces: `PlatformMission`, `PlatformMissionAssignment`, `PlatformMissionCreateInput`, `LeaderboardEntry` types

- [ ] **Step 1: Write the SQL migration**

```sql
CREATE TABLE mission_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES platform_organizations(id),
    title text NOT NULL,
    description text,
    mission_type text NOT NULL CHECK (mission_type IN ('daily', 'weekly')),
    quota integer NOT NULL DEFAULT 5,
    reward_xp integer NOT NULL DEFAULT 10,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE mission_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id uuid NOT NULL REFERENCES mission_definitions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    progress integer NOT NULL DEFAULT 0,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE (mission_id, user_id)
);

CREATE INDEX idx_mission_assignments_user ON mission_assignments(user_id);
CREATE INDEX idx_mission_definitions_org ON mission_definitions(organization_id, mission_type);
```

- [ ] **Step 2: Write the Swift model tests**

```swift
// In ConsoleModelsTests/PlatformMissionTests.swift
import Testing
@testable import ConsoleModels

@Test func missionDecoding() throws {
    let json = """
    {"id":"m1","organizationId":"o1","title":"Collect 5 shops","missionType":"daily","quota":5,"rewardXp":10,"startsAt":"2026-07-24T00:00:00Z","endsAt":"2026-07-25T00:00:00Z","progress":3,"completed":false}
    """.data(using: .utf8)!
    let mission = try JSONDecoder().decode(PlatformMission.self, from: json)
    #expect(mission.title == "Collect 5 shops")
    #expect(mission.progress == 3)
    #expect(!mission.completed)
}

@Test func missionCreateInputEncoding() throws {
    let input = PlatformMissionCreateInput(title: "Test", missionType: .weekly, quota: 10, rewardXp: 20, startsAt: Date(), endsAt: Date().addingTimeInterval(604800), assignedUserIds: ["u1", "u2"])
    let data = try JSONEncoder().encode(input)
    let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    #expect(dict?["missionType"] as? String == "weekly")
    #expect((dict?["assignedUserIds"] as? [String])?.count == 2)
}
```

- [ ] **Step 3: Write Swift models**

```swift
// In ConsoleModels/PlatformMission.swift
import Foundation

public struct PlatformMission: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let organizationId: String
    public let title: String
    public let description: String?
    public let missionType: MissionType
    public let quota: Int
    public let rewardXp: Int
    public let startsAt: Date
    public let endsAt: Date
    public let progress: Int
    public let completed: Bool

    public enum MissionType: String, Codable, Sendable {
        case daily, weekly
    }

    public var progressFraction: Double {
        guard quota > 0 else { return 1 }
        return min(Double(progress) / Double(quota), 1)
    }

    public var isExpired: Bool { endsAt < Date() }
}

public struct PlatformMissionCreateInput: Codable, Equatable, Sendable {
    public let title: String
    public let description: String?
    public let missionType: PlatformMission.MissionType
    public let quota: Int
    public let rewardXp: Int
    public let startsAt: Date
    public let endsAt: Date
    public let assignedUserIds: [String]

    public init(title: String, description: String? = nil, missionType: PlatformMission.MissionType, quota: Int, rewardXp: Int, startsAt: Date, endsAt: Date, assignedUserIds: [String]) {
        self.title = title
        self.description = description
        self.missionType = missionType
        self.quota = quota
        self.rewardXp = rewardXp
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.assignedUserIds = assignedUserIds
    }
}

public struct LeaderboardEntry: Codable, Equatable, Sendable, Identifiable {
    public var id: String { userId }
    public let userId: String
    public let displayName: String
    public let submissionCount: Int
    public let approvalRate: Double
    public let rank: Int
}
```

- [ ] **Step 4: Run tests**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ConsoleCore -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS

- [ ] **Step 5: Commit**

```bash
git add ios-console/Packages/ConsoleCore/Sources/ConsoleModels/PlatformMission.swift api/migrations/XXXXX_create_missions.sql ios-console/Packages/ConsoleCore/Tests/ConsoleModelsTests/
git commit -m "feat: add mission and leaderboard data models"
```

---

### Task 2: API client methods

**Files:**
- Modify: `ios-console/Packages/ConsoleCore/Sources/ConsoleAPI/PlatformAPIClient.swift`
- Modify: `ios-console/Packages/ConsoleCore/Sources/ConsoleAPI/PlatformAPIClient+Requests.swift`
- Test: `ios-console/Packages/ConsoleCore/Tests/ConsoleAPITests/PlatformAPIClientTests.swift`

**Interfaces:**
- Consumes: `PlatformMission`, `PlatformMissionCreateInput`, `LeaderboardEntry`
- Produces: `listMissions(organizationId:)`, `createMission(input:)`, `listLeaderboard(organizationId:)`

- [ ] **Step 1: Write API client tests**

```swift
@Test func listMissionsRequest() async throws {
    let client = PlatformAPIClient(transport: MockTransport())
    MockTransport.nextResponse = """
    [{"id":"m1","organizationId":"o1","title":"Test","missionType":"daily","quota":5,"rewardXp":10,"startsAt":"2026-07-24T00:00:00Z","endsAt":"2026-07-25T00:00:00Z","progress":0,"completed":false}]
    """
    let missions = try await client.listMissions(organizationId: "o1")
    #expect(missions.count == 1)
    #expect(missions[0].title == "Test")
}

@Test func leaderboardRequest() async throws {
    let client = PlatformAPIClient(transport: MockTransport())
    MockTransport.nextResponse = """
    [{"userId":"u1","displayName":"Alice","submissionCount":50,"approvalRate":0.95,"rank":1}]
    """
    let entries = try await client.listLeaderboard(organizationId: "o1")
    #expect(entries.count == 1)
    #expect(entries[0].rank == 1)
}
```

- [ ] **Step 2: Run to verify failure**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ConsoleCore -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Compile errors (methods not defined)

- [ ] **Step 3: Add API methods**

```swift
// In PlatformAPIClient.swift or the requests extension
extension PlatformAPIClient {
    func listMissions(organizationId: String) async throws -> [PlatformMission] {
        try await callPlatform(method: "GET", path: "/api/user", query: ["view": "platform_mission_list", "organizationId": organizationId])
    }

    func createMission(input: PlatformMissionCreateInput) async throws -> PlatformMission {
        try await callPlatform(method: "POST", path: "/api/user", body: [
            "view": "platform_mission_create",
            "organizationId": input.assignedUserIds.first ?? "",
            "title": input.title,
            "description": input.description ?? "",
            "missionType": input.missionType.rawValue,
            "quota": input.quota,
            "rewardXp": input.rewardXp,
            "startsAt": ISO8601DateFormatter().string(from: input.startsAt),
            "endsAt": ISO8601DateFormatter().string(from: input.endsAt),
            "assignedUserIds": input.assignedUserIds,
        ])
    }

    func listLeaderboard(organizationId: String) async throws -> [LeaderboardEntry] {
        try await callPlatform(method: "GET", path: "/api/leaderboard", query: ["organizationId": organizationId])
    }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ConsoleCore -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS

- [ ] **Step 5: Commit**

```bash
git add ios-console/Packages/ConsoleCore/Sources/ConsoleAPI/PlatformAPIClient.swift ios-console/Packages/ConsoleCore/Sources/ConsoleAPI/PlatformAPIClient+Requests.swift ios-console/Packages/ConsoleCore/Tests/ConsoleAPITests/
git commit -m "feat: add missions and leaderboard API methods"
```

---

### Task 3: Mission cards UI

**Files:**
- Create: `ios-console/ADLConsole/Screens/Missions/MissionsView.swift`
- Create: `ios-console/ADLConsole/Screens/Missions/MissionCardView.swift`
- Create: `ios-console/ADLConsole/Screens/Missions/MissionsViewModel.swift`
- Modify: `ios-console/ADLConsole/State/AppState.swift` (add `makeMissionsViewModel` + routing)
- Test: `ios-console/ADLConsoleTests/MissionsViewModelTests.swift`

**Interfaces:**
- Consumes: `PlatformAPIClient.listMissions`, `PlatformMission`
- Produces: `MissionsView`, `MissionsViewModel`

- [ ] **Step 1: Write MissionsViewModel test**

```swift
@Test func loadMissions() async throws {
    let api = MockAPIClient()
    api.missionsResponse = [
        PlatformMission(id: "d1", organizationId: "o1", title: "Daily: Collect 5", missionType: .daily, quota: 5, rewardXp: 10, startsAt: Date(), endsAt: Date().addingTimeInterval(86400), progress: 3, completed: false)
    ]
    let vm = MissionsViewModel(apiClient: api, organizationId: "o1", language: .en)
    await vm.load()
    #expect(vm.dailyMissions.count == 1)
    #expect(vm.dailyMissions[0].progress == 3)
}
```

- [ ] **Step 2: Implement MissionsViewModel**

```swift
@MainActor
final class MissionsViewModel: ObservableObject {
    @Published private(set) var dailyMissions: [PlatformMission] = []
    @Published private(set) var weeklyMissions: [PlatformMission] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private let apiClient: PlatformAPIClient
    private let organizationId: String
    let language: ConsoleLanguage

    func load() async {
        isLoading = true
        do {
            let all = try await apiClient.listMissions(organizationId: organizationId)
            let now = Date()
            dailyMissions = all.filter { $0.missionType == .daily && !$0.isExpired }
            weeklyMissions = all.filter { $0.missionType == .weekly && !$0.isExpired }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
```

- [ ] **Step 3: Implement MissionCardView**

```swift
struct MissionCardView: View {
    let mission: PlatformMission
    @State private var showDetails = false

    var body: some View {
        Button { showDetails = true } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: mission.missionType == .daily ? "sun.max" : "calendar")
                        .foregroundColor(.adlGold)
                    Text(mission.title).font(.headline)
                    Spacer()
                    Text("\(mission.rewardXp) XP").font(.caption).foregroundColor(.adlForestGreen)
                }
                ProgressView(value: mission.progressFraction)
                    .tint(mission.completed ? .adlForestGreen : .adlGold)
                Text("\(mission.progress)/\(mission.quota)").font(.caption).foregroundColor(.secondary)
            }
            .padding()
            .background(Color.adlSurface)
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showDetails) {
            MissionDetailSheet(mission: mission)
        }
    }
}
```

- [ ] **Step 4: Implement MissionsView**

```swift
struct MissionsView: View {
    @StateObject private var vm: MissionsViewModel

    var body: some View {
        List {
            if !vm.dailyMissions.isEmpty {
                Section("Daily Missions") {
                    ForEach(vm.dailyMissions) { MissionCardView(mission: $0) }
                }
            }
            if !vm.weeklyMissions.isEmpty {
                Section("Weekly Missions") {
                    ForEach(vm.weeklyMissions) { MissionCardView(mission: $0) }
                }
            }
        }
        .navigationTitle("Missions")
        .task { await vm.load() }
    }
}
```

- [ ] **Step 5: Add to AppState routing**

In `AppState.swift`, add `makeMissionsViewModel(organizationId:)` and add `MISSIONS` to `visibleDestinations` for collector/manager/owner roles.

- [ ] **Step 6: Run tests**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS

- [ ] **Step 7: Commit**

```bash
git add ios-console/ADLConsole/Screens/Missions/ ios-console/ADLConsole/State/AppState.swift ios-console/ADLConsoleTests/
git commit -m "feat: mission cards with daily/weekly sections and progress tracking"
```

---

### Task 4: Manager mission creation/assignment flow

**Files:**
- Create: `ios-console/ADLConsole/Screens/Missions/CreateMissionView.swift`
- Create: `ios-console/ADLConsole/Screens/Missions/CreateMissionViewModel.swift`
- Test: `ios-console/ADLConsoleTests/CreateMissionViewModelTests.swift`

**Interfaces:**
- Consumes: `PlatformAPIClient.createMission`, `PlatformMissionCreateInput`
- Produces: `CreateMissionView`

- [ ] **Step 1: Write ViewModel test**

```swift
@Test func createMission() async throws {
    let api = MockAPIClient()
    let vm = CreateMissionViewModel(apiClient: api, organizationId: "o1", language: .en)
    vm.title = "Collect 10 shops"
    vm.missionType = .weekly
    vm.quota = 10
    vm.rewardXp = 20
    vm.selectedUserIds = ["u1", "u2"]
    await vm.submit()
    #expect(vm.submitState == .success)
    #expect(api.lastCreatedMission?.title == "Collect 10 shops")
}
```

- [ ] **Step 2: Implement CreateMissionViewModel**

```swift
@MainActor
final class CreateMissionViewModel: ObservableObject {
    @Published var title: String = ""
    @Published var missionType: PlatformMission.MissionType = .daily
    @Published var quota: Int = 5
    @Published var rewardXp: Int = 10
    @Published var startDate: Date = Date()
    @Published var endDate: Date = Date().addingTimeInterval(86400)
    @Published var selectedUserIds: Set<String> = []
    @Published var availableUsers: [PlatformUser] = []
    @Published var submitState: SubmitState = .idle

    enum SubmitState: Equatable { case idle, submitting, success, failed(String) }

    func loadAvailableUsers() async {
        do { availableUsers = try await apiClient.listMembers(organizationId: organizationId) }
        catch { submitState = .failed(error.localizedDescription) }
    }

    func submit() async {
        submitState = .submitting
        do {
            let input = PlatformMissionCreateInput(
                title: title, description: nil, missionType: missionType,
                quota: quota, rewardXp: rewardXp,
                startsAt: startDate, endsAt: endDate,
                assignedUserIds: Array(selectedUserIds)
            )
            _ = try await apiClient.createMission(input: input)
            submitState = .success
        } catch { submitState = .failed(error.localizedDescription) }
    }
}
```

- [ ] **Step 3: Implement CreateMissionView**

Form with: title text field, mission type picker (daily/weekly), quota stepper, XP stepper, date pickers, user multi-select list, and submit button. Role-gated to manager+ via `PlatformRoleRank`.

- [ ] **Step 4: Run tests**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Screens/Missions/CreateMission* ios-console/ADLConsoleTests/
git commit -m "feat: manager mission creation with user assignment and quota config"
```

---

### Task 5: Public leaderboard

**Files:**
- Create: `ios-console/ADLConsole/Screens/Leaderboard/LeaderboardView.swift`
- Create: `ios-console/ADLConsole/Screens/Leaderboard/LeaderboardViewModel.swift`
- Test: `ios-console/ADLConsoleTests/LeaderboardViewModelTests.swift`

- [ ] **Step 1: Write ViewModel test**

```swift
@Test func loadLeaderboard() async throws {
    let api = MockAPIClient()
    api.leaderboardResponse = [
        LeaderboardEntry(userId: "u1", displayName: "Alice", submissionCount: 100, approvalRate: 0.95, rank: 1),
        LeaderboardEntry(userId: "u2", displayName: "Bob", submissionCount: 80, approvalRate: 0.90, rank: 2),
    ]
    let vm = LeaderboardViewModel(apiClient: api, organizationId: "o1", language: .en)
    await vm.load()
    #expect(vm.entries.count == 2)
    #expect(vm.entries[0].rank == 1)
}
```

- [ ] **Step 2: Implement LeaderboardViewModel + LeaderboardView**

List of entries with rank number, avatar, name, submission count, approval rate bar. Podium for top 3.

- [ ] **Step 3: Add LEADERBOARD destination to routing**

Role-gated to collector+ (viewer excluded).

- [ ] **Step 4: Run tests**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS and app builds

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Screens/Leaderboard/ ios-console/ADLConsoleTests/
git commit -m "feat: public leaderboard with org-scoped ranking"
```

---

### Task 6: Server-side mission API + daily auto-generation

**Files:**
- Create: `api/user/platform_mission.ts`
- Create: `api/cron/daily-missions.ts`

- [ ] **Step 1: Add mission list/create endpoints**

In `api/user/platform_mission.ts` — handle `view=platform_mission_list` (SELECT from mission_definitions JOIN mission_assignments for org) and `view=platform_mission_create` (INSERT into mission_definitions + mission_assignments in a transaction).

- [ ] **Step 2: Add daily mission auto-generation cron**

Daily cron at midnight UTC: for each org, check if today's daily missions exist. If not, create them with default quota (5, 10 XP) for all active collectors.

- [ ] **Step 3: Run web tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add api/user/platform_mission.ts api/cron/daily-missions.ts
git commit -m "feat: mission API endpoints and daily auto-generation cron"
```

---

### Task 7: Full regression run

- [ ] **Step 1: Run all iOS tests**
Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -50`
Expected: All tests PASS

- [ ] **Step 2: Run all web tests**
Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Run lint**
Run: `npm run lint`
Expected: Clean
