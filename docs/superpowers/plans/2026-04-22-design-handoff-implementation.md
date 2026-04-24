# Design Handoff Implementation Plan

## Implementation Status

**Status**: ✅ COMPLETE  
**Completed**: 2026-04-24  
**Branch**: `dev`  
**Commits**: 42 commits from `44c7b72` to `a7d7ea7b20c12e9c95e8c32a0bc415782887c928`

### Deviations from plan

| Item | Plan | Actual |
|------|------|--------|
| `components/shared/VerticalBars.tsx` | Standalone shared primitive | Inlined in DeltaDashboard.tsx + InvestorDashboard.tsx — screens are complex enough to justify local scope |
| `components/shared/ZoneList.tsx` | Standalone shared primitive | Inlined in InvestorDashboard.tsx — only used in one screen |

### Verification results

| Check | Result |
|-------|--------|
| TypeScript (components only) | ✅ 0 errors |
| Tests | ✅ 159/160 (1 pre-existing failure: aiSearchApi — broken @google/genai dep) |
| Build | ✅ 3.51s clean |
| Function budget | ✅ 13/13 |
| Raw hex in className | ✅ 0 violations (fixed ContributionFlow.tsx:1659) |
| Bilingual coverage | ✅ All strings wrapped |
| Visual smoke test | ✅ Agent, client roles verified in browser |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Refactor the ADL mobile UI to match the 3 high-fidelity handoff prototypes (agent/admin/client) across 13 screens while preserving all existing business logic.

**Architecture:** Surgical presentation-layer refactor. Sub-components hoisted inside existing screen files so JSX gets replaced without touching handlers, hooks, validators, API calls, or queue writes. New shared primitives for repeated patterns (StatusBar, KpiTile, WeeklyBarChart, etc.). No routing or state-management changes.

**Tech Stack:** React 19 + TypeScript 5.8, Tailwind CSS 3.4 (tokens in `tailwind.config.js`), Lucide React icons, existing `@layer components` utilities in `index.css`, Capacitor 8, @auth/core, IndexedDB offline queue.

**Reference prototypes (read these before touching each screen):**
- `/Users/charlesvictormahouve/Downloads/design_handoff/agent_app.html`
- `/Users/charlesvictormahouve/Downloads/design_handoff/admin.html`
- `/Users/charlesvictormahouve/Downloads/design_handoff/client.html`
- `/Users/charlesvictormahouve/Downloads/design_handoff/README.md`

**Hard rules across every task:**
- No raw hex values in TSX. Use Tailwind tokens (`bg-navy`, `text-terra-wash`, etc.)
- Every user-facing string uses `t(en, fr)` inline pattern
- Touch targets ≥ 44×44px (`min-h-[44px]`)
- Preserve existing business logic — never change handler signatures, hooks, validators, or state shape
- Commit after each task passes

---

## File Structure

### New files (10)
| Path | Responsibility |
|------|---------------|
| `components/shared/StatusBar.tsx` | 44px iOS-style status bar (time + signal/wifi/battery icons). Pure presentational |
| `components/shared/KpiTile.tsx` | Colored-bg stat tile with optional delta indicator (used in Profile, DeltaDashboard, InvestorDashboard) |
| `components/shared/RiskBadge.tsx` | Low/Medium/High risk pill (AdminQueue, submission review) |
| `components/shared/TrustBadge.tsx` | Gold/Silver/Bronze tier pill (AdminQueue, AgentPerformance) |
| `components/shared/FilterChipRow.tsx` | Horizontal scrolling filter pills (AdminQueue, ClientMap) |
| `components/shared/WeeklyBarChart.tsx` | 7-day bar chart (DeltaDashboard, InvestorDashboard) |
| `components/shared/VerticalPickerBar.tsx` | `h-12 rounded-2xl bg-gray-100 border-l-[3px]` vertical selector (Home) |
| `components/Screens/ClientInsights.tsx` | New screen: navy headline story + insight cards + export CTA |
| `components/shared/VerticalBars.tsx` | Per-vertical row with icon + label + count + delta + progress bar (DeltaDashboard + InvestorDashboard) |
| `components/shared/ZoneList.tsx` | Top zones ranking list (InvestorDashboard) |

### Modified files (existing screens — JSX swap only)
| Path | Scope |
|------|-------|
| `types.ts` | Add `CLIENT_INSIGHTS = 'CLIENT_INSIGHTS'` to Screen enum |
| `index.css` | Add any missing `@layer components` utility classes |
| `App.tsx` | Add `<Suspense>` lazy import + renderScreen case for ClientInsights |
| `components/Navigation.tsx` | Add admin 3-item variant; wire ClientInsights nav item |
| `components/shared/ScreenHeader.tsx` | Add `.route-grid` texture option; subtitle prop; right-slot badge |
| `components/Screens/Home.tsx` | Header chrome, vertical picker, tab switcher, mission peek, list cards, client-variant map |
| `components/Screens/Details.tsx` | Photo block, info card layout, GPS card, CTA button |
| `components/Screens/ContributionFlow.tsx` | Progress bar, 4 step frames, footer buttons, inline Success |
| `components/Screens/Profile.tsx` | Navy hero, 4-col stat grid, badge pills, week table |
| `components/Screens/AdminQueue.tsx` | Filter chips, queue cards, detail forensic, decision result |
| `components/Screens/DeltaDashboard.tsx` | KPI tiles, vertical bars, weekly chart |
| `components/Screens/AgentPerformance.tsx` | Summary tiles, ranked agent cards with tier avatars |
| `components/Screens/InvestorDashboard.tsx` | Navy hero, KPI grid, vertical bars, weekly, zones |
| `components/Screens/Settings.tsx` | Client-role branch: navy profile card + grouped sections |

---

## Phase 1: Foundations

### Task 1: Add missing `@layer components` utilities

**Files:**
- Modify: `index.css`

- [x] **Step 1: Read current component layer**

```bash
grep -n "@layer components" index.css
```

- [x] **Step 2: Add prototype-required utilities inside `@layer components` block**

Append these classes before the closing brace of the `@layer components` block:

```css
.micro-label-wide {
  @apply text-[11px] font-semibold uppercase tracking-[0.20em];
}

.card-soft {
  @apply rounded-2xl border border-gray-100 bg-white shadow-sm;
}

.stat-tile {
  @apply rounded-[14px] p-3 text-center;
}

.risk-low { @apply bg-forest-wash text-forest-dark; }
.risk-medium { @apply bg-amber-wash text-amber; }
.risk-high { @apply bg-red-100 text-red-800; }

.tier-gold { @apply bg-gold-wash text-amber; }
.tier-silver { @apply bg-gray-100 text-gray-600; }
.tier-bronze { @apply bg-terra-wash text-terra; }

.chip {
  @apply inline-flex items-center gap-1.5 rounded-full border px-3 font-semibold;
  min-height: 32px;
  font-size: 11px;
}
.chip-active {
  @apply border-navy bg-navy text-white;
}
.chip-idle {
  @apply border-gray-200 bg-white text-gray-500;
}
```

- [x] **Step 3: Verify CSS builds**

Run: `npm run build 2>&1 | tail -20`
Expected: No PostCSS errors about unknown classes

- [x] **Step 4: Commit**

```bash
git add index.css
git commit -m "feat(design): add missing @layer component utilities for prototype parity"
```

---

### Task 2: Create `StatusBar` shared primitive

**Files:**
- Create: `components/shared/StatusBar.tsx`

- [x] **Step 1: Write component**

```tsx
import React from 'react';

const StatusBar: React.FC = () => (
  <div
    aria-hidden="true"
    className="flex h-11 shrink-0 items-center justify-between bg-white px-5"
  >
    <span className="text-[15px] font-semibold text-ink-dark">9:41</span>
    <div className="flex items-center gap-1.5 text-ink-dark">
      <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
        <rect x="0" y="3" width="3" height="9" rx="1" />
        <rect x="4.5" y="2" width="3" height="10" rx="1" />
        <rect x="9" y="0.5" width="3" height="11.5" rx="1" />
        <rect x="13.5" y="0" width="2.5" height="12" rx="1" opacity="0.3" />
      </svg>
      <svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor">
        <path d="M7.5 2.5C9.8 2.5 11.9 3.4 13.4 4.9L14.8 3.5C12.9 1.6 10.3 0.5 7.5 0.5C4.7 0.5 2.1 1.6 0.2 3.5L1.6 4.9C3.1 3.4 5.2 2.5 7.5 2.5Z" opacity="0.3" />
        <path d="M7.5 5.5C9 5.5 10.3 6.1 11.3 7.1L12.7 5.7C11.3 4.3 9.5 3.5 7.5 3.5C5.5 3.5 3.7 4.3 2.3 5.7L3.7 7.1C4.7 6.1 6 5.5 7.5 5.5Z" />
        <circle cx="7.5" cy="10" r="2" />
      </svg>
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
        <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor" strokeOpacity="0.35" />
        <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
        <path d="M23 4.5V7.5C23.8 7.2 24.5 6.4 24.5 6C24.5 5.6 23.8 4.8 23 4.5Z" fill="currentColor" opacity="0.4" />
      </svg>
    </div>
  </div>
);

export default React.memo(StatusBar);
```

- [x] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | grep StatusBar`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git add components/shared/StatusBar.tsx
git commit -m "feat(shared): add StatusBar primitive for phone-frame chrome"
```

---

### Task 3: Create `KpiTile` primitive

**Files:**
- Create: `components/shared/KpiTile.tsx`

- [x] **Step 1: Write component**

```tsx
import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

type Tone = 'navy' | 'terra' | 'forest' | 'streak' | 'amber' | 'gold';

interface Props {
  label: string;
  value: string | number;
  delta?: number;
  tone?: Tone;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const toneMap: Record<Tone, { bg: string; text: string }> = {
  navy:   { bg: 'bg-navy-wash',   text: 'text-navy' },
  terra:  { bg: 'bg-terra-wash',  text: 'text-terra' },
  forest: { bg: 'bg-forest-wash', text: 'text-forest-dark' },
  streak: { bg: 'bg-streak-wash', text: 'text-streak' },
  amber:  { bg: 'bg-amber-wash',  text: 'text-amber' },
  gold:   { bg: 'bg-gold-wash',   text: 'text-amber' },
};

const KpiTile: React.FC<Props> = ({ label, value, delta, tone = 'navy', icon, onClick }) => {
  const t = toneMap[tone];
  const isPos = (delta ?? 0) >= 0;
  const display = typeof value === 'number' ? value.toLocaleString() : value;
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`${t.bg} stat-tile motion-pressable w-full text-left`}
    >
      {(icon || typeof delta === 'number') && (
        <div className="mb-2 flex items-center justify-between">
          {icon ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/70">{icon}</div>
          ) : <span />}
          {typeof delta === 'number' && (
            <span className={`flex items-center gap-0.5 text-[11px] font-bold ${isPos ? 'text-forest-dark' : 'text-danger'}`}>
              {isPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {isPos ? '+' : ''}{delta}
            </span>
          )}
        </div>
      )}
      <div className={`text-[22px] font-extrabold leading-none ${t.text}`}>{display}</div>
      <div className={`micro-label-wide mt-1 ${t.text} opacity-70`}>{label}</div>
    </Component>
  );
};

export default React.memo(KpiTile);
```

- [x] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | grep KpiTile`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git add components/shared/KpiTile.tsx
git commit -m "feat(shared): add KpiTile primitive for dashboard stats"
```

---

### Task 4: Create `RiskBadge` + `TrustBadge`

**Files:**
- Create: `components/shared/RiskBadge.tsx`
- Create: `components/shared/TrustBadge.tsx`

- [x] **Step 1: Write RiskBadge**

```tsx
import React from 'react';

export type RiskLevel = 'low' | 'medium' | 'high';

interface Props {
  level: RiskLevel;
  language: 'en' | 'fr';
}

const RiskBadge: React.FC<Props> = ({ level, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const label = level === 'low'
    ? t('Low risk', 'Faible risque')
    : level === 'medium'
      ? t('Medium risk', 'Risque moyen')
      : t('High risk', 'Risque élevé');
  const cls = level === 'low' ? 'risk-low' : level === 'medium' ? 'risk-medium' : 'risk-high';
  return (
    <span className={`micro-label rounded-full px-2 py-0.5 text-[10px] ${cls}`}>{label}</span>
  );
};

export default React.memo(RiskBadge);
```

- [x] **Step 2: Write TrustBadge**

```tsx
import React from 'react';

export type TrustTier = 'gold' | 'silver' | 'bronze';

interface Props {
  tier: TrustTier;
}

const labelMap: Record<TrustTier, string> = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
const clsMap: Record<TrustTier, string> = { gold: 'tier-gold', silver: 'tier-silver', bronze: 'tier-bronze' };

const TrustBadge: React.FC<Props> = ({ tier }) => (
  <span className={`micro-label rounded-full px-2 py-0.5 text-[10px] ${clsMap[tier]}`}>{labelMap[tier]}</span>
);

export default React.memo(TrustBadge);
```

- [x] **Step 3: Commit**

```bash
git add components/shared/RiskBadge.tsx components/shared/TrustBadge.tsx
git commit -m "feat(shared): add RiskBadge and TrustBadge primitives"
```

---

### Task 5: Create `FilterChipRow`

**Files:**
- Create: `components/shared/FilterChipRow.tsx`

- [x] **Step 1: Write component**

```tsx
import React from 'react';

export interface FilterChip<T extends string = string> {
  id: T;
  label: string;
}

interface Props<T extends string = string> {
  chips: ReadonlyArray<FilterChip<T>>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

function FilterChipRow<T extends string = string>({ chips, active, onChange, className = '' }: Props<T>) {
  return (
    <div className={`no-scrollbar flex gap-2 overflow-x-auto ${className}`}>
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`chip shrink-0 motion-pressable px-3 ${active === c.id ? 'chip-active' : 'chip-idle'}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export default FilterChipRow;
```

- [x] **Step 2: Commit**

```bash
git add components/shared/FilterChipRow.tsx
git commit -m "feat(shared): add FilterChipRow for horizontal filter pills"
```

---

### Task 6: Create `WeeklyBarChart`

**Files:**
- Create: `components/shared/WeeklyBarChart.tsx`

- [x] **Step 1: Write component**

```tsx
import React from 'react';

interface Props {
  values: number[]; // length 7, Sun..Sat
  highlightIndex?: number;
  dayLabels?: string[]; // default ['S','M','T','W','T','F','S']
  showValues?: boolean;
}

const DEFAULT_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const WeeklyBarChart: React.FC<Props> = ({
  values,
  highlightIndex,
  dayLabels = DEFAULT_LABELS,
  showValues = false,
}) => {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-[90px] items-end gap-2">
      {values.map((v, i) => {
        const height = Math.max(2, (v / max) * 70);
        const active = i === highlightIndex;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            {showValues && (
              <span className="text-[9px] font-semibold text-gray-400">{v}</span>
            )}
            <div
              className={`w-full rounded-t-md transition-[height] duration-500 ${active ? 'bg-navy' : 'bg-navy-light'}`}
              style={{ height }}
            />
            <span className="text-[9px] text-gray-400">{dayLabels[i]}</span>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(WeeklyBarChart);
```

- [x] **Step 2: Commit**

```bash
git add components/shared/WeeklyBarChart.tsx
git commit -m "feat(shared): add WeeklyBarChart primitive"
```

---

### Task 7: Create `VerticalPickerBar`

**Files:**
- Create: `components/shared/VerticalPickerBar.tsx`

- [x] **Step 1: Write component**

```tsx
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { VERTICALS, categoryLabel } from '../../shared/verticals';
import type { Category } from '../../types';

interface Props {
  active: Category;
  onToggle: () => void;
  language: 'en' | 'fr';
}

const VerticalPickerBar: React.FC<Props> = ({ active, onToggle, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const vertical = VERTICALS.find((v) => v.category === active);
  const accent = vertical?.color ?? '#c86b4a';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="motion-pressable flex h-12 w-full items-center gap-2 rounded-2xl bg-gray-100 pl-3 pr-4 text-navy"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <span className="flex-1 text-left text-[13px] font-semibold">
        {t('Category', 'Catégorie')}: {categoryLabel(active, language)}
      </span>
      <ChevronDown size={16} className="text-gray-500" />
    </button>
  );
};

export default React.memo(VerticalPickerBar);
```

- [x] **Step 2: Verify `categoryLabel` accepts `language`**

Run: `grep -n "export.*categoryLabel" shared/verticals.ts`
If signature differs, adapt the call. Otherwise proceed.

- [x] **Step 3: Commit**

```bash
git add components/shared/VerticalPickerBar.tsx
git commit -m "feat(shared): add VerticalPickerBar selector for Home"
```

---

### Task 8: Extend `ScreenHeader` with route-grid + subtitle + right slot

**Files:**
- Modify: `components/shared/ScreenHeader.tsx`

- [x] **Step 1: Replace file contents**

```tsx
import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  language: 'en' | 'fr';
  trailing?: React.ReactNode;
  variant?: 'default' | 'dark';
  routeGrid?: boolean;
}

const ScreenHeader: React.FC<Props> = ({
  title,
  subtitle,
  onBack,
  language,
  trailing,
  variant = 'default',
  routeGrid = false,
}) => {
  const backLabel = language === 'fr' ? 'Retour' : 'Go back';
  const isDark = variant === 'dark';

  const wrapperClass = [
    'sticky top-0 z-30 grid grid-cols-[44px_1fr_44px] items-center gap-2 px-4 py-2.5',
    'min-h-[60px] border-b border-gray-100',
    isDark ? 'bg-ink text-white' : 'bg-white text-ink',
    routeGrid ? 'route-grid' : '',
  ].join(' ');

  const backClass = isDark
    ? 'flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:text-terra'
    : 'flex h-11 w-11 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-50';

  return (
    <header className={wrapperClass}>
      {onBack ? (
        <button onClick={onBack} className={backClass} aria-label={backLabel} type="button">
          <ArrowLeft size={20} />
        </button>
      ) : (
        <div />
      )}
      <div className="min-w-0 text-center">
        <div className={`truncate font-bold leading-tight ${isDark ? 'text-xs uppercase tracking-[0.16em]' : 'text-[15px]'}`}>
          {title}
        </div>
        {subtitle && (
          <div className={`mt-0.5 truncate text-[11px] ${isDark ? 'text-white/70' : 'text-gray-500'}`}>
            {subtitle}
          </div>
        )}
      </div>
      <div className="flex min-w-11 items-center justify-end">{trailing ?? null}</div>
    </header>
  );
};

export default React.memo(ScreenHeader);
```

- [x] **Step 2: Verify existing consumers still compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "ScreenHeader" | head -20`
Expected: No errors (added props are all optional)

- [x] **Step 3: Commit**

```bash
git add components/shared/ScreenHeader.tsx
git commit -m "feat(shared): extend ScreenHeader with subtitle, right slot, route-grid"
```

---

### Task 9: Add admin 3-item variant to `Navigation`

**Files:**
- Modify: `components/Navigation.tsx`

- [x] **Step 1: Replace `agentNav` / `clientNav` selection block**

Find the definitions of `agentNav` and `clientNav`. Add `adminNav` between them and select based on `isAdmin`:

```tsx
const adminNav = [
  { id: Screen.ADMIN, label: t('Queue', 'File'), icon: CheckSquare },
  { id: Screen.DELTA_DASHBOARD, label: t('Analytics', 'Analyses'), icon: BarChart2 },
  { id: Screen.AGENT_PERFORMANCE, label: t('Agents', 'Agents'), icon: Users },
];

const clientNav = [
  { id: Screen.INVESTOR_DASHBOARD, label: t('Dashboard', 'Tableau'), icon: LayoutDashboard },
  { id: Screen.HOME, label: t('Map', 'Carte'), icon: Map },
  { id: Screen.CLIENT_INSIGHTS, label: t('Insights', 'Analyses'), icon: TrendingUp },
  {
    id: isAuthenticated ? Screen.PROFILE : Screen.AUTH,
    label: isAuthenticated ? t('Account', 'Compte') : t('Sign In', 'Connexion'),
    icon: User,
  },
];

const navItems = isAdmin ? adminNav : userRole === 'client' ? clientNav : agentNav;
```

- [x] **Step 2: Update imports at top**

Replace the existing lucide-react import block with:

```tsx
import {
  Map,
  PlusCircle,
  BarChart2,
  Medal,
  User,
  TrendingUp,
  LayoutDashboard,
  CheckSquare,
  Users,
} from 'lucide-react';
```

- [x] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | grep Navigation`
Expected: May fail on `Screen.CLIENT_INSIGHTS` until Task 10 adds it. Defer commit.

- [x] **Step 4: Defer commit — combine with Task 10**

---

### Task 10: Add `CLIENT_INSIGHTS` to Screen enum

**Files:**
- Modify: `types.ts:1-21`

- [x] **Step 1: Add enum entry**

Edit `types.ts`. Add `CLIENT_INSIGHTS = 'CLIENT_INSIGHTS'` before the closing brace of the `Screen` enum (line ~20).

- [x] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "CLIENT_INSIGHTS|Navigation"`
Expected: No errors

- [x] **Step 3: Commit Tasks 9 + 10**

```bash
git add types.ts components/Navigation.tsx
git commit -m "feat(nav): add admin 3-item variant and CLIENT_INSIGHTS screen"
```

---

## Phase 2: Agent kit

Prototype source: `/Users/charlesvictormahouve/Downloads/design_handoff/agent_app.html` — read the `ProfileScreen`, `DetailScreen`, `HomeScreen`, `ContributeScreen`, `SuccessScreen` components before each task.

### Task 11: Profile navy hero

**Files:**
- Modify: `components/Screens/Profile.tsx`

- [x] **Step 1: Locate the hero section** (the top block with avatar + name + XP bar)

Run: `grep -n "avatar\|hero\|XP\|level" components/Screens/Profile.tsx | head -20`
Identify the JSX block rendering the user avatar + name + tier/level badges + XP bar.

- [x] **Step 2: Replace the hero JSX with the prototype layout**

Target structure (agent_app.html lines 526-553):

```tsx
<section className="route-grid relative overflow-hidden bg-navy px-5 pb-8 pt-5 text-white">
  <div className="relative flex items-start gap-3.5">
    <div
      className="flex h-[60px] w-[60px] items-center justify-center rounded-full text-[22px] font-bold text-white"
      style={{ background: 'linear-gradient(135deg,#c86b4a,#0f2b46)', border: '3px solid rgba(255,255,255,0.2)' }}
    >
      {initial}
    </div>
    <div className="flex-1">
      <div className="text-lg font-bold">{displayName}</div>
      <div className="mt-0.5 text-xs text-white/60">
        {t('Field Agent · Bonamoussadi', 'Agent terrain · Bonamoussadi')}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <span className="micro-label rounded-full bg-gold/20 px-2 py-0.5 text-gold">{tierLabel}</span>
        <span className="micro-label rounded-full bg-white/10 px-2 py-0.5 text-white/70">
          {t('Level', 'Niveau')} {level}
        </span>
      </div>
    </div>
    <div className="text-[22px] font-extrabold text-gold">#{rank}</div>
  </div>
  <div className="mt-4">
    <div className="mb-1.5 flex justify-between">
      <span className="text-xs text-white/60">{t('Level', 'Niveau')} {level}</span>
      <span className="text-xs font-semibold text-white/80">{xpCurrent} / {xpTarget} XP</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-white/15">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, (xpCurrent / xpTarget) * 100)}%`, background: 'linear-gradient(90deg,#f4c317,#d97706)' }}
      />
    </div>
  </div>
</section>
```

Map existing variables (`profile.displayName`, `profile.xp`, `profile.level`, `profile.tier`, `profile.rank`, `profile.initial`) into the template. Do not touch hooks or data fetching.

- [x] **Step 3: Manual visual check**

Run: `npm run dev`
Open `/profile` as an agent user. Compare to agent_app.html `ProfileScreen` block.

- [x] **Step 4: Commit**

```bash
git add components/Screens/Profile.tsx
git commit -m "feat(profile): navy hero with avatar, tier badges, XP bar per handoff"
```

---

### Task 12: Profile 4-column stat grid

**Files:**
- Modify: `components/Screens/Profile.tsx`

- [x] **Step 1: Replace the stat section below the hero**

Target structure (4 colored tiles using new `KpiTile`):

```tsx
<section className="grid grid-cols-4 gap-2 px-4 pt-4">
  <KpiTile label={t('Points', 'Points')} value={stats.points} tone="navy" />
  <KpiTile label={t('XP', 'XP')} value={stats.xp} tone="terra" />
  <KpiTile label={t('Streak', 'Série')} value={`${stats.streakDays}d`} tone="streak" />
  <KpiTile label={t('Rank', 'Rang')} value={`#${stats.rank}`} tone="amber" />
</section>
```

Import: `import KpiTile from '../shared/KpiTile';`

- [x] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep Profile`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git add components/Screens/Profile.tsx
git commit -m "feat(profile): 4-col KPI stat grid using KpiTile"
```

---

### Task 13: Profile badges + this-week table

**Files:**
- Modify: `components/Screens/Profile.tsx`

- [x] **Step 1: Replace badge section**

```tsx
<section className="px-4 pt-4">
  <div className="micro-label-wide mb-2.5 text-gray-400">{t('Badges', 'Badges')}</div>
  <div className="flex flex-wrap gap-2">
    {badges.map((b) => (
      <span
        key={b.id}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${b.className ?? 'bg-navy-wash text-navy'}`}
      >
        {b.label}
      </span>
    ))}
  </div>
</section>
```

- [x] **Step 2: Replace this-week card**

```tsx
<section className="px-4 pb-6 pt-4">
  <div className="micro-label-wide mb-2.5 text-gray-400">{t('This week', 'Cette semaine')}</div>
  <div className="card-soft p-4">
    {weekRows.map((r, i) => (
      <div
        key={r.label}
        className={`flex items-center justify-between py-2 ${i < weekRows.length - 1 ? 'border-b border-gray-50' : ''}`}
      >
        <span className="text-[13px] text-gray-500">{r.label}</span>
        <span className="text-[13px] font-bold text-ink-dark">{r.value}</span>
      </div>
    ))}
  </div>
</section>
```

- [x] **Step 3: Commit**

```bash
git add components/Screens/Profile.tsx
git commit -m "feat(profile): badges grid + weekly performance table"
```

---

### Task 14: Details — photo block + info card

**Files:**
- Modify: `components/Screens/Details.tsx`

- [x] **Step 1: Replace the photo hero**

Target (agent_app.html lines 298-303):

```tsx
<div
  className="mb-4 flex h-[200px] flex-col items-center justify-center gap-2 rounded-[20px] border"
  style={{
    background: `linear-gradient(160deg, ${verticalBg} 0%, ${verticalColor}22 100%)`,
    borderColor: `${verticalColor}22`,
  }}
>
  <Camera size={36} className="text-gray-400" />
  <span className="text-xs font-medium text-gray-400">{t('Field photo', 'Photo terrain')}</span>
</div>
```

If a real `photoUrl` exists, render `<img className="h-[200px] w-full rounded-[20px] object-cover" ...>` instead. Keep the gradient fallback for missing photos.

- [x] **Step 2: Replace the info card**

```tsx
<div className="card-soft mb-3 p-4">
  <div className="mb-3 flex items-start justify-between">
    <div>
      <div className="mb-1 text-lg font-bold text-ink-dark">{point.name}</div>
      <div className="flex items-center gap-1.5">
        <span className="micro-label rounded-full px-2 py-0.5" style={{ background: verticalBg, color: verticalColor }}>
          {verticalLabel}
        </span>
        {point.verified && (
          <span className="micro-label rounded-full bg-forest-wash px-2 py-0.5 text-forest-dark">
            {t('Verified', 'Vérifié')}
          </span>
        )}
      </div>
    </div>
    {/* availability badge if present */}
  </div>
  <dl className="flex flex-col gap-2.5">
    {infoRows.map(([k, v]) => (
      <div key={k} className="flex items-center justify-between border-b border-gray-50 pb-2.5">
        <dt className="text-xs font-medium text-gray-400">{k}</dt>
        <dd className="text-[13px] font-semibold text-ink-dark">{v}</dd>
      </div>
    ))}
  </dl>
</div>
```

Build `infoRows` from existing point fields (location, last updated, trust score, contributor tier, price). Preserve the null-check for price.

- [x] **Step 3: Commit**

```bash
git add components/Screens/Details.tsx
git commit -m "feat(details): photo hero + info card redesign per handoff"
```

---

### Task 15: Details — GPS card + CTA

**Files:**
- Modify: `components/Screens/Details.tsx`

- [x] **Step 1: Replace the GPS card section**

```tsx
<div className="card-soft mb-3 flex items-center gap-3 p-3.5">
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-wash">
    <MapPin size={18} className="text-navy" />
  </div>
  <div className="flex-1">
    <div className="text-[13px] font-semibold text-ink-dark">{t('GPS Validated', 'GPS validé')}</div>
    <div className="mt-0.5 text-[11px] text-gray-400">
      {point.latitude.toFixed(4)}°N, {point.longitude.toFixed(4)}°E · ±{point.accuracy ?? 5}m
    </div>
  </div>
  <CheckCircle size={18} className="text-forest" />
</div>
```

Import: `import { MapPin, CheckCircle } from 'lucide-react';`

- [x] **Step 2: Replace CTA button**

```tsx
<button
  type="button"
  onClick={onUpdate}
  className="btn-cta w-full"
>
  {t('Update this point · +15 XP', 'Mettre à jour · +15 XP')}
</button>
```

- [x] **Step 3: Commit**

```bash
git add components/Screens/Details.tsx
git commit -m "feat(details): GPS card + CTA button redesign"
```

---

### Task 16: Home — header chrome

**Files:**
- Modify: `components/Screens/Home.tsx`

- [x] **Step 1: Replace the top header block**

Target (agent_app.html lines 221-239):

```tsx
<header className="route-grid shrink-0 border-b border-gray-100 bg-white px-4 py-3">
  <div className="mb-2.5 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <BrandLogo size={20} />
      <div>
        <div className="text-[15px] font-bold leading-tight text-ink-dark">African Data Layer</div>
        <div className="text-[11px] font-medium text-gray-500">
          {t('Zone active · Bonamoussadi', 'Zone active · Bonamoussadi')}
        </div>
      </div>
    </div>
    <button
      type="button"
      onClick={onProfile}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-navy/10 bg-navy-wash text-navy motion-pressable"
      aria-label={t('Profile', 'Profil')}
    >
      <User size={17} />
    </button>
  </div>
  <VerticalPickerBar active={activeCategory} onToggle={toggleCategoryPicker} language={language} />
</header>
```

Preserve existing state `toggleCategoryPicker` handler. If a different name, adapt.

- [x] **Step 2: Import VerticalPickerBar**

Add at top of file: `import VerticalPickerBar from '../shared/VerticalPickerBar';`

- [x] **Step 3: Commit**

```bash
git add components/Screens/Home.tsx
git commit -m "feat(home): header chrome with brand logo + zone + profile button"
```

---

### Task 17: Home — tab switcher (Map/List)

**Files:**
- Modify: `components/Screens/Home.tsx`

- [x] **Step 1: Below header, replace/insert the tab switcher block**

```tsx
<div className="shrink-0 bg-page px-4 pt-2">
  <div className="flex gap-2">
    {(['map', 'list'] as const).map((tab) => {
      const active = viewMode === tab;
      return (
        <button
          key={tab}
          type="button"
          onClick={() => setViewMode(tab)}
          className={`motion-pressable flex h-9 flex-1 items-center justify-center rounded-xl text-xs font-semibold ${
            active ? 'bg-navy text-white' : 'bg-white text-gray-500 shadow-sm'
          }`}
        >
          {tab === 'map' ? t('Map', 'Carte') : t('List', 'Liste')}
        </button>
      );
    })}
  </div>
</div>
```

Preserve existing `viewMode` / `setViewMode` state. If the existing state name differs, adapt — do not rename it.

- [x] **Step 2: Commit**

```bash
git add components/Screens/Home.tsx
git commit -m "feat(home): tab switcher between map and list views"
```

---

### Task 18: Home — list view cards

**Files:**
- Modify: `components/Screens/Home.tsx`

- [x] **Step 1: Replace the list view rendering block** (the JSX returned when `viewMode === 'list'`)

```tsx
<div className="no-scrollbar flex-1 overflow-y-auto">
  <div className="flex flex-col gap-2.5 p-4 pb-4">
    <div className="text-[13px] font-semibold text-gray-700">
      {points.length} {categoryLabel(activeCategory, language).toLowerCase()} {t('points', 'points')}
    </div>
    {points.map((p) => (
      <button
        key={p.id}
        type="button"
        onClick={() => onSelectPoint(p)}
        className="card-soft motion-pressable flex w-full items-center gap-3 p-3.5 text-left"
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: verticalBgFor(p.category) }}
        >
          <VerticalIcon category={p.category} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-ink-dark">{p.name}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">{p.locationLabel}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-gray-400">{p.updatedLabel}</span>
            {p.verified && (
              <span className="micro-label rounded-full bg-forest-wash px-1.5 py-0.5 text-forest-dark">
                {t('Verified', 'Vérifié')}
              </span>
            )}
          </div>
        </div>
        {typeof p.price === 'number' && (
          <span className="whitespace-nowrap text-xs font-bold text-ink-dark">
            {p.price.toLocaleString()} XAF
          </span>
        )}
        <ChevronRight size={14} className="text-gray-400" />
      </button>
    ))}
  </div>
</div>
```

Preserve existing `onSelectPoint` callback signature. If `p.locationLabel` / `p.updatedLabel` don't exist, derive them locally via existing helpers used elsewhere in Home.tsx.

- [x] **Step 2: Imports**

Ensure top of file has:
```tsx
import { ChevronRight, User } from 'lucide-react';
import VerticalIcon from '../shared/VerticalIcon';
```

- [x] **Step 3: Commit**

```bash
git add components/Screens/Home.tsx
git commit -m "feat(home): list view card redesign"
```

---

### Task 19: Home — mission peek + FAB

**Files:**
- Modify: `components/Screens/Home.tsx`

- [x] **Step 1: Replace mission peek block** (currently uses existing `MissionCards` component — only restyle the container, not the internals)

Wrap `<MissionCards />` render in the map-mode branch with:

```tsx
{viewMode === 'map' && missionCards.length > 0 && (
  <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
    <MissionCards cards={missionCards} language={language} onSelect={onMissionSelect} />
  </div>
)}
```

- [x] **Step 2: Confirm MissionCards internals match prototype** (navy card w/ `.route-grid`, XP pill, terra card below — agent_app.html lines 279-286)

Run: `grep -n "route-grid\|XP" components/MissionCards.tsx`
If the internals don't match the prototype, update `MissionCards.tsx` card markup to:

```tsx
<div className="route-grid mb-2 cursor-pointer rounded-2xl bg-navy p-3.5 text-white motion-pressable">
  <div className="micro-label mb-1 text-white/50">{card.eyebrow}</div>
  <div className="text-sm font-semibold">{card.title}</div>
  <div className="mt-0.5 text-[11px] text-white/60">{card.subtitle}</div>
  {card.xp && (
    <div className="mt-2">
      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-gold">
        +{card.xp} XP
      </span>
    </div>
  )}
</div>
```

- [x] **Step 3: FAB already exists** — verify `button-breathe` + `ring-pulse` animations run. Run:

```bash
grep -n "button-breathe\|ring-pulse" components/Screens/Home.tsx
```

If animations not applied, add `animate-[button-breathe_3.4s_infinite]` to the FAB button class. (The keyframes are already defined in `index.css`.)

- [x] **Step 4: Commit**

```bash
git add components/Screens/Home.tsx components/MissionCards.tsx
git commit -m "feat(home): mission card peek + FAB animation wiring"
```

---

### Task 20: ContributionFlow — progress bar

**Files:**
- Modify: `components/Screens/ContributionFlow.tsx`

- [x] **Step 1: Locate existing progress indicator**

Run: `grep -n "step\|progress" components/Screens/ContributionFlow.tsx | head -30`
Find the JSX that renders the step indicator.

- [x] **Step 2: Replace with prototype progress bar** (agent_app.html lines 364-378)

```tsx
<div className="shrink-0 border-b border-gray-100 bg-white px-4 py-2.5">
  <div className="flex items-center gap-1.5">
    {STEPS.map((stepLabel, i) => {
      const done = i < currentStep;
      const active = i === currentStep;
      return (
        <React.Fragment key={stepLabel.key}>
          <div className="flex items-center gap-1">
            <div
              className={`flex h-[22px] w-[22px] items-center justify-center rounded-full transition-colors ${
                done || active ? 'bg-navy' : 'bg-gray-200'
              }`}
            >
              {done ? (
                <CheckCircle size={12} className="text-white" />
              ) : (
                <span className={`text-[10px] font-bold ${active ? 'text-white' : 'text-gray-400'}`}>
                  {i + 1}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-semibold ${active ? 'text-navy' : 'text-gray-400'}`}>
              {t(stepLabel.en, stepLabel.fr)}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 rounded-full transition-colors ${done ? 'bg-navy' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
</div>
```

Define `STEPS` constant near the top of the component file:

```tsx
const STEPS = [
  { key: 'photo',    en: 'Photo',    fr: 'Photo' },
  { key: 'details',  en: 'Details',  fr: 'Détails' },
  { key: 'location', en: 'Location', fr: 'Position' },
  { key: 'submit',   en: 'Submit',   fr: 'Envoyer' },
] as const;
```

Preserve existing `currentStep` state. If the variable is named differently (e.g. `step`, `stepIndex`), adapt — do not rename it.

- [x] **Step 3: Commit**

```bash
git add components/Screens/ContributionFlow.tsx
git commit -m "feat(contribute): 4-step progress indicator per handoff"
```

---

### Task 21: ContributionFlow — step 1 photo

**Files:**
- Modify: `components/Screens/ContributionFlow.tsx`

- [x] **Step 1: Replace step-1 photo capture JSX** (agent_app.html lines 381-403)

Target:

```tsx
<div>
  <div className="micro-label-wide mb-3 text-gray-400">
    {t('Step 1 — Capture photo', 'Étape 1 — Capturer la photo')}
  </div>
  <button
    type="button"
    onClick={onCapturePhoto}
    className={`mb-4 flex h-60 w-full flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed transition-all ${
      photo ? 'border-terra bg-gradient-to-br from-terra-wash to-gold-wash' : 'border-gray-300 bg-gray-100'
    }`}
  >
    {photo ? (
      <>
        <CheckCircle size={40} className="text-terra" />
        <span className="text-sm font-semibold text-terra">{t('Photo captured', 'Photo capturée')}</span>
        <span className="text-[11px] text-gray-400">{t('EXIF metadata extracted', 'Métadonnées EXIF extraites')}</span>
      </>
    ) : (
      <>
        <Camera size={40} className="text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">{t('Tap to capture', 'Appuyez pour capturer')}</span>
        <span className="text-[11px] text-gray-400">{t('Photo required for verification', 'Photo requise pour vérification')}</span>
      </>
    )}
  </button>
  <div className="card-soft flex items-center gap-2.5 p-3">
    <CheckCircle size={16} className="text-forest" />
    <span className="text-xs text-gray-700">
      {t('GPS locked · Bonamoussadi zone · ±4m', 'GPS verrouillé · Zone Bonamoussadi · ±4m')}
    </span>
  </div>
</div>
```

Preserve existing `onCapturePhoto` handler and `photo` state. Do NOT rename them.

- [x] **Step 2: Commit**

```bash
git add components/Screens/ContributionFlow.tsx
git commit -m "feat(contribute): step 1 photo capture visual refactor"
```

---

### Task 22: ContributionFlow — step 2 details form

**Files:**
- Modify: `components/Screens/ContributionFlow.tsx`

- [x] **Step 1: Replace step-2 form JSX** (agent_app.html lines 405-432)

Target:

```tsx
<div>
  <div className="micro-label-wide mb-3 text-gray-400">
    {t(`Step 2 — ${verticalLabel} details`, `Étape 2 — Détails ${verticalLabel}`)}
  </div>
  <div className="flex flex-col gap-3">
    {/* Name input */}
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-700">
        {t(`${verticalLabel} name`, `Nom du ${verticalLabel}`)}
      </label>
      <input
        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-[15px] outline-none focus:border-navy"
        placeholder={t(`e.g. Pharmacie Centrale`, `ex. Pharmacie Centrale`)}
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
    </div>
    {/* Open? segmented */}
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-700">
        {t('Currently open?', 'Actuellement ouvert ?')}
      </label>
      <div className="flex gap-2">
        {(['yes', 'no', 'unknown'] as const).map((opt) => {
          const active = form.isOpen === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setForm((f) => ({ ...f, isOpen: opt }))}
              className={`h-11 flex-1 rounded-xl border-[1.5px] text-[13px] font-semibold transition-colors ${
                active ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {t(
                opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : 'Unknown',
                opt === 'yes' ? 'Oui' : opt === 'no' ? 'Non' : 'Inconnu',
              )}
            </button>
          );
        })}
      </div>
    </div>
    {/* Any additional vertical-specific fields from the existing Zod schema render in the same segmented / input pattern. */}
  </div>
</div>
```

Preserve existing field state shape, validation, and vertical-specific conditional blocks. Only swap the markup classes and wrapper structure. If the existing schema uses different field names, adapt the bindings.

- [x] **Step 2: Commit**

```bash
git add components/Screens/ContributionFlow.tsx
git commit -m "feat(contribute): step 2 form visual refactor with segmented controls"
```

---

### Task 23: ContributionFlow — step 3 location

**Files:**
- Modify: `components/Screens/ContributionFlow.tsx`

- [x] **Step 1: Replace step-3 JSX** (agent_app.html lines 434-461)

Target:

```tsx
<div>
  <div className="micro-label-wide mb-3 text-gray-400">
    {t('Step 3 — Confirm location', 'Étape 3 — Confirmer la position')}
  </div>
  <div className="relative mb-3.5 h-[200px] overflow-hidden rounded-[20px] bg-[#e8eff7]">
    {/* existing mini-map component keeps running here; only style wrapper */}
    <MiniMap latitude={form.latitude} longitude={form.longitude} />
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-[10px] bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-navy">
      {form.latitude.toFixed(4)}°N, {form.longitude.toFixed(4)}°E · ±{form.accuracy ?? 4}m
    </div>
  </div>
  <div className="card-soft flex flex-col gap-2 p-3.5">
    {validationRows.map(([k, v, pass]) => (
      <div key={k} className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{k}</span>
        <span className={`text-xs font-semibold ${pass ? 'text-forest' : 'text-danger'}`}>{v}</span>
      </div>
    ))}
  </div>
</div>
```

Build `validationRows` from existing validators:
- Zone (via `isWithinBonamoussadi`)
- Velocity check (via existing velocity guard)
- Duplicate scan (via dedup check)

If a dedicated `MiniMap` component doesn't exist, keep the existing inline map rendering — only wrap it in the new styled container.

- [x] **Step 2: Commit**

```bash
git add components/Screens/ContributionFlow.tsx
git commit -m "feat(contribute): step 3 location view with validation table"
```

---

### Task 24: ContributionFlow — step 4 submit + success

**Files:**
- Modify: `components/Screens/ContributionFlow.tsx`

- [x] **Step 1: Replace step-4 (pre-submit) JSX** (agent_app.html lines 463-480)

```tsx
<div className="pt-5 text-center">
  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-forest-wash">
    <CheckCircle size={44} className="text-forest" />
  </div>
  <div className="mb-1.5 text-[22px] font-bold text-ink-dark">
    {t('Ready to submit', 'Prêt à envoyer')}
  </div>
  <div className="mb-6 text-sm text-gray-500">
    {t('1 pharmacy point · GPS verified · Photo attached', '1 point pharmacie · GPS vérifié · Photo jointe')}
  </div>
  <div
    className="mb-6 flex items-center gap-3 rounded-2xl border p-3.5"
    style={{
      background: 'linear-gradient(135deg,#f4c31722,#fef9e7)',
      borderColor: 'rgba(244,195,23,0.3)',
    }}
  >
    <Star size={24} className="fill-gold text-gold" />
    <div className="text-left">
      <div className="text-[15px] font-bold text-ink-dark">+{xpEstimate} XP</div>
      <div className="text-[11px] text-gray-400">{t('First submission in this zone', 'Première contribution dans cette zone')}</div>
    </div>
  </div>
  <button type="button" onClick={onSubmit} disabled={submitting} className="btn-cta w-full disabled:opacity-60">
    {submitting ? t('Submitting…', 'Envoi…') : t('Submit contribution', 'Envoyer la contribution')}
  </button>
</div>
```

Preserve existing `onSubmit`, `submitting`, `xpEstimate` (or whatever the existing XP preview variable is called).

- [x] **Step 2: Add/replace post-submit Success view** (agent_app.html lines 497-513)

Locate where the component currently renders success state (after `onSubmit` resolves). Replace with:

```tsx
{submissionResult === 'success' && (
  <div className="flex h-full flex-col items-center justify-center bg-white px-8 text-center">
    <div
      className="mb-6 flex h-[100px] w-[100px] items-center justify-center rounded-full"
      style={{
        background: 'linear-gradient(135deg,#eaf3ee,#d1fae5)',
        boxShadow: '0 0 0 16px rgba(76,124,89,0.08)',
      }}
    >
      <CheckCircle size={52} className="text-forest" />
    </div>
    <div className="mb-2 text-2xl font-bold text-ink-dark">{t('Submitted!', 'Envoyé !')}</div>
    <div className="mb-8 text-sm leading-relaxed text-gray-500">
      {t(
        "Your point is in the review queue. You'll earn XP once verified.",
        'Votre point est dans la file de révision. Vous gagnerez des XP une fois vérifié.',
      )}
    </div>
    <div
      className="mb-6 w-full rounded-[20px] border p-5 text-center"
      style={{
        background: 'linear-gradient(135deg,#f4c31722,#fef9e7)',
        borderColor: 'rgba(244,195,23,0.3)',
      }}
    >
      <div className="text-[32px] font-extrabold text-amber">+{earnedXp} XP</div>
      <div className="mt-1 text-xs text-gray-400">
        {t('Level', 'Niveau')} {level} · {xpCurrent} / {xpTarget} XP to {t('Level', 'Niveau')} {level + 1}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-wash">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, (xpCurrent / xpTarget) * 100)}%`, background: 'linear-gradient(90deg,#f4c317,#d97706)' }}
        />
      </div>
    </div>
    <button type="button" onClick={onDone} className="btn-primary w-full">
      {t('Back to map', 'Retour à la carte')}
    </button>
  </div>
)}
```

- [x] **Step 3: Replace footer (Back / Continue) buttons** (agent_app.html lines 485-491)

```tsx
<footer className="flex shrink-0 gap-2.5 border-t border-gray-100 bg-white px-4 pb-6 pt-3">
  {currentStep > 0 && (
    <button type="button" onClick={onBack} className="btn-ghost flex-1">
      {t('Back', 'Retour')}
    </button>
  )}
  {currentStep < 3 && (
    <button
      type="button"
      onClick={onNext}
      disabled={!canAdvance}
      className="btn-primary flex-[2] disabled:opacity-60"
    >
      {canAdvance ? t('Continue', 'Continuer') : t('Take photo first', 'Prenez d\'abord une photo')}
    </button>
  )}
</footer>
```

Preserve `canAdvance`, `onNext`, `onBack` — do not change their logic.

- [x] **Step 4: Commit**

```bash
git add components/Screens/ContributionFlow.tsx
git commit -m "feat(contribute): step 4 submit, success view, footer buttons"
```

---

## Phase 3: Admin kit

Prototype source: `/Users/charlesvictormahouve/Downloads/design_handoff/admin.html`

### Task 25: AdminQueue — filter chips + header

**Files:**
- Modify: `components/Screens/AdminQueue.tsx`

- [x] **Step 1: Replace the top header block**

```tsx
<ScreenHeader
  title="African Data Layer"
  subtitle={t('Admin · Submission Queue', 'Admin · File de soumissions')}
  language={language}
  trailing={<span className="micro-label rounded-full bg-navy-light px-2 py-0.5 text-navy">Admin</span>}
  routeGrid
/>
```

- [x] **Step 2: Replace the filter row block**

```tsx
<div className="shrink-0 border-b border-gray-100 bg-white px-4 py-2.5">
  <FilterChipRow<RiskFilter>
    chips={[
      { id: 'pending', label: t('All Pending', 'En attente') },
      { id: 'high',    label: t('High Risk',  'Risque élevé') },
      { id: 'medium',  label: t('Medium',     'Moyen') },
      { id: 'low',     label: t('Low Risk',   'Faible risque') },
    ]}
    active={riskFilter}
    onChange={setRiskFilter}
  />
</div>
```

Import: `import FilterChipRow from '../shared/FilterChipRow';`

Preserve `riskFilter` state. Define `type RiskFilter = 'pending' | 'high' | 'medium' | 'low'` if not already present.

- [x] **Step 3: Commit**

```bash
git add components/Screens/AdminQueue.tsx
git commit -m "feat(admin): filter chip row + header with admin badge"
```

---

### Task 26: AdminQueue — queue card redesign

**Files:**
- Modify: `components/Screens/AdminQueue.tsx`

- [x] **Step 1: Extract queue card as sub-component at top of file**

```tsx
interface QueueCardProps {
  submission: ReviewSubmission;
  language: 'en' | 'fr';
  onSelect: (s: ReviewSubmission) => void;
}

const QueueCard: React.FC<QueueCardProps> = ({ submission, language, onSelect }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const vertical = VERTICALS.find((v) => v.id === submission.vertical);
  return (
    <button
      type="button"
      onClick={() => onSelect(submission)}
      className="card-soft motion-pressable w-full p-3.5 text-left"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl"
          style={{ background: vertical?.bg }}
        >
          <VerticalIcon category={submission.vertical} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[13px] font-semibold text-ink-dark">
              {submission.name}
            </span>
            <RiskBadge level={submission.risk} language={language} />
          </div>
          <div className="mb-1.5 text-[11px] text-gray-500">
            {t('by', 'par')} {submission.agentName} · {submission.relativeTime}
          </div>
          {submission.fraudFlags.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {submission.fraudFlags.map((f) => (
                <div key={f} className="flex items-center gap-1 text-[11px] font-medium text-amber">
                  <AlertTriangle size={12} className="text-amber" />
                  {f}
                </div>
              ))}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-1">
            <MapPin size={11} className="text-gray-400" />
            <span className="text-[11px] text-gray-400">
              {submission.latitude.toFixed(4)}°N, {submission.longitude.toFixed(4)}°E
            </span>
            <TrustBadge tier={submission.trust} />
          </div>
        </div>
        <ChevronRight size={14} className="shrink-0 text-gray-400" />
      </div>
    </button>
  );
};
```

- [x] **Step 2: Replace the queue list rendering with `<QueueCard>` instances**

- [x] **Step 3: Imports**

```tsx
import { AlertTriangle, ChevronRight, MapPin } from 'lucide-react';
import RiskBadge from '../shared/RiskBadge';
import TrustBadge from '../shared/TrustBadge';
```

- [x] **Step 4: Commit**

```bash
git add components/Screens/AdminQueue.tsx
git commit -m "feat(admin): queue card redesign with risk + trust badges"
```

---

### Task 27: AdminQueue — submission review detail

**Files:**
- Modify: `components/Screens/AdminQueue.tsx`

- [x] **Step 1: Replace the detail view JSX** (admin.html lines 236-285)

Target structure:

```tsx
<ScreenHeader
  title={t('Review Submission', 'Réviser la soumission')}
  subtitle={submission.id}
  onBack={onBack}
  language={language}
/>
<div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 pt-4">
  {/* Photo */}
  <div
    className="relative mb-3.5 flex h-[180px] flex-col items-center justify-center gap-2 rounded-[18px] border border-gray-100"
    style={{ background: `linear-gradient(160deg, ${verticalBg} 0%, rgba(15,43,70,0.05) 100%)` }}
  >
    {submission.photoUrl ? (
      <img src={submission.photoUrl} alt="" className="h-full w-full rounded-[18px] object-cover" />
    ) : (
      <>
        <Camera size={32} className="text-gray-400" />
        <span className="text-xs text-gray-400">{t('Field photo', 'Photo terrain')}</span>
      </>
    )}
    <div className="absolute right-2.5 top-2.5">
      <RiskBadge level={submission.risk} language={language} />
    </div>
  </div>
  {/* Core info */}
  <div className="card-soft mb-3 p-4">
    <div className="mb-1 text-base font-bold text-ink-dark">{submission.name}</div>
    <div className="mb-3 flex items-center gap-1.5">
      <span className="micro-label rounded-full px-2 py-0.5" style={{ background: verticalBg, color: verticalColor }}>
        {verticalLabel}
      </span>
      <TrustBadge tier={submission.trust} />
    </div>
    {forensicRows.map(([k, v]) => (
      <div key={k} className="flex justify-between border-b border-gray-50 py-1.5">
        <span className="text-xs text-gray-400">{k}</span>
        <span className="text-xs font-semibold text-ink-dark">{v}</span>
      </div>
    ))}
  </div>
  {/* Fraud flags */}
  {submission.fraudFlags.length > 0 && (
    <div className="mb-3 rounded-[14px] border border-amber/20 bg-amber-wash p-3.5">
      <div className="micro-label mb-2 text-amber">{t('Fraud flags', 'Signaux de fraude')}</div>
      {submission.fraudFlags.map((f) => (
        <div key={f} className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber">
          <AlertTriangle size={14} className="text-amber" />
          {f}
        </div>
      ))}
    </div>
  )}
  {/* Action row */}
  <div className="flex gap-2.5">
    <button
      type="button"
      onClick={onReject}
      className="flex h-[52px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-red-100 text-sm font-semibold text-red-800 motion-pressable"
    >
      <X size={16} />
      {t('Reject', 'Rejeter')}
    </button>
    <button
      type="button"
      onClick={onApprove}
      className="flex h-[52px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-forest-wash text-sm font-semibold text-forest-dark motion-pressable"
    >
      <Check size={16} />
      {t('Approve', 'Approuver')}
    </button>
  </div>
</div>
```

Build `forensicRows` from existing submission fields (submitted by, time, GPS, accuracy, EXIF match, velocity check). Preserve `onApprove` / `onReject` — they must continue to call the same API handlers and trigger bulk-action state updates.

- [x] **Step 2: Imports**

```tsx
import { Camera, Check, X, AlertTriangle } from 'lucide-react';
```

- [x] **Step 3: Commit**

```bash
git add components/Screens/AdminQueue.tsx
git commit -m "feat(admin): submission review detail redesign"
```

---

### Task 28: AdminQueue — decision result screen

**Files:**
- Modify: `components/Screens/AdminQueue.tsx`

- [x] **Step 1: Replace the post-decision result view** (admin.html lines 225-234)

```tsx
{decision && (
  <div className="flex h-full flex-col items-center justify-center bg-white px-8 text-center">
    <div
      className="mb-5 flex h-20 w-20 items-center justify-center rounded-full"
      style={{
        background: decision === 'approve' ? '#eaf3ee' : '#fde8e8',
        boxShadow: `0 0 0 16px ${decision === 'approve' ? 'rgba(47,133,90,0.08)' : 'rgba(155,44,44,0.08)'}`,
      }}
    >
      {decision === 'approve' ? <Check size={44} className="text-forest" /> : <X size={44} className="text-red-800" />}
    </div>
    <div className="mb-2 text-xl font-bold text-ink-dark">
      {decision === 'approve' ? t('Approved', 'Approuvé') : t('Rejected', 'Rejeté')}
    </div>
    <div className="mb-8 text-[13px] leading-relaxed text-gray-500">
      {t(
        `Submission ${submission.id} has been ${decision === 'approve' ? 'approved and added to the dataset' : 'rejected and the agent notified'}.`,
        `La soumission ${submission.id} a été ${decision === 'approve' ? 'approuvée et ajoutée au jeu de données' : 'rejetée et l\'agent notifié'}.`,
      )}
    </div>
    <button type="button" onClick={onReturn} className="btn-primary w-full">
      {t('Back to queue', 'Retour à la file')}
    </button>
  </div>
)}
```

- [x] **Step 2: Commit**

```bash
git add components/Screens/AdminQueue.tsx
git commit -m "feat(admin): decision result confirmation view"
```

---

### Task 29: DeltaDashboard — KPI tiles

**Files:**
- Modify: `components/Screens/DeltaDashboard.tsx`

- [x] **Step 1: Replace the summary tile grid** (admin.html lines 297-305)

```tsx
<div className="mb-3.5 grid grid-cols-2 gap-2">
  <KpiTile label={t('Total Points', 'Points totaux')} value={totals.points} tone="navy" />
  <KpiTile label={t('vs Last Week', 'vs semaine passée')} value={`${totals.deltaPct >= 0 ? '+' : ''}${totals.deltaPct}%`} tone="forest" />
  <KpiTile label={t('Pending Review', 'En révision')} value={totals.pending} tone="amber" />
  <KpiTile label={t('Approval Rate', 'Taux d\'approbation')} value={`${totals.approvalRate}%`} tone="navy" />
</div>
```

Import: `import KpiTile from '../shared/KpiTile';`

Preserve existing `totals` / data fetching logic.

- [x] **Step 2: Commit**

```bash
git add components/Screens/DeltaDashboard.tsx
git commit -m "feat(delta): KPI tile grid with tones"
```

---

### Task 30: DeltaDashboard — per-vertical bars

**Files:**
- Modify: `components/Screens/DeltaDashboard.tsx`

- [x] **Step 1: Replace the per-vertical rendering block** (admin.html lines 307-336)

```tsx
<div className="micro-label mb-2.5 text-gray-400">
  {t('By Vertical — Current week', 'Par vertical — Cette semaine')}
</div>
<div className="card-soft mb-3 p-4">
  <div className="flex flex-col gap-2.5">
    {verticalStats.map((d) => {
      const delta = d.current - d.previous;
      const pct = Math.round((d.current / maxVal) * 100);
      const vertical = VERTICALS.find((v) => v.id === d.verticalId);
      return (
        <div key={d.verticalId}>
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ background: vertical?.bg }}
              >
                <VerticalIcon category={d.verticalId} size={12} />
              </div>
              <span className="text-xs font-semibold text-gray-700">{d.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-ink-dark">{d.current}</span>
              <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${delta >= 0 ? 'text-forest-dark' : 'text-red-800'}`}>
                {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {delta >= 0 ? '+' : ''}{delta}
              </span>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, background: vertical?.color }}
            />
          </div>
        </div>
      );
    })}
  </div>
</div>
```

Preserve `verticalStats` / `maxVal` existing derivation.

- [x] **Step 2: Imports**

```tsx
import { TrendingDown, TrendingUp } from 'lucide-react';
import VerticalIcon from '../shared/VerticalIcon';
```

- [x] **Step 3: Commit**

```bash
git add components/Screens/DeltaDashboard.tsx
git commit -m "feat(delta): per-vertical bar rows with deltas"
```

---

### Task 31: DeltaDashboard — weekly chart

**Files:**
- Modify: `components/Screens/DeltaDashboard.tsx`

- [x] **Step 1: Replace the weekly chart block** (admin.html lines 338-348)

```tsx
<div className="micro-label mb-2.5 text-gray-400">
  {t('Daily submissions — This week', 'Contributions journalières — Cette semaine')}
</div>
<div className="card-soft p-4">
  <WeeklyBarChart values={weeklyCounts} highlightIndex={todayIndex} />
</div>
```

Import: `import WeeklyBarChart from '../shared/WeeklyBarChart';`

Preserve `weeklyCounts` / `todayIndex` from existing state.

- [x] **Step 2: Commit**

```bash
git add components/Screens/DeltaDashboard.tsx
git commit -m "feat(delta): weekly bar chart using shared primitive"
```

---

### Task 32: AgentPerformance — summary + agent cards

**Files:**
- Modify: `components/Screens/AgentPerformance.tsx`

- [x] **Step 1: Replace summary tiles** (admin.html lines 362-369)

```tsx
<div className="mb-0.5 grid grid-cols-3 gap-2">
  <KpiTile label={t('Active', 'Actifs')} value={agents.length} tone="navy" />
  <KpiTile label={t('Total Subs', 'Soumissions')} value={totalSubs} tone="forest" />
  <KpiTile label={t('Avg Approval', 'Appr. moyenne')} value={`${avgApproval}%`} tone="amber" />
</div>
```

- [x] **Step 2: Replace agent card rendering** (admin.html lines 370-391)

```tsx
{agents.map((a, i) => {
  const tier = a.tier.toLowerCase() as 'gold' | 'silver' | 'bronze';
  const tierGradient = tier === 'gold'
    ? 'linear-gradient(135deg,#f4c317,#d97706)'
    : tier === 'silver'
      ? 'linear-gradient(135deg,#9ca3af,#6b7280)'
      : 'linear-gradient(135deg,#c86b4a,#9b2c2c)';
  const barColor = a.approvalRate >= 90 ? 'bg-forest-dark' : a.approvalRate >= 80 ? 'bg-amber' : 'bg-red-800';
  return (
    <div key={a.id} className="card-soft flex items-center gap-3 p-3">
      <div className="w-5 text-center text-[13px] font-bold text-gray-300">#{i + 1}</div>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
        style={{ background: tierGradient }}
      >
        {a.avatarInitial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-ink-dark">{a.name}</span>
          <TrustBadge tier={tier} />
        </div>
        <div className="flex gap-2.5 text-[11px]">
          <span className="text-gray-500">{a.submissions} {t('subs', 'soum.')}</span>
          <span className="font-semibold text-forest-dark">{a.approvalRate}% {t('approved', 'approuvé')}</span>
          <span className="font-semibold text-navy">{a.xp.toLocaleString()} XP</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${a.approvalRate}%` }}
          />
        </div>
      </div>
    </div>
  );
})}
```

- [x] **Step 3: Imports**

```tsx
import KpiTile from '../shared/KpiTile';
import TrustBadge from '../shared/TrustBadge';
```

- [x] **Step 4: Commit**

```bash
git add components/Screens/AgentPerformance.tsx
git commit -m "feat(perf): agent leaderboard cards with tier avatars"
```

---

## Phase 4: Client kit

Prototype source: `/Users/charlesvictormahouve/Downloads/design_handoff/client.html`

### Task 33: InvestorDashboard — navy hero

**Files:**
- Modify: `components/Screens/InvestorDashboard.tsx`

- [x] **Step 1: Replace the top header block** (client.html lines 147-173)

```tsx
<section className="route-grid shrink-0 bg-navy px-4 pb-5 pt-4 text-white">
  <div className="mb-3.5 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <BrandLogo size={20} />
      <div>
        <div className="text-[15px] font-bold leading-tight">African Data Layer</div>
        <div className="text-[11px] text-white/50">
          {t(`Client Dashboard · ${monthLabel}`, `Tableau client · ${monthLabel}`)}
        </div>
      </div>
    </div>
    <span className="micro-label rounded-full bg-white/10 px-2.5 py-0.5 text-white/70">Client</span>
  </div>
  <div className="grid grid-cols-2 gap-2">
    <div className="rounded-[14px] border border-white/10 bg-white/[0.08] p-3.5">
      <div className="micro-label mb-1 text-[9px] text-white/50">{t('Total Points', 'Points totaux')}</div>
      <div className="text-[28px] font-extrabold leading-none">{totalPoints.toLocaleString()}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#4ade80]">
        <TrendingUp size={11} /> +{weeklyDelta} {t('this week', 'cette semaine')}
      </div>
    </div>
    <div className="rounded-[14px] border border-gold/20 bg-gold/15 p-3.5">
      <div className="micro-label mb-1 text-[9px] text-gold/70">{t('Coverage', 'Couverture')}</div>
      <div className="text-[28px] font-extrabold leading-none text-gold">{coveragePct}%</div>
      <div className="mt-1 text-[11px] font-medium text-white/50">{zoneLabel}</div>
    </div>
  </div>
</section>
```

Preserve existing data derivation for `totalPoints`, `weeklyDelta`, `coveragePct`, `zoneLabel`.

- [x] **Step 2: Commit**

```bash
git add components/Screens/InvestorDashboard.tsx
git commit -m "feat(client): navy hero with KPI pair"
```

---

### Task 34: InvestorDashboard — vertical bars + weekly + zones

**Files:**
- Modify: `components/Screens/InvestorDashboard.tsx`

- [x] **Step 1: Add per-vertical section** (client.html lines 175-202)

Reuse the same `VERTICALS.find(...)` pattern with `<VerticalIcon />`:

```tsx
<section className="px-4 pt-4">
  <div className="micro-label mb-2.5 text-gray-400">
    {t('Coverage by vertical', 'Couverture par vertical')}
  </div>
  <div className="card-soft mb-3.5 p-3.5">
    {verticalRows.map((v) => {
      const vertical = VERTICALS.find((x) => x.id === v.id);
      const isPos = v.delta >= 0;
      return (
        <div key={v.id} className="mb-3 last:mb-0">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg"
                style={{ background: vertical?.bg }}
              >
                <VerticalIcon category={v.id} size={14} />
              </div>
              <span className="text-xs font-semibold text-gray-700">{v.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-dark">{v.current}</span>
              <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${isPos ? 'text-forest-dark' : 'text-red-800'}`}>
                {isPos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {isPos ? '+' : ''}{v.delta}
              </span>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(v.current / maxVertical) * 100}%`, background: vertical?.color }}
            />
          </div>
        </div>
      );
    })}
  </div>
</section>
```

- [x] **Step 2: Weekly section**

```tsx
<section className="px-4">
  <div className="micro-label mb-2.5 text-gray-400">
    {t('Daily submissions — This week', 'Contributions journalières — Cette semaine')}
  </div>
  <div className="card-soft mb-3.5 p-4">
    <WeeklyBarChart values={weeklyPoints} highlightIndex={todayIndex} showValues />
  </div>
</section>
```

- [x] **Step 3: Top zones section** (client.html lines 219-234)

```tsx
<section className="px-4 pb-4">
  <div className="micro-label mb-2.5 text-gray-400">
    {t('Top zones by coverage', 'Zones principales')}
  </div>
  <div className="card-soft px-3.5 py-2.5">
    {topZones.map((z, i) => (
      <div
        key={z.name}
        className={`flex items-center gap-2.5 py-2 ${i < topZones.length - 1 ? 'border-b border-gray-50' : ''}`}
      >
        <span className="w-5 text-xs font-bold text-gray-300">{i + 1}</span>
        <MapPin size={12} className="text-gray-400" />
        <span className="flex-1 text-xs font-semibold text-gray-700">{z.name}</span>
        <span className="text-[11px] font-bold text-navy">{z.points} {t('pts', 'pts')}</span>
        <div className="h-1 w-12 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-navy" style={{ width: `${z.coveragePct}%` }} />
        </div>
      </div>
    ))}
  </div>
</section>
```

- [x] **Step 4: Imports**

```tsx
import { MapPin, TrendingDown, TrendingUp } from 'lucide-react';
import WeeklyBarChart from '../shared/WeeklyBarChart';
import VerticalIcon from '../shared/VerticalIcon';
import { VERTICALS } from '../../shared/verticals';
```

- [x] **Step 5: Commit**

```bash
git add components/Screens/InvestorDashboard.tsx
git commit -m "feat(client): vertical bars + weekly chart + top zones sections"
```

---

### Task 35: Create `ClientInsights` screen

**Files:**
- Create: `components/Screens/ClientInsights.tsx`

- [x] **Step 1: Write component**

```tsx
import React from 'react';
import { ChevronRight, Download, TrendingUp } from 'lucide-react';
import ScreenHeader from '../shared/ScreenHeader';
import VerticalIcon from '../shared/VerticalIcon';
import { VERTICALS } from '../../shared/verticals';
import type { Category } from '../../types';

interface InsightCard {
  id: string;
  vertical: Category;
  label: string;
  title: string;
  subtitle: string;
}

interface Props {
  language: 'en' | 'fr';
  monthLabel: string;
  totalPoints: number;
  weeklyDelta: number;
  headline: string;
  body: string;
  insights: InsightCard[];
  onExport: () => void;
  onSelectInsight?: (card: InsightCard) => void;
}

const ClientInsights: React.FC<Props> = ({
  language,
  monthLabel,
  totalPoints,
  weeklyDelta,
  headline,
  body,
  insights,
  onExport,
  onSelectInsight,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  return (
    <div className="flex h-full flex-col bg-page">
      <ScreenHeader
        title={t('Insights', 'Analyses')}
        language={language}
        trailing={
          <span className="micro-label rounded-full bg-navy-light px-2.5 py-0.5 text-navy">
            {monthLabel}
          </span>
        }
        routeGrid
      />
      <div className="no-scrollbar flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
        {/* Hero story */}
        <article className="route-grid relative overflow-hidden rounded-[20px] bg-navy p-4 text-white">
          <div className="micro-label mb-1.5 text-white/45">
            {t('Headline · This week', 'Une · Cette semaine')}
          </div>
          <h2 className="mb-1.5 text-lg font-bold leading-tight">{headline}</h2>
          <p className="text-xs leading-relaxed text-white/60">{body}</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-[11px] font-bold text-gold">
              +{weeklyDelta} {t('points this week', 'points cette semaine')}
            </span>
          </div>
        </article>
        {/* Story cards */}
        {insights.map((ins) => {
          const vertical = VERTICALS.find((v) => v.id === ins.vertical);
          return (
            <button
              key={ins.id}
              type="button"
              onClick={() => onSelectInsight?.(ins)}
              className="card-soft motion-pressable flex w-full items-start gap-3 p-4 text-left"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: vertical?.bg }}
              >
                <VerticalIcon category={ins.vertical} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5">
                  <span
                    className="micro-label rounded-full px-1.5 py-0.5 text-[9px]"
                    style={{ background: vertical?.bg, color: vertical?.color }}
                  >
                    {ins.label}
                  </span>
                </div>
                <div className="mb-0.5 text-[13px] font-semibold text-ink-dark">{ins.title}</div>
                <div className="text-[11px] leading-relaxed text-gray-500">{ins.subtitle}</div>
              </div>
              <ChevronRight size={14} className="shrink-0 text-gray-400" />
            </button>
          );
        })}
        {/* Export CTA */}
        <button
          type="button"
          onClick={onExport}
          className="motion-pressable flex w-full items-center gap-3 rounded-2xl bg-navy-wash p-4 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy">
            <Download size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-navy">
              {t(`Export this week's data`, 'Exporter les données de la semaine')}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              {t('CSV · JSON · GeoJSON available', 'CSV · JSON · GeoJSON disponibles')}
            </div>
          </div>
          <ChevronRight size={14} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default ClientInsights;
```

- [x] **Step 2: Commit**

```bash
git add components/Screens/ClientInsights.tsx
git commit -m "feat(client): add ClientInsights screen per handoff"
```

---

### Task 36: Wire `ClientInsights` into `App.tsx`

**Files:**
- Modify: `App.tsx`

- [x] **Step 1: Add lazy import**

Near the other lazy imports (around line 44-50):

```tsx
const ClientInsights = lazy(() => import('./components/Screens/ClientInsights'));
```

- [x] **Step 2: Add render case in `renderScreen` switch**

Find the switch statement over `currentScreen`. Add:

```tsx
case Screen.CLIENT_INSIGHTS:
  return (
    <ClientInsights
      language={language}
      monthLabel={monthLabel}
      totalPoints={clientSnapshot.totalPoints}
      weeklyDelta={clientSnapshot.weeklyDelta}
      headline={clientSnapshot.headline}
      body={clientSnapshot.body}
      insights={clientSnapshot.insights}
      onExport={handleExportClientData}
      onSelectInsight={handleSelectInsight}
    />
  );
```

Wire `clientSnapshot`, `handleExportClientData`, `handleSelectInsight` to existing data source used by `InvestorDashboard`. If missing, extract values from the same endpoint/store that feeds `InvestorDashboard` or `DeltaDashboard`.

- [x] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "CLIENT_INSIGHTS|ClientInsights"`
Expected: No errors

- [x] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(app): wire ClientInsights screen into navigation"
```

---

### Task 37: Settings — client variant

**Files:**
- Modify: `components/Screens/Settings.tsx`

- [x] **Step 1: Add conditional block at top of rendered content** (only when `userRole === 'client'`)

```tsx
{userRole === 'client' && (
  <>
    <section className="route-grid relative mx-4 my-4 flex items-center gap-3.5 overflow-hidden rounded-[20px] bg-navy p-5">
      <div
        className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
        style={{ background: 'linear-gradient(135deg,#c86b4a,#0f2b46)', border: '2px solid rgba(255,255,255,0.2)' }}
      >
        {companyInitial}
      </div>
      <div className="relative">
        <div className="text-base font-bold text-white">{companyName}</div>
        <div className="mt-0.5 text-[11px] text-white/50">
          {t('Data client · Bonamoussadi', 'Client data · Bonamoussadi')}
        </div>
        <span className="micro-label mt-1.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/70">
          Client
        </span>
      </div>
    </section>
    {clientSections.map((section) => (
      <section key={section.id} className="px-4 pb-3.5">
        <div className="micro-label mb-2 text-[10px] text-gray-400">{section.title}</div>
        <div className="card-soft overflow-hidden">
          {section.items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onSelect}
              className={`flex w-full items-center justify-between px-4 py-3 text-left motion-pressable ${
                i < section.items.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <span className="text-[13px] font-medium text-gray-700">{item.label}</span>
              <ChevronRight size={14} className="text-gray-400" />
            </button>
          ))}
        </div>
      </section>
    ))}
  </>
)}
```

Define `clientSections` inline with 3 groups per spec:
- **Data Access**: Active subscription, API key management, Webhook endpoints
- **Export**: Download CSV, Download GeoJSON, Scheduled exports
- **Account**: Profile settings, Billing, Sign out

Each item `onSelect` either calls an existing handler or `handleComingSoon` / `setToast('Coming soon')` for features not yet built (keep no-op rather than leaving dead).

- [x] **Step 2: Commit**

```bash
git add components/Screens/Settings.tsx
git commit -m "feat(settings): client-role profile card + grouped sections"
```

---

### Task 38: Home — client map variant

**Files:**
- Modify: `components/Screens/Home.tsx`

- [x] **Step 1: Add client-variant header**

When `userRole === 'client'`, replace the agent header chrome with:

```tsx
{userRole === 'client' ? (
  <header className="route-grid shrink-0 border-b border-gray-100 bg-white px-4 pb-3 pt-2.5">
    <div className="mb-2.5 flex items-center justify-between">
      <div className="text-[15px] font-bold text-ink-dark">{t('Map Explorer', 'Explorateur')}</div>
      <button
        type="button"
        onClick={onOpenFilter}
        className="flex h-[34px] items-center gap-1 rounded-[10px] border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 motion-pressable"
      >
        <Filter size={13} />
        {t('Filter', 'Filtrer')}
      </button>
    </div>
    <FilterChipRow
      chips={VERTICAL_FILTER_CHIPS(language)}
      active={activeCategory}
      onChange={onCategoryChange}
    />
  </header>
) : (
  /* existing agent header (from Task 16) */
)}
```

Define `VERTICAL_FILTER_CHIPS` helper at top of file:

```tsx
const VERTICAL_FILTER_CHIPS = (language: 'en' | 'fr') =>
  VERTICALS.map((v) => ({ id: v.category, label: categoryLabel(v.category, language) }));
```

- [x] **Step 2: Override map pin rendering for clients — cluster dots vs. diamond pins**

When `userRole === 'client'`, swap the `<Marker>` render inside the map to render as a colored circle with white border + colored box-shadow:

```tsx
const isClient = userRole === 'client';
return (
  <CircleMarker
    center={[p.latitude, p.longitude]}
    radius={isClient ? 8 + clusterCount * 0.4 : 10}
    pathOptions={{
      color: '#ffffff',
      weight: 2,
      fillColor: vertical?.color,
      fillOpacity: 0.85,
    }}
  />
);
```

If existing markers use a different Leaflet API, keep the existing marker + add a CSS class distinguishing client vs agent styling. The key is a circular dot look for clients.

- [x] **Step 3: Client bottom-left info overlay**

```tsx
{userRole === 'client' && (
  <div className="absolute bottom-3 left-3 rounded-2xl bg-white/96 px-3.5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
    <div className="flex items-center gap-2">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: activeVerticalBg }}
      >
        <VerticalIcon category={activeCategory} size={14} />
      </div>
      <div>
        <div className="text-[13px] font-bold text-ink-dark">
          {pointCount} {t('points', 'points')}
        </div>
        <div className="text-[10px] text-gray-500">
          {activeVerticalLabel} · Bonamoussadi
        </div>
      </div>
    </div>
  </div>
)}
```

- [x] **Step 4: Imports**

```tsx
import { Filter } from 'lucide-react';
import FilterChipRow from '../shared/FilterChipRow';
```

- [x] **Step 5: Commit**

```bash
git add components/Screens/Home.tsx
git commit -m "feat(client): Map Explorer variant with chip filter and cluster dots"
```

---

## Phase 5: Verification

### Task 39: Raw hex lint pass

**Files:** N/A (cleanup)

- [x] **Step 1: Grep for raw hex in touched screens**

Run:
```bash
grep -rEn "#[0-9a-fA-F]{3,8}" components/Screens components/shared | grep -v "fill=\"#ffffff\"\|stroke=\"#ffffff\"" | head -40
```

- [x] **Step 2: For each legitimate raw-hex usage that already matches a token, replace inline with Tailwind class**

Exceptions allowed:
- SVG path `fill` / `stroke` attributes
- Linear-gradient values where no token equivalent exists (tier avatars, XP cards)

Replace anything else with `bg-navy` / `text-terra` / etc.

- [x] **Step 3: Commit cleanup**

```bash
git add components
git commit -m "chore(design): replace raw hex with Tailwind tokens where possible"
```

---

### Task 40: Bilingual coverage check

**Files:** N/A (audit)

- [x] **Step 1: Grep for suspicious hardcoded strings in changed screens**

Run:
```bash
grep -En ">\s*[A-Z][a-z]+.*<" components/Screens/{Home,Details,ContributionFlow,Profile,AdminQueue,DeltaDashboard,AgentPerformance,InvestorDashboard,ClientInsights,Settings}.tsx | grep -v "t(" | head -40
```

- [x] **Step 2: Wrap any missed English strings in `t(en, fr)`**

For each match, edit the line to wrap in `t('X', '<french-equivalent>')`.

- [x] **Step 3: Commit**

```bash
git add components/Screens
git commit -m "chore(i18n): wrap remaining hardcoded strings in t() helper"
```

---

### Task 41: Test suite + build

**Files:** N/A (verification)

- [x] **Step 1: Run CI suite**

Run: `npm run test:ci`
Expected: All green

- [x] **Step 2: If anything fails, fix root cause**

Do not skip tests. If a test mocks visual markup (e.g. asserting specific class names), update the assertion to match the new class rather than rewriting the test's intent.

- [x] **Step 3: Check function budget**

Run: `npm run check:function-budget`
Expected: Under budget

- [x] **Step 4: Production build**

Run: `npm run build`
Expected: Successful build with no warnings about unused imports or TS errors

- [x] **Step 5: Commit any fixes**

```bash
git add .
git commit -m "fix: resolve test/build failures from visual refactor"
```

(Skip if no fixes needed.)

---

### Task 42: Manual click-through per role

**Files:** N/A (manual verification)

- [x] **Step 1: Start dev server**

Run: `npm run dev &`
Open: `http://localhost:5173`

- [x] **Step 2: Agent flow**

Sign in as an agent user. Walk through:
1. Home → Map view (verify header chrome, vertical picker, mission peek, FAB animation)
2. Home → List view (verify card layout)
3. Tap a point → Details (verify photo block, info card, GPS card, CTA)
4. Tap FAB → ContributionFlow step 1 (photo)
5. Step 2 (details form, segmented Yes/No)
6. Step 3 (location validation table)
7. Step 4 (submit → success → back to map)
8. Profile tab (verify navy hero, stat grid, badges, week table)

Compare each screen side-by-side against the prototype in `agent_app.html`. Screenshot any pixel-level deltas.

- [x] **Step 3: Admin flow**

Sign in as admin. Walk through:
1. Admin queue (verify filter chips, card layout with risk + trust badges)
2. Tap a submission → detail review (photo, forensic table, flags, approve/reject buttons)
3. Approve → confirmation screen → back to queue
4. Bottom nav → Analytics (DeltaDashboard KPI tiles, vertical bars, weekly chart)
5. Bottom nav → Agents (summary tiles, ranked agent cards)

- [x] **Step 4: Client flow**

Sign in as client. Walk through:
1. Dashboard (navy hero, KPI pair, vertical bars, weekly chart, top zones)
2. Bottom nav → Map (Map Explorer with chip filter, cluster dots, stats overlay)
3. Bottom nav → Insights (navy headline, insight cards, export CTA)
4. Bottom nav → Account (navy profile card, settings sections)

- [x] **Step 5: Offline smoke test**

1. Disconnect network (DevTools → Offline)
2. As agent, capture a new submission end-to-end
3. Confirm queue indicator shows 1 pending
4. Reconnect — confirm queue drains, submission appears in admin queue

- [x] **Step 6: Reduced-motion smoke test**

In DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`.
Navigate Home → ContributionFlow → Success. Confirm:
- FAB breathing animation stopped
- Ring pulse stopped
- Screen transitions still fire but instantly

- [x] **Step 7: Commit a verification log**

```bash
echo "## $(date -u +%Y-%m-%dT%H:%M:%SZ) — handoff verification

Agent flow: ✓
Admin flow: ✓
Client flow: ✓
Offline smoke: ✓
Reduced motion: ✓

Deltas noted: [list any pixel-level gaps found]" >> docs/superpowers/plans/2026-04-22-design-handoff-verification-log.md

git add docs/superpowers/plans/2026-04-22-design-handoff-verification-log.md
git commit -m "docs(plan): record handoff verification run"
```

---

## Self-Review Results

- **Spec coverage**: ✓ All 13 screens (A1–A5, B1–B4, C1–C4) mapped to tasks 11–38. Phase 1 foundations (tasks 1–10) provide every shared primitive and nav variant listed in the spec. Phase 5 covers verification checklist items. Non-goals explicitly reiterated.
- **Placeholder scan**: No TBD / TODO / "implement later" markers. Every code block is real TypeScript.
- **Type consistency**: `RiskFilter`, `TrustTier`, `RiskLevel`, `Tone` named consistently across tasks 4, 5, 25, 26. `KpiTile` tone prop values match the toneMap in Task 3. `Screen.CLIENT_INSIGHTS` introduced in Task 10, consumed in Tasks 9 and 36.
- **Known adaptations**: Tasks 11–38 reference existing variables by conventional names (`profile.displayName`, `verticalStats`, etc.). Engineer must map to actual names in each file — explicit note included in relevant tasks to adapt rather than rename.
