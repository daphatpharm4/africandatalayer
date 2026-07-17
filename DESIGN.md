---
name: African Data Layer
description: Operational, map-native field intelligence built for trust and momentum.
colors:
  operational-navy: "#0f2b46"
  operational-navy-dark: "#0b2236"
  operational-navy-mid: "#1d4565"
  operational-navy-wash: "#f2f6fa"
  operational-navy-border: "#d5e1eb"
  signal-terracotta: "#c86b4a"
  signal-terracotta-dark: "#b85f3f"
  signal-terracotta-wash: "#fff8f4"
  verification-forest: "#4c7c59"
  verification-forest-dark: "#3a6145"
  verification-forest-wash: "#eaf3ee"
  progress-gold: "#f4c317"
  warning-amber: "#d97706"
  field-paper: "#f9fafb"
  surface: "#ffffff"
  ink: "#1f2933"
  ink-strong: "#111827"
  ink-muted: "#4b5563"
  danger: "#c53030"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "0.14em"
rounded:
  control: "14px"
  surface: "16px"
  pill: "28px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  touch: "48px"
components:
  button-primary:
    backgroundColor: "{colors.operational-navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    height: "56px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.operational-navy-dark}"
    textColor: "{colors.surface}"
    rounded: "{rounded.surface}"
  button-contribute:
    backgroundColor: "{colors.signal-terracotta}"
    textColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    height: "56px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
  chip-active:
    backgroundColor: "{colors.operational-navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 12px"
---

# Design System: African Data Layer

## Overview

**Creative North Star: "The Field Operations Compass"**

African Data Layer feels like a dependable instrument used in motion: decisive enough for one-handed field capture, calm enough for review, and specific enough to make trustworthy provenance visible. The system is light-mode-first, map-native, and operational. It uses familiar navigation, strong contrast, and restrained color to keep the next useful action obvious.

The interface rejects neon or crypto-style UI, glossy dark dashboards, decorative game effects that compete with field tasks, low-contrast premium minimalism that fails outdoors, and dense desktop controls forced onto narrow mobile screens.

**Key Characteristics:**

- Daylight-readable surfaces with Operational Navy as the primary action and navigation color.
- Signal Terracotta reserved for contribution momentum and the most important field action.
- Verification Forest and Progress Gold communicate trusted state and earned progress.
- Familiar map and platform patterns, 48px minimum touch targets, bilingual resilience, and purposeful motion.

**The Operational First Rule.** Every visual flourish must improve clarity, motivation, or trust.

## Colors

The palette combines a deep cartographic navy with grounded African earth and vegetation accents on a clear field-paper surface.

### Primary

- **Operational Navy:** Primary navigation, primary buttons, active controls, focus rings, and high-confidence text.

### Secondary

- **Signal Terracotta:** Contribution CTAs and selective momentum cues. It must not become decoration.
- **Verification Forest:** Verified, synchronized, safe, and successful states.

### Tertiary

- **Progress Gold:** Rewards and meaningful progress milestones. Pair it with dark ink; never use it as body text on white.
- **Warning Amber:** Caution and pending states that require attention without implying failure.

### Neutral

- **Field Paper:** Default app background for glare-resistant light mode.
- **Surface:** Cards, sheets, menus, and controls.
- **Ink / Ink Strong / Ink Muted:** Primary, emphatic, and secondary copy.
- **Operational Navy Wash / Border:** Selected backgrounds, quiet grouping, and structural dividers.

**The Restrained Signal Rule.** On product screens, accent color marks primary action, current selection, status, or progress. It never fills space merely to add personality.

**The Color-Independent State Rule.** Every status color must be paired with text, an icon, or both.

## Typography

**Display Font:** Inter (with system-ui fallback)
**Body Font:** Inter (with system-ui fallback)

**Character:** Direct, familiar, and highly legible. One family carries the product across web, iOS, and Android so type disappears into the task.

### Hierarchy

- **Display** (700, fixed 1.875rem, 1.2): Screen-defining titles and major milestones only.
- **Title** (700, fixed 1.25rem, 1.25): Card and section titles.
- **Body** (400, fixed 0.9375rem, 1.5): Operational copy; use 1rem for editable fields and sustained reading.
- **Label** (600, fixed 0.75rem, 0.14em tracking): Short navigation and status labels only. Never use tracked uppercase for sentences or dense metadata.

**The Fixed Product Scale Rule.** Product typography uses predictable rem sizes rather than viewport-fluid headings.

**The Translation Budget Rule.** Controls must tolerate at least 30% expansion without truncating the action or hiding meaning.

## Elevation

Elevation is structural and quiet. White surfaces sit on Field Paper with a one-pixel neutral boundary and a small ambient shadow. Sheets, floating capture actions, and temporary overlays may use stronger lift; routine cards remain nearly flat.

### Shadow Vocabulary

- **Surface:** `0 1px 2px rgba(0,0,0,0.05)` for standard cards and menus.
- **Lift:** `0 24px 60px -34px rgba(15,43,70,0.36)` for floating operational controls.
- **Contribution Lift:** `0 24px 48px -28px rgba(200,107,74,0.42)` for the singular contribution action.

**The Flat-by-Default Rule.** Shadow never substitutes for hierarchy; it only clarifies physical stacking or an interactive floating control.

## Components

### Buttons

- **Shape:** Tactile and confident, with 16px continuous corners and a 56px primary height.
- **Primary:** Operational Navy with white text; reserved for the single dominant action.
- **Contribution:** Signal Terracotta with white text; used only for the field contribution action.
- **Hover / Focus:** Darken within the same hue; use a visible 2px Operational Navy focus ring. Press feedback is short and subtle.
- **Secondary / Ghost:** White surface, one-pixel neutral border, Operational Navy text.

### Chips

- **Style:** Fully rounded, compact, and text-led. Minimum 32px height for secondary filters; use 48px when the chip is a primary mobile control.
- **State:** Active chips use Operational Navy and white; idle chips use Surface, a quiet border, and Ink Muted.

### Cards / Containers

- **Corner Style:** Continuous 16px radius. The 28px pill surface is limited to true widget/sheet shapes.
- **Background:** Surface on Field Paper.
- **Shadow Strategy:** Surface shadow only; separate internal groups with spacing and dividers, not nested cards.
- **Border:** One-pixel neutral boundary.
- **Internal Padding:** 16px default, 24px for large desktop panels.

### Inputs / Fields

- **Style:** Surface background, one-pixel neutral border, 14–16px corners, 48px minimum height.
- **Focus:** Operational Navy border and 2px focus ring; labels remain visible after entry.
- **Error / Disabled:** Error copy names the problem and recovery near the field. Disabled state reduces emphasis without losing readable contrast.

### Navigation

- **Style:** Four or five recognizable destinations with text labels, a clear active state, and persistent current location.
- **Mobile treatment:** Bottom navigation for primary field workflows; compact horizontal overflow or a drawer for console sections. Never require landscape orientation.
- **Desktop treatment:** Persistent side navigation when space allows, with the same nouns and route order as mobile.

### Map Capture Control

- **Style:** A large, thumb-reachable action above the bottom navigation with an explicit label, immediate pressed state, and offline-aware feedback.

**The One Primary Action Rule.** Each operational state exposes one unmistakable next action; secondary actions recede.

## Do's and Don'ts

### Do:

- **Do** design for bright sunlight, one-handed use, intermittent connectivity, and limited battery as default conditions.
- **Do** keep primary mobile touch targets at least 48px and readable text at least 16px where users type or read continuously.
- **Do** preserve English/French parity and allow at least 30% text expansion.
- **Do** use familiar Uber- and Google Maps-like hierarchy, spatial clarity, and task momentum.
- **Do** reward verified quality over raw activity, using Progress Gold and Verification Forest selectively.
- **Do** respect `prefers-reduced-motion` and keep product state transitions within 150–250ms where practical.

### Don't:

- **Don't** use neon, crypto-style, or glossy dark-dashboard aesthetics.
- **Don't** add decorative game effects that compete with field tasks.
- **Don't** use low-contrast premium minimalism that fails outdoors.
- **Don't** force dense desktop controls onto narrow mobile screens.
- **Don't** invent novel navigation where familiar map and operational patterns are clearer.
- **Don't** use color alone for status, gray text on colored backgrounds, thick side-accent borders, nested cards, or decorative hero metrics.
- **Don't** block the interface with a portrait-only orientation demand.
