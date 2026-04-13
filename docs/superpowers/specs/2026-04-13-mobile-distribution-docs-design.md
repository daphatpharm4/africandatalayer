# Mobile Distribution Documentation -- Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Scope:** Two documents capturing the mobile app store shipping strategy for African Data Layer

---

## Context

ADL is a React 19 + Vite 6 + TypeScript SPA deployed on Vercel. The team evaluated two paths to ship on the Apple App Store and Google Play Store:

1. **Capacitor wrap** -- reuse ~95% of the existing codebase, add native plugins for camera/GPS/push, generate Xcode + Android Studio projects. ~5 weeks to both stores.
2. **Native rebuild** -- Swift/SwiftUI for iOS, Kotlin/Jetpack Compose for Android. Full rewrite of all 16 screens, offline queue, gamification, maps. ~25 weeks per platform.

**Decision:** Capacitor now. Native deferred until post-PMF with proven demand and funding.

---

## Deliverables

### Doc 1: `docs/team/09-mobile-distribution.md`

**Audience:** Engineering team, cloud engineer, service delivery manager
**Format:** Matches team doc series (Author/Date/Status/Predecessors header, numbered ToC, tables)
**Purpose:** Execution-ready technical guide + decision record

**Sections:**

1. **Decision Summary** -- Capacitor chosen over native rebuild. One paragraph: what, why, when to revisit.

2. **Codebase Audit** -- Table of current app inventory by layer:
   - Screens (16 files, 10,946 lines)
   - Other components (19 files, 2,450 lines)
   - App.tsx (490 lines -- state, routing, auth)
   - Client lib (12 files, 1,344 lines -- offline queue, auth, GPS, sync)
   - Server lib (20+ files, 6,302 lines -- fraud, risk, snapshots, trust)
   - API endpoints (12 files, 3,773 lines)
   - Shared types (9 files, 2,026 lines)
   - Tests (30 files, 2,701 lines)
   - Total: ~130+ files, ~30,500 lines
   - Note: server code is platform-agnostic, only client layer needs adaptation.

3. **Architecture** -- How Capacitor wraps the Vite build:
   - Directory structure: `ios/`, `android/`, `capacitor.config.ts` alongside existing project
   - Build flow: `vite build` -> `dist/` -> `npx cap sync` -> native projects
   - Full `capacitor.config.ts` code block (appId, appName, webDir, server scheme, plugin config, Android minWebViewVersion) -- include the literal TypeScript, not just a description
   - API base URL strategy: web uses relative `/api`, native uses absolute Vercel URL

4. **Native Capability Mapping** -- Table with columns: Current Web API | Capacitor Plugin | Why Upgrade
   - `navigator.geolocation` -> `@capacitor/geolocation` (background GPS, better accuracy)
   - `<input capture="environment">` -> `@capacitor/camera` (native UI, EXIF control)
   - `IndexedDB` -> works as-is in WebView
   - `fetch()` -> works as-is (change base URL)
   - Google Fonts -> bundle Inter locally (offline-first)
   - New: `@capacitor/push-notifications`, `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capacitor/app`, `@capacitor/network`

5. **iOS Submission Guide**
   - Apple Developer Program ($99/year, D-U-N-S if org)
   - Minimum target: iOS 15+
   - App Review risks table: Guideline 4.2 (minimum functionality), 2.1 (performance), 5.1.1 (data collection), 5.1.2 (data use) -- each with mitigation
   - Info.plist privacy strings: NSCameraUsageDescription, NSLocationWhenInUseUsageDescription
   - Signing: Xcode automatic signing, provisioning profiles
   - TestFlight beta flow
   - App Store Connect listing requirements: screenshots, description, privacy labels

6. **Android Submission Guide**
   - Google Play Developer Account ($25 one-time)
   - Minimum target: API 24 (Android 7.0) for low-end field devices
   - Must target API 34+ (Capacitor 6 default)
   - 64-bit requirement (Capacitor provides both ABIs)
   - APK size budget: target under 15MB
   - Android App Bundle (AAB) required
   - WebView minimum version enforcement
   - Data safety form declarations
   - Play App Signing enrollment
   - Testing tracks: internal -> closed beta (field agents) -> production

7. **Implementation Roadmap** -- Week-by-week over 5 weeks:
   - Week 1: Capacitor setup, plugin installs, native project generation, Vite config changes
   - Week 2: Platform detection wrapper, plugin substitutions (camera, GPS), font bundling, API URL logic, splash/icon assets
   - Week 3: iOS -- Xcode config, signing, Info.plist, testing, TestFlight submission, App Store listing prep
   - Week 4: Android -- Android Studio config, signing keystore, low-end device testing, AAB build, Play Console internal track, listing prep
   - Week 5: Both store submissions, review response, phased rollout plan

8. **Native Rebuild Assessment** -- Decision record for the deferred path:
   - What native means: two separate apps (Swift/SwiftUI + Kotlin/Compose), each reimplementing all client code
   - Per-platform timeline breakdown table (13 phases, ~25 weeks iOS, ~24 weeks Android)
   - Cost estimate: $150K-$300K for two senior native devs over 6 months
   - 3x maintenance burden: every feature change in React + Swift + Kotlin
   - Decision framework: revisit after PMF, 10K+ users, revenue. If needed, start with Android-native only (95% of user base).

9. **Cost Summary** -- Table:
   - Apple Developer Program: $99/year
   - Google Play Developer: $25 one-time
   - Capacitor: free (open source)
   - Year 1 total: $124

10. **Risks & Mitigations** -- Table:
    - App Review rejection (4.2) -> demonstrate native plugin usage
    - WebView performance on cheap Android -> enforce minWebViewVersion, test on API 24 device
    - Font loading offline -> bundle Inter in the app
    - Cookie/auth in native WebView -> androidScheme: 'https' in Capacitor config
    - Store listing localization -> EN primary, FR as second language

---

### Doc 2: `docs/pitch/06-mobile-distribution-strategy.md`

**Audience:** Investors, accelerator committees, B2B buyers
**Format:** Matches pitch deck series (slide-by-slide: title, core message, slide copy, proof points, suggested visual, CTA)
**Purpose:** Demonstrate credible mobile distribution strategy with capital efficiency

**Slides:**

1. **Dual-Store Distribution**
   - Core message: ADL reaches agents on their own devices via App Store and Google Play
   - Proof points: 16 production screens, 30K+ lines of code, offline-first architecture already built
   - CTA: Platform-native distribution removes the last barrier to field agent adoption

2. **Technology Approach**
   - Core message: Capacitor wraps the proven web app with native device access -- no 6-month rebuild
   - Proof points: ~95% code reuse, native camera/GPS/push via plugins, real Xcode + Android Studio projects
   - CTA: Ship in weeks, not quarters

3. **Cost Efficiency**
   - Core message: $124/year to reach both stores vs $150K-$300K for native rebuild
   - Proof points: Apple ($99/yr) + Google ($25 one-time), Capacitor is open source, no additional infrastructure cost (same Vercel backend)
   - CTA: Capital-efficient distribution that preserves runway for data operations and agent compensation

4. **Android-First, Field-First**
   - Core message: 95%+ of field agents in Cameroon use Android -- the app is optimized for their reality
   - Proof points: Targets Android 7.0+ (API 24), under 15MB install, 44px touch targets, offline queue with 75-item buffer, sunlight-readable contrast
   - CTA: Built for a cracked-screen phone on 2G in bright Douala sunlight

5. **Path to Native**
   - Core message: Clear upgrade path as the platform scales -- Capacitor now, Kotlin-native at 10K+ users, full native with funding
   - Proof points: Server API is platform-agnostic (12 endpoints, unchanged), Instagram/Discord/Airbnb all shipped hybrid first
   - CTA: Validate the product before committing to 3x maintenance

6. **Timeline**
   - Core message: 5 weeks from decision to both app stores
   - Proof points: Week 1 setup, Week 2 adaptation, Week 3 iOS, Week 4 Android, Week 5 submission
   - CTA: Agents collecting data from native apps by Q3 2026

---

## Non-Goals

- These docs do NOT include Capacitor implementation code or config files (that comes in the implementation plan)
- These docs do NOT replace the existing system design docs -- they extend the distribution strategy
- No PWA/service worker documentation (not part of the current architecture)
