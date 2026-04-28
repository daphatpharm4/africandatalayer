#!/usr/bin/env node
// Build slides.json for Week 3, Post 1 — "A morning with an ADL agent" (beta recruit, Tue 2026-04-28)
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
.timestamp{font-weight:700;font-size:128px;line-height:0.85;letter-spacing:-0.04em;font-variant-numeric:tabular-nums}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Beta · Week 3</div>`;

// ---------- Slide 1 — Navy hero. Big terra "01" + recruit headline.
const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Ground Truth · Field Work</div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:72px'>
      <div style='font-weight:700;font-size:240px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>01</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>A morning<br/>with ADL</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Beta — Douala</div>
      </div>
    </div>
    <div style='margin-top:96px'>
      <div style='font-weight:700;font-size:88px;line-height:1.02;letter-spacing:-0.015em'>A morning<br/>with an ADL<br/>agent.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:880px'>Five slides. Three timestamps. One real route through Bonamoussadi — and what the work pays.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65)'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Swipe →
    </div>
  `,
});

// ---------- Slide 2 — Navy-wash. 08:14 setup.
const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.14);color:#c86b4a'>The Route</div>
    <div class='icon-chip' style='background:#fff8f4;margin-top:40px'>
      <svg viewBox='0 0 24 24' stroke='#c86b4a'><circle cx='12' cy='12' r='3'/><path d='M12 2v4M12 18v4M2 12h4M18 12h4'/></svg>
    </div>
    <div class='timestamp' style='color:#c86b4a;margin-top:32px'>08:14</div>
    <div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.01em;margin-top:24px'>On foot in<br/>Bonamoussadi.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>Three stops on today's route: a pharmacy, a fuel station, a mobile money kiosk.</div>
    <div style='display:flex;gap:14px;margin-top:32px;flex-wrap:wrap'>
      <div style='padding:12px 20px;border-radius:14px;background:#0f2b46;color:#f2f6fa;font-weight:600;font-size:16pt'>Pharmacy</div>
      <div style='padding:12px 20px;border-radius:14px;background:#c86b4a;color:#fff8f4;font-weight:600;font-size:16pt'>Fuel station</div>
      <div style='padding:12px 20px;border-radius:14px;background:#f4c317;color:#0f2b46;font-weight:600;font-size:16pt'>Mobile money</div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.6)'>"No briefcase. No headquarters. Just the quartier."</div>
    <div class='page-num' style='color:#0f2b46'>02 / 05</div>
  `,
});

// ---------- Slide 3 — Forest-wash. 09:02 first capture.
const s3 = page({
  bodyStyle: "background:#eaf1ec;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>The Capture</div>
    <div class='accent-bar' style='background:#4c7c59'></div>
    <div class='timestamp' style='color:#4c7c59;margin-top:8px'>09:02</div>
    <div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.01em;margin-top:24px'>First capture.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:24px;max-width:920px'>GPS locks the spot. Camera snaps. EXIF stamps the moment. Queue holds it if signal drops.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:36px;max-width:920px'>
      <div style='padding:24px;border-radius:20px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>GPS lock</div>
        <div style='font-weight:700;font-size:22pt;margin-top:8px;line-height:1.2'>Inside geofence</div>
      </div>
      <div style='padding:24px;border-radius:20px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Photo + EXIF</div>
        <div style='font-weight:700;font-size:22pt;margin-top:8px;line-height:1.2'>Timestamp · Device</div>
      </div>
      <div style='padding:24px;border-radius:20px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Offline queue</div>
        <div style='font-weight:700;font-size:22pt;margin-top:8px;line-height:1.2'>Holds on 2G</div>
      </div>
      <div style='padding:24px;border-radius:20px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Auto sync</div>
        <div style='font-weight:700;font-size:22pt;margin-top:8px;line-height:1.2'>On reconnect</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>"Bad network is not your problem anymore."</div>
    <div class='page-num' style='color:#0f2b46'>03 / 05</div>
  `,
});

// ---------- Slide 4 — Navy-wash + gold accent. 11:30 trust climbs.
const s4 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>The Payoff</div>
    <div class='accent-bar' style='background:#f4c317'></div>
    <div class='timestamp' style='color:#c86b4a;margin-top:8px'>11:30</div>
    <div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.01em;margin-top:24px'>Trust score<br/>climbs.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>Three points clear review by lunch. Streak holds. XP banks. Verified work, recognized fast.</div>
    <div style='margin-top:40px;padding:32px;border-radius:24px;background:#0f2b46;color:#f2f6fa;max-width:940px'>
      <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>The ADL Pipeline</div>
      <div style='font-weight:600;font-size:24pt;line-height:1.3;margin-top:12px'>GPS + EXIF + risk score + trust tier — every submission gets audited before it lands on the public map.</div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>"Verified work, recognized fast."</div>
    <div class='page-num' style='color:#0f2b46'>04 / 05</div>
  `,
});

// ---------- Slide 5 — Terra. CTA + apply.
const s5 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>Beta · Apply Now</div>
    <div style='margin-top:56px'>
      <div style='font-weight:700;font-size:80px;line-height:1.02;letter-spacing:-0.015em'>Grassroots<br/>data work —<br/>paid in real<br/>rewards.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;color:rgba(15,43,70,0.82);max-width:900px'>Beta opening for Douala field agents. If you know your quartier and want to map it for real rewards — apply this week.</div>
    </div>
    <div style='margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px'>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>EN keyword</div>
        <div style='font-weight:700;font-size:24pt;margin-top:6px;line-height:1.2'>DM "AGENT"</div>
      </div>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>FR keyword</div>
        <div style='font-weight:700;font-size:24pt;margin-top:6px;line-height:1.2'>DM « TERRAIN »</div>
      </div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:22pt;display:flex;align-items:center;gap:14px'>
        <span>Apply this week</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>We reply within the week. Save this. Send to a friend in Douala.</div>
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
