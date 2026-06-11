# iOS Native Admin & Client Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 8 admin-login issues and close the client Delta-dashboard parity gap in the **native SwiftUI iOS app** so it mirrors the web app.

**Architecture:** The iOS app is a fully native SwiftUI app (`ios/App/App/Native/`) talking to the same Vercel serverless API as the web app. The server side is already healthy (admin provisioning, assignment error classification, and profile-image inline fallback merged to `main` via PR #39). Remaining work is almost entirely Swift: data-load diagnosis surfacing, view keep-alive for the map, layout stabilization, and new client-analytics models + UI. One task uses Vercel runtime logs to pin down the production assignments failure.

**Tech Stack:** SwiftUI (iOS 17+), MapKit, `URLSession` (`ADLAPIClient`), Vercel serverless (`api/`), `node --test` for any server change. No Swift test target exists — Swift verification is `xcodebuild build` + on-device checks recorded per-ticket in beads.

**Key files:**

| File | Responsibility | Tasks |
|------|----------------|-------|
| `ios/App/App/Native/ADLViews.swift` | All SwiftUI screens (10k lines): `AdminReviewView` (4217), `ProfileView` (7909), `ClientDashboardView` (6354), `AgentHomeView` (1276), `FieldMapKitView` (1453), `FieldMapHeader` (1654), `AppShellView` (1107), UIImage helpers (10023) | 2–9 |
| `ios/App/App/Native/ADLServices.swift` | `AppState` loaders + `ADLAPIClient` endpoints | 2, 6, 8 |
| `ios/App/App/Native/ADLModels.swift` | Decodable models (lenient `decodeIfPresent` style) | 8 |
| `api/` + `lib/server/` | Already fixed — diagnosis only | 1 |

**Verification commands (every Swift task):**

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```
Expected: `** BUILD SUCCEEDED **`. Web-side gate (only when `api/`, `lib/`, `components/`, `shared/` change): `npm run test:ci`.

**Beads workflow:** Task 0 creates one epic + one ticket per task. Claim with `bd update <id> --claim` at task start, `bd close <id>` at end, commit per task.

---

## Task 0: Create beads tickets

- [ ] **Step 1: Create the epic and tickets**

```bash
bd create --title="iOS native admin/client parity epic" --type=feature --priority=1 \
  --description="Mirror web admin cockpit + client delta dashboard in native SwiftUI app. Covers assignments load failure, weekly assignments, map keep-alive, cockpit dropdown stability, account access history, worldwide map jump, profile photo verification, client delta parity (models+UI+analyst)."
# Then one ticket per Task 1..9 below, e.g.:
bd create --title="Diagnose+surface native assignments load failure" --type=bug --priority=1 --description="Native cockpit Assignments tab shows 'Impossible de charger les affectations'. Server now returns classified codes; surface code in native error card + retry; check Vercel runtime logs for root cause (likely missing collection_assignments migration in prod)."
bd create --title="Weekly assignments section in native cockpit + profile" --type=bug --priority=2 --description="Weekly assignment list not visible. Render current-week grouping once assignments load (depends on assignments fix)."
bd create --title="Native map keep-alive + tile cache" --type=bug --priority=1 --description="MKMapView recreated on every tab switch (AppShellView.screen(for:) rebuilds AgentHomeView). Cache map view + cache CARTO tiles via URLCache."
bd create --title="Stabilize cockpit mode dropdown" --type=bug --priority=2 --description="Admin cockpit Menu selector visually unstable when switching modes. Pin layout, kill implicit animations."
bd create --title="Account Access: show looked-up account contribution history" --type=feature --priority=2 --description="Admin lookup shows only role/scope. Fetch + render that account's events via /api/submissions?view=events&userId=. Also harden admin section gating."
bd create --title="Admin worldwide map region jump" --type=feature --priority=2 --description="Admin map already fetches scope=global; add region jump menu (Bonamoussadi/Douala/Yaoundé/Cameroon/World) so admin can actually navigate beyond Bonamoussadi quickly."
bd create --title="Verify profile photo upload after server fix; clamp payload <=700KB" --type=bug --priority=2 --description="500 was opaque blob failure; server now classifies + stores <=800KB inline when blob unavailable. Clamp native JPEG to 700KB so the inline fallback always applies."
bd create --title="Client delta parity: Swift models + API client" --type=feature --priority=1 --description="Add SnapshotStatRow/DeltaRow/AnomalyRow/TrendPoint/SpatialIntelligence models + ADLAPIClient methods for analytics views snapshots/deltas/trends/anomalies/spatial_intelligence + analytics-query AI."
bd create --title="Client delta parity: ClientDashboardView UI" --type=feature --priority=1 --description="Vertical selector, by-vertical current week, delta breakdown stacked bars, recent deltas list, spatial intelligence section, AI analyst card — mirroring DeltaDashboard.tsx."
```

- [ ] **Step 2: Wire dependencies**

```bash
# weekly-assignments depends on assignments-load fix; client UI depends on models task
bd dep add <weekly-ticket> <assignments-ticket>
bd dep add <client-ui-ticket> <client-models-ticket>
```

---

## Task 1: Diagnose the production assignments failure (ticket: assignments-load)

The native cockpit calls `GET /api/user?view=assignment_planner_context` (`ios/App/App/Native/ADLServices.swift:1085-1090`). The server (post-merge) logs `[api/user] assignment_planner_context view failed` and returns a classified body `{ code: "assignments_failed" | "storage_unavailable" }` (`api/user/index.ts:362-383`). The device shows the fallback French string when the server message is absent — so first find the real server error.

**Files:**
- Modify: `ios/App/App/Native/ADLServices.swift` (`loadAssignments`, ~535-549)
- Modify: `ios/App/App/Native/ADLViews.swift` (`assignmentsCockpitContent` error card, ~4630-4642)
- Possibly run: SQL migration in Supabase (diagnosis-dependent)

- [ ] **Step 1: Pull production runtime logs**

Use the Vercel MCP tool `get_runtime_logs` for the production project (or CLI fallback):

```bash
npx vercel logs www.app.africandatalayer.com --since 2h 2>&1 | grep -i "assignment"
```

Expected outcomes and the action each dictates:
- `relation "collection_assignments" does not exist` → run the collection-workflow migration (Step 2).
- `storage unavailable` / connection errors → Supabase connectivity/env issue; check `POSTGRES_URL` in Vercel envs.
- No log lines at all → the device build predates PR #39's API base or auth fails; capture the device console instead.

Record the finding in `bd update <assignments-ticket> --notes`.

- [ ] **Step 2 (conditional): Apply the missing migration**

```bash
grep -rln "collection_assignments" supabase/
```

If the table is missing in prod, run the matching `supabase/...collection...sql` file's contents in the Supabase SQL editor (or `psql "$POSTGRES_URL" -f <file>`). Verify:

```sql
select count(*) from collection_assignments;
```

- [ ] **Step 3: Surface the server error code natively + add Retry**

In `ios/App/App/Native/ADLServices.swift:535-549`, `loadAssignments` already shows `(error as? APIError)?.message`. Keep that, but stop caching an empty success: add a `assignmentsLoadedAt` guard is NOT needed — the existing `if !assignments.isEmpty, !force { return }` already refetches after failure. No change needed here.

In `ios/App/App/Native/ADLViews.swift` `assignmentsCockpitContent`, inside the error `ADLCard` (the branch `else if let err = appState.assignmentsError, appState.assignments.isEmpty`), append a retry button after the error `Text`:

```swift
                            Button {
                                Task { await appState.loadAssignments(force: true) }
                            } label: {
                                Text(appState.t("Retry", "Réessayer"))
                                    .font(ADLFont.inter(12, .bold))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 40)
                                    .foregroundColor(.white)
                                    .background(ADLColor.navy)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .padding(.top, 6)
```

- [ ] **Step 4: Build**

Run the `xcodebuild` command from the header. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add ios/App/App/Native/ADLViews.swift ios/App/App/Native/ADLServices.swift
git commit -m "fix(ios): retry button + diagnosis notes for assignments load failure"
```

- [ ] **Step 6: Device verification note**

`bd update <assignments-ticket> --notes`: "Open cockpit → Affectations. Expect either assignments render, or a *specific* server message (storage_unavailable vs assignments_failed) + Retry. Cross-check Vercel logs finding from Step 1."

---

## Task 2: Weekly assignments grouping (ticket: weekly-assignments) — depends on Task 1

Once assignments load, mirror the web's week framing: a "This week" section listing assignments whose `dueDate` falls inside the current ISO week, the rest under "Later / Overdue".

**Files:**
- Modify: `ios/App/App/Native/ADLViews.swift` (`assignmentsCockpitContent`, ~4613-4666)

- [ ] **Step 1: Add week-bucketing helpers inside `AdminReviewView`**

Add below `private func trustTier(for:)` (~4283):

```swift
    private static let assignmentDayFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private func assignmentDueDate(_ a: CollectionAssignment) -> Date? {
        if let d = Self.assignmentDayFormatter.date(from: a.dueDate) { return d }
        // dueDate may be plain YYYY-MM-DD
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = TimeZone(identifier: "UTC")
        return df.date(from: String(a.dueDate.prefix(10)))
    }

    private var thisWeekAssignments: [CollectionAssignment] {
        let cal = Calendar(identifier: .iso8601)
        return appState.assignments.filter { a in
            guard let due = assignmentDueDate(a) else { return false }
            return cal.isDate(due, equalTo: Date(), toGranularity: .weekOfYear)
        }
    }

    private var otherAssignments: [CollectionAssignment] {
        let thisWeekIds = Set(thisWeekAssignments.map(\.id))
        return appState.assignments.filter { !thisWeekIds.contains($0.id) }
    }
```

- [ ] **Step 2: Replace the flat list with grouped sections**

In `assignmentsCockpitContent`, replace the final `else` branch (the `VStack(spacing: 10) { ForEach(appState.assignments) ... }` block) with:

```swift
                } else {
                    if !thisWeekAssignments.isEmpty {
                        SectionLabel(text: appState.t("This week", "Cette semaine"), wide: true)
                            .padding(.horizontal, 16)
                        VStack(spacing: 10) {
                            ForEach(thisWeekAssignments) { assignment in
                                AssignmentCard(assignment: assignment, context: appState.assignmentsContext)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    if !otherAssignments.isEmpty {
                        SectionLabel(text: appState.t("Later & overdue", "À venir & en retard"), wide: true)
                            .padding(.horizontal, 16)
                            .padding(.top, 4)
                        VStack(spacing: 10) {
                            ForEach(otherAssignments) { assignment in
                                AssignmentCard(assignment: assignment, context: appState.assignmentsContext)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
```

- [ ] **Step 3: Build** — `xcodebuild` command from header. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add ios/App/App/Native/ADLViews.swift
git commit -m "feat(ios): group cockpit assignments into this-week vs later sections"
```

- [ ] **Step 5: Device note** — `bd update <weekly-ticket> --notes`: "Create an assignment due this week → appears under 'This week' in cockpit Affectations."

---

## Task 3: Map keep-alive + tile cache (ticket: map-keep-alive)

Root cause confirmed: `AppShellView.screen(for:)` (`ADLViews.swift:1148-1162`) rebuilds the selected screen on every tab change, so `FieldMapKitView.makeUIView` (`:1460`) creates a fresh `MKMapView` and re-downloads CARTO tiles. Fix in two layers: reuse one `MKMapView` instance per session, and cache tile HTTP responses.

**Files:**
- Modify: `ios/App/App/Native/ADLViews.swift` (`FieldMapKitView`, 1453-1573)
- Modify: `ios/App/App/Native/ADLNativeApp.swift` (URLCache bump)

- [ ] **Step 1: Add a cached tile overlay + shared map holder**

Insert immediately above `struct FieldMapKitView` (line 1453):

```swift
/// Tile overlay that routes through URLCache so CARTO tiles survive map teardowns
/// and short offline windows (field-first: no re-download on every visit).
final class CachedTileOverlay: MKTileOverlay {
    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.requestCachePolicy = .returnCacheDataElseLoad
        cfg.urlCache = URLCache.shared
        return URLSession(configuration: cfg)
    }()

    override func loadTile(at path: MKTileOverlayPath, result: @escaping (Data?, Error?) -> Void) {
        let request = URLRequest(url: url(forTilePath: path),
                                 cachePolicy: .returnCacheDataElseLoad,
                                 timeoutInterval: 20)
        session.dataTask(with: request) { data, _, error in
            result(data, error)
        }.resume()
    }
}

/// Session-scoped holder so the MKMapView (and its loaded tiles/annotations)
/// survives SwiftUI recreating FieldMapKitView on tab switches.
@MainActor
final class FieldMapHolder {
    static let shared = FieldMapHolder()
    var mapView: MKMapView?
}
```

- [ ] **Step 2: Reuse the held map view in `makeUIView`**

Replace the body of `func makeUIView(context:)` in `FieldMapKitView` with:

```swift
    func makeUIView(context: Context) -> MKMapView {
        if let cached = FieldMapHolder.shared.mapView {
            cached.delegate = context.coordinator
            return cached
        }

        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.mapType = .standard
        mapView.pointOfInterestFilter = .excludingAll
        mapView.showsCompass = true
        mapView.showsScale = true
        mapView.showsUserLocation = true
        mapView.setRegion(region, animated: false)

        // CARTO light_all basemap — matches web Home map tile layer
        let cartoTiles = CachedTileOverlay(
            urlTemplate: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
        )
        cartoTiles.canReplaceMapContent = true
        mapView.addOverlay(cartoTiles, level: .aboveLabels)

        FieldMapHolder.shared.mapView = mapView
        return mapView
    }
```

> Note: `updateUIView` already diffs annotations by id and syncs `region` only when materially different (`isClose(to:)`), so reuse is safe — no annotation duplication, no region snap-back. The delegate is re-pointed at the fresh Coordinator on each make.

- [ ] **Step 3: Bump the shared URL cache at app start**

In `ios/App/App/Native/ADLNativeApp.swift` (16 lines), add an `init` to the `App` struct:

```swift
    init() {
        // Tile + API response cache: 32MB memory / 256MB disk. CARTO tiles are
        // immutable per z/x/y so returnCacheDataElseLoad keeps the field map warm.
        URLCache.shared = URLCache(memoryCapacity: 32 * 1024 * 1024,
                                   diskCapacity: 256 * 1024 * 1024)
    }
```

- [ ] **Step 4: Build** — `xcodebuild` command from header. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add ios/App/App/Native/ADLViews.swift ios/App/App/Native/ADLNativeApp.swift
git commit -m "fix(ios): keep MKMapView alive across tab switches and cache map tiles"
```

- [ ] **Step 6: Device note** — `bd update <map-ticket> --notes`: "Home → Profile → Home repeatedly: map must not flash white or re-download tiles; position preserved. Airplane-mode revisit should still show previously seen tiles."

---

## Task 4: Stabilize the cockpit mode dropdown (ticket: cockpit-dropdown)

The dropdown exists (`adminModeTabs`, `ADLViews.swift:4318-4360` — a `Menu` with a 58pt label card). The reported wobble = implicit animation when `activeMode` changes re-lays-out the label text (variable width) and the SwiftUI `Menu` press effect. Pin it.

**Files:**
- Modify: `ios/App/App/Native/ADLViews.swift` (`adminModeTabs`)

- [ ] **Step 1: Pin label geometry and disable mode-change animation**

In `adminModeTabs`, on the label `HStack(spacing: 10) { ... }` (the one ending `.frame(height: 58)`), make these changes:

1. Give the title `Text(activeMode.title(appState.language))` a stable single-line treatment:

```swift
                        Text(activeMode.title(appState.language))
                            .font(ADLFont.inter(15, .bold))
                            .foregroundColor(ADLColor.ink)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
```

2. After `.frame(height: 58)` add:

```swift
                .frame(maxWidth: .infinity)
                .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
```

3. On the outer `Menu { ... } label: { ... }` chain, after `.buttonStyle(.plain)` add:

```swift
            .animation(nil, value: activeMode)
            .transaction { $0.animation = nil }
```

- [ ] **Step 2: Build** — `xcodebuild`. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Commit**

```bash
git add ios/App/App/Native/ADLViews.swift
git commit -m "fix(ios): pin cockpit mode dropdown layout, no wobble on mode switch"
```

- [ ] **Step 4: Device note** — `bd update <cockpit-ticket> --notes`: "Switch all 5 cockpit modes repeatedly: selector card must not resize, jump, or animate its frame. Filters (risk + agent) and 'Approuver en lot' confirmed working in Review mode."

---

## Task 5: Account Access — gating hardening + looked-up account history (tickets: account-history)

Covers user issues 3 and 6. The Account Access card already exists (`ProfileView`, `ADLViews.swift:8605-8720`) and is gated by `appState.selectedRole == .admin` (`:7970-7973`). Two gaps:
(a) if `loadProfile` fails, `selectedRole` never becomes `.admin` and the section silently vanishes — show the load error;
(b) lookup shows only role/scope (`:8699`) — the admin can't see the account's contributions (server supports it: `GET /api/submissions?view=events&userId=<id>` allows admins to query any user, `api/submissions/index.ts:654-662`).

**Files:**
- Modify: `ios/App/App/Native/ADLViews.swift` (`ProfileView` gating ~7970, lookup handler ~8843-8860, lookup result card ~8690-8710)

- [ ] **Step 1: Robust gating + visible profile error**

At `ADLViews.swift:7970`, replace:

```swift
                            if appState.selectedRole == .admin {
                                adminMapAccessCard
                                adminAccountAccessCard
                            }
```

with:

```swift
                            if appState.selectedRole == .admin || appState.userProfile?.isAdmin == true {
                                adminMapAccessCard
                                adminAccountAccessCard
                            } else if let profileError = appState.profileError {
                                ADLCard {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(appState.t("Profile not fully loaded", "Profil partiellement chargé"))
                                            .font(ADLFont.inter(13, .semibold))
                                            .foregroundColor(ADLColor.ink)
                                        Text(profileError)
                                            .font(ADLFont.inter(12))
                                            .foregroundColor(ADLColor.terracotta)
                                        Button {
                                            Task { await appState.loadProfile(force: true) }
                                        } label: {
                                            Text(appState.t("Retry", "Réessayer"))
                                                .font(ADLFont.inter(12, .bold))
                                                .foregroundColor(ADLColor.navy)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
```

> `profileError` already exists on `AppState` (`ADLServices.swift:178`). If it is `private`, remove `private`.

- [ ] **Step 2: Fetch the looked-up account's history**

In the `ProfileView` state declarations near the other account-access `@State` vars (search `managedAccount` / the var set at `:8851`), add:

```swift
    @State private var lookupHistory: [UserContributionEvent] = []
    @State private var lookupHistoryError: String?
```

In the lookup success path (`:8851`, right after `let account = try await appState.apiClient.lookupAdminAccount(identifier: identifier)` and the assignment that stores it), add:

```swift
                lookupHistory = []
                lookupHistoryError = nil
                do {
                    lookupHistory = try await appState.apiClient
                        .fetchContributionEvents(scope: "global", userId: account.id)
                        .sorted { $0.createdDate > $1.createdDate }
                } catch {
                    lookupHistoryError = (error as? APIError)?.message
                        ?? appState.t("Unable to load this account's contributions.",
                                      "Impossible de charger les contributions de ce compte.")
                }
```

> `account.id` is non-optional `String?` on `UserProfile` (`ADLModels.swift:751+`) — if optional, use `account.id ?? identifier`.

- [ ] **Step 3: Render the history in the lookup result card**

In the lookup result section (where `Current access` is rendered, `:8699`), append below the role/scope text:

```swift
                        Divider().background(ADLColor.line).padding(.vertical, 6)
                        SectionLabel(text: appState.t("Recent contributions", "Contributions récentes"), wide: true)
                        if let err = lookupHistoryError {
                            Text(err)
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.terracotta)
                        } else if lookupHistory.isEmpty {
                            Text(appState.t("No contributions for this account.", "Aucune contribution pour ce compte."))
                                .font(ADLFont.inter(12))
                                .foregroundColor(ADLColor.inkMuted)
                        } else {
                            ForEach(lookupHistory.prefix(5)) { event in
                                HStack(spacing: 10) {
                                    Image(systemName: event.eventType == "ENRICH_EVENT" ? "plus.magnifyingglass" : "mappin.and.ellipse")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(ADLColor.navy)
                                        .frame(width: 30, height: 30)
                                        .background(ADLColor.navyWash)
                                        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(event.displayTitle)
                                            .font(ADLFont.inter(12, .bold))
                                            .foregroundColor(ADLColor.ink)
                                            .lineLimit(1)
                                        Text(event.createdDate.formatted(date: .abbreviated, time: .omitted))
                                            .font(ADLFont.inter(11))
                                            .foregroundColor(ADLColor.inkMuted)
                                    }
                                    Spacer()
                                }
                            }
                        }
```

- [ ] **Step 4: Build** — `xcodebuild`. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add ios/App/App/Native/ADLViews.swift
git commit -m "feat(ios): account-access lookup shows contribution history; harden admin gating"
```

- [ ] **Step 6: Device note** — `bd update <account-ticket> --notes`: "Profile → Account Access → load a known contributor by email → recent contributions list renders. If admin sections were missing entirely, the new error card now says why (profile load failure)."

---

## Task 6: Admin worldwide region jump (ticket: worldwide-jump)

Data side is already global for admins (`activePointScope()` returns `"global"`, `ADLServices.swift:741-746`; commit `0b3e3f7` centers the admin map after profile load). What's missing is *navigation*: panning from Bonamoussadi to another country by hand is impractical. Add a region-jump menu in the map header, admin-only.

**Files:**
- Modify: `ios/App/App/Native/ADLViews.swift` (`AgentHomeView` ~1276-1452, `FieldMapHeader` 1654-1721)

- [ ] **Step 1: Add jump presets + callback to `FieldMapHeader`**

`FieldMapHeader` already receives admin context (it renders "Worldwide admin map" at `:1666-1672`). Add to its properties:

```swift
    var onJumpToRegion: ((MKCoordinateRegion) -> Void)? = nil
```

Add inside its body, trailing the existing header content (visible only when the admin label branch is active — same condition as line 1666, `appState.selectedRole == .admin`):

```swift
            if appState.selectedRole == .admin, let onJumpToRegion {
                Menu {
                    Button("Bonamoussadi") {
                        onJumpToRegion(MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: 4.0911, longitude: 9.7375),
                            span: MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.03)))
                    }
                    Button("Douala") {
                        onJumpToRegion(MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: 4.05, longitude: 9.70),
                            span: MKCoordinateSpan(latitudeDelta: 0.25, longitudeDelta: 0.25)))
                    }
                    Button("Yaoundé") {
                        onJumpToRegion(MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: 3.87, longitude: 11.52),
                            span: MKCoordinateSpan(latitudeDelta: 0.25, longitudeDelta: 0.25)))
                    }
                    Button(appState.t("Cameroon", "Cameroun")) {
                        onJumpToRegion(MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: 5.7, longitude: 12.3),
                            span: MKCoordinateSpan(latitudeDelta: 9, longitudeDelta: 9)))
                    }
                    Button(appState.t("World", "Monde")) {
                        onJumpToRegion(MKCoordinateRegion(
                            center: CLLocationCoordinate2D(latitude: 20, longitude: 0),
                            span: MKCoordinateSpan(latitudeDelta: 120, longitudeDelta: 120)))
                    }
                } label: {
                    Image(systemName: "globe.europe.africa.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(ADLColor.navy)
                        .frame(width: 40, height: 40)
                        .background(ADLColor.navyWash)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(appState.t("Jump to region", "Aller à une région"))
            }
```

- [ ] **Step 2: Wire it in `AgentHomeView`**

`AgentHomeView` owns `@State var region: MKCoordinateRegion` (bound into `FieldMapKitView`). At its `FieldMapHeader(...)` call site, pass:

```swift
                onJumpToRegion: { newRegion in
                    withAnimation { region = newRegion }
                    trackingMode = .none
                }
```

> Adapt the binding names to the exact `@State` property names found at the call site (`region` / `trackingMode` per `FieldMapKitView`'s bindings at `:1456-1457`).

- [ ] **Step 3: Build** — `xcodebuild`. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add ios/App/App/Native/ADLViews.swift
git commit -m "feat(ios): admin region jump menu on field map (city/country/world)"
```

- [ ] **Step 5: Device note** — `bd update <worldwide-ticket> --notes`: "As admin, map header globe menu → World: map pans out, points load (scope=global already in effect). Agents must NOT see the menu."

---

## Task 7: Profile photo — clamp payload and verify against merged server fix (ticket: photo-upload)

Server (merged): blob failures classify to 502/503, and when blob is unavailable the image is stored inline if ≤ 800,000 bytes (`api/user/index.ts:511-519`, `MAX_INLINE_PROFILE_IMAGE_BYTES`). Native already downsizes to 768px/0.68 JPEG (`ADLViews.swift:10023-10040`) — usually ~150-400KB, but a detailed photo can exceed 800KB and then the inline fallback never applies. Clamp to ≤ 700KB with a compression loop.

**Files:**
- Modify: `ios/App/App/Native/ADLViews.swift` (UIImage extension, 10023-10040)

- [ ] **Step 1: Replace `adlProfileImageDataURL` with a size-bounded loop**

```swift
    /// Server stores the image inline when blob storage is down only if the decoded
    /// payload is <= 800_000 bytes (api/user MAX_INLINE_PROFILE_IMAGE_BYTES). Clamp
    /// to 700KB so that fallback always applies.
    func adlProfileImageDataURL(maxBytes: Int = 700_000) -> String? {
        var dimension: CGFloat = 768
        var quality: CGFloat = 0.68
        for _ in 0..<4 {
            let scaled = adlScaledProfileImage(maxDimension: dimension)
            if let data = scaled.jpegData(compressionQuality: quality), data.count <= maxBytes {
                return "data:image/jpeg;base64,\(data.base64EncodedString())"
            }
            dimension *= 0.75
            quality = max(0.5, quality - 0.08)
        }
        return nil
    }
```

(Keep `adlScaledProfileImage` unchanged. The existing call site at `:9245` already treats `nil` as a user-facing prepare error.)

- [ ] **Step 2: Build** — `xcodebuild`. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Commit**

```bash
git add ios/App/App/Native/ADLViews.swift
git commit -m "fix(ios): clamp profile photo payload to 700KB for server inline fallback"
```

- [ ] **Step 4: Device note** — `bd update <photo-ticket> --notes`: "Upload a photo on device. Success expected even if Vercel Blob is unconfigured (inline fallback). If a clear French/English error shows instead of saving: 'Photo storage is not configured' ⇒ set BLOB_READ_WRITE_TOKEN in Vercel envs; 'Could not upload the photo' ⇒ capture Vercel runtime logs for /api/user PUT."

---

## Task 8: Client delta parity — models + API client (ticket: client-models)

Mirror the web data layer (`components/Screens/DeltaDashboard.tsx:150-205`): snapshots, anomalies, per-vertical trends/deltas/spatial-intelligence, and the AI analyst. Postgres `numeric` columns can arrive as JSON strings — decode defensively like the existing models do.

**Files:**
- Modify: `ios/App/App/Native/ADLModels.swift` (append new section at end of file)
- Modify: `ios/App/App/Native/ADLServices.swift` (`ADLAPIClient` methods + `AppState` loaders)

- [ ] **Step 1: Add models to `ADLModels.swift`**

Append:

```swift
// MARK: - Client Delta Intelligence (mirrors DeltaDashboard.tsx)

/// Decodes a Double that Postgres may serialize as a JSON string.
enum FlexDouble {
    static func decode(_ c: KeyedDecodingContainer<some CodingKey>, _ key: KeyedDecodingContainer<some CodingKey>.Key) -> Double? {
        fatalError("use the free function below")
    }
}

func adlFlexDouble<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Double? {
    if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return d }
    if let s = try? c.decodeIfPresent(String.self, forKey: key) { return Double(s) }
    return nil
}

func adlFlexInt<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Int? {
    if let i = try? c.decodeIfPresent(Int.self, forKey: key) { return i }
    if let s = try? c.decodeIfPresent(String.self, forKey: key) { return Int(s) }
    if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(d) }
    return nil
}

/// Row from /api/analytics?view=snapshots (snapshot_stats table, snake_case).
struct SnapshotStatRow: Decodable, Hashable, Identifiable {
    var id: String
    var snapshotDate: String
    var verticalId: String
    var totalPoints: Int
    var completedPoints: Int
    var completionRate: Double
    var newCount: Int
    var removedCount: Int
    var changedCount: Int
    var unchangedCount: Int
    var weekOverWeekGrowth: Double?

    enum CodingKeys: String, CodingKey {
        case id
        case snapshotDate = "snapshot_date"
        case verticalId = "vertical_id"
        case totalPoints = "total_points"
        case completedPoints = "completed_points"
        case completionRate = "completion_rate"
        case newCount = "new_count"
        case removedCount = "removed_count"
        case changedCount = "changed_count"
        case unchangedCount = "unchanged_count"
        case weekOverWeekGrowth = "week_over_week_growth"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id                 = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        snapshotDate       = String(((try? c.decodeIfPresent(String.self, forKey: .snapshotDate)) ?? "").prefix(10))
        verticalId         = (try? c.decodeIfPresent(String.self, forKey: .verticalId)) ?? ""
        totalPoints        = adlFlexInt(c, .totalPoints) ?? 0
        completedPoints    = adlFlexInt(c, .completedPoints) ?? 0
        completionRate     = adlFlexDouble(c, .completionRate) ?? 0
        newCount           = adlFlexInt(c, .newCount) ?? 0
        removedCount       = adlFlexInt(c, .removedCount) ?? 0
        changedCount       = adlFlexInt(c, .changedCount) ?? 0
        unchangedCount     = adlFlexInt(c, .unchangedCount) ?? 0
        weekOverWeekGrowth = adlFlexDouble(c, .weekOverWeekGrowth)
    }
}

/// Row from /api/analytics?view=deltas (snapshot_deltas table).
struct DeltaIntelRow: Decodable, Hashable, Identifiable {
    var id: String
    var snapshotDate: String
    var verticalId: String
    var pointId: String
    var deltaType: String       // "new" | "removed" | "changed" | ...
    var deltaField: String?
    var deltaSummary: String?
    var deltaMagnitude: Double?
    var deltaDirection: String?

    enum CodingKeys: String, CodingKey {
        case id
        case snapshotDate = "snapshot_date"
        case verticalId = "vertical_id"
        case pointId = "point_id"
        case deltaType = "delta_type"
        case deltaField = "delta_field"
        case deltaSummary = "delta_summary"
        case deltaMagnitude = "delta_magnitude"
        case deltaDirection = "delta_direction"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id             = (try? c.decodeIfPresent(String.self, forKey: .id)) ?? UUID().uuidString
        snapshotDate   = String(((try? c.decodeIfPresent(String.self, forKey: .snapshotDate)) ?? "").prefix(10))
        verticalId     = (try? c.decodeIfPresent(String.self, forKey: .verticalId)) ?? ""
        pointId        = (try? c.decodeIfPresent(String.self, forKey: .pointId)) ?? ""
        deltaType      = (try? c.decodeIfPresent(String.self, forKey: .deltaType)) ?? "changed"
        deltaField     = try? c.decodeIfPresent(String.self, forKey: .deltaField)
        deltaSummary   = try? c.decodeIfPresent(String.self, forKey: .deltaSummary)
        deltaMagnitude = adlFlexDouble(c, .deltaMagnitude)
        deltaDirection = try? c.decodeIfPresent(String.self, forKey: .deltaDirection)
    }
}

struct DeltasEnvelope: Decodable {
    var deltas: [DeltaIntelRow]
    init(from decoder: Decoder) throws {
        if let list = try? [DeltaIntelRow](from: decoder) { deltas = list; return }
        enum K: String, CodingKey { case deltas }
        let c = try decoder.container(keyedBy: K.self)
        deltas = (try? c.decodeIfPresent([DeltaIntelRow].self, forKey: .deltas)) ?? []
    }
}

/// Point from /api/analytics?view=trends (shape: { data: [{ date, <metric> }] }).
struct TrendPoint: Decodable, Hashable, Identifiable {
    var id: String { date }
    var date: String
    var value: Double

    enum CodingKeys: String, CodingKey { case date, value, totalPoints = "total_points" }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date  = String(((try? c.decodeIfPresent(String.self, forKey: .date)) ?? "").prefix(10))
        value = adlFlexDouble(c, .value) ?? adlFlexDouble(c, .totalPoints) ?? 0
    }
}

struct TrendEnvelope: Decodable {
    var data: [TrendPoint]
    init(from decoder: Decoder) throws {
        enum K: String, CodingKey { case data }
        let c = try decoder.container(keyedBy: K.self)
        data = (try? c.decodeIfPresent([TrendPoint].self, forKey: .data)) ?? []
    }
}

/// Mirrors shared/types.ts SpatialIntelligenceCell (camelCase JSON).
struct SpatialIntelCell: Decodable, Hashable, Identifiable {
    var id: String { cellId }
    var cellId: String
    var totalPoints: Int
    var completionRate: Double
    var opportunityScore: Double
    var coverageGapScore: Double
    var changeSignalScore: Double
    var marketSignalScore: Double
    var summary: String

    enum CodingKeys: String, CodingKey {
        case cellId, totalPoints, completionRate, opportunityScore
        case coverageGapScore, changeSignalScore, marketSignalScore, summary
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        cellId           = (try? c.decodeIfPresent(String.self, forKey: .cellId)) ?? UUID().uuidString
        totalPoints      = adlFlexInt(c, .totalPoints) ?? 0
        completionRate   = adlFlexDouble(c, .completionRate) ?? 0
        opportunityScore = adlFlexDouble(c, .opportunityScore) ?? 0
        coverageGapScore = adlFlexDouble(c, .coverageGapScore) ?? 0
        changeSignalScore = adlFlexDouble(c, .changeSignalScore) ?? 0
        marketSignalScore = adlFlexDouble(c, .marketSignalScore) ?? 0
        summary          = (try? c.decodeIfPresent(String.self, forKey: .summary)) ?? ""
    }
}

/// Mirrors shared/types.ts SpatialIntelligenceResponse.
struct SpatialIntelPayload: Decodable, Hashable {
    var snapshotDate: String
    var verticalId: String
    var totalCells: Int
    var totalPoints: Int
    var cells: [SpatialIntelCell]
    var narrative: String

    enum CodingKeys: String, CodingKey {
        case snapshotDate, verticalId, totalCells, totalPoints, cells, narrative
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        snapshotDate = (try? c.decodeIfPresent(String.self, forKey: .snapshotDate)) ?? ""
        verticalId   = (try? c.decodeIfPresent(String.self, forKey: .verticalId)) ?? ""
        totalCells   = adlFlexInt(c, .totalCells) ?? 0
        totalPoints  = adlFlexInt(c, .totalPoints) ?? 0
        cells        = (try? c.decodeIfPresent([SpatialIntelCell].self, forKey: .cells)) ?? []
        narrative    = (try? c.decodeIfPresent(String.self, forKey: .narrative)) ?? ""
    }
}

/// Mirrors shared/types.ts AiAnalyticsResponse.
struct AnalystAnswer: Decodable, Hashable {
    struct Fact: Decodable, Hashable {
        var label: String
        var value: String
        var source: String

        enum CodingKeys: String, CodingKey { case label, value, source }
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            label  = (try? c.decodeIfPresent(String.self, forKey: .label)) ?? ""
            source = (try? c.decodeIfPresent(String.self, forKey: .source)) ?? ""
            if let s = try? c.decodeIfPresent(String.self, forKey: .value) { value = s }
            else if let d = adlFlexDouble(c, .value) { value = d.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(d)) : String(format: "%.2f", d) }
            else { value = "" }
        }
    }

    var answer: String
    var facts: [Fact]
    var caveats: [String]
    var confidence: Double

    enum CodingKeys: String, CodingKey { case answer, facts, caveats, confidence }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        answer     = (try? c.decodeIfPresent(String.self, forKey: .answer)) ?? ""
        facts      = (try? c.decodeIfPresent([Fact].self, forKey: .facts)) ?? []
        caveats    = (try? c.decodeIfPresent([String].self, forKey: .caveats)) ?? []
        confidence = adlFlexDouble(c, .confidence) ?? 0
    }
}
```

> Delete the unused `enum FlexDouble` stub if the two free functions compile cleanly on their own (they do — the enum above is NOT needed; do not include it).

- [ ] **Step 2: Add `ADLAPIClient` endpoints**

In `ADLServices.swift`, after `fetchWeeklyKpis` (`:1008-1011`), add:

```swift
    func fetchSnapshotStats(limit: Int = 52) async throws -> [SnapshotStatRow] {
        try await fetchJSON([SnapshotStatRow].self, path: "/api/analytics?view=snapshots&limit=\(limit)")
    }

    func fetchTrend(vertical: String, weeks: Int = 12) async throws -> [TrendPoint] {
        try await fetchJSON(TrendEnvelope.self,
                            path: "/api/analytics?view=trends&vertical=\(vertical)&metric=total_points&weeks=\(weeks)").data
    }

    func fetchDeltas(vertical: String, limit: Int = 20) async throws -> [DeltaIntelRow] {
        try await fetchJSON(DeltasEnvelope.self,
                            path: "/api/analytics?view=deltas&vertical=\(vertical)&publishable=true&limit=\(limit)").deltas
    }

    func fetchSpatialIntelligence(vertical: String, sort: String, limit: Int = 8) async throws -> SpatialIntelPayload {
        try await fetchJSON(SpatialIntelPayload.self,
                            path: "/api/analytics?view=spatial_intelligence&vertical=\(vertical)&sort=\(sort)&limit=\(limit)")
    }

    func askAnalyticsAssistant(question: String, vertical: String?) async throws -> AnalystAnswer {
        struct Body: Encodable {
            let question: String
            let vertical: String?
            let zone: String
        }
        return try await postJSON(path: "/api/ai/search?view=analytics-query",
                                  body: Body(question: question, vertical: vertical, zone: "bonamoussadi"))
    }
```

> `postJSON(path:body:)` generic already exists (`:1157`). Match its exact signature — it is `func postJSON<T: Encodable, R: Decodable>(path: String, body: T) async throws -> R`; the call above relies on return-type inference.

- [ ] **Step 3: Add `AppState` published state + loader**

In `AppState` (near `loadAnalytics`, `:463`), add published properties:

```swift
    @Published var clientStats: [SnapshotStatRow] = []
    @Published var clientTrend: [TrendPoint] = []
    @Published var clientDeltas: [DeltaIntelRow] = []
    @Published var clientSpatial: SpatialIntelPayload?
    @Published var isLoadingClientDelta = false
    @Published var clientDeltaError: String?
```

And the loader:

```swift
    /// Loads delta intelligence for the client dashboard. vertical == nil ⇒ "all"
    /// (snapshots only, no per-vertical panels) — mirrors DeltaDashboard.tsx.
    func loadClientDelta(vertical: String?, spatialSort: String = "opportunity_score", force: Bool = false) async {
        guard !isLoadingClientDelta else { return }
        if !clientStats.isEmpty, vertical == nil, !force { return }
        isLoadingClientDelta = true
        clientDeltaError = nil
        defer { isLoadingClientDelta = false }
        do {
            if clientStats.isEmpty || force {
                clientStats = try await apiClient.fetchSnapshotStats()
            }
            if let vertical {
                async let trend = apiClient.fetchTrend(vertical: vertical)
                async let deltas = apiClient.fetchDeltas(vertical: vertical)
                async let spatial = apiClient.fetchSpatialIntelligence(vertical: vertical, sort: spatialSort)
                clientTrend = try await trend
                clientDeltas = try await deltas
                clientSpatial = try await spatial
            } else {
                clientTrend = []
                clientDeltas = []
                clientSpatial = nil
            }
        } catch {
            clientDeltaError = (error as? APIError)?.message
                ?? t("Unable to load delta intelligence.", "Impossible de charger l'intelligence delta.")
        }
    }
```

- [ ] **Step 4: Build** — `xcodebuild`. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add ios/App/App/Native/ADLModels.swift ios/App/App/Native/ADLServices.swift
git commit -m "feat(ios): client delta intelligence models, API endpoints, and loader"
```

---

## Task 9: Client delta parity — `ClientDashboardView` UI (ticket: client-ui) — depends on Task 8

Add the five missing web sections to `ClientDashboardView` (`ADLViews.swift:6354-6553`): vertical selector, by-vertical current week, delta breakdown, recent deltas, spatial intelligence, and the analyst card. Keep the existing hero/KPI/weekly-bars/quality sections.

**Files:**
- Modify: `ios/App/App/Native/ADLViews.swift` (`ClientDashboardView`)

- [ ] **Step 1: Add view state**

At the top of `ClientDashboardView`:

```swift
    @State private var selectedVertical: String = "all"
    @State private var spatialSort: String = "opportunity_score"
    @State private var analystQuestion: String = ""
    @State private var analystAnswer: AnalystAnswer?
    @State private var analystLoading = false
    @State private var analystError: String?

    private var verticalOptions: [(id: String, title: String)] {
        [("all", appState.t("All", "Toutes"))]
        + SubmissionCategory.allCases.map { ($0.rawValue, $0.title) }
    }

    private let spatialSorts: [(id: String, en: String, fr: String)] = [
        ("opportunity_score", "Opportunity", "Opportunité"),
        ("coverage_gap_score", "Coverage gap", "Couverture"),
        ("change_signal_score", "Change signal", "Signal de changement"),
        ("market_signal_score", "Market signal", "Signal marché"),
    ]
```

> Confirm `SubmissionCategory` conforms to `CaseIterable` and exposes `title` (it is used as `event.category.title` elsewhere, e.g. `:8471`). If `allCases` is unavailable, add `CaseIterable` conformance in `ADLModels.swift`.

- [ ] **Step 2: Vertical selector chips**

Insert directly under the hero card (after its `.clipShape(RoundedRectangle(cornerRadius: 24 ...))`):

```swift
                    // Vertical selector — mirrors web FilterChipRow
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(verticalOptions, id: \.id) { option in
                                Button {
                                    selectedVertical = option.id
                                    Task {
                                        await appState.loadClientDelta(
                                            vertical: option.id == "all" ? nil : option.id,
                                            spatialSort: spatialSort,
                                            force: false)
                                    }
                                } label: {
                                    Text(option.title)
                                        .font(ADLFont.inter(12, .bold))
                                        .padding(.horizontal, 14)
                                        .frame(height: 36)
                                        .foregroundColor(selectedVertical == option.id ? .white : ADLColor.navy)
                                        .background(selectedVertical == option.id ? ADLColor.navy : ADLColor.navyWash)
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
```

- [ ] **Step 3: By-vertical current week**

Insert after the existing weekly bar chart section:

```swift
                    // By vertical — current week (mirrors web verticalStats bars)
                    let latestDate = appState.clientStats.map(\.snapshotDate).max()
                    let dates = Array(Set(appState.clientStats.map(\.snapshotDate))).sorted(by: >)
                    let prevDate = dates.count > 1 ? dates[1] : nil
                    let byVertical: [(id: String, current: Int, previous: Int)] = verticalOptions
                        .filter { $0.id != "all" }
                        .map { option in
                            let current = appState.clientStats
                                .first { $0.verticalId == option.id && $0.snapshotDate == latestDate }?.totalPoints ?? 0
                            let previous = prevDate.flatMap { p in
                                appState.clientStats.first { $0.verticalId == option.id && $0.snapshotDate == p }?.totalPoints
                            } ?? 0
                            return (option.id, current, previous)
                        }
                        .filter { $0.current > 0 }

                    if !byVertical.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionLabel(text: appState.t("By vertical — current week", "Par verticale — semaine en cours"))
                            ADLCard {
                                VStack(spacing: 10) {
                                    let maxCurrent = max(byVertical.map(\.current).max() ?? 1, 1)
                                    ForEach(byVertical, id: \.id) { row in
                                        let delta = row.current - row.previous
                                        HStack(spacing: 10) {
                                            Text(verticalOptions.first { $0.id == row.id }?.title ?? row.id)
                                                .font(ADLFont.inter(12, .bold))
                                                .foregroundColor(ADLColor.ink)
                                                .frame(width: 92, alignment: .leading)
                                                .lineLimit(1)
                                            GeometryReader { geo in
                                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                                    .fill(ADLColor.navy)
                                                    .frame(width: max(geo.size.width * CGFloat(row.current) / CGFloat(maxCurrent), 4))
                                            }
                                            .frame(height: 14)
                                            Text("\(row.current)")
                                                .font(ADLFont.inter(12, .bold))
                                                .foregroundColor(ADLColor.navy)
                                            Text(delta == 0 ? "·" : (delta > 0 ? "+\(delta)" : "\(delta)"))
                                                .font(ADLFont.inter(11, .bold))
                                                .foregroundColor(delta >= 0 ? ADLColor.forest : ADLColor.terracotta)
                                                .frame(width: 36, alignment: .trailing)
                                        }
                                    }
                                }
                            }
                        }
                    }
```

- [ ] **Step 4: Delta breakdown stacked bars**

Insert after Step 3's section:

```swift
                    // Delta breakdown — stacked new/changed/removed per snapshot (last 8)
                    let breakdown: [(date: String, newC: Int, changed: Int, removed: Int)] = {
                        let rows = selectedVertical == "all"
                            ? appState.clientStats
                            : appState.clientStats.filter { $0.verticalId == selectedVertical }
                        var byDate: [String: (Int, Int, Int)] = [:]
                        for r in rows {
                            let cur = byDate[r.snapshotDate] ?? (0, 0, 0)
                            byDate[r.snapshotDate] = (cur.0 + r.newCount, cur.1 + r.changedCount, cur.2 + r.removedCount)
                        }
                        return byDate.keys.sorted().suffix(8).map { d in
                            let v = byDate[d]!
                            return (d, v.0, v.1, v.2)
                        }
                    }()

                    if !breakdown.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionLabel(text: appState.t("Delta breakdown", "Détail des deltas"))
                            ADLCard {
                                VStack(spacing: 12) {
                                    HStack(alignment: .bottom, spacing: 8) {
                                        let maxTotal = max(breakdown.map { $0.newC + $0.changed + $0.removed }.max() ?? 1, 1)
                                        ForEach(breakdown, id: \.date) { bar in
                                            VStack(spacing: 4) {
                                                GeometryReader { geo in
                                                    let unit = geo.size.height / CGFloat(maxTotal)
                                                    VStack(spacing: 1) {
                                                        Spacer(minLength: 0)
                                                        Rectangle().fill(ADLColor.terracotta)
                                                            .frame(height: unit * CGFloat(bar.removed))
                                                        Rectangle().fill(ADLColor.gold)
                                                            .frame(height: unit * CGFloat(bar.changed))
                                                        Rectangle().fill(ADLColor.forest)
                                                            .frame(height: unit * CGFloat(bar.newC))
                                                    }
                                                    .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                                                }
                                                Text(String(bar.date.suffix(5)))
                                                    .font(ADLFont.inter(8))
                                                    .foregroundColor(Color(hex: 0x9ca3af))
                                            }
                                            .frame(maxWidth: .infinity)
                                        }
                                    }
                                    .frame(height: 110)
                                    HStack(spacing: 14) {
                                        ForEach([(ADLColor.forest, appState.t("New", "Nouveaux")),
                                                 (ADLColor.gold, appState.t("Changed", "Modifiés")),
                                                 (ADLColor.terracotta, appState.t("Removed", "Retirés"))], id: \.1) { color, label in
                                            HStack(spacing: 5) {
                                                Circle().fill(color).frame(width: 8, height: 8)
                                                Text(label)
                                                    .font(ADLFont.inter(10, .semibold))
                                                    .foregroundColor(ADLColor.inkMuted)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
```

- [ ] **Step 5: Recent deltas + spatial intelligence (per-vertical only)**

Insert after Step 4's section:

```swift
                    if selectedVertical != "all" {
                        // Recent publishable deltas
                        VStack(alignment: .leading, spacing: 10) {
                            SectionLabel(text: appState.t("Recent changes", "Changements récents"))
                            if appState.clientDeltas.isEmpty {
                                ADLCard {
                                    Text(appState.clientDeltaError
                                         ?? appState.t("No published changes this week.", "Aucun changement publié cette semaine."))
                                        .font(ADLFont.inter(12))
                                        .foregroundColor(ADLColor.inkMuted)
                                }
                            } else {
                                VStack(spacing: 8) {
                                    ForEach(appState.clientDeltas.prefix(10)) { delta in
                                        ADLCard {
                                            HStack(spacing: 10) {
                                                Text(delta.deltaType.uppercased())
                                                    .font(ADLFont.inter(9, .bold))
                                                    .tracking(1)
                                                    .padding(.horizontal, 8)
                                                    .padding(.vertical, 4)
                                                    .foregroundColor(delta.deltaType == "new" ? ADLColor.forest
                                                                     : delta.deltaType == "removed" ? ADLColor.terracotta : ADLColor.navy)
                                                    .background((delta.deltaType == "new" ? ADLColor.forestWash
                                                                 : delta.deltaType == "removed" ? ADLColor.terraWash : ADLColor.navyWash))
                                                    .clipShape(Capsule())
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(delta.deltaSummary ?? delta.deltaField ?? delta.pointId)
                                                        .font(ADLFont.inter(12, .semibold))
                                                        .foregroundColor(ADLColor.ink)
                                                        .lineLimit(2)
                                                    Text(delta.snapshotDate)
                                                        .font(ADLFont.inter(10))
                                                        .foregroundColor(ADLColor.inkMuted)
                                                }
                                                Spacer()
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Spatial intelligence
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                SectionLabel(text: appState.t("Spatial intelligence", "Intelligence spatiale"))
                                Spacer()
                                Menu {
                                    ForEach(spatialSorts, id: \.id) { sort in
                                        Button(appState.t(sort.en, sort.fr)) {
                                            spatialSort = sort.id
                                            Task {
                                                await appState.loadClientDelta(
                                                    vertical: selectedVertical, spatialSort: sort.id, force: true)
                                            }
                                        }
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Text(spatialSorts.first { $0.id == spatialSort }
                                                .map { appState.t($0.en, $0.fr) } ?? "")
                                            .font(ADLFont.inter(11, .bold))
                                        Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
                                    }
                                    .foregroundColor(ADLColor.navy)
                                }
                                .buttonStyle(.plain)
                            }

                            if let spatial = appState.clientSpatial, !spatial.cells.isEmpty {
                                if !spatial.narrative.isEmpty {
                                    ADLCard {
                                        Text(spatial.narrative)
                                            .font(ADLFont.inter(12))
                                            .foregroundColor(ADLColor.inkMuted)
                                    }
                                }
                                VStack(spacing: 8) {
                                    ForEach(spatial.cells) { cell in
                                        ADLCard {
                                            VStack(alignment: .leading, spacing: 6) {
                                                HStack {
                                                    Text(cell.cellId)
                                                        .font(ADLFont.inter(11, .bold))
                                                        .foregroundColor(ADLColor.inkMuted)
                                                    Spacer()
                                                    let score: Double = {
                                                        switch spatialSort {
                                                        case "coverage_gap_score": return cell.coverageGapScore
                                                        case "change_signal_score": return cell.changeSignalScore
                                                        case "market_signal_score": return cell.marketSignalScore
                                                        default: return cell.opportunityScore
                                                        }
                                                    }()
                                                    Text(String(format: "%.0f", score))
                                                        .font(ADLFont.inter(15, .heavy))
                                                        .foregroundColor(ADLColor.navy)
                                                }
                                                Text(cell.summary)
                                                    .font(ADLFont.inter(12))
                                                    .foregroundColor(ADLColor.ink)
                                                    .lineLimit(3)
                                                Text("\(cell.totalPoints) pts · \(String(format: "%.0f%%", cell.completionRate * (cell.completionRate <= 1 ? 100 : 1)))")
                                                    .font(ADLFont.inter(10, .semibold))
                                                    .foregroundColor(ADLColor.inkMuted)
                                            }
                                        }
                                    }
                                }
                            } else if appState.isLoadingClientDelta {
                                ADLCard { HStack(spacing: 10) { ProgressView(); Text(appState.t("Loading…", "Chargement…")).font(ADLFont.inter(12)).foregroundColor(ADLColor.inkMuted) } }
                            } else {
                                ADLCard {
                                    Text(appState.t("No spatial data for this vertical yet.", "Pas encore de données spatiales pour cette verticale."))
                                        .font(ADLFont.inter(12))
                                        .foregroundColor(ADLColor.inkMuted)
                                }
                            }
                        }
                    }
```

- [ ] **Step 6: Analyst card**

Insert after Step 5's block (still inside the main `VStack`):

```swift
                    // Client analysis — AI analyst (mirrors web handleAskAnalyst)
                    VStack(alignment: .leading, spacing: 10) {
                        SectionLabel(text: appState.t("Client analysis", "Analyse client"))
                        ADLCard {
                            VStack(alignment: .leading, spacing: 10) {
                                TextField(
                                    appState.t("What changed in this vertical this week?",
                                               "Qu'est-ce qui a changé dans cette verticale cette semaine ?"),
                                    text: $analystQuestion,
                                    axis: .vertical
                                )
                                .font(ADLFont.inter(13))
                                .lineLimit(2...4)

                                Button {
                                    let q = analystQuestion.trimmingCharacters(in: .whitespacesAndNewlines)
                                    guard !q.isEmpty, !analystLoading else { return }
                                    analystLoading = true
                                    analystError = nil
                                    Task {
                                        do {
                                            analystAnswer = try await appState.apiClient.askAnalyticsAssistant(
                                                question: q,
                                                vertical: selectedVertical == "all" ? nil : selectedVertical)
                                        } catch {
                                            analystAnswer = nil
                                            analystError = (error as? APIError)?.message
                                                ?? appState.t("Analyst answer unavailable.", "Réponse analyste indisponible.")
                                        }
                                        analystLoading = false
                                    }
                                } label: {
                                    HStack(spacing: 8) {
                                        if analystLoading { ProgressView().tint(.white) }
                                        Text(appState.t("Ask the analyst", "Demander à l'analyste"))
                                            .font(ADLFont.inter(13, .bold))
                                    }
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 44)
                                    .foregroundColor(.white)
                                    .background(analystLoading ? Color(hex: 0x9ca3af) : ADLColor.navy)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                }
                                .buttonStyle(.plain)
                                .disabled(analystLoading)

                                if let err = analystError {
                                    Text(err).font(ADLFont.inter(12)).foregroundColor(ADLColor.terracotta)
                                }
                                if let answer = analystAnswer {
                                    Text(answer.answer)
                                        .font(ADLFont.inter(13))
                                        .foregroundColor(ADLColor.ink)
                                    ForEach(answer.facts, id: \.self) { fact in
                                        HStack(spacing: 6) {
                                            Text(fact.label + ":")
                                                .font(ADLFont.inter(11, .bold))
                                                .foregroundColor(ADLColor.inkMuted)
                                            Text(fact.value)
                                                .font(ADLFont.inter(11, .semibold))
                                                .foregroundColor(ADLColor.navy)
                                        }
                                    }
                                    if !answer.caveats.isEmpty {
                                        Text(answer.caveats.joined(separator: " · "))
                                            .font(ADLFont.inter(10))
                                            .foregroundColor(ADLColor.inkMuted)
                                    }
                                }
                            }
                        }
                    }
```

- [ ] **Step 7: Trigger loads**

On the outermost view of `ClientDashboardView` (where `.task { await appState.loadAnalytics() }` already exists), extend:

```swift
        .task {
            await appState.loadAnalytics()
            await appState.loadClientDelta(vertical: nil)
        }
        .refreshable {
            await appState.loadAnalytics(force: true)
            await appState.loadClientDelta(
                vertical: selectedVertical == "all" ? nil : selectedVertical,
                spatialSort: spatialSort,
                force: true)
        }
```

(Replace the existing `.task`/`.refreshable` modifiers rather than duplicating them.)

- [ ] **Step 8: Build** — `xcodebuild`. Expected: `** BUILD SUCCEEDED **`.

> If the compiler times out type-checking the enlarged `body` ("the compiler is unable to type-check this expression in reasonable time"), extract each inserted section into a `private var ...Section: some View` computed property on `ClientDashboardView` — same code, just hoisted.

- [ ] **Step 9: Commit**

```bash
git add ios/App/App/Native/ADLViews.swift
git commit -m "feat(ios): client delta dashboard parity — verticals, breakdown, spatial intel, analyst"
```

- [ ] **Step 10: Device note** — `bd update <client-ui-ticket> --notes`: "Client login → Delta tab: chips select verticals; picking one loads trend/deltas/spatial sections; 'all' shows snapshot aggregates; analyst answers a question. Compare side-by-side with web DeltaDashboard."

---

## Final Review (after all tasks)

- [ ] **Full web CI gate** (server/shared untouched in most tasks, but run once):

```bash
npm run test:ci
```
Expected: lint + typecheck + test + build green.

- [ ] **Final Xcode build** (Release, catches stricter optimizer diagnostics):

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

- [ ] **Dispatch code review** over the branch diff (superpowers:requesting-code-review).

- [ ] **Close tickets** as device-verified; close the epic when all children done.

- [ ] **Push** (CLAUDE.md session-close protocol):

```bash
git pull --rebase
bd dolt push
git push
git status   # MUST show up to date with origin
```

- [ ] **Archive + TestFlight** — user builds in Xcode and walks the per-ticket device notes (admin login + client login passes).

---

## Self-Review (author checklist — completed)

**Spec coverage:** (1) cockpit dropdown+filters+mass-approve → Task 4 (filters/mass-approve already shipped in `reviewFiltersCard`, `ADLViews.swift:4481-4583`; dropdown stabilization is the remaining gap); (2) assignments load → Task 1; (3) Account Access missing → Task 5 Step 1 (gating + error surfacing; the card itself exists at `:8605`); (4) map reload/caching → Task 3; (5) weekly assignments → Task 2; (6) contribution history → Task 5 Steps 2-3; (7) worldwide admin map → Task 6; (8) profile photo 500 → Task 7 (+ already-merged server fix); client delta (analysis, by-vertical week, vertical chooser, delta breakdown, spatial intelligence) → Tasks 8-9. ✅

**Placeholder scan:** every code step carries full Swift; the two conditional steps (Task 1 Steps 1-2) are diagnosis branches with exact commands and the decision table for each outcome. ✅

**Type consistency:** `SnapshotStatRow`/`DeltaIntelRow`/`TrendPoint`/`SpatialIntelPayload`/`AnalystAnswer` names match between Task 8 (definition) and Task 9 (usage); `loadClientDelta(vertical:spatialSort:force:)` signature identical at all call sites; `fetchContributionEvents(scope:userId:)` matches the existing client method (`ADLServices.swift:1024`). `adlFlexDouble`/`adlFlexInt` free functions used consistently. ✅

**Known runtime-confirmation items:** Task 1 may surface a missing prod migration (apply per Step 2); `SubmissionCategory.allCases`/`title` and `UserProfile.id` optionality must be confirmed at edit time (noted inline); compiler type-check timeout mitigation documented in Task 9 Step 8.
