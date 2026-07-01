# Android Native iOS Parity Design

Date: 2026-07-01
Status: Approved for implementation planning
Bead epic: `africandatalayer-vwh`

## Problem

African Data Layer ships a React/Capacitor Android shell, but the iOS app has moved into a richer native SwiftUI implementation under `ios/App/App/Native/`. The Android experience needs to mirror that native iOS app across all roles while preserving ADL's field-first product constraints: bright sunlight, one-handed outdoor use, intermittent connectivity, limited battery, bilingual copy, and trust-preserving review workflows.

## Goal

Create a native Android app in Kotlin and Jetpack Compose that mirrors the current SwiftUI iOS app across agent, admin, client, and point-operator roles. The Android app must support Android 10+ (API 29), use the existing ADL backend APIs, preserve the ADL brand system, and ship in phased parity slices so each milestone builds and verifies independently.

## Non-Goals

- Replacing or removing the existing Capacitor Android assets in the first slice.
- Rewriting backend APIs before a parity gap proves it is required.
- Building an Android-only product direction that diverges from the iOS native app.
- Creating a dark glossy dashboard, game-like visual skin, or decorative motion layer.

## Decisions

Use native Kotlin + Jetpack Compose in phased vertical slices. This was selected over a big-bang native rewrite and over a Capacitor-only Android polish pass because "mirroring iOS" requires native navigation, platform camera/location behavior, offline state, and Android-specific performance control. Capacitor remains useful as the existing web distribution path, but it mirrors web rather than the SwiftUI iOS app.

Minimum Android version is Android 10 (API 29). The design target follows ADL field research for mid-range Samsung A-series, Tecno, and Infinix devices, including Android 10-13.

## Architecture

The Android native app lives under `android/` as a Gradle/Kotlin/Compose project. It coexists with current Capacitor-generated web assets until native parity is proven.

Core units:

- `design`: ADL color, typography, spacing, shape, and Compose component primitives matching `ADLDesignSystem.swift`.
- `model`: Kotlin models that mirror `ADLModels.swift` and decode the same API payloads.
- `network`: `AdlApiClient` mirroring `ADLAPIClient` endpoint behavior from `ADLServices.swift`.
- `store`: Room and DataStore persistence for queue, cached data, session, language, rewards wallet, and preferences.
- `sync`: WorkManager jobs for queued submissions, retry, and visible failure states.
- `platform`: CameraX, Fused Location Provider, network status, permission handling, and haptics.
- `ui`: Compose navigation, all role shells, shared screens, and role-specific screens.

The app shell mirrors iOS role routing:

- Agent tabs: home, contribute, analytics, profile.
- Admin tabs: admin review, home, analytics, agent performance, profile.
- Client tabs: client dashboard, investor, home, analytics, profile.
- Point-operator tabs: status, profile or password-change when required.

Boundary rule: mirror iOS behavior and data contracts first. Adapt interactions only when Android platform conventions improve usability without changing the ADL workflow.

## UX And Brand

Android should feel like the iOS native app's Android sibling, not an iOS skin. Material 3 mechanics can be used for Android-native structure, but ADL tokens remain canonical:

- Navy `#0f2b46`
- Gold `#f4c317`
- Terracotta `#c86b4a`
- Forest green `#4c7c59`
- Paper `#f9fafb`
- Ink `#1f2933`

Design rules:

- Light-mode-first and daylight-readable.
- 48dp minimum touch targets; 56dp for primary field actions.
- Bottom navigation and app bars follow Android expectations with ADL styling.
- Field actions stay reachable in the thumb zone.
- Rewards, badges, missions, and XP use credible operational progress cues.
- Bilingual EN/FR copy follows the iOS `t(en, fr)` behavior.
- Reduced motion and larger font settings must not break layouts.
- Avoid neon, crypto visual language, dark glossy dashboards, and decorative effects that compete with capture or review tasks.

Component parity targets:

- Cards, gradient heroes, progress bars, section headers, and identity circles.
- KPI tiles, trust badges, risk badges, mission rows, reward cards, and status pills.
- Review/action buttons, queue states, error states, and empty states.
- Role-aware bottom navigation and screen headers.

## Data Flow

Android uses the same server APIs as iOS and web:

- `/api/user`
- `/api/submissions`
- `/api/analytics`
- `/api/leaderboard`
- `/api/ai/search`
- point-operator endpoints already used by existing app code

ViewModels expose role-specific UI state through Kotlin `StateFlow`. Network responses are mapped into typed result states so the UI can distinguish unauthorized, offline, validation, storage/server, rate-limited, and unknown failures.

Room stores:

- queued contribution drafts
- sync error records
- cached points
- cached profile
- assignments
- rewards wallet
- last successful dashboard snapshots

DataStore stores:

- session flags
- language
- selected role and tab
- demo flags
- lightweight preferences

## Offline And Platform Behavior

The agent can capture, enrich, and queue submissions offline. Drafts are never silently dropped. WorkManager sync uses network constraints, capped retries, exponential backoff, and visible failure states.

CameraX captures live photos for field submissions. Gallery import is not allowed for field capture. The Fused Location Provider records GPS fix, accuracy, timestamp, and permission state before submit.

Profile, rewards, admin, and client surfaces may show cached data offline, but cached sections must include explicit stale/offline state and last-updated context. Stale data must never be presented as fresh.

## Role Parity Slices

### Slice 1: Native Foundation And All-Role Shell

Scaffold Gradle/Kotlin/Compose, design system, app state, routing, role tabs, auth/demo boot, language toggle, network/offline primitives, permissions, and smoke tests.

### Slice 2: Agent Parity

Mirror home map/list, contribute flow, queue, analytics, profile, rewards, badges, missions, XP, sync status, camera capture, and location capture.

### Slice 3: Admin Parity

Mirror review queue, risk/evidence cards, approve/hold/reject actions, assignments, leads/automation, communications dashboard, global map jump, and profile.

### Slice 4: Client Parity

Mirror delta dashboard, vertical selector, trends, anomalies, spatial intelligence, investor dashboard, and export-ready summaries.

### Slice 5: Point-Operator Parity

Mirror status, assignments, password change, profile, offline queue, scoped sync, and role gating.

## Error Handling

- Auth/session expiry returns to auth while preserving the draft queue.
- Permission denial shows task-specific recovery for camera, location, and notifications.
- Sync failures show retry action, failure reason, and last attempt time.
- Admin actions use optimistic UI only when rollback is possible.
- Client and admin dashboards show cached data with timestamp and network state.
- Unknown errors use concise bilingual copy and keep the user's next recovery action visible.

## Testing And Verification

Each slice must produce working, testable software.

Verification targets:

- JVM unit tests for model parsing, API error mapping, queue state transitions, rewards wallet math, and role tab routing.
- Compose UI tests for app shell, role switching or demo state, auth fallback, and primary role screens.
- Instrumented checks for CameraX permission path, location permission path, and WorkManager queue scheduling.
- Gradle gate with emulator: `./gradlew testDebugUnitTest connectedDebugAndroidTest assembleDebug`.
- Gradle gate without emulator: `./gradlew testDebugUnitTest assembleDebug`.
- Visual QA compares Android screenshots against iOS native hierarchy, spacing, ADL colors, and role flow behavior.

## Acceptance Criteria

- Android native app builds on Android 10+ target configuration.
- All iOS roles are represented in Android routing from the first slice.
- ADL design tokens and bilingual behavior are available from the foundation slice.
- Offline queue, cached state, and sync error surfaces are designed before feature screens depend on them.
- Camera, location, network, permissions, and haptics are isolated behind platform adapters.
- Later slices can implement role screens without redefining architecture or design tokens.

## Open Follow-Up For Implementation Plan

The implementation plan should start with Slice 1 only. Later role slices should each get their own execution plan after the foundation builds and verifies.
