# ADL Console Analytics & Intelligence Design

**Status:** Draft design

**Tracking:** Sub-project 4 of bug-fixes → intelligent-capture → missions → analytics-intelligence → admin

## Objective

Deliver comprehensive data visibility to reviewers, managers, owners, and investors in the iOS console by adding dashboards, charts, map overlays, export, and an AI analytics assistant. All features consume existing backend APIs — the work is primarily on iOS console screen construction and chart rendering.

## Current State

The iOS console has no analytics or dashboard screens. The web console has `DeltaDashboard.tsx`, `InvestorDashboard.tsx`, admin KPI views, and AI search; the iOS console only shows a basic record list (OVERVIEW/Data Browse). Backend APIs already exist: `api/analytics/index.ts` for snapshot stats, trends, and breakdowns; `api/leaderboard/index.ts` for rankings; `api/ai/search.ts` for natural-language querying.

## Scope

**In scope:**
- Delta Dashboard with snapshot stats, weekly trends, changes/removals tracking
- Investor Dashboard with trust gauge, fraud rate, freshness metrics
- KPI summary bar (weekly active, fraud rate, freshness)
- Weekly trend charts (7+ weeks bar charts)
- Category breakdown (pie charts)
- Agent performance view (submissions, quality, flags)
- Spatial intelligence grid (geohash opportunity overlay on map)
- Anomaly flags on delta items
- Heat map density layer
- Export panel (CSV, GeoJSON, PDF)
- AI analytics assistant (chat UI backed by `api/ai/search.ts`)

**Out of scope:**
- Backend changes to analytics endpoints (use existing)
- Real-time push updates (polling-based refresh is fine)
- Non-analytics admin features (comms, campaigns — separate sub-project)

## Components

### Data Source Architecture

All analytics data flows through a single `AnalyticsRepository` protocol:

```swift
protocol AnalyticsRepositoryProtocol: Sendable {
    func deltaSnapshot(organizationId: String) async throws -> DeltaSnapshot
    func weeklyTrends(organizationId: String, weeks: Int) async throws -> [WeeklyTrend]
    func categoryBreakdown(organizationId: String) async throws -> [CategoryBreakdown]
    func agentPerformance(organizationId: String) async throws -> [AgentPerformance]
    func spatialIntelligence(organizationId: String) async throws -> [GeohashScore]
    func anomalies(organizationId: String, since: Date) async throws -> [AnomalyFlag]
    func heatMapData(organizationId: String, geohashPrecision: Int) async throws -> [HeatMapCell]
    func aiQuery(organizationId: String, query: String) async throws -> AIQueryResponse
}
```

Each method maps to an existing API endpoint. The repository aggregates and caches where appropriate.

### Data Models

```swift
struct DeltaSnapshot: Equatable, Sendable, Codable {
    let totalRecords: Int
    let recordsThisWeek: Int
    let recordsChanged: Int
    let recordsRemoved: Int
    let pendingReview: Int
    let weeklyActiveContributors: Int
    let freshnessScore: Double  // 0-100
}

struct WeeklyTrend: Equatable, Sendable, Codable, Identifiable {
    var id: String { weekEnding }
    let weekEnding: String      // ISO date
    let submissions: Int
    let approvals: Int
    let rejections: Int
    let uniqueContributors: Int
}

struct CategoryBreakdown: Equatable, Sendable, Codable, Identifiable {
    var id: String { category }
    let category: String
    let count: Int
    let percentage: Double
}

struct AgentPerformance: Equatable, Sendable, Codable, Identifiable {
    var id: String { userId }
    let userId: String
    let displayName: String
    let submissions: Int
    let approvalRate: Double
    let flags: Int
    let trustScore: Double
}

struct GeohashScore: Equatable, Sendable, Codable {
    let geohash: String       // 7-char geohash
    let opportunityScore: Double
    let recordCount: Int
    let lastUpdated: String   // ISO date
}

struct AnomalyFlag: Equatable, Sendable, Codable, Identifiable {
    var id: String { "\(recordId)-\(anomalyType)" }
    let recordId: String
    let anomalyType: String   // "price_drop", "rapid_change", "location_shift"
    let severity: String      // "low", "medium", "high"
    let description: String
    let detectedAt: String
}

struct HeatMapCell: Equatable, Sendable, Codable {
    let geohash: String
    let latitude: Double
    let longitude: Double
    let intensity: Double     // 0.0-1.0 normalized density
}
```

### Delta Dashboard

**Screen:** `DeltaDashboardView.swift` — a `List` with sections:
- **KPI bar:** Horizontal row of 4-5 stat cards (total records, this week, changed, removed, pending review) using the existing `ADLStatCard` component style.
- **Trend chart:** `WeeklyTrendChartView` using `Swift Charts` (`Chart { BarMark }`) — 7+ weeks, one bar per week, color-coded by approval/rejection.
- **Changes list:** `DeltaChangeRow` per record — shows field-level diff, old vs new value, timestamps.
- **Anomaly flags:** Inline flag badges on changed records; tapping opens `AnomalyDetailSheet`.

**Chart rendering:** Use iOS 17+ `Swift Charts` framework. Bar charts for weekly trends, `Mark` types with `.foregroundStyle` by status.

### Investor Dashboard

**Screen:** `InvestorDashboardView.swift` — gauge-style metrics:
- **Trust gauge:** Circular gauge (0-100) using `Gauge` with `.gaugeStyle(.accessoryCircularCapacity)`.
- **Fraud rate:** Percentage badge with trend arrow (up/down/flat).
- **Freshness:** Days since most recent update per vertical.
- **Agent trust distribution:** Horizontal bar chart showing trust score distribution (0-20, 21-40, 41-60, 61-80, 81-100 buckets).

### KPI Summary

Reusable `KPIHeaderView` component that can be embedded at the top of any screen. Shows 3-5 metrics in a horizontal `ScrollView` of `ADLStatCard` instances. Auto-refreshes on pull-to-refresh.

### Category Breakdown

**Screen:** `CategoryBreakdownView.swift` — Pie chart using `Swift Charts` with `SectorMark`. Tapping a sector drills into records in that category. Supports both value count and percentage labels.

### Agent Performance

**Screen:** `AgentPerformanceView.swift` — List of agents sorted by submission count or trust score. Each row shows avatar, name, submission count, approval rate bar, flag count. Tapping opens `AgentDetailView` with per-agent weekly trend and recent submissions.

### Spatial Intelligence Grid + Heat Map

**Integration with existing MapKit usage:** Extend `CompanyMapView` with two overlay modes:
- **Opportunity grid:** Render geohash cells as colored polygons on the map. Color intensity = opportunity score. Tap a cell → show score + record count + "Collect here" action.
- **Heat map:** Use `MKOverlay` with a custom heat map renderer. Density = record concentration. Newer records weighted higher.

**Toggle:** Add a `MKMapView` overlay picker (Map/Standard/Hybrid → Grid/Heat/None).

### Export Panel

**Screen:** `ExportPanelView.swift` — Modal sheet with format picker (CSV, GeoJSON, PDF) and date range filter.

- **CSV:** Generate via `Codable` → encode to `Data` with header row + comma-separated values
- **GeoJSON:** Generate `FeatureCollection` JSON with geometry and properties
- **PDF:** `UIGraphicsPDFRenderer` with table layout + logo header + page numbers

Share via `UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)`.

### AI Analytics Assistant

**Screen:** `AIAnalyticsAssistantView.swift` — Chat-style interface with:
- Text input bar + send button
- Message bubbles (user query / AI response with data)
- Suggested prompts: "How is collection going this week?", "Which agents have the best quality?", "Show me fraud trends"
- Backed by `POST /api/ai/search` with `{ organizationId, query, context: "analytics" }`

## Screen Organization

All analytics screens live under a new `Analytics` destination in `ConsoleDestination`:

```
Analytics
├── Delta Dashboard
├── Investor Dashboard
├── Category Breakdown
├── Agent Performance
├── Export
├── AI Assistant
├── [Map overlay controls]
```

Role-gating: owner/manager sees all; reviewer sees Delta + Agent + map; collector sees only map + their own performance.

## Testing Strategy

- **Repository tests:** Mock `PlatformAPIClient`, verify each `AnalyticsRepository` method decodes correctly
- **Chart tests:** Snapshot test each chart view with fixture data
- **Export tests:** Verify CSV/GeoJSON/PDF output format correctness
- **AI assistant:** Test message rendering, suggested prompts, error states (network failure, empty response)
- **Map overlays:** Unit test geohash cell generation and intensity calculation
- **Performance:** Verify chart rendering time < 100ms for 500 data points
- **Accessibility:** VoiceOver on charts (summarize as data table), export actions

## Risk

- Large geohash grids (10,000+ cells) may cause map rendering performance issues — cap cells shown at once or use clustering
- PDF export may truncate long tables — paginate at 40 rows per page
- AI analytics assistant quality depends on backend prompt engineering; UI should handle empty/useless responses gracefully
- Swift Charts' `SectorMark` pie charts may not support all labeling configurations — fall back to horizontal bar for category breakdown if needed
- Heat map requires custom `MKOverlayRenderer` — no existing iOS console pattern for this
