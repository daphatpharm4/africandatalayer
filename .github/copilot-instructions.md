<!--
Repository: africandatalayer (daphatpharm4)
Purpose: concise, actionable instructions for AI coding agents working on African Data Layer.
This file merges the project's AGENTS.md, CLAUDE.md, README.md, package.json scripts, and CI workflows.
Edit with care — preserve human-written sections marked with <!-- HUMAN: ... -->.
-->

# Copilot instructions for African Data Layer

Summary (big picture)
- Mobile-first React + TypeScript app (Vite) that targets field data collection for Cameroonian cities.
- Frontend: React 19 + Vite + Tailwind; no external state library — `App.tsx` owns global state.
- Backend: Vercel serverless functions under `/api/` (Postgres via Supabase, `pg` driver, raw SQL).
- Offline-first: IndexedDB queue for submissions; auto-sync on reconnect.
- Key domains: submissions, fraud detection (EXIF + GPS heuristics), gamification (XP/streaks), admin review.

Quick repo facts (useful entry points)
- Root scripts: see `package.json` (dev, build, test, lint, typecheck, migrate, backup, seed, import scripts).
- Key folders: `api/`, `lib/server/`, `lib/client/`, `components/`, `shared/`, `scripts/`, `supabase/`, `tests/`, `docs/`.
- Config: `tailwind.config.js`, `tsconfig.json`, `vite.config.ts`, `.env.example` (39 env vars documented).
- CI: `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` on push/PR.

What you (the agent) should do first (evidence-first exploration)
1. Read these files: `AGENTS.md`, `CLAUDE.md`, `README.md`, `.github/workflows/ci.yml`, and `package.json` (done).
2. Run local checks (ensure Node + npm installed):
   - npm ci
   - npm run lint
   - npm run typecheck
   - npm test
3. Inspect serverless functions and security-sensitive code in `api/` and `lib/server/` before making changes.

Concrete developer workflows (copyable)
- Install & test (macOS):
```zsh
cd africandatalayer
npm ci
npm run lint
npm run typecheck
npm test
```
- Dev server (frontend):
```zsh
npm run dev
# opens Vite at http://localhost:5173; backend serverless functions can run with `npx vercel dev --listen 3000`
```
- Build & preview:
```zsh
npm run build
npm run preview
```
- Migrations & data ops (DB required):
```zsh
npm run migrate:dry
npm run migrate
# import example CSV (dry-run)
npm run import:bonamoussadi -- --csv /absolute/path.csv --dry-run
```
- Backups (weekly workflow exists): use `node scripts/backup-postgres-to-blob.mjs` with env secrets.

Project-specific conventions and rules
- Navigation: no React Router — `Screen` enum + `navigateTo()`/`goBack()` patterns. Modifying routing must update `App.tsx` and `Screen` usages.
- State: global app state is centralized in `App.tsx` (avoid introducing Redux/MobX). Prefer prop-drilling or context carefully.
- Styling: Tailwind tokens are extended in `tailwind.config.js`; prefer design tokens (navy, terra, forest, gold) and `@layer components` classes in `index.css`.
- Types & imports: use `@/*` import alias configured in `tsconfig.json`/`vite.config.ts`.
- Tests: Node native runner via `tsx` is used. Tests live in `/tests`. Keep them fast and deterministic (no network calls unless mocked).
- Server functions: use `lib/server/http.ts` helpers for consistent responses and `lib/server/validation.ts` (Zod) for request schemas.

Security & secrets
- 39 env vars listed in `.env.example`. Do not expose server-only secrets (GEMINI_API_KEY, DB URLs) to frontend or commit them.
- Auth: @auth/core (Auth.js) with credentials + Google OAuth; admin bootstrapping via env vars.
- Photo uploads: use `@vercel/blob`. EXIF + geo checks run server-side in `lib/server/submissionFraud.ts`.

Integration points (list discovered)
- Gemini (server-only): `POST /api/ai/search` uses `GEMINI_API_KEY`.
- Supabase/Postgres: `ADL_POSTGRES_URL` / `POSTGRES_URL`.
- Vercel edge-config / blob: `EDGE_CONFIG` / `BLOB_READ_WRITE_TOKEN`.
- Sentry: `SENTRY_DSN` / `VITE_SENTRY_DSN`.

CI and quality gates
- `.github/workflows/ci.yml` (push/PR): runs `npm ci`, `lint`, `typecheck`, `test`, `build` on Node 22.
- Weekly backup workflow runs `scripts/backup-postgres-to-blob.mjs` with Postgres secrets.

How to propose changes (PR checklist for agents)
1. Run the repo test & lint suite locally; attach command outputs in the PR description under an "Evidence" section.
2. For code changes that touch server logic, include unit tests and run `npm run test` locally.
3. For changes that affect CI or build, update workflows and add a small smoke test ensuring `npm run build` still succeeds.
4. Preserve design tokens; when changing styles, add visual regression notes and optional screenshot diffs.
5. When adding environment variables, update `.env.example` and docs in `README.md`.

Small examples to copy into PRs
- Run tests: `npm ci && npm test` (fast local run).
- Start frontend + local serverless functions (dev): `npm run dev` and `npx vercel dev --listen 3000`.

Files to reference when making edits
- App & navigation: `App.tsx`, `components/Navigation.tsx`, `components/Screens/`.
- Server: `lib/server/*`, `api/*`.
- Styling: `tailwind.config.js`, `index.css`, `components/*`.
- Tests: `tests/`.
- Docs & agent guidance: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/`.

What I didn't assume
- Do not assume any secret or database is available by default — run migrations and backups only after setting env vars and confirming credentials.
- Do not change the auth or payment flows without a clear follow-up plan for rotating keys and testing admin bootstrapping.

What you (human) can tell me to accelerate
- If you want I can open a draft PR that updates `.github/copilot-instructions.md` with this content and include the commands I ran as evidence.
- If there are specific areas you want automated tests for (e.g., API contract, migration scripts), tell me which and I will scaffold tests.

---
If this looks good I can open a PR with this file updated (include the run outputs as "Evidence") or iterate on any missing details you want added.
