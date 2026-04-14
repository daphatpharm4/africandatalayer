# African Data Layer

A mobile-first field data collection platform for mapping infrastructure and price data in Cameroonian cities. Field agents capture geolocated submissions with photos across 7 verticals, earning XP and rewards through a gamified contribution system. Ships as a web app (Vercel), iOS app (App Store), and Android app (Play Store) from a single codebase via Capacitor.

**Pilot area:** Bonamoussadi, Douala, Cameroon.

---

## Features

- **7 data verticals:** Pharmacy, Mobile Money, Fuel Station, Alcohol Outlet, Billboard, Transport/Road, Census Proxy
- **Live camera capture** with EXIF metadata extraction for fraud detection
- **GPS validation** with geofence enforcement, velocity checks, and cross-referencing
- **Offline-first architecture** — IndexedDB queue (75 items, 6 retries, 72h TTL), auto-sync on reconnect
- **Gamification** — XP, streaks, badges, levels, daily missions, rewards catalog
- **Fraud detection** — EXIF analysis, GPS anomaly detection, trust tiers, risk scoring
- **Admin review** — submission queue with forensic detail, agent performance metrics
- **Client dashboards** — aggregated data insights with snapshot deltas and export
- **AI-powered search** via Gemini
- **Bilingual** — English and French (inline `t(en, fr)` pattern)
- **Native mobile distribution** via Capacitor (camera, geolocation, offline network detection, splash/status bar, hardware back button; push plugin scaffolded for later rollout)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 5.8, Vite 6 |
| Styling | Tailwind CSS 3.4, PostCSS, Autoprefixer |
| Charts/Maps | Recharts 2.15, Leaflet 1.9 / React Leaflet 5 |
| Icons | Lucide React |
| Validation | Zod 4 |
| Backend | Vercel serverless functions (Node.js, 30s timeout) |
| Database | PostgreSQL via Supabase (`pg` driver, no ORM) |
| Auth | Auth.js (@auth/core) — credentials + Google OAuth |
| Storage | @vercel/blob (photos), @vercel/edge-config (feature flags) |
| Image processing | Sharp + Exifr |
| Mobile | Capacitor 8 (iOS + Android native shells) |
| Monitoring | Sentry, Vercel Analytics, Vercel Speed Insights |

---

## Project Structure

```
/
├── api/                        # Vercel serverless endpoints
│   ├── ai/                     #   Gemini-powered search
│   ├── analytics/              #   Snapshot stats
│   ├── assignments/            #   Collection assignments
│   ├── auth/                   #   Auth.js (OAuth + credentials)
│   ├── health/                 #   Health check
│   ├── intake/                 #   Automation lead ingestion
│   ├── leaderboard/            #   Public leaderboard
│   ├── privacy/                #   GDPR/privacy requests
│   ├── submissions/            #   Submission CRUD
│   └── user/                   #   Profile & assignments
├── components/
│   ├── Screens/                # Full-page screen components (16)
│   └── shared/                 # Reusable UI primitives
├── lib/
│   ├── client/                 # Browser-side utilities (13 modules)
│   │   ├── api.ts              #   apiFetch / apiJson wrappers
│   │   ├── auth.ts             #   Session management
│   │   ├── native.ts           #   Capacitor platform detection
│   │   └── offlineQueue.ts     #   IndexedDB offline queue
│   └── server/                 # Server-side logic (29 modules)
│       ├── auth/               #   Auth.js config + lockout
│       ├── storage/            #   Postgres primary, Edge Config fallback
│       ├── submissionFraud.ts  #   EXIF/geo fraud detection
│       ├── submissionRisk.ts   #   Risk scoring engine
│       ├── snapshotEngine.ts   #   Weekly/monthly deltas
│       └── validation.ts       #   Zod schemas
├── shared/                     # Types, constants, verticals (9 modules)
├── scripts/                    # Migration, backup, import tools (9 scripts)
├── supabase/migrations/        # SQL migrations (14 files)
├── tests/                      # Node.js native test runner (35 test files)
├── public/fonts/               # Bundled Inter variable font (WOFF2)
├── docs/                       # Strategy, ops, compliance, pitch decks
├── .github/workflows/          # CI/CD (ci, ios-build, android-build, sync)
├── capacitor.config.ts         # Capacitor configuration
├── App.tsx                     # Central hub — all screen state, auth, navigation
├── index.html                  # SPA entry point
├── index.css                   # Tailwind + design system layers
├── vercel.json                 # Headers, rewrites, CSP
└── tailwind.config.js          # Extended brand color tokens
```

---

## Getting Started

```bash
npm install
npm run dev
```

For backend (Vercel serverless functions locally):

```bash
npx vercel@latest dev --listen 3000
```

Frontend runs on `http://localhost:5173` with `/api` proxy to Vercel dev server.

---

## Mobile Distribution

The app ships to iOS and Android via Capacitor 8. All Capacitor plugin calls are gated behind `isNative()` guards — the web app is completely unaffected.

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Web app (Vercel deployment) |
| `feature/capacitor-base` | Shared Capacitor foundation (plugins, config, native guards) |
| `feature/ios-distribution` | iOS platform (Info.plist, Xcode project, signing/distribution work) |
| `feature/android-distribution` | Android platform (Gradle, signing config, Play distribution work) |

### Build Commands

```bash
# Sync web build into native projects
npm run cap:sync             # Both platforms
npm run cap:sync:ios         # iOS only
npm run cap:sync:android     # Android only

# Open native IDEs
npm run cap:open:ios         # Xcode
npm run cap:open:android     # Android Studio
```

### CI/CD Workflows

- **`ci.yml`** — Lint, typecheck, test, build on push to main, staging, and all feature branches
- **`ios-build.yml`** — macOS runner, xcodebuild (no code signing) on `feature/ios-distribution`
- **`android-build.yml`** — Ubuntu runner, Java 17, Gradle debug APK on `feature/android-distribution`
- **`merge-base-to-platforms.yml`** — Auto-creates sync PRs from `feature/capacitor-base` to platform branches

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/[...auth]` | Auth.js handler (OAuth + credentials) |
| POST | `/api/auth/register` | User registration |
| GET/POST | `/api/submissions` | Submission CRUD (default: projected points; `?view=events` for raw) |
| GET/PATCH/DELETE | `/api/submissions/:id` | Single submission operations |
| GET/PUT | `/api/user` | Profile and assignments |
| GET | `/api/user?view=status` | Security status check |
| GET | `/api/analytics` | Snapshot stats (5min cache) |
| GET | `/api/leaderboard` | Public leaderboard |
| GET | `/api/health` | Health check |
| POST | `/api/ai/search` | Gemini-powered search |
| GET/POST | `/api/intake/leads` | Automation lead ingestion |
| PATCH | `/api/intake/leads/:id` | Update lead status |
| GET | `/api/privacy` | GDPR/privacy requests |

---

## Environment Variables

See `.env.example` for the full list (~39 variables). Key groups:

**Required:**
- `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `POSTGRES_URL` (or `ADL_POSTGRES_URL`)
- `BLOB_READ_WRITE_TOKEN`
- `GEMINI_API_KEY` (server-only)

**Optional:**
- `SENTRY_DSN` / `VITE_SENTRY_DSN` — error tracking
- `FRAUD_ALERT_WEBHOOK_URL` — fraud alert notifications
- `AUTOMATION_SECRET` — bearer token for `/api/intake/leads`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — admin seeding
- `VITE_ADMIN_EMAIL` — frontend admin UI visibility

Do not define `VITE_GEMINI_API_KEY` in any frontend environment.

---

## Database

PostgreSQL via Supabase. Migrations managed by a custom runner:

```bash
npm run migrate:dry   # Preview pending migrations
npm run migrate       # Apply migrations
```

RLS enabled via `supabase/migrations/20260401_enable_public_rls.sql`. Vercel does not auto-run migrations — run them manually after schema changes.

---

## Testing

```bash
npm test              # Node.js native test runner (35 test files)
npm run typecheck     # TypeScript strict check
npm run lint          # ESLint
npm run test:ci       # lint + typecheck + test + build
npm run test:e2e      # Playwright smoke tests
```

---

## Security

- CSP headers enforced via `vercel.json`
- EXIF-based fraud detection on photo submissions
- GPS anomaly detection (velocity, travel distance, geofence)
- Trust tier system (affects submission weight and review priority)
- Account lockout on failed auth attempts
- PII filtering via `lib/server/privacy.ts`
- Rate limiting on all API endpoints

If credentials were shared publicly, rotate Supabase keys, Postgres URLs, and API tokens before deploying.

---

## Operations

- Release flow: `docs/ops/pilot-release-flow.md`
- Backup and restore: `docs/ops/backup-restore-runbook.md`
- Compliance pack: `docs/compliance/`
- Mobile distribution strategy: `docs/team/09-mobile-distribution.md`
- Investor pitch (mobile): `docs/pitch/06-mobile-distribution-strategy.md`
