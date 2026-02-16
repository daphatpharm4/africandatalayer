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

This repo includes serverless functions under `/api` for Auth.js (Google OAuth + credentials), submissions, and user profiles. Deploy on Vercel to enable the backend, then set these environment variables:

- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `AUTH_URL` (e.g. `https://your-app.vercel.app`)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `EDGE_CONFIG`
- `EDGE_CONFIG_ID`
- `VERCEL_API_TOKEN`
- `BLOB_READ_WRITE_TOKEN` (for storing user-submitted photos)
- Optional: `MAX_SUBMISSION_IMAGE_BYTES` (default `8388608`)
- Optional: `MAX_EDGE_CONFIG_SUBMISSIONS_BYTES` (default `1800000`)
- Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Optional (frontend): `VITE_ADMIN_EMAIL` (to show Impact tab for admin users)

Endpoints:
- `GET/POST /api/submissions` (default returns projected points; add `?view=events` for raw append-only events)
- `GET/PUT /api/submissions/:id`
- `GET/PUT /api/user`
- `GET/POST /api/auth/*` (Auth.js)

Bonamoussadi CSV import:
- Dry run: `npm run import:bonamoussadi -- --csv /absolute/path/to/bonamoussadi_pharmacy_fuel_curated.csv --dry-run`
- Write to Edge Config: `npm run import:bonamoussadi -- --csv /absolute/path/to/bonamoussadi_pharmacy_fuel_curated.csv --write`

Local dev (recommended):
- Backend: `npx vercel@latest dev --listen 3000`
- Frontend: `npm run dev` (Vite on `http://localhost:5173` with `/api` proxy)
