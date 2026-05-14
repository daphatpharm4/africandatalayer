import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeIdempotencyKey } from '../scripts/manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

const assetMap = {
  'frame-01.png': 'frame-1080x1350.png',
  'frame-02.png': 'frame-1080x1350.png',
  'frame-03.png': 'frame-1080x1350.png',
};

test('idempotency key is stable across repeated calls', () => {
  const manifest = JSON.parse(
    readFileSync(join(fixturesDir, 'manifest.carousel.json'), 'utf8')
  );
  const k1 = computeIdempotencyKey({ manifest, manifestDir: fixturesDir, assetMap });
  const k2 = computeIdempotencyKey({ manifest, manifestDir: fixturesDir, assetMap });
  assert.equal(k1, k2);
  assert.match(k1, /^sha256:[0-9a-f]{64}$/);
});

test('idempotency key changes when caption changes', () => {
  const manifest = JSON.parse(
    readFileSync(join(fixturesDir, 'manifest.carousel.json'), 'utf8')
  );
  const k1 = computeIdempotencyKey({ manifest, manifestDir: fixturesDir, assetMap });
  const m2 = JSON.parse(JSON.stringify(manifest));
  m2.targets[0].caption.en = 'Different';
  const k2 = computeIdempotencyKey({ manifest: m2, manifestDir: fixturesDir, assetMap });
  assert.notEqual(k1, k2);
});
