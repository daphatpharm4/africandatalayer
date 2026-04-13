# ADL Mobile Distribution Strategy Deck

Audience: Investors, accelerator selection committees, and B2B buyers
Goal: Demonstrate a capital-efficient mobile distribution strategy that puts ADL in the hands of field agents via App Store and Google Play without a costly native rebuild.

## Slide 1
- Slide #: 1
- Title: Native App Distribution on Two Stores
- Core message: ADL reaches field agents on their own devices via App Store and Google Play
- Slide copy: Full capture experience (offline queue, camera, GPS, gamification) directly on agents' phones. 16 production screens, 30,000+ lines of tested code, offline-first architecture proven on web. Agents install once, capture everywhere.
- Proof points:
  - 16 production screens deployed and tested in the current codebase
  - 30,000+ lines of TypeScript across screens, server logic, and shared types
  - Offline queue holds 75 items with 6 retries and 72-hour TTL — proven on mobile web today
- Suggested visual: Split screen — iPhone (App Store badge) and Android phone (Play Store badge), both showing Home map
- Audience-specific CTA: "Evaluate ADL's distribution readiness — the product is built, the stores are the last mile."

## Slide 2
- Slide #: 2
- Title: Ship in Weeks, Not Quarters
- Core message: Capacitor wraps the proven React app with native device access — no 6-month rewrite
- Slide copy: Uses Capacitor (by Ionic) to package existing web app in native shells. ~95% code reuse. Native camera, GPS, push, splash via plugins. Real Xcode and Android Studio projects. Same path as Airbnb, Discord, Instagram early stages.
- Proof points:
  - ~95% code reuse — only native plugin wiring and splash assets are new
  - Native plugins available for camera, GPS, push notifications, and network status
  - Generates real Xcode and Android Studio projects, reviewable by Apple and Google
  - Precedent: Airbnb, Discord, and Instagram used hybrid-first strategies at equivalent scale
- Suggested visual: Architecture diagram: React app center → Vite Build → Capacitor Sync → branching to iOS (Xcode) and Android (Android Studio)
- Audience-specific CTA: "Back a team that ships with engineering discipline — not rebuild cycles."

## Slide 3
- Slide #: 3
- Title: $124 to Reach Two Billion Devices
- Core message: Year-one cost $124 vs $150K-$300K for native rebuild
- Slide copy: Apple $99/year + Google $25 one-time + Capacitor free. Same Vercel backend serves all clients. Native rebuild = $150K-$300K in salaries over 6 months + permanent 3x maintenance.
- Proof points:
  - Apple Developer Program: $99/year
  - Google Play Developer account: $25 one-time fee
  - Capacitor: open-source, $0 licensing cost
  - Native rebuild estimate: $150K-$300K in engineering salaries over 6 months
  - Zero additional server infrastructure — same Vercel + PostgreSQL backend serves web and native
- Suggested visual: Cost comparison bar chart — "$124" (green) vs "$150K-$300K" (red). Caption: "Same backend. Same features. 1000x less distribution cost."
- Audience-specific CTA: "Capital efficiency that preserves runway for agent compensation, data operations, and market expansion."

## Slide 4
- Slide #: 4
- Title: Built for a Cracked Screen on 2G
- Core message: 95%+ of field agents in Cameroon use Android — app purpose-built for their reality
- Slide copy: Targets Android 7.0+ (API 24), under 15MB install, 44x44px touch targets, sunlight-readable contrast, offline queue holds 75 submissions with auto-sync. Built from first principles for field agents, not Silicon Valley ported to Africa.
- Proof points:
  - Android minimum target: API 24 (Android 7.0), covering the large majority of active Cameroonian handsets
  - Target install size: under 15MB (no bloat, fast download on metered data)
  - Minimum touch target: 44x44px on all interactive elements — WCAG 2.1 AA compliant
  - Offline queue: 75 items, 6 retries, 72-hour TTL, auto-sync on reconnect via `online` event
  - Contrast ratios designed for direct sunlight readability, not lab conditions
- Suggested visual: Budget Android phone in bright outdoor lighting showing ContributionFlow camera step. Badge: "Works on 2G."
- Audience-specific CTA: "Invest in infrastructure designed for the devices and networks your users actually have."

## Slide 5
- Slide #: 5
- Title: A Clear Path to Native — When It Matters
- Core message: Capacitor now, Kotlin-native Android at 10K+ users, full native only with funding
- Slide copy: Server API (12 REST endpoints on Vercel + PostgreSQL) is platform-agnostic. If WebView bottleneck at scale, upgrade Android-native first (95% of users). Full native reserved for funded multi-city phase with team of 10+. Same playbook as Instagram, Discord, Airbnb.
- Proof points:
  - 12 platform-agnostic REST endpoints — any native client connects without backend changes
  - 95%+ of agents estimated on Android, making Kotlin-native the highest-leverage upgrade path
  - Capacitor avoids 3x maintenance cost (iOS + Android + web) until user scale justifies it
  - Precedent: Instagram, Discord, and Airbnb validated at millions of users before full native splits
- Suggested visual: Timeline arrow: "Now → Capacitor (both stores)" → "10K users → Kotlin-native Android" → "Funded team → Full native"
- Audience-specific CTA: "Back the pragmatic path — ship fast, validate, then optimize the runtime."

## Slide 6
- Slide #: 6
- Title: Five Weeks to Both Stores
- Core message: 5 weeks from decision to both app stores
- Slide copy: Week 1 Capacitor setup. Week 2 camera/GPS/font adaptation. Week 3 Apple TestFlight. Week 4 Google Play internal. Week 5 production on both stores with phased rollout. Agents in Bonamoussadi download native app, start capturing by Q3 2026.
- Proof points:
  - Week 1: Capacitor CLI install, native project scaffolding, plugin wiring
  - Week 2: Camera and GPS plugin integration, font and icon adaptation, splash screen
  - Week 3: iOS build to Apple TestFlight for internal QA
  - Week 4: Android APK to Google Play internal testing track
  - Week 5: App Store and Play Store production submission with phased rollout enabled
- Suggested visual: Horizontal Gantt timeline with 5 labeled blocks, ending with App Store + Play Store badges and green checkmark
- Audience-specific CTA: "Agents collecting data from native apps by Q3 2026. The product is ready — the stores are the last step."
