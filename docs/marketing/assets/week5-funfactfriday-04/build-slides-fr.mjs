#!/usr/bin/env node
// Build slides-fr.json for Week 5, FFF #04 — "La carte qu'on ne peut pas imprimer" FR
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

const stamp = () => `<div class='stamp'>FFF · 04 · Transport</div>`;

const iconMap = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6'/><line x1='8' y1='2' x2='8' y2='18'/><line x1='16' y1='6' x2='16' y2='22'/></svg>`;
const iconClock = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/></svg>`;
const iconAlert = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/><line x1='12' y1='9' x2='12' y2='13'/><line x1='12' y1='17' x2='12.01' y2='17'/></svg>`;
const iconFootprints = (color) => `<svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 16v-2.38c0-.99.6-1.88 1.5-2.27.92-.41 1.96-.51 2.95-.07.78.34 1.46.84 2.06 1.45.66.66 1.18 1.5 1.43 2.41.12.42.18.86.18 1.31V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z'/><path d='M14 8.5C14 7.12 15.12 6 16.5 6S19 7.12 19 8.5c0 .65-.25 1.24-.66 1.68-.6.65-.85 1.55-.69 2.42l.39 2.06c.12.65-.36 1.24-1.02 1.24h-2.04c-.66 0-1.14-.59-1.02-1.24l.39-2.06c.16-.87-.09-1.77-.69-2.42-.41-.44-.66-1.03-.66-1.68z'/></svg>`;

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='corner-accent'></div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:32px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:200px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>04</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Fun Fact Friday<br/>Transport</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Bonamoussadi · Douala</div>
      </div>
    </div>
    <div style='margin-top:80px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:80px;line-height:1.02;letter-spacing:-0.02em'>La carte qu'on<br/>ne peut pas<br/>imprimer.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65);position:relative;z-index:1'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Pourquoi les routes ne tiennent pas →
    </div>
  `,
});

const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>La Premisse</div>
    <div class='icon-bubble' style='background:rgba(76,124,89,0.18)'>${iconMap('#2f5438')}</div>
    <div style='font-weight:700;font-size:58px;line-height:1.06;letter-spacing:-0.01em;margin-top:32px;max-width:940px'>Une route sur papier n'est pas une ligne sur le terrain.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>Les annuaires statiques supposent que le transport tient en place. Douala est honnete — il ne tient pas.</div>
    <div class='page-num' style='color:#0f2b46'>02 / 06</div>
  `,
});

const s3 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>Le Schema</div>
    <div class='icon-bubble' style='background:rgba(200,107,74,0.18)'>${iconClock('#c86b4a')}</div>
    <div style='font-weight:700;font-size:54px;line-height:1.06;letter-spacing:-0.01em;margin-top:32px;max-width:920px'>Les arrets bougent du matin au soir.</div>
    <div style='display:flex;flex-direction:column;gap:14px;margin-top:36px;max-width:920px'>
      <div style='display:flex;align-items:center;gap:16px;font-weight:600;font-size:22pt'><span style='width:28px;height:2px;background:#c86b4a'></span>Coins moto-taxi bougent avec trafic</div>
      <div style='display:flex;align-items:center;gap:16px;font-weight:600;font-size:22pt'><span style='width:28px;height:2px;background:#c86b4a'></span>Arrets taxi-brousse s'ajustent au carburant</div>
      <div style='display:flex;align-items:center;gap:16px;font-weight:600;font-size:22pt'><span style='width:28px;height:2px;background:#c86b4a'></span>Arrets informels apparaissent au midi</div>
      <div style='display:flex;align-items:center;gap:16px;font-weight:600;font-size:22pt'><span style='width:28px;height:2px;background:#c86b4a'></span>Et disparaissent au soir</div>
    </div>
    <div class='page-num' style='color:#0f2b46'>03 / 06</div>
  `,
});

const s4 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>Pourquoi C'Est Important</div>
    <div class='icon-bubble' style='background:rgba(244,195,23,0.28)'>${iconAlert('#0f2b46')}</div>
    <div style='font-weight:700;font-size:60px;line-height:1.06;letter-spacing:-0.01em;margin-top:32px;max-width:920px'>C'est pour ca que les cartes statiques vieillissent.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>La plupart des annuaires listent le transport une fois. ADL capture la ligne d'aujourd'hui, pas celle de l'an dernier.</div>
    <div class='page-num' style='color:#0f2b46'>04 / 06</div>
  `,
});

const s5 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Comment On Le Fait</div>
    <div class='icon-bubble' style='background:rgba(76,124,89,0.18)'>${iconFootprints('#2f5438')}</div>
    <div style='font-weight:700;font-size:60px;line-height:1.06;letter-spacing:-0.01em;margin-top:32px;max-width:920px'>A pied, verticale par verticale.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.4;color:rgba(15,43,70,0.75);margin-top:28px;max-width:880px'>Le transport est une des sept verticales — capte par un agent qui prend deja cette route. Verifie par GPS, photo, et le pipeline.</div>
    <div class='page-num' style='color:#0f2b46'>05 / 06</div>
  `,
});

const s6 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='corner-accent' style='background:#0f2b46;opacity:0.18'></div>
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46;position:relative;z-index:1'>Appartient Au Quartier</div>
    <div style='margin-top:48px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:72px;line-height:1.02;letter-spacing:-0.015em'>Le jeu de donnees<br/>appartient au quartier.</div>
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
  { id: '06-fr', html: s6 },
];

await writeFile(resolve(here, 'slides-fr.json'), JSON.stringify(slides, null, 2), 'utf8');
console.log(`wrote ${slides.length} slides to slides-fr.json`);
