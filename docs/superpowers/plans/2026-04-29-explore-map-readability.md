# Explore Map Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Explore map bottom navigation readable by preventing the navy “Next high-value capture” mission peek from visually bleeding behind nav items.

**Architecture:** Fix the map chrome at the layer and component level: give bottom navigation a real opaque white surface, make the mission peek content fit above the navigation instead of hiding behind it, and add a Playwright regression test that checks nav background opacity and mission/nav geometry. Keep the existing ADL mobile-first map pattern, bottom sheet, and mission card behavior.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite, Playwright.

---

## Current State

The screenshots show the bottom navigation becoming hard to read on the Explore map because the navy “Next high-value capture” card is visible behind it. Code inspection shows two likely causes:

- `components/Navigation.tsx` uses `bg-white/98`, which is not in the default Tailwind opacity scale, so the class can fail to emit a real background.
- `components/Screens/Home.tsx` gives `BottomSheet` a `peekHeight` of `88`, while `MissionCards` renders a full navy card in peek mode, so only the top of the card is visible above the nav area.

## File Structure

- Modify `components/Navigation.tsx`: replace invalid translucent class with a real opaque nav surface and slightly stronger inactive label contrast.
- Modify `components/MissionCards.tsx`: make peek mode render one compact primary mission card with stronger text contrast and a test id.
- Modify `components/Screens/Home.tsx`: centralize map chrome height constants, increase mission peek height, update map viewport padding, and keep floating CTA/hint above the mission peek.
- Create `e2e/smoke/map-readability.smoke.spec.ts`: regression test for bottom nav opacity and mission peek position.
- No backend or database files change.

---

### Task 1: Add Playwright Readability Regression

**Files:**
- Create: `e2e/smoke/map-readability.smoke.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write the failing smoke test**

Create `e2e/smoke/map-readability.smoke.spec.ts`:

```ts
import { expect, test } from "../fixtures/auth";

function parseAlpha(backgroundColor: string): number {
  const rgbaMatch = backgroundColor.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/i);
  if (rgbaMatch?.[1]) return Number(rgbaMatch[1]);
  if (/^rgb\(/i.test(backgroundColor)) return 1;
  return 0;
}

test("Explore map keeps mission peek above a readable bottom navigation", async ({ page, gotoApp }) => {
  await gotoApp("/");

  await expect(page.getByTestId("screen-home")).toBeVisible();

  const mapTab = page.getByRole("button", { name: /^Map$/i }).first();
  await mapTab.click();

  const nav = page.getByTestId("main-navigation");
  const missionPeek = page.getByTestId("mission-peek-primary");

  await expect(page.getByTestId("home-map-view")).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(missionPeek).toBeVisible();
  await expect(missionPeek).toContainText(/Next high-value capture/i);

  const navBackground = await nav.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(parseAlpha(navBackground)).toBeGreaterThanOrEqual(0.98);

  const navBox = await nav.boundingBox();
  const missionBox = await missionPeek.boundingBox();
  expect(navBox).not.toBeNull();
  expect(missionBox).not.toBeNull();
  if (!navBox || !missionBox) return;

  expect(missionBox.y + missionBox.height).toBeLessThanOrEqual(navBox.y - 8);
});
```

- [ ] **Step 2: Add the smoke test to the agent project**

In `playwright.config.ts`, find the `agent-mobile` or `agent-desktop` project entry that lists smoke specs. Add:

```ts
"e2e/smoke/map-readability.smoke.spec.ts",
```

If the project arrays are explicit, the agent project should include:

```ts
testMatch: [
  "e2e/smoke/agent.smoke.spec.ts",
  "e2e/smoke/agent-auth.smoke.spec.ts",
  "e2e/smoke/help-center.smoke.spec.ts",
  "e2e/smoke/profile-help-entry.smoke.spec.ts",
  "e2e/smoke/map-readability.smoke.spec.ts",
],
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npx playwright test e2e/smoke/map-readability.smoke.spec.ts --project=agent-mobile
```

Expected: FAIL because `mission-peek-primary` does not exist yet. If this repo only has `agent-desktop`, run:

```bash
npx playwright test e2e/smoke/map-readability.smoke.spec.ts --project=agent-desktop
```

- [ ] **Step 4: Commit failing test**

```bash
git add e2e/smoke/map-readability.smoke.spec.ts playwright.config.ts
git commit -m "test(map): guard explore chrome readability"
```

---

### Task 2: Make Bottom Navigation Surface Opaque

**Files:**
- Modify: `components/Navigation.tsx`

- [ ] **Step 1: Replace invalid nav background class**

In `components/Navigation.tsx`, replace the `<nav>` className:

```tsx
      className="z-40 flex min-h-[calc(var(--bottom-nav-height)+var(--safe-bottom))] items-start justify-around gap-1 border-t border-gray-200/90 bg-white/98 px-3 pt-2 shadow-[0_-12px_32px_rgba(15,43,70,0.08)] backdrop-blur-xl pb-[var(--safe-bottom)]"
```

with:

```tsx
      className="relative z-40 flex min-h-[calc(var(--bottom-nav-height)+var(--safe-bottom))] items-start justify-around gap-1 border-t border-gray-200/90 bg-white px-3 pt-2 shadow-[0_-12px_32px_rgba(15,43,70,0.10)] backdrop-blur-xl pb-[var(--safe-bottom)]"
```

- [ ] **Step 2: Strengthen inactive nav label contrast**

In the same file, replace:

```tsx
                  : 'text-gray-500 hover:bg-white hover:text-gray-700'
```

with:

```tsx
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run the readability test**

Run:

```bash
npx playwright test e2e/smoke/map-readability.smoke.spec.ts --project=agent-mobile
```

Expected: still FAIL because mission card geometry is not fixed yet, but nav background alpha assertion should pass. If this repo only has `agent-desktop`, use that project.

- [ ] **Step 5: Commit nav surface fix**

```bash
git add components/Navigation.tsx
git commit -m "fix(nav): keep bottom bar readable on map"
```

---

### Task 3: Make Mission Peek Fit Above Navigation

**Files:**
- Modify: `components/MissionCards.tsx`
- Modify: `components/Screens/Home.tsx`

- [ ] **Step 1: Replace peek-mode MissionCards rendering**

In `components/MissionCards.tsx`, replace the whole `if (sheetSnap === 'peek') { ... }` block with:

```tsx
  if (sheetSnap === 'peek') {
    if (!primaryCard) return null;
    const Icon = primaryCard.icon;

    return (
      <button
        type="button"
        onClick={primaryCard.action}
        data-testid="mission-peek-primary"
        className="motion-pressable route-grid w-full cursor-pointer rounded-2xl bg-navy p-3.5 text-left text-white shadow-[0_10px_28px_rgba(15,43,70,0.24)]"
      >
        <div className="flex min-h-[76px] items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/18 text-white">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="micro-label mb-1 text-white/85">
              {primaryCard.label}
            </div>
            <div className="truncate text-sm font-bold leading-tight text-white">
              {primaryCard.title}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[11px] font-medium leading-4 text-white/82">
              {primaryCard.meta}
            </div>
            {primaryCard.xpReward && (
              <div className="mt-1.5">
                <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-navy">
                  {primaryCard.xpReward}
                </span>
              </div>
            )}
          </div>
          <ChevronUp size={16} className="shrink-0 text-white/70" />
        </div>
      </button>
    );
  }
```

This intentionally shows only the primary mission in peek mode. Nearby opportunities still appear when the sheet is half/full.

- [ ] **Step 2: Add map chrome constants**

In `components/Screens/Home.tsx`, replace:

```ts
  const mapBottomChromePx = 80 + 88 + 4; // bottom nav + peek sheet + small offset
```

with:

```ts
  const bottomNavHeightPx = 80;
  const missionPeekHeightPx = 152;
  const mapBottomChromePx = bottomNavHeightPx + missionPeekHeightPx + 12;
  const floatingCtaOffsetPx = missionPeekHeightPx + 20;
  const floatingHintOffsetPx = missionPeekHeightPx + 88;
```

- [ ] **Step 3: Use the new peek height**

In `components/Screens/Home.tsx`, replace:

```tsx
            peekHeight={88}
```

with:

```tsx
            peekHeight={missionPeekHeightPx}
```

- [ ] **Step 4: Keep floating CTA above the taller peek**

In `components/Screens/Home.tsx`, replace the contribute floating button style:

```tsx
            style={{
              bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 6rem)',
              boxShadow: '0 6px 28px rgba(200,107,74,0.4), 0 2px 8px rgba(200,107,74,0.2)',
            }}
```

with:

```tsx
            style={{
              bottom: `calc(var(--bottom-nav-height) + var(--safe-bottom) + ${floatingCtaOffsetPx}px)`,
              boxShadow: '0 6px 28px rgba(200,107,74,0.4), 0 2px 8px rgba(200,107,74,0.2)',
            }}
```

- [ ] **Step 5: Keep the long-press hint above the taller peek**

In `components/Screens/Home.tsx`, replace:

```tsx
            style={{ bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 10rem)' }}
```

with:

```tsx
            style={{ bottom: `calc(var(--bottom-nav-height) + var(--safe-bottom) + ${floatingHintOffsetPx}px)` }}
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Run readability smoke test**

Run:

```bash
npx playwright test e2e/smoke/map-readability.smoke.spec.ts --project=agent-mobile
```

Expected: PASS. If the repo only has `agent-desktop`, use that project.

- [ ] **Step 8: Commit mission peek fix**

```bash
git add components/MissionCards.tsx components/Screens/Home.tsx
git commit -m "fix(map): keep mission peek clear of navigation"
```

---

### Task 4: Verify Existing Map And Navigation Flows

**Files:**
- No new source files.
- Verify: `components/Navigation.tsx`
- Verify: `components/MissionCards.tsx`
- Verify: `components/Screens/Home.tsx`
- Verify: `e2e/smoke/map-readability.smoke.spec.ts`

- [ ] **Step 1: Run focused smoke tests**

Run:

```bash
npx playwright test e2e/smoke/map-readability.smoke.spec.ts e2e/smoke/client.smoke.spec.ts e2e/smoke/admin-access-controls.smoke.spec.ts
```

Expected: PASS. This covers agent map readability, client nav map entry, and admin map scope controls.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Manual mobile verification**

Run the app:

```bash
npm run dev
```

Open the app on a mobile-width viewport and verify:

```text
1. Agent Explore map: bottom navigation stays white and labels are readable.
2. Agent Explore map: "Next high-value capture" card is fully above the nav.
3. Client Map tab: bottom navigation stays readable over the map.
4. Drag mission sheet to half/full: mission cards still render correctly.
5. Reduced-motion setting: sheet remains usable without jarring motion.
```

- [ ] **Step 5: Final commit if manual verification required small tweaks**

Only run this if Step 4 required changes:

```bash
git add components/Navigation.tsx components/MissionCards.tsx components/Screens/Home.tsx e2e/smoke/map-readability.smoke.spec.ts playwright.config.ts
git commit -m "fix(map): polish mobile chrome readability"
```

---

## Acceptance Criteria

- [ ] Bottom navigation has an opaque white surface on Explore map.
- [ ] Inactive bottom nav labels remain readable in sunlight-oriented light mode.
- [ ] Navy mission peek no longer sits visually behind nav labels/icons.
- [ ] `Next high-value capture` label, title, and meta are readable in peek mode.
- [ ] Map viewport padding accounts for the taller peek, so map markers are not hidden by chrome.
- [ ] Playwright regression test fails before the fix and passes after the fix.

## Self Review

- Spec coverage: The screenshot issue is covered by nav opacity, mission peek geometry, and text contrast changes.
- Placeholder scan: No deferred implementation markers remain in this plan.
- Type consistency: `missionPeekHeightPx`, `floatingCtaOffsetPx`, `floatingHintOffsetPx`, and `mission-peek-primary` are defined before use and match the Playwright test.
