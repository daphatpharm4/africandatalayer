#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = process.cwd();
const outputDir = resolve(root, 'artifacts', 'marketing', 'adl-data-operations-commercial');
mkdirSync(outputDir, { recursive: true });

const navy = '#0f2b46';
const terra = '#c86b4a';
const forest = '#2f8f67';
const gold = '#f4c317';
const paper = '#f5f7f6';
const ink = '#122235';
const muted = '#647084';

const logo = (x, y, size) => `
  <g transform="translate(${x} ${y}) scale(${size / 128})">
    <path d="M64 14L112 40L64 66L16 40L64 14Z" fill="${navy}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
    <path d="M64 44L112 70L64 96L16 70L64 44Z" fill="${gold}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
    <path d="M16 76L64 102L112 76L76 114C73 117 68.9 118.5 64.8 118.5C60.7 118.5 56.6 117 53.6 114L16 76Z" fill="${navy}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
  </g>`;

const svg = (background, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="#0f2b46" stroke-opacity="0.055" stroke-width="2"/></pattern>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#0f2b46" flood-opacity="0.18"/></filter>
    <linearGradient id="navyGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173f63"/><stop offset="1" stop-color="#0b2035"/></linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="${background}"/>
  ${body}
</svg>`;

const scenes = [
  svg(paper, `
    <rect width="1080" height="1920" fill="url(#grid)"/>
    <circle cx="940" cy="270" r="310" fill="${terra}" opacity="0.10"/>
    <circle cx="80" cy="1690" r="330" fill="${forest}" opacity="0.09"/>
    ${logo(86, 110, 82)}
    <text x="190" y="155" fill="${navy}" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="800" letter-spacing="1">AFRICAN DATA LAYER</text>
    <rect x="88" y="430" width="170" height="12" rx="6" fill="${terra}"/>
    <text x="88" y="610" fill="${ink}" font-family="Inter,Arial,sans-serif" font-size="104" font-weight="850" letter-spacing="-3">
      <tspan x="88" dy="0">YOUR FIELD</tspan><tspan x="88" dy="118">DATA.</tspan>
    </text>
    <text x="88" y="930" fill="${terra}" font-family="Inter,Arial,sans-serif" font-size="96" font-weight="850" letter-spacing="-3">
      <tspan x="88" dy="0">FINALLY UNDER</tspan><tspan x="88" dy="108">CONTROL.</tspan>
    </text>
    <text x="92" y="1260" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="38" font-weight="500">
      <tspan x="92" dy="0">Build the exact collection workflow</tspan><tspan x="92" dy="58">your company needs.</tspan>
    </text>
    <g transform="translate(88 1510)">
      <rect width="904" height="176" rx="42" fill="#fff" filter="url(#shadow)"/>
      <circle cx="90" cy="88" r="38" fill="${forest}"/><path d="M72 88l13 13 26-29" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="154" y="78" fill="${ink}" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="750">Company-specific. Evidence-first.</text>
      <text x="154" y="125" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="27">Live from field capture to approved data.</text>
    </g>`),

  svg(navy, `
    <rect width="1080" height="1920" fill="url(#navyGlow)"/>
    <circle cx="120" cy="250" r="310" fill="${gold}" opacity="0.09"/>
    <circle cx="950" cy="1650" r="400" fill="${terra}" opacity="0.11"/>
    <text x="88" y="150" fill="${gold}" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="800" letter-spacing="5">YOUR WORKSPACE</text>
    <text x="88" y="255" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="76" font-weight="850" letter-spacing="-2">
      <tspan x="88" dy="0">YOUR BRAND.</tspan><tspan x="88" dy="88">YOUR FORMS.</tspan>
    </text>
    <g transform="translate(190 490)" filter="url(#shadow)">
      <rect width="700" height="1130" rx="72" fill="#0a1725" stroke="#fff" stroke-opacity="0.24" stroke-width="5"/>
      <rect x="26" y="26" width="648" height="1078" rx="52" fill="#fff"/>
      <rect x="280" y="48" width="140" height="26" rx="13" fill="#0a1725"/>
      <g transform="translate(62 105)">
        <circle cx="42" cy="42" r="42" fill="${terra}"/><text x="42" y="54" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="800">M</text>
        <text x="104" y="38" fill="${ink}" font-family="Inter,Arial,sans-serif" font-size="38" font-weight="800">Meridian</text>
        <text x="104" y="73" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="24">Field operations · Nairobi</text>
      </g>
      <rect x="62" y="225" width="576" height="116" rx="30" fill="#eef4f8"/>
      <text x="94" y="268" fill="${navy}" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" letter-spacing="2">COMPANY VERTICAL</text>
      <text x="94" y="314" fill="${ink}" font-family="Inter,Arial,sans-serif" font-size="31" font-weight="750">Waste collection points</text>
      <rect x="62" y="375" width="576" height="525" rx="32" fill="#edf1ef"/>
      <path d="M62 500C180 440 230 590 350 520S520 410 638 485M70 730C220 630 320 790 440 690S560 610 638 680" fill="none" stroke="#c8d0cd" stroke-width="18"/>
      <path d="M180 375v525M420 375v525M62 620h576" stroke="#d8dfdc" stroke-width="5"/>
      <g fill="${forest}" stroke="#fff" stroke-width="8">
        <circle cx="196" cy="540" r="30"/><circle cx="470" cy="485" r="30"/><circle cx="354" cy="720" r="30"/><circle cx="548" cy="790" r="30"/>
      </g>
      <rect x="62" y="930" width="576" height="128" rx="34" fill="${terra}"/>
      <text x="350" y="1008" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="800">＋ Capture company data</text>
    </g>
    <text x="540" y="1775" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="39" font-weight="750">Anywhere your team works.</text>`),

  svg(paper, `
    <rect width="1080" height="1920" fill="url(#grid)"/>
    <text x="88" y="150" fill="${terra}" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="800" letter-spacing="5">EVIDENCE, NOT GUESSWORK</text>
    <text x="88" y="275" fill="${ink}" font-family="Inter,Arial,sans-serif" font-size="76" font-weight="850" letter-spacing="-2">
      <tspan x="88" dy="0">CAPTURE.</tspan><tspan x="88" dy="88">REVIEW.</tspan><tspan x="88" dy="88">TRUST.</tspan>
    </text>
    <g transform="translate(88 610)" filter="url(#shadow)">
      <rect width="904" height="930" rx="42" fill="#fff"/>
      <rect width="904" height="118" rx="42" fill="${navy}"/><rect y="76" width="904" height="42" fill="${navy}"/>
      <text x="42" y="72" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="33" font-weight="800">Evidence review</text>
      <rect x="700" y="34" width="160" height="50" rx="25" fill="${gold}"/><text x="780" y="68" text-anchor="middle" fill="${navy}" font-family="Inter,Arial,sans-serif" font-size="20" font-weight="850">PENDING</text>
      <text x="42" y="175" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" letter-spacing="2">SUBMITTED FORM</text>
      <text x="42" y="225" fill="${ink}" font-family="Inter,Arial,sans-serif" font-size="32" font-weight="750">Official waste bin · Market Street</text>
      <g transform="translate(42 270)">
        <rect width="252" height="260" rx="26" fill="#dfe9e3"/><rect x="28" y="38" width="196" height="160" rx="18" fill="${forest}" opacity="0.82"/><circle cx="126" cy="110" r="48" fill="#fff" opacity="0.7"/>
        <text x="126" y="235" text-anchor="middle" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="20">Photo 1 · 1080×1920</text>
        <rect x="276" width="252" height="260" rx="26" fill="#e9e0db"/><path d="M304 192l64-72 54 50 58-88 20 110z" fill="${terra}" opacity="0.75"/>
        <text x="402" y="235" text-anchor="middle" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="20">Photo 2 · timestamped</text>
      </g>
      <g transform="translate(42 570)">
        <rect width="820" height="160" rx="28" fill="#eef4f8"/>
        <circle cx="70" cy="80" r="34" fill="${navy}"/><path d="M70 54c-19 0-34 15-34 34 0 25 34 54 34 54s34-29 34-54c0-19-15-34-34-34z" fill="#fff" transform="translate(0 -18) scale(.48) translate(72 54)"/>
        <text x="130" y="66" fill="${navy}" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" letter-spacing="2">GPS VERIFIED</text>
        <text x="130" y="112" fill="${ink}" font-family="Inter,Arial,sans-serif" font-size="29" font-weight="700">−1.286389, 36.817223 · ±9 m</text>
      </g>
      <g transform="translate(42 770)">
        <rect width="394" height="100" rx="26" fill="#fff" stroke="#e8b5a1" stroke-width="3"/><text x="197" y="63" text-anchor="middle" fill="#a94f31" font-family="Inter,Arial,sans-serif" font-size="29" font-weight="800">Reject with reason</text>
        <rect x="426" width="394" height="100" rx="26" fill="${forest}"/><text x="623" y="63" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="29" font-weight="800">Approve record</text>
      </g>
    </g>
    <text x="540" y="1705" text-anchor="middle" fill="${navy}" font-family="Inter,Arial,sans-serif" font-size="36" font-weight="800">Every decision keeps its evidence.</text>
    <text x="540" y="1765" text-anchor="middle" fill="${muted}" font-family="Inter,Arial,sans-serif" font-size="28">Photos · GPS · metadata · reviewer history</text>`),

  svg(navy, `
    <rect width="1080" height="1920" fill="url(#navyGlow)"/>
    <circle cx="540" cy="830" r="520" fill="none" stroke="#fff" stroke-opacity="0.035" stroke-width="140"/>
    <circle cx="540" cy="830" r="330" fill="${terra}" opacity="0.09"/>
    ${logo(426, 205, 228)}
    <text x="540" y="560" text-anchor="middle" fill="${gold}" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="850" letter-spacing="7">AFRICAN DATA LAYER</text>
    <text x="540" y="790" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="78" font-weight="850" letter-spacing="-2">
      <tspan x="540" dy="0">TURN THE</tspan><tspan x="540" dy="90">REAL WORLD</tspan><tspan x="540" dy="90">INTO RELIABLE</tspan><tspan x="540" dy="90">COMPANY DATA.</tspan>
    </text>
    <text x="540" y="1290" text-anchor="middle" fill="#cbd7e1" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="500">
      <tspan x="540" dy="0">Your forms. Your people.</tspan><tspan x="540" dy="54">One trusted operational layer.</tspan>
    </text>
    <rect x="174" y="1465" width="732" height="126" rx="63" fill="${terra}"/>
    <text x="540" y="1544" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="850">BOOK YOUR DATA OPERATION</text>
    <text x="540" y="1720" text-anchor="middle" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="31" font-weight="700">africandatalayer.com</text>
    <text x="540" y="1770" text-anchor="middle" fill="#9fb1c1" font-family="Inter,Arial,sans-serif" font-size="24">Built for teams working across Africa and beyond.</text>`),
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const pngs = [];

for (const [index, content] of scenes.entries()) {
  const number = String(index + 1).padStart(2, '0');
  const svgPath = resolve(outputDir, `scene-${number}.svg`);
  const pngPath = resolve(outputDir, `scene-${number}.png`);
  writeFileSync(svgPath, `${content.replace(/[ \t]+$/gm, '').trimEnd()}\n`);
  await page.goto(pathToFileURL(svgPath).href, { waitUntil: 'load' });
  await page.screenshot({ path: pngPath, type: 'png' });
  pngs.push(pngPath);
}

await browser.close();

const output = resolve(outputDir, 'adl-data-operations-commercial-15s-1080x1920.mp4');
const filter = [
  '[0:v]zoompan=z=\'min(zoom+0.00020,1.035)\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=120:s=1080x1920:fps=30,setsar=1[v0]',
  '[1:v]zoompan=z=\'min(zoom+0.00016,1.030)\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=120:s=1080x1920:fps=30,setsar=1[v1]',
  '[2:v]zoompan=z=\'min(zoom+0.00018,1.032)\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=120:s=1080x1920:fps=30,setsar=1[v2]',
  '[3:v]zoompan=z=\'min(zoom+0.00012,1.025)\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=135:s=1080x1920:fps=30,setsar=1[v3]',
  '[v0][v1]xfade=transition=fade:duration=0.5:offset=3.5[x1]',
  '[x1][v2]xfade=transition=fade:duration=0.5:offset=7.0[x2]',
  '[x2][v3]xfade=transition=fade:duration=0.5:offset=10.5,format=yuv420p[vout]',
  '[4:a]lowpass=f=900,tremolo=f=2:d=0.35,volume=0.42,afade=t=in:st=0:d=0.8,afade=t=out:st=13.8:d=1.2[aout]',
].join(';');

execFileSync('ffmpeg', [
  '-y',
  '-loop', '1', '-t', '4', '-i', pngs[0],
  '-loop', '1', '-t', '4', '-i', pngs[1],
  '-loop', '1', '-t', '4', '-i', pngs[2],
  '-loop', '1', '-t', '4.5', '-i', pngs[3],
  '-f', 'lavfi', '-i', 'aevalsrc=0.055*sin(2*PI*110*t)+0.028*sin(2*PI*165*t)+0.018*sin(2*PI*220*t):s=48000:d=15',
  '-filter_complex', filter,
  '-map', '[vout]', '-map', '[aout]',
  '-t', '15', '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output,
], { stdio: 'inherit' });

console.log(output);
