#!/usr/bin/env node
// Build slides.json for Week 4, Post 2 — "Anatomy of a verified point" (Thu 2026-05-07)
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
.ghost{position:absolute;font-weight:700;font-size:340px;line-height:0.85;letter-spacing:-0.04em;opacity:0.08;top:80px;right:90px;z-index:0}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Launch · Week 4</div>`;

function gate({ bg, micro, microColor, microBg, accent, num, title, body, line, pageNum, textColor }) {
  return page({
    bodyStyle: `background:${bg};color:${textColor||'#0f2b46'}`,
    inner: `
      ${stamp()}
      <div class='ghost' style='color:${accent}'>${num}</div>
      <div class='micro' style='background:${microBg};color:${microColor}'>${micro}</div>
      <div class='accent-bar' style='background:${accent}'></div>
      <div style='font-weight:700;font-size:60px;line-height:1.04;letter-spacing:-0.01em;margin-top:8px;position:relative;z-index:1'>${title}</div>
      <div style='font-weight:500;font-size:24pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px;position:relative;z-index:1'>${body}</div>
      <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65);position:relative;z-index:1'>"${line}"</div>
      <div class='page-num' style='color:#0f2b46'>${pageNum} / 06</div>
    `,
  });
}

// Slide 1 — Navy hero
const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Ground Truth · Anatomy</div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:72px'>
      <div style='font-weight:700;font-size:240px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>5</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Gates<br/>Per Point</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Verification chain</div>
      </div>
    </div>
    <div style='margin-top:96px'>
      <div style='font-weight:700;font-size:80px;line-height:1.02;letter-spacing:-0.015em'>What "verified"<br/>actually means.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:880px'>Six slides. Five gates. Every submission you see on the map crossed all of them.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65)'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Swipe →
    </div>
  `,
});

const s2 = gate({
  bg: '#f2f6fa', accent: '#c86b4a', num: '1',
  micro: 'Gate 1 · GPS Lock', microBg: 'rgba(200,107,74,0.14)', microColor: '#c86b4a',
  title: 'Coordinates captured<br/>at the source.',
  body: 'Velocity and travel distance checked against the agent\'s last point. Impossible jumps get flagged before the data lands.',
  line: 'Teleporters get caught here.', pageNum: '02',
});

const s3 = gate({
  bg: '#eaf1ec', accent: '#4c7c59', num: '2',
  micro: 'Gate 2 · Photo + EXIF', microBg: 'rgba(76,124,89,0.18)', microColor: '#2f5438',
  title: 'Read the metadata<br/>before trusting the picture.',
  body: 'Image lands with timestamp, device fingerprint, and capture metadata. Recycled photos do not match. They do not pass.',
  line: 'Recycled photos do not pass.', pageNum: '03',
});

const s4 = gate({
  bg: '#f2f6fa', accent: '#f4c317', num: '3',
  micro: 'Gate 3 · Duplicate Check', microBg: 'rgba(244,195,23,0.28)', microColor: '#0f2b46',
  title: 'Same place, same day,<br/>same phone?',
  body: 'The platform asks before it accepts. Duplicate clusters route to review instead of inflating the dataset.',
  line: 'One real point beats five duplicates.', pageNum: '04',
});

const s5 = gate({
  bg: '#fff8f4', accent: '#c86b4a', num: '4',
  micro: 'Gate 4 · Risk Score', microBg: 'rgba(200,107,74,0.18)', microColor: '#c86b4a',
  title: 'Every submission gets<br/>a numeric risk read.',
  body: 'Low risk goes through. Higher risk routes to admin review. Suspicious patterns surface — they do not slip through.',
  line: 'Suspicious patterns surface, not slip through.', pageNum: '05',
});

// Slide 6 — Terra CTA
const s6 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='ghost' style='color:rgba(15,43,70,0.08)'>5</div>
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>Gate 5 · Trust Tier</div>
    <div style='margin-top:32px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:64px;line-height:1.02;letter-spacing:-0.015em'>Higher-tier agents<br/>earn more weight<br/>on the dataset.</div>
      <div style='font-weight:500;font-size:24pt;line-height:1.35;margin-top:24px;color:rgba(15,43,70,0.82);max-width:900px'>Because they've earned it. The point lands on the map only after all five gates clear.</div>
    </div>
    <div style='margin-top:32px;display:flex;gap:14px;flex-wrap:wrap;position:relative;z-index:1'>
      <div style='padding:14px 22px;border-radius:14px;background:rgba(15,43,70,0.12);font-weight:700;font-size:16pt'>Bronze</div>
      <div style='padding:14px 22px;border-radius:14px;background:rgba(15,43,70,0.18);font-weight:700;font-size:16pt'>Silver</div>
      <div style='padding:14px 22px;border-radius:14px;background:#0f2b46;color:#f4c317;font-weight:700;font-size:16pt'>Gold</div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px;position:relative;z-index:1'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:22pt;display:flex;align-items:center;gap:14px'>
        <span>Download · DM "MAP" or "CARTE"</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>That's what we mean by ground truth.</div>
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
