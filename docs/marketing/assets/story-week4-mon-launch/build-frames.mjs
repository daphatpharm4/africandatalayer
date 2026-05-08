#!/usr/bin/env node
// Build frames.json for Week 4 Mon Launch story (EN, 4 frames, 1080x1920)
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const FONT_LINKS = `<link rel='preconnect' href='https://fonts.googleapis.com'><link rel='preconnect' href='https://fonts.gstatic.com' crossorigin><link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' rel='stylesheet'>`;

const BASE_CSS = `
html,body{margin:0;padding:0;width:1080px;height:1920px;overflow:hidden;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}
.frame{width:1080px;height:1920px;padding:80px;display:flex;flex-direction:column;position:relative}
.stamp{position:absolute;top:270px;right:80px;padding:14px 24px;border-radius:999px;background:#f4c317;border:2px solid #0f2b46;color:#0f2b46;font-weight:700;font-size:16pt;letter-spacing:0.08em;text-transform:uppercase;z-index:2}
.micro{font-weight:700;font-size:18pt;letter-spacing:0.1em;text-transform:uppercase;padding:12px 22px;border-radius:999px;display:inline-block;align-self:flex-start}
.safe-top{position:absolute;top:0;left:0;right:0;height:250px;pointer-events:none}
.safe-bot{position:absolute;bottom:0;left:0;right:0;height:250px;pointer-events:none}
.headline{font-weight:700;letter-spacing:-0.015em;line-height:1.02}
.body{font-weight:500;line-height:1.35}
.sticker-ghost{border:2px dashed rgba(255,255,255,0.35);border-radius:24px;padding:22px 28px;font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);display:flex;align-items:center;justify-content:center;gap:12px}
.sticker-ghost.dark{border-color:rgba(15,43,70,0.35);color:rgba(15,43,70,0.7)}
.underline-terra{height:8px;width:280px;background:#c86b4a;border-radius:4px;margin-top:24px}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle}}</style></head><body><div class='frame'>${inner}</div></body></html>`;
}

const stamp = (text = 'Launch · Week 4') => `<div class='stamp'>${text}</div>`;

// Frame 1: Hook — navy, terra underline
const f1 = page({
  bodyStyle: 'background:#0f2b46;color:#f2f6fa',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.16);color:#f4c317;margin-top:240px'>Ground Truth · Now On Your Phone</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:center;margin-top:-80px'>
      <div class='headline' style='font-size:108px;color:#f2f6fa'>African<br/>Data Layer<br/>is live on<br/>mobile.</div>
      <div class='underline-terra'></div>
      <div class='body' style='font-size:30pt;color:rgba(242,246,250,0.72);margin-top:32px;max-width:880px'>iOS. Android. Built for the field — now in your pocket.</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:18px;margin-bottom:280px'>
      <div class='sticker-ghost' style='align-self:flex-start;background:rgba(244,195,23,0.12);border-color:#f4c317;color:#f4c317'>Live now → tap to read</div>
    </div>
  `,
});

// Frame 2: Link drive — terra
const f2 = page({
  bodyStyle: 'background:#c86b4a;color:#f2f6fa',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(15,43,70,0.18);color:#0f2b46;margin-top:240px'>Tap Either · Both Work</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:center;margin-top:-60px'>
      <div class='headline' style='font-size:124px;color:#0f2b46'>Tap to<br/>download.</div>
      <div style='height:8px;width:320px;background:#f4c317;border-radius:4px;margin-top:28px'></div>
      <div class='body' style='font-size:34pt;color:rgba(15,43,70,0.85);margin-top:34px;font-weight:700'>App Store. Play Store.<br/>Both live.</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div class='sticker-ghost dark' style='background:rgba(15,43,70,0.06);border-color:#0f2b46;color:#0f2b46;justify-content:space-between'>
        <span>App Store · iOS</span><span>↗</span>
      </div>
      <div class='sticker-ghost dark' style='background:rgba(15,43,70,0.06);border-color:#0f2b46;color:#0f2b46;justify-content:space-between'>
        <span>Play Store · Android</span><span>↗</span>
      </div>
    </div>
  `,
});

// Frame 3: Quiz harvest — navy-wash
const f3 = page({
  bodyStyle: 'background:#f2f6fa;color:#0f2b46',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a;margin-top:240px'>Quiz · Pick One</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:flex-start;margin-top:60px'>
      <div class='headline' style='font-size:104px;color:#0f2b46'>First<br/>quartier<br/>you'd map?</div>
      <div style='height:8px;width:240px;background:#c86b4a;border-radius:4px;margin-top:28px'></div>
      <div class='body' style='font-size:26pt;color:rgba(15,43,70,0.7);margin-top:30px;max-width:900px'>Pick one. We will feature the top vote in the highlight.</div>
    </div>
    <div style='display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:280px'>
      <div style='padding:24px;border-radius:20px;background:#ffffff;border:2px solid rgba(15,43,70,0.18);font-weight:700;font-size:22pt;color:#0f2b46'>Bonamoussadi</div>
      <div style='padding:24px;border-radius:20px;background:#ffffff;border:2px solid rgba(15,43,70,0.18);font-weight:700;font-size:22pt;color:#0f2b46'>Akwa</div>
      <div style='padding:24px;border-radius:20px;background:#ffffff;border:2px solid rgba(15,43,70,0.18);font-weight:700;font-size:22pt;color:#0f2b46'>Bonapriso</div>
      <div style='padding:24px;border-radius:20px;background:#ffffff;border:2px solid rgba(15,43,70,0.18);font-weight:700;font-size:22pt;color:#0f2b46'>Other</div>
    </div>
  `,
});

// Frame 4: Question support hook — forest-wash
const f4 = page({
  bodyStyle: 'background:#eef4ef;color:#0f2b46',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.22);color:#2f5438;margin-top:240px'>DM Support · This Week</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:flex-start;margin-top:60px'>
      <div style='height:8px;width:120px;background:#4c7c59;border-radius:4px;margin-bottom:28px'></div>
      <div class='headline' style='font-size:96px;color:#0f2b46'>Need help<br/>with your<br/>first capture?</div>
      <div class='body' style='font-size:30pt;color:rgba(15,43,70,0.78);margin-top:34px;max-width:920px'>DM us "MAP" or "CARTE" — we will walk you through it this week.</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div style='padding:22px 28px;border-radius:24px;border:2px dashed rgba(15,43,70,0.4);font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:rgba(15,43,70,0.7);background:rgba(255,255,255,0.5)'>Question · Ask us anything about your first capture</div>
      <div class='sticker-ghost dark' style='border-color:#0f2b46;color:#0f2b46;background:rgba(15,43,70,0.06);justify-content:space-between'>
        <span>Tap to download</span><span>↗</span>
      </div>
    </div>
  `,
});

const frames = [
  { id: '01', html: f1 },
  { id: '02', html: f2 },
  { id: '03', html: f3 },
  { id: '04', html: f4 },
];

await writeFile(resolve(here, 'frames.json'), JSON.stringify(frames, null, 2), 'utf8');
console.log(`wrote ${frames.length} frames to frames.json`);
