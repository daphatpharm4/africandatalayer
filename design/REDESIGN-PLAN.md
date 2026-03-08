# ADL App Redesign Plan

## From Current State to Field-Optimized PWA

**Based on:** `research/08-ui-ux-design-research.md` (Teammate 8 -- UI/UX Designer Deliverable)
**Date:** March 2026

---

## 1. Executive Summary

The current ADL app is a functional React PWA with solid foundations: map + list home screen, contribution flow, offline queue, bilingual support, and admin tools. The redesign focuses on **field optimization** -- making the app faster, more reliable, and less fatiguing for agents capturing 30-60 POIs per day in Douala's heat and humidity.

**Key redesign themes:**
1. Reduce capture friction (long form --> 4-step wizard)
2. Make sync status omnipresent (not just offline banner)
3. Add batch capture mode for dense commercial areas
4. Improve touch targets and sunlight readability
5. Surface gamification throughout the app (not siloed in Profile)
6. Optimize admin review for high-volume processing

---

## 2. Current App Audit

### 2.1 Existing Screen Architecture

```
Screens (from App.tsx):
  Splash --> Home (Map + List) --> Details --> ContributionFlow
                |
                |-- Analytics/Leaderboard
                |-- Profile --> Settings
                |            |-- RewardsCatalog
                |            +-- QualityInfo
                |-- Auth
                |-- AdminQueue (admin only)
                +-- DeltaDashboard (admin only)

Bottom Nav: [Explore] [Contribute] [Impact] [Profile]
Hidden during: Splash, Auth, Contribute
```

### 2.2 What Works Well (Keep As-Is)

| Element | File | Why It Works |
|---|---|---|
| Map + list toggle on Home | `Home.tsx` | Map-first thinking matches field agent mental model |
| Bottom nav with 4 tabs | `Navigation.tsx` | Simple, thumb-reachable, correct tab count |
| Vertical-specific icons | `VerticalIcon.tsx` | Language-independent, visually distinct per vertical |
| Brand color palette | Throughout | Navy/gold/terracotta/green is strong and distinctive |
| Bilingual EN/FR `t()` helper | `App.tsx` | Clean pattern, used consistently |
| Lazy-loaded screens | `App.tsx` | Good for performance on mid-range devices |
| Offline queue with flush | `offlineQueue.ts` | Event-sourced offline support is solid |
| EXIF extraction on capture | `ContributionFlow.tsx` | Already using `exifr` for GPS validation |
| Error boundary wrapper | `ErrorBoundary.tsx` | Prevents full app crashes |

### 2.3 What Needs Redesign

| Problem | Current State | Impact |
|---|---|---|
| **Single-page capture form** | `ContributionFlow.tsx` is one long scrollable form | Cognitive overload, slow in field, error-prone |
| **Offline banner only** | Amber bar shown only when offline (`App.tsx:257-261`) | Agents don't know sync status when online |
| **No batch capture** | Each POI requires full flow restart | Slow in dense commercial corridors |
| **Small touch targets** | Some buttons below 48dp minimum | Hard to tap with sweaty fingers or while walking |
| **Gamification siloed** | XP/badges only visible in Profile screen | No in-flow motivation or feedback |
| **No submission queue UI** | Queue exists in code but no user-facing screen | Agents can't see or manage pending submissions |
| **No assignment system UI** | No way to see assigned zones or targets | Agents lack direction and daily goals |
| **Admin queue is mobile-only** | `AdminQueue.tsx` single-column layout | Desktop reviewers can't use split-panel workflow |
| **No proximity awareness** | Map doesn't highlight nearby POIs needing enrichment | Missed enrichment opportunities in the field |

---

## 3. Redesign Plan -- Phase by Phase

### Phase 1: Capture Flow Overhaul (High Priority)

**Goal:** Reduce average capture time from ~90s to ~35s per POI.

#### 3.1.1 Convert ContributionFlow to Step-Based Wizard

**Current:** Single scrollable form in `ContributionFlow.tsx` with all fields visible.

**New:** 4-step wizard with progress indicator.

```
Step 1: Vertical Select (CREATE mode only)
  - 7 large tap targets (2-column grid, 80x80dp each)
  - Vertical icon + French label
  - Skip this step entirely for ENRICH mode

Step 2: Photo Capture
  - Full-screen camera viewfinder
  - Overlay guide frame (vertical-specific)
  - Live GPS readout with accuracy dots
  - 72dp shutter button in thumb zone
  - GPS confidence indicator (dots, not numbers)

Step 3: Essential Fields (3 fields max)
  - Photo thumbnail + GPS lock confirmation at top
  - Only `createRequiredFields` for the selected vertical
  - Binary toggles instead of dropdowns where possible
  - Progressive disclosure: "+ More fields (optional)" collapsed section
  - Voice input button next to text fields

Step 4: Review & Submit
  - Summary card with all captured data
  - Quality score preview (GPS accuracy, photo quality, completeness)
  - Estimated XP award
  - Full-width 56dp submit button
```

**Files to modify:**
- `components/Screens/ContributionFlow.tsx` -- Major refactor into wizard steps
- May extract sub-components: `CaptureStep1Vertical.tsx`, `CaptureStep2Photo.tsx`, `CaptureStep3Fields.tsx`, `CaptureStep4Review.tsx`

#### 3.1.2 Post-Submit Confirmation Screen

**New addition** at end of ContributionFlow:

```
- Success animation (checkmark)
- XP award with breakdown (base + quality bonus + streak bonus)
- Level progress bar
- Two CTAs: [+ Add Another] and [Back to Map]
- Sync status indicator (queued / synced)
```

#### 3.1.3 Batch Capture Mode

**New feature** accessible via long-press on + FAB or toggle in ContributionFlow.

```
Behavior:
- Lock to one vertical for the session
- Camera stays active between captures
- Only Level 1 (mandatory) fields shown inline
- Each capture auto-saves to offline queue
- Counter shows batch progress
- "End Batch" button to finish
- All batch items reviewable in Submission Queue before sync
```

**Files to create:**
- `components/Screens/BatchCapture.tsx`

**Files to modify:**
- `App.tsx` -- Add BatchCapture screen to router
- `types.ts` -- Add `Screen.BATCH_CAPTURE`
- `Navigation.tsx` -- Long-press handler on Contribute tab

---

### Phase 2: Sync & Status Visibility (High Priority)

#### 3.2.1 Always-Visible Sync Status Bar

**Current:** Only an amber bar when offline (`App.tsx:257-261`).

**New:** A persistent 28dp bar below the header on all screens (except Splash/Auth).

```
4 states:
1. ONLINE, ALL SYNCED   -> Green dot, "47 synced" (subtle)
2. ONLINE, SYNCING      -> Animated spinner, "Syncing 3 of 5..."
3. OFFLINE, PENDING     -> Amber background, "HORS LIGNE - 5 en attente"
4. ERROR, FAILED        -> Red background, "2 echecs - Appuyez pour voir"

Tapping the bar opens the Submission Queue screen.
```

**Files to create:**
- `components/SyncStatusBar.tsx`

**Files to modify:**
- `App.tsx` -- Replace offline-only banner with SyncStatusBar, pass queue stats as props
- `lib/client/offlineQueue.ts` -- Expose reactive queue stats (pending/synced/failed counts)

#### 3.2.2 Submission Queue Screen

**New screen** accessible by tapping the sync status bar or from Profile.

```
Content:
- Sync status summary (pending, synced, failed counts)
- "Force Sync" button
- Failed items with error details + [Retry] [Edit] [Delete] actions
- Pending items list with timestamps
- Storage usage indicator (MB cached / limit)
```

**Files to create:**
- `components/Screens/SubmissionQueue.tsx`

**Files to modify:**
- `App.tsx` -- Add screen routing
- `types.ts` -- Add `Screen.SUBMISSION_QUEUE`

---

### Phase 3: Home Screen Enhancements (Medium Priority)

#### 3.3.1 Today's Assignments Card

**New widget** on Home screen, below the vertical picker.

```
Content:
- Current active assignment with zone name
- Progress bar (X/Y points captured)
- Due date
- [Start Capture] CTA
- Collapses when no active assignments
```

**Files to modify:**
- `components/Screens/Home.tsx` -- Add assignment card component above map

#### 3.3.2 Daily Progress Widget

**New widget** on Home screen.

```
Content:
- 4 stat boxes: submissions today, enrichments, avg quality %, streak days
- Daily target progress bar
- "X more to hit daily bonus" motivational text
```

**Files to modify:**
- `components/Screens/Home.tsx` -- Add daily stats section

#### 3.3.3 Map Improvements

**Refinements** to existing map in `HomeMap.tsx`.

```
Additions:
- Agent location pin with accuracy circle
- Proximity bar at bottom: "3 pharmacies within 200m, 1 needs enrichment"
- Color intensity: darker markers for stale data, brighter for fresh
- Assignment zone overlay (shaded polygon)
```

**Files to modify:**
- `components/Screens/HomeMap.tsx` -- Add agent location, proximity bar, zone overlay

---

### Phase 4: Gamification Integration (Medium Priority)

#### 3.4.1 In-Flow XP Awards

**Current:** XP only visible in Profile.

**New:** XP feedback woven into capture flow.

```
Touchpoints:
1. Post-capture: animated "+5 XP" popup with level progress
2. Quality bonus: "+2 XP quality bonus" breakdown
3. Streak bonus: "+1 XP streak bonus" for consecutive days
4. Level-up: full-screen celebration with unlock notification
```

**Files to modify:**
- `components/Screens/ContributionFlow.tsx` -- Add XP animation to post-submit
- Create `components/XPPopup.tsx` for reusable XP award animation

#### 3.4.2 Streak Tracker on Home Screen

```
Content:
- Fire icon with streak count
- 7-day dot grid (Mon-Sun)
- Personal record
- Streak bonus multiplier
```

**Files to modify:**
- `components/Screens/Home.tsx` -- Add streak widget

#### 3.4.3 Quality-Weighted Leaderboard

**Current:** `Analytics.tsx` shows leaderboard.

**New:** Ranking formula = `submissions x quality_score` (not just count).

```
Additions:
- Clear formula display: "67 sub x 94% qual = 6,298 pts"
- "Your Position" section with distance to next rank
- Top by Vertical breakdown
```

**Files to modify:**
- `components/Screens/Analytics.tsx` -- Update ranking logic and display

---

### Phase 5: Admin & Client Dashboards (Lower Priority)

#### 3.5.1 Split-Panel Admin Queue (Desktop)

**Current:** `AdminQueue.tsx` is single-column, mobile-only layout.

**New:** Responsive split-panel on desktop (>768px).

```
Left panel: Scrollable review queue with filters
  - Filter tabs: [All] [Flagged] [Pending]
  - Dropdowns: Date, Vertical, Agent
  - Submission cards with fraud score bars
  - Bulk select for low-risk items

Right panel: Detail view for selected submission
  - Photo evidence + map side-by-side
  - Fraud analysis breakdown (GPS match, EXIF, photo hash, velocity)
  - Agent history and trust score
  - Action buttons: [Approve] [Reject] [Hold] [Comment]
```

**Files to modify:**
- `components/Screens/AdminQueue.tsx` -- Add responsive split-panel layout

#### 3.5.2 Enhanced Delta Dashboard

**Current:** `DeltaDashboard.tsx` exists with basic delta view.

**New additions:**
- Period selector (week picker with prev/next)
- Net change summary card (+new, -closed)
- Per-vertical progress bars with coverage %
- Export buttons: [CSV] [PDF] [GeoJSON] [API Link]

**Files to modify:**
- `components/Screens/DeltaDashboard.tsx` -- Add period selector, export options

#### 3.5.3 Agent Performance Dashboard (Admin)

**New screen** for admin users.

```
Content:
- Team overview: active agents, total submissions, avg quality, fraud rate
- Agent table: name, submissions, quality %, flags, status icon
- Quality metrics: EXIF rate, GPS accuracy, completeness, unique photos
- Tap agent name for individual detail view
```

**Files to create:**
- `components/Screens/AgentPerformance.tsx`

---

### Phase 6: UI Polish & Accessibility (Ongoing)

#### 3.6.1 Touch Target Audit

Every interactive element must meet minimum sizes:

| Element | Current | Target |
|---|---|---|
| Navigation tab buttons | h-16 (64dp) | h-16 (keep) |
| Form field inputs | varies | h-11 min (44dp) |
| CTA buttons (Submit, Capture) | varies | h-14 (56dp) |
| Icon buttons | varies | h-12 w-12 min (48dp) |
| Gap between touch targets | varies | 8dp minimum |

#### 3.6.2 Sunlight Readability

- Audit all text for WCAG AA contrast (4.5:1 minimum)
- Replace `text-gray-400` (#9ca3af) with `text-gray-500` (#6b7280) minimum for any readable text
- Add high-contrast mode toggle in Settings (bold all text, pure black on white)
- Ensure nav icons use 20px minimum (currently correct)

#### 3.6.3 Typography Consistency

```
Scale to enforce:
  Display:    text-2xl (24px) font-extrabold  -- Screen titles
  Heading:    text-lg (18px) font-bold         -- Section headers
  Subheading: text-sm (14px) font-semibold     -- Card titles
  Body:       text-sm (14px) font-normal       -- Descriptions
  Caption:    text-xs (12px) font-medium       -- Metadata
  Micro:      text-[10px] font-bold uppercase tracking-widest -- Badges
```

#### 3.6.4 Photo Capture Overlay Guides

Per-vertical camera overlay frames:

| Vertical | Overlay | Guidance Text |
|---|---|---|
| Pharmacy | Rectangle with label zone at top | "Capture the green cross sign and full storefront" |
| Mobile Money | Rectangle with provider logo zone | "Include the MTN/Orange branding visible" |
| Fuel Station | Wide landscape frame | "Capture the brand logo and pump area" |
| Alcohol | Standard storefront frame | "Show the business sign and entrance" |
| Billboard | Landscape rectangle with aspect ratio guide | "Capture the full billboard face including frame" |
| Transport Road | Landscape wide-angle guide | "Capture the road surface and any blockage" |
| Census | Tall building frame | "Capture the full building from ground to roof" |

---

## 4. Design System Formalization

### 4.1 Color Palette (Existing -- Formalized)

**Primary:**
| Role | Hex | Usage |
|---|---|---|
| Navy (Brand) | `#0f2b46` | Headers, primary buttons, nav active |
| Gold (Accent) | `#f4c317` | Logo, highlights, premium features |
| Terracotta (CTA) | `#c86b4a` | Action buttons, urgent indicators |
| Forest Green (Success) | `#4c7c59` | Success states, verified, sync complete |

**Semantic:**
| Role | Hex | Usage |
|---|---|---|
| Error Red | `#c53030` | Fraud flags, sync failures |
| Warning Amber | `#d69e2e` | Offline banner, pending review |
| Info Blue | `#2b6cb0` | Tooltips, help text |

### 4.2 Component Library Priorities

New shared components to build:

1. `SyncStatusBar` -- Always-visible sync indicator
2. `StepWizard` -- Reusable step-based form container
3. `BinaryToggle` -- Large yes/no toggle (replaces dropdowns)
4. `XPPopup` -- Animated XP award overlay
5. `QualityScore` -- Dot-based quality indicator (not numbers)
6. `VoiceInput` -- Microphone button with Web Speech API
7. `PhotoOverlay` -- Vertical-specific camera guide frame
8. `StreakTracker` -- Daily streak visualization
9. `ProgressCard` -- Assignment/target progress with bar

### 4.3 No Dark Mode (v1)

Per research recommendation: sunlight readability is the priority. Dark mode is harder to read under equatorial sun. Instead:
- Support system auto-brightness
- Add high-contrast mode toggle
- Consider night capture mode in a future version for evening alcohol outlet agents

---

## 5. Implementation Priority & Sequencing

```
PHASE 1 (Weeks 1-3): Capture Flow Overhaul
  [1.1] Wizard-based ContributionFlow
  [1.2] Post-submit confirmation with XP
  [1.3] Batch capture mode

PHASE 2 (Weeks 2-4): Sync & Status
  [2.1] SyncStatusBar component
  [2.2] Submission Queue screen

PHASE 3 (Weeks 3-5): Home Screen
  [3.1] Assignment card
  [3.2] Daily progress widget
  [3.3] Map proximity + agent location

PHASE 4 (Weeks 4-6): Gamification
  [4.1] In-flow XP awards
  [4.2] Streak tracker
  [4.3] Quality-weighted leaderboard

PHASE 5 (Weeks 5-7): Admin/Client
  [5.1] Split-panel admin queue
  [5.2] Enhanced delta dashboard
  [5.3] Agent performance screen

PHASE 6 (Ongoing): Polish
  [6.1] Touch target audit
  [6.2] Contrast/readability fixes
  [6.3] Typography consistency
  [6.4] Photo overlay guides
```

---

## 6. Files Impact Summary

### New Files to Create
| File | Phase | Description |
|---|---|---|
| `components/SyncStatusBar.tsx` | 2 | Always-visible sync bar |
| `components/XPPopup.tsx` | 4 | Animated XP award |
| `components/VoiceInput.tsx` | 1 | Web Speech API input |
| `components/PhotoOverlay.tsx` | 1 | Camera guide frames |
| `components/BinaryToggle.tsx` | 1 | Yes/No toggle |
| `components/QualityScore.tsx` | 1 | Dot-based quality display |
| `components/StreakTracker.tsx` | 4 | Daily streak widget |
| `components/ProgressCard.tsx` | 3 | Assignment progress |
| `components/Screens/SubmissionQueue.tsx` | 2 | Queue management screen |
| `components/Screens/BatchCapture.tsx` | 1 | Batch mode screen |
| `components/Screens/AgentPerformance.tsx` | 5 | Admin agent metrics |

### Existing Files to Modify
| File | Phase | Changes |
|---|---|---|
| `components/Screens/ContributionFlow.tsx` | 1 | Major refactor to wizard steps |
| `App.tsx` | 1,2 | Add new screens, replace offline banner |
| `types.ts` | 1,2 | Add new Screen enum values |
| `components/Navigation.tsx` | 1 | Long-press handler for batch mode |
| `components/Screens/Home.tsx` | 3,4 | Add assignment card, stats, streak |
| `components/Screens/HomeMap.tsx` | 3 | Agent location, proximity, zones |
| `components/Screens/Analytics.tsx` | 4 | Quality-weighted leaderboard |
| `components/Screens/AdminQueue.tsx` | 5 | Responsive split-panel layout |
| `components/Screens/DeltaDashboard.tsx` | 5 | Period selector, exports |
| `components/Screens/Profile.tsx` | 2 | Link to submission queue |
| `lib/client/offlineQueue.ts` | 2 | Expose reactive queue stats |

---

## 7. Success Metrics

| Metric | Current (Est.) | Target |
|---|---|---|
| Avg. capture time per POI | ~90 seconds | 35 seconds |
| Taps per new POI submission | ~12-15 | 5-6 |
| Daily submissions per agent | 30-40 | 50-60 |
| Submission quality score | ~75% | 90%+ |
| Agent daily streak retention | Unknown | 70% maintain 5+ day streaks |
| Admin review throughput | ~50/day | 150+/day (with bulk approve) |
| Failed sync rate | Unknown | < 2% |
