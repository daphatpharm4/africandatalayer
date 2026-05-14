# Typography — ADL IG carousel

## Family

Inter only. Weights 400 / 500 / 600 / 700. Fallback `system-ui, sans-serif`. Matches app `index.css`.

## Grid (1080x1350 canvas)

| Use | Weight | Size (pt) | Tracking | Case |
|-----|--------|-----------|----------|------|
| Hook headline (slide 1) | 700 | 56 | -1% | Sentence |
| Step headline (slides 2 to N-1) | 700 | 44 | -1% | Sentence |
| Body line | 500 | 24 | 0 | Sentence |
| Supporting detail | 400 | 20 | 0 | Sentence |
| Micro-label | 700 | 14 | +8% | UPPERCASE |
| CTA pill text | 600 | 22 | 0 | Sentence |

Match `.micro-label` pattern in `index.css` — 11px in-app, scale to 14pt at 1080 canvas.

## Line-length rule

- Headline: max 6 words or 42 chars.
- Body line: max 12 words or 80 chars.
- Supporting detail: one sentence, max 14 words.

If caption logic wants more, move to carousel body copy — don't stuff a slide.

## Pairings

- **Navy bg** → body in `navy-wash` at 90% opacity. Headlines 100%.
- **Navy-wash bg** → body in `navy` (ink). Headlines `navy-dark`.
- **Terra bg** → body + headline in `navy`. Never white on terra (muddies).

## Bilingual note

FR mirror tends 18–22% longer than EN. Leave headline slots at 42 chars or fewer in EN so FR fits. If overflow, drop body line before shrinking headline.
