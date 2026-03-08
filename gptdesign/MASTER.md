# ADL GPTDesign Master

> **Override Logic:** Check `gptdesign/pages/[page-name].md` before implementing a surface. If a page file defines a different rule, the page file overrides this master.
>
> **Source Precedence:** `research/08-ui-ux-design-research.md` is the product truth for ADL. UI UX Pro Max is used for workflow, accessibility, layout, and stack heuristics. If they conflict, the research doc wins.

---

## Inputs Used

### ADL product and codebase sources

- `research/08-ui-ux-design-research.md`
- `App.tsx`
- `components/Screens/Home.tsx`
- `components/Screens/ContributionFlow.tsx`
- `components/Screens/Profile.tsx`
- `components/Screens/AdminQueue.tsx`
- `components/Screens/Analytics.tsx`
- `components/Screens/DeltaDashboard.tsx`

### UI UX Pro Max workflow used

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "African Data Layer offline-first field capture admin review delta intelligence dashboard" --design-system -f markdown -p "African Data Layer"
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "offline sync feedback touch targets sunlight readability bilingual mobile capture" --domain ux
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "delta dashboard anomaly trends exports" --domain chart
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "pwa mobile map form queue dashboard" --stack react
```

### What ADL keeps from UI UX Pro Max

- Master + Overrides documentation structure
- Accessibility floor: contrast, touch targets, focus states, reduced motion support
- React form and state guidance
- Data-dense layout patterns for admin and client analytics
- Chart guidance for anomaly detection and trend reporting

### What ADL rejects from the generic output

- Generic “newsletter/content-first” IA
- Fira Code/Fira Sans as the default UI font stack
- Any design direction that reduces field readability in sunlight
- Any desktop-first layout assumption for the field capture experience

---

## Current-State UX Audit

| Surface | Current implementation | Main friction | Redesign direction |
|---|---|---|---|
| App shell | Single-screen state machine in `App.tsx`; bottom nav for Explore, Contribute, Impact, Profile | Role context is thin and sync status is mostly hidden | Keep the simple shell, add role-aware entry points and persistent system status |
| Home / Explorer | Map or list view, vertical picker, floating list toggle, floating add button | No always-visible sync state, assignments live elsewhere, weak “what should I do now?” guidance | Make Home assignment-first with persistent sync and stronger nearby/enrichment cues |
| Contribution flow | Long single-page form with many vertical branches | High fatigue, too much vertical scrolling, weak progressive disclosure | Replace with a step wizard and optional batch capture mode |
| Profile | Rich contributor dashboard with assignments, rewards, trust, sync errors | Important operational info is buried behind Profile | Keep Profile as depth view, surface critical workflow items earlier |
| Admin queue | Strong fraud detail and assignment planner already exist | High-volume review still requires too much vertical scanning; desktop split not modeled | Turn review into a risk-first workspace with split-panel evidence review |
| Analytics / Delta | Admin analytics and delta intelligence are separate, mobile-card oriented surfaces | Investor, reviewer, and client reporting concerns are mixed | Separate contributor motivation from reviewer tools and client delta reporting |

---

## Global IA And Navigation

### Role model

- **Field agent:** optimize for one-handed mobile capture, assignment execution, offline confidence, and end-of-day review.
- **Admin reviewer:** optimize for triage speed, fraud evidence density, keyboard/mouse efficiency, and bulk operations.
- **Client / data consumer:** optimize for delta comprehension, trust verification, and export/API access.

### Recommended surface map

- **Field app mobile shell**
  - `Explore`
  - `Capture`
  - `Impact`
  - `Profile`
- **Admin shell**
  - `Review Queue`
  - `Assignments`
  - `Delta Intelligence`
  - `Performance`
- **Client shell**
  - `Overview`
  - `Vertical Detail`
  - `Exports`
  - `API Access`

### Navigation rules

- Keep the current 4-tab field bottom navigation pattern because it is already learned in the app.
- Hide the bottom bar during active capture steps, but keep a sticky progress header and an obvious return path.
- Add role-specific shortcuts rather than one universal nav for every persona.
- Use context handoff instead of screen duplication:
  - Home assignment card opens capture with vertical and zone preselected.
  - Admin analytics links directly into review queues and delta anomalies.
  - Client dashboard filters persist across map, charts, and export actions.

---

## Design System Rules

### Color system

Use the ADL palette from the research doc, formalized as tokens:

| Token | Hex | Use |
|---|---|---|
| `--color-primary` | `#0f2b46` | Primary headers, active nav, trusted actions |
| `--color-accent` | `#f4c317` | Highlights, premium emphasis, attention states |
| `--color-cta` | `#c86b4a` | Primary contribution CTAs, urgent prompts |
| `--color-success` | `#4c7c59` | Verified, synced, healthy trust states |
| `--color-error` | `#c53030` | Fraud flags, failed sync, destructive states |
| `--color-warning` | `#d69e2e` | Offline, pending, caution states |
| `--color-bg` | `#f9fafb` | Screen background |
| `--color-card` | `#ffffff` | Surface background |
| `--color-text` | `#1f2933` | Primary text |
| `--color-text-muted` | `#6b7280` | Secondary readable text |

Rules:

- Use light mode only in v1.
- Default to maximum readability, not visual novelty.
- Reserve gold for highlight, not for large fill areas.
- Do not use tertiary gray text for important field actions outdoors.

### Typography

- Primary UI type: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Keep Inter because it is already present, performs well, and handles French accents cleanly.
- Minimum sizes:
  - Body: `14px`
  - Secondary/body-supporting text: `12px`
  - Section labels: `10px` uppercase bold with wide tracking
  - Headings: `18px`
  - Screen titles: `24px`
- Use line-height `1.4` minimum on field screens and `1.5` on dense admin/client content.

### Spacing and touch targets

| Token | Value | Use |
|---|---|---|
| `--space-xs` | `4px` | Tight icon padding |
| `--space-sm` | `8px` | Inline gaps |
| `--space-md` | `12px` | Form spacing |
| `--space-lg` | `16px` | Card padding |
| `--space-xl` | `24px` | Section separation |
| `--space-2xl` | `32px` | Major content spacing |
| `--space-safe-bottom` | `48px` | Bottom safe area |

Interaction minimums:

- Minimum touch target: `48x48px`
- Preferred CTA height: `56px`
- Minimum gap between adjacent touch targets: `8px`

### Iconography

- Continue using `lucide-react`.
- Keep icons semantic and universal.
- No emoji-as-icon usage in product UI.
- Normalize vertical icon mapping so `transport_road` uses a consistent route/road icon across all surfaces.

### Motion and feedback

- Motion should confirm state change, not decorate the interface.
- Duration range: `150ms` to `300ms`
- Respect `prefers-reduced-motion`.
- Use haptic feedback for:
  - successful capture
  - queue save
  - assignment completion
  - fraud/high-risk warning confirmation

### Accessibility and interaction

- Contrast target: WCAG AA minimum, prioritize AAA for field text where practical.
- Every icon-only button needs an accessible label.
- Every input needs a visible label; placeholders are never the only label.
- Keep loading, sync, and error states explicit and local to the affected action.
- Use controlled inputs in long forms and step flows.

---

## Shared Cross-Screen Patterns

### Persistent sync status

Replace the current offline-only banner with a global system bar on all authenticated app screens.

States:

- `Synced`: green indicator, last sync time, manual refresh affordance
- `Syncing`: progress or count
- `Offline queued`: amber state with queued count
- `Failed`: red state with tap-through to queue errors

Placement:

- Directly under the top header
- Sticky, non-scrolling
- Present on Home, Details, Profile, Analytics, Admin, and Delta screens

### Assignment surfacing

- Show the next actionable assignment on Home before map content.
- Keep the full assignment list in Profile and Admin Planner.
- Use the same completion metrics everywhere: `submitted / expected`, `% complete`, `due date`, and assigned verticals.

### Trust and fraud indicators

- Use one shared badge system:
  - `Verified`
  - `Pending Review`
  - `High Risk`
  - `Needs Enrichment`
- Fraud detail should never be hidden behind secondary navigation in admin contexts.
- Field agents should see quality guidance, not raw anti-fraud jargon.

### Offline queue and recovery

- Every capture stores locally before any network dependency.
- Queue visibility belongs in two places:
  - a small status entry point on Home
  - a detailed review surface in Profile
- Failed sync items must show cause, category, date, and location summary.

### Bilingual copy

- French and English remain first-class.
- Use short labels in navigation and status chips.
- Keep operational language plain:
  - “Pending review”
  - “Queued offline”
  - “Needs photo retake”
- Do not translate technical identifiers like `Point ID` for admin-only metadata if they are used for support/debugging.

### Gamification

- Gamification supports quality and retention, not noise.
- Home should show:
  - daily target progress
  - streak
  - today’s XP gain
- Ranking logic stays quality-weighted, not volume-only.
- Reward surfaces stay in Profile but post-capture feedback becomes inline.

---

## Rollout Sequence

### Phase 1: Workflow visibility foundation

- Add the persistent sync/system status bar
- Surface current assignment and daily progress on Home
- Add a lightweight queue entry point from Home

### Phase 2: Field capture rewrite

- Replace the long contribution form with a 4-step wizard
- Add capture guidance overlays and progress feedback
- Add batch capture mode for dense corridors

### Phase 3: Admin review workspace

- Reorganize Admin Queue into risk-first triage and split-panel review
- Separate assignment planning from active fraud review
- Add bulk review actions and keyboard-friendly workflows

### Phase 4: Client delta reporting

- Refactor delta intelligence into a client-ready dashboard
- Add export/API panel with confidence filtering
- Make anomalies, changes, and trust evidence readable at a glance

### Phase 5: Motivation and polish

- Promote gamification into the main field flow
- Tighten copy, animation, and responsive behavior
- Resolve icon and visual consistency gaps

---

## Ticket-Splitting Guidance

Break implementation into tickets by behavior, not by file:

1. Global status and assignment surfacing
2. Home explorer redesign
3. Capture wizard shell
4. Vertical-specific step content
5. Batch capture mode
6. Queue review and sync recovery
7. Admin triage workspace
8. Assignment planner refinement
9. Client delta dashboard
10. Exports, trust display, and polish
