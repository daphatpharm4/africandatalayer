# Native iOS — Web Visual Parity Handoff

Goal: make the native SwiftUI app (`ios/App/App.xcodeproj`) look **identical to the
web app** at `https://www.app.africandatalayer.com/`, screen for screen.

Tracking issue: `africandatalayer-955`. Branch: `ios`.

---

## Source layout (native)

All native code lives in `ios/App/App/Native/`:

| File | Role |
|------|------|
| `ADLNativeApp.swift` | `@main` App entry, root environment font/tint |
| `ADLDesignSystem.swift` | Color tokens, radii, fonts, shared primitives, button styles |
| `ADLModels.swift` | Enums + models (UserRole, AppRoute, SubmissionCategory, Reward, Badge, Mission…) |
| `ADLServices.swift` | `AppState` (ObservableObject) + `ADLAPIClient` + LocationProvider |
| `ADLViews.swift` | All screen views (~2400 lines) |

Web reference source (mirror these for parity): `components/Screens/*.tsx`,
`components/Navigation.tsx`, `tailwind.config.js`, `index.css`.

---

## DONE this session (committed + pushed, verified on simulator)

Commits on `ios`: `bc87e6f`, `4b8c253`, `a906bf8`, `6e5248e` (+ asset cleanup `5a2bdc3` prior).

### Design foundation — `ADLDesignSystem.swift`
- `ADLColor` rewritten to EXACT hex from `tailwind.config.js` via `Color(hex:)`:
  navy `0f2b46` (+dark `0b2236`, mid `1d4565`, wash `f2f6fa`, border `d5e1eb`),
  terra `c86b4a` (+dark `b85f3f`, wash `fff8f4`), forest `4c7c59` (+dark/wash),
  gold `f4c317` (+wash), amber `d97706`, streak `6b46c1`, ink `1f2933`
  (+muted `4b5563`), danger `c53030`, page `f9fafb`, line gray-100 `f3f4f6`,
  lineStrong gray-200 `e5e7eb`.
- `ADLRadius`: card 16 (rounded-2xl), pill 28, statTile 14, button 16.
- `ADLCard`/`StatTile`/`BadgeTile` → radius + `shadow-sm` (0,1 / 0.05 black).
- Buttons match `.btn-*`: `PrimaryButtonStyle` (navy h56 r16 scale-95 shadow),
  `CTAButtonStyle` (terra), `SecondaryButtonStyle` (ghost, gray-200 border).
- `ADLFont` Inter type ramp + `Color(hex:)` helper.

### Inter font (bundled)
- `ios/App/App/Fonts/Inter-VariableFont.ttf` (Google variable font, family "Inter").
- `Info.plist` `UIAppFonts` registered.
- `project.pbxproj`: file ref + build-file + App group + Resources phase (IDs
  `A100…0007` / `A100…0017`).
- Root `.environment(\.font, ADLFont.body)` in `ADLNativeApp`.
- Deployment target bumped **15.0 → 17.0** (needed for `.tracking`,
  `UnevenRoundedRectangle`).

### Screens matched to web
- **Splash** (`SplashView`): 5-slide onboarding carousel mirroring
  `components/Screens/Splash.tsx` (welcome / permissions / verticals / rewards /
  ready). Navy hero gradient + per-slide hero scenes (`HeroWelcome`,
  `HeroPermissions`, `HeroVerticals`, `HeroRewards`, `HeroReady`), `BrandDiamond`
  logo, eyebrow/title/body sheet, progress dots, Next / Sign In·Connexion /
  Create Account / Browse as Guest. `BootSplashView` for bootstrap.
- **Auth** (`AuthView`): mirrors `components/Screens/Auth.tsx` — back chevron,
  white logo tile + BrandDiamond, Welcome back / Join the network + subtitle,
  Sign in with Apple (navy) / Continue with Google (ghost), `ADLInputField`
  (h56 r16, leading icon, eye toggle), Sign in→ submit, Forgot password,
  encrypted-shield row, signin/signup toggle. DEMO ACCESS removed.
- **App shell** (`AppShellView`): custom chrome replacing system TabView/NavView.
  `ADLSyncBar` (green wash, mirrors web SyncStatusBar) + `ADLTabBar` (custom
  bottom bar: navy-wash active pill + inset ring, terra Contribute, gray rest)
  mirroring `components/Navigation.tsx`.

### Behavior fixes
- **API host**: `ADLAPIClient.baseURL` was stale `africandatalayer.vercel.app`
  → now `https://www.app.africandatalayer.com` (real DB + envs). Override via
  `ADL_API_BASE` env. Auth flow is Auth.js credentials w/ CSRF — already correct.
- **Browse as Guest** works: `AppState.isGuest` + `continueAsGuest()`; RootView
  shows shell when `isAuthenticated || isGuest`; reset on signOut.
- **Splash once**: `@AppStorage("adl_has_seen_splash")` in `RootView` — shows
  only first launch.
- Agent tabs aligned to web: Explore / Contribute / Leaderboard / Profile.
  Admin gained Map tab.
- Default sync message → "All synced. Ready to capture."

### DEBUG-only test hooks (in `#if DEBUG` / env)
- `ADL_START_AUTH=1` → RootView starts at AuthView.
- `ADL_DEMO=1 ADL_ROLE=agent|admin|client ADL_TAB=<route>` → `bootstrap()`
  auto-enters demo + selects tab (for screenshotting authed screens).
- `ADL_API_BASE=<url>` → override API host.

---

## STILL TODO — interior screen *content* not yet web-matched

Each needs: read web `.tsx` → rewrite native view w/ ADL tokens/Inter → build →
screenshot-compare. Per-screen custom header (back + centered title + trailing
action) mirroring web `ScreenHeader`/`.screen-header` is still missing on most.

Priority order set by product owner: Profile+Analytics → Home/Map → Contribute.

| Screen | Native view | Web source | Notes |
|--------|-------------|-----------|-------|
| Profile | `ProfileView` | `Profile.tsx` | Content renders w/ new tokens but NOT compared to web; verify hero, stat grid, rows, sign-out |
| Leaderboard/Analytics | `AnalyticsView` | `Analytics.tsx` | Role-based; agent leaderboard, client impact |
| Home / Map | `AgentHomeView` + `FieldMapKitView` | `Home.tsx` + `HomeMap.tsx` | Web uses Leaflet/CARTO; native MapKit — CANNOT be pixel-identical. Match header, Carte/Liste toggle, category dropdown, FAB, geofence note, point detail sheet |
| Contribute | `ContributionView` | `ContributionFlow.tsx` | Multi-step: vertical picker, photo, GPS, required fields, submit |
| Admin Queue | `AdminReviewView` | `AdminQueue.tsx` | Risk/trust/status badges |
| Admin Agents | `AgentPerformanceView` | `AgentPerformance.tsx` | |
| Client Delta | `ClientDashboardView` | `DeltaDashboard.tsx` | Recharts → Swift Charts |
| Rewards | `RewardsView` | `RewardsCatalog.tsx` | |
| Queue | `SubmissionQueueView` | `SubmissionQueue.tsx` | Offline sync list |
| Details | `PointDetailSheet` | `Details.tsx` | |
| Settings | (find) | `Settings.tsx` | Language, logout, a11y |

Cross-cutting still missing:
- Per-screen `ScreenHeader` (back + title + share/refresh) like web — currently
  nav bar hidden, screens have ad-hoc/no headers.
- Bilingual EN/FR: native is English-only (no `language` in AppState). Web is
  bilingual. Decide whether to add a language toggle.
- Recharts → Swift Charts for dashboards.
- Map can't match Leaflet exactly; consider a tile-based lib if true parity
  required, else accept MapKit delta.

---

## Build / test loop (Codex: use this)

Simulator: iPhone 17 Pro, iOS 26.5, UDID `B103631B-81A0-4FE2-8301-C17E1490BFDB`.

```bash
# build
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD SUCCEEDED|BUILD FAILED"

# install (note: skip Index.noindex copy)
APP=$(find ~/Library/Developer/Xcode/DerivedData -name App.app \
  -path "*Debug-iphonesimulator*" | grep -v Index.noindex | head -1)
xcrun simctl install BOOTED "$APP"

# launch a specific authed screen for screenshot
SIMCTL_CHILD_ADL_DEMO=1 SIMCTL_CHILD_ADL_ROLE=agent SIMCTL_CHILD_ADL_TAB=profile \
  xcrun simctl launch BOOTED com.africandatalayer.app
sleep 6; xcrun simctl io BOOTED screenshot /tmp/shot.png

# force splash-seen (skip onboarding)
xcrun simctl spawn BOOTED defaults write com.africandatalayer.app \
  adl_has_seen_splash -bool YES
```

Capture web reference with Playwright at 390×844; live screens already saved in
`.playwright-mcp/` (`task42-*`, `web-auth.png`, `web-01-splash.png`).

SourceKit shows "No such module 'UIKit'" / "Cannot find type" single-file noise —
ignore; cross-file types resolve under `xcodebuild`.

---

## Gotchas
- iOS deployment target now 17.0 — fine (runtime is 26.x).
- `Package.resolved` shows deleted in git status (Capacitor SPM leftover) — unrelated.
- `.DS_Store` noise in status — ignore.
- Whole-module compile verified green after every change above.
