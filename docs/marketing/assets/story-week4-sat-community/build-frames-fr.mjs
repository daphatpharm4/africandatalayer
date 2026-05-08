#!/usr/bin/env node
// Build frames-fr.json for Week 4 Sat Community Close story (FR mirror, 4 frames, 1080x1920)
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
.headline{font-weight:700;letter-spacing:-0.015em;line-height:1.04}
.body{font-weight:500;line-height:1.4}
.sticker-ghost{border:2px dashed rgba(15,43,70,0.35);border-radius:24px;padding:22px 28px;font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:rgba(15,43,70,0.7);display:flex;align-items:center;justify-content:center;gap:12px;background:rgba(255,255,255,0.5)}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle}}</style></head><body><div class='frame'>${inner}</div></body></html>`;
}

const stamp = () => `<div class='stamp'>Lancement · Semaine 4</div>`;

const f1 = page({
  bodyStyle: 'background:#0f2b46;color:#f2f6fa',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.16);color:#f4c317;margin-top:240px'>Donnee De Terrain · Cloture Communautaire</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:center;margin-top:-80px'>
      <div class='headline' style='font-size:80px;color:#f2f6fa'>Construit avec<br/>le quartier.</div>
      <div class='headline' style='font-size:80px;color:#c86b4a;margin-top:8px'>Construit pour<br/>le quartier.</div>
      <div style='height:8px;width:280px;background:#f4c317;border-radius:4px;margin-top:30px'></div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div style='align-self:flex-start;padding:22px 28px;border-radius:24px;border:2px dashed #f4c317;background:rgba(244,195,23,0.12);font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>Lire la note → tapez pour ouvrir</div>
    </div>
  `,
});

const f2 = page({
  bodyStyle: 'background:#c86b4a;color:#0f2b46',
  inner: `
    <div style='flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 20px'>
      <div style='font-weight:700;font-size:18pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(15,43,70,0.65);margin-bottom:28px'>Merci</div>
      <div class='headline' style='font-size:80px;color:#0f2b46'>Merci a chaque<br/>agent qui a<br/>parcouru<br/>le quartier<br/>cette semaine.</div>
      <div style='height:8px;width:200px;background:#f4c317;border-radius:4px;margin-top:32px'></div>
      <div class='body' style='font-size:32pt;color:rgba(15,43,70,0.85);margin-top:32px;font-weight:600;max-width:920px'>Chaque point verifie sur la carte est votre travail.</div>
    </div>
    <div style='margin-bottom:300px;font-weight:700;font-size:18pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(15,43,70,0.5);align-self:flex-start;padding:0 20px'>African Data Layer · Bonamoussadi · Douala</div>
  `,
});

const f3 = page({
  bodyStyle: 'background:#eef4ef;color:#0f2b46',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.22);color:#2f5438;margin-top:240px'>Question · Idee Quartier</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:flex-start;margin-top:60px'>
      <div style='height:8px;width:160px;background:#4c7c59;border-radius:4px;margin-bottom:28px'></div>
      <div class='headline' style='font-size:80px;color:#0f2b46'>Quel<br/>quartier on<br/>cartographie<br/>ensuite ?</div>
      <div class='body' style='font-size:28pt;color:rgba(15,43,70,0.78);margin-top:30px;max-width:920px'>Dites-nous — votre quartier, celui d'un voisin, n'importe ou a Douala ou au-dela.</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div class='sticker-ghost'>Question · Suggerez un quartier</div>
    </div>
  `,
});

const f4 = page({
  bodyStyle: 'background:#0f2b46;color:#f2f6fa',
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.16);color:#f4c317;margin-top:240px'>Cloture · La Porte Est Ouverte</div>
    <div style='flex:1;display:flex;flex-direction:column;justify-content:center;margin-top:-40px'>
      <div class='headline' style='font-size:80px;color:#f2f6fa'>Si vous avez attendu —<br/>la porte<br/>est ouverte.</div>
      <div style='height:8px;width:240px;background:#c86b4a;border-radius:4px;margin-top:28px'></div>
      <div class='headline' style='font-size:64px;color:#f4c317;margin-top:28px;font-weight:700'>Telechargez.</div>
      <div class='body' style='font-size:26pt;color:rgba(242,246,250,0.72);margin-top:28px;font-weight:600'>App Store · Play Store · Les deux en ligne</div>
    </div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-bottom:280px'>
      <div style='padding:22px 28px;border-radius:24px;border:2px dashed #f4c317;background:rgba(244,195,23,0.12);font-weight:700;font-size:18pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317;display:flex;justify-content:space-between'>
        <span>Telecharger</span><span>↗</span>
      </div>
    </div>
  `,
});

const frames = [
  { id: '01-fr', html: f1 },
  { id: '02-fr', html: f2 },
  { id: '03-fr', html: f3 },
  { id: '04-fr', html: f4 },
];

await writeFile(resolve(here, 'frames-fr.json'), JSON.stringify(frames, null, 2), 'utf8');
console.log(`wrote ${frames.length} frames to frames-fr.json`);
