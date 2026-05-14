import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { uploadAssets, deleteAssets } from '../scripts/upload-host.mjs';
import { createMockBlob } from './helpers/mock-blob.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

test('uploadAssets resolves manifest-relative paths and returns URLs in order', async () => {
  const blob = createMockBlob();
  const urls = await uploadAssets({
    assetPaths: ['frame-1080x1350.png', 'frame-1080x1920.png'],
    manifestDir: fixturesDir,
    slug: 'test',
    blob,
  });
  assert.equal(urls.length, 2);
  assert.match(urls[0], /^https:\/\/blob\.test\//);
  assert.match(urls[0], /1080x1350/);
  assert.match(urls[1], /1080x1920/);
});

test('uploadAssets fails when asset file is missing', async () => {
  const blob = createMockBlob();
  await assert.rejects(
    uploadAssets({
      assetPaths: ['nonexistent.png'],
      manifestDir: fixturesDir,
      slug: 'test',
      blob,
    }),
    /nonexistent\.png/
  );
});

test('uploadAssets validates absolute paths are rejected', async () => {
  const blob = createMockBlob();
  await assert.rejects(
    uploadAssets({
      assetPaths: ['/etc/passwd'],
      manifestDir: fixturesDir,
      slug: 'test',
      blob,
    }),
    /relative/
  );
});

test('deleteAssets removes each URL', async () => {
  const blob = createMockBlob();
  const urls = await uploadAssets({
    assetPaths: ['frame-1080x1350.png'],
    manifestDir: fixturesDir,
    slug: 'test',
    blob,
  });
  assert.equal(blob.size(), 1);
  await deleteAssets({ urls, blob });
  assert.equal(blob.size(), 0);
});

test('deleteAssets continues on individual failure', async () => {
  const blob = createMockBlob();
  const goodUrl = (
    await uploadAssets({
      assetPaths: ['frame-1080x1350.png'],
      manifestDir: fixturesDir,
      slug: 'test',
      blob,
    })
  )[0];
  const result = await deleteAssets({
    urls: [goodUrl, 'https://blob.test/does-not-exist'],
    blob,
  });
  assert.equal(result.deleted.length, 1);
  assert.equal(result.failed.length, 1);
});
