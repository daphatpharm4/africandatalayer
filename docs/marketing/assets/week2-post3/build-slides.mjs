#!/usr/bin/env node
// Build slides.json for Fun Fact Friday #01 (OTC pharmacies / pharmacie de garde)
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
.big-number{font-weight:700;font-size:320px;line-height:0.85;letter-spacing:-0.04em}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = (n) => `<div class='stamp'>Fun Fact Friday · ${n}</div>`;

// ---------- Slide 1 — Navy cover. Big gold #01, pharmacy cross glyph, clear hierarchy.
const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp('01')}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Ground Truth · Education</div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:72px'>
      <div style='font-weight:700;font-size:260px;line-height:0.85;letter-spacing:-0.04em;color:#f4c317'>01</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Fun Fact<br/>Friday</div>
        <div style='width:64px;height:4px;background:#c86b4a;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>A series by ADL</div>
      </div>
    </div>
    <div style='margin-top:96px'>
      <div style='font-weight:700;font-size:88px;line-height:1.02;letter-spacing:-0.015em'>OTC Pharmacies<br/>in Cameroon.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:880px'>Six slides. One thing most maps miss about how medicine actually reaches a Douala neighborhood at 2am.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65)'>
      <div style='width:32px;height:2px;background:#f4c317'></div>
      Swipe →
    </div>
  `,
});

// ---------- Slide 2 — Navy-wash. Clock icon, setup hook + body.
const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp('01')}
    <div class='micro' style='background:rgba(200,107,74,0.14);color:#c86b4a'>The Setup</div>
    <div class='icon-chip' style='background:#fff8f4;margin-top:40px'>
      <svg viewBox='0 0 24 24' stroke='#c86b4a'><circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/></svg>
    </div>
    <div style='font-weight:700;font-size:62px;line-height:1.04;letter-spacing:-0.01em;margin-top:40px'>In Cameroon,<br/>the pharmacy open tonight<br/>isn't the same<br/>as last Friday.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:32px;max-width:920px'>Not a bug. Not a coincidence. A rotation — and it's been running quietly for decades.</div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.6)'>"And it's not random."</div>
    <div class='page-num' style='color:#0f2b46'>02 / 06</div>
  `,
});

// ---------- Slide 3 — Terra-wash. The reveal.
const s3 = page({
  bodyStyle: "background:#fff8f4;color:#0f2b46",
  inner: `
    ${stamp('01')}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>The Fact</div>
    <div style='font-weight:700;font-size:72px;line-height:1.02;letter-spacing:-0.015em;margin-top:48px'>It's called<br/><span style='color:#c86b4a'>"pharmacie<br/>de garde."</span></div>
    <div style='font-weight:500;font-size:27pt;line-height:1.35;margin-top:36px;max-width:920px'>Licensed pharmacies rotate 24/7 duty on a weekly schedule, set by the regional pharmacists' council.</div>
    <div style='display:flex;gap:16px;margin-top:36px;flex-wrap:wrap'>
      <div style='padding:14px 22px;border-radius:16px;background:#0f2b46;color:#f2f6fa;font-weight:600;font-size:17pt'>Weekly rotation</div>
      <div style='padding:14px 22px;border-radius:16px;background:#c86b4a;color:#fff8f4;font-weight:600;font-size:17pt'>24 hours open</div>
      <div style='padding:14px 22px;border-radius:16px;background:#f4c317;color:#0f2b46;font-weight:600;font-size:17pt'>One per quartier</div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65);max-width:900px'>"One neighborhood, one open pharmacy, all night — then the baton passes."</div>
    <div class='page-num' style='color:#0f2b46'>03 / 06</div>
  `,
});

// ---------- Slide 4 — Forest-wash. Why it exists.
const s4 = page({
  bodyStyle: "background:#eaf1ec;color:#0f2b46",
  inner: `
    ${stamp('01')}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Why It Exists</div>
    <div class='accent-bar' style='background:#4c7c59'></div>
    <div style='font-weight:700;font-size:64px;line-height:1.02;letter-spacing:-0.01em'>Access by design,<br/>not by accident.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;max-width:920px'>Cameroonian law requires continuous access to essential medicines. Running every pharmacy 24/7 isn't viable. The rotation spreads the load so no quartier is ever blacked out at 2am.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:44px'>
      <div style='padding:28px;border-radius:24px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Coverage</div>
        <div style='font-weight:700;font-size:28pt;margin-top:10px;line-height:1.15'>Every<br/>quartier</div>
      </div>
      <div style='padding:28px;border-radius:24px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Cadence</div>
        <div style='font-weight:700;font-size:28pt;margin-top:10px;line-height:1.15'>Every<br/>night</div>
      </div>
      <div style='padding:28px;border-radius:24px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Load</div>
        <div style='font-weight:700;font-size:28pt;margin-top:10px;line-height:1.15'>Shared<br/>rotation</div>
      </div>
      <div style='padding:28px;border-radius:24px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Source</div>
        <div style='font-weight:700;font-size:28pt;margin-top:10px;line-height:1.15'>Regional<br/>council</div>
      </div>
    </div>
    <div class='page-num' style='color:#0f2b46'>04 / 06</div>
  `,
});

// ---------- Slide 5 — Navy-wash. The data gap.
const s5 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp('01')}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>The Data Gap</div>
    <div style='display:flex;gap:24px;margin-top:40px'>
      <div class='icon-chip' style='background:rgba(244,195,23,0.2)'>
        <svg viewBox='0 0 24 24' stroke='#0f2b46'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/></svg>
      </div>
      <div class='icon-chip' style='background:rgba(200,107,74,0.18)'>
        <svg viewBox='0 0 24 24' stroke='#c86b4a'><path d='M4 4l16 16'/><path d='M20 4L4 20'/></svg>
      </div>
    </div>
    <div style='font-weight:700;font-size:64px;line-height:1.02;letter-spacing:-0.01em;margin-top:40px'>Static maps<br/>can't keep up.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;max-width:920px'>Garde schedules shift weekly. Google Maps and most directories don't track it. In an emergency, families call around until someone answers.</div>
    <div style='margin-top:44px;padding:32px;border-radius:24px;background:#0f2b46;color:#f2f6fa;max-width:940px'>
      <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>The ADL Angle</div>
      <div style='font-weight:600;font-size:26pt;line-height:1.25;margin-top:12px'>Weekly-changing data is exactly what ground-truth field mapping is built for.</div>
    </div>
    <div style='margin-top:auto;font-weight:700;font-size:22pt;color:#c86b4a'>That's the gap we're mapping.</div>
    <div class='page-num' style='color:#0f2b46'>05 / 06</div>
  `,
});

// ---------- Slide 6 — Terra. CTA + series promise.
const s6 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp('01')}
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>Every Friday · A New Fact</div>
    <div style='margin-top:56px'>
      <div style='font-weight:700;font-size:86px;line-height:1.02;letter-spacing:-0.015em'>One fact<br/>from the field,<br/>every Friday.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;color:rgba(15,43,70,0.82);max-width:900px'>Educational series by African Data Layer — grassroots data infrastructure from Douala, Cameroon.</div>
    </div>
    <div style='margin-top:56px;display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px'>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>Next</div>
        <div style='font-weight:700;font-size:22pt;margin-top:6px;line-height:1.2'>#02 — Mobile money density</div>
      </div>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>Drops</div>
        <div style='font-weight:700;font-size:22pt;margin-top:6px;line-height:1.2'>Fri 2026-05-01</div>
      </div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:22pt;display:flex;align-items:center;gap:14px'>
        <span>Follow @africandatalayer</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>Save this · Share with a friend who didn't know about <b>garde</b>.</div>
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
