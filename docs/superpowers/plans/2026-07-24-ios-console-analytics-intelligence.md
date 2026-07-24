# Analytics & Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dashboards, charts, spatial intelligence, export, and AI analytics assistant to the iOS console.

**Architecture:** All analytics data flows through a single `AnalyticsRepository` protocol backed by `PlatformAPIClient`. Swift Charts renders all chart types natively (iOS 17+). Map overlays extend the existing MapKit use. Export uses `UIActivityViewController` with generated file data. The AI assistant is a chat UI backed by the existing `POST /api/ai/search` endpoint.

**Tech Stack:** Swift 6, SwiftUI, Swift Charts, MapKit, UIActivityViewController, PlatformAPIClient

## Global Constraints

- All API calls go through existing `POST /api/user?view=platform_*` pattern
- Charts use iOS 17+ built-in Swift Charts (no third-party library)
- Map overlays must coexist with existing MKMapView usage
- New screens use existing `ConsoleDestination` routing pattern
- iOS 17+ deployment target

---

### Task 1: Data models + AnalyticsRepository protocol

**Files:**
- Create: `ios-console/Packages/ConsoleCore/Sources/ConsoleModels/PlatformAnalytics.swift`
- Create: `ios-console/Packages/ConsoleCore/Sources/ConsoleAPI/AnalyticsRepository.swift`
- Test: `ios-console/Packages/ConsoleCore/Tests/ConsoleModelsTests/PlatformAnalyticsTests.swift`

**Interfaces:**
- Produces: `DeltaSnapshot`, `WeeklyTrend`, `CategoryBreakdown`, `AgentPerformance`, `GeohashScore`, `AnomalyFlag`, `HeatMapCell`, `AIQueryResponse`, `AnalyticsRepositoryProtocol`

- [ ] **Step 1: Write model tests**

```swift
@Test func deltaSnapshotDecoding() throws {
    let json = """
    {"totalRecords":1500,"recordsThisWeek":42,"recordsChanged":12,"recordsRemoved":3,"pendingReview":8,"weeklyActiveContributors":15,"freshnessScore":87.5}
    """.data(using: .utf8)!
    let snapshot = try JSONDecoder().decode(DeltaSnapshot.self, from: json)
    #expect(snapshot.totalRecords == 1500)
    #expect(snapshot.freshnessScore == 87.5)
}

@Test func weeklyTrendDecoding() throws {
    let json = """
    {"weekEnding":"2026-07-24","submissions":100,"approvals":85,"rejections":10,"uniqueContributors":12}
    """.data(using: .utf8)!
    let trend = try JSONDecoder().decode(WeeklyTrend.self, from: json)
    #expect(trend.submissions == 100)
}
```

- [ ] **Step 2: Write model types**

```swift
// In ConsoleModels/PlatformAnalytics.swift
public struct DeltaSnapshot: Codable, Equatable, Sendable {
    public let totalRecords: Int
    public let recordsThisWeek: Int
    public let recordsChanged: Int
    public let recordsRemoved: Int
    public let pendingReview: Int
    public let weeklyActiveContributors: Int
    public let freshnessScore: Double
}

public struct WeeklyTrend: Codable, Equatable, Sendable, Identifiable {
    public var id: String { weekEnding }
    public let weekEnding: String
    public let submissions: Int
    public let approvals: Int
    public let rejections: Int
    public let uniqueContributors: Int
}

public struct CategoryBreakdown: Codable, Equatable, Sendable, Identifiable {
    public var id: String { category }
    public let category: String
    public let count: Int
    public let percentage: Double
}

public struct AgentPerformance: Codable, Equatable, Sendable, Identifiable {
    public var id: String { userId }
    public let userId: String
    public let displayName: String
    public let submissions: Int
    public let approvalRate: Double
    public let flags: Int
    public let trustScore: Double
}

public struct GeohashScore: Codable, Equatable, Sendable {
    public let geohash: String
    public let opportunityScore: Double
    public let recordCount: Int
    public let lastUpdated: String
}

public struct AnomalyFlag: Codable, Equatable, Sendable, Identifiable {
    public var id: String { "\(recordId)-\(anomalyType)" }
    public let recordId: String
    public let anomalyType: String
    public let severity: String
    public let description: String
    public let detectedAt: String
}

public struct HeatMapCell: Codable, Equatable, Sendable {
    public let geohash: String
    public let latitude: Double
    public let longitude: Double
    public let intensity: Double
}

public struct AIQueryResponse: Codable, Equatable, Sendable {
    public let answer: String
    public let data: [[String: JSONValue]]?
    public let chartSuggestion: String?
}
```

- [ ] **Step 3: Write AnalyticsRepository protocol and implementation**

```swift
// In ConsoleAPI/AnalyticsRepository.swift
public protocol AnalyticsRepositoryProtocol: Sendable {
    func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot
    func weeklyTrends(organizationId: String, weeks: Int) async throws -> [WeeklyTrend]
    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown]
    func agentPerformance(organizationId: String) async throws -> [AgentPerformance]
    func spatialIntelligence(organizationId: String) async throws -> [GeohashScore]
    func anomalies(organizationId: String, since: Date) async throws -> [AnomalyFlag]
    func heatMapData(organizationId: String, geohashPrecision: Int) async throws -> [HeatMapCell]
    func aiQuery(organizationId: String, query: String) async throws -> AIQueryResponse
}

public final class AnalyticsRepository: AnalyticsRepositoryProtocol, Sendable {
    private let apiClient: PlatformAPIClient

    public func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot {
        try await apiClient.callPlatform(method: "GET", path: "/api/analytics", query: ["view": "delta", "organizationId": organizationId])
    }

    public func weeklyTrends(organizationId: String, weeks: Int) async throws -> [WeeklyTrend] {
        try await apiClient.callPlatform(method: "GET", path: "/api/analytics", query: ["view": "trends", "weeks": String(weeks), "organizationId": organizationId])
    }
    // ... remaining methods follow same pattern
}
```

- [ ] **Step 4: Run tests**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ConsoleCore -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS

- [ ] **Step 5: Commit**

```bash
git add ios-console/Packages/ConsoleCore/Sources/ConsoleModels/PlatformAnalytics.swift ios-console/Packages/ConsoleCore/Sources/ConsoleAPI/AnalyticsRepository.swift
git commit -m "feat: analytics models and repository protocol"
```

---

### Task 2: KPI header + Delta Dashboard

**Files:**
- Create: `ios-console/ADLConsole/Screens/Analytics/DeltaDashboardView.swift`
- Create: `ios-console/ADLConsole/Screens/Analytics/DeltaDashboardViewModel.swift`
- Create: `ios-console/ADLConsole/Screens/Analytics/KPIHeaderView.swift`
- Create: `ios-console/ADLConsole/Screens/Analytics/WeeklyTrendChartView.swift`
- Test: `ios-console/ADLConsoleTests/DeltaDashboardViewModelTests.swift`

- [ ] **Step 1: Write ViewModel test**

```swift
@Test func loadDeltaDashboard() async throws {
    let repo = MockAnalyticsRepository()
    repo.deltaSnapshotResult = DeltaSnapshot(totalRecords: 1500, recordsThisWeek: 42, recordsChanged: 12, recordsRemoved: 3, pendingReview: 8, weeklyActiveContributors: 15, freshnessScore: 87.5)
    repo.weeklyTrendsResult = [WeeklyTrend(weekEnding: "2026-07-24", submissions: 100, approvals: 85, rejections: 10, uniqueContributors: 12)]
    let vm = DeltaDashboardViewModel(repository: repo, organizationId: "o1", language: .en)
    await vm.load()
    #expect(vm.snapshot?.totalRecords == 1500)
    #expect(vm.trends.count == 1)
}
```

- [ ] **Step 2: Implement KPIHeaderView**

```swift
struct KPIHeaderView: View {
    let snapshot: DeltaSnapshot

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                StatCard(label: "Total Records", value: "\(snapshot.totalRecords)", icon: "database")
                StatCard(label: "This Week", value: "\(snapshot.recordsThisWeek)", icon: "arrow.up", color: .adlForestGreen)
                StatCard(label: "Pending Review", value: "\(snapshot.pendingReview)", icon: "clock", color: .adlGold)
                StatCard(label: "Freshness", value: "\(Int(snapshot.freshnessScore))%", icon: "drop", color: .adlGold)
            }
            .padding(.horizontal)
        }
    }
}

struct StatCard: View {
    let label: String
    let value: String
    let icon: String
    var color: Color = .adlNavy

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon).foregroundColor(color)
            Text(value).font(.title2.bold())
            Text(label).font(.caption2).foregroundColor(.secondary)
        }
        .frame(width: 80, height: 80)
        .background(Color.adlSurface)
        .cornerRadius(12)
    }
}
```

- [ ] **Step 3: Implement WeeklyTrendChartView**

```swift
struct WeeklyTrendChartView: View {
    let trends: [WeeklyTrend]

    var body: some View {
        Chart(trends) { week in
            BarMark(x: .value("Week", week.weekEnding.suffix(5)), y: .value("Submissions", week.submissions))
                .foregroundStyle(.adlNavy)
            BarMark(x: .value("Week", week.weekEnding.suffix(5)), y: .value("Approvals", week.approvals))
                .foregroundStyle(.adlForestGreen)
            BarMark(x: .value("Week", week.weekEnding.suffix(5)), y: .value("Rejections", week.rejections))
                .foregroundStyle(.adlTerracotta)
        }
        .frame(height: 200)
        .padding()
    }
}
```

- [ ] **Step 4: Implement DeltaDashboardView**

```swift
struct DeltaDashboardView: View {
    @StateObject private var vm: DeltaDashboardViewModel

    var body: some View {
        List {
            if let snapshot = vm.snapshot {
                Section("Overview") { KPIHeaderView(snapshot: snapshot).listRowInsets(EdgeInsets()) }
                Section("Weekly Trends") { WeeklyTrendChartView(trends: vm.trends) }
                Section("Changes & Removals") {
                    StatRow("Changed", value: "\(snapshot.recordsChanged)")
                    StatRow("Removed", value: "\(snapshot.recordsRemoved)")
                }
                Section("Anomaly Flags") {
                    if vm.anomalies.isEmpty {
                        Text("No anomalies detected").foregroundColor(.secondary)
                    }
                    ForEach(vm.anomalies) { anomaly in
                        HStack {
                            Image(systemName: "exclamationmark.triangle").foregroundColor(anomaly.severity == "high" ? .red : .adlGold)
                            Text(anomaly.description).font(.subheadline)
                        }
                    }
                }
            }
        }
        .navigationTitle("Delta Dashboard")
        .task { await vm.load() }
    }
}
```

- [ ] **Step 5: Run tests**

Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20`
Expected: Tests PASS

- [ ] **Step 6: Commit**

```bash
git add ios-console/ADLConsole/Screens/Analytics/ ios-console/ADLConsoleTests/
git commit -m "feat: delta dashboard with KPI header and weekly trend chart"
```

---

### Task 3: Investor Dashboard + Category breakdown

**Files:**
- Create: `ios-console/ADLConsole/Screens/Analytics/InvestorDashboardView.swift`
- Create: `ios-console/ADLConsole/Screens/Analytics/InvestorDashboardViewModel.swift`
- Create: `ios-console/ADLConsole/Screens/Analytics/CategoryBreakdownView.swift`

- [ ] **Step 1: Implement InvestorDashboardView with trust gauge**

```swift
struct InvestorDashboardView: View {
    @StateObject private var vm: InvestorDashboardViewModel

    var body: some View {
        List {
            Section("Trust & Quality") {
                if let snapshot = vm.snapshot {
                    Gauge(value: snapshot.freshnessScore, in: 0...100) {
                        Text("Trust Score")
                    } currentValueLabel: {
                        Text("\(Int(snapshot.freshnessScore))")
                    }
                    .gaugeStyle(.accessoryCircularCapacity)
                    .tint(snapshot.freshnessScore > 70 ? .adlForestGreen : .adlGold)
                    .frame(maxWidth: .infinity)
                    .padding()
                }
                StatRow("Fraud Rate", value: vm.fraudRateText)
                StatRow("Freshness", value: vm.freshnessText)
            }
        }
        .navigationTitle("Investor Dashboard")
        .task { await vm.load() }
    }
}
```

- [ ] **Step 2: Implement CategoryBreakdownView with pie chart**

```swift
struct CategoryBreakdownView: View {
    let breakdown: [CategoryBreakdown]

    var body: some View {
        Chart(breakdown) { category in
            SectorMark(angle: .value("Count", category.count), innerRadius: .ratio(0.5))
                .foregroundStyle(by: .value("Category", category.category))
        }
        .frame(height: 250)
        .padding()
    }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/Analytics/InvestorDashboard* ios-console/ADLConsole/Screens/Analytics/CategoryBreakdown*
git commit -m "feat: investor dashboard with trust gauge and category breakdown pie chart"
```

---

### Task 4: Agent performance view

**Files:**
- Create: `ios-console/ADLConsole/Screens/Analytics/AgentPerformanceView.swift`
- Create: `ios-console/ADLConsole/Screens/Analytics/AgentPerformanceViewModel.swift`

- [ ] **Step 1: Implement AgentPerformanceView**

```swift
struct AgentPerformanceView: View {
    @StateObject private var vm: AgentPerformanceViewModel

    var body: some View {
        List(vm.agents) { agent in
            HStack {
                VStack(alignment: .leading) {
                    Text(agent.displayName).font(.headline)
                    Text("\(agent.submissions) submissions").font(.caption)
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text("\(Int(agent.approvalRate * 100))%").font(.subheadline.bold())
                    HStack {
                        Image(systemName: "flag").foregroundColor(.adlTerracotta).font(.caption2)
                        Text("\(agent.flags)").font(.caption2)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .navigationTitle("Agent Performance")
        .task { await vm.load() }
    }
}
```

- [ ] **Step 2: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/Analytics/AgentPerformance* ios-console/ADLConsoleTests/
git commit -m "feat: agent performance view with submissions and quality metrics"
```

---

### Task 5: Spatial intelligence grid + heat map overlay

**Files:**
- Create: `ios-console/ADLConsole/Screens/Analytics/SpatialIntelligenceLayer.swift`
- Create: `ios-console/ADLConsole/Screens/Analytics/HeatMapRenderer.swift`
- Modify: `ios-console/ADLConsole/Screens/Map/CompanyMapView.swift`

- [ ] **Step 1: Implement Geohash grid overlay as MKPolygon**

```swift
class GeohashGridOverlay: NSObject, MKOverlay {
    let cells: [GeohashScore]
    var coordinate: CLLocationCoordinate2D
    var boundingMapRect: MKMapRect

    // Decode geohash to bounding box, create MKPolygon for each cell
}

class GeohashGridRenderer: MKOverlayRenderer {
    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        // Draw each cell as colored polygon based on opportunity score
    }
}
```

- [ ] **Step 2: Implement heat map overlay (custom MKOverlay + MKOverlayRenderer)**

```swift
class HeatMapOverlay: NSObject, MKOverlay {
    let cells: [HeatMapCell]
    var coordinate: CLLocationCoordinate2D
    var boundingMapRect: MKMapRect
}

class HeatMapRenderer: MKOverlayRenderer {
    override func draw(_ mapRect: MKMapRect, zoomScale: MKZoomScale, in context: CGContext) {
        // Draw gradient circles for each cell with alpha based on intensity
    }
}
```

- [ ] **Step 3: Integrate with CompanyMapView**

Add a overlay mode picker (segmented control: Standard / Grid / Heat). On mode change, add/remove overlay from MKMapView.

- [ ] **Step 4: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/Analytics/SpatialIntelligenceLayer* ios-console/ADLConsole/Screens/Analytics/HeatMapRenderer* ios-console/ADLConsole/Screens/Map/CompanyMapView.swift
git commit -m "feat: spatial intelligence grid and heat map overlay on map"
```

---

### Task 6: Export panel

**Files:**
- Create: `ios-console/ADLConsole/Screens/Analytics/ExportPanelView.swift`
- Create: `ios-console/ADLConsole/Screens/Analytics/ExportService.swift`
- Test: `ios-console/ADLConsoleTests/ExportServiceTests.swift`

- [ ] **Step 1: Write export service tests**

```swift
@Test func csvExport() throws {
    let service = ExportService()
    let records = [ExportRow(id: "r1", name: "Shop A", type: "retail")]
    let csv = try service.csv(records)
    #expect(csv.contains("id,name,type"))
    #expect(csv.contains("r1,Shop A,retail"))
}

@Test func geojsonExport() throws {
    let service = ExportService()
    let features = [ExportFeature(id: "r1", lat: 4.0, lon: 11.0, props: ["name": "Shop A"])]
    let geojson = try service.geoJSON(features)
    #expect(geojson.contains("\"type\": \"FeatureCollection\""))
}
```

- [ ] **Step 2: Implement ExportService**

```swift
final class ExportService: Sendable {
    func csv(_ rows: [ExportRow]) throws -> Data {
        var csv = "id,name,type,latitude,longitude,capturedAt\n"
        for row in rows {
            csv += "\(row.id),\(row.name),\(row.type),\(row.lat),\(row.lon),\(row.capturedAt)\n"
        }
        return Data(csv.utf8)
    }

    func geoJSON(_ features: [ExportFeature]) throws -> Data {
        let fc: [String: Any] = ["type": "FeatureCollection", "features": features.map { $0.dictionary }]
        return try JSONSerialization.data(withJSONObject: fc, options: .prettyPrinted)
    }

    func pdf(_ rows: [ExportRow], title: String) throws -> Data {
        let format = UIGraphicsPDFRendererFormat()
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)
        return renderer.pdfData { ctx in
            ctx.beginPage()
            // Draw title, table header, rows
        }
    }
}
```

- [ ] **Step 3: Implement ExportPanelView**

Modal sheet with format picker (CSV/GeoJSON/PDF), date range filter, and "Share" button that presents `UIActivityViewController`.

- [ ] **Step 4: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/Analytics/ExportPanel* ios-console/ADLConsole/Screens/Analytics/ExportService* ios-console/ADLConsoleTests/
git commit -m "feat: export panel with CSV, GeoJSON, and PDF generation"
```

---

### Task 7: AI analytics assistant

**Files:**
- Create: `ios-console/ADLConsole/Screens/Analytics/AIAnalyticsAssistantView.swift`
- Create: `ios-console/ADLConsole/Screens/Analytics/AIAnalyticsAssistantViewModel.swift`
- Test: `ios-console/ADLConsoleTests/AIAnalyticsAssistantViewModelTests.swift`

- [ ] **Step 1: Write ViewModel test**

```swift
@Test func sendQuery() async throws {
    let repo = MockAnalyticsRepository()
    repo.aiQueryResult = AIQueryResponse(answer: "Collection is up 20% this week.", data: nil, chartSuggestion: nil)
    let vm = AIAnalyticsAssistantViewModel(repository: repo, organizationId: "o1", language: .en)
    await vm.sendQuery("How is collection going?")
    #expect(vm.messages.count == 2) // user query + AI response
    #expect(vm.messages.last?.text == "Collection is up 20% this week.")
}
```

- [ ] **Step 2: Implement AIAnalyticsAssistantViewModel**

```swift
@MainActor
final class AIAnalyticsAssistantViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var inputText: String = ""
    @Published var isProcessing = false

    struct ChatMessage: Identifiable, Equatable {
        let id: String
        let text: String
        let isUser: Bool
    }

    let suggestedPrompts = [
        "How is collection going this week?",
        "Which agents have the best quality?",
        "Show me fraud trends",
    ]

    func sendQuery(_ query: String) async {
        messages.append(ChatMessage(id: UUID().uuidString, text: query, isUser: true))
        isProcessing = true
        do {
            let response = try await repository.aiQuery(organizationId: organizationId, query: query)
            messages.append(ChatMessage(id: UUID().uuidString, text: response.answer, isUser: false))
        } catch {
            messages.append(ChatMessage(id: UUID().uuidString, text: "Sorry, I couldn't process that request.", isUser: false))
        }
        isProcessing = false
        inputText = ""
    }
}
```

- [ ] **Step 3: Implement AIAnalyticsAssistantView**

Chat-style UI with input bar, send button, message bubbles, and suggested prompts chips.

- [ ] **Step 4: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/Analytics/AIAnalyticsAssistant* ios-console/ADLConsoleTests/
git commit -m "feat: AI analytics assistant chat interface"
```

---

### Task 8: Screen routing + role-based access integration

**Files:**
- Modify: `ios-console/ADLConsole/State/AppState.swift`

- [ ] **Step 1: Add ANALYTICS destination and role gating**

Add `case analytics(AnalyticsTab)` to `ConsoleDestination` enum. Map tabs: deltaDashboard, investorDashboard, categoryBreakdown, agentPerformance, export, aiAssistant, spatialIntelligence.

Gate in `visibleDestinations`: owner/manager see all; reviewer sees delta + agent; collector sees only map + AI assistant.

Add factory methods in `AppState`: `makeDeltaDashboardViewModel()`, `makeInvestorDashboardViewModel()`, etc.

- [ ] **Step 2: Build and verify all screens accessible**

Run: `xcodebuild build -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15'`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add ios-console/ADLConsole/State/AppState.swift
git commit -m "feat: add analytics screen routing with role-based access"
```

---

### Task 9: Full regression run

- [ ] **Step 1: Run all iOS tests**
Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -50`
Expected: All tests PASS

- [ ] **Step 2: Run all web tests**
Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Run lint**
Run: `npm run lint`
Expected: Clean
