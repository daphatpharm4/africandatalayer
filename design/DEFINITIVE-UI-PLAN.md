# ADL Definitive UI Redesign Plan

## Merging /design, /gptdesign, and /research into Ground Truth

**Supersedes:** `design/REDESIGN-PLAN.md`, `gptdesign/MASTER.md`, `gptdesign/pages/*.md`
**Sources:** All 11 research deliverables (01-11), existing codebase audit (March-April 2026), `docs/APP-MODERNIZATION-AND-GAMIFICATION-PROGRAM.md`
**Date:** March 8, 2026

---

## April 2026 Update

This document remains the canonical UI redesign baseline, but it is now extended by:

- `design/GAMIFICATION-AND-MODERNIZATION-EXECUTION-PLAN.md`
- `gptdesign/pages/field-agent-gamification-modernization.md`
- `docs/MULTI-AGENT-MODERNIZATION-MASTER-PROMPT.md`

Use this file for the broad UI system, and the new companion docs for mission design, progression, and orchestrated implementation.

---

## 1. What Is Already Built (Codebase Audit)

Before planning what to change, here is what the app **already has**. Both prior design documents (`/design/REDESIGN-PLAN.md` and `/gptdesign/`) incorrectly assumed several features were missing.

### 1.1 Already Implemented

| Feature | File(s) | Status |
|---|---|---|
| **Multi-step capture wizard** | `ContributionFlow.tsx` (77KB) | CREATE + ENRICH modes, photo capture, EXIF parsing, dedup check, category selection, dynamic per-vertical fields, offline queue integration |
| **Offline queue with stats** | `offlineQueue.ts` (287 lines) | IndexedDB queue, `getQueueStats()` returns pending/failed/total, exponential backoff retry, sync error management |
| **XP, badges, trust score** | `Profile.tsx` (528 lines) | XP balance, trust score (98%), badge count, contribution history with XP per item |
| **Weekly assignments** | `Profile.tsx` | Assignment workflow with pending/in_progress/completed status, start/complete actions |
| **Admin split-panel queue** | `AdminQueue.tsx` (52KB) | Left: filterable queue. Right: EXIF validation, fraud scores, photo metadata, device profile |
| **Delta dashboard** | `DeltaDashboard.tsx` (392 lines) | Anomaly detection, summary cards, vertical tabs, trend charts, stacked delta bars, recent changes |
| **Leaderboard** | `Analytics.tsx` (424 lines) | Top 20 contributors with XP and rank. Admin mode: completion rate, category breakdown, freshness heatmap |
| **7 verticals with field schemas** | `verticals.ts` (369 lines) | pharmacy, mobile_money, fuel_station, alcohol_outlet, billboard, transport_road, census_proxy with enrichableFields and createRequiredFields |
| **Bilingual EN/FR** | Throughout | `t(en, fr)` helper pattern used consistently |
| **Bottom nav (4 tabs)** | `Navigation.tsx` | Explore, Contribute, Impact/Leaderboard, Profile. Hidden during Splash/Auth/Contribute |
| **Map + list toggle** | `Home.tsx` + `HomeMap.tsx` | Leaflet map with vertical-colored markers, list view alternative |
| **Vertical-specific icons** | `VerticalIcon.tsx` | lucide-react icons mapped per vertical |
| **Brand identity** | Throughout | Navy #0f2b46, Gold #f4c317, Terracotta #c86b4a, Forest Green #4c7c59 |
| **Offline banner** | `App.tsx` | Amber bar when offline |
| **Lazy-loaded screens** | `App.tsx` | All screens except Splash/Home/Navigation are lazy-loaded |
| **Error boundary** | `ErrorBoundary.tsx` | Wraps entire app |
| **13 screens in router** | `types.ts` | SPLASH, HOME, DETAILS, AUTH, CONTRIBUTE, PROFILE, ANALYTICS, SETTINGS, QUALITY, REWARDS, ADMIN, DELTA_DASHBOARD |

### 1.2 What Is Actually Missing

These are the **real gaps** between the current app and the vision described across all research deliverables:

| Gap | Source (Research Doc) | Priority |
|---|---|---|
| **Persistent sync status bar** (not just offline banner) | 08 (UI/UX), both design docs | P0 |
| **Batch capture mode** | 08 (UI/UX), both design docs | P0 |
| **Submission queue screen** (user-facing queue management) | 08 (UI/UX), design docs | P0 |
| **Assignment card on Home screen** | 08 (UI/UX), gptdesign/field-agent | P1 |
| **Daily progress widget on Home** | 08 (UI/UX), gptdesign/field-agent | P1 |
| **In-flow XP feedback** (post-capture animation) | 08 (UI/UX), both design docs | P1 |
| **Streak tracker** on Home | 08 (UI/UX), gptdesign/field-agent | P1 |
| **Quality-weighted leaderboard** (submissions x quality, not just count) | 08 (UI/UX), both design docs | P1 |
| **Photo capture overlay guides** (per-vertical framing) | 08 (UI/UX), gptdesign/field-agent | P2 |
| **Voice input for text fields** | 08 (UI/UX) | P2 |
| **Agent location pin + proximity bar on map** | 08 (UI/UX), gptdesign/field-agent | P2 |
| **Agent performance dashboard** (admin) | 08 (UI/UX), gptdesign/admin-review | P2 |
| **Client-facing dashboard shell** (separate from admin) | 07 (Marketing), 08 (UI/UX), gptdesign/client-delta | P2 |
| **Export workflow** (CSV/GeoJSON/PDF as first-class UI) | 08 (UI/UX), gptdesign/client-delta | P2 |
| **High-contrast mode toggle** in Settings | 08 (UI/UX) | P3 |
| **Touch target audit** (enforce 48dp minimums) | 08 (UI/UX), gptdesign/MASTER | P3 |
| **Keyboard shortcuts for admin review** | gptdesign/admin-review | P3 |
| **Nearby enrichment prompts** | 08 (UI/UX), gptdesign/field-agent | P3 |

---

## 2. Design System (Canonical Reference)

This section resolves conflicts between `/design` and `/gptdesign` and establishes one source of truth.

### 2.1 Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#0f2b46` | Headers, nav active, primary buttons |
| `accent` | `#f4c317` | Logo, highlights, premium |
| `cta` | `#c86b4a` | Action buttons (Contribute, Submit, Capture) |
| `success` | `#4c7c59` | Verified, synced, trust badges |
| `error` | `#c53030` | Fraud flags, sync failures, validation |
| `warning` | `#d69e2e` | Offline, pending, low battery |
| `info` | `#2b6cb0` | Tooltips, help text |
| `bg-page` | `#f9fafb` | Page backgrounds |
| `bg-card` | `#ffffff` | Card surfaces |
| `border` | `#e5e7eb` | Card borders, dividers |
| `text-primary` | `#1f2933` | Headings, primary content |
| `text-secondary` | `#6b7280` | Descriptions, metadata (minimum for outdoor readability) |
| `text-tertiary` | `#9ca3af` | Timestamps only (never for critical info outdoors) |

**Vertical colors** (from `verticals.ts`): Pharmacy `#2f855a`, Mobile Money `#0f2b46`, Fuel `#c86b4a`, Alcohol `#9b2c2c`, Billboard `#d69e2e`, Transport `#718096`, Census `#4a5568`.

### 2.2 Typography

```
Font:       Inter (loaded via Vite build)
Fallback:   -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif

Scale:
  Display     24px / 32px lh / font-extrabold (800)   Screen titles
  Heading     18px / 24px lh / font-bold (700)         Section headers
  Subheading  14px / 20px lh / font-semibold (600)     Card titles
  Body        14px / 20px lh / font-normal (400)       Descriptions
  Caption     12px / 16px lh / font-medium (500)       Metadata, labels
  Micro       10px / 14px lh / font-bold (700)         Badges, status (UPPERCASE, tracking-widest)

Rules:
  - Never use font-weight below 400 for outdoor-readable text
  - Body text minimum 14px (text-sm)
  - Line height minimum 1.4x font size
  - Full Latin Extended support for French accents
```

### 2.3 Spacing & Touch Targets

```
Spacing (Tailwind-aligned):
  xs    4px   (p-1)    Icon padding
  sm    8px   (p-2)    Inner card padding
  md    12px  (p-3)    Field spacing in forms
  base  16px  (p-4)    Card padding, section spacing
  lg    24px  (p-6)    Section separation
  xl    32px  (p-8)    Major section breaks
  safe  48px  (p-12)   Bottom safe area

Touch Targets:
  Minimum:      48x48dp (h-12 w-12) -- compensates for humidity/sweat
  Preferred:    56x56dp (h-14 w-14) -- CTA buttons
  Nav items:    64dp    (h-16)      -- current nav height (keep)
  Form fields:  44dp    (h-11)      -- minimum field height
  Gap between:  8dp minimum, 12dp preferred for forms
```

### 2.4 Icons

lucide-react only. No emoji in UI (emoji only in documentation). Existing vertical icon mapping in `VerticalIcon.tsx` is correct.

### 2.5 Motion & Haptics

```
Duration:    150ms (micro-interactions) to 300ms (transitions)
Easing:      ease-out for entrances, ease-in for exits
Respect:     prefers-reduced-motion media query
Haptic:      On capture shutter, queue sync, assignment start, fraud flag
```

### 2.6 Dark Mode

**Not for v1.** Rationale from research 08: sunlight readability is the priority for field agents working 7am-5pm under equatorial sun. Instead:
- Support system auto-brightness (do not override)
- Add high-contrast mode toggle in Settings (P3)
- Consider night capture mode in future for evening alcohol outlet agents

---

## 3. Role-Based Design Model

Three distinct user experiences sharing one codebase. Adapted from gptdesign/MASTER.md and research 08.

### 3.1 Field Agent (Mobile-First)

**Mental model:** "Walk up to a place, capture it, move on."
**Device:** Mid-range Android (Samsung A-series, Tecno, Infinix), 5.5-6.5" screen, 2-4GB RAM
**Constraints:** One-handed use, bright sunlight, sweaty fingers, intermittent connectivity, 30-60 POIs/day

**Primary surfaces:**
- Home (map + assignments + daily progress)
- Capture wizard (4 steps)
- Batch capture (rapid sequential)
- Submission queue (sync management)
- Profile (end-of-day review)

**Design rules (from gptdesign/field-agent.md):**
- One-hand completable on 6" Android
- Every step save-resilient to back navigation
- Photo + GPS before typing
- Main action always in bottom 60% of screen
- No fraud-scoring jargon -- translate to corrective guidance ("move closer", "retake in better light", "wait for GPS")
- Haptic only for milestones (capture, sync, level-up)

### 3.2 Admin Reviewer (Desktop-First, Mobile-Responsive)

**Mental model:** "Triage the queue, catch fraud, approve good data."
**Device:** Laptop (Chrome) primary, phone secondary
**Constraints:** Volume (50-200 reviews/day), cognitive fatigue from photo/GPS/metadata comparison

**Primary surfaces:**
- Review queue (split-panel on desktop)
- Assignment planner
- Agent performance metrics
- Delta intelligence

**Design rules (from gptdesign/admin-review.md):**
- Risk-first queue ordering (high risk at top)
- Desktop: three-area layout (queue | evidence | fraud summary + actions)
- Mobile: stacked with tabbed detail (Evidence, Fraud, History, Actions)
- Keyboard shortcuts: J=next, K=previous, A=approve, R=reject, H=hold
- Bulk approve for low-risk items
- Photo and GPS side-by-side on desktop

### 3.3 Client / Data Consumer (Desktop-First)

**Mental model:** "Show me what changed. Let me export it."
**Device:** Laptop primary, phone for quick checks
**Constraints:** Wants delta reports not raw data, needs presentation-ready visuals, one-click exports

**Primary surfaces:**
- Delta dashboard (report-style layout)
- Vertical-specific views
- Export/API panel

**Design rules (from gptdesign/client-delta.md):**
- Delta-first storytelling (what changed?) before raw totals
- Filters synchronized across map, charts, change feed, export
- Export defaults to exact current filter state
- Trust/confidence visible inline with every delta
- Desktop layout suitable for screenshots in presentations
- Mobile remains readable without attempting full desktop density

---

## 4. Implementation Plan (Ordered by Real Gaps)

### Phase 1: Field Workflow Visibility (P0)

**Goal:** Surface sync, queue, and assignment info throughout the field journey. Currently, agents must navigate to Profile to see sync errors and assignments.

#### 4.1.1 Persistent Sync Status Bar

**What:** Replace the offline-only amber banner (`App.tsx:257-261`) with an always-visible status bar below the header on all screens except Splash and Auth.

**States (canonical, resolving conflict between design docs):**

| State | Appearance | Content |
|---|---|---|
| All synced | Green dot, subtle text | `47 synced` + refresh icon |
| Syncing | Animated spinner | `Syncing 3 of 5...` + refresh icon |
| Offline + pending | Amber background | `HORS LIGNE - 5 en attente` + refresh icon |
| Failed submissions | Red background | `2 echecs - Appuyez pour voir` + refresh icon |

**Behavior:**
- 28dp height, sticky below header, does not scroll with content
- Tapping opens the Submission Queue screen
- Refresh icon triggers manual `flushOfflineQueue()`

**Implementation:**
- Create `components/SyncStatusBar.tsx`
- Modify `App.tsx`: replace offline banner, render SyncStatusBar on all screens except Splash/Auth
- Modify `lib/client/offlineQueue.ts`: add reactive state hook or event emitter for queue changes (currently exposes `getQueueStats()` which is already close)

#### 4.1.2 Submission Queue Screen

**What:** New user-facing screen to view and manage the offline queue. Currently queue stats exist in code (`getQueueStats()`, `listSyncErrorRecords()`) but have no dedicated UI -- sync errors only surface in Profile.

**Content:**
- Summary: pending count, synced count, failed count
- Force sync button
- Failed items section with error reason, [Retry] [Edit] [Delete] per item
- Pending items list with vertical icon, name, timestamp, GPS
- Storage usage bar (MB cached)

**Implementation:**
- Create `components/Screens/SubmissionQueue.tsx`
- Modify `types.ts`: add `Screen.SUBMISSION_QUEUE`
- Modify `App.tsx`: add routing for new screen
- Modify `Profile.tsx`: add link to submission queue (currently shows sync errors inline -- keep both, but add "View full queue" link)

#### 4.1.3 Assignment Card on Home Screen

**What:** Surface the current active assignment on the Home screen. Currently assignments are only visible in Profile.

**Content:**
- Zone name, assigned verticals
- Progress bar (X/Y points captured)
- Due date
- [Start Capture] CTA that opens ContributionFlow with assignment context prefilled
- Collapses when no active assignments

**Implementation:**
- Modify `components/Screens/Home.tsx`: add assignment card between vertical picker and map
- Reuse assignment data fetching logic from `Profile.tsx`

---

### Phase 2: Capture Enhancements (P0)

**Goal:** Add batch mode and improve post-capture feedback. The core wizard is already built -- these are additive features.

#### 4.2.1 Batch Capture Mode

**What:** Rapid sequential capture for dense commercial corridors. Not a separate screen -- a mode toggle within the capture flow.

**Activation:** Long-press the + FAB on Home, or toggle after first submission in ContributionFlow.

**Behavior:**
- Lock to one vertical for the batch session
- After each submission, camera resets immediately for next capture
- Only mandatory fields shown (createRequiredFields from `verticals.ts`)
- Each capture auto-saves to offline queue
- Counter shows batch progress (e.g., "Captured: 4")
- "End Batch" button to finish and return to Home
- All batch items appear in Submission Queue

**Implementation:**
- Modify `components/Screens/ContributionFlow.tsx`: add batch mode toggle, post-submit "Capture Next" flow
- Modify `components/Screens/Home.tsx`: add long-press handler on contribute FAB
- May extract `components/BatchCaptureHeader.tsx` for batch progress counter

#### 4.2.2 Post-Capture XP Feedback

**What:** After successful submission, show animated XP award instead of silently returning to Home.

**Content:**
- Checkmark animation
- XP breakdown: base + quality bonus + streak bonus = total
- Level progress bar
- Two CTAs: [+ Add Another] and [Back to Map]
- Sync status indicator for the just-submitted item

**Implementation:**
- Create `components/XPPopup.tsx`: reusable animated overlay
- Modify `components/Screens/ContributionFlow.tsx`: show XP feedback on successful submit before navigating away

#### 4.2.3 Daily Progress Widget on Home

**What:** Show today's capture stats and streak on Home to motivate agents.

**Content:**
- 4 stat boxes: submissions today, enrichments, avg quality %, streak days
- Daily target progress bar
- "X more to hit daily bonus" text

**Implementation:**
- Modify `components/Screens/Home.tsx`: add progress widget below assignment card
- Create `components/DailyProgressWidget.tsx`

---

### Phase 3: Gamification & Motivation (P1)

**Goal:** Make gamification visible throughout the journey, not just in Profile.

#### 4.3.1 Streak Tracker on Home

**What:** Daily streak visualization on Home screen.

**Content:**
- Streak count with fire icon
- 7-day dot grid (Mon-Sun, filled = submitted that day)
- Personal record
- Streak bonus: "+X XP per submission"

**Implementation:**
- Create `components/StreakTracker.tsx`
- Modify `Home.tsx`: add streak widget

#### 4.3.2 Quality-Weighted Leaderboard

**What:** Current leaderboard in Analytics ranks by XP/contribution count. Should rank by `submissions x quality_score` to prevent gaming.

**Formula:** `ranking_score = total_submissions * avg_quality_percent`

**Display changes:**
- Show formula: "67 sub x 94% qual = 6,298 pts"
- "Your Position" section with distance to next rank
- "Top by Vertical" breakdown

**Implementation:**
- Modify `components/Screens/Analytics.tsx`: update ranking formula and display
- Requires API support: leaderboard endpoint should return quality scores per agent

#### 4.3.3 Achievement Badge Display Enhancement

**What:** Currently badges are a count in Profile. Add visual badge grid with unlock criteria.

**Badges (from research 08):**
- First Steps (1st submission)
- Explorer (3 different zones)
- Specialist (50 in one vertical)
- Quality Star (10 consecutive >90% quality)
- Rain Walker (submit during June-Oct rainy season)
- Streak Master (14-day streak)
- Urban Validator (100 total)
- Data Champion (500 total)
- Trust Elite (95%+ trust for 4 weeks)

**Implementation:**
- Modify `Profile.tsx`: expand badge section from count to visual grid

---

### Phase 4: Admin & Review Optimization (P1-P2)

The admin queue already has split-panel with fraud detection. These are refinements.

#### 4.4.1 Risk-First Queue Ordering

**What:** Ensure high-risk items appear first in the queue, not chronologically.

**Order:** High risk (fraud score >50) --> Pending review --> Needs additional evidence --> Low-risk (ready for bulk action)

**Implementation:**
- Modify `AdminQueue.tsx`: sort queue by fraud score descending, add risk-level filter tabs [All] [Flagged] [Pending] [Low Risk]

#### 4.4.2 Bulk Approve for Low-Risk Items

**What:** Select all low-risk items and approve in one action.

**Content:**
- "Select All Low-Risk (N)" button
- Approve Selected button
- Confirmation modal for bulk actions

**Implementation:**
- Modify `AdminQueue.tsx`: add bulk selection and approval UI

#### 4.4.3 Keyboard Shortcuts for Desktop Review

**What:** Speed up admin review on desktop with keyboard navigation.

**Shortcuts:**
- `J` = next item, `K` = previous item
- `A` = approve, `R` = reject, `H` = hold
- `E` = focus evidence panel

**Implementation:**
- Modify `AdminQueue.tsx`: add `useEffect` for `keydown` event listeners (desktop only)

#### 4.4.4 Agent Performance Screen (New)

**What:** Admin-only dashboard showing team performance metrics.

**Content:**
- Team overview: active agents, total submissions, avg quality, fraud rate
- Agent table: name, submissions count, quality %, fraud flags, status indicator
- Quality metrics: EXIF rate, GPS accuracy, completeness, unique photos
- Click agent name for individual detail view

**Implementation:**
- Create `components/Screens/AgentPerformance.tsx`
- Modify `types.ts`: add `Screen.AGENT_PERFORMANCE`
- Modify `App.tsx`: add routing
- Modify `Analytics.tsx`: add link for admin users

---

### Phase 5: Client Dashboard & Exports (P2)

#### 4.5.1 Export Workflow Enhancement

**What:** Currently DeltaDashboard shows data but lacks structured export. Add first-class export panel.

**Content:**
- Format selector: CSV, GeoJSON, PDF Report
- Scope controls: vertical, area, period
- Include toggles: current snapshot, delta, photo URLs, confidence threshold
- API endpoint preview with copy button
- Export defaults to current filter state

**Implementation:**
- Modify `DeltaDashboard.tsx`: add export panel section
- Create `components/ExportPanel.tsx`: reusable export configuration UI
- May need API endpoint for export generation (`/api/export`)

#### 4.5.2 Client-Facing Dashboard (Future)

**What:** Separate dashboard shell for paying data consumers. Not needed for pilot but designed for post-pilot.

**Layout (from gptdesign/client-delta.md):**
1. Header (scope, last updated, export actions)
2. KPI strip (total, new, removed, changed, confidence, anomalies)
3. Two-column: interactive map + delta summary with anomaly callouts
4. Trend charts and breakdown
5. Change feed and export panel

**Responsive breakpoints:**
- 1280px+: full report with side export panel
- 768-1279px: stacked with collapsible export
- <768px: narrative mobile with sticky filter bar

**Implementation:** Deferred to post-pilot. Use DeltaDashboard as foundation.

---

### Phase 6: UI Polish & Accessibility (P3, Ongoing)

#### 4.6.1 Touch Target Audit

Audit every interactive element against 48dp minimum. Key areas to fix:
- Form field heights (enforce h-11 minimum)
- Icon-only buttons (enforce h-12 w-12 minimum)
- Gaps between adjacent tappable elements (8dp minimum)

#### 4.6.2 Contrast & Readability

- Replace all `text-gray-400` usage for readable text with `text-gray-500` minimum
- Verify WCAG AA (4.5:1) on all text/background combinations
- Add high-contrast mode toggle in Settings (bold all text, pure black on white)

#### 4.6.3 Photo Capture Overlay Guides

Per-vertical semi-transparent overlay frames during photo capture:

| Vertical | Overlay | Guidance (FR/EN) |
|---|---|---|
| Pharmacy | Rectangle with label zone at top | "Capturez la croix verte et la facade" / "Capture the green cross and storefront" |
| Mobile Money | Rectangle with provider logo zone | "Incluez le logo MTN/Orange" / "Include MTN/Orange branding" |
| Fuel Station | Wide landscape frame | "Capturez le logo et les pompes" / "Capture brand logo and pumps" |
| Alcohol | Standard storefront frame | "Montrez l'enseigne et l'entree" / "Show business sign and entrance" |
| Billboard | Landscape with aspect ratio guide | "Capturez tout le panneau" / "Capture full billboard face" |
| Transport Road | Wide landscape guide | "Capturez la surface et tout blocage" / "Capture road surface and blockage" |
| Census | Tall building frame | "Capturez du sol au toit" / "Capture ground to roof" |

#### 4.6.4 Voice Input for Text Fields

Add microphone button next to name/text input fields using Web Speech API.
- Language: `fr-CM` (French, Cameroon)
- Fallback: keyboard-only with helper text when Speech API unavailable
- Note: requires connectivity (not available offline)

---

## 5. New Files to Create

| File | Phase | Description |
|---|---|---|
| `components/SyncStatusBar.tsx` | 1 | Persistent sync status bar (4 states) |
| `components/Screens/SubmissionQueue.tsx` | 1 | User-facing queue management screen |
| `components/XPPopup.tsx` | 2 | Animated post-capture XP award overlay |
| `components/DailyProgressWidget.tsx` | 2 | Today's stats + target progress |
| `components/StreakTracker.tsx` | 3 | 7-day streak visualization |
| `components/Screens/AgentPerformance.tsx` | 4 | Admin agent metrics dashboard |
| `components/ExportPanel.tsx` | 5 | Reusable export configuration UI |

**Total: 7 new files** (down from 11 in the prior REDESIGN-PLAN.md because the codebase already has more than was assumed).

## 6. Existing Files to Modify

| File | Phase | Changes |
|---|---|---|
| `App.tsx` | 1 | Replace offline banner with SyncStatusBar, add SubmissionQueue + AgentPerformance routing |
| `types.ts` | 1, 4 | Add `Screen.SUBMISSION_QUEUE`, `Screen.AGENT_PERFORMANCE` |
| `components/Screens/Home.tsx` | 1, 2, 3 | Add assignment card, daily progress widget, streak tracker, long-press FAB for batch |
| `components/Screens/ContributionFlow.tsx` | 2 | Add batch mode toggle, post-submit XP feedback, photo overlay guides |
| `components/Screens/Profile.tsx` | 1, 3 | Add submission queue link, expand badge display to visual grid |
| `components/Screens/Analytics.tsx` | 3, 4 | Quality-weighted leaderboard formula, link to AgentPerformance |
| `components/Screens/AdminQueue.tsx` | 4 | Risk-first sorting, bulk approve, keyboard shortcuts |
| `components/Screens/DeltaDashboard.tsx` | 5 | Add export panel |
| `components/Screens/HomeMap.tsx` | 6 | Agent location pin, proximity bar (P3) |
| `lib/client/offlineQueue.ts` | 1 | Add reactive queue state hook or event emitter |

**Total: 10 files to modify.**

---

## 7. Implementation Sequence

```
PHASE 1: Field Workflow Visibility (Week 1-2)          [P0]
  1.1  SyncStatusBar component
  1.2  SubmissionQueue screen
  1.3  Assignment card on Home
  1.4  offlineQueue reactive stats

PHASE 2: Capture Enhancements (Week 2-3)               [P0]
  2.1  Batch capture mode in ContributionFlow
  2.2  Post-capture XP feedback (XPPopup)
  2.3  Daily progress widget on Home

PHASE 3: Gamification & Motivation (Week 3-4)          [P1]
  3.1  Streak tracker on Home
  3.2  Quality-weighted leaderboard in Analytics
  3.3  Badge grid expansion in Profile

PHASE 4: Admin Optimization (Week 4-5)                 [P1-P2]
  4.1  Risk-first queue ordering
  4.2  Bulk approve for low-risk
  4.3  Keyboard shortcuts (desktop)
  4.4  Agent performance screen

PHASE 5: Client Exports (Week 5-6)                     [P2]
  5.1  Export panel on DeltaDashboard

PHASE 6: Polish (Ongoing)                              [P3]
  6.1  Touch target audit
  6.2  Contrast / readability fixes
  6.3  Photo overlay guides
  6.4  Voice input
  6.5  Agent location + proximity on map
```

---

## 8. Responsive Breakpoints (Canonical)

| Breakpoint | Field Agent | Admin | Client |
|---|---|---|---|
| 360-430px | Single column, default view | Stacked queue + tabbed detail | Narrative scroll |
| 431-767px | Wider cards, same layout | Stacked with larger touch targets | Stacked charts |
| 768-1023px | Constrained mobile canvas | Two-panel (queue + detail) | Stacked with collapsible export |
| 1024px+ | N/A (field agents use mobile) | Three-area (queue + evidence + actions) | Full report with side export panel |

---

## 9. Success Metrics

| Metric | Current (Estimated) | Target | How to Measure |
|---|---|---|---|
| Avg. capture time per POI | ~60s (wizard exists) | 35s | Time from ContributionFlow open to submit |
| Taps per new POI | ~8-10 | 5-6 | Step count through wizard |
| Daily submissions per agent | 30-40 | 50-60 | Backend submission count per agent per day |
| Avg. submission quality score | ~80% | 90%+ | Confidence score from `submissionFraud.ts` |
| Agent streak retention | Unknown | 70% maintain 5+ day streaks | Profile data |
| Admin review throughput | ~80/day | 150+/day | With bulk approve + keyboard shortcuts |
| Sync failure rate | Unknown | <2% | `offlineQueue.ts` stats |
| Time from capture to sync | Variable | <5 min when online | Queue flush timing |

---

## 10. Decisions & Rationale Log

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Sync bar height | 28dp | 36dp, 44dp | Minimal vertical space on 5.5" screens |
| Admin layout | 3-area split (gptdesign) | 2-panel (design/) | More evidence density for fraud review |
| Leaderboard ranking | submissions x quality | XP only, submissions only | Prevents gaming, rewards quality (research 08, 06) |
| Dark mode | Not in v1 | Full dark mode | Sunlight readability is priority (research 08) |
| Batch capture | Mode within ContributionFlow | Separate screen | Reuses existing wizard code, less duplication |
| Voice input | Web Speech API | On-device ML | Simpler, no model download, acceptable online-only limitation |
| Photo overlays | Semi-transparent guide frames | AR markers | Simpler to implement, works on low-end devices |
| Queue management | Dedicated screen | Modal/drawer | More space for error details and retry actions |
| Client dashboard | Deferred to post-pilot | Build now | Pilot focus is field capture + admin review (research 09) |

---

## 11. Alignment with Pilot Timeline (Research 09)

The 6-week pilot runs April 14 - May 22, 2026. UI work must be ready before Week 1 Day 1.

| Pilot Week | What Agents Need | UI Phase Required |
|---|---|---|
| Pre-pilot (Mar-Apr) | Build and test all UI changes | Phases 1-3 complete |
| Week 1 (Apr 14-18) | Capture baseline 400+ POIs | Sync bar, batch mode, assignment card |
| Week 2 (Apr 21-25) | First delta cycle, enrichment | XP feedback, daily progress, queue screen |
| Week 3 (Apr 28-May 2) | Data sample for clients | Export panel, streak tracker |
| Week 4 (May 5-9) | Client pitch meetings | Delta dashboard exports, leaderboard |
| Week 5 (May 12-16) | Client outreach | Client-ready dashboard polish |
| Week 6 (May 19-22) | Final assessment, audit | All polish items, touch target audit |
