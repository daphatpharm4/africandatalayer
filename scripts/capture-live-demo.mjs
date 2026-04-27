import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = resolve('/Users/charlesvictormahouve/Documents/GitHub/adl-demo-video/public/live');
mkdirSync(OUT_DIR, { recursive: true });

const URL = 'https://africandatalayer.com';

// Scroll targets (px from top) — chosen to land on section breaks
const CAPTURES = [
  { name: '01-hero', y: 0 },
  { name: '02-value', y: 1600 },
  { name: '03-proof', y: 3200 },
  { name: '04-coverage', y: 4800 },
  { name: '05-method', y: 6400 },
  { name: '06-pricing', y: 8000 },
  { name: '07-cta', y: 11600 },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices['iPhone 14 Pro'],
  viewport: { width: 420, height: 900 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

console.log('navigating:', URL);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
console.log('doc height:', docHeight);

for (const { name, y } of CAPTURES) {
  const clampedY = Math.min(y, docHeight - 900);
  await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), clampedY);
  await page.waitForTimeout(600);
  const file = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false, type: 'png' });
  console.log('captured:', name, 'at y=', clampedY);
}

await browser.close();
console.log('done →', OUT_DIR);
