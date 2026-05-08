#!/usr/bin/env node
// Build frames-fr.json for Week 4 Fri FFF Fuel story (FR mirror, 3 frames, 1080x1920)
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
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle}}</style></head><body><div class='frame'>${inner}</div></body></html>`;
}

const stamp = () => `<div class='stamp'>Fun Fact · #03</div>`;

const f1 = page({
  bodyStyle: 'background:#0f2b46;color:#f2f6fa',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.16);color:#f4c317;margin-top:240px'>Donnee De Terrain · FFF #03 · Douala</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:center;margin-top:-80px'>
      <div class='headline' style='font-size:96px;color:#f2f6fa'>Meme carburant.</div>
      <div class='headline' style='font-size:96px;color:#c86b4a;margin-top:-8px'>Prix differents.</div>
      <div class='headline' style='font-size:96px;color:#f2f6fa;margin-top:-8px'>Meme ville.</div>
      <div style='height:8px;width:280px;background:#c86b4a;border-radius:4px;margin-top:30px'></div>
      <div class='body' style='font-size:28pt;color:rgba(242,246,250,0.72);margin-top:30px;max-width:880px'>Trois pompes. Trois prix.</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div style='align-self:flex-start;padding:22px 28px;border-radius:24px;border:2px dashed #f4c317;background:rgba(244,195,23,0.12);font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>Glissez le fait → tapez pour lire</div>
    </div>
  `,
});

const f2 = page({
  bodyStyle: 'background:#fff8f4;color:#0f2b46',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.22);color:#a14a30;margin-top:240px'>Quiz · Devinez</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:flex-start;margin-top:60px'>
      <div style='height:8px;width:200px;background:#c86b4a;border-radius:4px;margin-bottom:28px'></div>
      <div class='headline' style='font-size:80px;color:#0f2b46'>Meme prix<br/>a chaque pompe<br/>a Douala ?</div>
      <div class='body' style='font-size:28pt;color:rgba(15,43,70,0.78);margin-top:30px;max-width:920px'>Devinez. On vous montre ce que le terrain dit.</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div style='padding:26px 28px;border-radius:20px;background:#ffffff;border:2px solid rgba(15,43,70,0.18);font-weight:700;font-size:24pt;color:#0f2b46;display:flex;justify-content:space-between'><span>Oui — partout pareil</span><span style='opacity:0.4'>A</span></div>
      <div style='padding:26px 28px;border-radius:20px;background:#ffffff;border:2px solid #c86b4a;font-weight:700;font-size:24pt;color:#0f2b46;display:flex;justify-content:space-between;box-shadow:0 0 0 6px rgba(200,107,74,0.18)'><span>Non — ca bouge</span><span style='color:#c86b4a'>B</span></div>
      <div style='padding:26px 28px;border-radius:20px;background:#ffffff;border:2px solid rgba(15,43,70,0.18);font-weight:700;font-size:24pt;color:#0f2b46;display:flex;justify-content:space-between'><span>Je ne sais pas</span><span style='opacity:0.4'>C</span></div>
    </div>
  `,
});

const f3 = page({
  bodyStyle: 'background:#eef4ef;color:#0f2b46',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.22);color:#2f5438;margin-top:240px'>Question · Idee FFF #04</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:flex-start;margin-top:60px'>
      <div style='height:8px;width:160px;background:#4c7c59;border-radius:4px;margin-bottom:28px'></div>
      <div class='headline' style='font-size:76px;color:#0f2b46'>Quel systeme<br/>camerounais<br/>ensuite ?</div>
      <div class='body' style='font-size:28pt;color:rgba(15,43,70,0.78);margin-top:30px;max-width:920px'>Suggerez — pharmacie de garde, panneaux, arrets de taxis, ou votre idee.</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div class='sticker-ghost'>Question · Suggerez un systeme</div>
      <div class='sticker-ghost' style='justify-content:space-between'>
        <span>Telecharger</span><span>↗</span>
      </div>
    </div>
  `,
});

const frames = [
  { id: '01-fr', html: f1 },
  { id: '02-fr', html: f2 },
  { id: '03-fr', html: f3 },
];

await writeFile(resolve(here, 'frames-fr.json'), JSON.stringify(frames, null, 2), 'utf8');
console.log(`wrote ${frames.length} frames to frames-fr.json`);
