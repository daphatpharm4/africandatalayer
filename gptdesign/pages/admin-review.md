# ADL GPTDesign Override: Admin Review

> This file overrides `gptdesign/MASTER.md` for reviewer and admin operations.

---

## Current State

- `AdminQueue.tsx` already contains a strong data foundation:
  - grouped point review
  - fraud metadata
  - EXIF detail
  - photo evidence
  - assignment planner
  - local sync error visibility
- The review surface is still primarily a vertical mobile stack.
- `Analytics.tsx` and `DeltaDashboard.tsx` contain adjacent admin insight surfaces, but they are not composed into one reviewer workspace.

---

## Pain Points

- High-risk items do not dominate the information hierarchy enough.
- Reviewing photo, map, EXIF, event history, and contributor context still requires too much scrolling.
- Assignment planning competes with fraud review in the same cognitive space.
- Desktop review is not optimized for simultaneous queue scanning and evidence comparison.
- Bulk actions and keyboard-driven workflows are underspecified.

---

## Target Layout

### Desktop / laptop default

Adopt a split-panel workspace:

- **Left rail:** queue, filters, bulk actions
- **Center panel:** selected submission or grouped point evidence
- **Right rail:** fraud summary, contributor trust, assignment context, action bar

Queue order:

1. High risk
2. Pending review
3. Needs additional evidence
4. Low-risk ready for bulk action

### Mobile fallback

- Keep a single-column stack, but split the detail surface into tabs:
  - `Evidence`
  - `Fraud`
  - `History`
  - `Actions`
- Keep the queue list collapsible so the selected item gets most of the viewport.

### Assignment planner placement

- Remove assignment creation from the primary review scan path on desktop.
- Keep it as a separate panel or secondary tab within admin operations.
- Preserve the same data model and filters, but lower its visual priority when active review work exists.

---

## Key Components

### Risk-first queue card

- preview photo
- point/site name
- category
- timestamp
- contributor name
- risk status chip
- short risk reason summary
- event count and photo count

### Evidence workspace

- primary photo and additional photos
- submission GPS and map mini-panel
- EXIF metadata blocks
- point metadata and event timeline
- contributor/device context

### Fraud summary panel

- GPS match state
- EXIF state
- photo uniqueness
- IP distance
- velocity/device heuristics
- one-line recommendation:
  - `Approve`
  - `Hold for review`
  - `Reject`

### Action bar

- `Approve`
- `Reject`
- `Hold`
- `Request enrichment`
- `Next item`

### Bulk review module

- visible only when low-risk items are present
- select all low-risk
- approve selected
- export flagged set

---

## Interaction Rules

- Default selection on desktop should be the highest-risk unresolved item.
- Moving between queue items must not reset the active review context unexpectedly.
- Approval decisions should be executable from both queue cards and detail view.
- Keep destructive actions confirmed, but use lightweight confirmation for high-throughput review.

### Keyboard rules

- `J`: next item
- `K`: previous item
- `A`: approve
- `R`: reject
- `H`: hold
- `E`: focus evidence tab/panel

### Evidence rules

- Photo and GPS should sit side by side on desktop whenever width allows.
- Fraud flags should be summarized before raw metadata.
- Raw identifiers such as `Point ID`, event IDs, and device ID remain available for operations and support.

### Assignment rules

- Assignment planner inherits the shared assignment model from `MASTER.md`.
- Admin can filter by status and agent before creating new assignments.
- Assignment creation uses the same vertical taxonomy as the field app.

---

## Responsive Behavior

- `1024px+`: three-area split workspace
- `768px-1023px`: two-panel layout with collapsible side details
- `<768px`: stacked queue plus tabbed detail view

Performance rules:

- Avoid rendering all heavy evidence content for every queue item at once.
- Lazy-load detailed content for the selected item only.

---

## Acceptance Criteria

- Reviewers can scan high-risk items without opening every card.
- Desktop review shows queue and evidence simultaneously.
- Mobile review preserves access to evidence, fraud detail, history, and actions without an unusable scroll stack.
- Bulk approval exists for low-risk items.
- Assignment planning remains available but no longer dominates the review workflow.
- Fraud evidence, contributor history, and action controls are visible within one coherent admin workspace.
