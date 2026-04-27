# Design Critique Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the 5 priority design issues surfaced in the April 2026 critique: font differentiation, empty states, hero metric reframe, error popover dismiss, and scroll affordance for chip rows.

**Architecture:** Seven focused tasks, each touching 1–2 files. No new components needed — all changes are additive edits to existing files. Font change flows from a single Tailwind token down; empty state changes are co-located copy swaps; the hero reframe is a structural edit to one section in InvestorDashboard; the error dismiss is a one-button addition; the scroll fade is a wrapper + CSS.

**Tech Stack:** React 19 · TypeScript 5.8 · Tailwind CSS 3.4 · Lucide React · Google Fonts (Sora) · `node --test` + `tsx` for verification

---

## Source Map

| File | Change |
|------|--------|
| `index.html` | Add Google Fonts Sora preconnect + stylesheet link |
| `tailwind.config.js` | Extend `fontFamily.display` token |
| `components/shared/ScreenHeader.tsx` | Add `font-display` to title element |
| `components/Screens/InvestorDashboard.tsx` | Add `font-display` to hero numerics; reframe hero section to narrative |
| `components/Screens/Analytics.tsx` | Improve 3 leaderboard empty states (lines 926–933, 1041–1048, 1122–1129) |
| `components/Screens/AgentPerformance.tsx` | Improve agent empty state (lines 137–141) |
| `components/Screens/Home.tsx` | Add X dismiss button to map + list error popover; add `X` to lucide import |
| `components/Screens/DeltaDashboard.tsx` | Wrap vertical filter chip row in scroll-fade container |

---

## Task 1: Add Sora font token

**Files:**
- Modify: `index.html`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Add Sora to index.html**

In `index.html`, inside `<head>`, after the `<meta viewport>` tag, add:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&display=swap" rel="stylesheet">
```

The full `<head>` should look like:

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&display=swap" rel="stylesheet">
    <title>African Data Layer</title>
    <link rel="icon" type="image/svg+xml" href="/logo-mark.svg">
</head>
```

- [ ] **Step 2: Add fontFamily.display token to tailwind.config.js**

In `tailwind.config.js`, add a `fontFamily` entry inside `theme.extend`, after the `colors` block:

```js
    extend: {
      colors: {
        // ... existing colors unchanged ...
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
      },
    },
```

Full updated file:

```js
/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0f2b46',
          dark: '#0b2236',
          light: '#e7eef4',
          wash: '#f2f6fa',
          border: '#d5e1eb',
          mid: '#1d4565',
        },
        terra: {
          DEFAULT: '#c86b4a',
          dark: '#b85f3f',
          wash: '#fff8f4',
        },
        forest: {
          DEFAULT: '#4c7c59',
          dark: '#3a6145',
          wash: '#eaf3ee',
        },
        gold: {
          DEFAULT: '#f4c317',
          wash: '#fef9e7',
        },
        amber: {
          DEFAULT: '#d97706',
          wash: '#fef3c7',
        },
        streak: {
          DEFAULT: '#6b46c1',
          wash: '#f7f4ff',
        },
        page: {
          DEFAULT: '#f9fafb',
        },
        ink: {
          DEFAULT: '#1f2933',
          dark: '#111827',
        },
        danger: {
          DEFAULT: '#c53030',
        },
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add index.html tailwind.config.js
git commit -m "feat(design): add Sora display font token"
```

---

## Task 2: Apply Sora to screen headings and large numerics

**Files:**
- Modify: `components/shared/ScreenHeader.tsx`
- Modify: `components/Screens/InvestorDashboard.tsx` (hero numbers only — hero structure changes in Task 5)

Tailwind generates `font-display` from the token added in Task 1. Apply it to title elements that carry visual weight.

- [ ] **Step 1: Apply font-display to ScreenHeader title**

In `components/shared/ScreenHeader.tsx`, line 47, the title div currently reads:

```tsx
        <div className={`truncate font-bold leading-tight ${isDark ? 'text-xs uppercase tracking-[0.16em]' : 'text-[15px]'}`}>
```

Change to:

```tsx
        <div className={`truncate font-display font-bold leading-tight ${isDark ? 'text-xs uppercase tracking-[0.16em]' : 'text-[15px]'}`}>
```

- [ ] **Step 2: Apply font-display to InvestorDashboard hero numerics**

In `components/Screens/InvestorDashboard.tsx`:

Line 410 — total points number:
```tsx
              <div className="text-[28px] font-extrabold leading-none">{totalPoints.toLocaleString()}</div>
```
Change to:
```tsx
              <div className="font-display text-[28px] font-extrabold leading-none">{totalPoints.toLocaleString()}</div>
```

Line 419 — coverage percentage:
```tsx
              <div className="text-[28px] font-extrabold leading-none text-gold">{avgCompletionRate}%</div>
```
Change to:
```tsx
              <div className="font-display text-[28px] font-extrabold leading-none text-gold">{avgCompletionRate}%</div>
```

- [ ] **Step 3: Verify visually**

Start the dev server (`npm run dev`), open `http://localhost:5173`. Inject admin + client role via browser console if needed. Check that:
- Screen headers (e.g. "Intelligence Delta", "Performance agents") render in Sora
- Investor Dashboard hero numbers render in Sora
- Body text (form labels, list items, micro-labels) remain in Inter

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add components/shared/ScreenHeader.tsx components/Screens/InvestorDashboard.tsx
git commit -m "feat(design): apply Sora display font to screen headings and hero numerics"
```

---

## Task 3: Leaderboard empty states (Analytics.tsx)

**Files:**
- Modify: `components/Screens/Analytics.tsx`

There are 3 instances of the bare "No contributor data yet." empty state. All 3 get the same treatment: a headline + explanatory sentence. The first instance (around line 926) is the main local leaderboard; the second (around line 1041) and third (around line 1122) are tab variants.

- [ ] **Step 1: Replace first empty state (around line 926)**

Find:
```tsx
              {!isLoadingLeaderboard && leaderboard.length === 0 && (
                <div className="rounded-[1.35rem] border border-gray-100 bg-page p-4 micro-label text-gray-400">
                  {t(
                    'No contributor data yet.',
                    'Pas encore de données contributeur.',
                  )}
                </div>
              )}
```

Replace with:
```tsx
              {!isLoadingLeaderboard && leaderboard.length === 0 && (
                <div className="rounded-[1.35rem] border border-gray-100 bg-page px-4 py-5">
                  <p className="text-[13px] font-semibold text-gray-700">
                    {t('No contributors yet.', 'Aucun contributeur pour l\'instant.')}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                    {t(
                      'Score = verified submissions × average quality. Submit your first capture to appear here.',
                      'Score = soumissions vérifiées × qualité moyenne. Faites votre première capture pour apparaître ici.',
                    )}
                  </p>
                </div>
              )}
```

- [ ] **Step 2: Replace second empty state (around line 1041)**

Find:
```tsx
              {!isLoadingLeaderboard && leaderboard.length === 0 && (
                <div className="bg-page border border-gray-100 rounded-2xl p-3 micro-label text-gray-400">
                  {t(
                    'No contributor data yet.',
                    'Pas encore de données contributeur.',
                  )}
                </div>
              )}
```

Replace with:
```tsx
              {!isLoadingLeaderboard && leaderboard.length === 0 && (
                <div className="rounded-2xl border border-gray-100 bg-page px-4 py-5">
                  <p className="text-[13px] font-semibold text-gray-700">
                    {t('No contributors yet.', 'Aucun contributeur pour l\'instant.')}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                    {t(
                      'Score = verified submissions × average quality. Submit your first capture to appear here.',
                      'Score = soumissions vérifiées × qualité moyenne. Faites votre première capture pour apparaître ici.',
                    )}
                  </p>
                </div>
              )}
```

- [ ] **Step 3: Replace third empty state (around line 1122)**

Find:
```tsx
              {!isLoadingLeaderboard && clientTopContributors.length === 0 && (
                <div className="bg-page border border-gray-100 rounded-2xl p-3 micro-label text-gray-400">
                  {t(
                    'No contributor data yet.',
                    'Pas encore de données contributeur.',
                  )}
                </div>
              )}
```

Replace with:
```tsx
              {!isLoadingLeaderboard && clientTopContributors.length === 0 && (
                <div className="rounded-2xl border border-gray-100 bg-page px-4 py-5">
                  <p className="text-[13px] font-semibold text-gray-700">
                    {t('No contributors yet.', 'Aucun contributeur pour l\'instant.')}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                    {t(
                      'Agent rankings appear once submissions are verified.',
                      'Les classements apparaissent une fois les soumissions vérifiées.',
                    )}
                  </p>
                </div>
              )}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add components/Screens/Analytics.tsx
git commit -m "feat(design): improve leaderboard empty states with educational copy"
```

---

## Task 4: AgentPerformance empty state

**Files:**
- Modify: `components/Screens/AgentPerformance.tsx`

- [ ] **Step 1: Replace empty state (around line 137)**

Find:
```tsx
          {!loading && agentRows.length === 0 && (
            <div className="rounded-2xl border border-gray-100 bg-page p-4 text-xs text-gray-500">
              {t('No agent performance data yet.', 'Pas encore de données de performance agents.')}
            </div>
          )}
```

Replace with:
```tsx
          {!loading && agentRows.length === 0 && (
            <div className="rounded-2xl border border-gray-100 bg-page px-4 py-5">
              <p className="text-[13px] font-semibold text-gray-700">
                {t('No agent data yet.', 'Aucune donnée agent pour l\'instant.')}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                {t(
                  'Rankings populate after submissions are approved in the review queue.',
                  'Les classements se remplissent après approbation des soumissions dans la file de revue.',
                )}
              </p>
            </div>
          )}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/Screens/AgentPerformance.tsx
git commit -m "feat(design): improve agent performance empty state with contextual copy"
```

---

## Task 5: InvestorDashboard hero metric reframe

**Files:**
- Modify: `components/Screens/InvestorDashboard.tsx`

**What changes:** The two-tile grid `POINTS TOTAUX (big number) | COUVERTURE % (gold)` becomes a narrative headline block + smaller stat grid. When `totalPoints === 0`, it reads "Awaiting first capture" instead of displaying a prominent `0`. The gold color on coverage no longer applies at 0% (gold = achievement; 0 is not an achievement).

- [ ] **Step 1: Replace the hero section (around lines 393–423)**

Find the entire block:
```tsx
        {/* Hero */}
        <section className="route-grid shrink-0 bg-navy px-4 pb-5 pt-4 text-white">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrandLogo size={20} />
              <div>
                <div className="text-[15px] font-bold leading-tight">African Data Layer</div>
                <div className="text-[11px] text-white/50">
                  {t('Client Dashboard', 'Tableau client')} · {formattedDate}
                </div>
              </div>
            </div>
            <span className="micro-label rounded-full bg-white/10 px-2.5 py-0.5 text-white/70">{t('Client', 'Client')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[14px] border border-white/10 bg-white/[0.08] p-3.5">
              <div className="micro-label mb-1 text-[9px] text-white/50">{t('Total Points', 'Points totaux')}</div>
              <div className="text-[28px] font-extrabold leading-none">{totalPoints.toLocaleString()}</div>
              {avgWoW !== null && (
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-green-400">
                  <TrendingUp size={11} /> {avgWoW >= 0 ? '+' : ''}{avgWoW}% {t('this week', 'cette semaine')}
                </div>
              )}
            </div>
            <div className="rounded-[14px] border border-gold/20 bg-gold/15 p-3.5">
              <div className="micro-label mb-1 text-[9px] text-gold/70">{t('Coverage', 'Couverture')}</div>
              <div className="text-[28px] font-extrabold leading-none text-gold">{avgCompletionRate}%</div>
              <div className="mt-1 text-[11px] font-medium text-white/50">{t('Bonamoussadi', 'Bonamoussadi')}</div>
            </div>
          </div>
        </section>
```

Replace with:
```tsx
        {/* Hero */}
        <section className="route-grid shrink-0 bg-navy px-4 pb-5 pt-4 text-white">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrandLogo size={20} />
              <div>
                <div className="text-[15px] font-bold leading-tight">African Data Layer</div>
                <div className="text-[11px] text-white/50">
                  {t('Client Dashboard', 'Tableau client')} · {formattedDate}
                </div>
              </div>
            </div>
            <span className="micro-label rounded-full bg-white/10 px-2.5 py-0.5 text-white/70">{t('Client', 'Client')}</span>
          </div>
          {/* Narrative status line */}
          <div className="mb-2.5 rounded-[14px] border border-white/10 bg-white/[0.08] px-3.5 py-3">
            <div className="micro-label mb-1 text-[9px] text-white/50">
              {t('Network status', 'Statut réseau')}
            </div>
            {totalPoints > 0 ? (
              <>
                <div className="font-display text-[17px] font-bold leading-snug text-white">
                  {t('Active network', 'Réseau actif')} · {totalPoints.toLocaleString()} {t('points mapped', 'points cartographiés')}
                </div>
                {avgWoW !== null && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-green-400">
                    <TrendingUp size={11} /> {avgWoW >= 0 ? '+' : ''}{avgWoW}% {t('this week', 'cette semaine')}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-display text-[17px] font-bold leading-snug text-white/60">
                  {t('Awaiting first capture', 'En attente de la première capture')}
                </div>
                <div className="mt-0.5 text-[11px] text-white/40">
                  {t('Field agents are being onboarded.', 'Les agents terrain sont en cours d\'intégration.')}
                </div>
              </>
            )}
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[14px] border border-white/10 bg-white/[0.08] p-3">
              <div className="micro-label mb-1 text-[9px] text-white/50">{t('Verified', 'Vérifiés')}</div>
              <div className="font-display text-[22px] font-extrabold leading-none">
                {kpi?.verification.verifiedPoints.toLocaleString() ?? '--'}
              </div>
              <div className="mt-0.5 text-[11px] text-white/40">
                / {kpi?.verification.totalPoints.toLocaleString() ?? '--'} {t('total', 'total')}
              </div>
            </div>
            <div className={`rounded-[14px] p-3 ${avgCompletionRate > 0 ? 'border border-gold/20 bg-gold/15' : 'border border-white/10 bg-white/[0.08]'}`}>
              <div className={`micro-label mb-1 text-[9px] ${avgCompletionRate > 0 ? 'text-gold/70' : 'text-white/50'}`}>
                {t('Coverage', 'Couverture')}
              </div>
              <div className={`font-display text-[22px] font-extrabold leading-none ${avgCompletionRate > 0 ? 'text-gold' : 'text-white/40'}`}>
                {avgCompletionRate}%
              </div>
              <div className="mt-0.5 text-[11px] text-white/40">
                {t('Bonamoussadi', 'Bonamoussadi')}
              </div>
            </div>
          </div>
        </section>
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `kpi?.verification.verifiedPoints` causes a type error (it's a number, not string), `toLocaleString()` is valid on `number`.

- [ ] **Step 3: Verify visually**

Open the app, inject client role via browser console:
```js
// In browser console:
const rootEl = document.getElementById('root');
const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber'));
let node = rootEl[fiberKey];
let d = 200; while (node && d-- > 0) { if (node.type?.name === 'App') break; node = node.child || node.return; }
const getD = (n, i) => { let s = n.memoizedState; for (let j = 0; j < i; j++) s = s?.next; return s?.queue?.dispatch; };
getD(node,3)?.(true); getD(node,5)?.(false); getD(node,7)?.('client'); getD(node,1)?.('INVESTOR_DASHBOARD');
```

Check that:
- The narrative line reads "Awaiting first capture" (or "En attente...") when no data
- Coverage tile is not gold when `avgCompletionRate === 0`
- Layout is not broken at 390px viewport width

- [ ] **Step 4: Commit**

```bash
git add components/Screens/InvestorDashboard.tsx
git commit -m "feat(design): reframe investor dashboard hero from metric slots to narrative status"
```

---

## Task 6: Home.tsx error popover dismiss

**Files:**
- Modify: `components/Screens/Home.tsx`

**What changes:** Both the map-view and list-view error states get an X dismiss button. `X` icon added to the existing lucide import. Dismiss calls `setPointsLoadError('')`.

- [ ] **Step 1: Add X to lucide import**

In `components/Screens/Home.tsx`, find the lucide import block (lines 12–20):

```tsx
import {
  ChevronRight,
  Filter,
  Plus,
  Route,
  Sparkles,
  Target,
  User
} from 'lucide-react';
```

Change to:

```tsx
import {
  ChevronRight,
  Filter,
  Plus,
  Route,
  Sparkles,
  Target,
  User,
  X,
} from 'lucide-react';
```

- [ ] **Step 2: Add dismiss to map-view error (around line 806)**

Find:
```tsx
        {viewMode === 'map' && pointsLoadError && !isLoadingPoints && (
          <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex justify-center">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-terra/20 bg-white/96 p-3 shadow-lg backdrop-blur-sm">
              <p className="text-sm font-semibold leading-5 text-gray-900">{pointsLoadError}</p>
              <button
                type="button"
                onClick={() => void loadPoints()}
                className="mt-3 rounded-xl bg-navy px-3 py-2 text-xs font-semibold text-white"
              >
                {t('Try again', 'Réessayer')}
              </button>
            </div>
          </div>
        )}
```

Replace with:
```tsx
        {viewMode === 'map' && pointsLoadError && !isLoadingPoints && (
          <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex justify-center">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-terra/20 bg-white/96 p-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-5 text-gray-900">{pointsLoadError}</p>
                <button
                  type="button"
                  onClick={() => setPointsLoadError('')}
                  className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600"
                  aria-label={t('Dismiss', 'Fermer')}
                >
                  <X size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => void loadPoints()}
                className="mt-3 rounded-xl bg-navy px-3 py-2 text-xs font-semibold text-white"
              >
                {t('Try again', 'Réessayer')}
              </button>
            </div>
          </div>
        )}
```

- [ ] **Step 3: Add dismiss to list-view error (around line 835)**

Find:
```tsx
              {pointsLoadError && !isLoadingPoints && (
                <div className="card-soft border border-terra/20 p-4">
                  <p className="text-sm font-semibold leading-5 text-gray-900">{pointsLoadError}</p>
                  <button
                    type="button"
                    onClick={() => void loadPoints()}
                    className="motion-pressable mt-3 rounded-xl bg-navy px-3 py-2 text-xs font-semibold text-white"
                  >
                    {t('Try again', 'Réessayer')}
                  </button>
                </div>
              )}
```

Replace with:
```tsx
              {pointsLoadError && !isLoadingPoints && (
                <div className="card-soft border border-terra/20 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-5 text-gray-900">{pointsLoadError}</p>
                    <button
                      type="button"
                      onClick={() => setPointsLoadError('')}
                      className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600"
                      aria-label={t('Dismiss', 'Fermer')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadPoints()}
                    className="motion-pressable mt-3 rounded-xl bg-navy px-3 py-2 text-xs font-semibold text-white"
                  >
                    {t('Try again', 'Réessayer')}
                  </button>
                </div>
              )}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Verify visually**

Open the app (no backend running so the error will appear naturally). Confirm:
- X button appears in the top-right of the error card
- Clicking X removes the error card entirely
- "Réessayer" button still triggers a retry (error reappears since backend is absent)

- [ ] **Step 6: Commit**

```bash
git add components/Screens/Home.tsx
git commit -m "feat(design): add dismiss button to map and list error popovers"
```

---

## Task 7: DeltaDashboard vertical chip row scroll fade

**Files:**
- Modify: `components/Screens/DeltaDashboard.tsx`

**What changes:** The vertical filter chip row (`flex overflow-x-auto no-scrollbar`) gets wrapped in a `relative` container with a right-edge gradient fade, making it obvious that more chips are off-screen.

- [ ] **Step 1: Find the chip row (around line 577)**

The current code is:
```tsx
        <div className="flex overflow-x-auto space-x-2 no-scrollbar pb-1">
          <button
            onClick={() => setSelectedVertical('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl micro-label transition-colors ${
              selectedVertical === 'all' ? 'bg-navy text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t('All', 'Tout')}
          </button>
          {VERTICAL_IDS.map((vid) => (
            <button
              key={vid}
              onClick={() => setSelectedVertical(vid)}
```

- [ ] **Step 2: Wrap in scroll-fade container**

Replace just the outer div opening tag:

Find:
```tsx
        <div className="flex overflow-x-auto space-x-2 no-scrollbar pb-1">
```

Replace with:
```tsx
        <div className="relative">
          <div className="flex overflow-x-auto space-x-2 no-scrollbar pb-1 pr-8">
```

Then find the closing `</div>` that closes the chip row (it comes right before the next section comment or sibling element). Add the fade overlay and close the outer wrapper:

```tsx
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-page to-transparent" />
        </div>
```

To find the exact closing tag: the chip row `div` opened at the line you changed. Its closing `</div>` is the one that closes after the `{VERTICAL_IDS.map(...)}` block. The new structure must be:

```tsx
        <div className="relative">
          <div className="flex overflow-x-auto space-x-2 no-scrollbar pb-1 pr-8">
            <button
              onClick={() => setSelectedVertical('all')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl micro-label transition-colors ${
                selectedVertical === 'all' ? 'bg-navy text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {t('All', 'Tout')}
            </button>
            {VERTICAL_IDS.map((vid) => (
              <button
                key={vid}
                onClick={() => setSelectedVertical(vid)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl micro-label transition-colors ${
                  selectedVertical === vid ? 'bg-navy text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {VERTICALS[vid]?.label ?? vid}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-page to-transparent" />
        </div>
```

Note: the `VERTICALS[vid]?.label` is illustrative — use whatever label expression is already in the existing code for each chip button.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Verify visually**

Open the app, inject admin role and navigate to DeltaDashboard (Analyses tab). Confirm:
- A soft gradient fade is visible on the right edge of the chip row
- Chips still scroll horizontally
- Fade disappears when scrolled to the last chip (the gradient is static — this is acceptable for this task; dynamic fade-on-last-chip is a future enhancement)

- [ ] **Step 5: Commit**

```bash
git add components/Screens/DeltaDashboard.tsx
git commit -m "feat(design): add scroll-fade affordance to DeltaDashboard vertical filter chips"
```

---

## Self-Review

**Spec coverage check:**

| Critique Issue | Task | Status |
|---|---|---|
| P1: Inter font (anti-pattern) | Tasks 1 + 2 | ✅ Covered |
| P2: Empty states bare/harsh | Tasks 3 + 4 | ✅ Covered |
| P3: Hero metric template | Task 5 | ✅ Covered |
| P4: Error popover no dismiss | Task 6 | ✅ Covered |
| P5: KPI scroll no affordance | Task 7 | ✅ Covered (DeltaDashboard chip row) |

**Notes on scope:**
- InvestorDashboard KPI ribbon uses `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` — it's a CSS grid, not a scroll container. No scroll affordance needed there.
- `FilterChipRow` (used in Home.tsx client view) is a shared component; if a scroll fade is needed there it should be a follow-up task in a separate plan to avoid scope creep.
- Minor critique observations (DENVER map label, gold 0% coverage) — gold 0% is fixed in Task 5. DENVER is a tile provider/bounds config issue outside this plan's scope.

**Placeholder scan:** No TBD, TODO, or "similar to task N" references. All code blocks contain complete replacement code. ✅

**Type consistency:** `setPointsLoadError('')` used consistently (matches `useState('')`). `font-display` Tailwind class used consistently across Tasks 2 and 5. `avgCompletionRate` referenced in Task 5 matches existing variable name at line 781. ✅
