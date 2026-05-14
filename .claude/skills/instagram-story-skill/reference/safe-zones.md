# IG Story Safe Zones (1080×1920)

IG overlays UI chrome on top of every story frame. Treat the canvas in three bands.

## Pixel bands

| Band | Y range | Height | Reserved for | Rule |
|------|---------|--------|--------------|------|
| **Top chrome** | 0–250px | 250px | Avatar, handle, timestamp, story progress bar | No critical text. Background color or pattern only. |
| **Hero band** | 250–1670px | 1420px | Headline, body, hero visual | All hero copy + visuals live here. |
| **Bottom chrome** | 1670–1920px | 250px | Reply bar, send arrow, share, close-friends ring | No critical text. CTA pill OK if positioned at y≈1500–1620 (just above chrome). |

## Sticker collision zone

Polls, quizzes, sliders, question stickers expand vertically when tapped or rendered. Reserve a **clear band** in the lower-mid hero zone:

| Sticker type | Default height | Expanded height | Recommended y placement |
|--------------|----------------|-----------------|-------------------------|
| Poll (2-option) | 220px | 320px | y=1100 |
| Quiz (3-option) | 380px | 520px | y=950 |
| Slider | 240px | 360px | y=1150 |
| Question | 280px | 380px | y=1100 |
| Link | 96px | 96px | y=1500 (just above chrome) |
| Countdown | 320px | 320px | y=1050 |
| Music | 96px | 96px | y=300 (top of hero band) |
| Hashtag (1) | 80px | 80px | y=320 (top of hero band, small) |
| Mention | 80px | 80px | y=320 |
| Location | 80px | 80px | y=320 |

## CSS scaffold

```css
html,body{margin:0;padding:0;width:1080px;height:1920px;overflow:hidden}
body{
  display:flex;
  flex-direction:column;
  position:relative;
  /* Hero padding leaves chrome bands clear */
  padding:280px 80px 280px 80px;
}
.top-chrome-shim{position:absolute;top:0;left:0;width:1080px;height:250px;pointer-events:none}
.bottom-chrome-shim{position:absolute;bottom:0;left:0;width:1080px;height:250px;pointer-events:none}
.sticker-zone{position:absolute;left:80px;right:80px;top:1050px;height:320px;outline:2px dashed rgba(244,195,23,0.0)}
```

Set `outline` opacity > 0 during design review to visualize the sticker zone, then ship at 0.

## Hard rules

- Critical text: y range 280–1500 only.
- CTA pill (download / DM / link cue): y range 1500–1620, never inside bottom chrome.
- Brand stamp (gold pill): top-right corner inside top chrome band is fine — it gets partially covered by the timestamp but reads as a pattern accent. If the stamp must remain fully visible, push it to y=270 (just inside hero band).
- Background fills the full 1920px — chrome bands need brand color or pattern to avoid white IG default bleed.
