# ADL Shared UI System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one evidence-backed ADL UI contract and apply it to the six approved first-wave flows across native ADL iOS, native ADL Console, ADL web, and ADL web Console.

**Architecture:** Keep semantic meaning shared and presentation shell-specific. A typed React contract defines operational statuses and visual tones for web surfaces; the two SwiftUI apps mirror those names in their existing design-system files, with automated parity checks preventing drift. Each shell adopts the contract through focused primitives and then applies it to the approved flows without forcing mobile and desktop layouts to match.

**Tech Stack:** Mobbin MCP, React 19, TypeScript, Tailwind CSS 3, Vite 6, Node test runner, Playwright, SwiftUI, MapKit, XCTest, Xcode

## Global Constraints

- Improve task completion and clarity in the most load-bearing flows across iOS, Console, and web.
- Mobbin is used for behavioral and structural reference, not visual cloning.
- Shared semantic meanings for primary action, success / verified, warning / attention needed, danger / rejected / destructive, info / neutral, and disabled / unavailable must stay consistent.
- Use a shared 4/8-based spacing scale with 8-point defaults.
- Motion must be informative, fast, purposeful, and reduced-motion safe.
- Cover default, focused, active, selected, loading, success, warning, error, disabled, offline, syncing, verified, and flagged.
- Preserve daylight readability, map-native clarity, operational seriousness, and verified-quality emphasis.
- All interactive controls must have at least a 48 CSS-pixel target on web field surfaces and at least a 44-point target on SwiftUI surfaces.
- English and French labels must remain behaviorally equivalent.
- Status cannot be communicated by color alone; use text plus an icon or another non-color cue.
- Keep interaction state and operational status as separate axes:
  - Interaction state: default, focused, active, selected, disabled.
  - Operational status: idle, loading, success, warning, error, offline, syncing, verified, flagged.
- Preserve unrelated local changes, especially Xcode user-state files.

---

## First-Wave Flow and Shell Matrix

| ID | Approved behavior flow | Primary shell | Required parity shell |
|---|---|---|---|
| F1 | Map exploration and opportunity selection | Native ADL iOS | ADL web field map |
| F2 | Guided capture with draft, offline, sync, and recovery | Native ADL iOS | ADL web field capture |
| F3 | Review queue triage | Native ADL Console | ADL web Console |
| F4 | Record evidence detail and decision | Native ADL Console | ADL web Console |
| F5 | Coverage dashboard and map drill-down | ADL web client | None in this wave |
| F6 | Trust and quality overview | ADL web client | Shared status language in both Console shells |

This is one plan because the shared semantic contract is the load-bearing dependency. Tasks 4 through 8 are shell adapters and remain independently reviewable and testable.

## File Structure

### Research and contract

- Create: `research/mobbin/2026-07-23-adl-first-wave-patterns.md` — scored Mobbin evidence and accepted pattern decisions for F1–F6
- Create: `lib/shared/ui/semanticTokens.ts` — React operational-status and semantic-tone contract
- Create: `tests/semanticTokens.test.ts` — exhaustive status mapping and cross-platform parity checks
- Modify: `tailwind.config.js` — include `lib/**/*.{js,ts,jsx,tsx}` in Tailwind content scanning
- Modify: `index.css` — focus-visible, disabled, selected, and reduced-motion interaction-state rules

### Shared React primitives

- Create: `components/shared/StatusBadge.tsx` — text-and-icon operational status badge
- Create: `components/shared/DecisionBar.tsx` — accessible status plus decision actions
- Create: `tests/sharedUiPrimitives.test.tsx` — server-rendered primitive contracts
- Modify: `components/shared/RiskBadge.tsx` — preserve bilingual API while delegating status rendering
- Modify: `components/shared/TrustBadge.tsx` — preserve tier API while delegating status rendering
- Modify: `components/shared/FilterChipRow.tsx` — selected and keyboard-focus semantics
- Modify: `components/shared/BottomSheet.tsx` — dialog semantics, drag-handle label, and reduced-motion behavior

### ADL web field and client flows

- Modify: `components/Screens/HomeMap.tsx` — map, selected point, sheet, and primary action linkage
- Modify: `components/Screens/ContributionFlow.tsx` — explicit capture validation and recovery states
- Modify: `components/SyncStatusBar.tsx` — normalized offline, syncing, error, and success presentation
- Modify: `components/Screens/DeltaDashboard.tsx` — coverage summary and spatial drill-down hierarchy
- Modify: `components/Screens/InvestorDashboard.tsx` — trust-overview landmark
- Modify: `components/investor/TrustGauge.tsx` — verified, monitoring, and attention language
- Modify: `components/shared/KpiTile.tsx` — semantic tone without changing existing `KpiTone` callers
- Modify: `tests/platformFieldUiContract.test.ts`
- Modify: `e2e/smoke/platform-collector.smoke.spec.ts`
- Modify: `e2e/smoke/map-readability.smoke.spec.ts`
- Modify: `e2e/smoke/client.smoke.spec.ts`

### ADL web Console flows

- Modify: `components/Console/ReviewQueueScreen.tsx` — shared queue statuses and evidence decision bar
- Modify: `tests/consoleShell.test.tsx` — server-rendered review semantics
- Modify: `e2e/smoke/console-roles.smoke.spec.ts` — queue, detail, required rejection reason, and decision confirmation

### Native ADL iOS flows

- Modify: `ios/App/App/Native/ADLDesignSystem.swift` — `ADLSemanticTone`, `ADLOperationalStatus`, and status presentation
- Modify: `ios/App/App/Native/ADLComponents.swift` — semantic status pill and selected-control treatment
- Modify: `ios/App/App/Native/ADLServices.swift` — observable connectivity state for truthful offline UI
- Modify: `ios/App/App/Native/ADLViews.swift` — F1 map selection and F2 capture/sync states
- Create: `tests/nativeFieldUiContract.test.ts` — source-level contract for the native target, which has no XCTest target

### Native ADL Console flows

- Modify: `ios-console/ADLConsole/DesignSystem/ADLConsoleColor.swift` — semantic color aliases
- Modify: `ios-console/ADLConsole/DesignSystem/ADLConsoleComponents.swift` — status pill and decision bar
- Modify: `ios-console/ADLConsole/Runtime/OperationalStatusModel.swift` — map existing operational state to shared semantic tone
- Modify: `ios-console/ADLConsole/Screens/Review/ReviewQueueView.swift` — F3 queue triage semantics
- Modify: `ios-console/ADLConsole/Screens/Review/ReviewRecordDetailView.swift` — F4 evidence and decision actions
- Create: `ios-console/ADLConsoleTests/ADLConsoleSemanticStatusTests.swift`

## Task 1: Produce the Mobbin evidence gate

**Files:**

- Create: `research/mobbin/2026-07-23-adl-first-wave-patterns.md`

**Interfaces:**

- Consumes: approved scoring rubric in `docs/superpowers/specs/2026-07-23-adl-shared-ui-system-design.md`
- Produces: accepted layout, CTA, hierarchy, state, trust, density, and transition decisions for F1–F6

- [ ] **Step 1: Query Mobbin for all six behavior families**

Use the connected `mobbin` MCP and run these exact searches:

```text
F1: map POI discovery selected marker bottom sheet primary action
F2: mobile camera capture multi-step form offline draft sync retry
F3: moderation review queue filters risk priority batch actions
F4: evidence review detail approve reject required reason
F5: coverage analytics map drill-down spatial dashboard
F6: data quality trust score freshness provenance verification
```

Collect at least three relevant screens per flow. Record the returned app name, screen name, platform, and Mobbin link. Stop the task if Mobbin authentication fails; do not substitute remembered examples.

- [ ] **Step 2: Score every candidate**

Score each dimension from 1 to 5:

```text
clarity in 3 seconds
next action obvious
state completeness
trust signaling
accessibility and readability
fit for ADL operational tone
shared-system portability
shell adaptation cost, reverse-scored
```

Accept only candidates scoring at least 30/40 and reject any candidate that depends on dark glossy styling, low contrast, constant connectivity, consumer-social playfulness, or decorative motion.

- [ ] **Step 3: Write the evidence file**

Use this exact section structure:

```md
# ADL First-Wave Mobbin Pattern Evidence

## Method

Scores use eight 1–5 dimensions. Accepted references score at least 30/40 and pass every ADL rejection rule.

## F1 — Map exploration and opportunity selection

### References

| App | Screen | Platform | Mobbin link | Score | Accepted |
|---|---|---|---|---:|---|

### Decision

State the selected marker, sheet, hierarchy, and CTA behaviors in four concrete bullets.
```

Repeat the `References` and `Decision` subsections for F2 through F6. Every decision must identify what ADL adopts, what it rejects, and how native/mobile and desktop shells diverge.

- [ ] **Step 4: Verify evidence completeness**

Run:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('research/mobbin/2026-07-23-adl-first-wave-patterns.md','utf8');for(let i=1;i<=6;i++){if(!s.includes('## F'+i+' '))throw new Error('missing F'+i)}if((s.match(/### Decision/g)||[]).length!==6)throw new Error('need six decisions')"
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add research/mobbin/2026-07-23-adl-first-wave-patterns.md
git commit -m "docs: add Mobbin evidence for shared UI flows"
```

## Task 2: Build the shared React semantic contract

**Files:**

- Create: `lib/shared/ui/semanticTokens.ts`
- Create: `tests/semanticTokens.test.ts`
- Modify: `tailwind.config.js`
- Modify: `index.css`

**Interfaces:**

- Produces:
  - `SemanticTone`
  - `OperationalStatus`
  - `TypographyRole`
  - `MapAnnotationState`
  - `UI_FOUNDATION`
  - `StatusPresentation`
  - `getStatusPresentation(status)`
  - `getToneClasses(tone)`

- [ ] **Step 1: Write the failing semantic-contract test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAP_ANNOTATION_STATES,
  OPERATIONAL_STATUSES,
  TYPOGRAPHY_ROLES,
  UI_FOUNDATION,
  getStatusPresentation,
  getToneClasses,
} from '../lib/shared/ui/semanticTokens.js';

test('every operational status has a tone, icon, and visible classes', () => {
  assert.deepEqual(OPERATIONAL_STATUSES, [
    'idle', 'loading', 'success', 'warning', 'error',
    'offline', 'syncing', 'verified', 'flagged',
  ]);
  for (const status of OPERATIONAL_STATUSES) {
    const presentation = getStatusPresentation(status);
    const classes = getToneClasses(presentation.tone);
    assert.ok(presentation.icon.length > 0, status);
    assert.match(classes.badge, /bg-/);
    assert.match(classes.badge, /text-/);
    assert.match(classes.panel, /border-/);
  }
});

test('verified and success share positive tone but keep distinct meanings', () => {
  assert.equal(getStatusPresentation('verified').tone, 'success');
  assert.equal(getStatusPresentation('success').tone, 'success');
  assert.notEqual(getStatusPresentation('verified').icon, getStatusPresentation('success').icon);
});

test('foundation values preserve shared rhythm and shell target sizes', () => {
  assert.deepEqual(UI_FOUNDATION.spacing, [4, 8, 12, 16, 24, 32]);
  assert.deepEqual(UI_FOUNDATION.radius, { control: 12, card: 16, panel: 24, pill: 9999 });
  assert.deepEqual(UI_FOUNDATION.minimumTarget, { field: 48, console: 44 });
  assert.deepEqual(UI_FOUNDATION.motionMs, { instant: 140, fast: 220, base: 320, slow: 560 });
  assert.deepEqual(UI_FOUNDATION.borderWidth, { default: 1, strong: 2 });
  assert.deepEqual(UI_FOUNDATION.iconSize, { compact: 16, control: 20, feature: 24 });
  assert.deepEqual(UI_FOUNDATION.elevation, ['flat', 'raised', 'overlay']);
  assert.deepEqual(TYPOGRAPHY_ROLES, [
    'pageTitle', 'sectionTitle', 'primaryMetric', 'body',
    'secondaryBody', 'metadata', 'label', 'caption',
  ]);
  assert.deepEqual(MAP_ANNOTATION_STATES, [
    'default', 'selected', 'verified', 'flagged', 'cluster', 'uncertainty', 'route',
  ]);
});
```

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```bash
node --import tsx --test tests/semanticTokens.test.ts
```

Expected: FAIL because `lib/shared/ui/semanticTokens.ts` does not exist.

- [ ] **Step 3: Implement the contract**

```ts
export const OPERATIONAL_STATUSES = [
  'idle', 'loading', 'success', 'warning', 'error',
  'offline', 'syncing', 'verified', 'flagged',
] as const;

export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];
export type SemanticTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export const TYPOGRAPHY_ROLES = [
  'pageTitle', 'sectionTitle', 'primaryMetric', 'body',
  'secondaryBody', 'metadata', 'label', 'caption',
] as const;
export type TypographyRole = (typeof TYPOGRAPHY_ROLES)[number];

export const MAP_ANNOTATION_STATES = [
  'default', 'selected', 'verified', 'flagged', 'cluster', 'uncertainty', 'route',
] as const;
export type MapAnnotationState = (typeof MAP_ANNOTATION_STATES)[number];

export const UI_FOUNDATION = {
  spacing: [4, 8, 12, 16, 24, 32],
  radius: { control: 12, card: 16, panel: 24, pill: 9999 },
  minimumTarget: { field: 48, console: 44 },
  motionMs: { instant: 140, fast: 220, base: 320, slow: 560 },
  borderWidth: { default: 1, strong: 2 },
  iconSize: { compact: 16, control: 20, feature: 24 },
  elevation: ['flat', 'raised', 'overlay'],
} as const;

export interface StatusPresentation {
  tone: SemanticTone;
  icon: 'circle' | 'loader' | 'check' | 'triangle' | 'x' | 'wifi-off' | 'refresh' | 'shield-check' | 'flag';
}

const presentationByStatus: Record<OperationalStatus, StatusPresentation> = {
  idle: { tone: 'neutral', icon: 'circle' },
  loading: { tone: 'info', icon: 'loader' },
  success: { tone: 'success', icon: 'check' },
  warning: { tone: 'warning', icon: 'triangle' },
  error: { tone: 'danger', icon: 'x' },
  offline: { tone: 'warning', icon: 'wifi-off' },
  syncing: { tone: 'info', icon: 'refresh' },
  verified: { tone: 'success', icon: 'shield-check' },
  flagged: { tone: 'danger', icon: 'flag' },
};

const classesByTone: Record<SemanticTone, { badge: string; panel: string; text: string }> = {
  neutral: { badge: 'border-gray-200 bg-gray-100 text-ink', panel: 'border-gray-200 bg-white', text: 'text-ink' },
  primary: { badge: 'border-navy-border bg-navy-wash text-navy', panel: 'border-navy-border bg-navy-wash', text: 'text-navy' },
  success: { badge: 'border-forest/30 bg-forest-wash text-forest-dark', panel: 'border-forest/30 bg-forest-wash', text: 'text-forest-dark' },
  warning: { badge: 'border-amber/30 bg-amber-wash text-amber', panel: 'border-amber/30 bg-amber-wash', text: 'text-amber' },
  danger: { badge: 'border-danger/30 bg-red-50 text-danger', panel: 'border-danger/30 bg-red-50', text: 'text-danger' },
  info: { badge: 'border-navy-border bg-navy-light text-navy', panel: 'border-navy-border bg-navy-light', text: 'text-navy' },
};

export function getStatusPresentation(status: OperationalStatus): StatusPresentation {
  return presentationByStatus[status];
}

export function getToneClasses(tone: SemanticTone) {
  return classesByTone[tone];
}
```

Add `"./lib/**/*.{js,ts,jsx,tsx}"` to `tailwind.config.js` `content`.

In `index.css`, extend the existing `@layer base` `:root` with spacing and radius aliases:

```css
--adl-space-1: 4px;
--adl-space-2: 8px;
--adl-space-3: 12px;
--adl-space-4: 16px;
--adl-space-6: 24px;
--adl-space-8: 32px;
--adl-radius-control: 12px;
--adl-radius-card: 16px;
--adl-radius-panel: 24px;
```

Keep the existing `--duration-instant`, `--duration-fast`, `--duration-base`, and `--duration-slow` values because they already match `UI_FOUNDATION.motionMs`. Keep the existing global `prefers-reduced-motion` override.

Add shared interaction rules under `@layer components`:

```css

.adl-focusable {
  @apply outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2;
}

.adl-disabled {
  @apply cursor-not-allowed opacity-50;
}

[aria-selected='true'].adl-selectable {
  @apply border-navy bg-navy-wash text-navy;
}
```

- [ ] **Step 4: Run focused and compile gates**

Run:

```bash
node --import tsx --test tests/semanticTokens.test.ts
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/ui/semanticTokens.ts tests/semanticTokens.test.ts tailwind.config.js index.css
git commit -m "feat: add shared semantic UI contract"
```

## Task 3: Build accessible shared React primitives

**Files:**

- Create: `components/shared/StatusBadge.tsx`
- Create: `components/shared/DecisionBar.tsx`
- Create: `tests/sharedUiPrimitives.test.tsx`
- Modify: `components/shared/RiskBadge.tsx`
- Modify: `components/shared/TrustBadge.tsx`
- Modify: `components/shared/FilterChipRow.tsx`
- Modify: `components/shared/BottomSheet.tsx`

**Interfaces:**

- Consumes: `OperationalStatus`, `SemanticTone`, `getStatusPresentation`, `getToneClasses`
- Produces:
  - `StatusBadge({ status, label, live, className })`
  - `DecisionBar({ status, statusLabel, actions })`
  - `DecisionAction`

- [ ] **Step 1: Write failing server-render tests**

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import DecisionBar from '../components/shared/DecisionBar.js';
import StatusBadge from '../components/shared/StatusBadge.js';

test('status badge uses text, icon, and optional live announcement', () => {
  const html = renderToStaticMarkup(<StatusBadge status="offline" label="Offline" live />);
  assert.match(html, /role="status"/);
  assert.match(html, /Offline/);
  assert.match(html, /aria-hidden="true"/);
});

test('decision bar keeps success and destructive actions distinct', () => {
  const html = renderToStaticMarkup(
    <DecisionBar
      status="flagged"
      statusLabel="Needs review"
      actions={[
        { id: 'reject', label: 'Reject', intent: 'danger', onSelect: () => undefined },
        { id: 'approve', label: 'Approve', intent: 'success', onSelect: () => undefined },
      ]}
    />,
  );
  assert.match(html, /Needs review/);
  assert.match(html, /bg-danger/);
  assert.match(html, /bg-forest/);
  assert.match(html, /min-h-12/);
});
```

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run:

```bash
node --import tsx --test tests/sharedUiPrimitives.test.tsx
```

Expected: FAIL because both shared components are missing.

- [ ] **Step 3: Implement `StatusBadge` and `DecisionBar`**

Use Lucide icons selected from the status presentation and render every icon with `aria-hidden="true"`. Export this action contract:

```ts
export interface DecisionAction {
  id: string;
  label: string;
  intent: 'primary' | 'success' | 'danger' | 'neutral';
  onSelect: () => void;
  disabled?: boolean;
  busy?: boolean;
}
```

Map action intent exactly:

```ts
const actionClassByIntent = {
  primary: 'bg-navy text-white',
  success: 'bg-forest text-white',
  danger: 'bg-danger text-white',
  neutral: 'border border-navy-border bg-white text-navy',
} as const;
```

`DecisionBar` must render its status through `StatusBadge`, use `aria-busy` per action, and add `adl-focusable min-h-12 rounded-xl px-4 text-sm font-semibold` to every button.

- [ ] **Step 4: Preserve existing badge and control APIs**

Keep `RiskBadge` props as `{ level, language }` and map low → verified, medium → warning, high → flagged. Keep `TrustBadge` props as `{ tier, language }` and map gold → verified, silver → idle, bronze → warning. Do not move translation responsibility into the shared semantic contract.

Add `aria-selected={active === chip.id}` and `adl-focusable adl-selectable` to `FilterChipRow`.

Add `role="dialog"`, `aria-modal="false"`, and an accessible drag-handle label to `BottomSheet`; preserve its public props and snap behavior.

- [ ] **Step 5: Run focused and compile gates**

Run:

```bash
node --import tsx --test tests/sharedUiPrimitives.test.tsx tests/consoleShell.test.tsx
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add components/shared/StatusBadge.tsx components/shared/DecisionBar.tsx components/shared/RiskBadge.tsx components/shared/TrustBadge.tsx components/shared/FilterChipRow.tsx components/shared/BottomSheet.tsx tests/sharedUiPrimitives.test.tsx
git commit -m "feat: add accessible shared UI primitives"
```

## Task 4: Apply F1 and F2 to ADL web field surfaces

**Files:**

- Modify: `components/Screens/HomeMap.tsx`
- Modify: `components/Screens/ContributionFlow.tsx`
- Modify: `components/SyncStatusBar.tsx`
- Modify: `tests/platformFieldUiContract.test.ts`
- Modify: `e2e/smoke/platform-collector.smoke.spec.ts`
- Modify: `e2e/smoke/map-readability.smoke.spec.ts`

**Interfaces:**

- Consumes: `StatusBadge`, `DecisionBar`
- Produces: `data-testid="map-selection-state"`, `capture-sync-state`, and `capture-primary-cta`

- [ ] **Step 1: Add failing source-contract assertions**

Append to `tests/platformFieldUiContract.test.ts`:

```ts
const mapPath = new URL('../components/Screens/HomeMap.tsx', import.meta.url);
const contributionPath = new URL('../components/Screens/ContributionFlow.tsx', import.meta.url);
const syncPath = new URL('../components/SyncStatusBar.tsx', import.meta.url);

test('field flows expose shared selection, recovery, and sync semantics', async () => {
  const [map, contribution, sync] = await Promise.all([
    readFile(mapPath, 'utf8'),
    readFile(contributionPath, 'utf8'),
    readFile(syncPath, 'utf8'),
  ]);
  assert.match(map, /map-selection-state/);
  assert.match(map, /aria-selected/);
  assert.match(contribution, /capture-primary-cta/);
  assert.match(contribution, /Save draft|Enregistrer/);
  assert.match(sync, /StatusBadge/);
  assert.match(sync, /capture-sync-state/);
});
```

- [ ] **Step 2: Add failing Playwright behavior checks**

In the collector smoke test, assert that offline state retains the draft action and that retry is visible after a failed upload. In the map smoke test, select a point and assert that the selected marker, panel label, and primary CTA refer to the same point before activating the CTA.

Use role/name locators for actions and test IDs only for cross-surface state linkage.

- [ ] **Step 3: Normalize `SyncStatusBar` without changing its public props**

Derive `OperationalStatus` from existing props in this priority order:

```ts
const operationalStatus =
  failed > 0
    ? 'error'
    : isOffline && pending > 0
      ? 'offline'
      : isSyncing
        ? 'syncing'
        : 'success';
```

Render `StatusBadge` inside the existing sticky bar, retain `pending`, `failed`, `synced`, `isOffline`, `isSyncing`, `onTap`, `onRefresh`, and `language`, and add `data-testid="capture-sync-state"`.

- [ ] **Step 4: Link map selection and capture recovery**

In `HomeMap`, apply `aria-selected` to the selected map opportunity control and render a single `map-selection-state` summary immediately above the existing primary action.

In `ContributionFlow`, keep the existing step machine and handlers. Add `data-testid="capture-primary-cta"` to the current primary button, keep a visible bilingual draft action when offline, and use `DecisionBar` only at the final submit/recovery stage.

- [ ] **Step 5: Run focused gates**

Run:

```bash
node --import tsx --test tests/platformFieldUiContract.test.ts
npx playwright test e2e/smoke/platform-collector.smoke.spec.ts e2e/smoke/map-readability.smoke.spec.ts --project=agent-mobile
npm run typecheck
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add components/Screens/HomeMap.tsx components/Screens/ContributionFlow.tsx components/SyncStatusBar.tsx tests/platformFieldUiContract.test.ts e2e/smoke/platform-collector.smoke.spec.ts e2e/smoke/map-readability.smoke.spec.ts
git commit -m "feat: align web field flows with shared UI states"
```

## Task 5: Apply F5 and F6 to the ADL web client

**Files:**

- Modify: `components/Screens/DeltaDashboard.tsx`
- Modify: `components/Screens/InvestorDashboard.tsx`
- Modify: `components/investor/TrustGauge.tsx`
- Modify: `components/shared/KpiTile.tsx`
- Modify: `e2e/smoke/client.smoke.spec.ts`

**Interfaces:**

- Produces: `client-trust-overview`, `dashboard-map-drilldown`, and explicit freshness/verification language

- [ ] **Step 1: Add failing client behavior checks**

Append to `e2e/smoke/client.smoke.spec.ts`:

```ts
test('client sees trust meaning and linked spatial drill-down', async ({ page, gotoApp }) => {
  await gotoApp('/');
  await expect(page.getByTestId('client-trust-overview')).toContainText(/Verified|Monitoring|Needs attention/i);
  await page.getByRole('button', { name: /^Pharmacy$/i }).click();
  const drilldown = page.getByTestId('dashboard-map-drilldown');
  await expect(drilldown).toBeVisible();
  await expect(drilldown).toContainText(/Fresh|Stale|Verified|Flagged|No major evidence caveats/i);
});
```

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```bash
npx playwright test e2e/smoke/client.smoke.spec.ts --project=client-desktop
```

Expected: FAIL on missing `client-trust-overview` or `dashboard-map-drilldown`.

- [ ] **Step 3: Apply shared trust semantics**

Keep `KpiTile`'s existing `KpiTone` API. Add an optional `status?: OperationalStatus` prop; when present, derive the border/text classes from the shared contract while retaining the current tone as fallback.

Wrap the existing `TrustGauge` content in `data-testid="client-trust-overview"` and render:

```ts
const status = score >= 90 ? 'verified' : score < 60 ? 'flagged' : 'warning';
const label = score >= 90
  ? t('Verified', 'Vérifié')
  : score < 60
    ? t('Needs attention', 'Attention requise')
    : t('Monitoring', 'Sous surveillance');
```

Add `data-testid="dashboard-map-drilldown"` to the existing focused spatial-cell detail in `DeltaDashboard`; do not create a second drill-down panel. Add freshness and caveat status through `StatusBadge`.

Add `data-testid="client-trust-overview"` at the containing trust section in `InvestorDashboard` only if the identifier is not already emitted by `TrustGauge`; there must be exactly one matching element.

- [ ] **Step 4: Run focused gates**

Run:

```bash
npx playwright test e2e/smoke/client.smoke.spec.ts --project=client-desktop
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add components/Screens/DeltaDashboard.tsx components/Screens/InvestorDashboard.tsx components/investor/TrustGauge.tsx components/shared/KpiTile.tsx e2e/smoke/client.smoke.spec.ts
git commit -m "feat: clarify client coverage and trust flows"
```

## Task 6: Apply F3 and F4 to ADL web Console

**Files:**

- Modify: `components/Console/ReviewQueueScreen.tsx`
- Modify: `tests/consoleShell.test.tsx`
- Modify: `e2e/smoke/console-roles.smoke.spec.ts`

**Interfaces:**

- Consumes: `StatusBadge`, `DecisionBar`
- Produces: `web-console-review-status`, `web-console-decision-bar`, and persistent rejection validation

- [ ] **Step 1: Add failing web Console checks**

Add a server-render test that imports `ReviewQueueScreen` source and asserts it consumes both shared primitives. Extend the existing reviewer Playwright test to assert:

```ts
await expect(page.getByTestId('web-console-review-status')).toContainText(/Pending|Approved|Rejected/i);
await expect(page.getByTestId('web-console-decision-bar')).toBeVisible();
await page.getByRole('button', { name: 'Reject record' }).click();
await expect(page.getByRole('alert')).toContainText(/rejection reason/i);
```

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run:

```bash
node --import tsx --test tests/consoleShell.test.tsx
npx playwright test e2e/smoke/console-roles.smoke.spec.ts --project=admin-desktop
```

Expected: FAIL on missing shared review hooks.

- [ ] **Step 3: Refactor the existing expanded record**

Do not create a second detail route. In the current expanded record:

- Render record status through `StatusBadge` with `data-testid="web-console-review-status"`.
- Keep form values, photos, GPS, device, and image metadata above decisions.
- Replace the two-button grid with `DecisionBar`.
- Keep the existing `decide` function and its required rejection-note validation.
- Set `data-testid="web-console-decision-bar"` on the shared bar wrapper.
- Keep read-only mode free of mutation actions.

- [ ] **Step 4: Run focused gates**

Run:

```bash
node --import tsx --test tests/consoleShell.test.tsx
npx playwright test e2e/smoke/console-roles.smoke.spec.ts --project=admin-desktop
npm run typecheck
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add components/Console/ReviewQueueScreen.tsx tests/consoleShell.test.tsx e2e/smoke/console-roles.smoke.spec.ts
git commit -m "feat: align web Console review decisions"
```

## Task 7: Apply F1 to native ADL iOS

**Files:**

- Modify: `ios/App/App/Native/ADLDesignSystem.swift`
- Modify: `ios/App/App/Native/ADLComponents.swift`
- Modify: `ios/App/App/Native/ADLViews.swift`
- Create: `tests/nativeFieldUiContract.test.ts`

**Interfaces:**

- Produces:
  - `ADLSemanticTone`
  - `ADLOperationalStatus`
  - `ADLMapAnnotationState`
  - `ADLStatusPill`
  - accessibility identifiers `native-map-selection-state` and `native-map-primary-action`

- [ ] **Step 1: Write a failing native source contract**

```ts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const designPath = new URL('../ios/App/App/Native/ADLDesignSystem.swift', import.meta.url);
const viewsPath = new URL('../ios/App/App/Native/ADLViews.swift', import.meta.url);

test('native ADL mirrors semantic status names and links map selection to its CTA', async () => {
  const [design, views] = await Promise.all([
    readFile(designPath, 'utf8'),
    readFile(viewsPath, 'utf8'),
  ]);
  for (const state of ['idle', 'loading', 'success', 'warning', 'error', 'offline', 'syncing', 'verified', 'flagged']) {
    assert.match(design, new RegExp(`case ${state}\\b`), state);
  }
  assert.match(design, /case `default`/);
  for (const state of ['selected', 'verified', 'flagged', 'cluster', 'uncertainty', 'route']) {
    assert.match(design, new RegExp(`\\b${state}\\b`), `map: ${state}`);
  }
  assert.match(views, /native-map-selection-state/);
  assert.match(views, /native-map-primary-action/);
});
```

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```bash
node --import tsx --test tests/nativeFieldUiContract.test.ts
```

Expected: FAIL on missing native semantic enums and identifiers.

- [ ] **Step 3: Add native semantic types**

In `ADLDesignSystem.swift`, define:

```swift
enum ADLSemanticTone: Equatable {
    case neutral, primary, success, warning, danger, info
}

enum ADLOperationalStatus: String, CaseIterable {
    case idle, loading, success, warning, error, offline, syncing, verified, flagged

    var tone: ADLSemanticTone {
        switch self {
        case .idle: return .neutral
        case .loading, .syncing: return .info
        case .success, .verified: return .success
        case .warning, .offline: return .warning
        case .error, .flagged: return .danger
        }
    }
}

enum ADLMapAnnotationState: String, CaseIterable {
    case `default`, selected, verified, flagged, cluster, uncertainty, route
}
```

Add computed foreground, background, border, and SF Symbol properties using the existing ADL palette. Use distinct symbols for `.success` and `.verified`.

Add `ADLStatusPill(text:status:)` in `ADLComponents.swift`, with text plus SF Symbol and a minimum height of 44 points.

- [ ] **Step 4: Link map marker, sheet, and primary action**

In the existing `AgentHomeView`, `FieldMapKitView`, `FieldMapActionBar`, and `PointDetailSheet` path:

- Preserve one `selectedPoint` source of truth.
- Map default, selected, verified, flagged, cluster, uncertainty, and route rendering through `ADLMapAnnotationState`.
- Give the selected annotation a non-color size/stroke change.
- Render verified versus refresh-needed status through `ADLStatusPill`.
- Add `.accessibilityIdentifier("native-map-selection-state")` to the selected-point summary.
- Add `.accessibilityIdentifier("native-map-primary-action")` to the corresponding capture button.
- Keep all map controls at least 44 points.

- [ ] **Step 5: Run native gates**

Run:

```bash
node --import tsx --test tests/nativeFieldUiContract.test.ts
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' build
```

Expected: source contract passes and Xcode reports `** BUILD SUCCEEDED **`.

- [ ] **Step 6: Commit**

```bash
git add ios/App/App/Native/ADLDesignSystem.swift ios/App/App/Native/ADLComponents.swift ios/App/App/Native/ADLViews.swift tests/nativeFieldUiContract.test.ts
git commit -m "feat: align native ADL map selection semantics"
```

## Task 8: Apply F2 to native ADL iOS

**Files:**

- Modify: `ios/App/App/Native/ADLServices.swift`
- Modify: `ios/App/App/Native/ADLViews.swift`
- Modify: `tests/nativeFieldUiContract.test.ts`

**Interfaces:**

- Consumes: `ADLOperationalStatus`, `ADLStatusPill`
- Produces: truthful connectivity state and identifiers `native-capture-primary-action`, `native-sync-status`, `native-save-draft`

- [ ] **Step 1: Extend the failing native contract**

```ts
test('native capture exposes draft, sync, and recovery states', async () => {
  const [services, views] = await Promise.all([
    readFile(new URL('../ios/App/App/Native/ADLServices.swift', import.meta.url), 'utf8'),
    readFile(viewsPath, 'utf8'),
  ]);
  assert.match(services, /NWPathMonitor/);
  assert.match(services, /isOffline/);
  assert.match(views, /native-capture-primary-action/);
  assert.match(views, /native-sync-status/);
  assert.match(views, /native-save-draft/);
});
```

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```bash
node --import tsx --test tests/nativeFieldUiContract.test.ts
```

Expected: FAIL on missing connectivity and capture identifiers.

- [ ] **Step 3: Expose truthful connectivity**

In `ADLServices.swift`, import `Network`, own one `NWPathMonitor`, and publish:

```swift
@Published private(set) var isOffline = false
```

Update it on the main actor from `path.status != .satisfied`. Start the monitor once during `AppState` initialization and cancel it during teardown. Do not infer offline state from a failed request.

- [ ] **Step 4: Make capture and sync states explicit**

In the existing `ContributionView`, `ADLSyncBar`, and `SubmissionQueueView`:

- Keep the five-step capture machine.
- Add a visible Save Draft action on review and while offline.
- Add `.accessibilityIdentifier("native-save-draft")`.
- Add `.accessibilityIdentifier("native-capture-primary-action")` to Continue/Submit.
- Derive sync status in this order: failed → error, offline with queued work → offline, active sync → syncing, queued → warning, otherwise success.
- Render the status with `ADLStatusPill` and `.accessibilityIdentifier("native-sync-status")`.
- Keep retry adjacent to error state and never label queued work as verified.

- [ ] **Step 5: Run native gates**

Run:

```bash
node --import tsx --test tests/nativeFieldUiContract.test.ts
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' build
```

Expected: source contract passes and Xcode reports `** BUILD SUCCEEDED **`.

- [ ] **Step 6: Commit**

```bash
git add ios/App/App/Native/ADLServices.swift ios/App/App/Native/ADLViews.swift tests/nativeFieldUiContract.test.ts
git commit -m "feat: clarify native ADL capture and sync states"
```

## Task 9: Apply F3 and F4 to native ADL Console

**Files:**

- Modify: `ios-console/ADLConsole/DesignSystem/ADLConsoleColor.swift`
- Modify: `ios-console/ADLConsole/DesignSystem/ADLConsoleComponents.swift`
- Modify: `ios-console/ADLConsole/Runtime/OperationalStatusModel.swift`
- Modify: `ios-console/ADLConsole/Screens/Review/ReviewQueueView.swift`
- Modify: `ios-console/ADLConsole/Screens/Review/ReviewRecordDetailView.swift`
- Create: `ios-console/ADLConsoleTests/ADLConsoleSemanticStatusTests.swift`

**Interfaces:**

- Reuses existing `OperationalStatus` instead of creating a duplicate connectivity model
- Produces:
  - `ADLConsoleSemanticTone`
  - `OperationalStatus.semanticTone`
  - `ADLConsoleStatusPill`
  - `ADLConsoleDecisionBar`

- [ ] **Step 1: Write failing semantic tests**

```swift
import XCTest
@testable import ADLConsole

final class ADLConsoleSemanticStatusTests: XCTestCase {
    func testOperationalStatusesMapToSharedTones() {
        XCTAssertEqual(OperationalStatus.offline(expiresAt: nil).semanticTone, .warning)
        XCTAssertEqual(OperationalStatus.connecting.semanticTone, .info)
        XCTAssertEqual(OperationalStatus.pending(count: 2).semanticTone, .warning)
        XCTAssertEqual(OperationalStatus.syncing(current: 1, total: 3).semanticTone, .info)
        XCTAssertEqual(OperationalStatus.blocked(count: 1).semanticTone, .danger)
        XCTAssertEqual(OperationalStatus.upToDate(lastSuccessfulSyncAt: nil).semanticTone, .success)
    }
}
```

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```bash
xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -only-testing:ADLConsoleTests/ADLConsoleSemanticStatusTests
```

Expected: FAIL because `semanticTone` and `ADLConsoleSemanticTone` do not exist.

- [ ] **Step 3: Add Console semantic adapters**

Define:

```swift
enum ADLConsoleSemanticTone: Equatable {
    case neutral, primary, success, warning, danger, info
}
```

Add semantic foreground, background, and border aliases in `ADLConsoleColor.swift`. In `OperationalStatusModel.swift`, map existing statuses exactly as asserted by the test.

Add `ADLConsoleStatusPill(text:tone:systemImage:)` and an `ADLConsoleDecisionBar` that accepts approve, reject, and optional secondary closures. Keep every action at least 44 points and distinguish destructive and approval actions by text, icon, and color.

- [ ] **Step 4: Apply queue and detail behavior**

In `ReviewQueueView`:

- Use status pills for pending, syncing, blocked, and decision feedback.
- Preserve selection, bulk approval, refresh, and notification behavior.
- Keep `ReviewQueueViewModel` as the only mutation owner.

Change `ReviewRecordDetailView` to accept:

```swift
let isBusy: Bool
let onApprove: () async -> Bool
let onReject: (_ reason: String) async -> Bool
```

Place `ADLConsoleDecisionBar` after evidence sections. Require a non-empty trimmed rejection reason before invoking `onReject`. Wrap each async closure in `Task`, set local busy state while awaiting it, and dismiss only when the returned value is `true`. In `ReviewQueueView`, pass the existing `ReviewQueueViewModel.approve` and `reject` operations through these closures.

- [ ] **Step 5: Run Console gates**

Run:

```bash
xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -only-testing:ADLConsoleTests/ADLConsoleSemanticStatusTests -only-testing:ADLConsoleTests/ReviewQueueViewModelTests
```

Expected: Xcode reports `** TEST SUCCEEDED **`.

- [ ] **Step 6: Commit**

```bash
git add ios-console/ADLConsole/DesignSystem/ADLConsoleColor.swift ios-console/ADLConsole/DesignSystem/ADLConsoleComponents.swift ios-console/ADLConsole/Runtime/OperationalStatusModel.swift ios-console/ADLConsole/Screens/Review/ReviewQueueView.swift ios-console/ADLConsole/Screens/Review/ReviewRecordDetailView.swift ios-console/ADLConsoleTests/ADLConsoleSemanticStatusTests.swift
git commit -m "feat: align native Console review semantics"
```

## Task 10: Verify cross-platform parity and accessibility

**Files:**

- Modify: `tests/semanticTokens.test.ts`
- Modify: `e2e/smoke/accessibility.smoke.spec.ts`
- Modify: `docs/superpowers/specs/2026-07-23-adl-shared-ui-system-design.md`

**Interfaces:**

- Consumes: Tasks 1–9
- Produces: automated name parity, accessibility coverage, and recorded implementation deviations

- [ ] **Step 1: Add a failing cross-platform parity test**

Extend `tests/semanticTokens.test.ts` to read:

```ts
const nativeField = await readFile(
  new URL('../ios/App/App/Native/ADLDesignSystem.swift', import.meta.url),
  'utf8',
);
const nativeConsole = await readFile(
  new URL('../ios-console/ADLConsole/DesignSystem/ADLConsoleComponents.swift', import.meta.url),
  'utf8',
);

for (const status of OPERATIONAL_STATUSES) {
  assert.match(nativeField, new RegExp(`case ${status}\\b`), `native ADL: ${status}`);
}
for (const tone of ['neutral', 'primary', 'success', 'warning', 'danger', 'info']) {
  assert.match(nativeConsole, new RegExp(`case ${tone}\\b`), `native Console: ${tone}`);
}
```

- [ ] **Step 2: Extend accessibility smoke coverage**

In `e2e/smoke/accessibility.smoke.spec.ts`, cover the four web states changed by this plan:

- field map with a selected opportunity
- field capture with offline status
- client spatial drill-down
- web Console expanded review detail

For each state, run Axe and assert no serious or critical violations. Separately assert 48-pixel minimum hit areas for the primary action and recovery action on field-mobile viewport.

- [ ] **Step 3: Run the complete quality gate**

Run:

```bash
npm run lint
npm run typecheck
npm run test
node --import tsx --test tests/sharedUiPrimitives.test.tsx tests/consoleShell.test.tsx
npm run build
npx playwright test e2e/smoke/platform-collector.smoke.spec.ts e2e/smoke/map-readability.smoke.spec.ts --project=agent-mobile
npx playwright test e2e/smoke/client.smoke.spec.ts --project=client-desktop
npx playwright test e2e/smoke/console-roles.smoke.spec.ts --project=admin-desktop
npm run test:e2e:a11y
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' build
xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5'
```

Expected: every command passes; Xcode reports `BUILD SUCCEEDED` for native ADL and `TEST SUCCEEDED` for native Console.

- [ ] **Step 4: Record only real implementation deviations**

If shipping code differs from the approved spec, append an `Implementation Notes` section to `docs/superpowers/specs/2026-07-23-adl-shared-ui-system-design.md` containing:

- changed semantic names and why
- shell-specific exceptions and why
- Mobbin patterns rejected during implementation and why
- known test limitations

If there are no deviations, leave the approved spec unchanged.

- [ ] **Step 5: Commit**

```bash
git add tests/semanticTokens.test.ts e2e/smoke/accessibility.smoke.spec.ts docs/superpowers/specs/2026-07-23-adl-shared-ui-system-design.md
git commit -m "test: verify shared UI parity and accessibility"
```

## Self-Review

### Spec coverage

- Mobbin research and scoring: Task 1
- Shared semantic meaning and interaction states: Tasks 2–3
- F1 map selection: Tasks 4 and 7
- F2 capture, draft, offline, sync, and recovery: Tasks 4 and 8
- F3 review queue: Tasks 6 and 9
- F4 evidence detail and decision: Tasks 6 and 9
- F5 coverage dashboard and map drill-down: Task 5
- F6 trust and quality overview: Task 5, with Console language parity in Tasks 6 and 9
- Accessibility, bilingual parity, target sizing, and reduced motion: Tasks 2–10

### Repository reality checks

- Native ADL uses `ios/App/App/Native/*`; React files are web/Capacitor surfaces, not substitutes for the native SwiftUI implementation.
- Native ADL has no XCTest target, so Tasks 7–8 use a source contract plus an Xcode build.
- Native ADL Console has unit and UI test targets; Task 9 uses focused XCTest coverage.
- `e2e/smoke/console-roles.smoke.spec.ts` covers the web Console only.
- Existing public component props are preserved unless a task explicitly defines a compatible extension.

### Type consistency

- React uses `OperationalStatus` for operational state and CSS/ARIA for interaction state.
- Native ADL mirrors operational status names with `ADLOperationalStatus`.
- Native Console reuses its existing `OperationalStatus` and maps it to `ADLConsoleSemanticTone`.
- `verified` and `success` share a positive tone but retain distinct text and icons.
