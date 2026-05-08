#!/usr/bin/env node
// Build frames.json for Week 4 Thu Anatomy story (EN, 4 frames, 1080x1920)
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
.headline{font-weight:700;letter-spacing:-0.015em;line-height:1.02}
.body{font-weight:500;line-height:1.35}
.sticker-ghost{border:2px dashed rgba(15,43,70,0.35);border-radius:24px;padding:22px 28px;font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:rgba(15,43,70,0.7);display:flex;align-items:center;justify-content:center;gap:12px;background:rgba(255,255,255,0.5)}
.poll-ghost{border:2px solid rgba(15,43,70,0.18);border-radius:20px;background:#ffffff;display:grid;grid-template-columns:1fr 1fr;overflow:hidden}
.poll-ghost > div{padding:24px;font-weight:700;font-size:22pt;color:#0f2b46;text-align:center}
.poll-ghost > div + div{border-left:2px solid rgba(15,43,70,0.12)}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle}}</style></head><body><div class='frame'>${inner}</div></body></html>`;
}

const stamp = () => `<div class='stamp'>Launch · Week 4</div>`;

// Frame 1: Hook — navy
const f1 = page({
  bodyStyle: 'background:#0f2b46;color:#f2f6fa',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.16);color:#f4c317;margin-top:240px'>Ground Truth · Anatomy</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:center;margin-top:-80px'>
      <div class='headline' style='font-size:96px;color:#f2f6fa'>What<br/>"verified"<br/>actually<br/>means.</div>
      <div style='height:8px;width:280px;background:#c86b4a;border-radius:4px;margin-top:28px'></div>
      <div class='body' style='font-size:28pt;color:rgba(242,246,250,0.7);margin-top:30px;max-width:880px'>Five gates. One submission. Same chain on every device.</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div style='align-self:flex-start;padding:22px 28px;border-radius:24px;border:2px dashed #f4c317;background:rgba(244,195,23,0.12);font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>Swipe the gates → tap to read</div>
    </div>
  `,
});

// Frame 2: Poll harvest — navy-wash, two stacked polls
const f2 = page({
  bodyStyle: 'background:#f2f6fa;color:#0f2b46',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a;margin-top:240px'>Two Polls · Pick One Each</div>
    <div style='margin-top:50px'>
      <div class='headline' style='font-size:84px;color:#0f2b46'>Which gate<br/>surprised you<br/>most?</div>
      <div style='height:8px;width:200px;background:#c86b4a;border-radius:4px;margin-top:24px'></div>
    </div>
    <div style='display:flex;flex-direction:column;gap:24px;margin-top:60px'>
      <div>
        <div style='font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:rgba(15,43,70,0.6);margin-bottom:10px'>Poll A</div>
        <div class='poll-ghost'>
          <div>GPS lock</div><div>EXIF check</div>
        </div>
      </div>
      <div>
        <div style='font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:rgba(15,43,70,0.6);margin-bottom:10px'>Poll B</div>
        <div class='poll-ghost'>
          <div>Duplicate check</div><div>Risk score</div>
        </div>
      </div>
    </div>
    <div style='margin-top:auto;margin-bottom:280px;font-weight:500;font-size:22pt;color:rgba(15,43,70,0.55);max-width:900px'>Two votes — one from each.</div>
  `,
});

// Frame 3: Quiz — forest-wash, ghost 5 numeral
const f3 = page({
  bodyStyle: 'background:#eef4ef;color:#0f2b46',
  inner: `
    ${stamp()}
    <div style='position:absolute;right:-40px;top:380px;font-weight:700;font-size:680pt;line-height:1;color:rgba(76,124,89,0.12);font-family:Inter;letter-spacing:-0.06em'>5</div>
    <div class='micro' style='background:rgba(76,124,89,0.22);color:#2f5438;margin-top:240px;position:relative;z-index:2'>Quiz · One Answer</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:flex-start;margin-top:60px;position:relative;z-index:2'>
      <div style='height:8px;width:160px;background:#4c7c59;border-radius:4px;margin-bottom:28px'></div>
      <div class='headline' style='font-size:88px;color:#0f2b46'>How many<br/>gates does a<br/>submission<br/>cross?</div>
      <div class='body' style='font-size:26pt;color:rgba(15,43,70,0.7);margin-top:30px'>One answer. Tap to find out.</div>
    </div>
    <div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:280px;position:relative;z-index:2'>
      <div style='padding:32px;border-radius:24px;background:#ffffff;border:2px solid rgba(15,43,70,0.18);font-weight:700;font-size:36pt;color:#0f2b46;text-align:center'>3</div>
      <div style='padding:32px;border-radius:24px;background:#ffffff;border:2px solid #4c7c59;font-weight:700;font-size:36pt;color:#0f2b46;text-align:center;box-shadow:0 0 0 6px rgba(76,124,89,0.18)'>5</div>
      <div style='padding:32px;border-radius:24px;background:#ffffff;border:2px solid rgba(15,43,70,0.18);font-weight:700;font-size:36pt;color:#0f2b46;text-align:center'>7</div>
    </div>
  `,
});

// Frame 4: Question content harvest — terra-wash
const f4 = page({
  bodyStyle: 'background:#fff8f4;color:#0f2b46',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.22);color:#a14a30;margin-top:240px'>Question · Tell Us</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:flex-start;margin-top:60px'>
      <div style='height:8px;width:200px;background:#c86b4a;border-radius:4px;margin-bottom:28px'></div>
      <div class='headline' style='font-size:88px;color:#0f2b46'>What else<br/>should we<br/>verify?</div>
      <div class='body' style='font-size:30pt;color:rgba(15,43,70,0.78);margin-top:30px;max-width:920px'>Tell us. We will fold the best ideas into the next pipeline post.</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div class='sticker-ghost'>Question · Tell us what we should add to the pipeline</div>
      <div class='sticker-ghost' style='justify-content:space-between'>
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
