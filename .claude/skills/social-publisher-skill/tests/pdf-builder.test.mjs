import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildPdfFromPngs } from '../scripts/pdf-builder.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

test('builds a 3-page PDF from 3 PNGs', async () => {
  const png = readFileSync(join(fixturesDir, 'frame-1080x1350.png'));
  const pdfBytes = await buildPdfFromPngs([png, png, png]);
  const pdf = await PDFDocument.load(pdfBytes);
  assert.equal(pdf.getPageCount(), 3);
});

test('PDF pages are 1080x1350 points', async () => {
  const png = readFileSync(join(fixturesDir, 'frame-1080x1350.png'));
  const pdfBytes = await buildPdfFromPngs([png]);
  const pdf = await PDFDocument.load(pdfBytes);
  const { width, height } = pdf.getPage(0).getSize();
  assert.equal(width, 1080);
  assert.equal(height, 1350);
});

test('throws when given empty input', async () => {
  await assert.rejects(buildPdfFromPngs([]), /at least one/i);
});
