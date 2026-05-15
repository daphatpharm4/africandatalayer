import { test } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import {
  setupNock,
  mockIgChildContainer,
  mockIgParentContainer,
  mockIgStatus,
  mockIgPublish,
  mockIgPermalink,
} from './helpers/nock-setup.mjs';
import { publishIgCarousel } from '../scripts/ig-carousel.mjs';

test('publishIgCarousel posts children, parent, polls, publishes, returns permalink', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { accessToken: 'tok', userId: igId };

  mockIgChildContainer({ igId, imageUrl: 'https://blob.test/img-1', containerId: 'c1' });
  mockIgChildContainer({ igId, imageUrl: 'https://blob.test/img-2', containerId: 'c2' });
  mockIgParentContainer({ igId, children: ['c1', 'c2'], caption: 'Hello', containerId: 'parent' });
  mockIgStatus({ containerId: 'parent', statuses: ['IN_PROGRESS', 'FINISHED'] });
  mockIgPublish({ igId, creationId: 'parent', mediaId: 'media-99' });
  mockIgPermalink({ mediaId: 'media-99', permalink: 'https://www.instagram.com/p/Cxyz/' });

  const result = await publishIgCarousel({
    credentials,
    imageUrls: ['https://blob.test/img-1', 'https://blob.test/img-2'],
    caption: 'Hello',
    pollIntervalMs: 1,
  });

  assert.equal(result.status, 'published');
  assert.equal(result.mediaId, 'media-99');
  assert.equal(result.permalink, 'https://www.instagram.com/p/Cxyz/');
  teardown();
});

test('publishIgCarousel times out if container never finishes', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { accessToken: 'tok', userId: igId };

  mockIgChildContainer({ igId, imageUrl: 'https://blob.test/img-1', containerId: 'c1' });
  mockIgChildContainer({ igId, imageUrl: 'https://blob.test/img-2', containerId: 'c2' });
  mockIgParentContainer({ igId, children: ['c1', 'c2'], caption: 'X', containerId: 'parent' });
  mockIgStatus({
    containerId: 'parent',
    statuses: ['IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS'],
  });

  await assert.rejects(
    publishIgCarousel({
      credentials,
      imageUrls: ['https://blob.test/img-1', 'https://blob.test/img-2'],
      caption: 'X',
      pollIntervalMs: 1,
      maxPolls: 3,
    }),
    /FINISHED/i
  );
  teardown();
});

test('publishIgCarousel surfaces auth error from Graph API', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { accessToken: 'bad', userId: igId };

  nock('https://graph.instagram.com')
    .post(`/v22.0/${igId}/media`)
    .query(true)
    .reply(401, { error: { code: 190, message: 'Invalid OAuth access token' } });

  await assert.rejects(
    publishIgCarousel({
      credentials,
      imageUrls: ['https://blob.test/img-1', 'https://blob.test/img-2'],
      caption: 'X',
      pollIntervalMs: 1,
    }),
    /Invalid OAuth/i
  );
  teardown();
});
