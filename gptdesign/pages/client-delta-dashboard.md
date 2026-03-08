# ADL GPTDesign Override: Client Delta Dashboard

> This file overrides `gptdesign/MASTER.md` for the client-facing reporting and export experience.

---

## Current State

- `DeltaDashboard.tsx` already exposes weekly snapshot metrics, anomaly banners, vertical filters, trend charts, stacked delta charts, and recent changes.
- `Analytics.tsx` contains some investor/admin storytelling, but mixes contributor motivation with admin insights.
- Export and API monetization are present conceptually, not as a full workflow.
- The current layout is mobile-card friendly, but not yet presentation-ready for paying clients.

---

## Pain Points

- The product story clients care about, “show me the delta,” is present but not dominant enough.
- Export generation is not modeled as a first-class workflow.
- Trust and confidence signals are separated from the main delta story.
- The surface lacks a clear desktop-first report composition.
- Vertical detail, anomaly explanation, and map evidence are still distributed across separate mental models.

---

## Target Layout

### Desktop default

Use a report-style dashboard with five stacked regions:

1. Header with scope, last updated timestamp, export actions, and API entry
2. KPI row for total points, new, removed, changed, confidence, and anomalies
3. Main two-column canvas:
   - left: interactive map and filters
   - right: delta summary and anomaly callouts
4. Trend and breakdown charts
5. Detailed change feed and export/API panel

### Mobile fallback

- Collapse into a scrollable narrative:
  - KPI row
  - map
  - delta feed
  - charts
  - export drawer

### Default view behavior

- Default scope: latest complete snapshot
- Default vertical: `All`
- Default confidence filter: moderate threshold, visible and editable
- Make anomalies explicit, not hidden in chart hover only

---

## Key Components

### KPI strip

- total active points
- new since last snapshot
- removed since last snapshot
- changed since last snapshot
- confidence score or verified percentage
- anomaly count

### Delta map

- active points
- newly opened
- recently removed
- changed state
- filter chips by vertical or operator where relevant

### Anomaly panel

- line chart with anomaly highlights
- text annotations for flagged periods
- visible legend and human-readable explanation

### Change feed

- grouped by `New`, `Removed`, and `Changed`
- summary text first, identifiers second
- highlight publishable deltas and partial snapshot warnings separately

### Export and API panel

- format selector: CSV, GeoJSON, PDF
- scope controls: vertical, area, period
- include toggles: snapshot, delta, photo URLs, confidence threshold
- API endpoint preview with the same active filters

---

## Interaction Rules

- Filters stay synchronized across map, charts, change feed, and export panel.
- Export defaults to the exact filter state currently on screen.
- Confidence thresholds affect both what is visualized and what is exported.
- Partial or incomplete snapshot data must show a warning banner before a user exports.

### Chart rules

- Use line charts with explicit anomaly markers for anomaly detection.
- Use stacked bars for delta breakdown.
- Keep chart colors semantically aligned:
  - blue/navy for normal state
  - green for new/healthy growth
  - red for removals or anomalies
  - amber for changed/caution

### Trust rules

- Trust is visible inline with the delta story, not hidden in a separate QA section.
- Every client-facing surface should answer:
  - What changed?
  - Where did it change?
  - How confident are we?
  - How can I export it?

---

## Responsive Behavior

- `1280px+`: full report layout with side export/API panel
- `768px-1279px`: stacked charts with collapsible export panel
- `<768px`: narrative mobile layout with sticky filter bar and bottom-sheet export action

Presentation rules:

- Use chart and map compositions that can be screenshotted cleanly for slides.
- Avoid cramped data tables as the primary storytelling surface.

---

## Acceptance Criteria

- The dashboard tells a delta-first story before showing raw totals.
- Map, trends, anomalies, and recent changes are tied to the same active filters.
- Export and API access exist as explicit workflows, not placeholders.
- Trust and confidence are visible inline with the data story.
- Desktop layout is suitable for buyer demos, executive reviews, and report screenshots.
- Mobile layout remains readable for quick client checks without attempting to reproduce the full desktop density.
