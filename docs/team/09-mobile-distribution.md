# ADL Mobile Distribution Strategy

**Author:** Mobile Distribution Team (Swift Expert, App Store Engineer, Play Store Engineer)
**Date:** 2026-04-13
**Status:** Living document -- updates with each distribution phase
**Predecessors:**
- [02-system-design.md](./02-system-design.md) (System Design Expert)
- [03-cloud-engineering.md](./03-cloud-engineering.md) (Cloud Engineer)
- [08-service-delivery-project-plan.md](./08-service-delivery-project-plan.md) (Service Delivery Manager)

**Scope:** Mobile app store distribution strategy, Capacitor architecture, iOS and Android submission guides, native rebuild assessment, and implementation roadmap for African Data Layer

---

## Table of Contents

1. [Decision Summary](#1-decision-summary)
2. [Codebase Audit](#2-codebase-audit)
3. [Architecture](#3-architecture)
   - [How Capacitor Works](#how-capacitor-works)
   - [Directory Structure](#directory-structure)
   - [Build Flow](#build-flow)
   - [Capacitor Configuration](#capacitor-configuration)
   - [API Base URL Strategy](#api-base-url-strategy)
4. [Native Capability Mapping](#4-native-capability-mapping)
5. [iOS Submission Guide](#5-ios-submission-guide)
   - [Prerequisites](#prerequisites)
   - [App Review Risks](#app-review-risks)
   - [Info.plist Privacy Strings](#infoplist-privacy-strings)
   - [Signing and Distribution](#signing-and-distribution)
   - [App Store Listing Requirements](#app-store-listing-requirements)
6. [Android Submission Guide](#6-android-submission-guide)
   - [Prerequisites](#prerequisites-1)
   - [Android-Specific Optimizations](#android-specific-optimizations)
   - [Data Safety Form](#data-safety-form)
   - [Signing](#signing)
   - [Testing Tracks](#testing-tracks)
   - [Play Store Listing Requirements](#play-store-listing-requirements)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Native Rebuild Assessment](#8-native-rebuild-assessment)
   - [What It Means](#what-it-means)
   - [Per-Platform Timeline](#per-platform-timeline)
   - [Cost Estimate](#cost-estimate)
   - [Maintenance Burden](#maintenance-burden)
   - [Decision Framework](#decision-framework)
9. [Cost Summary](#9-cost-summary)
10. [Risks & Mitigations](#10-risks--mitigations)

---

## 1. Decision Summary

**Chosen approach: Capacitor hybrid wrapper over the existing React/TypeScript web application.**

The ADL web codebase is ~130 files and ~30,500 lines of production-quality code covering field collection flows, fraud detection, gamification, offline queue, and admin tooling. A Capacitor wrapper reuses approximately **95% of that codebase** unchanged. The only required adaptations are client-side: swapping three Web APIs (geolocation, camera, fetch base URL) for Capacitor plugin equivalents and bundling Inter locally.

**Native rebuild is deferred until post-PMF**, defined as 10,000+ active users with proven revenue. At that threshold, an Android-native rebuild (Kotlin/Compose) is the rational first step — over 95% of target agents in Cameroon use Android devices. A full dual-platform native rebuild is justified only for a funded team of 10 or more engineers.

**Strategic precedents:** Instagram, Discord, and Airbnb all shipped hybrid-first before investing in native rebuilds. Capacitor gives ADL store presence and native device access in ~5 weeks at a Year 1 cost of $124.

---

## 2. Codebase Audit

The table below maps the existing codebase before any Capacitor work. Server-side code is platform-agnostic (Vercel serverless functions) and requires zero changes. Only the client layer needs adaptation.

| Layer | Files | Lines | Contents |
|---|---|---|---|
| Screens | 16 | 10,946 | All user-facing screens |
| Other components | 19 | 2,450 | Shared UI, gamification, navigation |
| App.tsx | 1 | 490 | State management, routing, auth |
| Client lib | 12 | 1,344 | Offline queue, auth, GPS, sync |
| Server lib | 20+ | 6,302 | Fraud, risk, snapshots, trust, dedup |
| API endpoints | 12 | 3,773 | REST API |
| Shared types | 9 | 2,026 | TypeScript interfaces, verticals, geofence, XP |
| Tests | 30 | 2,701 | Server-side test suite |
| CSS/design system | 1 | 489 | Tailwind components, animations |
| DB migrations | 14 | — | PostgreSQL schema |
| **Total** | **~130+** | **~30,500** | |

> **Note:** Server lib, API endpoints, DB migrations, and tests are all platform-agnostic. Only client lib, screens, and App.tsx have surface area that may need adaptation, and in practice the changes are limited to three capability swaps (see Section 4).

---

## 3. Architecture

### How Capacitor Works

Capacitor bridges a standard web build to native iOS and Android shells. The Vite build produces a `dist/` folder of static assets. Capacitor embeds that folder inside a native WebView — a `WKWebView` on iOS and a `WebView` on Android. JavaScript running inside the WebView calls Capacitor plugins via a JS bridge, which execute native Swift or Kotlin code on the device and return results asynchronously. The web app itself is unmodified; only the three capability touch-points listed in Section 4 are swapped.

### Directory Structure

After Capacitor initialisation, the project gains two platform directories alongside the existing web structure:

```
africandatalayer/
├── android/                  # Android Studio project (git-tracked, generated)
│   └── app/
│       ├── src/main/
│       └── build.gradle
├── ios/                      # Xcode project (git-tracked, generated)
│   └── App/
│       ├── App/
│       └── App.xcworkspace
├── capacitor.config.ts       # Capacitor configuration
├── dist/                     # Vite build output (gitignored)
├── src/                      # Existing React source
├── api/                      # Existing Vercel serverless functions
├── lib/                      # Existing server + client libs
└── shared/                   # Existing TypeScript types
```

### Build Flow

```
npm run build          # Vite produces dist/
npx cap sync           # Copies dist/ into ios/ and android/ native projects
npx cap open ios       # Opens Xcode (for iOS build/submit)
npx cap open android   # Opens Android Studio (for AAB build/submit)
```

Run `npx cap sync` after every production build before submitting to either store.

### Capacitor Configuration

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.africandatalayer.app',
  appName: 'African Data Layer',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0f2b46',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f2b46',
    },
  },
  android: {
    minWebViewVersion: '90.0.0',
    allowMixedContent: false,
  },
};

export default config;
```

Key decisions in this config:

- `androidScheme: 'https'` — ensures session cookies behave correctly inside the Android WebView (avoids the `http://localhost` scheme that breaks `SameSite=Strict` cookies used by @auth/core).
- `launchAutoHide: false` — allows controlled splash-screen dismissal after the app bootstraps, preventing a white flash on cold start.
- `backgroundColor: '#0f2b46'` — matches ADL navy, so splash and status bar are on-brand during launch.
- `minWebViewVersion: '90.0.0'` — rejects devices whose WebView is too old to support the CSS and JS features used in the app (released 2021; safe floor for Cameroon market).

### API Base URL Strategy

The web app uses relative `/api` paths for all fetch calls. Inside a native WebView, relative URLs resolve against the WebView's origin (e.g. `capacitor://localhost`), not the Vercel deployment. A thin environment shim is needed:

| Context | API Base URL |
|---|---|
| Web (browser) | `/api` (relative, same origin) |
| Native iOS | `https://africandatalayer.vercel.app/api` |
| Native Android | `https://africandatalayer.vercel.app/api` |

Implementation: create `lib/client/native.ts` that exports `isNative(): boolean` (via `Capacitor.isNativePlatform()`) and a `getApiBase(): string` helper. Update `lib/client/api.ts` to prepend the base URL when running natively. No other code changes needed.

---

## 4. Native Capability Mapping

Three Web APIs require plugin substitution. All other browser APIs (IndexedDB, fetch, Web Crypto, ResizeObserver, etc.) work identically inside the Capacitor WebView.

| Current Web API | Capacitor Plugin | Why Upgrade |
|---|---|---|
| `navigator.geolocation` | `@capacitor/geolocation` | Background GPS, higher accuracy on native location stack, foreground service on Android, always-on permission flow on iOS |
| `<input capture="environment">` | `@capacitor/camera` | Native camera UI, EXIF data retention control, consistent behaviour across Android OEM skins, photo library access |
| `IndexedDB` (offline queue) | Works as-is | Capacitor's WebView exposes the same IndexedDB API; no change needed |
| `fetch()` (API calls) | Works as-is (change base URL only) | Same Fetch API; only the base URL constant in `lib/client/api.ts` changes for native context |
| Google Fonts CDN | Bundle Inter locally | Fonts loaded from CDN fail on offline devices; bundle Inter WOFF2 subset in `public/fonts/` |
| Push notifications | `@capacitor/push-notifications` | New capability: submission status updates, assignment notifications |
| Splash screen | `@capacitor/splash-screen` | Controlled launch experience, on-brand navy background |
| Status bar | `@capacitor/status-bar` | Match ADL navy header colour on iOS/Android |
| App lifecycle | `@capacitor/app` | Handle back-button on Android, foreground/background transitions |
| Network status | `@capacitor/network` | More reliable than browser `navigator.onLine` for offline queue trigger |

Install all plugins in one step:

```bash
npm install \
  @capacitor/core \
  @capacitor/cli \
  @capacitor/ios \
  @capacitor/android \
  @capacitor/geolocation \
  @capacitor/camera \
  @capacitor/push-notifications \
  @capacitor/splash-screen \
  @capacitor/status-bar \
  @capacitor/app \
  @capacitor/network
```

---

## 5. iOS Submission Guide

### Prerequisites

- **Apple Developer Program** membership: $99/year. Register at [developer.apple.com](https://developer.apple.com). If registering as an organisation, a D-U-N-S number is required (free, allow 5–10 business days).
- **Minimum deployment target:** iOS 15+. This covers 97%+ of active iPhones as of 2026. Setting iOS 15 as the floor gives access to modern Swift concurrency APIs and newer WKWebView behaviour fixes.
- **Xcode 16+** on macOS Sequoia or later.
- A physical iOS device for testing geolocation and camera (simulator does not support camera capture).

### App Review Risks

Apple's App Review is the highest-friction gate. The following guidelines represent the most likely rejection vectors for ADL:

| Guideline | Risk Description | Mitigation |
|---|---|---|
| 4.2 — Minimum Functionality | Reviewers may treat a WebView-wrapped web app as lacking native functionality | Ensure `@capacitor/camera` and `@capacitor/geolocation` are actively used; demonstrate native plugins in review notes; include a demo account in the review notes |
| 2.1 — Performance | App must launch without crashes and perform acceptably | Test on a real device (not simulator) before submission; verify splash-screen dismissal, offline mode, and map load |
| 5.1.1 — Data Collection | Camera and GPS permission usage strings must be precise and honest | Write accurate `NSCameraUsageDescription` and `NSLocationWhenInUseUsageDescription` strings (see below) |
| 5.1.2 — Data Use | App must not collect data beyond what is declared in Privacy Nutrition Labels | Ensure privacy labels in App Store Connect match actual data collected; document server-side data handling in privacy policy linked from the listing |

Include a **reviewer note** in App Store Connect explaining: "This is a field data collection tool for community agents in Cameroon. Geolocation and camera access are core to the submission flow, not supplementary. A demo account is provided: [email] / [password]."

### Info.plist Privacy Strings

Add the following keys to `ios/App/App/Info.plist`. Strings must be honest and specific — vague strings like "Used by the app" are rejection triggers.

```xml
<key>NSCameraUsageDescription</key>
<string>African Data Layer uses your camera to photograph infrastructure points (pharmacies, fuel stations, billboards) as part of geolocated field submissions. Photos are uploaded to verify data accuracy.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>African Data Layer uses your location to attach GPS coordinates to field submissions and verify you are within the authorised collection zone. Location is only recorded when you actively submit data.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>African Data Layer may access your photo library to attach existing photos to field submissions when a new photo is not required.</string>
```

### Signing and Distribution

1. In Xcode, select the `App` target → Signing & Capabilities tab.
2. Enable **Automatically manage signing** and select your team.
3. Set **Bundle Identifier** to `com.africandatalayer.app` (matching `capacitor.config.ts`).
4. For TestFlight distribution: Archive the app (Product → Archive), then upload via Xcode Organizer or `xcrun altool`. TestFlight supports up to 10,000 external testers with a 90-day expiry per build.
5. For App Store submission: from the same Archive, select "Distribute App" → "App Store Connect" → "Upload".

### App Store Listing Requirements

| Field | Requirement |
|---|---|
| App name | "African Data Layer" (30 chars max) |
| Subtitle | "Field Data Collection" (30 chars max) |
| Category | Primary: Utilities; Secondary: Business |
| Description | Up to 4,000 characters; must describe core functionality clearly |
| Keywords | 100 characters max; comma-separated (no spaces after commas) |
| Screenshots | 6.7" (iPhone 16 Pro Max): required; 5.5" (iPhone 8 Plus): required; iPad 12.9": required if iPad supported |
| Privacy labels | Location (precise, during use); Photos/Videos (uploaded, app functionality); Name, email address (collected, account management) |
| Privacy policy URL | Required; must be a live URL accessible without login |
| Languages | English (primary); French (secondary, recommended for Cameroonian market) |
| Age rating | 4+ (no objectionable content) |

---

## 6. Android Submission Guide

### Prerequisites

- **Google Play Developer Account:** $25 one-time registration fee at [play.google.com/console](https://play.google.com/console).
- **Minimum SDK (minSdkVersion):** API 24 (Android 7.0). This floor covers ~98% of Android devices in sub-Saharan Africa as of 2026.
- **Target SDK (targetSdkVersion):** API 34+ (Android 14). Google Play requires apps to target the API level released within the last year.
- **Android Studio Iguana (2024.1) or later** for AAB builds.
- Low-end test device (2GB RAM, Android 7–9) to validate performance on target hardware.

### Android-Specific Optimizations

| Concern | Requirement | Implementation |
|---|---|---|
| APK size | Under 15 MB recommended for low-bandwidth downloads | Use AAB (Android App Bundle); Play delivers split APKs per device config |
| 64-bit support | Both `arm64-v8a` and `armeabi-v7a` ABIs required | Default Capacitor template includes both; verify in `build.gradle` |
| Distribution format | AAB required (not APK) for new apps since 2021 | Build via Android Studio: Build → Generate Signed Bundle/APK → Android App Bundle |
| WebView version | Minimum 90.0.0 set in `capacitor.config.ts` | Configured via `android.minWebViewVersion`; devices below this threshold see a prompt to update WebView |
| Offline behaviour | Must function with zero connectivity | IndexedDB offline queue is already implemented; verify sync-on-reconnect in Android network transition tests |

### Data Safety Form

Google Play requires a Data Safety section (equivalent to Apple's Privacy Nutrition Labels). Complete this in Play Console → App Content → Data Safety.

| Data Type | Collected | Shared | Purpose |
|---|---|---|---|
| Precise location | Yes | No | Core app functionality (geolocated submissions) |
| Photos and videos | Yes | No | Core app functionality (submission evidence photos) |
| Name | Yes | No | Account management |
| Email address | Yes | No | Account management, security alerts |
| App interactions | Yes | No | Analytics (Vercel Analytics, anonymous) |

Select "Data is encrypted in transit" (HTTPS enforced). Select "Users can request data deletion" (privacy API at `/api/privacy` exists).

### Signing

Generate a release keystore. Store the keystore file and password in a password manager immediately — loss of the keystore without Play App Signing enrollment means the app cannot be updated.

```bash
keytool -genkey -v \
  -keystore africandatalayer-release.jks \
  -alias africandatalayer \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Enroll in Play App Signing** (strongly recommended): Play Console → Release → Setup → App signing. Google holds the signing key and re-signs AABs at distribution. This eliminates keystore loss risk for future updates and is required for AAB distribution.

In `android/app/build.gradle`, configure the `release` signing config to reference the keystore. Use environment variables or a `keystore.properties` file (gitignored) — never commit credentials.

### Testing Tracks

Use Google Play's staged track system before production rollout:

| Track | Audience | Purpose |
|---|---|---|
| Internal testing | Up to 100 testers (Play Console users only) | First smoke test after AAB upload; instant availability |
| Closed testing (Alpha) | Invite-only email list | Field agent beta; test geolocation accuracy, camera, offline queue |
| Open testing (Beta) | Public opt-in | Broader Bonamoussadi pilot; collect crash reports via Play Console |
| Production | All users | Full rollout; use percentage rollout (10% → 50% → 100%) on first release |

### Play Store Listing Requirements

| Field | Requirement |
|---|---|
| App name | "African Data Layer" (50 chars max) |
| Short description | Up to 80 characters; shown on search results |
| Full description | Up to 4,000 characters; HTML tags not rendered |
| Screenshots | Phone: minimum 2, maximum 8 (16:9 or 9:16); Tablet: optional but recommended |
| Feature graphic | 1024 × 500 px JPEG or PNG; shown at top of store listing |
| App icon | 512 × 512 px PNG (no alpha) |
| Category | Tools or Business |
| Content rating | Complete IARC questionnaire; expected result: Everyone |
| Languages | English (primary); French (secondary) |
| Privacy policy URL | Required; must be a live URL accessible without login |

---

## 7. Implementation Roadmap

Five weeks from decision to both stores submitted. Each week has a clear owner and measurable output.

### Week 1 — Capacitor Setup

| Action | Command / Details |
|---|---|
| Install Capacitor core and CLI | `npm install @capacitor/core @capacitor/cli` |
| Initialise Capacitor | `npx cap init "African Data Layer" com.africandatalayer.app --web-dir dist` |
| Add iOS platform | `npx cap add ios` |
| Add Android platform | `npx cap add android` |
| Install all plugins | See full `npm install` block in Section 4 |
| Run first build and sync | `npm run build && npx cap sync` |
| Update `.gitignore` | Add `ios/App/Pods/`, `android/.gradle/`, `android/build/`, `dist/` |
| Verify WebView loads app | `npx cap open ios` → run on simulator; `npx cap open android` → run on emulator |

### Week 2 — Client Adaptation

| Action | Command / Details |
|---|---|
| Create `lib/client/native.ts` | Export `isNative()` and `getApiBase()`; use `Capacitor.isNativePlatform()` |
| Update `lib/client/api.ts` | Prepend `getApiBase()` to all fetch paths when native |
| Swap geolocation | Replace `navigator.geolocation` calls in `ContributionFlow.tsx` with `@capacitor/geolocation` |
| Swap camera | Replace `<input capture="environment">` in `ContributionFlow.tsx` with `@capacitor/camera` |
| Bundle Inter font | Download Inter WOFF2 subset → `public/fonts/inter/`; update CSS `@font-face` to use local path; remove Google Fonts CDN link |
| Replace network listener | Replace `window.addEventListener('online', ...)` in offline queue with `@capacitor/network` Network.addListener |
| Add Android back-button handler | `@capacitor/app` App.addListener('backButton') → call `goBack()` |
| Generate app icons | 1024×1024 master icon → `npx @capacitor/assets generate` |
| Configure splash screen | Update `capacitor.config.ts` SplashScreen settings; add launch image assets |

### Week 3 — iOS Build and Submission

| Action | Command / Details |
|---|---|
| Open Xcode project | `npx cap open ios` |
| Configure signing | Team → Automatic signing → Bundle ID `com.africandatalayer.app` |
| Set deployment target | iOS 15.0 minimum in Xcode project settings |
| Add Info.plist privacy strings | NSCameraUsageDescription, NSLocationWhenInUseUsageDescription, NSPhotoLibraryUsageDescription (see Section 5) |
| Test on physical device | Geolocation, camera, offline queue, map render, auth flow |
| Archive and upload to TestFlight | Product → Archive → Distribute App → App Store Connect → Upload |
| Distribute TestFlight build | Invite 10–20 agents for 1-week beta |
| Create App Store Connect listing | Fill all fields per Section 5; upload screenshots from physical device |
| Submit for App Review | Include reviewer demo account in review notes |

### Week 4 — Android Build and Submission

| Action | Command / Details |
|---|---|
| Open Android Studio project | `npx cap open android` |
| Set `minSdkVersion 24`, `targetSdkVersion 34` | In `android/app/build.gradle` |
| Generate release keystore | `keytool` command (see Section 6); store securely |
| Configure signing in build.gradle | Reference keystore via `keystore.properties` (gitignored) |
| Test on low-end device | Physical Android 7–9, 2GB RAM; verify geolocation, camera, offline sync |
| Build signed AAB | Android Studio: Build → Generate Signed Bundle → Android App Bundle |
| Create Play Console listing | New app → upload AAB to internal testing track |
| Complete Data Safety form | Per table in Section 6 |
| Enroll in Play App Signing | Play Console → Release → Setup → App Signing |
| Promote to closed testing (Alpha) | Invite pilot agents; gather crash reports |
| Fill Play Store listing | Per Section 6 requirements |

### Week 5 — Submissions and Launch

| Action | Command / Details |
|---|---|
| Resolve App Store Review feedback | Monitor App Store Connect for reviewer messages; respond within 24h |
| Submit iOS to production | After TestFlight validation and Review approval |
| Promote Android to open testing (Beta) | Broader pilot; monitor Play Console crash dashboard |
| Promote Android to production (10% rollout) | Play Console → Release → Production → 10% |
| Monitor crash rates | Sentry (existing) + Play Console Android Vitals + App Store Connect Crashes |
| Scale production rollout | 10% → 50% → 100% if crash rate stable (<0.5%) |
| Announce to agents | In-app notification + field coordinator message; include store links |

---

## 8. Native Rebuild Assessment

### What It Means

A native rebuild means discarding the existing React/TypeScript codebase entirely and rewriting the client application twice — once in Swift/SwiftUI for iOS, once in Kotlin/Compose for Android. The server layer (Vercel functions, PostgreSQL, fraud detection, gamification engine) remains unchanged in both cases.

Each platform requires dedicated engineers with platform-specific expertise. Code, tests, and UI components cannot be shared between platforms. Every feature shipped in the web/Capacitor app must be re-implemented independently.

### Per-Platform Timeline

| Phase | iOS (Swift/SwiftUI) | Android (Kotlin/Compose) |
|---|---|---|
| Project setup, architecture, CI | 1 week | 1 week |
| Auth (credentials + Google Sign-In) | 1 week | 1 week |
| Map view (MapKit / Google Maps) | 2 weeks | 2 weeks |
| Contribution flow (7 verticals, multi-step) | 4 weeks | 4 weeks |
| Offline queue (Core Data / Room) | 2 weeks | 2 weeks |
| Photo capture + EXIF extraction | 1 week | 1 week |
| Gamification UI (XP, streaks, badges) | 2 weeks | 2 weeks |
| Admin queue + agent performance | 2 weeks | 2 weeks |
| Analytics + leaderboard | 1 week | 1 week |
| Delta dashboard (client view) | 1 week | 1 week |
| Settings, onboarding, profile | 1 week | 1 week |
| QA, accessibility, performance | 3 weeks | 3 weeks |
| App store submission and review | 2 weeks | 2 weeks |
| **Total** | **~25 weeks** | **~24 weeks** |

Technologies by platform:

| Concern | iOS | Android |
|---|---|---|
| Language | Swift | Kotlin |
| UI framework | SwiftUI | Jetpack Compose |
| Maps | MapKit | Google Maps SDK |
| Charts | Swift Charts | Vico |
| Local storage | Core Data | Room |
| Push notifications | APNs (native) | FCM (native) |

### Cost Estimate

| Approach | Duration | Estimated Cost |
|---|---|---|
| Parallel iOS + Android teams | ~6 months | $150,000 – $300,000 |
| Sequential (Android first, then iOS) | ~12 months | $75,000 – $150,000 |
| Capacitor (current recommendation) | ~5 weeks | $124/year |

Cost estimates assume mid-market contractor rates ($800–1,500/day per platform engineer) or equivalent full-time hiring cost with benefits.

### Maintenance Burden

A native rebuild introduces **3× the maintenance surface**: any change to business logic, UI, or API contracts must be implemented and tested in three places — web, iOS native, Android native. Bug fixes, feature parity, and platform API deprecations (Apple and Google each ship breaking SDK changes annually) compound this burden. For a team of fewer than 10 engineers, this is a significant operational risk.

### Decision Framework

| Company State | Recommended Approach | Rationale |
|---|---|---|
| Pre-PMF (current) | Capacitor hybrid | Fastest path to store presence; ~95% code reuse; $124/year; 5-week timeline; preserves engineering capacity for product iteration |
| Post-PMF: 10,000+ active users, proven revenue | Android-native rebuild (Kotlin/Compose) | 95%+ of ADL agents use Android; native delivers best performance on low-end devices; iOS Capacitor remains in parallel |
| Funded team of 10+ engineers, sustained revenue | Full dual-platform native | Justified by user volume and engineering capacity; tackle iOS native in second phase |

**Precedent:** Instagram (PhoneGap → native), Discord (React Native → native per platform), and Airbnb (React Native → native) all shipped hybrid or cross-platform first, validated product-market fit, then invested in native rewrites once user volume and revenue justified the cost.

---

## 9. Cost Summary

| Item | Cost | Frequency |
|---|---|---|
| Apple Developer Program | $99 | Annual |
| Google Play Developer Account | $25 | One-time |
| Capacitor framework + plugins | $0 | Open source (MIT) |
| **Year 1 total** | **$124** | |
| **Year 2+ total** | **$99** | Annual (Apple only) |

No additional infrastructure costs. The existing Vercel deployment serves native app API requests without modification. Blob storage, edge config, and analytics usage remains unchanged.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| App Review 4.2 rejection (minimum functionality) | Medium | High | Integrate `@capacitor/camera` and `@capacitor/geolocation` as genuine native plugins, not decorative; include reviewer demo account and explicit notes explaining field collection use case |
| WebView performance on low-end Android devices (API 24, 2GB RAM) | Medium | Medium | Set `minWebViewVersion: '90.0.0'` in `capacitor.config.ts`; test on physical Android 7 device with 2GB RAM before submission; profile and reduce CSS animation complexity if needed |
| Inter font fails to load offline (CDN dependency) | High | Low | Bundle Inter WOFF2 subset in `public/fonts/`; update `@font-face` to local path; remove Google Fonts CDN `<link>` tag from `index.html` |
| Session cookie / auth broken inside Android WebView | Medium | High | `androidScheme: 'https'` in `capacitor.config.ts` ensures cookies use HTTPS origin context; verify auth flow in Android emulator before release |
| App Store listing localisation gap (French) | Low | Low | Submit with English as primary language; add French localisation (`fr-FR`) in App Store Connect as a fast follow after approval |
| Keystore loss (Android signing key) | Low | Critical | Store keystore and password in a password manager with secure backup; enrol in Play App Signing immediately so Google holds the authoritative signing key; maintain an offline encrypted backup |
