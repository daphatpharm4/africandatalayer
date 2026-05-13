#!/usr/bin/env node
// Build slides-fr.json for Week 5, Post 4 — "Samedi au niveau de la rue" (Sat 2026-05-16) FR
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

const stamp = () => `<div class='stamp'>Semaine 05 · Du Quartier</div>`;

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='corner-accent'></div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:32px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:200px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>Sam</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Une Note<br/>Du Quartier</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Bonamoussadi · Douala</div>
      </div>
    </div>
    <div style='margin-top:96px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:96px;line-height:1.0;letter-spacing:-0.02em'>Samedi au<br/>niveau de la rue.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65);position:relative;z-index:1'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Trois choses que seule la rue sait →
    </div>
  `,
});

const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Observation 01</div>
    <div style='font-weight:700;font-size:96px;line-height:0.95;letter-spacing:-0.02em;color:#0f2b46;margin-top:48px;opacity:0.12'>01</div>
    <div style='font-weight:700;font-size:60px;line-height:1.06;letter-spacing:-0.01em;margin-top:-32px;max-width:920px'>Une pharmacie reste ouverte plus tard que son enseigne le dit.</div>
    <div style='font-weight:500;font-size:22pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>L'enseigne a ete peinte en 2019. Les horaires ont change l'an dernier. Seule la rue le sait.</div>
    <div class='page-num' style='color:#0f2b46'>02 / 05</div>
  `,
});

const s3 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>Observation 02</div>
    <div style='font-weight:700;font-size:96px;line-height:0.95;letter-spacing:-0.02em;color:#0f2b46;margin-top:48px;opacity:0.12'>02</div>
    <div style='font-weight:700;font-size:60px;line-height:1.06;letter-spacing:-0.01em;margin-top:-32px;max-width:920px'>Un kiosque n'a plus de credit a 19h.</div>
    <div style='font-weight:500;font-size:22pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>Le mobile money fluctue avec la paie et l'approvisionnement. La carte devrait fluctuer aussi.</div>
    <div class='page-num' style='color:#0f2b46'>03 / 05</div>
  `,
});

const s4 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>Observation 03</div>
    <div style='font-weight:700;font-size:96px;line-height:0.95;letter-spacing:-0.02em;color:#0f2b46;margin-top:48px;opacity:0.12'>03</div>
    <div style='font-weight:700;font-size:60px;line-height:1.06;letter-spacing:-0.01em;margin-top:-32px;max-width:920px'>Un panneau a change mardi dernier.</div>
    <div style='font-weight:500;font-size:22pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>L'infrastructure statique n'est pas statique. Le quartier bouge. Les donnees devraient suivre.</div>
    <div class='page-num' style='color:#0f2b46'>04 / 05</div>
  `,
});

const s5 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='corner-accent' style='background:#0f2b46;opacity:0.18'></div>
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46;position:relative;z-index:1'>Marche Cette Semaine? Merci.</div>
    <div style='margin-top:48px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.015em'>Le quartier sait deja.</div>
      <div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.015em;color:#f4c317;margin-top:14px'>On l'ecrit, c'est tout.</div>
      <div style='font-weight:500;font-size:24pt;line-height:1.35;margin-top:32px;color:rgba(15,43,70,0.85);max-width:920px'>Agents de terrain a Douala — la beta est ouverte.</div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:18px;position:relative;z-index:1'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:22pt;display:flex;align-items:center;gap:14px'>
        <span>Ecrivez "CARTE" pour rejoindre</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.75)'>Bonamoussadi · Douala · Cameroun et au-dela</div>
    </div>
  `,
});

const slides = [
  { id: '01-fr', html: s1 },
  { id: '02-fr', html: s2 },
  { id: '03-fr', html: s3 },
  { id: '04-fr', html: s4 },
  { id: '05-fr', html: s5 },
];

await writeFile(resolve(here, 'slides-fr.json'), JSON.stringify(slides, null, 2), 'utf8');
console.log(`wrote ${slides.length} slides to slides-fr.json`);
