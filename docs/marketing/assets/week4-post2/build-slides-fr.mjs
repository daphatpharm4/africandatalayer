#!/usr/bin/env node
// Build slides-fr.json for Week 4, Post 2 — FR mirror anatomy (Thu 2026-05-07)
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

const stamp = () => `<div class='stamp'>Lancement · Semaine 4</div>`;

function gate({ bg, micro, microColor, microBg, accent, num, title, body, line, pageNum, textColor }) {
  return page({
    bodyStyle: `background:${bg};color:${textColor||'#0f2b46'}`,
    inner: `
      ${stamp()}
      <div class='ghost' style='color:${accent}'>${num}</div>
      <div class='micro' style='background:${microBg};color:${microColor}'>${micro}</div>
      <div class='accent-bar' style='background:${accent}'></div>
      <div style='font-weight:700;font-size:54px;line-height:1.04;letter-spacing:-0.01em;margin-top:8px;position:relative;z-index:1'>${title}</div>
      <div style='font-weight:500;font-size:24pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px;position:relative;z-index:1'>${body}</div>
      <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65);position:relative;z-index:1'>« ${line} »</div>
      <div class='page-num' style='color:#0f2b46'>${pageNum} / 06</div>
    `,
  });
}

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Donnee De Terrain · Anatomie</div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:72px'>
      <div style='font-weight:700;font-size:240px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>5</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Portes<br/>Par Point</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Chaine de verification</div>
      </div>
    </div>
    <div style='margin-top:96px'>
      <div style='font-weight:700;font-size:74px;line-height:1.02;letter-spacing:-0.015em'>Ce que « verifie »<br/>veut vraiment dire.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:880px'>Six diapositives. Cinq portes. Chaque soumission sur la carte les a toutes passees.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65)'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Glissez →
    </div>
  `,
});

const s2 = gate({
  bg: '#f2f6fa', accent: '#c86b4a', num: '1',
  micro: 'Porte 1 · Verrouillage GPS', microBg: 'rgba(200,107,74,0.14)', microColor: '#c86b4a',
  title: 'Coordonnees prises<br/>a la source.',
  body: 'Vitesse et distance comparees au dernier point de l\'agent. Les sauts impossibles sont signales avant l\'enregistrement.',
  line: 'Les teleporteurs sont attrapes ici.', pageNum: '02',
});

const s3 = gate({
  bg: '#eaf1ec', accent: '#4c7c59', num: '2',
  micro: 'Porte 2 · Photo + EXIF', microBg: 'rgba(76,124,89,0.18)', microColor: '#2f5438',
  title: 'Lire les metadonnees<br/>avant la photo.',
  body: 'L\'image arrive avec horodatage, empreinte d\'appareil et metadonnees de capture. Les photos recyclees ne correspondent pas. Elles ne passent pas.',
  line: 'Les photos recyclees ne passent pas.', pageNum: '03',
});

const s4 = gate({
  bg: '#f2f6fa', accent: '#f4c317', num: '3',
  micro: 'Porte 3 · Doublons', microBg: 'rgba(244,195,23,0.28)', microColor: '#0f2b46',
  title: 'Meme endroit, meme jour,<br/>meme telephone ?',
  body: 'La plateforme pose la question avant d\'accepter. Les amas de doublons vont en revue plutot que gonfler le jeu de donnees.',
  line: 'Un vrai point vaut mieux que cinq doublons.', pageNum: '04',
});

const s5 = gate({
  bg: '#fff8f4', accent: '#c86b4a', num: '4',
  micro: 'Porte 4 · Score De Risque', microBg: 'rgba(200,107,74,0.18)', microColor: '#c86b4a',
  title: 'Chaque soumission recoit<br/>une lecture numerique.',
  body: 'Risque faible : ca passe. Risque eleve : revue admin. Les schemas suspects remontent — ils ne se faufilent pas.',
  line: 'Les schemas suspects remontent.', pageNum: '05',
});

const s6 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='ghost' style='color:rgba(15,43,70,0.08)'>5</div>
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>Porte 5 · Niveau De Confiance</div>
    <div style='margin-top:32px;position:relative;z-index:1'>
      <div style='font-weight:700;font-size:58px;line-height:1.02;letter-spacing:-0.015em'>Les agents de niveau<br/>eleve gagnent plus de<br/>poids sur le jeu de donnees.</div>
      <div style='font-weight:500;font-size:24pt;line-height:1.35;margin-top:24px;color:rgba(15,43,70,0.82);max-width:900px'>Parce qu'ils l'ont merite. Le point arrive sur la carte uniquement apres les cinq portes.</div>
    </div>
    <div style='margin-top:32px;display:flex;gap:14px;flex-wrap:wrap;position:relative;z-index:1'>
      <div style='padding:14px 22px;border-radius:14px;background:rgba(15,43,70,0.12);font-weight:700;font-size:16pt'>Bronze</div>
      <div style='padding:14px 22px;border-radius:14px;background:rgba(15,43,70,0.18);font-weight:700;font-size:16pt'>Argent</div>
      <div style='padding:14px 22px;border-radius:14px;background:#0f2b46;color:#f4c317;font-weight:700;font-size:16pt'>Or</div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px;position:relative;z-index:1'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:20pt;display:flex;align-items:center;gap:14px'>
        <span>Telecharger · DM « CARTE »</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>Voila ce que veut dire donnee de terrain.</div>
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
