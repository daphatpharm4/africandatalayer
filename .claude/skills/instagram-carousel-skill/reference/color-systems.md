# Color systems — ADL IG carousel

## Palette (from CLAUDE.md + tailwind.config.js)

| Token | Hex | Role |
|-------|-----|------|
| navy | `#0f2b46` | authority, primary bg, headline surface |
| navy-dark | `#0a1f34` | hover, deep bg |
| navy-wash | `#f2f6fa` | card bg on light slides |
| terra | `#c86b4a` | energy, CTA bg, final-slide surface |
| terra-wash | `#fff8f4` | soft accent wash |
| forest | `#4c7c59` | verified/success icons |
| gold | `#f4c317` | achievement stamp, corner accent only |
| ink | brand-text | slide body text on light bg |

## Slide color rules

1. **No pure black or pure white.** Use `navy` for deep, `navy-wash` for light.
2. **One accent per slide.** Pick terra OR gold OR forest — never two together on one surface.
3. **Hook slide (slide 1):** navy bg + terra corner accent + gold stamp. High-contrast type.
4. **Body slides (2–N-1):** navy-wash bg + one accent icon.
5. **CTA slide (last):** terra bg + navy text block + gold micro-label.
6. **Contrast floor:** 4.5:1 for body text, 3:1 for headline at 24pt or larger. Sunlight-readable.
7. **Gradient ban.** Flat fills only. Gradient hero = SaaS cliche per anti-references.

## Color-to-meaning map

- Navy → trust, pipeline, infrastructure.
- Terra → agent energy, call-to-action, warmth.
- Forest → verified, passed fraud checks, green-light.
- Gold → achievement, badge, "ground truth" stamp.

## High-contrast carry

Respect `.high-contrast` class logic — if an audience poll ever lands in-feed, palette already supports WCAG AA without retuning.
