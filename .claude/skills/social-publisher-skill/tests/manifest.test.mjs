import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateManifest } from '../scripts/manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));

test('valid carousel manifest passes validation', () => {
  const result = validateManifest(fixture('manifest.carousel.json'));
  assert.equal(result.ok, true);
  assert.equal(result.value.targets[0].platform, 'instagram');
});

test('valid story manifest passes validation', () => {
  const result = validateManifest(fixture('manifest.story.json'));
  assert.equal(result.ok, true);
});

test('valid linkedin document manifest passes validation', () => {
  const result = validateManifest(fixture('manifest.linkedin-doc.json'));
  assert.equal(result.ok, true);
});

test('valid multi-target manifest passes validation', () => {
  const result = validateManifest(fixture('manifest.multi.json'));
  assert.equal(result.ok, true);
  assert.equal(result.value.targets.length, 3);
});

test('invalid manifest fails with reason', () => {
  const result = validateManifest(fixture('manifest.invalid.json'));
  assert.equal(result.ok, false);
  assert.match(result.error, /claimAudit/);
});

test('missing schemaVersion is rejected', () => {
  const result = validateManifest({ slug: 'x', targets: [] });
  assert.equal(result.ok, false);
});

test('unknown schemaVersion is rejected', () => {
  const result = validateManifest({ schemaVersion: 999, slug: 'x', targets: [], claimAudit: 'passed' });
  assert.equal(result.ok, false);
  assert.match(result.error, /schemaVersion/);
});

test('IG carousel with 1 asset is rejected (min 2)', () => {
  const m = fixture('manifest.carousel.json');
  m.targets[0].assets = ['frame-01.png'];
  const result = validateManifest(m);
  assert.equal(result.ok, false);
});

test('IG carousel with 11 assets is rejected (max 10)', () => {
  const m = fixture('manifest.carousel.json');
  m.targets[0].assets = Array.from({ length: 11 }, (_, i) => `f-${i}.png`);
  const result = validateManifest(m);
  assert.equal(result.ok, false);
});

test('schedule mode=at requires at field', () => {
  const m = fixture('manifest.carousel.json');
  m.schedule = { mode: 'at', at: null, timezone: 'Africa/Douala' };
  const result = validateManifest(m);
  assert.equal(result.ok, false);
  assert.match(result.error, /at/);
});

test('claimAudit must be "passed" to publish', () => {
  const m = fixture('manifest.carousel.json');
  m.claimAudit = 'pending';
  const result = validateManifest(m);
  assert.equal(result.ok, false);
  assert.match(result.error, /claimAudit/);
});
