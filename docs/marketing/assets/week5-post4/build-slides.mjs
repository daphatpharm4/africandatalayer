#!/usr/bin/env node
// Build slides.json for Week 5, Post 4 — "Saturday at street level" (Sat 2026-05-16)
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
.page-num{position:absolute;bottom:56px;right:72px;font-weight:700;font-size:13pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.55}
.corner-accent{position:absolute;bottom:0;left:0;width:240px;height:240px;background:#c86b4a;opacity:0.6;border-top-right-radius:240px;z-index:0}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Week 05 · From The Quartier</div>`;

// Slide 1 — Hero
const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='corner-accent'></div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:32px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:200px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>Sat</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>A Note<br/>From The Quartier</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Bonamoussadi · Douala</div>
      </div>
    </div>
    <div style='margin-top:96px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:104px;line-height:1.0;letter-spacing:-0.02em'>Saturday at<br/>street level.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65);position:relative;z-index:1'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Three things only the street knows →
    </div>
  `,
});

// Slide 2 — Pharmacy
const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Observation 01</div>
    <div style='font-weight:700;font-size:96px;line-height:0.95;letter-spacing:-0.02em;color:#0f2b46;margin-top:48px;opacity:0.12'>01</div>
    <div style='font-weight:700;font-size:64px;line-height:1.06;letter-spacing:-0.01em;margin-top:-32px;max-width:920px'>A pharmacy stays open later than its sign says.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>The sign was painted in 2019. The hours moved last year. Only the street knows.</div>
    <div class='page-num' style='color:#0f2b46'>02 / 05</div>
  `,
});

// Slide 3 — Mobile money
const s3 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>Observation 02</div>
    <div style='font-weight:700;font-size:96px;line-height:0.95;letter-spacing:-0.02em;color:#0f2b46;margin-top:48px;opacity:0.12'>02</div>
    <div style='font-weight:700;font-size:64px;line-height:1.06;letter-spacing:-0.01em;margin-top:-32px;max-width:920px'>A kiosk runs out of credit by 7pm.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>Mobile money fluctuates with payday and supply. The map should fluctuate too.</div>
    <div class='page-num' style='color:#0f2b46'>03 / 05</div>
  `,
});

// Slide 4 — Billboard
const s4 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>Observation 03</div>
    <div style='font-weight:700;font-size:96px;line-height:0.95;letter-spacing:-0.02em;color:#0f2b46;margin-top:48px;opacity:0.12'>03</div>
    <div style='font-weight:700;font-size:64px;line-height:1.06;letter-spacing:-0.01em;margin-top:-32px;max-width:920px'>A billboard changed last Tuesday.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>Static infrastructure isn't static. The quartier moves. The data should keep up.</div>
    <div class='page-num' style='color:#0f2b46'>04 / 05</div>
  `,
});

// Slide 5 — CTA
const s5 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='corner-accent' style='background:#0f2b46;opacity:0.18'></div>
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46;position:relative;z-index:1'>Walked This Week? Thank You.</div>
    <div style='margin-top:48px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:72px;line-height:1.04;letter-spacing:-0.015em'>The quartier already<br/>knows.</div>
      <div style='font-weight:700;font-size:72px;line-height:1.04;letter-spacing:-0.015em;color:#f4c317;margin-top:14px'>We just write it down.</div>
      <div style='font-weight:500;font-size:24pt;line-height:1.35;margin-top:32px;color:rgba(15,43,70,0.85);max-width:920px'>Field agents in Douala — beta is open.</div>
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
