import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('web viewport permits zoom and never blocks landscape use', async () => {
  const [html, css, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../index.css', import.meta.url), 'utf8'),
    readFile(new URL('../App.tsx', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  assert.doesNotMatch(html, /landscape-block|rotate your device/i);
  assert.doesNotMatch(css, /landscape-block|rotate-phone/i);
  assert.doesNotMatch(app, /portrait-primary|lockOrientation/);
});

test('Android activity supports device rotation', async () => {
  const manifest = await readFile(
    new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(manifest, /screenOrientation\s*=\s*"portrait"/i);
});
