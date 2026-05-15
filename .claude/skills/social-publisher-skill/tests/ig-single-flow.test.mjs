import { test } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import {
  setupNock,
  mockIgStatus,
  mockIgPublish,
  mockIgPermalink,
  GRAPH_BASE,
} from './helpers/nock-setup.mjs';
import { publishIgSingle } from '../scripts/ig-single.mjs';

test('publishIgSingle creates container, polls, publishes, returns permalink', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { accessToken: 'tok', userId: igId };

  nock(GRAPH_BASE)
    .post(`/v22.0/${igId}/media`)
    .query(
      (q) =>
        q.image_url === 'https://blob.test/img' && q.caption === 'Hi' && !q.media_type
    )
    .reply(200, { id: 'c1' });
  mockIgStatus({ containerId: 'c1', statuses: ['FINISHED'] });
  mockIgPublish({ igId, creationId: 'c1', mediaId: 'm1' });
  mockIgPermalink({ mediaId: 'm1', permalink: 'https://www.instagram.com/p/abc/' });

  const result = await publishIgSingle({
    credentials,
    imageUrl: 'https://blob.test/img',
    caption: 'Hi',
    pollIntervalMs: 1,
  });

  assert.equal(result.status, 'published');
  assert.equal(result.permalink, 'https://www.instagram.com/p/abc/');
  teardown();
});
