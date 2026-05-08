#!/usr/bin/env node
// Build slides-fr.json for Week 4, Post 4 — FR mirror community close (Sat 2026-05-09)
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
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Lancement · Semaine 4</div>`;

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Donnee De Terrain · Mot De L'Equipe</div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:72px'>
      <div style='font-weight:700;font-size:240px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>04</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Cloture De<br/>Lancement</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Bonamoussadi · Douala</div>
      </div>
    </div>
    <div style='margin-top:96px'>
      <div style='font-weight:700;font-size:88px;line-height:1.02;letter-spacing:-0.015em'>Construit avec<br/>le quartier.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:880px'>Un mot court le dernier jour de la semaine de lancement.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65)'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Lire le mot →
    </div>
  `,
});

const s2 = page({
  bodyStyle: "background:#fff8f4;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>La Premisse</div>
    <div class='accent-bar' style='background:#c86b4a'></div>
    <div style='font-weight:700;font-size:62px;line-height:1.06;letter-spacing:-0.01em;margin-top:24px;max-width:920px'>Une plateforme<br/>n'est qu'une promesse<br/>tant que personne ne marche<br/>dans les rues pour la remplir.</div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:28pt;color:rgba(15,43,70,0.7)'>« Quelqu'un l'a fait. »</div>
    <div class='page-num' style='color:#0f2b46'>02 / 05</div>
  `,
});

const s3 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>Le Merci</div>
    <div class='accent-bar' style='background:#f4c317'></div>
    <div style='font-weight:700;font-size:48px;line-height:1.18;letter-spacing:-0.01em;margin-top:16px;max-width:940px'>Aux agents qui ont teste avant qu'il y ait un app store.<br/><br/>Aux habitants qui ont repondu aux questions.<br/><br/>Au quartier qui nous a laisses apprendre a voix haute.</div>
    <div style='margin-top:auto;font-weight:700;font-size:80px;color:#c86b4a;letter-spacing:-0.02em'>Merci.</div>
    <div class='page-num' style='color:#0f2b46'>03 / 05</div>
  `,
});

const s4 = page({
  bodyStyle: "background:#eaf1ec;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Le Cadre</div>
    <div class='accent-bar' style='background:#4c7c59'></div>
    <div style='font-weight:700;font-size:58px;line-height:1.06;letter-spacing:-0.01em;margin-top:16px;max-width:940px'>Le lancement n'est pas<br/>la ligne d'arrivee.<br/>C'est le moment ou le travail<br/>devient visible.</div>
    <div style='margin-top:48px;display:flex;align-items:center;gap:24px'>
      <div style='width:200px;height:4px;background:#c86b4a;border-radius:2px'></div>
      <div style='width:160px;height:4px;background:rgba(15,43,70,0.35);border-radius:2px'></div>
      <div style='width:140px;height:4px;background:rgba(15,43,70,0.18);border-radius:2px'></div>
    </div>
    <div style='margin-top:24px;display:flex;gap:48px;font-weight:700;font-size:18pt;letter-spacing:0.06em;text-transform:uppercase'>
      <div style='color:#c86b4a'>Bonamoussadi</div>
      <div style='color:rgba(15,43,70,0.6)'>Douala</div>
      <div style='color:rgba(15,43,70,0.4)'>Cameroun ensuite</div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>« Aujourd'hui. Ensuite. Apres. »</div>
    <div class='page-num' style='color:#0f2b46'>04 / 05</div>
  `,
});

const s5 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>La Porte Est Ouverte</div>
    <div style='margin-top:48px'>
      <div style='font-weight:700;font-size:74px;line-height:1.02;letter-spacing:-0.015em'>Si vous attendiez<br/>que le lancement<br/>se pose —<br/>bienvenue.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;color:rgba(15,43,70,0.82);max-width:900px'>Telechargez maintenant. Cartographiez votre quartier. Le jeu de donnees nous appartient a tous.</div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:20pt;display:flex;align-items:center;gap:14px'>
        <span>Lien dans la bio · DM « CARTE »</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>Construit avec le quartier. Construit pour le quartier.</div>
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
