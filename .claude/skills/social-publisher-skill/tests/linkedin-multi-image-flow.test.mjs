import { test } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setupNock, LI_BASE } from './helpers/nock-setup.mjs';
import { publishLinkedInMultiImage } from '../scripts/linkedin-post.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

test('publishLinkedInMultiImage uploads N assets and posts with media[N]', async () => {
  const teardown = setupNock();
  const orgUrn = 'urn:li:organization:12345';
  const credentials = { accessToken: 'AQX', orgUrn };

  for (let i = 1; i <= 3; i++) {
    nock(LI_BASE)
      .post('/v2/assets')
      .query({ action: 'registerUpload' })
      .reply(200, {
        value: {
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: `https://li-upload.test/u/${i}`,
            },
          },
          asset: `urn:li:digitalmediaAsset:a${i}`,
        },
      });
    nock('https://li-upload.test').put(`/u/${i}`).reply(201);
  }

  nock(LI_BASE)
    .post(
      '/v2/ugcPosts',
      (body) =>
        body.specificContent['com.linkedin.ugc.ShareContent'].media.length === 3
    )
    .reply(201, '', { 'x-restli-id': 'urn:li:share:7100' });

  const png = readFileSync(join(fixturesDir, 'frame-1080x1350.png'));
  const result = await publishLinkedInMultiImage({
    credentials,
    imageBuffers: [png, png, png],
    title: 'Carousel',
    commentary: 'Multi',
  });

  assert.equal(result.postUrn, 'urn:li:share:7100');
  teardown();
});
