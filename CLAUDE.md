# African Data Layer

## Design Context

### Users

**Field Agents** (primary): Community members in Cameroonian cities (starting with Bonamoussadi, Douala) who collect infrastructure and price data on foot. They work in variable conditions — bright sunlight, intermittent connectivity, low-end Android devices. They need the app to be fast, forgiving, and rewarding.

**Admins**: Review submissions for fraud, manage assignments, monitor data quality. Need information density and forensic detail without clutter.

**Clients/Investors**: Consume aggregated data through dashboards. Need clarity, trust signals, and exportable insights.

### Brand Personality

**Empowering, Grassroots, Resilient.**

- Voice: Direct, confident, locally rooted. Speaks to agents as capable professionals, not aid recipients.
- Tone: Warm but no-nonsense. Celebrates effort without being patronizing.
- Emotional goals: Agents should feel **pride** (building something important), **speed** (capture without friction), **calm** (it works offline, no stress), and **progress** (every action moves them forward).

### Aesthetic Direction

**Visual tone**: Utilitarian with soul. The interface should feel like a well-made tool — purpose-built, reliable, with moments of warmth. Think: field equipment with craft, not a polished SaaS pitch deck.

**Color palette** (established):
- Navy `#0f2b46` — authority, trust, primary actions
- Terracotta `#c86b4a` — energy, warmth, CTAs and accents
- Forest green `#4c7c59` — growth, success, verified states
- Gold `#f4c317` — achievement, brand mark accent
- Neutrals: tinted toward navy, never pure black/white

**Anti-references** (what this must NOT look like):
- Generic SaaS dashboards (Stripe/Linear soullessness)
- NGO/Aid aesthetic (charity vibes, poverty imagery, patronizing tone)
- Silicon Valley startup (gradient heroes, abstract illustrations, tech-bro energy)
- Government/Enterprise (bureaucratic, form-heavy, institutional dullness)

**Theme**: Light mode primary. Dark mode is a future goal, pending design token extraction.

### Design Principles

1. **Field-first**: Every decision prioritizes the agent in bright sunlight with a cracked-screen Android on 2G. Large touch targets, readable text, offline resilience, low battery awareness.

2. **Earned trust, not assumed**: Trust scores, verification badges, and fraud detection are core to the product. The UI should make data provenance visible and transparent — not hidden behind abstractions.

3. **Reward the work**: Gamification (XP, streaks, badges) is not decoration — it's compensation infrastructure. Treat it with the same seriousness as the data pipeline. Every capture should feel like it counted.

4. **African identity, not African trope**: The palette, iconography, and language should feel distinctly rooted in the Cameroonian context without resorting to stereotypical "African" imagery. Let the content and community speak for themselves.

5. **Progressive disclosure**: Start simple, reveal complexity through interaction. An agent's first day should feel approachable; their 100th day should feel powerful.

### Accessibility Standards

- **Target**: WCAG 2.1 AA compliance
- **Priority accommodations**: High contrast mode (exists via `.high-contrast` class), reduced motion support (implemented via `prefers-reduced-motion`), sunlight-readable contrast ratios, minimum 44x44px touch targets, bilingual EN/FR support
- **Known gaps**: See `issues/audit-2026-03-14.md` for current findings

### Design System Implementation

**Typography**: Inter (400/500/600/700) via Google Fonts, fallback `system-ui, sans-serif`. Micro labels use `.micro-label` (11px bold uppercase tracking-widest) for sunlight readability.

**Component patterns** (defined in `index.css` `@layer components`):
- `.card` / `.card-pill` — standard containers (`rounded-2xl` / `rounded-[28px]`)
- `.btn-primary` (navy), `.btn-cta` (terracotta), `.btn-ghost` — all `h-14 rounded-2xl` with `active:scale-95`
- `.screen-shell` / `.screen-header` — page layout scaffolding
- `.stat-tile` — colored background stat blocks

**Spacing rhythm**: `p-3`/`p-4`/`p-6` padding, `gap-2`/`gap-3` flex gaps, `rounded-xl`/`rounded-2xl` borders.

**Color tokens** (extended in `tailwind.config.js`): Each brand color has `DEFAULT`, `dark`, and `wash` variants (e.g. `navy-wash: #f2f6fa`, `terra-wash: #fff8f4`). Additional semantic colors: `ink` (text), `page` (bg), `danger`, `streak` (purple gamification), `amber` (warnings).

**Animations**: XP count-up, confetti fall, level scale-in, stale-enter — all respect `prefers-reduced-motion`. Button press uses `active:scale-95 transition-all`.

### Tech Stack

**Frontend**:
- React 19 + TypeScript 5.8 + Vite 6
- Tailwind CSS 3.4 + PostCSS + Autoprefixer
- Recharts 2.15 (charts) + Leaflet 1.9 / React Leaflet 5 (maps) + Lucide React (icons)
- Zod 4 (runtime validation)

**Backend**:
- Vercel serverless functions (`/api` directory, 30s timeout)
- PostgreSQL via Supabase (`pg` driver, no ORM)
- @auth/core (Auth.js) — credentials + Google OAuth
- @vercel/blob (photo uploads), @vercel/edge-config (feature flags)
- Sharp + Exifr (image processing and EXIF extraction for fraud detection)

**Infrastructure**:
- Vercel (hosting, cron, edge config, blob storage)
- Sentry (@sentry/browser + @sentry/node) for error tracking
- @vercel/analytics + @vercel/speed-insights for performance monitoring

**Offline**:
- IndexedDB queue (`adl_offline_queue` DB) — 75 items max, 6 retries, 72h TTL
- Auto-sync on reconnect via `online` event listener

---

## Project Overview

African Data Layer is a mobile-first field data collection platform for mapping infrastructure and price data in Cameroonian cities (pilot: Bonamoussadi, Douala). Field agents capture geolocated submissions with photos across 7 verticals (pharmacy, fuel station, mobile money, alcohol outlet, billboard, transport/road, census proxy). The platform includes fraud detection, gamification (XP, streaks, badges, rewards), offline-first architecture, and admin review workflows.

---

## Architecture

### Application Pattern

Single-page app with **screen-based navigation** (no router library). `App.tsx` is the central hub managing all screen state, auth, offline queue, and language via top-level `useState` hooks.

### State Management

**No external state library** — pure React hooks:
- `App.tsx` owns all global state and passes props down
- `localStorage` for preferences (language, splash flag, auth flag)
- `IndexedDB` for offline submission queue
- Session cookies for auth tokens (managed by @auth/core)

### Client-Server Boundary

- **Client library** (`lib/client/api.ts`): `apiFetch()` and `apiJson<T>()` wrappers with `credentials: 'include'`
- **Offline queue** (`lib/client/offlineQueue.ts`): IndexedDB-backed with idempotency keys, retry counts, snapshot subscriptions
- **Auth client** (`lib/client/auth.ts`): Session management, sign-in/sign-up, Google OAuth flow

### Server Architecture (`lib/server/`)

- **Storage layer** (`storage/`): Unified interface → `postgresStore.ts` primary, `edgeConfigStore.ts` fallback
- **Fraud & risk**: `submissionRisk.ts` (risk scoring), `submissionFraud.ts` (EXIF/geo anomalies), `gpsValidation.ts`, `userTrust.ts` (trust tiers)
- **Data pipeline**: `snapshotEngine.ts` (weekly/monthly deltas), `pointProjection.ts` (event → projected point merge), `dedup.ts`, `confidenceScore.ts`
- **Business logic**: `xp.ts`, `submissionRewards.ts`, `collectionAssignments.ts`
- **Auth**: `auth/handler.ts` (Auth.js config with credentials + Google OAuth + account lockout)
- **Utilities**: `db.ts` (query wrapper), `http.ts` (response builders), `rateLimit.ts`, `validation.ts` (Zod schemas)

### API Endpoints (`/api`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/[...auth]` | Auth.js handler (OAuth + credentials) |
| POST | `/api/auth/register` | User registration |
| GET/POST/DELETE | `/api/submissions` | Submission CRUD |
| GET/PATCH/DELETE | `/api/submissions/:id` | Single submission ops |
| GET/PUT | `/api/user` | Profile & assignments |
| GET | `/api/user?view=status` | Security status check |
| GET | `/api/analytics` | Snapshot stats (5min cache) |
| GET | `/api/leaderboard` | Public leaderboard |
| GET | `/api/health` | Health check |
| POST | `/api/ai/search` | Gemini-powered search |
| POST | `/api/intake/leads` | Automation lead ingestion |
| GET | `/api/privacy` | GDPR/privacy requests |

---

## Route Organization

Navigation uses a `Screen` enum and central `currentScreen` state in `App.tsx` — no React Router.

```
Screen.SPLASH          → Splash.tsx           (onboarding)
Screen.HOME            → Home.tsx + HomeMap   (map view, main tab)
Screen.DETAILS         → Details.tsx          (point detail)
Screen.AUTH            → Auth.tsx             (sign in/up)
Screen.CONTRIBUTE      → ContributionFlow.tsx (multi-step form, CREATE/ENRICH modes)
Screen.SUBMISSION_QUEUE→ SubmissionQueue.tsx  (offline sync queue)
Screen.PROFILE         → Profile.tsx          (user stats, tab)
Screen.SETTINGS        → Settings.tsx         (language, logout)
Screen.ANALYTICS       → Analytics.tsx        (leaderboard, role-based views, tab)
Screen.QUALITY         → QualityInfo.tsx      (data quality info)
Screen.REWARDS         → RewardsCatalog.tsx   (redemption marketplace)
Screen.ADMIN           → AdminQueue.tsx       (admin review panel)
Screen.AGENT_PERFORMANCE → AgentPerformance.tsx (admin metrics)
Screen.DELTA_DASHBOARD → DeltaDashboard.tsx   (client data insights)
```

**Navigation patterns**:
- `navigateTo(screen, point?)` — push to history stack
- `goBack()` — pop from history or reset to home
- `switchTab(screen)` — reset history (bottom tab bar)
- Role-based visibility: agent vs admin vs client
- All screens lazy-loaded via `React.lazy()` + `<Suspense>`

---

## Import Aliases

Defined in both `tsconfig.json` and `vite.config.ts`:

```
@/* → ./*  (repo root)
```

Example: `import { SubmissionCategory } from '@/shared/types'`

---

## Styling Architecture

### Tailwind Configuration (`tailwind.config.js`)

**Extended color tokens** — each brand color has `DEFAULT`, `dark`, and `wash` variants:
- `navy` (#0f2b46) + `navy-dark`, `navy-light`, `navy-wash` (#f2f6fa), `navy-border`, `navy-mid`
- `terra` (#c86b4a) + `terra-dark`, `terra-wash` (#fff8f4)
- `forest` (#4c7c59) + `forest-dark`, `forest-wash`
- `gold` (#f4c317) + `gold-wash`
- Semantic: `ink` (text), `page` (bg), `danger`, `streak` (purple), `amber` (warnings)

### CSS Layers (`index.css`)

```css
@layer base      → CSS custom properties (spacing, shadows, chart colors)
@layer components → Design system classes (.card, .btn-*, .screen-shell, .stat-tile, .micro-label)
```

**Custom animations**: `surface-reveal`, `ambient-drift`, `ring-pulse`, `reward-float`, `button-breathe`, `shimmer-pass`, `xp-count-up`, `confetti-fall`, `sheet-enter`, `stale-enter` — all gated by `prefers-reduced-motion`.

**Utility classes**: `.motion-pressable`, `.no-scrollbar`, `.high-contrast`, `.route-grid`

### Conventions

- Buttons: `h-14 rounded-2xl active:scale-95 transition-all`
- Cards: `rounded-2xl` (standard) or `rounded-[28px]` (pill)
- Spacing: `p-3`/`p-4`/`p-6` padding, `gap-2`/`gap-3` flex gaps
- Touch targets: minimum 44x44px
- App shell: `max-w-md` (mobile), full-width for admin/analytics/dashboard screens

---

## Component Structure

```
/components
├── Screens/                  # Full-page screen components
│   ├── AdminQueue.tsx        # Admin submission review
│   ├── AgentPerformance.tsx  # Admin agent metrics
│   ├── Analytics.tsx         # Leaderboard & stats (role-based)
│   ├── Auth.tsx              # Sign in/up (credentials + Google)
│   ├── ContributionFlow.tsx  # Multi-step submission form (largest component)
│   ├── DeltaDashboard.tsx    # Client data insights
│   ├── Details.tsx           # Point detail view
│   ├── Home.tsx              # Map view with data points
│   ├── HomeMap.tsx           # Leaflet map component
│   ├── Profile.tsx           # User profile & stats
│   ├── QualityInfo.tsx       # Data quality explanations
│   ├── RewardsCatalog.tsx    # Redemption marketplace
│   ├── Settings.tsx          # Language, logout, accessibility
│   ├── Splash.tsx            # Onboarding
│   └── SubmissionQueue.tsx   # Offline sync queue
├── shared/                   # Reusable UI primitives
│   ├── BottomSheet.tsx       # Modal sheet
│   ├── ProfileAvatar.tsx     # Avatar display
│   ├── ScreenHeader.tsx      # Page header
│   ├── VerticalIcon.tsx      # Category icons
│   └── VoiceMicButton.tsx    # Voice input
├── BadgeSystem.tsx           # Badge display & logic
├── BrandLogo.tsx             # Logo component
├── DailyProgressWidget.tsx   # Daily capture progress
├── ErrorBoundary.tsx         # Error boundary wrapper
├── ExportPanel.tsx           # Data export UI
├── LevelUpCelebration.tsx    # Level-up animation
├── MissionCards.tsx          # Mission card UI
├── Navigation.tsx            # Bottom tab bar
├── StreakTracker.tsx         # Streak display
├── SyncStatusBar.tsx         # Offline/sync status indicator
└── XPPopup.tsx               # XP award animation
```

**Naming**: PascalCase, one component per file. Screens in `/Screens`, shared primitives in `/shared`, feature components at root level.

---

## Shared Types & Constants

```
/shared
├── types.ts              # 30+ interfaces (PointEvent, ProjectedPoint, UserProfile, etc.)
├── verticals.ts          # 7 category definitions with field schemas
├── geofence.ts           # Bonamoussadi + Cameroon bounds
├── submissionRewards.ts  # XP tables by category/quality
├── avatarPresets.ts      # 20+ avatar presets
└── constants (in types)  # Screen enum, SubmissionCategory enum, UserRole
```

---

## Testing Setup

- **Framework**: Node.js native test runner (`node --test`) with `tsx` for TypeScript
- **Location**: `/tests` directory (30 test files)
- **Coverage areas**: Auth, submissions, validation, fraud detection, dedup, confidence scoring, privacy, device profiling, point projection
- **Commands**:
  - `npm test` — run all tests
  - `npm run test:ci` — lint + typecheck + test + build
  - `npm run check:function-budget` — verify Vercel function size limits

---

## Coding Preferences

### General

- **No external state management** — use React hooks. App-level state lives in `App.tsx`.
- **No router library** — screen navigation via `Screen` enum and `navigateTo()`/`goBack()`/`switchTab()`.
- **No ORM** — raw SQL via `pg` driver through `lib/server/db.ts`.
- **Zod for validation** at API boundaries (`lib/server/validation.ts`).
- **Bilingual inline** — use `t = (en, fr) => language === 'fr' ? fr : en` pattern, not i18n libraries.

### File Organization

- Screen components → `components/Screens/`
- Shared UI primitives → `components/shared/`
- Client utilities → `lib/client/`
- Server logic → `lib/server/`
- Shared types/constants → `shared/`
- API routes → `api/`
- Database migrations → `supabase/`

### API Conventions

- Serverless functions export a default `(req, res)` handler
- Use `lib/server/http.ts` response builders (`ok()`, `badRequest()`, `unauthorized()`, etc.)
- Auth checked via `getSession()` from @auth/core
- Rate limiting via `lib/server/rateLimit.ts`

### Security

- CSP headers enforced via `vercel.json`
- EXIF-based fraud detection on photo submissions
- GPS anomaly detection (velocity, travel distance)
- Trust tier system (affects submission weight)
- Account lockout on failed auth attempts
- PII filtering via `lib/server/privacy.ts`

### Environment Variables

- 39 env vars defined in `.env.example`
- Client-accessible vars prefixed with `VITE_`
- Fraud thresholds configurable via `FRAUD_*` env vars
- Queue limits via `QUEUE_*` env vars
