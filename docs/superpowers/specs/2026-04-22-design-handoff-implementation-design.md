# Design Handoff Implementation — Agent/Admin/Client Phone UI

**Date**: 2026-04-22
**Source**: `/Users/charlesvictormahouve/Downloads/design_handoff/` (README.md + 3 HTML prototypes + DESIGN_SYSTEM.md)
**Scope**: Visual refactor of 13 existing screens across 3 user roles to match high-fidelity prototypes
**Instruction**: "Follow the README exactly"

---

## 1. Goal

Bring the ADL mobile app into pixel-accurate alignment with the handoff prototypes while preserving all existing business logic (auth, offline queue, fraud detection, submission flow, admin review, gamification).

This is a **surgical visual refactor**, not a rewrite. No new features. No backend changes. No architectural shifts.

## 2. Strategy

### Core principle
Refactor the presentation layer of each existing screen component in place. Do not create parallel `components/kit/` trees. Do not break the `Screen` enum, navigation stack, or prop contracts consumed by `App.tsx`.

### Technique per screen
1. **Hoist visual chrome into small sub-components** inside the same file — `<Hero>`, `<KpiGrid>`, `<QueueCard>`, etc. Keeps business logic untouched while markup gets replaced.
2. **Replace raw hex with Tailwind tokens** — `bg-navy`, `bg-terra-wash`, `text-forest-dark`. Tokens already live in `tailwind.config.js`.
3. **Use existing `@layer components` utilities** — `.card`, `.btn-primary`, `.btn-cta`, `.btn-ghost`, `.micro-label`, `.route-grid`, `.motion-pressable`, `.screen-shell`, `.screen-header`.
4. **Wire `shared/` primitives in** — `BrandLogo`, `ScreenHeader`, `VerticalIcon`, `BottomSheet`, `ProfileAvatar`. Do not reinvent.
5. **Preserve bilingual `t(en, fr)` pattern** — every string change keeps both languages.
6. **Lucide icons only** — no emoji, no custom SVG beyond `BrandLogo`.

### Out of scope this session
- Backend/API changes
- New screens or navigation paths
- Dark mode
- Capacitor native integration changes
- Test suite expansion (only keep passing)

## 3. Screen Map

### Agent Kit — 5 screens
| # | Prototype | Existing file | Diff size |
|---|-----------|---------------|-----------|
| A1 | Home (map/list + mission peek + FAB) | `components/Screens/Home.tsx` | Medium — chrome + vertical picker + mission card restyle |
| A2 | Point Detail (photo, info card, GPS card, CTA) | `components/Screens/Details.tsx` | Small — re-layout |
| A3 | Contribution Flow (4 steps: photo/details/location/submit) | `components/Screens/ContributionFlow.tsx` | Medium — progress bar, step frames, footer buttons. Preserve all field schemas & validators |
| A4 | Success | Currently inline in ContributionFlow; extract `SuccessStep` sub-component | Small |
| A5 | Profile (hero + stat grid + badges + week table) | `components/Screens/Profile.tsx` | Medium — hero redesign |

### Admin Kit — 4 screens
| # | Prototype | Existing file | Diff size |
|---|-----------|---------------|-----------|
| B1 | Submission Queue (filter chips + risk cards) | `components/Screens/AdminQueue.tsx` (queue view) | Medium — card restyle |
| B2 | Submission Review (forensic + approve/reject + result) | `components/Screens/AdminQueue.tsx` (detail view) | Medium |
| B3 | Delta Dashboard (KPI tiles + vertical bars + weekly chart) | `components/Screens/DeltaDashboard.tsx` | Medium |
| B4 | Agent Performance (summary + ranked agent cards) | `components/Screens/AgentPerformance.tsx` | Small |

### Client Kit — 4 screens
| # | Prototype | Existing file | Diff size |
|---|-----------|---------------|-----------|
| C1 | Dashboard Overview (navy hero + KPIs + vertical bars + weekly + zones) | `components/Screens/InvestorDashboard.tsx` | Medium |
| C2 | Map Explorer (vertical chip row + clustered map + stats overlay) | `components/Screens/Home.tsx` (client variant via `userRole==='client'`) | Medium — conditional rendering |
| C3 | Insights (navy headline + story cards + export CTA) | **New screen** `components/Screens/ClientInsights.tsx` + `Screen.CLIENT_INSIGHTS` enum entry. Story cards hydrate from same snapshot endpoint that feeds Dashboard/DeltaDashboard | Small |
| C4 | Account (navy profile card + settings sections) | `components/Screens/Settings.tsx` with `userRole === 'client'` branch that swaps header chrome + section copy | Small |

### Nav bars (3 variants)
- **Agent**: Explore / Contribute / Leaderboard / Profile (4 items, Contribute = terra)
- **Admin**: Queue / Analytics / Agents (3 items)
- **Client**: Dashboard / Map / Insights / Account (4 items)

`components/Navigation.tsx` already role-aware. Extend its config map.

## 4. Execution Order

Ordered to minimize risk and get visible wins early:

**Phase 1 — Foundations (no behavior changes)**
1. Audit `tailwind.config.js` + `index.css` — confirm all tokens listed in README exist. Add any missing `.nav-label`, `.phone-frame` equivalents as `@layer components` classes.
2. Update `components/shared/ScreenHeader.tsx` to match prototype header grid (`44px 1fr 44px`) with optional `.route-grid` texture + right slot.
3. Update `components/Navigation.tsx` for 3-variant config (Admin = 3 items, Client = 4 different items).
4. Create `components/shared/StatusBar.tsx` — currently missing, used by all 13 prototypes.

**Phase 2 — Agent kit** (A5 → A2 → A1 → A4 → A3)
Smallest first. Profile hero restyle → Details re-layout → Home chrome + mission cards → Success extract → ContributionFlow progress/steps.

**Phase 3 — Admin kit** (B4 → B3 → B1 → B2)
AgentPerformance → DeltaDashboard → AdminQueue list → AdminQueue detail.

**Phase 4 — Client kit** (C4 → C1 → C3 → C2)
Settings client branch → InvestorDashboard hero + KPI grid + vertical bars + weekly + zones → new ClientInsights screen + wire into `Screen` enum + `App.tsx` route → Home.tsx client-map variant (reuses A1 map engine with cluster dot styling).

**Phase 5 — Verification**
- Manual click-through on each route per role.
- `npm run test:ci` passes (lint + typecheck + tests + build).
- `npm run check:function-budget` passes.
- Smoke-test offline queue flow still functional (contribution without network → sync).

## 5. Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| ContributionFlow (112K) regression — critical submission logic | Touch only JSX + Tailwind classes. No changes to Zod schemas, field state, GPS/EXIF handlers, queue writes. |
| AdminQueue (118K) regression — admin decisions, bulk actions | Preserve all handler signatures. Sub-component new render, same callbacks. |
| Tailwind token drift — raw hex creeping back in | Lint pass at end: grep for `#[0-9a-f]{3,8}` in changed files; replace with tokens. |
| Dark mode creep | Do not touch; only light surfaces in scope. |
| i18n regression — hardcoded strings | Every JSX string passes through `t()`. Dedicated lint pass. |
| Capacitor safe-area breaking | Keep existing `env(safe-area-inset-*)` padding in `screen-shell`; don't hardcode heights. |

## 6. Components & Boundaries

New files (shared primitives):
- `components/shared/StatusBar.tsx` — 44px iOS-style status bar (time + icons)
- `components/shared/KpiTile.tsx` — colored bg stat tile with optional delta indicator
- `components/shared/VerticalPickerBar.tsx` — the `h-12 rounded-2xl bg-gray-100` + `border-l-[3px]` selector
- `components/shared/FilterChipRow.tsx` — horizontal scrolling filter pills
- `components/shared/WeeklyBarChart.tsx` — 7-day bar chart used in admin + client
- `components/shared/RiskBadge.tsx` — Low/Medium/High pill
- `components/shared/TrustBadge.tsx` — Gold/Silver/Bronze pill

All < 80 lines each, pure presentational, no data fetching.

## 7. Verification Checklist

- [ ] All 13 screens match prototypes visually on iPhone 14 viewport (390×844)
- [ ] All 3 nav variants render correct item set
- [ ] `npm run test:ci` green
- [ ] No raw hex in `components/Screens/` (grep passes)
- [ ] All strings bilingual
- [ ] Offline queue still captures + syncs
- [ ] Admin approve/reject still writes to DB
- [ ] `prefers-reduced-motion` honored
- [ ] Touch targets ≥ 44×44px

## 8. Non-Goals Reiterated

- Do NOT migrate routing to React Router
- Do NOT introduce Zustand/Redux
- Do NOT rebuild with shadcn/ui
- Do NOT change API shapes
- Do NOT add new verticals or submission categories
- Do NOT ship the HTML prototypes themselves — they are reference only
