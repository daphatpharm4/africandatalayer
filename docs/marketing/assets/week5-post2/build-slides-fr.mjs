#!/usr/bin/env node
// Build slides-fr.json for Week 5, Post 2 — "On a construit la file d'attente d'abord" (Thu 2026-05-14) FR
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
.icon-bubble{width:96px;height:96px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:8px}
.corner-accent{position:absolute;bottom:0;left:0;width:240px;height:240px;background:#c86b4a;opacity:0.6;border-top-right-radius:240px;z-index:0}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Semaine 05 · Terrain D'Abord</div>`;

const iconSignal = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><line x1='2' y1='20' x2='2' y2='20'/><path d='M5 12.55a11 11 0 0 1 14.08 0'/><path d='M1.42 9a16 16 0 0 1 21.16 0'/><path d='M8.53 16.11a6 6 0 0 1 6.95 0'/><line x1='12' y1='20' x2='12.01' y2='20'/></svg>`;
const iconClock = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/></svg>`;
const iconBattery = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='1' y='6' width='18' height='12' rx='2' ry='2'/><line x1='23' y1='13' x2='23' y2='11'/><line x1='6' y1='10' x2='6' y2='14'/></svg>`;

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='corner-accent'></div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:32px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:200px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>05</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Terrain D'Abord<br/>Prouve</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Bonamoussadi · Douala</div>
      </div>
    </div>
    <div style='margin-top:80px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:88px;line-height:1.0;letter-spacing:-0.02em'>On a construit<br/>la file d'attente<br/>en premier.</div>
      <div style='font-weight:700;font-size:88px;line-height:1.0;letter-spacing:-0.02em;color:#f4c317;margin-top:16px'>Pas en dernier.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65);position:relative;z-index:1'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Voici ce que ca veut dire →
    </div>
  `,
});

const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>Realite Reseau</div>
    <div class='icon-bubble' style='background:rgba(200,107,74,0.18)'>${iconSignal('#c86b4a')}</div>
    <div style='font-weight:700;font-size:68px;line-height:1.04;letter-spacing:-0.01em;margin-top:32px;max-width:920px'>2G dans une rue.<br/>Rien dans la suivante.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>La connectivite a Douala, c'est un travail honnete. La file d'attente garde tes soumissions jusqu'au retour du reseau.</div>
    <div class='page-num' style='color:#0f2b46'>02 / 05</div>
  `,
});

const s3 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Zero Perte</div>
    <div class='icon-bubble' style='background:rgba(76,124,89,0.18)'>${iconClock('#2f5438')}</div>
    <div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.01em;margin-top:32px;max-width:920px'>Zero re-saisie.<br/>Zero donnee perdue.</div>
    <div style='display:flex;gap:32px;margin-top:36px;flex-wrap:wrap'>
      <div style='flex:1;min-width:240px;padding:24px 28px;background:#0f2b46;color:#f2f6fa;border-radius:20px'>
        <div style='font-weight:700;font-size:48pt;line-height:1;color:#f4c317'>75</div>
        <div style='font-weight:500;font-size:14pt;margin-top:6px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.78'>captures en cache</div>
      </div>
      <div style='flex:1;min-width:240px;padding:24px 28px;background:#0f2b46;color:#f2f6fa;border-radius:20px'>
        <div style='font-weight:700;font-size:48pt;line-height:1;color:#f4c317'>72h</div>
        <div style='font-weight:500;font-size:14pt;margin-top:6px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.78'>duree de vie</div>
      </div>
      <div style='flex:1;min-width:240px;padding:24px 28px;background:#0f2b46;color:#f2f6fa;border-radius:20px'>
        <div style='font-weight:700;font-size:48pt;line-height:1;color:#f4c317'>6</div>
        <div style='font-weight:500;font-size:14pt;margin-top:6px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.78'>tentatives</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-size:22pt;color:rgba(15,43,70,0.7);max-width:880px'>Synchronisation auto au retour du reseau.</div>
    <div class='page-num' style='color:#0f2b46'>03 / 05</div>
  `,
});

const s4 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>Cas Limites Tenus</div>
    <div class='icon-bubble' style='background:rgba(244,195,23,0.28)'>${iconBattery('#0f2b46')}</div>
    <div style='font-weight:700;font-size:56px;line-height:1.06;letter-spacing:-0.01em;margin-top:32px;max-width:940px'>Batterie faible.<br/>Reseau coupe.<br/>Le travail continue.</div>
    <div style='font-weight:500;font-size:22pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>Les cles d'idempotence bloquent les doublons a la sync. Six tentatives avant qu'une soumission demande une revue.</div>
    <div class='page-num' style='color:#0f2b46'>04 / 05</div>
  `,
});

const s5 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='corner-accent' style='background:#0f2b46;opacity:0.18'></div>
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46;position:relative;z-index:1'>Terrain D'Abord. Reellement.</div>
    <div style='margin-top:48px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:72px;line-height:1.04;letter-spacing:-0.015em'>La carte ne te punit<br/>pas pour le reseau.</div>
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
