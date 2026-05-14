import { test } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  setupNock,
  GRAPH_BASE,
  LI_BASE,
  mockIgChildContainer,
  mockIgParentContainer,
  mockIgStatus,
  mockIgPublish,
  mockIgPermalink,
} from './helpers/nock-setup.mjs';
import { runPublish } from '../scripts/publish.mjs';
import { createMockBlob } from './helpers/mock-blob.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

test('IG succeeds, LinkedIn fails → exit 4, both recorded', async () => {
  const teardown = setupNock();
  const env = {
    IG_PAGE_TOKEN_ADL_MAIN: 'tok',
    IG_BUSINESS_ID_ADL_MAIN: '17841',
    IG_FB_PAGE_ID_ADL_MAIN: '10215',
    LI_ACCESS_TOKEN_ADL_ORG: 'AQX',
    LI_REFRESH_TOKEN_ADL_ORG: 'AQY',
    LI_ORG_URN_ADL_ORG: 'urn:li:organization:1',
    LI_TOKEN_EXPIRES_AT_ADL_ORG: '2027-01-01T00:00:00Z',
  };

  // IG carousel succeeds — 2 children + parent + status + publish + permalink
  mockIgChildContainer({ igId: '17841', imageUrl: /blob\.test/, containerId: 'c1' });
  mockIgChildContainer({ igId: '17841', imageUrl: /blob\.test/, containerId: 'c2' });
  mockIgParentContainer({
    igId: '17841',
    children: ['c1', 'c2'],
    caption: /EN/,
    containerId: 'parent',
  });
  mockIgStatus({ containerId: 'parent', statuses: ['FINISHED'] });
  mockIgPublish({ igId: '17841', creationId: 'parent', mediaId: 'm1' });
  mockIgPermalink({ mediaId: 'm1', permalink: 'https://www.instagram.com/p/abc/' });

  // IG story succeeds — 1 frame: media + status + publish
  nock(GRAPH_BASE).post(/.+\/media$/).query(true).reply(200, { id: 's1' });
  nock(GRAPH_BASE).get(/.+/).query(true).reply(200, { status_code: 'FINISHED' });
  nock(GRAPH_BASE).post(/.+\/media_publish/).query(true).reply(200, { id: 'sm1' });

  // LinkedIn fails on registerUpload
  nock(LI_BASE)
    .post('/v2/assets')
    .query({ action: 'registerUpload' })
    .reply(500, { message: 'down' });

  const manifestPath = join(fixturesDir, 'manifest.multi.json');
  const result = await runPublish({
    manifestPath,
    env,
    options: { lang: 'en' },
    blob: createMockBlob(),
    assetMap: {
      'frame-01.png': 'frame-1080x1350.png',
      'frame-02.png': 'frame-1080x1350.png',
    },
  });

  assert.equal(result.exitCode, 4);
  const targets = result.results.targets;
  const ig = targets.find((t) => t.platform === 'instagram' && t.format === 'carousel');
  const li = targets.find((t) => t.platform === 'linkedin');
  assert.equal(ig.status, 'published');
  assert.equal(li.status, 'failed');
  assert.match(li.error.message, /down/);
  teardown();
});
