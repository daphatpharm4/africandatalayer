#!/usr/bin/env node
/**
 * Render ADL IG carousel slides to 1080x1350 PNGs via playwright chromium.
 *
 * Usage:
 *   node scripts/render-ig-carousel.mjs <slides-json> <out-dir>
 *
 * slides-json: path to JSON array of slide descriptors. Each entry:
 *   { id: "01", html: "<full html doc>" }
 *
 * For week2-post2, see docs/marketing/assets/week2-post2/slides.json.
 */

import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { chromium } from 'playwright';

const WIDTH = 1080;
const HEIGHT = 1350;

async function main() {
  const [slidesPath, outDir] = process.argv.slice(2);
  if (!slidesPath || !outDir) {
    console.error('Usage: node scripts/render-ig-carousel.mjs <slides-json> <out-dir>');
    process.exit(2);
  }

  const slides = JSON.parse(await readFile(resolve(slidesPath), 'utf8'));
  await mkdir(resolve(outDir), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });

  for (const slide of slides) {
    const page = await context.newPage();
    await page.setContent(slide.html, { waitUntil: 'networkidle' });
    const out = resolve(outDir, `slide-${slide.id}.png`);
    await page.screenshot({ path: out, fullPage: false, omitBackground: false });
    console.log(`rendered slide-${slide.id}.png`);
    await page.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
