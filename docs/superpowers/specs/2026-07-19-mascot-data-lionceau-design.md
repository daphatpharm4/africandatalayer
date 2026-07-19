# ADL Mascot — "Data" le Lionceau

**Date:** 2026-07-19
**Status:** Design approved, art generation in progress
**Beads:** africandatalayer-r3q

---

## Concept

**Data** is a chibi lion cub — the mascot of African Data Layer. He is rooted in
**Les Lions Indomptables** (the Indomitable Lions), Cameroon's beloved national
symbol of resilience and pride. This is deliberate: not a generic savanna-lion
trope, but a specific national-identity reference every Cameroonian recognizes.

He embodies the brand: **Empowering, Grassroots, Resilient.** He is a *cub* —
young, capable, growing — mirroring the field agent's own journey.

### The signature mechanic: the mane grows with the agent

Data starts as a small cub with a tiny tuft. **As the agent levels up, his mane
grows fuller and richer.** Tier = mane. A brand-new agent sees a fuzzy little
cub; a veteran sees a proud young lion with a full terracotta-gold mane. The
mascot *is* the agent's progress — this serves the design principles:

- **Stats as identity** — Data visibly reflects earned performance, not decoration.
- **Reward the work** — every level-up is a visible transformation of your companion.
- **Progressive disclosure** — approachable on day one, powerful on day 100.

---

## Personality & Voice

| Trait | Expression |
|-------|-----------|
| Brave | Faces the field with the agent — determined, never timid |
| Warm | Celebrates captures genuinely; a companion, not a cheerleader |
| Eager | Momentum-driven, always ready for the next point |
| Capable | A little professional — never patronizing, never an "aid" mascot |

**Voice fit:** Direct, confident, locally rooted. Data speaks *to* agents as
peers building something important — matching the brand's warm-but-no-nonsense
tone. Bilingual-friendly: "Data" reads cleanly in EN / FR / Pidgin.

---

## Visual Specification

### Proportions (chibi)
- Big head, small rounded body, short limbs. Max ~2 heads tall.
- Large expressive eyes. Soft, rounded silhouette — reads at tiny app sizes.
- Flat cel-shading, bold clean outlines, flat brand-color fills. Mobile-readable.

### Palette (locked to brand tokens)

| Element | Token | Hex |
|---------|-------|-----|
| Body / fur (tawny) | `gold` | `#f4c317` |
| Mane (gradient) | `terra` → `gold` | `#c86b4a` → `#f4c317` |
| Field gear (pack, phone, cap) | `navy` | `#0f2b46` |
| Verified / success glow, checkmarks | `forest` | `#4c7c59` |
| Outlines / ink | `ink` | brand ink, never pure black |
| Backgrounds | `*-wash` variants | e.g. `navy-wash #f2f6fa` |

- Never pure black/white — neutrals tinted toward navy, per brand.
- High-contrast, sunlight-readable. Works on light-mode surfaces (primary).

### Gear (subtle, not costume-heavy)
- Tiny navy field pack or crossbody bag.
- A small phone/tablet (the capture tool) — optional per pose.
- No stereotypical "African" props. Identity comes from form + palette + the
  Indomptable-Lion reference, not costume clichés.

---

## Deliverables (reference art)

1. **Neutral reference / concept pose** — Data standing, friendly, front 3/4.
   The canonical mascot. Mid-tier mane.
2. **Expression set (rewards & states):**
   - **Cheering** — arms up, joyful → XP pop / capture success.
   - **Sleeping / idle** — curled, calm → offline mode, "it works offline, no stress."
   - **Determined** — focused, ready → mission cards, daily goal.
3. **Mane-tier variants** — bronze tuft → full gold-terra mane, for level-up
   celebration and tier identity (Bronze / Silver / Gold / etc. mapped to app tiers).

All on transparent or `*-wash` backgrounds for in-app compositing.

### Where Data appears
- **In-app UI:** onboarding, empty states, loading, XP/reward celebration.
- **Rewards / gamification:** badges, level-up, streaks — Data reacts to progress.
- **Marketing / social:** Instagram, LinkedIn, recruitment — expressive hero poses.

---

## Constraints & Anti-references

- NOT a photorealistic lion; NOT a fierce/aggressive predator. He is a *warm cub*.
- NOT safari/aid/charity aesthetic. NOT a mascot that talks down to agents.
- Must read at 32–48px (badge scale) and scale up to hero art.
- Respects `prefers-reduced-motion` when animated later (static art here).

---

## Out of scope (YAGNI, for now)

- Animated rigs / Lottie files — static reference art first.
- Full brand-mascot style guide document — this spec + reference art is enough
  to validate the direction before deeper investment.
- Secondary characters.

---

## Implementation (2026-07-19)

### Scope: agent app ONLY

Data renders only on the field-agent app (`main.html` / iOS / Android). He is
**forbidden** on the company console (`console.html` — Admin & Client screens).
Rationale = brand emotional registers: Agent is celebratory (mascot fits);
Admin is clinical and Client is premium (both stay mascot-free). Enforce by
rendering `<Mascot>` only under the existing agent role gating.

### Component

`components/shared/Mascot.tsx` — `<Mascot pose animate size alt />`.
- Poses: `canonical`, `standing`, `cheering`, `sleeping`, `determined`,
  `tier-bronze`, `tier-gold`.
- Animations (CSS keyframes in `index.css`, all reduced-motion safe):
  `none`, `pop`, `float`, `wiggle`. No video/Lottie — field-first (2G).
- Decorative by default (`alt=""` + `aria-hidden`); pass `alt` when meaningful.

### Assets

- `assets/mascot/web/*.webp` — 512px, ~22KB each. **Used by the app.**
- `assets/mascot/*.png` — full-res 896×1200 transparent originals. Marketing only.

### Placement (live)

| Pose | Location | Trigger |
|------|----------|---------|
| `cheering` (pop) | `XPPopup` | Capture accepted |
| `tier-gold` (pop) | `LevelUpCelebration` | Level up — mane-growth payoff |
| `sleeping` (float) | `SubmissionQueue` empty card | All uploads synced |
| `determined` (float) | `Home` company-map empty state | No nearby points |

### Placement (planned, not yet wired)

- `tier-bronze → tier-gold` in `BadgeSystem` / `StreakTracker` for tier identity.
- `canonical` / `standing` on `Splash` onboarding + `Auth` welcome.
- NOTE: `Profile` hero deliberately excluded — design principle 6 (identity =
  letter-initial gradient circle, no avatar). Do not put Data in the profile hero.
