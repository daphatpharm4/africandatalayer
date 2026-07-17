# Impeccable web and native audit

Date: 17 July 2026  
Scope: production field web app, tenant console, native iOS app, and native Android app  
Standards: WCAG 2.2 AA, ADL design context, Impeccable's 23 command lenses

## Outcome

The production console incident is resolved and verified. The live `/console` route now serves hashed production assets rather than `localhost:3000`, the manifest is valid JSON, the invite flow protects account identity and existing roles, and a bilingual sign-out path is available.

The wider product is not yet release-ready as one cross-platform experience. The strongest surfaces are the field-web onboarding and the repaired console. The largest remaining risks are forced portrait use, disabled web zoom, incomplete Android native functionality, mixed-language native states, and fixed-size iOS typography.

Technical health: **12/20**. UX heuristic health: **27/40**.

| Surface | Health | Verified strengths | Main risk |
| --- | ---: | --- | --- |
| Field web | 13/20 | Map-native onboarding, clear action hierarchy, production performance 94 | Landscape is blocked; zoom disabled; one contrast failure |
| Console | 15/20 | Invite safety fixed, logout restored, responsive navigation, accessibility 96 | LCP 3.7s, 186 KiB unused JS, missing `main` landmark on signed-out state |
| iOS | 12/20 | Debug build passes; coherent ADL tokens; useful map and sync hierarchy | Mixed-language runtime states and non-scaling custom typography |
| Android | 7/20 | Shared tokens, role routing shell, 48dp controls | Slice 1 shell only; camera/location gateways are NoOp; build not verifiable without Java |

## Release findings

### P1 — Serious

1. **Forced orientation and disabled zoom block mobile access** — `africandatalayer-9gz`

   - Web: `index.html:5` sets `maximum-scale=1.0, user-scalable=no`; `index.html:19` and `index.css:565` cover the entire app in short landscape viewports.
   - Android: `android/app/src/main/AndroidManifest.xml:23` forces portrait.
   - Manual evidence: at 844×390 the overlay occupied the full viewport while Tab focus moved to the hidden “Passer” button behind it.
   - Impact: users who mount a device, cannot rotate it, need magnification, or use landscape cannot complete any task.
   - WCAG: 1.3.4 Orientation, 1.4.4 Resize Text, and 2.4.11 Focus Not Obscured.

2. **Native localization and text scaling are incomplete** — `africandatalayer-mmc`

   - iOS location states are assigned as hard-coded English strings in `ADLServices.swift:1740-1802` after the initial localized value.
   - `ADLViews.swift:2161`, missions/badges in `ADLServices.swift:244-260`, and `ADLDesignSystem.swift:372` expose more English copy in French mode.
   - Android sync state is English-only in `AppState.kt:33-48`.
   - `ADLDesignSystem.swift:8` uses fixed `Font.custom` sizes without a Dynamic Type text style; the native views contain many 9–12pt labels and line limits.
   - Impact: French users receive contradictory state information, and low-vision users may see clipped or unreadably small operational text.
   - WCAG: 1.3.1 Info and Relationships, 1.4.4 Resize Text, 3.1.2 Language of Parts, and 3.2.4 Consistent Identification.

3. **Android native is a foundation shell, not functional parity** — existing epic `africandatalayer-vwh`, foundation `africandatalayer-sw4`

   - `AdlAndroidApp.kt` holds only in-memory route/language state.
   - `AppShell.kt` renders summaries and KPI cards rather than working capture, map, review, export, or account flows.
   - `PlatformAdapters.kt` explicitly reports that location and camera are “not wired in Slice 1”; permission gateways always deny.
   - Impact: Android field agents cannot perform the product's primary job in the native app.

### P2 — Moderate

4. **Web accessibility semantics need two focused fixes** — `africandatalayer-3fn`

   - The 11px terracotta onboarding eyebrow is 3.71:1 on white; WCAG requires 4.5:1 for this text size (`Splash.tsx:217`).
   - The signed-out console has no `main` landmark.
   - Production Lighthouse: web accessibility 86; console accessibility 96. Axe reports one field-web violation and zero violations on the signed-out `console.html` entry.
   - WCAG: 1.3.1 Info and Relationships and 1.4.3 Contrast Minimum.

5. **Console startup is heavier than the signed-out experience requires** — `africandatalayer-0hu`

   - Production mobile Lighthouse: performance 87, FCP 1.6s, LCP 3.7s, TBT 10ms, CLS 0.
   - Approximately 186 KiB of JavaScript is unused on the signed-out entry, mainly shared application chunks.
   - Field web is healthier: performance 94, FCP 1.7s, LCP 2.9s, TBT 30ms, CLS 0, total transfer about 399 KiB.

6. **Accessibility is not yet a release gate** — `africandatalayer-jic`

   - There is no committed axe test suite or recorded VoiceOver/TalkBack end-to-end protocol.
   - Entry-flow keyboard focus, accessible names, 44px targets, 200% text scaling, and reduced-motion behavior passed in headless Chrome.
   - A real screen-reader interaction session was not possible in this non-interactive audit environment, so WCAG conformance must remain **indeterminate**, not “passed.”
   - Android unit/lint/assemble could not start because the machine has no Java runtime; existing issue `africandatalayer-cbv` already tracks that verification gap.

### P3 — Minor polish

7. **Review queues contain three design-system anti-patterns** — `africandatalayer-bn2`

   - Decorative side-tab border: `AdminQueue.tsx:1564`.
   - Gray text on red status surfaces: `AdminQueue.tsx:2383` and `SubmissionQueue.tsx:293`.
   - These are consistency and status-legibility issues, not release blockers.

## What is working well

- The field-web onboarding has a decisive map-native hierarchy, strong navy/white daylight contrast, clear progress, and 44–56px focusable controls.
- The cross-platform ADL navy, terracotta, forest, gold, spacing, card, and target-size tokens are unusually consistent.
- Web reduced-motion handling is effective: no infinite animation remained under `prefers-reduced-motion: reduce` in the tested entry flow.
- The repaired console prevents invite-account mismatch and role downgrades, exposes recovery copy, and provides a visible bilingual logout.
- iOS builds and launches in an iPhone 17 Pro simulator, with strong bottom navigation and legible sync state hierarchy.
- Production manifests and asset entry points are valid; no live console bundle references Vite development endpoints.

## All 23 Impeccable lenses

| Command lens | Audit result |
| --- | --- |
| `craft` | Synthesized product, design-system, visual, technical, and release evidence; no broad redesign was applied during an audit. |
| `init` | Added `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, and live-mode configuration. |
| `document` | Documented the shared web, SwiftUI, and Compose design language and its accessibility constraints. |
| `extract` | Confirmed shared color/radius/spacing primitives; extraction is not the immediate bottleneck. |
| `shape` | Ordered remediation around access, task completion, localization, semantics, then polish. |
| `critique` | Reviewed hierarchy, clarity, trust, control, error recovery, and emotional tone on all four surfaces. |
| `audit` | Ran production Lighthouse, axe, keyboard/accessibility-tree checks, source analysis, detector checks, builds, and live verification. |
| `polish` | Identified launch blockers separately from P2/P3 finish work. |
| `bolder` | No amplification recommended; the onboarding and primary CTAs already have sufficient authority. |
| `quieter` | Reduce decorative side-border/status styling; existing motion already respects reduced-motion preference. |
| `distill` | Keep the signed-out console entry independent from unused application code and preserve its single clear action. |
| `harden` | Invite identity, role preservation, logout, manifest, error recovery, localization, and orientation edge cases were examined. |
| `onboard` | Onboarding is visually strong; its terracotta eyebrow is the confirmed accessibility defect. |
| `animate` | Motion language is coherent and reduced-motion passes; the forced rotate-phone overlay should be removed, not refined. |
| `colorize` | Palette use is consistent; terracotta at 11px on white fails contrast. |
| `typeset` | Web Inter hierarchy is coherent; iOS fixed custom sizes and dense 9–12pt labels need scalable styles. |
| `layout` | Portrait layouts are strong; short-landscape web and Android orientation support fail. |
| `delight` | Rewards and progress feel operational, but untranslated badge/mission copy breaks trust. |
| `overdrive` | Extraordinary effects are intentionally deferred until access, parity, and reliability are complete. |
| `clarify` | Invite recovery copy is improved; native mixed-language states and Android summary-only screens remain unclear. |
| `adapt` | Responsive web/console entry views pass portrait checks; orientation, zoom, Dynamic Type, and Android parity do not. |
| `optimize` | Production web performance is good; console route splitting and LCP are the main opportunities. |
| `live` | Live mode was configured, boot-checked, and stopped cleanly. Interactive variant selection was unavailable, so no variant was applied. |

## Evidence and limitations

- Production Vercel status for commit `fa40338`: success.
- Live `/console`: hashed asset `console-CU05O5WF.js`; no `localhost:3000`, `@vite/client`, or React refresh references.
- Production `site.webmanifest`: valid JSON.
- Focused console incident suite: 75 tests passed; TypeScript and production build passed.
- iOS: Xcode Debug simulator build succeeded and the app launched on iPhone 17 Pro, iOS 26.5.
- Android: static review completed; Gradle verification stopped before execution because no Java runtime is installed and no device/emulator is available.
- Browser: desktop/mobile screenshots were reviewed for field web and signed-out console. Authenticated console coverage came from source/tests because an authenticated production browser session was not available.
- Accessibility: automated and manual keyboard/accessibility-tree checks completed. VoiceOver/TalkBack interaction remains required before claiming WCAG 2.2 AA conformance.
- Assessment independence was sequential because this session did not have authorization to delegate to subagents.

## Recommended sequence

1. Ship `africandatalayer-9gz` first: remove orientation gates and restore zoom.
2. Complete `africandatalayer-mmc`, then test iOS with Dynamic Type and both native apps in French and English.
3. Continue the existing Android parity epic before positioning Android native as a field-capable release.
4. Apply the small semantic/contrast fixes in `africandatalayer-3fn`.
5. Split the console entry under `africandatalayer-0hu` and add the release gates in `africandatalayer-jic`.
6. Finish the detector cleanup in `africandatalayer-bn2` during the final polish pass.
