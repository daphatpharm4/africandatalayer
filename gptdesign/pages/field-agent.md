# ADL GPTDesign Override: Field Agent

> This file overrides `gptdesign/MASTER.md` for the contributor-facing mobile experience.

---

## Current State

- `Home.tsx` already provides a usable map/list explorer, a vertical picker, a floating toggle, and a floating contribute button.
- `ContributionFlow.tsx` contains substantial capture logic, offline queue integration, EXIF extraction, dedup checks, and many vertical-specific fields, but the UX is a long, branching, single-screen form.
- `Profile.tsx` already exposes assignments, XP, trust score, badges, history, and sync errors.
- The current field app is operationally capable, but the “day in the field” path is fragmented across Home, Contribute, and Profile.

---

## Pain Points

- Home does not answer the first question of the workday: “What should I capture next?”
- Sync state is not prominent enough for agents dealing with intermittent connectivity.
- The contribution flow asks for too much context at once and relies on scrolling memory.
- Queue visibility and sync recovery exist, but too late in the journey.
- The app rewards activity, but the motivation loop is not connected tightly enough to the capture moment.

---

## Target Layout

### Home / Explorer

Top-to-bottom order:

1. Header with role label, map lock state, and profile shortcut
2. Persistent sync/system bar
3. Vertical selector
4. Current assignment card
5. Daily progress and streak widget
6. Map or list content
7. Nearby enrichment strip
8. Floating view toggle and capture FAB

Home intent:

- Make the next capture obvious.
- Make queue and sync confidence visible before the agent moves.
- Preserve the current map/list paradigm rather than replacing it.

### Map and list behavior

- Keep map as the default on capable devices, list as default on low-end devices.
- Add an agent location marker and assignment zone overlay.
- Add a “nearby needs enrichment” strip anchored above the bottom nav.
- In list mode, elevate freshness and trust state above secondary metadata.

### Capture wizard

Replace the current long form with four explicit steps:

1. `Select vertical`
2. `Capture photo + GPS`
3. `Essential details`
4. `Review + save`

Rules:

- In enrich mode, skip step 1 and prefill from the seed point.
- Only required fields appear by default.
- Optional enrich fields live behind an explicit “More details” affordance.
- Show step progress in the sticky header at all times.

### Batch capture mode

Activation:

- Long-press the capture FAB from Home
- Toggle from within the capture wizard after the first successful save

Behavior:

- Locks to one vertical until ended
- Preserves camera-first flow
- Saves each item to the offline queue immediately
- Prompts only for quick fields between captures

### Queue and profile

- Add a dedicated “Submission Queue” entry just below the Home sync bar.
- Keep the full queue review, sync errors, assignments, rewards, and trust dashboard in Profile.
- Profile becomes the day-summary and recovery surface, not the first place users discover an issue.

---

## Key Components

### Persistent system bar

- Height: compact, always visible
- Contents: sync state, queued count, failed count, refresh action
- Tap action: open queue review

### Assignment card

- Zone label
- due date
- expected vs submitted count
- progress bar
- assigned verticals
- primary action: `Start Capture`

### Daily progress widget

- submissions today
- enrichments today
- quality score
- current streak
- bonus target remaining

### Capture guidance frame

- Camera overlay for framing signage/building
- live GPS and accuracy
- quality prompts before save
- explicit fallback states when EXIF or GPS confidence is weak

### Review and save card

- photo thumbnail
- location summary
- key fields summary
- offline save confirmation
- immediate next actions:
  - `Save & Finish`
  - `Save & Next`
  - `Retry Photo`

---

## Interaction Rules

- Primary capture path must be completable with one hand on a 6-inch Android device.
- Every step save is resilient to accidental back navigation.
- Photo and GPS collection happen before detailed typing.
- Use haptic feedback only for meaningful milestones:
  - photo captured
  - saved offline
  - synced successfully
  - quality warning acknowledged
- Keep the main field action within the bottom 60% of the screen.
- Do not show raw fraud-scoring language to contributors. Translate it into corrective guidance such as:
  - `Move closer to the storefront`
  - `Retake the photo in better light`
  - `Wait for stronger GPS accuracy`

### Wizard field policy

- Required fields first
- Suggested fields second
- Optional enrich fields last
- Vertical defaults should be aggressively prefilled from:
  - assignment context
  - previous capture in batch mode
  - existing point data in enrich mode

---

## Responsive Behavior

- `360px-430px`: default field layout, single-column, bottom-priority controls
- `431px-767px`: same IA, slightly wider cards and two-column quick-field groupings where safe
- `768px+`: use a constrained mobile canvas for field flows; do not redesign the field experience into a desktop form

Low-end handling:

- Default to list mode on low-end devices
- Minimize concurrent animations
- Keep image guidance lightweight

---

## Acceptance Criteria

- Home shows sync state and the next assignment without entering Profile.
- A contributor can begin capture from Home with the vertical and assignment context prefilled.
- The capture flow is step-based and no longer requires one long scrolling form.
- Batch mode exists and supports repeated save-and-next capture.
- Queue and sync recovery are reachable from Home and fully reviewable in Profile.
- Daily target, streak, XP, and quality feedback are visible in the field journey rather than only after the fact.
