#!/usr/bin/env node
// Build slides-fr.json — FFF #02 FR mirror — "Mobile money a Douala"
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

const stamp = (n) => `<div class='stamp'>Fait Vendredi · ${n}</div>`;

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp('02')}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Donnee Terrain · Education</div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:72px'>
      <div style='font-weight:700;font-size:260px;line-height:0.85;letter-spacing:-0.04em;color:#f4c317'>02</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Le fait<br/>du vendredi</div>
        <div style='width:64px;height:4px;background:#c86b4a;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>Une serie ADL</div>
      </div>
    </div>
    <div style='margin-top:96px'>
      <div style='font-weight:700;font-size:88px;line-height:1.02;letter-spacing:-0.015em'>Mobile Money<br/>a Douala.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:880px'>Six slides. Pourquoi la « banque » la plus proche de chez vous n'est pas ce que vous pensez — et pourquoi les cartes statiques le ratent.</div>
    </div>
    <div style='margin-top:auto;display:flex;align-items:center;gap:18px;font-weight:500;font-size:20pt;color:rgba(242,246,250,0.65)'>
      <div style='width:32px;height:2px;background:#f4c317'></div>
      Glissez →
    </div>
  `,
});

const s2 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp('02')}
    <div class='micro' style='background:rgba(200,107,74,0.14);color:#c86b4a'>L'Accroche</div>
    <div style='display:flex;gap:24px;margin-top:40px'>
      <div class='icon-chip' style='background:#fff8f4'>
        <svg viewBox='0 0 24 24' stroke='#c86b4a'><path d='M12 2c5 0 9 3 9 9H3c0-6 4-9 9-9zM12 11v11M9 22h6'/></svg>
      </div>
      <div class='icon-chip' style='background:rgba(15,43,70,0.08)'>
        <svg viewBox='0 0 24 24' stroke='#0f2b46'><path d='M3 22h18M5 22V8l7-4 7 4v14M9 12h2M13 12h2M9 16h2M13 16h2'/></svg>
      </div>
    </div>
    <div style='font-weight:700;font-size:60px;line-height:1.04;letter-spacing:-0.01em;margin-top:40px'>Dans la plupart<br/>des quartiers de<br/>Douala, la « banque »<br/>la plus proche est un<br/><span style='color:#c86b4a'>parasol jaune —</span><br/>pas une tour en verre.</div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.6)'>« Et l'ecart n'est pas serre. »</div>
    <div class='page-num' style='color:#0f2b46'>02 / 06</div>
  `,
});

const s3 = page({
  bodyStyle: "background:#fff8f4;color:#0f2b46",
  inner: `
    ${stamp('02')}
    <div class='micro' style='background:rgba(200,107,74,0.18);color:#c86b4a'>Le Mecanisme</div>
    <div style='font-weight:700;font-size:72px;line-height:1.02;letter-spacing:-0.015em;margin-top:48px'>C'est le reseau<br/><span style='color:#c86b4a'>d'agents mobile<br/>money.</span></div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:32px;max-width:920px'>Agents agrees — kiosques, etals de marche, comptoirs de pharmacie, boutiques de quartier — connectes a MTN Mobile Money et Orange Money.</div>
    <div style='display:flex;gap:14px;margin-top:32px;flex-wrap:wrap'>
      <div style='padding:14px 22px;border-radius:16px;background:#0f2b46;color:#f2f6fa;font-weight:600;font-size:17pt'>Kiosques</div>
      <div style='padding:14px 22px;border-radius:16px;background:#c86b4a;color:#fff8f4;font-weight:600;font-size:17pt'>Etals de marche</div>
      <div style='padding:14px 22px;border-radius:16px;background:#f4c317;color:#0f2b46;font-weight:600;font-size:17pt'>Comptoirs pharmacie</div>
      <div style='padding:14px 22px;border-radius:16px;background:#4c7c59;color:#fff;font-weight:600;font-size:17pt'>Boutiques quartier</div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65);max-width:900px'>« La banque va au coin de la rue. L'agent EST le coin de la rue. »</div>
    <div class='page-num' style='color:#0f2b46'>03 / 06</div>
  `,
});

const s4 = page({
  bodyStyle: "background:#eaf1ec;color:#0f2b46",
  inner: `
    ${stamp('02')}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Pourquoi Ca Tient</div>
    <div class='accent-bar' style='background:#4c7c59'></div>
    <div style='font-weight:700;font-size:64px;line-height:1.02;letter-spacing:-0.01em'>La densite l'emporte<br/>sur le cout immobilier.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;max-width:920px'>Un parasol, un telephone, un fonds de caisse, une licence. Depot, retrait, transfert, paiement de facture — regle en quelques minutes, a pied depuis chez soi.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:44px'>
      <div style='padding:28px;border-radius:24px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Empreinte</div>
        <div style='font-weight:700;font-size:28pt;margin-top:10px;line-height:1.15'>Un stand,<br/>un coin</div>
      </div>
      <div style='padding:28px;border-radius:24px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Vitesse</div>
        <div style='font-weight:700;font-size:28pt;margin-top:10px;line-height:1.15'>Minutes,<br/>pas heures</div>
      </div>
      <div style='padding:28px;border-radius:24px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Portee</div>
        <div style='font-weight:700;font-size:28pt;margin-top:10px;line-height:1.15'>A pied,<br/>du quartier</div>
      </div>
      <div style='padding:28px;border-radius:24px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Pense pour</div>
        <div style='font-weight:700;font-size:28pt;margin-top:10px;line-height:1.15'>Comment<br/>l'argent circule</div>
      </div>
    </div>
    <div class='page-num' style='color:#0f2b46'>04 / 06</div>
  `,
});

const s5 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp('02')}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>L'Angle Mort</div>
    <div style='display:flex;gap:24px;margin-top:40px'>
      <div class='icon-chip' style='background:rgba(244,195,23,0.2)'>
        <svg viewBox='0 0 24 24' stroke='#0f2b46'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/></svg>
      </div>
      <div class='icon-chip' style='background:rgba(200,107,74,0.18)'>
        <svg viewBox='0 0 24 24' stroke='#c86b4a'><path d='M4 4l16 16'/><path d='M20 4L4 20'/></svg>
      </div>
    </div>
    <div style='font-weight:700;font-size:64px;line-height:1.02;letter-spacing:-0.01em;margin-top:40px'>Les cartes<br/>statiques le ratent.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;max-width:920px'>Les agents ouvrent, ferment, deplacent leur stand. Un kiosque present ce mois-ci a Rue X aura disparu le mois prochain. La densite est reelle — l'annuaire ne l'est pas.</div>
    <div style='margin-top:44px;padding:32px;border-radius:24px;background:#0f2b46;color:#f2f6fa;max-width:940px'>
      <div style='font-weight:700;font-size:15pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>L'angle ADL</div>
      <div style='font-weight:600;font-size:26pt;line-height:1.25;margin-top:12px'>Une infrastructure volatile, a portee de marche, c'est exactement ce que la donnee terrain est faite pour cartographier.</div>
    </div>
    <div style='margin-top:auto;font-weight:700;font-size:22pt;color:#c86b4a'>C'est l'ecart qu'on comble.</div>
    <div class='page-num' style='color:#0f2b46'>05 / 06</div>
  `,
});

const s6 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp('02')}
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>Chaque Vendredi · Un Nouveau Fait</div>
    <div style='margin-top:56px'>
      <div style='font-weight:700;font-size:86px;line-height:1.02;letter-spacing:-0.015em'>Enregistrez.<br/>Suivez pour le #03.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;color:rgba(15,43,70,0.82);max-width:900px'>Serie educative par African Data Layer — infrastructure de donnees grassroots depuis Douala, Cameroun.</div>
    </div>
    <div style='margin-top:56px;display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px'>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>Suivant</div>
        <div style='font-weight:700;font-size:22pt;margin-top:6px;line-height:1.2'>#03 — Volatilite des prix carburant</div>
      </div>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>Sortie</div>
        <div style='font-weight:700;font-size:22pt;margin-top:6px;line-height:1.2'>Ven 2026-05-08</div>
      </div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:22pt;display:flex;align-items:center;gap:14px'>
        <span>Suivez @africandatalayer</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>Partagez avec un proche qui marche encore jusqu'a la banque.</div>
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
console.log(`wrote ${slides.length} FR slides to slides-fr.json`);
