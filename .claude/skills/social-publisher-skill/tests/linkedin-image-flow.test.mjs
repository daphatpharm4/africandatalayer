import { test } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setupNock, LI_BASE } from './helpers/nock-setup.mjs';
import { publishLinkedInImage } from '../scripts/linkedin-post.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

test('publishLinkedInImage registers upload, PUTs binary, creates ugcPost', async () => {
  const teardown = setupNock();
  const orgUrn = 'urn:li:organization:12345';
  const credentials = { accessToken: 'AQX', orgUrn };

  nock(LI_BASE)
    .post('/v2/assets', (body) => body.registerUploadRequest.owner === orgUrn)
    .query({ action: 'registerUpload' })
    .reply(200, {
      value: {
        uploadMechanism: {
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
            uploadUrl: 'https://li-upload.test/u/1',
          },
        },
        asset: 'urn:li:digitalmediaAsset:abc123',
      },
    });

  nock('https://li-upload.test').put('/u/1').reply(201);

  nock(LI_BASE)
    .post(
      '/v2/ugcPosts',
      (body) =>
        body.author === orgUrn &&
        body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory ===
          'IMAGE'
    )
    .reply(201, '', { 'x-restli-id': 'urn:li:share:7000' });

  const png = readFileSync(join(fixturesDir, 'frame-1080x1350.png'));
  const result = await publishLinkedInImage({
    credentials,
    imageBuffer: png,
    title: 'Hi',
    commentary: 'Hello LinkedIn',
    visibility: 'PUBLIC',
  });

  assert.equal(result.status, 'published');
  assert.equal(result.postUrn, 'urn:li:share:7000');
  assert.match(result.permalink, /linkedin\.com\/feed\/update\/urn:li:share:7000/);
  teardown();
});

test('publishLinkedInImage surfaces auth error on 401', async () => {
  const teardown = setupNock();
  const orgUrn = 'urn:li:organization:12345';
  const credentials = { accessToken: 'bad', orgUrn };

  nock(LI_BASE)
    .post('/v2/assets')
    .query({ action: 'registerUpload' })
    .reply(401, { message: 'Invalid access token' });

  const png = readFileSync(join(fixturesDir, 'frame-1080x1350.png'));
  await assert.rejects(
    publishLinkedInImage({
      credentials,
      imageBuffer: png,
      title: 'X',
      commentary: 'X',
    }),
    /Invalid access token/
  );
  teardown();
});
