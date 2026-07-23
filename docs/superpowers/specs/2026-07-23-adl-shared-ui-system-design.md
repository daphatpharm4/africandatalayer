# ADL Shared UI System Design

- Date: 2026-07-23
- Topic: `adl-shared-ui-system`
- Scope: Shared design system for ADL iOS, ADL Console, and ADL web, anchored on six first-wave target flows
- Status: Draft approved in conversation, written for review before implementation planning

## 1. Problem Statement

African Data Layer currently spans three product surfaces with different operating contexts:

- ADL iOS field experience for outdoor, intermittent-connectivity, one-handed capture work
- ADL Console for dense reviewer triage and decision-making
- ADL web for client-facing coverage, trust, and reporting workflows

These products need stronger cross-product consistency without forcing identical shells. The shared system must improve task completion and clarity in core workflows, not just visual consistency. Mobbin will be used as a pattern reference source, but reference patterns must be translated into ADL-native behaviors and token/component rules rather than copied visually.

## 2. Goals

Primary goal:

- Improve task completion and clarity in the most load-bearing flows across iOS, Console, and web

Secondary goals:

- Create a shared semantic token system
- Create a shared component inventory with shell-specific variants
- Define pattern-family rules that later product-specific specs can inherit
- Produce concrete recommendations for six first-wave target flows

Non-goals:

- Full redesign of every screen
- Exhaustive audit of all flows
- Implementation plan or code changes
- Final visual polish for lower-priority flows

## 3. Design Approach

The system will use a flow-anchored approach.

Why:

- It ties design-system decisions to real product work
- It prevents abstract token work from drifting away from operational needs
- It produces concrete recommendations for later implementation planning

Method:

1. Select six first-wave flows by weighted scoring
2. Mine Mobbin references per flow
3. Score references against ADL constraints
4. Extract repeated winning interaction patterns
5. Distill those patterns into shared tokens, components, and variant rules
6. Produce per-flow recommendations and handoff criteria

## 4. Scope and Deliverables

Included:

- Shared design principles refined for implementation
- Token system covering color, typography, spacing, sizing, radius, elevation, borders, iconography, motion, state semantics, and map semantics
- Shared component inventory with variant rules for iOS, Console, and web
- Pattern families derived from six first-wave target flows
- Concrete recommendations per selected flow
- Rules for where shared behavior is mandatory and where shell divergence is allowed
- Acceptance criteria for later implementation specs

Excluded:

- Full-screen mockups for every flow
- Implementation roadmap
- Code changes
- Final artifact library in code
- Comprehensive redesign catalog for every product area

Deliverables:

- First-wave flow selection and rationale
- Mobbin research and scoring rubric
- Token model
- Shared component model
- Pattern-family guidance
- Per-flow recommendations for six selected flows
- Adoption rules and acceptance criteria

## 5. Flow Selection Method

The first six flows are selected by weighted scoring, not product quota.

Selection factors and weights:

- Task criticality: 30%
- Current UX pain: 25%
- Reuse value for the shared system: 20%
- Failure cost if unclear: 15%
- Pattern-family coverage: 10%

Selection principle:

- Choose the intersection of pain and importance
- Ensure the final set pressures multiple interaction families
- Avoid equal product distribution as a goal by itself

The selected set must collectively cover:

- List → detail → decision
- Map + sheet/panel
- Guided multi-step capture/create
- Async/sync/progress
- Trust/quality/verification

## 6. Mobbin Research Method

Mobbin is used for behavioral and structural reference, not visual cloning.

For each candidate reference, extract:

- Layout structure
- CTA placement
- Navigation depth
- Information hierarchy
- State handling
- Trust signaling
- Density level
- Transition between summary and detail

Score each reference on:

- Clarity in 3 seconds
- Next action obvious
- State completeness
- Trust signaling quality
- Accessibility/readability
- Fit for ADL operational tone
- Portability into a shared system
- Shell adaptation cost

Reject references that depend on:

- Dark glossy fintech aesthetics
- Low-contrast premium minimalism
- Consumer-social playfulness in operational contexts
- Constant connectivity assumptions
- Decorative motion that competes with task completion

## 7. Shared Design Principles

1. Operational before ornamental
- Every visual decision must improve clarity, momentum, or trust

2. Shared semantics, flexible shells
- Core token meanings and state logic stay consistent
- Layout shell and density can adapt by product surface

3. Quality over volume
- Verified value outranks raw activity or vanity cues

4. Map-native familiarity
- Spatial interaction must feel direct, legible, and anchored

5. Accessibility and state clarity first
- If a tradeoff appears, protect readable contrast, explicit state, and recovery guidance before optimizing polish

6. Reliability is a first-class design concern
- Offline, syncing, retry, partial success, and failure must be designed explicitly

## 8. Token System

### 8.1 Shared Token Categories

- Color
- Typography
- Spacing
- Sizing
- Radius
- Elevation
- Border/outline
- Iconography
- Motion
- State semantics
- Map annotation semantics

### 8.2 Mandatory Shared Semantics

#### Color semantics

Strict shared meanings for:

- Primary action
- Success / verified
- Warning / attention needed
- Danger / rejected / destructive
- Info / neutral
- Disabled / unavailable

#### Typography roles

Shared role system:

- Page title
- Section title
- Primary metric
- Body
- Secondary body
- Metadata
- Label
- Caption

Exact scale can vary by shell, but role meanings do not.

#### Spacing

Use a shared 4/8-based scale with 8-point defaults.

Reason:

- Supports Console density without breaking mobile clarity
- Keeps consistent visual rhythm across products

#### Radius and elevation

Use restrained radius and sunlight-safe separation.

Rules:

- Avoid luxury-card softness
- Prefer clear edge definition
- Allow subtle shell tuning only

#### Motion

Shared motion intent:

- Informative, not playful
- Fast
- Purposeful
- Reduced-motion safe

Motion highlights:

- State changes
- Progress
- Confirmation
- Transitions between map selection and related sheet/panel detail

#### State semantics

Shared state model:

- default
- focused
- active
- selected
- loading
- success
- warning
- error
- disabled
- offline
- syncing
- verified
- flagged

#### Map semantics

Shared semantic layer for:

- Default marker
- Selected marker
- Verified marker
- Flagged marker
- Cluster
- Accuracy/uncertainty ring
- Route/path highlight
- Selection linkage between map and adjacent surface

### 8.3 Shell Alias Strategy

Use strict semantic tokens plus shell alias tokens.

Example model:

- `status-verified` as core semantic token
- `ios-badge-verified-bg` as iOS alias
- `console-row-verified-border` as Console alias
- `web-trust-chip-verified-fill` as web alias

This keeps meaning stable while allowing surface-appropriate expression.

### 8.4 Shell-Tunable Properties

These may vary by shell:

- Density
- Exact type scale values
- Panel widths
- Touch-target padding
- Table row compaction
- Chart presentation polish
- Sidebar vs bottom-sheet persistence
- Hover and keyboard affordances

## 9. Shared Component System

Components are organized by operational job, not by platform widget category alone.

### 9.1 Navigation and Orientation

- Top app bar
- Section header
- Tabs / segmented controls
- Breadcrumbs where needed
- Sticky or floating primary action zone

### 9.2 Filters and Query Controls

- Filter chips
- Search field
- Sort control
- Saved view selector
- Date/range selectors
- Active filter summary

### 9.3 Lists, Queues, and Rows

- Task row
- Review queue row
- Activity/change row
- Dataset/result row
- Bulk-selection row state

### 9.4 Detail Surfaces

- Bottom sheet
- Side panel
- Modal/dialog
- Inline expandable section
- Evidence card
- Metadata block

### 9.5 Decision and Status

- Status badge
- Priority/risk badge
- Approval/rejection bar
- Inline validation message
- Blocking warning banner
- Trust/confidence indicator

### 9.6 Capture and Create Flow

- Step header / progress
- Sticky footer CTA
- Field group
- Media picker
- Evidence preview
- Draft-save state
- Completion state

### 9.7 Async and Reliability

- Upload queue item
- Sync banner
- Retry state
- Conflict state
- Processing/progress indicator
- Partial success summary

### 9.8 Map Components

- Map marker
- Selected marker
- Cluster
- Callout/info card
- Sheet/panel linkage state
- Map legend / layer toggle

### 9.9 Empty, Loading, Error, Success

- Skeletons
- Empty state
- Zero-results state
- Permission-blocked state
- Offline state
- Success confirmation

## 10. Variant Rules by Surface

### 10.1 ADL iOS Field App

- Larger touch targets
- Bottom-sheet-first interaction
- Strong thumb reach bias
- Reduced simultaneous choice load
- Highly glanceable status chips
- Persistent primary CTA in core flows

### 10.2 ADL Console

- Denser rows and metadata
- Split-pane bias
- Faster keyboard/action workflows
- More visible hover, focus, and selection states
- Bulk-action affordances
- Higher evidence density before secondary polish

### 10.3 ADL Web

- More narrative spacing
- Stronger summary-card framing
- Presentation-clean maps and analytics
- Lower operational density than Console
- More export/share affordances

## 11. Divergence Rules

### 11.1 Must Stay Shared

- State names and meanings
- Badge and status semantics
- Validation severity language
- Trust and verification language
- Hierarchy roles
- Interaction logic of shared pattern families

### 11.2 May Diverge

- Layout shell
- Visual density
- CTA placement details
- Hover behavior
- Keyboard affordances
- Panel persistence and width
- Chart polish and narrative framing

## 12. Pattern Families

### 12.1 List → Detail → Decision

Use for:

- Console review queue
- Task queue
- Change feed
- Exports/history views

Shared rule:

- Fast scan in list
- Context-rich detail
- Persistent, unambiguous decision zone

ADL adaptation:

- Put status, risk, and next action above secondary metadata
- Never hide decision consequences
- Preserve row-to-detail continuity

### 12.2 Map + Sheet/Panel

Use for:

- Field map exploration
- Submission evidence inspection
- Coverage drill-down

Shared rule:

- Map is spatial truth
- Adjacent sheet/panel carries explanation and next action
- Selected state must be obvious on both map and detail surface

ADL adaptation:

- Preserve bright-day readability
- Expose trust state, freshness, and action path quickly
- Avoid decorative overlays that reduce geospatial clarity

### 12.3 Guided Multi-Step Capture/Create

Use for:

- Field capture
- Export builder
- Alert/watchlist setup

Shared rule:

- One main purpose per step
- Visible progress
- Validation near the mistake
- Stable sticky primary CTA

ADL adaptation:

- Reduce field input burden
- Surface required evidence early
- Preserve draft/resume behavior
- Avoid toast-only failure recovery

### 12.4 Async / Sync / Progress

Use for:

- Media upload
- Offline queue
- Background sync
- Export generation

Shared rule:

- Users must always know what is happening, what succeeded, what failed, and what to do next

ADL adaptation:

- Treat offline and partial connectivity as first-class
- Separate local-save success from remote-sync success
- Expose retry safely
- Distinguish pending, synced, conflicted, and failed states

### 12.5 Trust / Quality / Verification

Use for:

- Contributor quality feedback
- Reviewer fraud/risk cues
- Client trust dashboards

Shared rule:

- Trust is cumulative evidence, not decoration
- Quality indicators must explain meaning, not just color-code it

ADL adaptation:

- Verified quality outranks raw volume
- Confidence and evidence provenance stay visible
- Reward cues may motivate, but cannot weaken operational seriousness

## 13. First-Wave Flows

### 13.1 ADL iOS — Map Exploration + Opportunity Selection

Primary family:

- Map + sheet/panel

Why selected:

- Core field entry point
- High task criticality
- High pressure on marker semantics, selection state, and mobile action clarity

Expected system pressure:

- Marker states
- Sheet transitions
- Selection linkage
- Primary CTA hierarchy

### 13.2 ADL iOS — Capture Flow with Draft/Offline/Sync States

Primary families:

- Guided multi-step capture/create
- Async/sync/progress

Why selected:

- Highest failure cost in field work
- Core contribution path
- Strong pressure on validation, save semantics, and recovery states

Expected system pressure:

- Stepper/footer patterns
- Field grouping
- Upload states
- Offline vs synced semantics

### 13.3 ADL Console — Review Queue

Primary family:

- List → detail → decision

Why selected:

- High reviewer throughput leverage
- Strong pressure on density, filters, and status clarity

Expected system pressure:

- Queue row pattern
- Filter system
- Selection and bulk-action states

### 13.4 ADL Console — Submission Detail + Decision

Primary families:

- List → detail → decision
- Trust / quality / verification

Why selected:

- Highest accuracy and risk pressure in review operations
- Critical for trust and fraud handling

Expected system pressure:

- Evidence card/gallery
- Decision bar
- Risk/verification language
- Metadata and provenance blocks

### 13.5 ADL Web — Coverage Dashboard + Map Drill-Down

Primary family:

- Map + sheet/panel

Why selected:

- Highest-value client understanding flow
- Strong pressure on metric hierarchy and drill-down clarity

Expected system pressure:

- Summary cards
- Drill-down transitions
- Map/dataset linkage
- Presentation-safe metric structure

### 13.6 ADL Web — Trust / Quality Overview

Primary family:

- Trust / quality / verification

Why selected:

- Core credibility surface for clients
- Strong pressure on verification language and narrative clarity

Expected system pressure:

- Confidence indicators
- Evidence summaries
- Verification states
- Trust narrative blocks

## 14. Per-Flow Recommendation Template

Each first-wave flow should be documented using this structure:

- User goal
- Main failure risks
- Recommended pattern family
- Best Mobbin references
- Behaviors to borrow
- Behaviors to reject
- ADL-specific adaptation
- Shared components used
- Shared tokens used
- Allowed shell-specific divergence

This template keeps later product-specific specs consistent.

## 15. Future Flow Deferral

The following flows are deferred from wave 1 because they have lower shared-system leverage, not because they are unimportant:

- Auth/onboarding
- Rewards/profile
- Exports
- Alerts/watchlists
- Coaching/history
- Billing/account

These should inherit wave-1 primitives rather than define the shared system themselves.

## 16. Acceptance Criteria

This spec succeeds only if it:

1. Defines a reusable foundation
- Shared token system is explicit
- Shared components are scoped and named
- Shell divergence rules are concrete

2. Improves flow clarity
- Each first-wave flow has a clear goal, risks, pattern family, adaptations, and touched components/tokens

3. Reduces downstream ambiguity
- Implementers can tell what is shared, what is variant, and what “good” looks like

4. Handles critical operational states
- Explicitly covers loading, empty, error, success, offline, syncing, conflict/flagged, verified/unverified

5. Protects ADL brand and usage context
- Rejects low-contrast, decorative, or context-inappropriate patterns

6. Supports later implementation specs
- Later iOS, Console, and web specs do not need to redefine semantic colors, state model, badge logic, panel/sheet principles, trust language, or pattern-family rules

7. Stays bounded
- Remains a shared-system spec anchored on six flows, not a redesign encyclopedia

Failure condition:

- If an implementer still has to guess what “verified” means, when to use bottom sheet vs side panel, how offline differs from failed, or whether queue and dashboard statuses share semantics, the spec is insufficient.

## 17. Open Follow-On Work

After this spec is approved, follow-on specs should proceed in this order:

1. Product-specific shared-system application for ADL iOS
2. Product-specific shared-system application for ADL Console
3. Product-specific shared-system application for ADL web

Each follow-on spec should inherit this shared system rather than redefine it.
