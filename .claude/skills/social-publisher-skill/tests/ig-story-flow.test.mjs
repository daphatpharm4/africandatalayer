import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupNock,
  mockIgStoryContainer,
  mockIgStatus,
  mockIgPublish,
} from './helpers/nock-setup.mjs';
import { publishIgStory } from '../scripts/ig-story.mjs';

test('publishIgStory posts each frame sequentially and returns media IDs', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { accessToken: 'tok', userId: igId };

  mockIgStoryContainer({ igId, imageUrl: 'https://blob.test/f1', containerId: 'c1' });
  mockIgStatus({ containerId: 'c1', statuses: ['FINISHED'] });
  mockIgPublish({ igId, creationId: 'c1', mediaId: 'm1' });

  mockIgStoryContainer({ igId, imageUrl: 'https://blob.test/f2', containerId: 'c2' });
  mockIgStatus({ containerId: 'c2', statuses: ['FINISHED'] });
  mockIgPublish({ igId, creationId: 'c2', mediaId: 'm2' });

  const result = await publishIgStory({
    credentials,
    imageUrls: ['https://blob.test/f1', 'https://blob.test/f2'],
    pollIntervalMs: 1,
    frameDelayMs: 0,
  });

  assert.equal(result.status, 'published');
  assert.deepEqual(result.mediaIds, ['m1', 'm2']);
  teardown();
});

test('publishIgStory includes manual-step note when linkSticker provided', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { accessToken: 'tok', userId: igId };

  mockIgStoryContainer({ igId, imageUrl: 'https://blob.test/f1', containerId: 'c1' });
  mockIgStatus({ containerId: 'c1', statuses: ['FINISHED'] });
  mockIgPublish({ igId, creationId: 'c1', mediaId: 'm1' });

  const result = await publishIgStory({
    credentials,
    imageUrls: ['https://blob.test/f1'],
    linkSticker: { frame: 1, url: 'https://adl.app/?utm=t', text: 'MAP' },
    pollIntervalMs: 1,
    frameDelayMs: 0,
  });

  assert.equal(result.manualSteps.length, 1);
  assert.match(result.manualSteps[0], /Frame 1.*link sticker.*adl\.app/);
  teardown();
});
