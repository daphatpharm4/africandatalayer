# ADL UI/UX Design Research: Field Capture App Layout & Design System
## Bonamoussadi, Douala, Cameroon

**Teammate 8 -- UI/UX Designer Deliverable**
**Date:** March 2026

---

## Table of Contents

1. [User Research Summary](#1-user-research-summary)
2. [Design Principles & System](#2-design-principles--system)
3. [Field Capture App Layout](#3-field-capture-app-layout)
4. [Capture Flow Optimization](#4-capture-flow-optimization)
5. [Admin Dashboard Layout](#5-admin-dashboard-layout)
6. [Client-Facing Dashboard](#6-client-facing-dashboard)
7. [Gamification & Engagement](#7-gamification--engagement)
8. [Benchmark Research](#8-benchmark-research)

---

## Relationship to Prior Deliverables

This document builds on the work of Teammates 1-7 and the existing codebase:

- **Teammate 1 (Local Context):** The 7 verticals (pharmacy, fuel, mobile money, alcohol, billboard, transport road, census proxy), Bonamoussadi's middle-class character, ~560 businesses, seasonal flooding (June-October), and the dominance of the informal sector all shape the UI requirements. Mobile network coverage is strong (MTN, Orange), supporting a PWA approach.
- **Teammate 2 (System Design):** The event-sourced data model (`point_events` with `CREATE_EVENT` / `ENRICH_EVENT`), projected points, weekly snapshots, delta computation, and per-vertical field schemas define exactly what the UI must capture. The `enrichableFields` and `createRequiredFields` per vertical directly inform form design.
- **Teammate 6 (Anti-Fraud):** GPS integrity checks, EXIF validation, photo deduplication, velocity analysis, and confidence scoring all have UI implications. The agent must see fraud check results, trust scores, and quality indicators. Client-side mock location detection and sensor data collection happen transparently during capture.
- **Teammate 7 (Marketing):** The three user personas (field agent, admin reviewer, data consumer/client) and the commercial value of delta reports shape the dashboard designs for each audience.
- **Existing Codebase:** The app is built as a React PWA (Vite, not Next.js) with Tailwind CSS, using lucide-react icons. Current screens include: Splash, Home (map + list toggle), Details, ContributionFlow, Profile, Analytics, Settings, QualityInfo, RewardsCatalog, AdminQueue, and DeltaDashboard. Navigation uses a 4-tab bottom bar (Explore, Contribute, Leaderboard/Impact, Profile). The brand colors are navy `#0f2b46`, gold `#f4c317`, terracotta `#c86b4a`, and forest green `#4c7c59`. Bilingual support (EN/FR) is implemented throughout.

---

## 1. User Research Summary

### 1.1 Field Agent Persona

```
┌─────────────────────────────────────────────────────┐
│  PERSONA: Field Agent                               │
│  "Jean-Paul" / "Marie-Claire"                       │
├─────────────────────────────────────────────────────┤
│  Age:           20-35 years old                     │
│  Education:     Secondary school / early university │
│  Tech Literacy: Medium (comfortable with WhatsApp,  │
│                 M-Pesa/Orange Money, basic camera)   │
│  Device:        Mid-range Android (Samsung A-series, │
│                 Tecno, Infinix). 5.5-6.5" screen.   │
│                 2-4GB RAM. Android 10-13.            │
│  Language:      French primary, some English         │
│  Daily Routine:                                     │
│    06:30  Wake up, check assignments on phone       │
│    07:30  Travel to assigned zone by moto-taxi      │
│    08:00  Begin field capture, walk commercial      │
│           corridors on foot                         │
│    12:00  Lunch break, sync data if WiFi available  │
│    13:00  Continue capture in afternoon zone        │
│    17:00  Final sync, review daily stats            │
│    17:30  Travel home                               │
│  Submissions/day: 30-60 POIs                        │
│  Weekly Target:  150-300 submissions                │
│  Monthly Income: 80,000-150,000 XAF ($130-250 USD) │
└─────────────────────────────────────────────────────┘
```

**Key Pain Points:**
1. **Bright sunlight** -- Cannot read screen between 10am-3pm under direct equatorial sun. Needs maximum contrast.
2. **One-handed use** -- Often carrying a bag, umbrella (rainy season), or holding onto a moto-taxi. Needs thumb-reachable controls.
3. **Intermittent connectivity** -- Even in well-connected Bonamoussadi, signal drops in alleys, inside buildings, during rain. Must never lose data.
4. **Battery anxiety** -- Mid-range phones last 6-8 hours with GPS + camera active. Agents fear losing a day's work to a dead battery.
5. **Repetitive data entry fatigue** -- Capturing 50+ POIs per day with similar fields leads to frustration and shortcuts.
6. **French accent characters** -- Needs proper support for e, e with accents, c-cedilla, etc. on standard Android keyboards.
7. **Heat and sweat** -- Touchscreens become less responsive with wet/sweaty fingers. Needs larger touch targets.

**Accessibility Requirements:**
- Minimum 48dp touch targets (Android Material Design guideline; 44pt for iOS)
- Minimum 16sp body text, 14sp minimum for secondary text
- WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)
- Screen brightness auto-adjustment support
- Haptic feedback on successful actions
- Audio confirmation tones (optional, for eyes-free operation)

---

### 1.2 Admin / Reviewer Persona

```
┌─────────────────────────────────────────────────────┐
│  PERSONA: Admin Reviewer                            │
│  "Victor" / "Francine"                              │
├─────────────────────────────────────────────────────┤
│  Age:           25-40 years old                     │
│  Education:     University degree (data/GIS/IT)     │
│  Tech Literacy: High (comfortable with dashboards,  │
│                 spreadsheets, GIS tools)             │
│  Device:        Laptop (Chrome) + mid-range phone   │
│  Language:      French and English bilingual         │
│  Daily Routine:                                     │
│    09:00  Review overnight submissions              │
│    10:00  Process fraud flagged items                │
│    11:00  Assign weekly collection zones             │
│    14:00  Generate delta reports for clients         │
│    16:00  Monitor agent performance metrics          │
│  Reviews/day:   50-200 submissions                  │
│  Role:          Part-time (may also be a manager)   │
└─────────────────────────────────────────────────────┘
```

**Key Pain Points:**
1. **Volume overwhelm** -- Reviewing 200 submissions/day requires fast keyboard-driven workflows, not click-heavy interfaces.
2. **Fraud detection fatigue** -- Reviewing photo evidence, GPS coordinates, and EXIF metadata side-by-side is cognitively demanding.
3. **Context switching** -- Moving between map view, photo view, and data fields requires too many clicks.
4. **No batch operations** -- Approving/rejecting one at a time is slow. Needs bulk approve for low-risk, auto-flagged items.
5. **Mobile review** -- Sometimes reviews on phone during commute. Admin interface must be responsive.

---

### 1.3 Data Consumer / Client Persona

```
┌─────────────────────────────────────────────────────┐
│  PERSONA: Data Consumer                             │
│  "Rodrigue" (Brand Manager at SABC)                 │
│  "Aissatou" (GIS Analyst at Orange Cameroon)        │
├─────────────────────────────────────────────────────┤
│  Age:           30-50 years old                     │
│  Education:     MBA / Masters in relevant field     │
│  Tech Literacy: Medium-High (Excel/PowerBI, some   │
│                 SQL, comfortable with dashboards)    │
│  Device:        Laptop primary, phone secondary     │
│  Language:      French primary, English for tech    │
│  Usage Pattern:                                     │
│    Weekly:  Check delta reports, download CSV/PDF   │
│    Monthly: Deep-dive into vertical dashboards      │
│    Quarterly: Present insights to management        │
│  Budget:        CFA 2-15M/year ($3,300-$25,000)    │
└─────────────────────────────────────────────────────┘
```

**Key Pain Points:**
1. **"Show me the delta"** -- Clients do not want raw data; they want change reports. "What opened/closed this week?"
2. **Export friction** -- Needs one-click CSV, GeoJSON, and PDF report generation, not complex query interfaces.
3. **Trust verification** -- Wants to see confidence scores, photo evidence, and verification status inline.
4. **Map-first thinking** -- Expects interactive maps with filtering, not tables of coordinates.
5. **Presentation-ready visuals** -- Needs charts and maps that can go directly into PowerPoint slides.

---

## 2. Design Principles & System

### 2.1 Core Design Principles

| # | Principle | Rationale |
|---|---|---|
| 1 | **Offline-first, always** | Connectivity in Douala is unreliable. Every interaction must work without a network connection. Sync status must be permanently visible. |
| 2 | **3-tap capture** | The most common action (adding a new POI) should complete in 3 taps: Select Vertical > Take Photo > Confirm. All other fields use smart defaults. |
| 3 | **Thumb-zone priority** | Critical actions (capture button, submit, confirm) must be in the bottom 60% of the screen, within thumb reach on a 6" phone held one-handed. |
| 4 | **Sunlight-readable** | Use high-contrast color combinations (dark text on light backgrounds, or white text on dark backgrounds). Avoid mid-tone grays for critical information. |
| 5 | **Progressive disclosure** | Show only essential fields first. Advanced/optional fields appear on expansion. Reduce cognitive load for low-literacy agents. |
| 6 | **Visual over textual** | Use icons, color codes, and photos as primary information carriers. Text is secondary. Supports low-literacy and bilingual usage. |
| 7 | **Forgiving interactions** | All destructive actions require confirmation. No data loss on accidental back-navigation. Undo available for recent actions. |
| 8 | **Honest feedback** | Never hide sync status, errors, or fraud flags. Trust is built through transparency with agents about their data quality. |

### 2.2 Color Palette

The existing codebase establishes a strong brand identity. The palette below formalizes and extends it for field use.

#### Primary Colors

| Role | Hex | Swatch | Usage |
|---|---|---|---|
| **Navy (Brand Primary)** | `#0f2b46` | Dark navy | Headers, primary buttons, navigation active state, brand identity |
| **Gold (Brand Accent)** | `#f4c317` | Warm gold | Brand logo layer, highlight alerts, premium features |
| **Terracotta (CTA)** | `#c86b4a` | Warm orange | Call-to-action buttons (Contribute, Add New), urgent indicators |
| **Forest Green (Success)** | `#4c7c59` | Muted green | Success states, verified badges, trust scores, sync complete |

#### Semantic Colors

| Role | Hex | Usage |
|---|---|---|
| **Error Red** | `#c53030` | Fraud flags, sync failures, validation errors |
| **Warning Amber** | `#d69e2e` | Offline banner, low battery, pending review |
| **Info Blue** | `#2b6cb0` | Informational tooltips, help text |
| **Neutral Background** | `#f9fafb` | Page backgrounds (existing) |
| **Card Background** | `#ffffff` | Card surfaces (existing) |
| **Border Light** | `#e5e7eb` | Card borders, dividers |
| **Text Primary** | `#1f2933` | Headings, primary content |
| **Text Secondary** | `#6b7280` | Descriptions, metadata |
| **Text Tertiary** | `#9ca3af` | Timestamps, labels |

#### Vertical-Specific Colors (from existing `shared/verticals.ts`)

| Vertical | Color | Background | Icon |
|---|---|---|---|
| Pharmacy | `#2f855a` | `#eaf3ee` | `pill` |
| Mobile Money | `#0f2b46` | `#e7eef4` | `landmark` |
| Fuel Station | `#c86b4a` | `#f7e8e1` | `fuel` |
| Alcohol Outlet | `#9b2c2c` | `#fde8e8` | `wine` |
| Billboard | `#d69e2e` | `#fefcbf` | `rectangle-horizontal` |
| Transport Road | `#718096` | `#edf2f7` | `route` |
| Census Proxy | `#4a5568` | `#e2e8f0` | `building-2` |

#### Sunlight Readability Combinations

For outdoor use, the following combinations maintain WCAG AAA contrast (7:1+):

| Foreground | Background | Ratio | Use Case |
|---|---|---|---|
| `#1f2933` on `#ffffff` | 15.4:1 | Primary text on cards |
| `#ffffff` on `#0f2b46` | 13.2:1 | Text on navy headers/buttons |
| `#ffffff` on `#c86b4a` | 4.8:1 | Text on terracotta CTA (AA) |
| `#0f2b46` on `#f4c317` | 8.7:1 | Navy text on gold highlights |
| `#c53030` on `#ffffff` | 7.1:1 | Error text on white |
| `#1f2933` on `#f9fafb` | 14.8:1 | Text on page background |

**Avoid in sunlight:** Mid-tone gray text (`#9ca3af`) on white backgrounds -- contrast drops below 3:1 under direct sunlight. Use `#6b7280` minimum for any readable text outdoors.

### 2.3 Typography

```
FONT STACK
──────────
Primary:    Inter (already loaded via Vite build)
Fallback:   -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif

SCALE (Mobile)
──────────────
Display:    24px / 32px line-height / Bold (800)   -- Screen titles
Heading:    18px / 24px / Bold (700)                -- Section headers
Subheading: 14px / 20px / Semibold (600)            -- Card titles
Body:       14px / 20px / Regular (400)             -- Descriptions
Caption:    12px / 16px / Medium (500)              -- Metadata, labels
Micro:      10px / 14px / Bold (700)                -- Badges, status indicators
                                                       (UPPERCASE, tracking-widest)

FRENCH LANGUAGE SUPPORT
───────────────────────
Inter supports full Latin Extended character set:
  e with acute, e with grave, a with grave, a with circumflex,
  c-cedilla, o with circumflex, u with grave, i with diaeresis, etc.

All text fields use UTF-8 encoding.
Input fields must accept accented characters natively.
```

**Typography rules for field use:**
- Never use font-weight below 400 for outdoor-readable text
- Body text minimum 14px (matches current codebase's `text-sm` = 14px)
- Touch-target labels minimum 12px
- Status badges and micro-text use 10px UPPERCASE BOLD TRACKING-WIDEST (already established pattern in codebase)
- Line height minimum 1.4x font size for readability

### 2.4 Icon System

The existing codebase uses `lucide-react` icons consistently. This is the correct choice:

**Why lucide-react works for ADL:**
- 1,400+ icons in a consistent 24x24 grid
- SVG-based (scales without pixelation on any screen density)
- Tree-shakeable (only imported icons are bundled)
- No network dependency (works offline)
- Language-independent (universal visual symbols)

**Vertical Icon Mapping (from existing `VerticalIcon.tsx`):**

| Vertical | Icon | Visual Meaning |
|---|---|---|
| Pharmacy | `Pill` | Medicine capsule -- universal |
| Mobile Money | `Landmark` | Bank/institution -- financial service |
| Fuel Station | `Fuel` | Gas pump -- universal |
| Alcohol | `Wine` | Wine glass -- beverage |
| Billboard | `RectangleHorizontal` | Rectangular board |
| Transport Road | `Bus` / `Truck` | Vehicle / transport (note: `route` in verticals.ts config but `bus` in icon map) |
| Census | `Building2` | Multi-story building |

**Recommendation:** Add missing icons to `VerticalIcon.tsx` for `route` (used in verticals.ts for transport_road) to maintain consistency.

**Additional icon usage patterns (already established):**
- `ArrowLeft` -- Back navigation
- `MapPin` -- Location indicator
- `Camera` -- Photo capture
- `ShieldCheck` -- Verification / security status
- `Plus` / `PlusCircle` -- Add new / contribute
- `ChevronDown` -- Expandable menus
- `AlertTriangle` -- Warnings / errors
- `Award` -- XP / achievements
- `BadgeCheck` -- Trust verification

### 2.5 Spacing & Touch Targets

```
SPACING SCALE (Tailwind-aligned)
────────────────────────────────
4px   (p-1)   -- Icon padding, tight spacing
8px   (p-2)   -- Inner card padding, icon margins
12px  (p-3)   -- Field spacing within forms
16px  (p-4)   -- Card padding, section spacing
24px  (p-6)   -- Section separation
32px  (p-8)   -- Major section breaks
48px  (p-12)  -- Bottom safe area spacing

TOUCH TARGETS
─────────────
Minimum:     48x48dp (12x12 Tailwind = h-12 w-12)
Preferred:   56x56dp (14x14 Tailwind = h-14 w-14)
CTA Buttons: 56dp height minimum (h-14)
Nav Items:   64dp height (h-16, matching current nav)
Form Fields: 44dp minimum height (h-11)

SPACING BETWEEN TOUCH TARGETS
──────────────────────────────
Minimum gap: 8dp between adjacent touchable elements
Preferred:   12dp gap for form fields
```

**Rationale for 48dp minimum:** Standard Android Material Design recommends 48dp. In Douala's humid climate (80-95% humidity year-round), sweaty fingers reduce touch precision. Field agents may be walking while tapping. The 48dp minimum compensates for these conditions.

### 2.6 Dark/Light Mode Strategy

**Recommendation: Do NOT implement dark mode for v1.**

Rationale:
1. **Sunlight readability is the priority.** Dark mode is harder to read in bright sunlight. The primary use case is outdoor field capture between 7am-5pm.
2. **Cognitive consistency.** Agents switch between the app and their camera frequently. Maintaining one consistent visual mode reduces disorientation.
3. **Development cost.** Dark mode doubles the testing surface for contrast ratios, color accessibility, and visual hierarchy.

**Instead, implement:**
- **Auto-brightness support:** Ensure the app does not override system brightness settings
- **High-contrast mode:** A settings toggle that increases all text to bold weight and switches to maximum-contrast color pairs (pure black on white)
- **Night capture mode (future):** For alcohol outlet agents working evening shifts, a true dark theme could be added later when the use case is validated

---

## 3. Field Capture App Layout

### 3.1 Screen Architecture (Current vs. Proposed)

The existing app has a solid screen architecture. The proposals below refine rather than replace it.

```
CURRENT SCREEN ARCHITECTURE (from App.tsx)
──────────────────────────────────────────
Splash ──> Home (Map + List) ──> Details ──> ContributionFlow
                │                                    │
                ├──> Analytics/Leaderboard            │
                ├──> Profile ──> Settings             │
                │              ├──> RewardsCatalog    │
                │              └──> QualityInfo       │
                ├──> Auth                             │
                ├──> AdminQueue (admin only)           │
                └──> DeltaDashboard (admin only)      │
                                                      │
Bottom Nav: [Explore] [Contribute] [Impact] [Profile] │
            Hidden during: Splash, Auth, Contribute    │

PROPOSED REFINEMENTS
────────────────────
1. Add "Submission Queue" to Profile (offline queue visibility)
2. Add "Batch Capture Mode" toggle to ContributionFlow
3. Add sync status banner to ALL screens (not just offline)
4. Add "Nearby Assignments" card to Home screen
5. Restructure ContributionFlow to be step-based wizard
```

### 3.2 Home / Dashboard Screen

The current Home screen is well-designed. Key refinements for field optimization:

```
┌──────────────────────────────────────────┐
│  ┌──────────────────────────────────────┐│  <- Status bar (system)
│  │ ■ African Data Layer     [Admin] (●) ││  <- Header with brand logo
│  │ GPS Locked • Bonamoussadi, Douala    ││     (●) = avatar/profile
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ ● 3 Pending  ● 12 Synced  ● 2 Failed││  <- Sync status bar (NEW)
│  └──────────────────────────────────────┘│     Always visible
│  ┌──────────────────────────────────────┐│
│  │ ▼ Vertical: Pharmacie           [▼] ││  <- Vertical picker (existing)
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ TODAY'S ASSIGNMENTS                  ││  <- Assignment card (NEW)
│  │ Zone B-3 • 8/15 points • Due Fri    ││
│  │ [Start Capture ──────────────>]      ││
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │                                      ││
│  │            MAP VIEW                  ││  <- Leaflet map (existing)
│  │         (with POI pins)              ││
│  │                                      ││
│  │  ●  ●     ●                          ││  <- Colored by vertical
│  │        ●       ●                     ││
│  │     ●              ●                 ││
│  │                                      ││
│  └──────────────────────────────────────┘│
│                                          │
│       [■ List View]          [+ ]        │  <- Toggle + FAB (existing)
│                                          │
│  ┌────┬────────┬──────────┬─────────────┐│
│  │ 🗺️  │   ➕    │   🏆     │    👤       ││  <- Bottom nav (existing)
│  │Expl │Contri │Impact   │Profile      ││
│  └────┴────────┴──────────┴─────────────┘│
└──────────────────────────────────────────┘
```

**New elements explained:**

1. **Sync Status Bar** (always visible, below header):
   - Shows count of pending, synced, and failed submissions
   - Color-coded: Green dot = synced, Amber dot = pending, Red dot = failed
   - Tapping opens the detailed Submission Queue
   - Replaces the current offline-only amber banner with an always-present status

2. **Today's Assignments Card** (below vertical picker):
   - Shows current active assignment with progress bar
   - One-tap to begin route-guided capture
   - Collapses when no active assignments
   - Already partially implemented in Profile screen -- surfaces it on Home for quick access

### 3.3 Map View (Existing -- Refinements)

```
┌──────────────────────────────────────────┐
│  ┌──────────────────────────────────────┐│
│  │                                      ││
│  │  MAP TILES (Leaflet/OSM)             ││
│  │                                      ││
│  │  [Pharmacy]  ●                       ││  <- Category-colored markers
│  │        ● ●          ●                ││
│  │                                      ││
│  │    ●          ● (3)                  ││  <- Cluster count badge
│  │              ────                    ││
│  │         ●                            ││
│  │                                      ││
│  │  ┌──────────────────────────────┐    ││
│  │  │ Pharmacie de Bonamoussadi   │    ││  <- Popup on marker tap
│  │  │ Ouvert • De garde • 85% ✓  │    ││     (existing behavior)
│  │  │ Mis a jour il y a 2h        │    ││
│  │  │ [Voir detail] [Enrichir]    │    ││
│  │  └──────────────────────────────┘    ││
│  │                                      ││
│  │  ┌──────┐                            ││
│  │  │ ◎ Me │  <- Agent location (NEW)   ││
│  │  └──────┘                            ││
│  │                                      ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ NEARBY: 3 pharmacies within 200m    ││  <- Proximity bar (NEW)
│  │ 1 needs enrichment                  ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

**Proposed map improvements:**
- **Agent location pin** with accuracy circle
- **Proximity bar** at bottom showing nearby POIs that need data or enrichment
- **Assignment zone overlay** -- shaded polygon showing the agent's assigned zone
- **Color intensity** -- darker markers for older data (needs refresh), brighter for fresh data

### 3.4 Capture Form (ContributionFlow -- Major Redesign)

The current ContributionFlow is a long single-page form. For field use, it should be a step-based wizard.

```
STEP 1: VERTICAL SELECT (if CREATE mode)
┌──────────────────────────────────────────┐
│  [←]    New Data Point                   │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ What are you looking at?             ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌────────────────┐ ┌────────────────┐  │
│  │  💊             │ │  🏦             │  │
│  │  Pharmacie     │ │  Mobile Money  │  │
│  │                │ │                │  │
│  └────────────────┘ └────────────────┘  │
│  ┌────────────────┐ ┌────────────────┐  │
│  │  ⛽             │ │  🍷             │  │
│  │  Station       │ │  Alcool        │  │
│  │                │ │                │  │
│  └────────────────┘ └────────────────┘  │
│  ┌────────────────┐ ┌────────────────┐  │
│  │  📋             │ │  🛣️             │  │
│  │  Panneau pub.  │ │  Route         │  │
│  │                │ │                │  │
│  └────────────────┘ └────────────────┘  │
│  ┌────────────────┐                     │
│  │  🏢             │                     │
│  │  Batiment      │                     │
│  │                │                     │
│  └────────────────┘                     │
│                                          │
│  Step 1 of 4  ● ○ ○ ○                   │
└──────────────────────────────────────────┘

STEP 2: PHOTO CAPTURE
┌──────────────────────────────────────────┐
│  [←]    Pharmacie                        │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │                                      ││
│  │          CAMERA VIEWFINDER           ││
│  │                                      ││
│  │    ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐        ││
│  │    │                       │        ││  <- Overlay guide
│  │    │   Center the building │        ││     frame
│  │    │   signage here        │        ││
│  │    │                       │        ││
│  │    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘        ││
│  │                                      ││
│  │  GPS: 4.0821°, 9.7354°  ±5m         ││  <- Live GPS readout
│  │  [                                ]  ││     Accuracy indicator
│  │                                      ││
│  └──────────────────────────────────────┘│
│                                          │
│         [     ◉ CAPTURE      ]           │  <- Large shutter button
│                                          │  <- 72dp height for
│  [Skip Photo]            [Gallery]       │     easy thumb tap
│                                          │
│  Step 2 of 4  ● ● ○ ○                   │
└──────────────────────────────────────────┘

STEP 3: ESSENTIAL FIELDS (3 fields max)
┌──────────────────────────────────────────┐
│  [←]    Pharmacie                        │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ 📸 [Photo thumbnail]  ✓ GPS Locked  ││  <- Evidence summary
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ Nom / Name *                         ││
│  │ ┌────────────────────────────────┐   ││
│  │ │ Pharmacie de Bonamoussadi     │   ││  <- Auto-fill from
│  │ └────────────────────────────────┘   ││     nearby OSM data
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ Ouvert maintenant? *                 ││
│  │                                      ││
│  │  [  OUI  ✓ ]    [  NON  ]           ││  <- Binary toggle,
│  │                                      ││     NOT dropdown
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ 🎤 Voice input available            ││  <- Voice input hint
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ + More fields (optional)        [▼] ││  <- Progressive disclosure
│  └──────────────────────────────────────┘│
│                                          │
│         [    SUIVANT / NEXT     ]         │
│                                          │
│  Step 3 of 4  ● ● ● ○                   │
└──────────────────────────────────────────┘

STEP 4: REVIEW & SUBMIT
┌──────────────────────────────────────────┐
│  [←]    Confirmer                        │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ RESUME / SUMMARY                     ││
│  │                                      ││
│  │ Vertical:  Pharmacie                 ││
│  │ Nom:       Pharmacie de Bonamoussadi ││
│  │ Ouvert:    Oui ✓                     ││
│  │ GPS:       4.0821°, 9.7354°          ││
│  │ Photo:     ✓ Attached                ││
│  │ EXIF GPS:  ✓ Match (12m)             ││
│  │                                      ││
│  │ [📸 Photo preview]                   ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ ⚡ QUALITY CHECK                     ││
│  │ GPS Accuracy:  ●●●●○  Good           ││
│  │ Photo Quality: ●●●○○  Fair           ││  <- Real-time quality
│  │ Completeness:  ●●●●●  100%           ││     score preview
│  │ Est. XP:       +5 XP                 ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │                                      ││
│  │  [    ✓ SOUMETTRE / SUBMIT    ]      ││  <- Full-width submit
│  │                                      ││     button, 56dp height
│  │                                      ││
│  └──────────────────────────────────────┘│
│                                          │
│  Step 4 of 4  ● ● ● ●                   │
└──────────────────────────────────────────┘

POST-SUBMIT CONFIRMATION
┌──────────────────────────────────────────┐
│                                          │
│           ✓                              │
│                                          │
│      Soumis avec succes!                 │
│      Submitted successfully!             │
│                                          │
│      +5 XP                               │
│      ████████░░  Level 12                │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ [+ Ajouter un autre]                ││  <- Quick add next POI
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ [← Retour a la carte]               ││  <- Back to map
│  └──────────────────────────────────────┘│
│                                          │
│  Sync: ● Queued (will sync when online)  │
│                                          │
└──────────────────────────────────────────┘
```

### 3.5 Photo Capture Screen

```
┌──────────────────────────────────────────┐
│  ┌──────────────────────────────────────┐│
│  │                                      ││
│  │        CAMERA VIEWFINDER             ││
│  │                                      ││
│  │   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐       ││
│  │   │                         │       ││
│  │   │    STOREFRONT GUIDE     │       ││
│  │   │    OVERLAY FRAME        │       ││  <- Semi-transparent
│  │   │                         │       ││     guide frame
│  │   │    Show: signage, door, │       ││
│  │   │    street number        │       ││
│  │   │                         │       ││
│  │   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘       ││
│  │                                      ││
│  │   GPS: ●●●●○  4.0821, 9.7354        ││  <- GPS confidence
│  │   Accuracy: 5m ✓                     ││     indicator
│  │                                      ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ Tips:                                ││
│  │ • Include the business name sign     ││  <- Context-sensitive
│  │ • Capture the full facade            ││     tips per vertical
│  │ • Avoid photographing people         ││
│  └──────────────────────────────────────┘│
│                                          │
│  [Gallery]      [ ◉ ]      [Flash ⚡]    │  <- Shutter: 72dp
│                                          │     round button
│  ──────────────────────────────────────  │
│  After capture:                          │
│  [Retake]  [Preview ✓]  [Use Photo →]   │
│                                          │
└──────────────────────────────────────────┘
```

**Photo capture guidelines by vertical:**

| Vertical | Overlay Guide | Tip Text |
|---|---|---|
| Pharmacy | Rectangular frame with "PHARMACIE" label zone at top | "Capture the green cross sign and full storefront" |
| Mobile Money | Rectangular frame with provider logo zone | "Include the MTN/Orange branding visible" |
| Fuel Station | Wide landscape frame | "Capture the brand logo and pump area" |
| Alcohol | Standard storefront frame | "Show the business sign and entrance" |
| Billboard | Landscape rectangle with aspect ratio guide | "Capture the full billboard face including frame" |
| Transport Road | Landscape wide-angle guide | "Capture the road surface and any blockage" |
| Census | Tall building frame | "Capture the full building from ground to roof" |

### 3.6 Submission Queue Screen

```
┌──────────────────────────────────────────┐
│  [←]    File d'attente / Queue           │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ SYNC STATUS                          ││
│  │                                      ││
│  │ ● 3 En attente    ● 42 Synchronise  ││
│  │ ● 1 Echoue                           ││
│  │                                      ││
│  │ Last sync: il y a 15 min             ││
│  │ [    Forcer la synchronisation    ]  ││
│  └──────────────────────────────────────┘│
│                                          │
│  ECHOUE / FAILED                         │
│  ┌──────────────────────────────────────┐│
│  │ ⚠️ Pharmacie du Carrefour            ││
│  │ Erreur: Photo trop volumineuse       ││
│  │ GPS: 4.0815°, 9.7341°               ││
│  │ il y a 2h                            ││
│  │ [Reessayer]  [Modifier]  [Supprimer] ││
│  └──────────────────────────────────────┘│
│                                          │
│  EN ATTENTE / PENDING                    │
│  ┌──────────────────────────────────────┐│
│  │ ⏳ Station Total Makepe              ││
│  │ Fuel Station • CREATE_EVENT          ││
│  │ GPS: 4.0839°, 9.7402°               ││
│  │ il y a 30 min                        ││
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ ⏳ Orange Money Agent #12            ││
│  │ Mobile Money • ENRICH_EVENT          ││
│  │ GPS: 4.0827°, 9.7365°               ││
│  │ il y a 45 min                        ││
│  └──────────────────────────────────────┘│
│  ┌──────────────────────────────────────┐│
│  │ ⏳ Mur publicitaire Rue 3            ││
│  │ Billboard • CREATE_EVENT             ││
│  │ GPS: 4.0845°, 9.7388°               ││
│  │ il y a 1h                            ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ Storage: 14.2 MB / 50 MB cached     ││
│  │ ████████████░░░░░  28%               ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

### 3.7 Profile / Settings Screen

The existing Profile screen is comprehensive. Key refinements:

```
┌──────────────────────────────────────────┐
│  [←]    Tableau de bord                  │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │      [Avatar Photo]                  ││
│  │      Jean-Paul Makongo               ││
│  │      📍 Bonamoussadi, Douala         ││
│  │      Contributeur Senior             ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │  ┌─────────┐  ┌─────────┐           ││
│  │  │  2,450  │  │   98%   │           ││
│  │  │   XP    │  │ Trust   │           ││
│  │  └─────────┘  └─────────┘           ││
│  │  ┌─────────┐  ┌─────────┐           ││
│  │  │    7    │  │   142   │           ││
│  │  │ Badges  │  │ Points  │           ││
│  │  │         │  │ This Wk │           ││
│  │  └─────────┘  └─────────┘           ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ WEEKLY ASSIGNMENT                    ││
│  │ Zone B-3 • Due: Vendredi            ││
│  │ ████████████░░░  8/15 points         ││
│  │ [Demarrer]  [Voir sur carte]         ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ SYNC QUEUE                           ││
│  │ 3 pending • 1 failed                ││
│  │ [Voir la file d'attente →]           ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ HISTORIQUE RECENT                    ││
│  │ Pharmacie du Carrefour  +5 XP  2h   ││
│  │ Orange Money Agent      +5 XP  3h   ││
│  │ Station Total           +5 XP  4h   ││
│  │ [Voir tout →]                        ││
│  └──────────────────────────────────────┘│
│                                          │
│  [Echanger XP]    [Recompenses]          │
│                                          │
└──────────────────────────────────────────┘
```

---

## 4. Capture Flow Optimization

### 4.1 Walk-Up-and-Capture Flow

The critical path: Agent arrives at a POI. What happens?

```
OPTIMAL CAPTURE SEQUENCE (Target: 30-45 seconds per POI)
=========================================================

1. APPROACH (0s)
   Agent walks up to a pharmacy.
   Phone is in hand, app is on Home/Map screen.
   The map shows their blue dot near an existing POI marker.

2. DECISION POINT (5s)
   Two paths:

   Path A: EXISTING POI (tap marker on map)
   ├── Popup shows: "Pharmacie de Bonamoussadi"
   ├── Popup shows: "Last updated 3 days ago"
   ├── Popup shows: "Gaps: isOnDuty, openingHours"
   └── Agent taps [Enrichir / Enrich]
       ├── Camera opens (EXIF GPS captured)
       ├── Agent takes photo (1 tap)
       ├── Form shows ONLY the 2 gap fields
       ├── Agent fills: isOnDuty = Oui (1 tap)
       ├── Agent fills: openingHours = "08:00-20:00" (3 taps)
       └── Agent taps [Soumettre] (1 tap)
       TOTAL: 6 taps, ~30 seconds

   Path B: NEW POI (tap floating + button)
   ├── Grid shows 7 verticals
   ├── Agent taps "Pharmacie" (1 tap)
   ├── Camera opens with overlay guide
   ├── Agent takes photo (1 tap)
   ├── Form shows:
   │   - Name (auto-filled from nearby data? Or voice input)
   │   - isOpenNow: [Oui] / [Non] (1 tap)
   │   - "+ More fields" collapsed
   ├── Agent taps [Suivant] (1 tap)
   ├── Review screen shows summary
   └── Agent taps [Soumettre] (1 tap)
   TOTAL: 5 taps, ~35 seconds

3. CONFIRMATION (1s)
   Success animation + XP award.
   [+ Ajouter un autre] button for rapid next capture.
```

### 4.2 Progressive Disclosure Strategy

Each vertical has `createRequiredFields` and `enrichableFields` defined in `shared/verticals.ts`. The UI uses this to determine what to show:

```
PROGRESSIVE DISCLOSURE LEVELS
──────────────────────────────

Level 1: MANDATORY (always visible)
  - Photo (camera step)
  - GPS (auto-captured)
  - createRequiredFields for the vertical

  Example for Pharmacy:
    - name (text input)
    - isOpenNow (binary toggle)

Level 2: RECOMMENDED (collapsed, expandable)
  - enrichableFields minus createRequiredFields
  - Shown as "+ X more fields (optional)"

  Example for Pharmacy:
    - openingHours
    - isOnDuty
    - isLicensed
    - hasPrescriptionService
    - medicineCategories

Level 3: ADVANCED (hidden, accessible from settings)
  - Secondary photo
  - Notes / free text
  - Override GPS coordinates
  - Device diagnostics
```

**Implementation rule:** Level 1 fields use full-width, high-contrast input components. Level 2 fields appear in a collapsible section with a muted background. Level 3 fields are accessible only through a "More options" menu.

### 4.3 Smart Defaults and Auto-Fill

| Auto-Fill Source | What It Fills | How |
|---|---|---|
| **GPS coordinates** | Location fields | `navigator.geolocation` with high accuracy mode |
| **Nearby POI names** | Name field suggestion | Query existing points within 50m radius; suggest as autocomplete |
| **Previous submission** | Vertical selection | Default to the last-used vertical (if agent is doing a sweep of one type) |
| **Time of day** | isOpenNow | Default to "Yes" during business hours (8am-6pm), "No" otherwise |
| **EXIF data** | Photo GPS, timestamp | Extracted by `exifr` library (already in codebase) |
| **Device sensor** | Mock location flag, accelerometer | Collected via `gpsIntegrity.ts` (from Teammate 6's design) |
| **OSM seed data** | Name, brand, operator | Cross-reference GPS against `external_id` from OSM imports |

### 4.4 Voice Input Support

For low-literacy agents, voice input is critical for text fields (especially business names).

```
VOICE INPUT IMPLEMENTATION
──────────────────────────

Component: VoiceInput button next to text fields

┌──────────────────────────────────────┐
│ Nom / Name *                         │
│ ┌──────────────────────────┐  [🎤]  │  <- Microphone button
│ │ Pharmacie du Carref...   │        │
│ └──────────────────────────┘        │
└──────────────────────────────────────┘

On tap [🎤]:
1. Request microphone permission (one-time)
2. Use Web Speech API (SpeechRecognition)
3. Set language to 'fr-CM' (French, Cameroon)
4. Display real-time transcription
5. Agent taps [✓] to confirm or [🎤] to retry

Fallback: If Web Speech API is unavailable (some
Android WebViews), show a keyboard-only input with
a helper text: "Tapez le nom / Type the name"

Technical note: Web Speech API requires online
connectivity. For offline use, the field falls back
to keyboard input. Voice input is a convenience
feature, not a dependency.
```

### 4.5 Offline Indicators

The existing codebase has a basic offline banner (`bg-amber-600` bar at top). The proposed system makes sync status omnipresent:

```
SYNC STATUS STATES
──────────────────

State 1: ONLINE, ALL SYNCED
┌──────────────────────────────────────┐
│ ● 47 synced                     [↻] │  <- Green dot, subtle
└──────────────────────────────────────┘

State 2: ONLINE, SYNCING
┌──────────────────────────────────────┐
│ ◐ Syncing 3 of 5...            [↻] │  <- Animated spinner
└──────────────────────────────────────┘

State 3: OFFLINE, QUEUE PENDING
┌──────────────────────────────────────┐
│ ⚠ HORS LIGNE • 5 en attente    [↻] │  <- Amber background
└──────────────────────────────────────┘

State 4: ERROR, FAILED SUBMISSIONS
┌──────────────────────────────────────┐
│ ✖ 2 echecs • Appuyez pour voir  [↻] │  <- Red background
└──────────────────────────────────────┘
```

**Placement:** This bar sits immediately below the header on every screen (except Splash and Auth). It is 28dp tall and does not scroll with content. It is always visible.

### 4.6 Batch Capture Mode

For dense commercial areas (e.g., a row of shops along Carrefour Bonamoussadi), agents need to capture multiple POIs rapidly without returning to the map between each.

```
BATCH CAPTURE MODE
──────────────────

Activation: Toggle in ContributionFlow or long-press the + FAB

┌──────────────────────────────────────────┐
│  [←]    Mode Batch • Pharmacie           │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ Captured: 4 / ∞                      ││
│  │ ████████░░░░░░░░░░                   ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │                                      ││
│  │        CAMERA VIEWFINDER             ││
│  │                                      ││
│  │    ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐        ││
│  │    │    Pharmacie Guide    │        ││
│  │    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘        ││
│  │                                      ││
│  │  GPS: 4.0821°, 9.7354°  ●●●●○       ││
│  │                                      ││
│  └──────────────────────────────────────┘│
│                                          │
│  Quick Fields:                           │
│  ┌──────────────────────────────────────┐│
│  │ Nom: [____________]  [🎤]           ││
│  │ Ouvert: [OUI ✓] [NON]               ││
│  └──────────────────────────────────────┘│
│                                          │
│  [  ◉ CAPTURE & NEXT  ]                 │  <- Captures photo,
│                                          │     saves with defaults,
│  [Terminer le batch]                     │     immediately ready
│                                          │     for next POI
└──────────────────────────────────────────┘
```

**Batch mode behavior:**
- Camera stays active between captures
- GPS is re-acquired for each capture
- Only mandatory fields are shown (Level 1)
- Each capture auto-saves to the offline queue
- A counter shows progress
- Agent can end batch anytime with "End batch" button
- All batch items appear in the submission queue for review before sync

---

## 5. Admin Dashboard Layout

### 5.1 Review Queue (Existing AdminQueue.tsx -- Refinements)

The existing AdminQueue is functional but can be optimized for high-volume review. The key improvement is a split-panel layout on tablet/desktop.

```
ADMIN REVIEW QUEUE (Mobile)
┌──────────────────────────────────────────┐
│  [←]    Admin Queue                      │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ FILTERS                              ││
│  │ [All] [Flagged ⚠️ 12] [Pending 38]   ││
│  │ [Today ▼]  [Pharmacy ▼]  [Agent ▼]  ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ ⚠️ HIGH RISK                          ││
│  │ Pharmacie Sans Nom                   ││
│  │ Agent: marie_c • il y a 2h          ││
│  │ Fraud Score: 72/100 ████████░░       ││
│  │ Flags: GPS mismatch, No EXIF        ││
│  │                                      ││
│  │ ┌────────┐ ┌──────┐ ┌──────────┐    ││
│  │ │📸 Photo│ │🗺️ Map │ │📊 Detail │    ││
│  │ └────────┘ └──────┘ └──────────┘    ││
│  │                                      ││
│  │ [✓ Approve]  [✖ Reject]  [⏸ Hold]  ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ ● LOW RISK                           ││
│  │ Station Total Bonamoussadi           ││
│  │ Agent: jean_p • il y a 4h           ││
│  │ Fraud Score: 15/100 ██░░░░░░░░       ││
│  │ [✓ Approve]  [✖ Reject]  [⏸ Hold]  ││
│  └──────────────────────────────────────┘│
│  ... (scrollable list)                   │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ BULK ACTIONS                         ││
│  │ [Select All Low-Risk (26)]           ││
│  │ [✓ Approve Selected]                ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘

ADMIN REVIEW QUEUE (Desktop - Split Panel)
┌────────────────────┬─────────────────────────────┐
│ REVIEW QUEUE       │  DETAIL PANEL               │
│                    │                             │
│ Filters:           │  Pharmacie Sans Nom         │
│ [Flagged] [All]    │                             │
│                    │  ┌───────────┬────────────┐ │
│ ⚠️ Pharmacie Sans  │  │           │ MAP VIEW   │ │
│   Nom              │  │  PHOTO    │            │ │
│   marie_c • 2h     │  │  EVIDENCE │  ● Submit  │ │
│   Fraud: 72 ██████ │  │           │  ○ EXIF    │ │
│                    │  │           │  ▲ IP Loc  │ │
│ ● Station Total    │  └───────────┴────────────┘ │
│   jean_p • 4h      │                             │
│   Fraud: 15 ██     │  FRAUD ANALYSIS             │
│                    │  GPS Match:     ✖ FAIL      │
│ ● Orange Money     │  EXIF Present:  ✖ MISSING   │
│   paul_m • 5h      │  Photo Hash:    ✓ UNIQUE    │
│   Fraud: 8 █       │  Velocity:      ✓ NORMAL    │
│                    │  Device ID:     ✓ KNOWN     │
│ ● Mur publicitaire │                             │
│   sarah_k • 6h     │  AGENT HISTORY              │
│   Fraud: 5 █       │  marie_c: 142 total, 3 flags│
│                    │  Trust Score: 78%            │
│ [Select All Low-   │                             │
│  Risk (26)]        │  [✓ Approve] [✖ Reject]     │
│ [✓ Bulk Approve]   │  [⏸ Hold]   [💬 Comment]    │
└────────────────────┴─────────────────────────────┘
```

### 5.2 Map-Based Data Visualization

```
ADMIN MAP VIEW
┌──────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────┐│
│  │ [Vertical ▼] [Time Range ▼] [Agent ▼] [Status ▼]││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │                                                  ││
│  │              LEAFLET MAP                         ││
│  │                                                  ││
│  │    ● = Verified    ◐ = Pending    ○ = Flagged    ││
│  │                                                  ││
│  │    Zone A ─────┐                                 ││
│  │    │ ● ● ◐ ●  │    Zone B ─────┐                ││
│  │    │    ●   ○  │    │ ● ◐ ●    │                ││
│  │    │  ●    ●   │    │   ○  ●   │                ││
│  │    └───────────┘    └──────────┘                 ││
│  │                                                  ││
│  │    HEAT MAP LAYER (toggle):                      ││
│  │    ░░▒▒▓▓██  Submission density                  ││
│  │                                                  ││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │ LEGEND                                           ││
│  │ Coverage: 78% of assigned zones                  ││
│  │ This week: 342 new, 89 enriched, 12 flagged      ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### 5.3 Delta Reports View

```
DELTA DASHBOARD (Existing DeltaDashboard.tsx -- Enhanced)
┌──────────────────────────────────────────┐
│  [←]    Delta Report • Week 10           │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ PERIOD: Mar 3 - Mar 9, 2026         ││
│  │ [◀ Prev]  [Week ▼]  [Next ▶]       ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ SUMMARY                              ││
│  │                                      ││
│  │ +23 New POIs    -4 Closed            ││
│  │ 89 Enriched     12 Flagged           ││
│  │                                      ││
│  │ NET CHANGE: +19 ▲                    ││
│  └──────────────────────────────────────┘│
│                                          │
│  BY VERTICAL                             │
│  ┌──────────────────────────────────────┐│
│  │ Pharmacy      +3  -1  = 42 total    ││
│  │ ████████████████████████░░░  92%     ││
│  │                                      ││
│  │ Mobile Money  +8  -2  = 156 total   ││
│  │ █████████████████░░░░░░░░░░  68%     ││
│  │                                      ││
│  │ Fuel Station  +1  -0  = 8 total     ││
│  │ ████████████████████████████  100%   ││
│  │                                      ││
│  │ Alcohol       +6  -1  = 94 total    ││
│  │ ██████████████████████░░░░░  78%     ││
│  │                                      ││
│  │ Billboard     +3  -0  = 35 total    ││
│  │ ████████████████████░░░░░░░  72%     ││
│  │                                      ││
│  │ Road Segment  +2  -0  = 52 total    ││
│  │ █████████████████████████░░  88%     ││
│  │                                      ││
│  │ Census        +0  -0  = 173 total   ││
│  │ ████████████████████████████  100%   ││
│  └──────────────────────────────────────┘│
│                                          │
│  [Export CSV]  [Export PDF]  [API Link]   │
│                                          │
└──────────────────────────────────────────┘
```

### 5.4 Agent Performance Dashboard

```
AGENT PERFORMANCE
┌──────────────────────────────────────────┐
│  [←]    Agent Performance                │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ TEAM OVERVIEW • This Week            ││
│  │                                      ││
│  │ Active Agents:    8/10               ││
│  │ Total Submissions: 342               ││
│  │ Avg. Quality:     87%                ││
│  │ Fraud Rate:       3.5%               ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ AGENT        SUB   QUAL   FLAGS     ││
│  │ ─────────────────────────────────── ││
│  │ jean_p       67    94%    0    ★    ││
│  │ marie_c      54    78%    3    ⚠️    ││
│  │ paul_m       48    91%    1    ★    ││
│  │ sarah_k      43    88%    0    ★    ││
│  │ amadou_d     38    72%    5    ⚠️    ││
│  │ fatima_n     31    95%    0    ★    ││
│  │ eric_t       28    85%    1         ││
│  │ alice_m      14    90%    0         ││
│  │ [inactive]   0     --     --   ✖    ││
│  │ [inactive]   0     --     --   ✖    ││
│  └──────────────────────────────────────┘│
│                                          │
│  Tap agent name for detail view          │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ QUALITY METRICS                      ││
│  │                                      ││
│  │ Photo with EXIF:  89%  ████████░░   ││
│  │ GPS < 20m:        94%  █████████░   ││
│  │ All required:     97%  ██████████   ││
│  │ Unique photos:    96%  █████████░   ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

---

## 6. Client-Facing Dashboard

### 6.1 Vertical-Specific View

```
CLIENT DASHBOARD: MOBILE MONEY
┌──────────────────────────────────────────────────────┐
│  ADL                     [Export ▼]  [API Docs]      │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ Mobile Money Agents • Bonamoussadi               ││
│  │ Last updated: March 7, 2026 at 14:30             ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────┬───────────┬───────────┬───────────────┐│
│  │  156     │   +8      │   -2      │    87%        ││
│  │  Total   │   New     │   Closed  │    Verified   ││
│  │  Agents  │   This Wk │   This Wk │    Data       ││
│  └──────────┴───────────┴───────────┴───────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │                                                  ││
│  │              INTERACTIVE MAP                     ││
│  │                                                  ││
│  │   Filter: [MTN ●] [Orange ●] [Both ●]           ││
│  │                                                  ││
│  │   ● = Active (has float)                         ││
│  │   ○ = Active (no float)                          ││
│  │   ✖ = Closed since last report                   ││
│  │   ★ = New since last report                      ││
│  │                                                  ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ DELTA: WEEK 9 vs WEEK 10                         ││
│  │                                                  ││
│  │ New agents:                                      ││
│  │  ★ Orange Money Agent, Rue 12      MTN+Orange   ││
│  │  ★ MoMo Kiosque Carrefour         MTN          ││
│  │  ★ Agent Mobile Makepe             Orange       ││
│  │  ... +5 more                                    ││
│  │                                                  ││
│  │ Closed agents:                                   ││
│  │  ✖ Point MoMo Ecole               MTN          ││
│  │  ✖ Orange Money Pharmacie          Orange       ││
│  │                                                  ││
│  │ Status changes:                                  ││
│  │  ↕ Agent Rue 5: had float → no float            ││
│  │  ↕ Kiosque B3: MTN only → MTN+Orange            ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  [Download CSV]  [Download GeoJSON]  [View API]      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 6.2 Export & API Access Interface

```
EXPORT PANEL
┌──────────────────────────────────────────┐
│  Data Export                              │
│                                          │
│  FORMAT                                  │
│  [CSV ●]  [GeoJSON]  [PDF Report]       │
│                                          │
│  SCOPE                                   │
│  Vertical: [Mobile Money ▼]             │
│  Area:     [Bonamoussadi ▼]             │
│  Period:   [Week 10 ▼]                  │
│  Include:  [✓] Current snapshot          │
│            [✓] Delta from previous       │
│            [ ] Full history              │
│            [✓] Photo URLs                │
│            [ ] Agent metadata            │
│                                          │
│  CONFIDENCE FILTER                       │
│  Min. confidence: [70%  ─────●──]       │
│                                          │
│  [Generate Export]                        │
│                                          │
│  API ENDPOINT                            │
│  ┌──────────────────────────────────────┐│
│  │ GET /api/snapshots?                  ││
│  │   vertical=mobile_money&             ││
│  │   week=2026-W10&                     ││
│  │   min_confidence=70                  ││
│  │                                      ││
│  │ Authorization: Bearer <token>        ││
│  │                                [Copy]││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

---

## 7. Gamification & Engagement

### 7.1 XP & Level System (Existing -- Refinements)

The existing Profile screen shows XP balance and badges. The gamification system should be woven throughout the app, not siloed in the profile.

```
XP AWARD MOMENTS (visible in-flow)
───────────────────────────────────

1. POST-CAPTURE: Animated XP popup
   ┌────────────────────────┐
   │     ✓ +5 XP            │
   │  ████████████░░ Lv 12  │
   │  2,450 / 3,000 XP      │
   └────────────────────────┘

2. QUALITY BONUS: Extra XP for high-quality submissions
   ┌────────────────────────┐
   │  +5 XP base            │
   │  +2 XP quality bonus   │  <- Photo had EXIF GPS match
   │  +1 XP streak bonus    │  <- 5th submission today
   │  ─────────────────     │
   │  +8 XP total           │
   └────────────────────────┘

3. LEVEL-UP: Full-screen celebration
   ┌──────────────────────────────┐
   │                              │
   │         ★ LEVEL UP! ★        │
   │                              │
   │      Contributeur Senior     │
   │           Level 12           │
   │                              │
   │   New unlock: Batch Mode     │
   │                              │
   │   [Continuer]                │
   └──────────────────────────────┘
```

### 7.2 Streak System

```
DAILY STREAK (visible on Home screen)
┌──────────────────────────────────────┐
│ 🔥 Streak: 7 jours                   │
│ L  M  M  J  V  S  D                 │
│ ●  ●  ●  ●  ●  ●  ●                │
│ Record: 14 jours                     │
│ Bonus: +2 XP par soumission         │
└──────────────────────────────────────┘

WEEKLY STREAK (visible on Profile)
┌──────────────────────────────────────┐
│ This week: 34/50 target              │
│ ████████████████░░░░░░ 68%           │
│                                      │
│ Complete 50 to earn:                 │
│ ★ Weekly Champion badge              │
│ +50 bonus XP                         │
└──────────────────────────────────────┘
```

### 7.3 Achievement Badges

| Badge | Criteria | Icon Concept |
|---|---|---|
| **First Steps** | Complete 1st submission | Baby footprint |
| **Explorer** | Submit in 3 different zones | Compass |
| **Specialist** | 50 submissions in one vertical | Vertical-specific icon with star |
| **Quality Star** | 10 consecutive submissions with >90% quality | Star with checkmark |
| **Night Owl** | 10 submissions after 6pm (alcohol vertical) | Moon |
| **Rain Walker** | Submit during rainy season (June-Oct) | Cloud with rain |
| **Streak Master** | 14-day consecutive streak | Fire |
| **Urban Validator** | 100 total submissions | City skyline |
| **Data Champion** | 500 total submissions | Trophy |
| **Trust Elite** | Maintain 95%+ trust score for 4 weeks | Shield with star |

### 7.4 Leaderboard (Quality-Weighted)

```
LEADERBOARD (Existing Analytics screen -- Enhanced)
┌──────────────────────────────────────────┐
│  [←]    Classement / Leaderboard         │
│                                          │
│  [This Week ▼]  [Bonamoussadi ▼]        │
│                                          │
│  RANKING = Submissions x Quality Score   │
│  (Not just quantity -- quality matters!)  │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ 🥇 1. jean_p                         ││
│  │    67 sub x 94% qual = 6,298 pts    ││
│  │    ████████████████████████████      ││
│  │                                      ││
│  │ 🥈 2. fatima_n                       ││
│  │    31 sub x 95% qual = 2,945 pts    ││
│  │    ██████████████░░░░░░░░░░░░       ││
│  │                                      ││
│  │ 🥉 3. paul_m                         ││
│  │    48 sub x 91% qual = 4,368 pts    ││
│  │    ████████████████████░░░░░░       ││
│  │                                      ││
│  │  4. sarah_k     43 x 88% = 3,784   ││
│  │  5. eric_t      28 x 85% = 2,380   ││
│  │  6. alice_m     14 x 90% = 1,260   ││
│  │                                      ││
│  │  ─── Your Position ───               ││
│  │  ★ YOU: #3                           ││
│  │  48 sub x 91% qual = 4,368 pts      ││
│  │  Next rank: +1,930 pts               ││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ TOP BY VERTICAL                      ││
│  │ Pharmacy:     jean_p    (18 sub)     ││
│  │ Mobile Money: marie_c   (24 sub)     ││
│  │ Fuel:         paul_m    (8 sub)      ││
│  │ Alcohol:      sarah_k   (15 sub)     ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

**Critical design decision:** The leaderboard ranks by `submissions * quality_score`, NOT by submission count alone. This prevents gaming (submitting many low-quality/fraudulent entries to climb the board). Quality score incorporates the fraud detection signals from Teammate 6.

### 7.5 Daily Target Visualization

```
DAILY PROGRESS (Home screen widget)
┌──────────────────────────────────────┐
│ Aujourd'hui / Today                  │
│                                      │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │  12 │ │  3  │ │  87 │ │  7  │   │
│  │ sub │ │enri │ │ %qu │ │days │   │
│  │     │ │ ch  │ │ al  │ │strk │   │
│  └─────┘ └─────┘ └─────┘ └─────┘   │
│                                      │
│  Target: 15/day                      │
│  ████████████████████████░░░ 80%     │
│  3 more to hit daily bonus (+10 XP)  │
└──────────────────────────────────────┘
```

---

## 8. Benchmark Research

### 8.1 ODK Collect / KoboToolbox

**What works:**
- **Offline-first architecture**: Both ODK Collect and KoboCollect are designed for zero-connectivity environments. Forms are downloaded once and work entirely offline. ADL's current offline queue (`offlineQueue.ts`) follows this pattern correctly.
- **Skip logic and validation**: KoboToolbox supports cascading selections and conditional field display. ADL should adopt this for vertical-specific fields (e.g., show `fuelTypes` only when vertical is `fuel_station`).
- **GPS auto-capture**: Both tools auto-capture GPS at form start, with accuracy indicators. ADL already does this.

**What does not work:**
- **Form-centric UX**: ODK Collect is designed around filling out a survey form, not capturing a real-world POI. The "form" metaphor creates cognitive overhead for field agents who think in terms of "places" not "records."
- **No visual feedback**: ODK Collect shows a plain list of saved forms with no map, no gamification, no progress visualization. This leads to agent disengagement.
- **Desktop-first design**: KoboToolbox's form builder is a desktop web app that does not translate well to mobile review workflows.
- **No photo overlay guides**: Both tools treat photos as generic attachments, not as structured evidence with composition guides.

**ADL advantage:** The map-first, POI-centric approach is fundamentally better for location data capture than the form-centric approach of ODK/Kobo. The existing Home screen with map + list toggle is the right paradigm.

### 8.2 Mapillary

**What works:**
- **Continuous capture mode**: Mapillary's auto-capture (every 2 seconds while moving) is the inspiration for ADL's batch capture mode.
- **Screen dimming during capture**: Saves battery during long capture sessions. ADL should implement this.
- **Upload queue with progress**: Shows pending uploads, upload progress, and retry controls. ADL's submission queue design follows this pattern.
- **Distance and coverage tracking**: Shows total distance covered and coverage percentage on a map.

**What does not work:**
- **Street-level imagery focus**: Mapillary captures street-view imagery, not structured POI data. The camera-only workflow does not support the data fields ADL needs.
- **No offline map tiles**: Mapillary requires connectivity for map display. ADL must support offline map tiles.
- **No gamification beyond contribution count**: No quality-weighted scoring, no streaks, no badges.

**ADL advantage:** Mapillary's capture workflow combined with structured data entry (photo + fields) is a stronger approach than either tool alone.

### 8.3 OpenStreetMap (iD Editor, JOSM, StreetComplete)

**What works:**
- **StreetComplete** (Android app) is the closest benchmark to ADL's field capture:
  - Shows "quests" on a map (tasks to complete at specific locations)
  - Simple question-and-answer flow for each quest
  - Gamification with solved quest counts
  - Offline-capable
- **iD Editor**: Simple web-based editing with visual context.
- **Tag-based data model**: OSM's key-value tags are analogous to ADL's JSONB details.

**What does not work:**
- **Volunteer-driven quality**: No formal review process, no fraud detection, no incentive alignment.
- **Technical barrier**: Contributing to OSM requires understanding the data model (nodes, ways, tags). ADL abstracts this with vertical-specific forms.
- **No photo evidence**: OSM does not require or store photo evidence for edits. ADL's photo-first approach is critical for trust.

**ADL advantage:** StreetComplete's "quest" model mapped to ADL's "assignment" system, combined with photo evidence and fraud detection, creates a more trustworthy data product.

### 8.4 African Tech Design Patterns

**M-Pesa App:**
- **Simplicity**: The M-Pesa app uses a "less is more" approach. The home screen shows 6 large icons (Send, Withdraw, Pay, Save, Borrow, More). Each is a single action.
- **Trust through simplicity**: Financial apps in Africa succeed when they minimize decision points. Users trust apps that feel simple and predictable.
- **Offline resilience**: M-Pesa's USSD fallback (works on feature phones without internet) is a benchmark for reliability expectations.
- **Green color scheme**: M-Pesa uses Safaricom green. ADL's forest green (`#4c7c59`) serves a similar trust signal.

**Jumia App:**
- **Performance-first design**: Jumia adopted a "less is more" design philosophy after observing that low-end devices and poor connections caused users to abandon the app. Light pages, compressed images, and step-by-step checkout flows improved conversion.
- **Step-by-step flows**: Jumia's checkout is divided into steps "not only for performance reasons but also to inform the user of progress." ADL's proposed 4-step capture wizard follows this pattern.
- **Localized experience**: Support for multiple languages and local payment methods.

**Key takeaways for ADL from African tech:**
1. **Minimize data usage**: Compress photos before upload. Cache map tiles. Use lazy loading for screens (already implemented with `React.lazy`).
2. **Step-based flows**: Break complex actions into discrete steps with progress indicators.
3. **Large touch targets**: African users often use devices with cracked screens or in dusty/humid conditions. Generous touch targets compensate.
4. **Trust signals**: Show verification badges, sync status, and quality scores prominently. Users in emerging markets are more skeptical of digital tools.
5. **Bottom navigation**: Both M-Pesa and Jumia use bottom tab bars. ADL already implements this correctly.

### 8.5 Comparative Feature Matrix

| Feature | ODK Collect | KoboCollect | Mapillary | StreetComplete | ADL (Current) | ADL (Proposed) |
|---|---|---|---|---|---|---|
| Offline data capture | Yes | Yes | Partial | Yes | Yes | Yes |
| Offline map tiles | No | No | No | Yes | No | **Yes** |
| Photo with overlay guides | No | No | No | No | No | **Yes** |
| GPS auto-capture | Yes | Yes | Yes | Yes | Yes | Yes |
| EXIF validation | No | No | Yes | No | Yes | Yes |
| Fraud detection | No | No | No | No | Yes | **Enhanced** |
| Step-based wizard | Yes | Yes | No | Yes | No | **Yes** |
| Batch capture mode | No | No | Yes | No | No | **Yes** |
| Voice input | No | No | No | No | No | **Yes** |
| Gamification | No | No | Basic | Basic | Yes | **Enhanced** |
| Quality-weighted leaderboard | No | No | No | No | No | **Yes** |
| Assignment system | No | No | No | Yes (quests) | Yes | **Enhanced** |
| Admin review queue | Yes | Yes | No | No | Yes | **Enhanced** |
| Delta reports | No | No | No | No | Yes | **Enhanced** |
| Client dashboard | No | Yes | No | No | No | **Yes** |
| Bilingual (EN/FR) | Yes | Yes | No | Partial | Yes | Yes |
| PWA (no app store needed) | No | No | No | No | Yes | Yes |

---

## 9. Component Recommendations

### 9.1 Key Components to Build or Refactor

| Component | Status | Priority | Notes |
|---|---|---|---|
| **SyncStatusBar** | NEW | P0 | Always-visible sync indicator below header. Replaces offline-only banner. |
| **CaptureWizard** | REFACTOR | P0 | Refactor ContributionFlow from single-page to 4-step wizard. |
| **PhotoCapture** | REFACTOR | P0 | Add overlay guides per vertical, GPS confidence indicator. |
| **BatchCaptureMode** | NEW | P1 | Camera-stays-active rapid capture for dense areas. |
| **SubmissionQueue** | NEW | P1 | Dedicated screen showing pending/failed/synced items with retry. Currently partial in Profile. |
| **VoiceInput** | NEW | P2 | Web Speech API wrapper for text fields. French-Cameroon locale. |
| **AssignmentCard** | NEW | P1 | Home screen widget showing active assignment with progress. |
| **ProximityBar** | NEW | P2 | Map overlay showing nearby POIs that need data/enrichment. |
| **QualityPreview** | NEW | P1 | Pre-submit quality score breakdown (GPS accuracy, photo, completeness). |
| **DailyProgress** | NEW | P2 | Home screen widget showing daily stats and target progress. |

### 9.2 Tailwind Component Patterns

These patterns formalize what the existing codebase already uses:

```
CARD COMPONENT
──────────────
bg-white p-5 rounded-2xl border border-gray-100 shadow-sm

PRIMARY BUTTON
──────────────
h-14 bg-[#0f2b46] text-white rounded-xl font-bold text-xs
uppercase tracking-wider shadow-lg flex items-center
justify-center active:scale-95 transition-all

CTA BUTTON (Contribute/Add)
────────────────────────────
h-14 bg-[#c86b4a] text-white rounded-xl font-bold text-xs
uppercase tracking-wider shadow-lg

SUCCESS INDICATOR
─────────────────
text-[#4c7c59] bg-[#eaf3ee] rounded-full px-3 py-1
text-[10px] font-bold uppercase tracking-widest

STATUS BADGE
────────────
px-2 py-0.5 rounded-full text-[9px] font-bold uppercase
tracking-widest

FORM FIELD
──────────
h-11 px-3 bg-gray-100 rounded-xl text-xs font-semibold
text-[#0f2b46]

SECTION LABEL
─────────────
text-[10px] font-bold text-gray-400 uppercase tracking-widest

BOTTOM NAV
──────────
h-16 bg-white border-t border-gray-200 flex items-center
justify-around

FAB (Floating Action Button)
────────────────────────────
w-14 h-14 bg-[#c86b4a] text-white rounded-full shadow-2xl
flex items-center justify-center
```

### 9.3 Animation & Feedback

| Interaction | Feedback | Duration |
|---|---|---|
| Button press | `active:scale-95` | 100ms |
| Screen transition | Slide from right (forward) / left (back) | 200ms |
| Submission success | Checkmark animation + XP popup | 800ms |
| Sync complete | Green pulse on sync indicator | 300ms |
| Error | Shake animation on error element | 200ms |
| Level up | Full-screen overlay with confetti | 1500ms |
| Photo capture | Shutter flash (white overlay) | 100ms |
| GPS lock | Pulsing blue dot → solid blue dot | Continuous → 0ms |

---

## 10. Implementation Priority

### Phase 1: Core Field Optimization (Week 1-2)
1. **SyncStatusBar** -- Always-visible sync status on all screens
2. **CaptureWizard** -- Refactor ContributionFlow to 4-step wizard
3. **PhotoCapture** -- Add overlay guides and GPS confidence indicator
4. **QualityPreview** -- Pre-submit quality score on review step

### Phase 2: Productivity Features (Week 3-4)
5. **AssignmentCard** -- Home screen widget for active assignments
6. **BatchCaptureMode** -- Rapid capture for dense commercial areas
7. **SubmissionQueue** -- Dedicated queue screen with retry controls
8. **DailyProgress** -- Home screen daily stats widget

### Phase 3: Engagement & Polish (Week 5-6)
9. **Enhanced Gamification** -- Streak system, achievement badges, quality-weighted leaderboard
10. **VoiceInput** -- Web Speech API for text fields
11. **ProximityBar** -- Nearby POI suggestions on map
12. **Offline map tiles** -- Pre-cached Leaflet tiles for Bonamoussadi area

### Phase 4: Admin & Client Dashboards (Week 7-8)
13. **Admin split-panel review** -- Desktop-optimized review queue
14. **Client dashboard** -- Vertical-specific views with delta visualization
15. **Export interface** -- CSV, GeoJSON, PDF generation
16. **API documentation** -- Interactive API explorer for clients

---

## Sources

- [KoboToolbox Data Collection Tools Documentation](https://support.kobotoolbox.org/data-collection-tools.html)
- [KoBoToolbox vs ODK: Complete M&E Data Collection Comparison](https://practicalmel.com/kobo-toolbox-vs-odk-complete-me-data-collection-comparison/)
- [Mobile UX Design: The Ultimate Guide 2026](https://uxcam.com/blog/mobile-ux/)
- [What design factors should I consider when designing a mobile app for outdoor use? (ResearchGate)](https://www.researchgate.net/post/What_design_factors_should_I_consider_when_designing_a_mobile_app_for_outdoor_use)
- [Industrial UX: Sunlight Susceptible Screens (Medium)](https://medium.com/@callumjcoe/industrial-ux-sunlight-susceptible-screens-2e52b1d9706b)
- [Designing for The Great Outdoors: Solving The UX Challenges of Outdoor App Use (Adobe)](https://theblog.adobe.com/designing-for-the-great-outdoors-solving-the-ux-challenges-of-outdoor-app-use/)
- [UX researcher: Frontline workers require their apps to be straightforward (Resco)](https://www.resco.net/blog/mobile-platform-ux-ui/)
- [Mobile-First Design for Construction Management Software (AlterSquare)](https://altersquare.medium.com/mobile-first-design-for-construction-management-software-field-usability-guide-3f52adf45b02)
- [Jumia eCommerce Mobile App Design (Pixelmatters)](https://www.pixelmatters.com/work/jumia-ecommerce-mobile-app-design)
- [Redesigning M-Pesa: A Simpler, Smarter Future for Mobile Money (Medium)](https://medium.com/@allan.kimutai1/redesigning-m-pesa-a-simpler-smarter-future-for-mobile-money-86c90c24b66d)
- [Top Mobile App Trends in Africa 2025 (Graph Technologies)](https://graph.co.ke/blog/2025/05/13/top-mobile-app-trends-in-africa-2025/)
- [How AI & Messaging Could Transform M-PESA into a Super-App (TechMoran)](https://techmoran.com/2025/12/31/how-ai-messaging-could-transform-m-pesa-into-africas-super-app-in-2026/)
- [Mapillary/Data collection with Mapillary (OpenStreetMap Wiki)](https://wiki.openstreetmap.org/wiki/Mapillary/Data_collection_with_Mapillary)
- [An Introduction to Mapillary](https://help.mapillary.com/hc/en-us/articles/115001770269-An-Introduction-to-Mapillary)
- [Mapillary on Google Play](https://play.google.com/store/apps/details?id=com.mapillary.app&hl=en_US)
- [What is the best color scheme for outdoor mobile apps in sunlight? (Quora)](https://www.quora.com/What-is-the-best-color-scheme-for-outdoor-mobile-apps-in-sunlight)
- [10 Most Important Mobile UX Design Principles (UXBERT)](https://uxbert.com/10-mobile-ux-design-principles/)
