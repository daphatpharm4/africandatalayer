#!/usr/bin/env node
/**
 * Render ADL IG story / vertical post frames to 1080x1920 PNGs via playwright chromium.
 *
 * Usage:
 *   node .claude/skills/instagram-story-skill/scripts/render-story.mjs <frames-json> <out-dir>
 *
 * frames-json: path to JSON array of frame descriptors. Each entry:
 *   { id: "01", html: "<full html doc>" }
 *
 * Output: <out-dir>/frame-<id>.png at 1080x1920, deviceScaleFactor 2.
 *
 * Requires: playwright + chromium installed at repo root.
 */

import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const WIDTH = 1080;
const HEIGHT = 1920;

async function main() {
  const [framesPath, outDir] = process.argv.slice(2);
  if (!framesPath || !outDir) {
    console.error('Usage: node render-story.mjs <frames-json> <out-dir>');
    process.exit(2);
  }

  const frames = JSON.parse(await readFile(resolve(framesPath), 'utf8'));
  await mkdir(resolve(outDir), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });

  for (const frame of frames) {
    const page = await context.newPage();
    await page.setContent(frame.html, { waitUntil: 'networkidle' });
    const out = resolve(outDir, `frame-${frame.id}.png`);
    await page.screenshot({ path: out, fullPage: false, omitBackground: false });
    console.log(`rendered frame-${frame.id}.png`);
    await page.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
