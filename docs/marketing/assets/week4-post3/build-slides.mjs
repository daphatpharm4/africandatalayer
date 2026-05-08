#!/usr/bin/env node
// Build slides.json for Week 4, FFF #03 — Fuel price volatility (Fri 2026-05-08)
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
.icon-chip{width:112px;height:112px;border-radius:32px;display:flex;align-items:center;justify-content:center}
.icon-chip svg{width:60px;height:60px;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Fun Fact Friday · 03</div>`;

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Ground Truth · Education</div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:72px'>
      <div style='font-weight:700;font-size:240px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>03</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Fun Fact<br/>Friday</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Fuel · Cameroon</div>
      </div>
    </div>
    <div style='margin-top:96px'>
      <div style='font-weight:700;font-size:80px;line-height:1.02;letter-spacing:-0.015em'>Fuel in<br/>Cameroon.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:880px'>The pump price you saw last week is not necessarily the pump price today.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65)'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Swipe →
    </div>
  `,
});

const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.14);color:#c86b4a'>The Hook</div>
    <div class='icon-chip' style='background:#fff8f4;margin-top:40px'>
      <svg viewBox='0 0 24 24' stroke='#c86b4a'><path d='M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16'/><path d='M3 21h15M16 9h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2'/></svg>
    </div>
    <div style='font-weight:700;font-size:62px;line-height:1.04;letter-spacing:-0.01em;margin-top:32px'>Last week's price<br/>is not today's price.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>It can change between two stations on the same boulevard. It can change between morning and afternoon.</div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:24pt;color:rgba(15,43,70,0.6)'>"And it can change before lunch."</div>
    <div class='page-num' style='color:#0f2b46'>02 / 06</div>
  `,
});

const s3 = page({
  bodyStyle: "background:#fff8f4;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>The Setup</div>
    <div class='accent-bar' style='background:#c86b4a'></div>
    <div style='font-weight:700;font-size:60px;line-height:1.04;letter-spacing:-0.01em;margin-top:8px'>Pump prices are not<br/>a flat national number<br/>in practice.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>Stations adjust. Supply tightens. Informal vendors fill gaps. The number on the sign is the number at that station, that hour, that quartier.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:32px;max-width:960px'>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(200,107,74,0.25)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Station</div>
        <div style='font-weight:700;font-size:18pt;margin-top:6px;line-height:1.2'>Local choice</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(200,107,74,0.25)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Hour</div>
        <div style='font-weight:700;font-size:18pt;margin-top:6px;line-height:1.2'>Time-bound</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(200,107,74,0.25)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Quartier</div>
        <div style='font-weight:700;font-size:18pt;margin-top:6px;line-height:1.2'>Place-bound</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>"The map of fuel is a map of time, not just place."</div>
    <div class='page-num' style='color:#0f2b46'>03 / 06</div>
  `,
});

const s4 = page({
  bodyStyle: "background:#eaf1ec;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Why It Matters</div>
    <div class='accent-bar' style='background:#4c7c59'></div>
    <div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.01em;margin-top:8px'>When the price moves,<br/>the city moves with it.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.35;margin-top:24px;max-width:920px'>Drivers reroute. Moto-taxi fares move. Delivery margins compress. Households make weekly decisions on partial information.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:32px;max-width:920px'>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Drivers</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Reroute weekly</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Moto-taxis</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Fares shift</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Delivery</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Margins compress</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Households</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Plan the week</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>"When the price moves, the city moves with it."</div>
    <div class='page-num' style='color:#0f2b46'>04 / 06</div>
  `,
});

const s5 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>Why Static Maps Miss It</div>
    <div class='accent-bar' style='background:#f4c317'></div>
    <div style='font-weight:700;font-size:62px;line-height:1.04;letter-spacing:-0.01em;margin-top:8px'>Most directories list a<br/>station once and never<br/>check back.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>ADL's fuel vertical captures price + supply state at the pump — geotagged, time-stamped, verified.</div>
    <div style='margin-top:32px;padding:30px;border-radius:24px;background:#0f2b46;color:#f2f6fa;max-width:940px'>
      <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>Static vs Ground Truth</div>
      <div style='display:flex;gap:14px;margin-top:18px;flex-wrap:wrap'>
        <div style='padding:10px 16px;border-radius:12px;background:rgba(200,107,74,0.25);font-weight:700;font-size:16pt'>Static · rots</div>
        <div style='padding:10px 16px;border-radius:12px;background:rgba(76,124,89,0.4);font-weight:700;font-size:16pt'>Ground truth · refreshes</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>"Ground truth refreshes. Static lists rot."</div>
    <div class='page-num' style='color:#0f2b46'>05 / 06</div>
  `,
});

const s6 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>What Verified Data Is For</div>
    <div style='margin-top:48px'>
      <div style='font-weight:700;font-size:80px;line-height:1.02;letter-spacing:-0.015em'>Real prices.<br/>Real time.<br/>Real quartier.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;color:rgba(15,43,70,0.82);max-width:900px'>This is what verified data is for. Drivers, households, planners, analysts — same map, different decisions.</div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:22pt;display:flex;align-items:center;gap:14px'>
        <span>Download · DM "MAP" or "CARTE"</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>FFF #04 next Friday — tell us which Cameroonian system to cover.</div>
    </div>
  `,
});

const slides = [
  { id: '01', html: s1 },
  { id: '02', html: s2 },
  { id: '03', html: s3 },
  { id: '04', html: s4 },
  { id: '05', html: s5 },
  { id: '06', html: s6 },
];

await writeFile(resolve(here, 'slides.json'), JSON.stringify(slides, null, 2), 'utf8');
console.log(`wrote ${slides.length} slides to slides.json`);
