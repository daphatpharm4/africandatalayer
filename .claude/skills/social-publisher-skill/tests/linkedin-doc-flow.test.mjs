import { test } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { setupNock, LI_BASE } from './helpers/nock-setup.mjs';
import { publishLinkedInDocument } from '../scripts/linkedin-post.mjs';

test('publishLinkedInDocument uses document recipe and DOCUMENT category', async () => {
  const teardown = setupNock();
  const orgUrn = 'urn:li:organization:12345';
  const credentials = { accessToken: 'AQX', orgUrn };

  nock(LI_BASE)
    .post(
      '/v2/assets',
      (body) =>
        body.registerUploadRequest.recipes[0] ===
        'urn:li:digitalmediaRecipe:feedshare-document'
    )
    .query({ action: 'registerUpload' })
    .reply(200, {
      value: {
        uploadMechanism: {
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
            uploadUrl: 'https://li-upload.test/d',
          },
        },
        asset: 'urn:li:digitalmediaAsset:doc1',
      },
    });

  nock('https://li-upload.test').put('/d').reply(201);

  nock(LI_BASE)
    .post(
      '/v2/ugcPosts',
      (body) =>
        body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory ===
        'DOCUMENT'
    )
    .reply(201, '', { 'x-restli-id': 'urn:li:share:7200' });

  const fakePdf = Buffer.from('%PDF-1.4\n');
  const result = await publishLinkedInDocument({
    credentials,
    pdfBuffer: fakePdf,
    title: 'Doc',
    commentary: 'Doc commentary',
  });

  assert.equal(result.postUrn, 'urn:li:share:7200');
  teardown();
});
