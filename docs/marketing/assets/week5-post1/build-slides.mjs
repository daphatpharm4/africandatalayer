#!/usr/bin/env node
// Build slides.json for Week 5, Post 1 — "The Week After Launch" (Tue 2026-05-12)
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const FONT_LINKS = `<link rel='preconnect' href='https://fonts.googleapis.com'><link rel='preconnect' href='https://fonts.gstatic.com' crossorigin><link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' rel='stylesheet'>`;

const BASE_CSS = `
html,body{margin:0;padding:0;width:1080px;height:1350px;overflow:hidden;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}
.stamp{position:absolute;top:56px;right:56px;padding:14px 24px;border-radius:999px;background:#f4c317;border:2px solid #0f2b46;color:#0f2b46;font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;z-index:2}
.micro{font-weight:700;font-size:13pt;letter-spacing:0.1em;text-transform:uppercase;padding:10px 20px;border-radius:999px;display:inline-block;align-self:flex-start}
.accent-bar{height:6px;width:96px;border-radius:3px;margin:20px 0}
.page-num{position:absolute;bottom:56px;right:72px;font-weight:700;font-size:13pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.55}
.icon-bubble{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:8px}
.corner-accent{position:absolute;bottom:0;left:0;width:240px;height:240px;background:#c86b4a;opacity:0.6;border-top-right-radius:240px;z-index:0}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Week 05 · Ground Truth</div>`;

// SVG icon helpers — simple geometric forms in stroke style, no emoji
const iconFootprints = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 16v-2.38c0-.99.6-1.88 1.5-2.27.92-.41 1.96-.51 2.95-.07.78.34 1.46.84 2.06 1.45.66.66 1.18 1.5 1.43 2.41.12.42.18.86.18 1.31V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z'/><path d='M14 8.5C14 7.12 15.12 6 16.5 6S19 7.12 19 8.5c0 .65-.25 1.24-.66 1.68-.6.65-.85 1.55-.69 2.42l.39 2.06c.12.65-.36 1.24-1.02 1.24h-2.04c-.66 0-1.14-.59-1.02-1.24l.39-2.06c.16-.87-.09-1.77-.69-2.42-.41-.44-.66-1.03-.66-1.68z'/></svg>`;

const iconLayers = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='12 2 2 7 12 12 22 7 12 2'/><polyline points='2 17 12 22 22 17'/><polyline points='2 12 12 17 22 12'/></svg>`;

const iconShield = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/><polyline points='9 12 11 14 15 10'/></svg>`;

// Slide 1 — Navy hero with terra corner + gold stamp
const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='corner-accent'></div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:32px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:200px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>05</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>The Week<br/>After Launch</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Bonamoussadi · Douala</div>
      </div>
    </div>
    <div style='margin-top:80px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:104px;line-height:1.0;letter-spacing:-0.02em'>Launch was<br/>the start.</div>
      <div style='font-weight:700;font-size:104px;line-height:1.0;letter-spacing:-0.02em;color:#f4c317;margin-top:16px'>The map is<br/>the work.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65);position:relative;z-index:1'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Five reasons →
    </div>
  `,
});

// Slide 2 — Navy-wash · footprints
const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>On The Ground</div>
    <div class='icon-bubble' style='background:rgba(76,124,89,0.18)'>${iconFootprints('#2f5438')}</div>
    <div style='font-weight:700;font-size:72px;line-height:1.04;letter-spacing:-0.01em;margin-top:32px;max-width:920px'>Streets walked,<br/>not slides shipped.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>Verified data comes from the quartier, on foot — not from a deck.</div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.6)'>"On the street, every day."</div>
    <div class='page-num' style='color:#0f2b46'>02 / 05</div>
  `,
});

// Slide 3 — Navy-wash · layers / 7 verticals
const s3 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>Seven Verticals</div>
    <div class='icon-bubble' style='background:rgba(200,107,74,0.18)'>${iconLayers('#c86b4a')}</div>
    <div style='font-weight:700;font-size:64px;line-height:1.06;letter-spacing:-0.01em;margin-top:32px;max-width:920px'>Seven verticals.<br/>One Bonamoussadi block.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr;gap:14px 28px;margin-top:36px;max-width:920px'>
      <div style='font-weight:600;font-size:22pt;color:#0f2b46'>· Pharmacies</div>
      <div style='font-weight:600;font-size:22pt;color:#0f2b46'>· Fuel stations</div>
      <div style='font-weight:600;font-size:22pt;color:#0f2b46'>· Mobile money</div>
      <div style='font-weight:600;font-size:22pt;color:#0f2b46'>· Alcohol outlets</div>
      <div style='font-weight:600;font-size:22pt;color:#0f2b46'>· Billboards</div>
      <div style='font-weight:600;font-size:22pt;color:#0f2b46'>· Transport routes</div>
      <div style='font-weight:600;font-size:22pt;color:#c86b4a'>· Census proxy</div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-size:22pt;color:rgba(15,43,70,0.65);max-width:880px'>Each captured by an agent who knows the street.</div>
    <div class='page-num' style='color:#0f2b46'>03 / 05</div>
  `,
});

// Slide 4 — Navy-wash · shield / pipeline
const s4 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Pipeline · Verified</div>
    <div class='icon-bubble' style='background:rgba(76,124,89,0.18)'>${iconShield('#2f5438')}</div>
    <div style='font-weight:700;font-size:68px;line-height:1.04;letter-spacing:-0.01em;margin-top:32px;max-width:920px'>A point isn't posted.<br/>It's cleared.</div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-top:36px;max-width:920px'>
      <div style='display:flex;align-items:center;gap:16px;font-weight:600;font-size:22pt'><span style='width:28px;height:2px;background:#4c7c59'></span>GPS lock</div>
      <div style='display:flex;align-items:center;gap:16px;font-weight:600;font-size:22pt'><span style='width:28px;height:2px;background:#4c7c59'></span>EXIF check</div>
      <div style='display:flex;align-items:center;gap:16px;font-weight:600;font-size:22pt'><span style='width:28px;height:2px;background:#4c7c59'></span>Velocity sanity</div>
      <div style='display:flex;align-items:center;gap:16px;font-weight:600;font-size:22pt'><span style='width:28px;height:2px;background:#4c7c59'></span>Risk score</div>
      <div style='display:flex;align-items:center;gap:16px;font-weight:600;font-size:22pt'><span style='width:28px;height:2px;background:#4c7c59'></span>Trust tier</div>
      <div style='display:flex;align-items:center;gap:16px;font-weight:700;font-size:22pt;color:#c86b4a;margin-top:8px'><span style='width:28px;height:2px;background:#c86b4a'></span>Then the map.</div>
    </div>
    <div class='page-num' style='color:#0f2b46'>04 / 05</div>
  `,
});

// Slide 5 — Terra CTA
const s5 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='corner-accent' style='background:#0f2b46;opacity:0.18'></div>
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46;position:relative;z-index:1'>Walk With Us</div>
    <div style='margin-top:48px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:88px;line-height:1.02;letter-spacing:-0.015em'>The map keeps<br/>growing.</div>
      <div style='font-weight:700;font-size:88px;line-height:1.02;letter-spacing:-0.015em;color:#f4c317;margin-top:14px'>Walk with us.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:32px;color:rgba(15,43,70,0.85);max-width:900px'>Field agents in Douala — beta is open.</div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:18px;position:relative;z-index:1'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:22pt;display:flex;align-items:center;gap:14px'>
        <span>DM "MAP" to join</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.75)'>Bonamoussadi · Douala · Cameroon onward</div>
    </div>
  `,
});

const slides = [
  { id: '01', html: s1 },
  { id: '02', html: s2 },
  { id: '03', html: s3 },
  { id: '04', html: s4 },
  { id: '05', html: s5 },
];

await writeFile(resolve(here, 'slides.json'), JSON.stringify(slides, null, 2), 'utf8');
console.log(`wrote ${slides.length} slides to slides.json`);
