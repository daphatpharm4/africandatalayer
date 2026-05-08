#!/usr/bin/env node
// Build slides-fr.json for Week 4, FFF #03 — FR mirror fuel (Fri 2026-05-08)
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
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Fun Fact Friday · 03</div>`;

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Donnee De Terrain · Education</div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:72px'>
      <div style='font-weight:700;font-size:240px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>03</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Fun Fact<br/>Friday</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Carburant · Cameroun</div>
      </div>
    </div>
    <div style='margin-top:96px'>
      <div style='font-weight:700;font-size:80px;line-height:1.02;letter-spacing:-0.015em'>Carburant<br/>au Cameroun.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:880px'>Le prix a la pompe que vous avez vu la semaine derniere n'est pas forcement le prix d'aujourd'hui.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65)'>
      <div style='width:32px;height:2px;background:#c86b4a'></div>
      Glissez →
    </div>
  `,
});

const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.14);color:#c86b4a'>L'accroche</div>
    <div class='icon-chip' style='background:#fff8f4;margin-top:40px'>
      <svg viewBox='0 0 24 24' stroke='#c86b4a'><path d='M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16'/><path d='M3 21h15M16 9h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2'/></svg>
    </div>
    <div style='font-weight:700;font-size:56px;line-height:1.04;letter-spacing:-0.01em;margin-top:32px'>Le prix d'hier n'est<br/>pas le prix d'aujourd'hui.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>Il peut changer entre deux stations du meme boulevard. Il peut changer entre le matin et l'apres-midi.</div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:24pt;color:rgba(15,43,70,0.6)'>« Et il peut changer avant le dejeuner. »</div>
    <div class='page-num' style='color:#0f2b46'>02 / 06</div>
  `,
});

const s3 = page({
  bodyStyle: "background:#fff8f4;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>Le Contexte</div>
    <div class='accent-bar' style='background:#c86b4a'></div>
    <div style='font-weight:700;font-size:54px;line-height:1.04;letter-spacing:-0.01em;margin-top:8px'>Les prix a la pompe<br/>ne sont pas un chiffre<br/>national fixe en pratique.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>Les stations ajustent. L'approvisionnement se tend. Les vendeurs informels comblent. Le chiffre sur l'enseigne, c'est le chiffre de cette station, cette heure, ce quartier.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:32px;max-width:960px'>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(200,107,74,0.25)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Station</div>
        <div style='font-weight:700;font-size:18pt;margin-top:6px;line-height:1.2'>Choix local</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(200,107,74,0.25)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Heure</div>
        <div style='font-weight:700;font-size:18pt;margin-top:6px;line-height:1.2'>Lie au temps</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(200,107,74,0.25)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Quartier</div>
        <div style='font-weight:700;font-size:18pt;margin-top:6px;line-height:1.2'>Lie au lieu</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>« La carte du carburant est une carte du temps, pas seulement du lieu. »</div>
    <div class='page-num' style='color:#0f2b46'>03 / 06</div>
  `,
});

const s4 = page({
  bodyStyle: "background:#eaf1ec;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Pourquoi Ca Compte</div>
    <div class='accent-bar' style='background:#4c7c59'></div>
    <div style='font-weight:700;font-size:58px;line-height:1.04;letter-spacing:-0.01em;margin-top:8px'>Quand le prix bouge,<br/>la ville bouge avec lui.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.35;margin-top:24px;max-width:920px'>Les conducteurs changent d'itineraire. Les tarifs de moto-taxi bougent. Les marges de livraison se compressent. Les menages decident sur info partielle.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:32px;max-width:920px'>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Conducteurs</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Reroutent</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Moto-taxis</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Tarifs bougent</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Livraison</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Marges compressees</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Menages</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Planifient la semaine</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>« Quand le prix bouge, la ville bouge avec lui. »</div>
    <div class='page-num' style='color:#0f2b46'>04 / 06</div>
  `,
});

const s5 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>Pourquoi Les Cartes Statiques Ratent</div>
    <div class='accent-bar' style='background:#f4c317'></div>
    <div style='font-weight:700;font-size:54px;line-height:1.04;letter-spacing:-0.01em;margin-top:8px'>La plupart des annuaires<br/>listent une station une fois<br/>et n'y reviennent jamais.</div>
    <div style='font-weight:500;font-size:24pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>La verticale stations-service d'ADL capture le prix et l'etat d'approvisionnement a la pompe — geolocalisee, horodatee, verifiee.</div>
    <div style='margin-top:32px;padding:30px;border-radius:24px;background:#0f2b46;color:#f2f6fa;max-width:940px'>
      <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>Statique vs Donnee De Terrain</div>
      <div style='display:flex;gap:14px;margin-top:18px;flex-wrap:wrap'>
        <div style='padding:10px 16px;border-radius:12px;background:rgba(200,107,74,0.25);font-weight:700;font-size:16pt'>Statique · pourrit</div>
        <div style='padding:10px 16px;border-radius:12px;background:rgba(76,124,89,0.4);font-weight:700;font-size:16pt'>Terrain · se rafraichit</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>« La donnee de terrain se rafraichit. Les listes statiques pourrissent. »</div>
    <div class='page-num' style='color:#0f2b46'>05 / 06</div>
  `,
});

const s6 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>A Quoi Sert La Donnee Verifiee</div>
    <div style='margin-top:48px'>
      <div style='font-weight:700;font-size:76px;line-height:1.02;letter-spacing:-0.015em'>Vrais prix.<br/>Vrai temps.<br/>Vrai quartier.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;color:rgba(15,43,70,0.82);max-width:900px'>Voila a quoi sert la donnee verifiee. Conducteurs, menages, planificateurs, analystes — meme carte, decisions differentes.</div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:20pt;display:flex;align-items:center;gap:14px'>
        <span>Telecharger · DM « CARTE »</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>FFF #04 vendredi prochain — dites-nous quel systeme couvrir.</div>
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
