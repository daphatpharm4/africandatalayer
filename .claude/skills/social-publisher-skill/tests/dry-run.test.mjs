import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runPublish } from '../scripts/publish.mjs';
import { createMockBlob } from './helpers/mock-blob.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

const credentials = {
  IG_PAGE_TOKEN_ADL_MAIN: 'tok',
  IG_BUSINESS_ID_ADL_MAIN: '17841',
  IG_FB_PAGE_ID_ADL_MAIN: '10215',
  LI_ACCESS_TOKEN_ADL_ORG: 'AQX',
  LI_REFRESH_TOKEN_ADL_ORG: 'AQY',
  LI_ORG_URN_ADL_ORG: 'urn:li:organization:1',
  LI_TOKEN_EXPIRES_AT_ADL_ORG: '2027-01-01T00:00:00Z',
};

test('dry-run resolves targets without network calls', async () => {
  const manifestPath = join(fixturesDir, 'manifest.multi.json');
  const result = await runPublish({
    manifestPath,
    env: credentials,
    options: { dryRun: true },
    blob: createMockBlob(),
    assetMap: {
      'frame-01.png': 'frame-1080x1350.png',
      'frame-02.png': 'frame-1080x1350.png',
    },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.dryRun, true);
  assert.equal(result.targets.length, 3);
});

test('dry-run fails fast when env keys missing', async () => {
  const manifestPath = join(fixturesDir, 'manifest.carousel.json');
  const result = await runPublish({
    manifestPath,
    env: { IG_PAGE_TOKEN_ADL_MAIN: 'tok' },
    options: { dryRun: true },
    blob: createMockBlob(),
    assetMap: {
      'frame-01.png': 'frame-1080x1350.png',
      'frame-02.png': 'frame-1080x1350.png',
      'frame-03.png': 'frame-1080x1350.png',
    },
  });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /missing env keys/);
});

test('dry-run rejects invalid manifest (claimAudit not passed)', async () => {
  const manifestPath = join(fixturesDir, 'manifest.invalid.json');
  const result = await runPublish({
    manifestPath,
    env: credentials,
    options: { dryRun: true },
    blob: createMockBlob(),
    assetMap: {
      'frame-01.png': 'frame-1080x1350.png',
      'frame-02.png': 'frame-1080x1350.png',
    },
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.error, /claimAudit/);
});
