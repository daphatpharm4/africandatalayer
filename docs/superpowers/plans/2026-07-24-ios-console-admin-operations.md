# Admin & Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin tools to the iOS console: communications panel, lead queue, campaign history, rich text email editor, bulk review, quality info, compliance screen, help center, sync error audit trail, and admin scope switching.

**Architecture:** Each feature is an independent screen backed by new PlatformAPIClient methods. Bulk review reuses `POST /api/submissions/batch-review`. The communications panel consumes the existing campaign/template/audience endpoints, which live under **`api/privacy?view=…`** (NOT `/api/email/*` or `/api/sms/*`, which do not exist) — see the corrected **Endpoint correction table** in `docs/superpowers/specs/2026-07-24-ios-console-admin-operations-design.md` for the exact `view` names and methods. Two features (per-campaign recipient drill-down; lead-queue resolve/dismiss decision) may need a small new `api/privacy` `view` — those are the only possible backend additions; everything else is a client wrapper. Admin scope switching extends the existing org picker. Static content screens (quality info, compliance, help center) render bundle-loaded markdown.

> **Endpoints (authoritative — from the corrected spec):** list `GET /api/privacy?view=campaigns|sms-campaigns|email-templates`, create `POST /api/privacy?view=campaigns|sms-campaigns`, cancel `POST /api/privacy?view=campaigns:cancel|sms-campaigns:cancel`, audience preview `GET /api/privacy?view=audience-preview`, lead queue `GET /api/privacy?view=ip-reports`. These are on `api/privacy`, so client methods hit that path directly — `callPlatform` (hard-coded to `api/user?view=platform_*`) cannot serve them; use a credentialed GET/POST against the correct path (same session cookie).
>
> **Commit hygiene:** stage explicit files in every task's commit — do NOT use `git add -A` (it would sweep in unrelated working-tree changes such as `.opencode.json` / xcuserstate).

**Tech Stack:** Swift 6, SwiftUI, PlatformAPIClient, WebKit (rich text editor), MarkdownUI (help center)

## Global Constraints

- All admin screens gated to owner/manager roles (not reviewer/collector)
- Bulk review action bar only appears when >= 2 items selected
- Comms panel requires existing email/SMS backend endpoints
- New screens follow existing `ConsoleDestination` + factory method pattern
- iOS 17+ deployment target

---

### Task 1: Bulk review UI

**Files:**
- Create: `ios-console/ADLConsole/Screens/Review/BulkReviewBar.swift`
- Modify: `ios-console/ADLConsole/Screens/Review/ReviewQueueView.swift`
- Modify: `ios-console/ADLConsole/Screens/Review/ReviewQueueViewModel.swift`
- Test: `ios-console/ADLConsoleTests/BulkReviewTests.swift`

**Interfaces:**
- Consumes: `PlatformAPIClient.batchReview(eventIds:decision:notes:)`
- Produces: Multi-select mode + action bar + batch confirm flow

- [ ] **Step 1: Write API client test for batch review**

```swift
@Test func batchReviewRequest() async throws {
    let client = PlatformAPIClient(transport: MockTransport())
    MockTransport.nextResponse = """
    {"results":[{"eventId":"e1","status":"approved"},{"eventId":"e2","status":"approved"}]}
    """
    let results = try await client.batchReview(eventIds: ["e1", "e2"], decision: "approved", notes: nil)
    #expect(results.count == 2)
    #expect(results[0].status == "approved")
}
```

- [ ] **Step 2: Add batchReview to PlatformAPIClient**

```swift
extension PlatformAPIClient {
    func batchReview(eventIds: [String], decision: String, notes: String?) async throws -> [BatchReviewResult] {
        try await callPlatform(method: "POST", path: "/api/submissions/batch-review", body: [
            "eventIds": eventIds,
            "decision": decision,
            "notes": notes ?? "",
        ])
    }
}
```

- [ ] **Step 3: Implement bulk selection + action bar in ReviewQueueViewModel**

```swift
extension ReviewQueueViewModel {
    @Published var isBulkMode = false
    @Published var selectedIds: Set<String> = []
    @Published var isProcessingBulk = false

    func toggleBulkMode() { isBulkMode.toggle(); selectedIds.removeAll() }
    func toggleSelection(_ id: String) {
        if selectedIds.contains(id) { selectedIds.remove(id) }
        else { selectedIds.insert(id) }
    }
    func approveSelected() async { /* call batchReview */ }
    func rejectSelected() async { /* call batchReview */ }
}
```

- [ ] **Step 4: Implement BulkReviewBar**

```swift
struct BulkReviewBar: View {
    @ObservedObject var vm: ReviewQueueViewModel
    let selectedCount: Int

    var body: some View {
        HStack {
            Text("\(selectedCount) selected").font(.subheadline)
            Spacer()
            Button("Approve") { Task { await vm.approveSelected() } }
                .buttonStyle(.borderedProminent).tint(.adlForestGreen)
            Button("Reject") { Task { await vm.rejectSelected() } }
                .buttonStyle(.borderedProminent).tint(.adlTerracotta)
            Button("Cancel") { vm.toggleBulkMode() }
        }
        .padding()
        .background(.ultraThinMaterial)
    }
}
```

- [ ] **Step 5: Run tests and commit**

```bash
git add ios-console/Packages/ConsoleCore/Sources/ConsoleAPI/PlatformAPIClient.swift ios-console/ADLConsole/Screens/Review/BulkReviewBar.swift ios-console/ADLConsole/Screens/Review/ReviewQueueView.swift ios-console/ADLConsole/Screens/Review/ReviewQueueViewModel.swift ios-console/ADLConsoleTests/
git commit -m "feat: bulk review with multi-select and approve/reject action bar"
```

---

### Task 2: Communications panel

**Files:**
- Create: `ios-console/ADLConsole/Screens/Admin/CommunicationsView.swift`
- Create: `ios-console/ADLConsole/Screens/Admin/CommunicationsViewModel.swift`
- Create: `ios-console/ADLConsole/Screens/Admin/CampaignComposerView.swift`
- Test: `ios-console/ADLConsoleTests/CommunicationsViewModelTests.swift`

- [ ] **Step 1: Write ViewModel test**

```swift
@Test func loadTemplates() async throws {
    let api = MockAPIClient()
    api.commsTemplatesResult = [CommsTemplate(id: "t1", name: "Welcome", subject: "Welcome!", body: "Hello {{name}}", channel: "email")]
    let vm = CommunicationsViewModel(apiClient: api, organizationId: "o1", language: .en)
    await vm.loadTemplates()
    #expect(vm.templates.count == 1)
    #expect(vm.templates[0].name == "Welcome")
}

@Test func sendCampaign() async throws {
    let api = MockAPIClient()
    let vm = CommunicationsViewModel(apiClient: api, organizationId: "o1", language: .en)
    vm.selectedTemplate = CommsTemplate(id: "t1", name: "Test", subject: "Hi", body: "Hello", channel: "email")
    vm.audienceFilter = .allCollectors
    await vm.sendCampaign()
    #expect(vm.sendState == .success)
}
```

- [ ] **Step 2: Implement data models + API methods**

```swift
public struct CommsTemplate: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let subject: String
    public let body: String
    public let channel: String // "email" or "sms"
}

public struct Campaign: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let templateId: String
    public let channel: String
    public let sentCount: Int
    public let failedCount: Int
    public let suppressedCount: Int
    public let sentAt: Date
}

public enum AudienceFilter: String, Codable, Sendable, CaseIterable {
    case allCollectors
    case activeLastWeek
    case inactiveLastMonth
    case byProject
    case byRole
}
```

- [ ] **Step 3: Implement CommunicationsViewModel**

Template list → select → compose with audience picker → schedule/send.

- [ ] **Step 4: Implement CommunicationsView**

List with sections: Templates (horizontal scroll of cards), Recent Campaigns (table with status indicators), FAB to create new campaign.

- [ ] **Step 5: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/Admin/Communications* ios-console/ADLConsoleTests/
git commit -m "feat: communications panel with template selection, audience filtering, and campaign send"
```

---

### Task 3: Campaign history

**Files:**
- Create: `ios-console/ADLConsole/Screens/Admin/CampaignHistoryView.swift`
- Test: `ios-console/ADLConsoleTests/CampaignHistoryViewModelTests.swift`

- [ ] **Step 1: Implement CampaignHistoryView**

```swift
struct CampaignHistoryView: View {
    @StateObject private var vm: CampaignHistoryViewModel

    var body: some View {
        List(vm.campaigns) { campaign in
            VStack(alignment: .leading) {
                Text(campaign.templateName).font(.headline)
                HStack {
                    Label("\(campaign.sentCount) sent", systemImage: "checkmark.circle").foregroundColor(.adlForestGreen).font(.caption)
                    Label("\(campaign.failedCount) failed", systemImage: "xmark.circle").foregroundColor(.adlTerracotta).font(.caption)
                    Label("\(campaign.suppressedCount) suppressed", systemImage: "slash.circle").foregroundColor(.secondary).font(.caption)
                }
                Text(campaign.sentAt, style: .date).font(.caption2).foregroundColor(.secondary)
            }
            .padding(.vertical, 4)
        }
        .navigationTitle("Campaign History")
        .task { await vm.load() }
    }
}
```

- [ ] **Step 2: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/Admin/CampaignHistory* ios-console/ADLConsoleTests/
git commit -m "feat: campaign history with sent/failed/suppressed breakdown"
```

---

### Task 4: Rich text email editor

**Files:**
- Create: `ios-console/ADLConsole/Screens/Admin/RichTextEditorView.swift`
- Test: `ios-console/ADLConsoleTests/RichTextEditorTests.swift`

- [ ] **Step 1: Implement RichTextEditorView**

```swift
struct RichTextEditorView: UIViewRepresentable {
    @Binding var text: NSAttributedString
    @Binding var isEditing: Bool

    func makeUIView(context: Context) -> UITextView {
        let tv = UITextView()
        tv.isEditable = true
        tv.isSelectable = true
        tv.allowsEditingTextAttributes = true
        tv.font = .preferredFont(forTextStyle: .body)
        tv.delegate = context.coordinator
        return tv
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        uiView.attributedText = text
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, UITextViewDelegate {
        var parent: RichTextEditorView
        init(_ parent: RichTextEditorView) { self.parent = parent }
        func textViewDidChange(_ tv: UITextView) {
            parent.text = tv.attributedText
        }
    }
}
```

Add toolbar with bold/italic/underline/heading buttons. Use `UITextView`'s built-in text attributes.

- [ ] **Step 2: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/Admin/RichTextEditor* ios-console/ADLConsoleTests/
git commit -m "feat: rich text email editor with attributed text support"
```

---

### Task 5: Sync error audit trail

**Files:**
- Create: `ios-console/ADLConsole/Screens/PendingWork/SyncErrorAuditView.swift`
- Modify: `ios-console/ADLConsole/Screens/PendingWork/PendingWorkViewModel.swift`
- Test: `ios-console/ADLConsoleTests/SyncErrorAuditTests.swift`

- [ ] **Step 1: Add sync error query to RecordLedger protocol**

```swift
protocol RecordLedgerProtocol: Sendable {
    // ... existing methods
    func errorHistory(ownerUserID: String, organizationID: String, limit: Int) async throws -> [LedgerRecord]
}
```

- [ ] **Step 2: Implement SyncErrorAuditView**

```swift
struct SyncErrorAuditView: View {
    @StateObject private var vm: PendingWorkViewModel
    @State private var showErrorDetail: LedgerRecord?

    var body: some View {
        List(vm.errorRecords) { record in
            Button {
                showErrorDetail = record
            } label: {
                VStack(alignment: .leading) {
                    Text(record.recordTypeKey).font(.headline)
                    Text(record.lastErrorSafeMessage ?? "Unknown error").font(.caption).foregroundColor(.adlTerracotta)
                    Text(record.updatedAt, style: .relative).font(.caption2).foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle("Sync Errors")
        .sheet(item: $showErrorDetail) { record in
            SyncErrorDetailSheet(record: record)
        }
        .task { await vm.loadErrorHistory() }
    }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/PendingWork/SyncErrorAudit* ios-console/ADLConsoleTests/
git commit -m "feat: sync error audit trail with detail sheet"
```

---

### Task 6: Lead queue management

**Files:**
- Create: `ios-console/ADLConsole/Screens/Review/LeadQueueView.swift`
- Create: `ios-console/ADLConsole/Screens/Review/LeadQueueViewModel.swift`

- [ ] **Step 1: Implement LeadQueueViewModel**

Loads IP/privacy report leads from existing API endpoint. Supports filter by status (new, triaged, resolved), sort by date, and resolve action.

- [ ] **Step 2: Implement LeadQueueView**

Table with status badge, reporter info, reason column, date. Tap opens detail with notes field and resolve button.

- [ ] **Step 3: Run tests and commit**

```bash
git add ios-console/ADLConsole/Screens/Review/LeadQueue* ios-console/ADLConsoleTests/
git commit -m "feat: lead queue management for IP/privacy report triage"
```

---

### Task 7: Static content screens (quality info, compliance, help center)

**Files:**
- Create: `ios-console/ADLConsole/Screens/Info/QualityInfoView.swift`
- Create: `ios-console/ADLConsole/Screens/Info/DataComplianceView.swift`
- Create: `ios-console/ADLConsole/Screens/Info/HelpCenterView.swift`
- Create: `ios-console/ADLConsole/Screens/Info/HelpArticleView.swift`

- [ ] **Step 1: Implement QualityInfoView**

```swift
struct QualityInfoView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Data Quality Methodology").font(.title.bold())
                Text("African Data Layer uses a multi-factor quality scoring system...")
                // Full methodology content
            }
            .padding()
        }
        .navigationTitle("Quality Info")
    }
}
```

- [ ] **Step 2: Implement DataComplianceView**

GDPR/CCPA compliance description, data retention policy, right to deletion instructions, contact info.

- [ ] **Step 3: Implement HelpCenterView**

```swift
struct HelpCenterView: View {
    let articles: [HelpArticle] = [
        HelpArticle(id: "1", title: "Getting Started", summary: "How to use the ADL Console"),
        HelpArticle(id: "2", title: "Capturing Data", summary: "Field capture workflow guide"),
        HelpArticle(id: "3", title: "Review Queue", summary: "How to review submissions"),
        // ... more articles
    ]
    @State private var searchText = ""

    var body: some View {
        List {
            ForEach(articles.filter { searchText.isEmpty || $0.title.localizedCaseInsensitiveContains(searchText) }) { article in
                NavigationLink(article.title, value: article)
            }
        }
        .searchable(text: $searchText)
        .navigationTitle("Help Center")
    }
}
```

Articles rendered as markdown from bundled JSON or static strings.

- [ ] **Step 4: Commit**

```bash
git add ios-console/ADLConsole/Screens/Info/
git commit -m "feat: quality info, data compliance, and help center screens"
```

---

### Task 8: Admin global scope switching

**Files:**
- Modify: `ios-console/ADLConsole/State/AppState.swift`
- Modify: `ios-console/ADLConsole/Screens/Home/ConsoleShellView.swift`

- [ ] **Step 1: Extend org picker for admin scope switching**

In `ConsoleShellView`, add an org switcher that calls `AppState.selectOrganization(organizationId:)` without requiring re-auth. Already partially implemented — ensure `syncEngines` cleanup happens (from M4 fix) and that `organization` + `role` are recomputed correctly.

- [ ] **Step 2: Add super-admin badge**

If `AppState.isAdlAdmin == true`, show a badge on the org picker and allow switching between any accessible org.

- [ ] **Step 3: Build and verify**

Run: `xcodebuild build -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15'`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add ios-console/ADLConsole/State/AppState.swift ios-console/ADLConsole/Screens/Home/ConsoleShellView.swift
git commit -m "feat: admin global scope switching without re-authentication"
```

---

### Task 9: Screen routing + role-based access

**Files:**
- Modify: `ios-console/ADLConsole/State/AppState.swift`

- [ ] **Step 1: Add admin destinations**

Add `case admin(AdminTab)` to `ConsoleDestination` enum with sub-tabs: communications, campaignHistory, leadQueue, qualityInfo, dataCompliance, helpCenter, syncErrors.

Gate in `visibleDestinations`: only owner/manager can see admin section.

Add factory methods: `makeCommunicationsViewModel()`, `makeCampaignHistoryViewModel()`, `makeLeadQueueViewModel()`, etc.

- [ ] **Step 2: Build and verify**

Run: `xcodebuild build -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15'`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add ios-console/ADLConsole/State/AppState.swift
git commit -m "feat: add admin screen routing with owner/manager role gates"
```

---

### Task 10: Full regression run

- [ ] **Step 1: Run all iOS tests**
Run: `xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -50`
Expected: All tests PASS

- [ ] **Step 2: Run all web tests**
Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Run lint**
Run: `npm run lint`
Expected: Clean
