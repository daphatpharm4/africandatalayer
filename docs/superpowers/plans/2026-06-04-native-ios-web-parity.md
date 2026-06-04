# Native iOS Web-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduce every web screen of African Data Layer in the native SwiftUI app pixel-faithfully (layout, type scale, color, spacing), improving where the native platform allows.

**Architecture:** SwiftUI views in `ios/App/App/Native/` mirror the React screens in `components/Screens/*.tsx`. A single design layer (`ADLDesignSystem.swift` + new `ADLComponents.swift`) encodes the Tailwind tokens/type-scale so every screen composes from the same primitives. Verification is build-green + on-simulator screenshot compared side-by-side against the live web at `https://www.app.africandatalayer.com/`.

**Tech Stack:** SwiftUI (iOS 17), Inter variable font, MapKit (Home), Swift Charts (dashboards), Auth.js credentials API (already wired). Web reference source of truth: `components/Screens/*.tsx`, `components/shared/*.tsx`, `tailwind.config.js`, `index.css` (identical copy at `/Users/charlesvictormahouve/Downloads/africandatalayer-main`).

---

## Conventions (read once, apply everywhere)

### Type scale — Tailwind class → SwiftUI

Use `ADLFont.inter(size, weight)`. Map the web classes exactly:

| Web class | px | `ADLFont` | Weight notes |
|-----------|----|-----------|--------------|
| `text-[9px]` | 9 | `inter(9, .bold)` | vertical grid labels |
| `text-[10px]` | 10 | `inter(10, .bold)` | badges/pills |
| `text-[11px]` / `micro-label-wide` | 11 | `inter(11, .bold)` tracking 0.20em→`.tracking(2.2)` | |
| `text-xs` / `micro-label` | 12 | `inter(12, .semibold)` tracking 0.14em→`.tracking(1.6)` | uppercase |
| `text-sm` | 14 | `inter(14)` body, `inter(14,.semibold)` labels | |
| `text-[15px]` | 15 | `inter(15,.semibold)` | header title, buttons |
| `text-base` | 16 | `inter(16)` | inputs |
| `text-lg` | 18 | `inter(18,.semibold)` | |
| `text-xl` | 20 | `inter(20,.bold)` | |
| `text-[22px]` | 22 | `inter(22,.heavy)` | KPI value |
| `text-2xl` | 24 | `inter(24,.bold)` | |
| `text-[28px]` | 28 | `inter(28,.heavy)` | splash/auth title |
| `text-3xl` | 30 | `inter(30,.bold)` | |

`font-extrabold`→`.heavy`, `font-bold`→`.bold`, `font-semibold`→`.semibold`, `font-medium`→`.medium`. `leading-none`→`.lineSpacing(0)`, `leading-tight`→default, `leading-relaxed`→`.lineSpacing(4)`. `tracking-tight`→`.tracking(-0.4)`.

### Spacing — Tailwind → points (1 unit = 4pt)
`p-1`=4, `p-1.5`=6, `p-2`=8, `p-2.5`=10, `p-3`=12, `p-4`=16, `p-5`=20, `p-6`=24. `gap-1`=4, `gap-1.5`=6, `gap-2`=8, `gap-2.5`=10, `gap-3`=12.

### Color tokens — already in `ADLColor` (exact hex)
navy/navyDark/navyMid/navyWash/navyBorder, terra/terraDark/terraWash, forest/forestDark/forestWash, gold/goldWash, amber/amberWash, streak/streakWash, ink/inkMuted, danger, paper(`f9fafb`), line(gray-100), lineStrong(gray-200). Extra raw greys via `Color(hex:)`: gray-500 `0x6b7280`, gray-600 `0x4b5563`, gray-400 `0x9ca3af`, red-100 `0xfee2e2`, red-800 `0x991b1b`.

### Radii — `ADLRadius`: card 16, pill 28, statTile 14, button 16. Icon chips: 8–12 per source.

### Verification loop (every screen task ends with this)
```bash
# build
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD SUCCEEDED|BUILD FAILED"
# install (skip Index.noindex)
APP=$(find ~/Library/Developer/Xcode/DerivedData -name App.app -path "*Debug-iphonesimulator*" | grep -v Index.noindex | head -1)
xcrun simctl install booted "$APP"
# jump straight to the screen under test (DEBUG env hooks already exist)
xcrun simctl spawn booted defaults write com.africandatalayer.app adl_has_seen_splash -bool YES
SIMCTL_CHILD_ADL_DEMO=1 SIMCTL_CHILD_ADL_ROLE=<agent|admin|client> SIMCTL_CHILD_ADL_TAB=<route> \
  xcrun simctl launch booted com.africandatalayer.app
sleep 6 && xcrun simctl io booted screenshot /tmp/<screen>.png
```
Capture the web reference at 390×844 with Playwright (or reuse `.playwright-mcp/*`). Compare: title size, card radius, spacing rhythm, colors, icon set. Iterate until they match, then commit.

SourceKit "No such module 'UIKit'" / "Cannot find type" is single-file noise — only `xcodebuild` output is authoritative.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `ios/App/App/Native/ADLDesignSystem.swift` | tokens, fonts, radii, buttons, base cards | extend |
| `ios/App/App/Native/ADLComponents.swift` | **new** — shared primitives (ScreenHeader, KpiTile, RiskBadge, TrustBadge, FilterChipRow, VerticalPickerBar, BottomSheet, SectionLabel) | create |
| `ios/App/App/Native/ADLViews.swift` | screen views | rewrite per screen |
| `ios/App/App/Native/ADLServices.swift` | AppState + API (data loaders for leaderboard/analytics/admin/client) | extend as screens need data |
| `ios/App/App/Native/ADLModels.swift` | models (add any missing: AdminSubmission, DeltaStat, etc.) | extend |

New `ADLComponents.swift` must be added to the Xcode target — see Task 0.0.

---

## Phase 0 — Shared foundation

### Task 0.0: Register `ADLComponents.swift` in the project

**Files:**
- Create: `ios/App/App/Native/ADLComponents.swift`
- Modify: `ios/App/App/App.xcodeproj/project.pbxproj`

- [ ] **Step 1: Create the file with a sentinel symbol**

```swift
// ios/App/App/Native/ADLComponents.swift
import SwiftUI

// Shared web-parity primitives. Populated by Phase 0 tasks.
enum ADLComponentsModule {}
```

- [ ] **Step 2: Add to pbxproj** — mirror the existing `A100…0015 ADLViews.swift` quartet. Add a PBXBuildFile, PBXFileReference, the `Native` group child, and the Sources phase entry using fresh IDs `A100000000000000000000A1` (buildFile) / `A100000000000000000000A2` (fileRef):

```
# PBXBuildFile section
A100000000000000000000A1 /* ADLComponents.swift in Sources */ = {isa = PBXBuildFile; fileRef = A100000000000000000000A2 /* ADLComponents.swift */; };
# PBXFileReference section
A100000000000000000000A2 /* ADLComponents.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ADLComponents.swift; sourceTree = "<group>"; };
# Native group children (after ADLViews.swift)
A100000000000000000000A2 /* ADLComponents.swift */,
# PBXSourcesBuildPhase files (after ADLViews.swift in Sources)
A100000000000000000000A1 /* ADLComponents.swift in Sources */,
```

- [ ] **Step 3: Build** — `BUILD SUCCEEDED`.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "chore(ios): add ADLComponents.swift to target"`

### Task 0.1: `ScreenHeader` primitive

Mirrors `components/shared/ScreenHeader.tsx`: sticky 60pt min-height, 3-col grid `[44, 1fr, 44]`, white bg, bottom border gray-100, centered 15pt bold title + optional 11pt gray subtitle, leading 44×44 back (ArrowLeft 20), trailing slot. Dark variant: bg ink, white text, title 12pt uppercase tracking.

**Files:** Modify `ios/App/App/Native/ADLComponents.swift`

- [ ] **Step 1: Implement**

```swift
struct ADLScreenHeader<Trailing: View>: View {
    let title: String
    var subtitle: String? = nil
    var onBack: (() -> Void)? = nil
    var dark: Bool = false
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 8) {
            Group {
                if let onBack {
                    Button(action: onBack) {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 20, weight: .regular))
                            .foregroundColor(dark ? .white : Color(hex: 0x374151))
                            .frame(width: 44, height: 44)
                    }
                } else { Color.clear.frame(width: 44, height: 44) }
            }
            VStack(spacing: 2) {
                Text(dark ? title.uppercased() : title)
                    .font(dark ? ADLFont.inter(12, .bold) : ADLFont.inter(15, .bold))
                    .tracking(dark ? 1.9 : 0)
                    .foregroundColor(dark ? .white : ADLColor.ink)
                    .lineLimit(1)
                if let subtitle {
                    Text(subtitle)
                        .font(ADLFont.inter(11))
                        .foregroundColor(dark ? .white.opacity(0.7) : Color(hex: 0x6b7280))
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)
            trailing().frame(minWidth: 44, alignment: .trailing)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 60)
        .background(dark ? ADLColor.ink : Color.white)
        .overlay(Rectangle().fill(ADLColor.line).frame(height: 1), alignment: .bottom)
    }
}
extension ADLScreenHeader where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil, onBack: (() -> Void)? = nil, dark: Bool = false) {
        self.init(title: title, subtitle: subtitle, onBack: onBack, dark: dark) { EmptyView() }
    }
}
```

- [ ] **Step 2: Build** → `BUILD SUCCEEDED`.
- [ ] **Step 3: Commit** — `git commit -am "feat(ios): ADLScreenHeader primitive"`

### Task 0.2: `KpiTile` primitive

Mirrors `components/KpiTile.tsx`: `stat-tile` (rounded 14, p-3), tone wash bg + tone text, optional 28×28 white/70 icon chip + delta (11pt bold, TrendingUp/Down, forest/danger), value `text-[22px] extrabold leading-none`, label `micro-label-wide` (11pt) tone opacity 0.7.

**Files:** Modify `ADLComponents.swift`

- [ ] **Step 1: Implement**

```swift
enum KpiTone { case navy, terra, forest, streak, amber, gold
    var bg: Color { switch self {
        case .navy: return ADLColor.navyWash; case .terra: return ADLColor.terraWash
        case .forest: return ADLColor.forestWash; case .streak: return ADLColor.streakWash
        case .amber: return ADLColor.amberWash; case .gold: return ADLColor.goldWash } }
    var fg: Color { switch self {
        case .navy: return ADLColor.navy; case .terra: return ADLColor.terracotta
        case .forest: return ADLColor.forestDark; case .streak: return ADLColor.streak
        case .amber, .gold: return ADLColor.amber } }
}

struct KpiTile: View {
    let label: String
    let value: String
    var delta: Int? = nil
    var tone: KpiTone = .navy
    var systemIcon: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if systemIcon != nil || delta != nil {
                HStack {
                    if let systemIcon {
                        Image(systemName: systemIcon).font(.system(size: 13, weight: .semibold))
                            .foregroundColor(tone.fg)
                            .frame(width: 28, height: 28)
                            .background(Color.white.opacity(0.7))
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    } else { Spacer().frame(height: 0) }
                    Spacer()
                    if let delta {
                        let pos = delta >= 0
                        HStack(spacing: 2) {
                            Image(systemName: pos ? "arrow.up.right" : "arrow.down.right").font(.system(size: 11, weight: .bold))
                            Text("\(pos ? "+" : "")\(delta)").font(ADLFont.inter(11, .bold))
                        }.foregroundColor(pos ? ADLColor.forestDark : ADLColor.danger)
                    }
                }.padding(.bottom, 8)
            }
            Text(value).font(ADLFont.inter(22, .heavy)).foregroundColor(tone.fg)
            Text(label.uppercased()).font(ADLFont.inter(11, .bold)).tracking(2.0)
                .foregroundColor(tone.fg).opacity(0.7).padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(tone.bg)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
```

- [ ] **Step 2: Build** → SUCCEEDED. **Step 3: Commit** `feat(ios): KpiTile primitive`.

### Task 0.3: `RiskBadge`, `TrustBadge`, `SectionLabel`

Mirrors `RiskBadge.tsx`/`TrustBadge.tsx` (10pt micro-label pill, rounded-full px-2 py-0.5) and the `micro-label`/`micro-label-wide` eyebrows used everywhere.

**Files:** Modify `ADLComponents.swift`

- [ ] **Step 1: Implement**

```swift
struct ADLPill: View {
    let text: String; let bg: Color; let fg: Color
    var body: some View {
        Text(text.uppercased()).font(ADLFont.inter(10, .bold)).tracking(1.2)
            .foregroundColor(fg).padding(.horizontal, 8).padding(.vertical, 3)
            .background(bg).clipShape(Capsule())
    }
}
enum RiskLevel { case low, medium, high }
struct RiskBadge: View {
    let level: RiskLevel
    var body: some View {
        switch level {
        case .low: ADLPill(text: "Low risk", bg: ADLColor.forestWash, fg: ADLColor.forestDark)
        case .medium: ADLPill(text: "Medium risk", bg: ADLColor.amberWash, fg: ADLColor.amber)
        case .high: ADLPill(text: "High risk", bg: Color(hex: 0xfee2e2), fg: Color(hex: 0x991b1b))
        }
    }
}
enum TrustTier { case gold, silver, bronze }
struct TrustBadge: View {
    let tier: TrustTier
    var body: some View {
        switch tier {
        case .gold: ADLPill(text: "Gold", bg: ADLColor.goldWash, fg: ADLColor.amber)
        case .silver: ADLPill(text: "Silver", bg: ADLColor.line, fg: Color(hex: 0x4b5563))
        case .bronze: ADLPill(text: "Bronze", bg: ADLColor.terraWash, fg: ADLColor.terracotta)
        }
    }
}
struct SectionLabel: View {
    let text: String; var wide: Bool = false
    var body: some View {
        Text(text.uppercased())
            .font(ADLFont.inter(wide ? 11 : 12, wide ? .bold : .semibold))
            .tracking(wide ? 2.2 : 1.6)
            .foregroundColor(Color(hex: 0x6b7280))
    }
}
```

- [ ] **Step 2: Build → SUCCEEDED. Step 3: Commit** `feat(ios): badge + section-label primitives`.

### Task 0.4: `FilterChipRow` + `VerticalPickerBar`

Mirrors `FilterChipRow.tsx` (horizontal scroll chips; active navy bg white text, inactive white border gray-200) and `VerticalPickerBar.tsx` (category selector used in Contribute step 1).

**Files:** Modify `ADLComponents.swift`

- [ ] **Step 1: Implement**

```swift
struct ADLChipItem: Identifiable { let id: String; let label: String }

struct FilterChipRow: View {
    let chips: [ADLChipItem]
    @Binding var selected: String
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(chips) { chip in
                    let active = chip.id == selected
                    Button { selected = chip.id } label: {
                        Text(chip.label).font(ADLFont.inter(13, .semibold))
                            .foregroundColor(active ? .white : Color(hex: 0x4b5563))
                            .padding(.horizontal, 14).frame(height: 36)
                            .background(active ? ADLColor.navy : Color.white)
                            .overlay(Capsule().stroke(active ? Color.clear : ADLColor.lineStrong, lineWidth: 1))
                            .clipShape(Capsule())
                    }
                }
            }.padding(.horizontal, 16)
        }
    }
}

struct VerticalPickerBar: View {
    let categories: [SubmissionCategory]
    @Binding var selected: SubmissionCategory
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(categories) { cat in
                    let active = cat == selected
                    Button { selected = cat } label: {
                        VStack(spacing: 6) {
                            Image(systemName: cat.systemImage).font(.system(size: 18, weight: .semibold))
                                .foregroundColor(active ? .white : cat.tint)
                                .frame(width: 44, height: 44)
                                .background(active ? cat.tint : cat.tint.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            Text(cat.title).font(ADLFont.inter(11, .semibold))
                                .foregroundColor(active ? ADLColor.ink : Color(hex: 0x6b7280))
                                .lineLimit(1)
                        }
                    }
                }
            }.padding(.horizontal, 16)
        }
    }
}
```

- [ ] **Step 2: Build → SUCCEEDED. Step 3: Commit** `feat(ios): chip + vertical picker primitives`.

---

## Phase 1 — Profile (agent) [priority 1]

**Web ref:** `components/Screens/Profile.tsx` (50.8K). **Native:** `ProfileView` in `ADLViews.swift`. **Launch:** `ADL_ROLE=agent ADL_TAB=profile`.

Read `Profile.tsx` and record: hero (identity gradient circle + name + role + trust badges), the trust-progress card, the KPI grid (XP / Day streak / Badges / Synced), action rows (Rewards wallet, Badges, Missions), Daily progress widget, sign-out. Match each font size to the type-scale table.

### Task 1.1: Profile hero + trust card
**Files:** Modify `ADLViews.swift` (`ProfileView`)
- [ ] **Step 1:** Wrap screen in `VStack(spacing:0){ ADLScreenHeader(title:"Profile", trailing: settings gear) ; ScrollView{…} }` over `ADLColor.paper`.
- [ ] **Step 2:** Hero: `IdentityCircle(name:size:96)` (already exists), name `inter(24,.bold)`, role `inter(14)` inkMuted, trust badges via `TrustBadge`. Trust-progress card = `ADLCard` with `inter(15,.bold)` title + tier label, `ADLProgressBar(tint: gold)`, `inter(12)` "X XP to <next>".
- [ ] **Step 3: Build + screenshot** `ADL_ROLE=agent ADL_TAB=profile` → compare to web Profile hero. Iterate.
- [ ] **Step 4: Commit** `feat(ios): profile hero + trust card web parity`.

### Task 1.2: Profile KPI grid + action rows
- [ ] **Step 1:** 2×2 grid of `KpiTile` (XP tone navy, Day streak tone streak, Badges tone gold, Synced tone forest) using `LazyVGrid(columns: 2, spacing: 12)`.
- [ ] **Step 2:** Action rows as `ADLCard` rows: leading SF icon, title `inter(15,.semibold)`, trailing value + chevron. Rewards wallet → `serverXP`, Badges → `3/6`, Missions.
- [ ] **Step 3:** Sign-out button `SecondaryButtonStyle`, text danger.
- [ ] **Step 4: Build + screenshot + compare. Step 5: Commit** `feat(ios): profile kpis + rows web parity`.

---

## Phase 2 — Leaderboard / Analytics [priority 1]

**Web ref:** `components/Screens/Analytics.tsx` (45.9K) — role-based (agent leaderboard, admin impact, client analytics). **Native:** `AnalyticsView`. **Data:** add `AppState.loadLeaderboard()` hitting `/api/leaderboard` (model `LeaderboardEntry` already present per ADLServices edits). **Launch:** `ADL_ROLE=agent ADL_TAB=analytics`.

### Task 2.1: Leaderboard data loader
**Files:** Modify `ADLServices.swift`
- [ ] **Step 1:** Add `func loadLeaderboard() async` → `apiClient.fetchJSON([LeaderboardEntry].self, path:"/api/leaderboard")`, set `leaderboard`, guard `isLoadingLeaderboard`, set `leaderboardError` on throw.
- [ ] **Step 2: Build → SUCCEEDED. Step 3: Commit** `feat(ios): leaderboard loader`.

### Task 2.2: Leaderboard list UI
**Files:** Modify `ADLViews.swift` (`AnalyticsView`)
- [ ] **Step 1:** `ADLScreenHeader(title:"Leaderboard", trailing: share)`; `SectionLabel("Top contributors near you")` + title `inter(20,.bold)`.
- [ ] **Step 2:** "How scoring works" card (`ADLCard`, `SectionLabel` + body `inter(14)`), then rows: rank circle (1=gold,2=silver,3=bronze else navyWash), initials circle, name `inter(13,.bold)`, XP bar gradient gold→terra, XP value. `.task { await appState.loadLeaderboard() }`. Empty state "No contributor data yet." like web.
- [ ] **Step 3: Build + screenshot vs `.playwright-mcp/task42-04-analytics.png`. Step 4: Commit** `feat(ios): leaderboard web parity`.

---

## Phase 3 — Home / Map [priority 2]

**Web ref:** `components/Screens/Home.tsx` (42.8K) + `HomeMap.tsx`. **Native:** `AgentHomeView` + `FieldMapKitView`. **Constraint:** web uses Leaflet+CARTO; native MapKit — match all chrome; map tiles will differ (document as accepted delta, or evaluate a CARTO tile overlay via `MKTileOverlay` as the "make it better/closer" option).

### Task 3.1: Home header + Carte/Liste toggle + category filter
**Files:** Modify `ADLViews.swift`
- [ ] **Step 1:** Top region over map: brand row (BrandDiamond + "African Data Layer" `inter(15,.bold)` + "Zone active · Bonamoussadi…" `inter(11)` inkMuted) + profile/Connexion button right.
- [ ] **Step 2:** Category dropdown button (`Catégorie: …`) and segmented `FilterChipRow`-style Carte/Liste toggle (navy active).
- [ ] **Step 3:** Floating Contribute FAB bottom-right: 56×56 terra circle + plus (shadow-terra). Geofence note card bottom-left.
- [ ] **Step 4: Build + screenshot `ADL_ROLE=agent ADL_TAB=home` vs `.playwright-mcp/task42-03-home-agent.png`. Step 5: Commit** `feat(ios): home map chrome web parity`.

### Task 3.2 (optional improvement): CARTO tile overlay
- [ ] **Step 1:** Add `MKTileOverlay(urlTemplate:"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png")` to the map to approach web tiles. Build + screenshot + commit. (Skip if MapKit default is accepted.)

---

## Phase 4 — Contribute flow [priority 2]

**Web ref:** `components/Screens/ContributionFlow.tsx` (142.3K — the largest). **Native:** `ContributionView`. Decompose by step. Read each step section in the web file and mirror.

### Task 4.1: Step scaffold + progress
- [ ] **Step 1:** `ADLScreenHeader(title:"Capture", onBack:)` + step progress indicator (dots or bar) matching web. State machine: category → photo → location → required fields → review.
- [ ] **Step 2: Build + screenshot + commit** `feat(ios): contribute scaffold`.

### Task 4.2: Step 1 vertical picker
- [ ] **Step 1:** Use `VerticalPickerBar` + selected category description card. **Step 2:** Build + screenshot vs web step 1 + commit.

### Task 4.3: Step 2 photo capture
- [ ] **Step 1:** Live camera CTA (`btn-cta` terra) + captured thumbnail; "live photos only" note. **Step 2:** Build + screenshot + commit.

### Task 4.4: Step 3 GPS + Step 4 required fields + Step 5 review/submit
- [ ] **Step 1:** GPS capture card (lat/long/accuracy via `LocationProvider`). **Step 2:** Required fields from `VerticalConfig.all[cat].requiredFields` rendered as `ADLInputField`s. **Step 3:** Review summary + submit (`PrimaryButtonStyle`) → `appState` enqueue. **Step 4:** Build + screenshot each + commit per step.

---

## Phase 5 — Admin screens [priority 3]

**Web refs:** `AdminQueue.tsx` (125.6K), `AgentPerformance.tsx`. **Native:** `AdminReviewView`, `AgentPerformanceView`. **Launch:** `ADL_ROLE=admin`.

### Task 5.1: Admin queue cards
- [ ] **Step 1:** `ADLScreenHeader(title:"Queue")` + submission cards: thumbnail, category, `RiskBadge`, `TrustBadge`, `StatusBar` strip, approve/reject actions. **Step 2:** Build + screenshot `ADL_TAB=adminReview` + commit.

### Task 5.2: Agent performance
- [ ] **Step 1:** KPI grid (`KpiTile`) + agent rows with trust + metrics. **Step 2:** Build + screenshot `ADL_TAB=agentPerformance` + commit.

---

## Phase 6 — Client dashboards [priority 3]

**Web refs:** `DeltaDashboard.tsx` (56.4K), `InvestorDashboard.tsx`, `Analytics.tsx` (client). **Native:** `ClientDashboardView` (+ add Investor/Insights if matching web tab set). **Charts:** use Swift Charts to mirror `WeeklyBarChart.tsx` (navy/terra 7-bar). **Launch:** `ADL_ROLE=client`.

### Task 6.1: Delta dashboard KPIs + weekly chart
- [ ] **Step 1:** `ADLScreenHeader(title:"Delta")` + KPI grid + Swift `Chart { BarMark … }` navy/terra. **Step 2:** Build + screenshot vs `.playwright-mcp/task42-06-delta-dashboard.png` + commit.

### Task 6.2: Insights / Investor (if web parity requires all client tabs)
- [ ] **Step 1:** Mirror remaining client tabs (Dashboard `LayoutDashboard`, Insights `TrendingUp`). Update `AppReleaseMode.tabs(.client)` to match web 5-tab set `[clientDashboard, investor, home, insights, profile]` (add routes + views). **Step 2:** Build + screenshot vs `task42-07/08/12` + commit.

---

## Phase 7 — Secondary screens

Mirror each from its web source, wrapping in `ADLScreenHeader`, composing primitives:

### Task 7.1: Rewards catalog — `RewardsCatalog.tsx` → `RewardsView` (`RewardCard` exists). Build + screenshot + commit.
### Task 7.2: Submission queue — `SubmissionQueue.tsx` → `SubmissionQueueView`. Build + screenshot + commit.
### Task 7.3: Point details — `Details.tsx` → `PointDetailSheet` (BottomSheet style). Build + screenshot + commit.
### Task 7.4: Settings — `Settings.tsx` → add `SettingsView` (language toggle, logout, accessibility, links). Wire from Profile gear. Build + screenshot + commit.
### Task 7.5: Quality / Forgot password / Privacy / Terms — `QualityInfo.tsx`, `ForgotPassword.tsx`, `PrivacyPolicy.tsx`, `TermsOfUse.tsx` → simple content screens with `ADLScreenHeader`. Build + screenshot + commit each.

---

## Phase 8 — Cross-cutting polish

### Task 8.1: Per-screen headers audit — ensure every screen uses `ADLScreenHeader` with correct title/subtitle/trailing matching web. Build + commit.
### Task 8.2 (decision): Bilingual EN/FR — web is bilingual; native is English-only. If parity requires FR: add `@AppStorage("adl_lang")` + `t(en,fr)` helper on AppState, thread through views. Large; scope separately. Build + commit.
### Task 8.3: Motion parity — `active:scale-95` already on buttons; add `surface-reveal`/sheet-enter equivalents where web animates. Respect Reduce Motion. Build + commit.
### Task 8.4: Final pass — run through every tab in all 3 roles, screenshot each, diff against web, fix stragglers. Commit. Close `africandatalayer-955`.

---

## Self-Review notes
- **Spec coverage:** every web screen in `components/Screens` is assigned a task (Splash/Auth/shell already done in prior session; Profile→Phase1, Analytics→2, Home→3, Contribute→4, Admin→5, Client→6, Rewards/Queue/Details/Settings/Quality/Forgot/Privacy/Terms→7). InvestorDashboard/ClientAccount/CommunicationsPanel/DataCompliance/IpReport: only port if reachable in the web tab/route set for the shipped roles — add to Phase 7 if needed.
- **Type consistency:** all tasks consume the Phase-0 primitives by the exact names defined (`ADLScreenHeader`, `KpiTile`, `RiskBadge`, `TrustBadge`, `SectionLabel`, `ADLPill`, `FilterChipRow`, `VerticalPickerBar`, `ADLChipItem`) and existing `ADLColor`/`ADLFont`/`ADLRadius`/`ADLCard`/`ADLInputField`/`ADLProgressBar`/`IdentityCircle`/`BrandDiamond`.
- **No placeholders:** primitive code is complete; screen tasks specify exact web ref, native target, measurements via the type scale, and the build+screenshot+commit loop.
- **Map caveat** documented (Leaflet vs MapKit) with an optional CARTO-tile improvement task.
