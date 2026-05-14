#!/usr/bin/env node
/**
 * EXAMPLE — Build frames.json for a 1080×1920 IG story.
 *
 * Copy this file into your `docs/marketing/assets/story-<slug>/build-frames.mjs`,
 * adjust copy/colors/stickers, then render via:
 *
 *   node .claude/skills/instagram-story-skill/scripts/render-story.mjs \
 *     docs/marketing/assets/story-<slug>/frames.json \
 *     docs/marketing/assets/story-<slug>
 */
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const FONT_LINKS = `<link rel='preconnect' href='https://fonts.googleapis.com'><link rel='preconnect' href='https://fonts.gstatic.com' crossorigin><link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' rel='stylesheet'>`;

const BASE_CSS = `
html,body{margin:0;padding:0;width:1080px;height:1920px;overflow:hidden;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}
.stamp{position:absolute;top:280px;right:80px;padding:14px 24px;border-radius:999px;background:#f4c317;border:2px solid #0f2b46;color:#0f2b46;font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;z-index:2}
.micro{font-weight:700;font-size:13pt;letter-spacing:0.1em;text-transform:uppercase;padding:10px 20px;border-radius:999px;display:inline-block;align-self:flex-start}
.accent-bar{height:6px;width:96px;border-radius:3px;margin:20px 0}
.icon-chip{width:140px;height:140px;border-radius:36px;display:flex;align-items:center;justify-content:center}
.icon-chip svg{width:80px;height:80px;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round}
.cta-pill{position:absolute;left:80px;bottom:300px;padding:24px 36px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:24pt;display:flex;align-items:center;gap:14px}
.frame-num{position:absolute;bottom:280px;right:80px;font-weight:700;font-size:13pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.55}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:280px 80px 280px 80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Launch · Week 4</div>`;

// Frame 1 — Hook (navy, big headline)
const f1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Mobile Launch · Live</div>
    <div style='margin-top:auto;margin-bottom:auto'>
      <div style='font-weight:700;font-size:104px;line-height:1.02;letter-spacing:-0.015em'>ADL is live<br/>on mobile.</div>
      <div style='width:120px;height:6px;background:#c86b4a;border-radius:3px;margin-top:32px'></div>
      <div style='font-weight:500;font-size:28pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:32px;max-width:880px'>Native camera. Native GPS. Same verified pipeline.</div>
    </div>
    <div class='frame-num' style='color:#f2f6fa'>01 / 05</div>
  `,
});

// Frame 2 — Proof (forest-wash, offline first)
const f2 = page({
  bodyStyle: "background:#eaf1ec;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>The Proof</div>
    <div class='accent-bar' style='background:#4c7c59'></div>
    <div class='icon-chip' style='background:#fff8f4;margin-top:24px'>
      <svg viewBox='0 0 24 24' stroke='#c86b4a'><path d='M3 12a9 9 0 1 0 9-9'/><path d='M3 12h6'/><path d='M12 3v6'/></svg>
    </div>
    <div style='font-weight:700;font-size:72px;line-height:1.04;letter-spacing:-0.01em;margin-top:32px'>Offline-first<br/>queue.</div>
    <div style='font-weight:500;font-size:28pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>Captures hold until signal returns. No re-entries. No data lost.</div>
    <div class='frame-num' style='color:#0f2b46'>02 / 05</div>
  `,
});

// Frame 3 — Poll (navy-wash, leaves room for IG poll sticker)
const f3 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.14);color:#c86b4a'>Tap A Vote</div>
    <div style='margin-top:80px'>
      <div style='font-weight:700;font-size:80px;line-height:1.05;letter-spacing:-0.015em'>Will you map<br/>your quartier<br/>this week?</div>
      <div style='width:120px;height:6px;background:#c86b4a;border-radius:3px;margin-top:32px'></div>
      <div style='font-weight:500;font-size:24pt;color:rgba(15,43,70,0.6);margin-top:32px'>↓ Tap below to answer</div>
    </div>
    <!-- Poll sticker placed by IG composer at y≈1100 -->
    <div class='frame-num' style='color:#0f2b46'>03 / 05</div>
  `,
});

// Frame 4 — Link (terra, arrow points to link sticker)
const f4 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>Download Today</div>
    <div style='margin-top:auto;margin-bottom:auto'>
      <div style='font-weight:700;font-size:96px;line-height:1.02;letter-spacing:-0.015em'>Tap below<br/>to download.</div>
      <div style='font-weight:500;font-size:28pt;line-height:1.35;margin-top:32px;color:rgba(15,43,70,0.82);max-width:900px'>Native app. Same verified data. Built for the field.</div>
    </div>
    <div style='position:absolute;left:50%;transform:translateX(-50%);bottom:380px;width:0;height:0;border-left:24px solid transparent;border-right:24px solid transparent;border-top:32px solid #0f2b46'></div>
    <!-- Link sticker placed by IG composer at y≈1500 -->
    <div class='frame-num' style='color:#0f2b46'>04 / 05</div>
  `,
});

// Frame 5 — CTA (navy, DM keyword fallback)
const f5 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.18);color:#f4c317'>Need Help?</div>
    <div style='margin-top:auto;margin-bottom:auto'>
      <div style='font-weight:700;font-size:80px;line-height:1.02;letter-spacing:-0.015em'>DM "MAP"<br/>or "CARTE".</div>
      <div style='font-weight:500;font-size:28pt;line-height:1.35;margin-top:32px;color:rgba(242,246,250,0.72);max-width:900px'>We walk you through your first capture this week.</div>
    </div>
    <div class='cta-pill' style='background:#f4c317;color:#0f2b46'>
      <span>DM us · we reply this week</span>
      <span>→</span>
    </div>
    <div class='frame-num' style='color:#f2f6fa'>05 / 05</div>
  `,
});

const frames = [
  { id: '01', html: f1 },
  { id: '02', html: f2 },
  { id: '03', html: f3 },
  { id: '04', html: f4 },
  { id: '05', html: f5 },
];

await writeFile(resolve(here, 'frames.json'), JSON.stringify(frames, null, 2), 'utf8');
console.log(`wrote ${frames.length} frames to frames.json`);
