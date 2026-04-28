#!/usr/bin/env node
// Build slides-fr.json — Week 3, Post 2 FR mirror — "Le travail de qualite paie"
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
.step-num{font-weight:700;font-size:14pt;letter-spacing:0.18em;text-transform:uppercase}
`;

function page({ bodyStyle, inner }) {
  return `<!doctype html><html><head><meta charset='utf-8'>${FONT_LINKS}<style>${BASE_CSS}body{${bodyStyle};padding:80px;display:flex;flex-direction:column;position:relative}</style></head><body>${inner}</body></html>`;
}

const stamp = () => `<div class='stamp'>Beta · Semaine 3</div>`;

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Donnee Terrain · Recompenses</div>
    <div style='display:flex;align-items:flex-end;gap:32px;margin-top:96px'>
      <div style='display:flex;flex-direction:column;align-items:center'>
        <div style='font-weight:700;font-size:48pt;color:rgba(242,246,250,0.4)'>01</div>
        <div style='width:80px;height:80px;background:rgba(200,107,74,0.4);border-radius:16px;margin-top:8px'></div>
        <div style='font-weight:600;font-size:14pt;color:rgba(242,246,250,0.6);margin-top:10px;letter-spacing:0.08em;text-transform:uppercase'>XP</div>
      </div>
      <div style='display:flex;flex-direction:column;align-items:center'>
        <div style='font-weight:700;font-size:48pt;color:rgba(242,246,250,0.55)'>02</div>
        <div style='width:80px;height:130px;background:rgba(76,124,89,0.6);border-radius:16px;margin-top:8px'></div>
        <div style='font-weight:600;font-size:14pt;color:rgba(242,246,250,0.6);margin-top:10px;letter-spacing:0.08em;text-transform:uppercase'>Serie</div>
      </div>
      <div style='display:flex;flex-direction:column;align-items:center'>
        <div style='font-weight:700;font-size:48pt;color:rgba(242,246,250,0.7)'>03</div>
        <div style='width:80px;height:180px;background:rgba(244,195,23,0.7);border-radius:16px;margin-top:8px'></div>
        <div style='font-weight:600;font-size:14pt;color:rgba(242,246,250,0.6);margin-top:10px;letter-spacing:0.08em;text-transform:uppercase'>Badges</div>
      </div>
      <div style='display:flex;flex-direction:column;align-items:center'>
        <div style='font-weight:700;font-size:48pt;color:#f4c317'>04</div>
        <div style='width:80px;height:230px;background:#c86b4a;border-radius:16px;margin-top:8px'></div>
        <div style='font-weight:600;font-size:14pt;color:#f4c317;margin-top:10px;letter-spacing:0.08em;text-transform:uppercase'>Echange</div>
      </div>
    </div>
    <div style='margin-top:72px'>
      <div style='font-weight:700;font-size:88px;line-height:1.02;letter-spacing:-0.015em'>Le travail<br/>de qualite paie.<br/>Voici comment.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:900px'>Quatre etapes. De vraies recompenses. Un travail de terrain audite et reconnu.</div>
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
    <div class='micro' style='background:rgba(200,107,74,0.14);color:#c86b4a'>Etape 01 · XP</div>
    <div class='icon-chip' style='background:#fff8f4;margin-top:40px'>
      <svg viewBox='0 0 24 24' stroke='#c86b4a'><path d='M12 2v20M2 12h20M5 5l14 14M19 5L5 19'/></svg>
    </div>
    <div style='font-weight:700;font-size:62px;line-height:1.04;letter-spacing:-0.01em;margin-top:40px'>Chaque<br/>soumission verifiee<br/>rapporte des XP.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:32px;max-width:920px'>Plus la qualite est haute, plus le niveau de confiance monte, plus la recompense suit. Les XP ne sont pas un score d'ego — c'est le recu d'un travail de terrain.</div>
    <div style='display:flex;gap:14px;margin-top:32px;flex-wrap:wrap'>
      <div style='padding:14px 22px;border-radius:16px;background:#0f2b46;color:#f2f6fa;font-weight:600;font-size:17pt'>Capture</div>
      <div style='padding:14px 22px;border-radius:16px;background:#c86b4a;color:#fff8f4;font-weight:600;font-size:17pt'>Bonus qualite</div>
      <div style='padding:14px 22px;border-radius:16px;background:#f4c317;color:#0f2b46;font-weight:600;font-size:17pt'>Multiplicateur confiance</div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.6)'>« Les XP, c'est le recu, pas l'ego. »</div>
    <div class='page-num' style='color:#0f2b46'>02 / 05</div>
  `,
});

const s3 = page({
  bodyStyle: "background:#eaf1ec;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Etape 02 · Serie</div>
    <div class='accent-bar' style='background:#4c7c59'></div>
    <div class='icon-chip' style='background:#ffffff;margin-top:8px'>
      <svg viewBox='0 0 24 24' stroke='#4c7c59'><path d='M12 2c2 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 4'/></svg>
    </div>
    <div style='font-weight:700;font-size:62px;line-height:1.04;letter-spacing:-0.01em;margin-top:40px'>Les series<br/>s'accumulent.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:32px;max-width:920px'>Soumettre plusieurs jours d'affilee maintient la serie. La casser, c'est repartir a zero. La tenir, le multiplicateur entre en jeu.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:36px;max-width:920px'>
      <div style='padding:22px;border-radius:20px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div class='step-num' style='color:#4c7c59'>J1</div>
        <div style='font-weight:700;font-size:20pt;margin-top:8px'>+ base</div>
      </div>
      <div style='padding:22px;border-radius:20px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div class='step-num' style='color:#4c7c59'>J7</div>
        <div style='font-weight:700;font-size:20pt;margin-top:8px'>+ bonus</div>
      </div>
      <div style='padding:22px;border-radius:20px;background:#0f2b46;color:#f2f6fa'>
        <div class='step-num' style='color:#f4c317'>J30</div>
        <div style='font-weight:700;font-size:20pt;margin-top:8px'>multiplicateur</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>« Etre present a un chiffre attache. »</div>
    <div class='page-num' style='color:#0f2b46'>03 / 05</div>
  `,
});

const s4 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>Etape 03 · Badges</div>
    <div class='accent-bar' style='background:#f4c317'></div>
    <div style='font-weight:700;font-size:62px;line-height:1.04;letter-spacing:-0.01em;margin-top:8px'>Les badges<br/>se debloquent.<br/><span style='color:#c86b4a'>Permanents.</span></div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>Visibles sur votre profil. Votre parcours reste avec vous.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:36px'>
      <div style='padding:24px;border-radius:24px;background:#ffffff;border:2px solid rgba(244,195,23,0.45);display:flex;align-items:center;gap:16px'>
        <div style='width:56px;height:56px;border-radius:50%;background:#f4c317;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18pt;color:#0f2b46'>50</div>
        <div>
          <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Verifie</div>
          <div style='font-weight:700;font-size:18pt;margin-top:2px'>50 captures</div>
        </div>
      </div>
      <div style='padding:24px;border-radius:24px;background:#ffffff;border:2px solid rgba(244,195,23,0.45);display:flex;align-items:center;gap:16px'>
        <div style='width:56px;height:56px;border-radius:50%;background:#4c7c59;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18pt;color:#fff'>⏱</div>
        <div>
          <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Ponctuel</div>
          <div style='font-weight:700;font-size:18pt;margin-top:2px'>Serie quotidienne</div>
        </div>
      </div>
      <div style='padding:24px;border-radius:24px;background:#ffffff;border:2px solid rgba(244,195,23,0.45);display:flex;align-items:center;gap:16px'>
        <div style='width:56px;height:56px;border-radius:50%;background:#c86b4a;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18pt;color:#fff'>★</div>
        <div>
          <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Specialiste</div>
          <div style='font-weight:700;font-size:18pt;margin-top:2px'>Maitrise vertical</div>
        </div>
      </div>
      <div style='padding:24px;border-radius:24px;background:#ffffff;border:2px solid rgba(244,195,23,0.45);display:flex;align-items:center;gap:16px'>
        <div style='width:56px;height:56px;border-radius:50%;background:#0f2b46;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18pt;color:#f4c317'>◆</div>
        <div>
          <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#c86b4a'>Pionnier</div>
          <div style='font-weight:700;font-size:18pt;margin-top:2px'>Premier du quartier</div>
        </div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>« Votre parcours reste avec vous. »</div>
    <div class='page-num' style='color:#0f2b46'>04 / 05</div>
  `,
});

const s5 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>Etape 04 · Echange</div>
    <div style='margin-top:56px'>
      <div style='font-weight:700;font-size:84px;line-height:1.02;letter-spacing:-0.015em'>XP et badges<br/>debloquent de<br/>vraies recompenses.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.82);margin-top:28px;max-width:900px'>Catalogue marketplace — pas des points pour des points. De la vraie valeur. Beta ouverte pour les agents a Douala.</div>
    </div>
    <div style='margin-top:44px;display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px'>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>Mot-cle FR</div>
        <div style='font-weight:700;font-size:24pt;margin-top:6px;line-height:1.2'>DM « TERRAIN »</div>
      </div>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>Mot-cle EN</div>
        <div style='font-weight:700;font-size:24pt;margin-top:6px;line-height:1.2'>DM "AGENT"</div>
      </div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:22pt;display:flex;align-items:center;gap:14px'>
        <span>Postulez cette semaine</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>Enregistrez. Partagez avec un proche a Douala qui connait son quartier.</div>
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
console.log(`wrote ${slides.length} FR slides to slides-fr.json`);
