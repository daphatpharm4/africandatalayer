# African Data Layer – MVP (Investor Demo)

A mobile-first web application that allows field agents to crowdsource and enrich local data points for pharmacies, mobile money kiosks, and fuel stations.

---

## 🌍 Key Features

- 📸 Mandatory live camera capture (no gallery upload)
- 📍 GPS + photo metadata + IP location cross-check
- ⛽ Three verticals: Pharmacy, Mobile Money Kiosk, Fuel Station
- 🎮 Gamified XP rewards and leaderboard
- 📊 Mock dashboard for admins and investors
- 🔍 Offline-ready design (static + PWA capability)
- 🧪 Fraud detection simulations (static)

---

## 📁 Folder Structure

- `/components`: UI elements (buttons, inputs, cards)
- `/screens`: Main screens (Home, Submit, Profile)
- `/mockData`: Static JSON to simulate backend
- `/services`: Location, Camera, and validation utilities
- `/constants`: Colors, fonts, config
- `/public`: Static assets, logos, images

---

## 🚀 Run Locally

```bash
npm install
npm run dev
```

---

## 🔐 Backend (Vercel Functions)

This repo includes serverless functions under `/api` for Auth.js (Google OAuth + credentials), submissions, and user profiles. Persistence now targets Supabase Postgres (with optional temporary Edge Config read fallback during migration).

Set these environment variables:

- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `AUTH_URL` (e.g. `https://your-app.vercel.app`)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GEMINI_API_KEY` (server-only, used by `POST /api/ai/search`)
- `ADL_POSTGRES_URL` (optional override if integration-managed `POSTGRES_URL` is locked)
- `POSTGRES_URL` (or `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING`)
- Optional emergency fallback: `POSTGRES_SSL_NO_VERIFY=true` (only if TLS fails with `SELF_SIGNED_CERT_IN_CHAIN`)
- `DATA_STORE_DRIVER` (`postgres`)
- Optional: `DATA_READ_FALLBACK_EDGE` (`true` during migration, then `false`)
- `BLOB_READ_WRITE_TOKEN` (for storing user-submitted photos)
- Optional monitoring: `SENTRY_DSN`, `VITE_SENTRY_DSN`
- Optional fraud ops: `FRAUD_ALERT_WEBHOOK_URL`
- Optional automation intake: `AUTOMATION_SECRET` (shared bearer secret for `POST /api/intake/leads`)
- Optional: `MAX_SUBMISSION_IMAGE_BYTES` (default `8388608`)
- Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Optional (frontend): `VITE_ADMIN_EMAIL` (to show Impact tab for admin users)
- Optional migration-only: `EDGE_CONFIG`, `EDGE_CONFIG_ID`, `VERCEL_API_TOKEN`
- Do not define `VITE_GEMINI_API_KEY` in any frontend environment

Endpoints:
- `GET/POST /api/submissions` (default returns projected points; add `?view=events` for raw append-only events)
- `GET/PATCH/DELETE /api/submissions/:id`
- `GET/PUT /api/user`
- `GET/POST /api/intake/leads`
- `PATCH /api/intake/leads/:id`
- `GET/POST /api/auth/*` (Auth.js)

Security note:
- `PUT /api/submissions/:id` is intentionally disabled.
- Public submission reads are sanitized; raw event access requires authorization.

## 🗄️ Database Schema

Run the repo migration runner against the target database:

```bash
npm run migrate:dry
npm run migrate
```

Notes:
- Vercel deploys app code, but it does not automatically run database migrations.
- Supabase RLS is enabled through `supabase/migrations/20260401_enable_public_rls.sql`.
- Use the migration runner instead of pasting SQL manually into the Supabase console whenever possible.

## 🔁 Data Migration (Edge Config -> Postgres)

- Dry run: `node scripts/migrate-edge-config-to-postgres.mjs --dry-run`
- Write: `node scripts/migrate-edge-config-to-postgres.mjs --write`

Bonamoussadi CSV import:
- Dry run: `npm run import:bonamoussadi -- --csv /absolute/path/to/bonamoussadi_pharmacy_fuel_curated.csv --dry-run`
- Write to Postgres: `npm run import:bonamoussadi -- --csv /absolute/path/to/bonamoussadi_pharmacy_fuel_curated.csv --write`

## 🚨 Security

If credentials were shared publicly, rotate them before deploying:

- Supabase service role keys
- Postgres passwords / URLs
- Any exposed API tokens (including Vercel tokens)

Local dev (recommended):
- Backend: `npx vercel@latest dev --listen 3000`
- Frontend: `npm run dev` (Vite on `http://localhost:5173` with `/api` proxy)

## 🛠️ Pilot Ops

- Release flow: `docs/ops/pilot-release-flow.md`
- Backup and restore: `docs/ops/backup-restore-runbook.md`
- Compliance pack: `docs/compliance/`

## 📚 Current Strategy Docs

- `docs/MULTI-AGENT-MODERNIZATION-MASTER-PROMPT.md`
- `docs/APP-MODERNIZATION-AND-GAMIFICATION-PROGRAM.md`
- `research/11-multi-agent-app-modernization-and-gamification.md`
- `design/GAMIFICATION-AND-MODERNIZATION-EXECUTION-PLAN.md`
- `gptdesign/pages/field-agent-gamification-modernization.md`
