# Slide components — ADL IG carousel

Reusable component patterns for 1080x1350 slides. Mirror app `@layer components` in `index.css` for visual continuity.

## 1. Hook slide

- Micro-label top-left (gold, UPPERCASE): e.g. `GROUND TRUTH · 01/05`
- Headline center: Inter 700, 56pt, navy-wash text on navy bg
- Gold stamp top-right: circle or star, 64pt, rotate -8deg
- Terra corner accent bottom-left: 120x120 quarter-circle, 60% opacity

## 2. Step slide

- Micro-label top (terra, UPPERCASE): e.g. `STEP 01 · GPS LOCK`
- Icon bubble center: 96x96 circle, forest-wash fill, Lucide icon
- Headline: Inter 700, 44pt, navy
- Body line: Inter 500, 24pt, navy at 90% opacity
- Supporting detail (italic): Inter 400, 20pt

## 3. CTA slide

- Headline: Inter 700, 44pt, navy on terra bg
- Body line: Inter 500, 24pt, navy
- CTA pill: height 56pt, radius 28, navy bg, navy-wash text. Matches in-app `.btn-cta`.

## Reusable primitives

- **Micro-label pill**: Inter 700 14pt UPPERCASE +8% tracking, padding 8x16, radius 999, bg alpha 10% accent.
- **Stamp mark**: gold circle or star, top-right, 64pt, rotate -8deg. Max one per slide.
- **CTA pill**: height 56pt, radius 28, padding 0x24. Matches in-app `.btn-cta`.
- **Corner accent**: bottom-left 120x120 quarter-circle in terra at 60% opacity. Use only on hook + CTA slides.
- **Icon bubble**: 96x96 circle, accent-wash fill, icon inset 32. Icons from Lucide (consistent with app).

## Spacing

- Slide padding: 80 all sides.
- Element gap: 24 vertical.
- Micro-label to headline gap: 32.
- Headline to body gap: 16.

## Don'ts

- No drop shadows.
- No outline strokes on type.
- No photographic backgrounds (anti-NGO stock rule).
- No more than one accent color per slide surface.
- No emoji in headlines (kills sunlight readability at small sizes).
