# Base HTML Template (1080×1920)

Drop-in scaffold for `build-frames.mjs`. Copy the constants + `page()` helper, then write per-frame inner HTML.

```js
const FONT_LINKS = `<link rel='preconnect' href='https://fonts.googleapis.com'><link rel='preconnect' href='https://fonts.gstatic.com' crossorigin><link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' rel='stylesheet'>`;

const BASE_CSS = `
html,body{margin:0;padding:0;width:1080px;height:1920px;overflow:hidden;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}
.stamp{position:absolute;top:280px;right:80px;padding:14px 24px;border-radius:999px;background:#f4c317;border:2px solid #0f2b46;color:#0f2b46;font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;z-index:2}
.micro{font-weight:700;font-size:13pt;letter-spacing:0.1em;text-transform:uppercase;padding:10px 20px;border-radius:999px;display:inline-block;align-self:flex-start}
.accent-bar{height:6px;width:96px;border-radius:3px;margin:20px 0}
.icon-chip{width:140px;height:140px;border-radius:36px;display:flex;align-items:center;justify-content:center}
.icon-chip svg{width:80px;height:80px;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round}
.frame-num{position:absolute;bottom:280px;right:80px;font-weight:700;font-size:13pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.55}
.cta-pill{position:absolute;left:80px;bottom:300px;padding:24px 36px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:24pt;display:flex;align-items:center;gap:14px}
.sticker-zone{position:absolute;left:80px;right:80px;top:1050px;height:320px}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:280px 80px 280px 80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = (text) => `<div class='stamp'>${text}</div>`;
```

## Why these defaults

- **`padding:280px 80px`** — top/bottom 280px reserves chrome bands (250px) + 30px breathing room. Left/right 80px is brand spacing.
- **`.stamp` at top:280px** — sits inside hero band, never under IG timestamp.
- **`.cta-pill` at bottom:300px** — clears bottom chrome (250px) + 50px breathing room. Stays tappable after screenshot or save-to-camera-roll.
- **`.sticker-zone`** — visual reservation. Render at low opacity outline during design review (`outline:2px dashed rgba(244,195,23,0.4)`) then ship at 0.
- **Font sizes scale up vs carousel** — story viewing distance is closer (held at arm's length, full screen), so body 24–28pt instead of carousel 22pt.

## Per-archetype starting bodies

### Hook
```html
<div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Series · Topic</div>
<div style='margin-top:auto;margin-bottom:auto'>
  <div style='font-weight:700;font-size:104px;line-height:1.02;letter-spacing:-0.015em'>Headline<br/>that hooks<br/>in 1.5s.</div>
  <div style='width:120px;height:6px;background:#c86b4a;border-radius:3px;margin-top:32px'></div>
</div>
```

### Proof
```html
<div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>The Proof</div>
<div class='accent-bar' style='background:#4c7c59'></div>
<div class='icon-chip' style='background:#fff8f4;margin-top:24px'>
  <svg viewBox='0 0 24 24' stroke='#c86b4a'><path d='...' /></svg>
</div>
<div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.01em;margin-top:32px'>Proof headline.</div>
<div style='font-weight:500;font-size:28pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>One-sentence specific verification mechanism.</div>
```

### Link CTA
```html
<div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>Download Today</div>
<div style='margin-top:auto;margin-bottom:auto'>
  <div style='font-weight:700;font-size:96px;line-height:1.02;letter-spacing:-0.015em'>Tap below<br/>to download.</div>
  <div style='font-weight:500;font-size:28pt;line-height:1.35;margin-top:32px;color:rgba(15,43,70,0.82)'>Native app. Same verified data.</div>
</div>
<div style='position:absolute;left:50%;transform:translateX(-50%);bottom:380px;width:0;height:0;border-left:24px solid transparent;border-right:24px solid transparent;border-top:32px solid #0f2b46'></div>
<!-- Link sticker placed by IG composer at y≈1500. Arrow above points to it. -->
```

## Reusing carousel build patterns

The renderer signature matches `scripts/render-ig-carousel.mjs`:

```bash
node .claude/skills/instagram-story-skill/scripts/render-story.mjs \
  docs/marketing/assets/story-week5-launch-echo/frames.json \
  docs/marketing/assets/story-week5-launch-echo
```

Output: `frame-01.png` through `frame-NN.png` at 1080×1920, deviceScaleFactor 2.
