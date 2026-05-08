#!/usr/bin/env node
// Build slides-fr.json for Week 4, Post 1 — FR mirror (launch, Mon 2026-05-04)
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

const stamp = () => `<div class='stamp'>Lancement · Semaine 4</div>`;

const s1 = page({
  bodyStyle: "background:#0f2b46;color:#f2f6fa",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.14);color:#f4c317'>Donnee De Terrain · Sur Votre Telephone</div>
    <div style='display:flex;align-items:center;gap:48px;margin-top:72px'>
      <div style='font-weight:700;font-size:240px;line-height:0.85;letter-spacing:-0.04em;color:#c86b4a'>01</div>
      <div style='display:flex;flex-direction:column;gap:14px'>
        <div style='font-weight:700;font-size:22pt;letter-spacing:0.12em;text-transform:uppercase;color:rgba(242,246,250,0.75)'>Lancement<br/>Mobile</div>
        <div style='width:64px;height:4px;background:#f4c317;border-radius:2px'></div>
        <div style='font-weight:500;font-size:18pt;color:rgba(242,246,250,0.7)'>iOS · Android</div>
      </div>
    </div>
    <div style='margin-top:96px'>
      <div style='font-weight:700;font-size:80px;line-height:1.02;letter-spacing:-0.015em'>African Data<br/>Layer est en<br/>ligne sur mobile.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(242,246,250,0.72);margin-top:28px;max-width:880px'>Camera native. GPS natif. Hors-ligne d'abord. Meme chaine de verification que la plateforme web — maintenant dans votre poche.</div>
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
    <div class='micro' style='background:rgba(200,107,74,0.14);color:#c86b4a'>Concu Pour Le Terrain</div>
    <div class='icon-chip' style='background:#fff8f4;margin-top:40px'>
      <svg viewBox='0 0 24 24' stroke='#c86b4a'><circle cx='12' cy='10' r='3'/><path d='M12 2C7 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-3-8-8-8z'/></svg>
    </div>
    <div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.01em;margin-top:32px'>Camera native.<br/>GPS natif.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>Construit pour le terrain, pas pour le bureau. Plein soleil, ecrans fissures, reseaux lents — concu pour tout cela.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:36px;max-width:920px'>
      <div style='padding:22px;border-radius:18px;background:#0f2b46;color:#f2f6fa'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>Cibles tactiles</div>
        <div style='font-weight:700;font-size:22pt;margin-top:6px'>44×44 minimum</div>
      </div>
      <div style='padding:22px;border-radius:18px;background:#c86b4a;color:#fff8f4'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85'>Lisible au soleil</div>
        <div style='font-weight:700;font-size:22pt;margin-top:6px'>Contraste WCAG AA</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.6)'>« Concu pour l'agent en plein soleil sur 2G. »</div>
    <div class='page-num' style='color:#0f2b46'>02 / 05</div>
  `,
});

const s3 = page({
  bodyStyle: "background:#eaf1ec;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(76,124,89,0.18);color:#2f5438'>Hors-Ligne D'Abord</div>
    <div class='accent-bar' style='background:#4c7c59'></div>
    <div style='font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-0.01em;margin-top:16px'>La file garde<br/>vos captures.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:24px;max-width:920px'>Quand le signal coupe, les soumissions vont dans une file IndexedDB locale. Quand le signal revient, elles se synchronisent automatiquement. Aucune ressaisie. Aucune donnee perdue.</div>
    <div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:36px;max-width:960px'>
      <div style='padding:22px;border-radius:20px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Capture</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Hors-ligne</div>
      </div>
      <div style='padding:22px;border-radius:20px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Garde</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>72h TTL</div>
      </div>
      <div style='padding:22px;border-radius:20px;background:#ffffff;border:2px solid rgba(76,124,89,0.25)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;color:#4c7c59'>Sync</div>
        <div style='font-weight:700;font-size:20pt;margin-top:6px;line-height:1.2'>Auto au retour</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>« Le mauvais reseau n'est plus votre probleme. »</div>
    <div class='page-num' style='color:#0f2b46'>03 / 05</div>
  `,
});

const s4 = page({
  bodyStyle: "background:#f2f6fa;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.28);color:#0f2b46'>Meme Moteur. Meme Preuve.</div>
    <div class='accent-bar' style='background:#f4c317'></div>
    <div style='font-weight:700;font-size:60px;line-height:1.04;letter-spacing:-0.01em;margin-top:16px'>Chaque point passe<br/>la meme chaine.</div>
    <div style='font-weight:500;font-size:26pt;line-height:1.35;color:rgba(15,43,70,0.78);margin-top:24px;max-width:920px'>Validation GPS. Controle EXIF. Score de risque. Ponderation par niveau de confiance. Memes cinq portes que la plateforme web.</div>
    <div style='margin-top:32px;padding:30px;border-radius:24px;background:#0f2b46;color:#f2f6fa;max-width:940px'>
      <div style='font-weight:700;font-size:14pt;letter-spacing:0.08em;text-transform:uppercase;color:#f4c317'>Chaine De Verification</div>
      <div style='display:flex;gap:14px;margin-top:18px;flex-wrap:wrap'>
        <div style='padding:10px 16px;border-radius:12px;background:rgba(244,195,23,0.18);font-weight:700;font-size:16pt'>GPS</div>
        <div style='padding:10px 16px;border-radius:12px;background:rgba(244,195,23,0.18);font-weight:700;font-size:16pt'>EXIF</div>
        <div style='padding:10px 16px;border-radius:12px;background:rgba(244,195,23,0.18);font-weight:700;font-size:16pt'>Doublons</div>
        <div style='padding:10px 16px;border-radius:12px;background:rgba(244,195,23,0.18);font-weight:700;font-size:16pt'>Risque</div>
        <div style='padding:10px 16px;border-radius:12px;background:rgba(244,195,23,0.18);font-weight:700;font-size:16pt'>Confiance</div>
      </div>
    </div>
    <div style='margin-top:auto;font-weight:500;font-style:italic;font-size:22pt;color:rgba(15,43,70,0.65)'>« Meme preuve de travail, partout. »</div>
    <div class='page-num' style='color:#0f2b46'>04 / 05</div>
  `,
});

const s5 = page({
  bodyStyle: "background:#c86b4a;color:#0f2b46",
  inner: `
    ${stamp()}
    <div class='micro' style='background:rgba(244,195,23,0.35);color:#0f2b46'>Telecharger Aujourd'hui</div>
    <div style='margin-top:56px'>
      <div style='font-weight:700;font-size:76px;line-height:1.02;letter-spacing:-0.015em'>Cartographiez<br/>votre quartier.<br/>Gagnez de vraies<br/>recompenses.</div>
      <div style='font-weight:500;font-size:26pt;line-height:1.35;margin-top:28px;color:rgba(15,43,70,0.82);max-width:900px'>Maintenant sur l'App Store et le Play Store. Si vous attendiez — la porte est ouverte.</div>
    </div>
    <div style='margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px'>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>Mot-cle EN</div>
        <div style='font-weight:700;font-size:24pt;margin-top:6px;line-height:1.2'>DM "MAP"</div>
      </div>
      <div style='padding:22px 26px;border-radius:20px;background:rgba(15,43,70,0.08);border:2px solid rgba(15,43,70,0.18)'>
        <div style='font-weight:700;font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7'>Mot-cle FR</div>
        <div style='font-weight:700;font-size:24pt;margin-top:6px;line-height:1.2'>DM « CARTE »</div>
      </div>
    </div>
    <div style='margin-top:auto;display:flex;flex-direction:column;gap:16px'>
      <div style='align-self:flex-start;padding:22px 34px;border-radius:999px;background:#0f2b46;color:#f2f6fa;font-weight:700;font-size:22pt;display:flex;align-items:center;gap:14px'>
        <span>Lien dans la bio</span>
        <span style='color:#f4c317'>→</span>
      </div>
      <div style='font-weight:500;font-size:19pt;color:rgba(15,43,70,0.72)'>Construit au Cameroun. Construit pour le terrain. Construit pour durer.</div>
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
