# Architecture Review — Week 1 (Capacitor Integration)

**Date:** 2026-04-15
**Reviewer:** Software Architect (ADL Subagent)
**Branch:** `feature/capacitor-base`
**Gate Status:** PASS

---

## Architecture Health: GREEN

The Capacitor 8 integration is architecturally sound. All native plugin calls are correctly gated behind `isNative()`, the web app is provably unaffected, and the branch strategy cleanly separates concerns.

---

## Findings

### 1. isNative() Guard Coverage — PASS

Every Capacitor plugin call in the codebase is gated:

| File | Line(s) | Plugin | Guard |
|------|---------|--------|-------|
| App.tsx | 243 | Network.getStatus/addListener | `if (isNative())` |
| App.tsx | 292-309 | SplashScreen, StatusBar, CapApp.addListener | `if (!isNative()) return` |
| ContributionFlow.tsx | 639 | CapGeolocation.watchPosition | `if (isNative())` |
| ContributionFlow.tsx | 820-823 | CapGeolocation.getCurrentPosition | `if (isNative())` |
| ContributionFlow.tsx | 878-893 | CapCamera.getPhoto | Called only from `takeNativePhoto()` |
| ContributionFlow.tsx | 1706 | Conditional render | `isNative() ?` ternary |

**No unguarded Capacitor calls found.**

### 2. Import Aliasing — PASS

Collisions correctly avoided:
- `App as CapApp` (vs React `App` component) — App.tsx:17
- `Camera as CapCamera` (vs `Camera` from lucide-react) — ContributionFlow.tsx:14
- `Geolocation as CapGeolocation` — ContributionFlow.tsx:15
- `SplashScreen`, `StatusBar`, `Network` — no collision, used directly

### 3. API Base URL Strategy — PASS (with advisory)

`lib/client/native.ts:11-14` — `getApiBase()` returns hardcoded `'https://africandatalayer.vercel.app'` for native.

- **Correct behavior:** Web gets `VITE_API_BASE ?? ''` (relative URLs), native gets absolute URL to Vercel.
- **Advisory:** If the Vercel domain changes, native apps need a code update. Consider moving to an env var or remote config in the future. Not blocking for pilot.

### 4. Offline Queue Integrity — PASS

`lib/client/offlineQueue.ts` is unchanged by the Capacitor integration. Constants preserved:
- `MAX_QUEUE_ITEMS = 75`
- `MAX_QUEUE_RETRY_COUNT = 6`
- `MAX_QUEUE_ITEM_AGE_MS = 72h`
- `idempotencyKey` on every `QueueItem`

The network listener change in App.tsx (line 243-261) uses Capacitor's `Network.addListener` for native but keeps the web `online`/`offline` event listener unchanged. Queue flush triggers remain the same.

### 5. Bundle Impact — PASS

Capacitor packages added (all `^8.x`):
- `@capacitor/core` — ~5KB gzipped (web-safe, tree-shakeable)
- `@capacitor/app`, `camera`, `geolocation`, `network`, `push-notifications`, `splash-screen`, `status-bar` — tree-shaken to near-zero on web (behind `isNative()`)
- `@capacitor/cli` — dev tool only, not in bundle

Vercel function budget: `npm run check:function-budget` is in the build script, enforced per build.

### 6. CORS Configuration — PASS (conditional)

`vercel.json:30` — `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`

- **Why wildcard:** Native WebViews send origins like `capacitor://localhost` or `https://localhost` that can't be enumerated.
- **Mitigated by:** Session cookies (HttpOnly, Secure, SameSite) are the auth mechanism, not CORS-dependent bearer tokens. CSRF risk is low because all mutations require authenticated sessions.
- **Recommendation:** Add `Vary: Origin` header for correct caching behavior. Not blocking.

### 7. CSP Headers — PASS

Google Fonts domains correctly removed from CSP after font bundling:
- `style-src`: no longer includes `https://fonts.googleapis.com`
- `font-src`: no longer includes `https://fonts.gstatic.com`, uses `'self' data:`
- `connect-src`: includes `https://africandatalayer.vercel.app` (needed for native API calls)

### 8. Font Bundling — PASS

- `public/fonts/inter-latin.woff2` — 224.8KB variable font
- `index.css` — `@font-face` declarations for weights 400/500/600/700
- `index.html` — Google Fonts CDN lines removed (3 lines)
- Web performance improved (no external font dependency)

### 9. Branch Strategy — PASS

Clean separation:
- `feature/capacitor-base` — shared code, all `isNative()` guards (this branch)
- `feature/ios-distribution` — `@capacitor/ios`, Info.plist, Xcode project
- `feature/android-distribution` — `@capacitor/android`, Gradle, signing config
- `merge-base-to-platforms.yml` — auto-sync PRs from base to platform branches

No circular dependencies between branches.

### 10. CI/CD — PASS

4 workflow files verified:
- `ci.yml` — all 3 feature branches in push triggers
- `ios-build.yml` — macOS runner, xcodebuild with CODE_SIGNING_ALLOWED=NO
- `android-build.yml` — Ubuntu, Java 17, gradlew assembleDebug, APK artifact upload
- `merge-base-to-platforms.yml` — auto-creates sync PRs on base push

### 11. TypeScript — PASS

`npm run typecheck` — clean, no errors.

### 12. ESLint — PASS

`ios/**` and `android/**` added to ignores in `eslint.config.js`. `npm run lint` — clean.

---

## Advisory Items (non-blocking)

| # | Item | Severity | Recommendation |
|---|------|----------|---------------|
| A1 | Hardcoded API URL in native.ts | Low | Consider env var or remote config for multi-environment support |
| A2 | CORS wildcard + credentials | Low | Add `Vary: Origin` header for cache correctness |
| A3 | No Capacitor error boundary | Low | Consider wrapping Capacitor plugin calls in a shared error handler for consistent UX |
| A4 | Push notifications plugin installed but unused | Informational | `@capacitor/push-notifications` in deps but no code references. Expected — for future use. |

---

## Gate Decision

**ARCHITECTURE GATE: PASS**

The Capacitor integration is well-structured, properly isolated, and does not affect web deployment. Merge to main is architecturally safe.
