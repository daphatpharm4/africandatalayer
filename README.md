# African Data Layer – MVP (Investor Demo)

A mobile-first web application that allows users to crowdsource and submit data about local kiosks and fuel stations across Africa.

---

## 🌍 Key Features

- 📸 Mandatory live camera capture (no gallery upload)
- 📍 GPS + photo metadata + IP location cross-check
- ⛽ Fuel & Mobile Money (Orange / MTN) data entry forms
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
- Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Optional (frontend): `VITE_ADMIN_EMAIL` (to show Impact tab for admin users)

Endpoints:
- `GET/POST /api/submissions`
- `GET/PUT /api/submissions/:id`
- `GET/PUT /api/user`
- `GET/POST /api/auth/*` (Auth.js)

Local dev (recommended):
- Backend: `npx vercel@latest dev --listen 3000`
- Frontend: `npm run dev` (Vite on `http://localhost:5173` with `/api` proxy)
