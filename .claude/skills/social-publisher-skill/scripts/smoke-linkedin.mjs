#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolveAccount } from './account-map.mjs';
import { publishLinkedInImage } from './linkedin-post.mjs';
import { createLogger } from './logger.mjs';

const log = createLogger();

if (process.env.ALLOW_LIVE_SMOKE !== '1') {
  console.error('Refusing to run live LinkedIn smoke. Set ALLOW_LIVE_SMOKE=1 to enable.');
  process.exit(1);
}

const TEST_IMAGE_PATH = process.env.SMOKE_LI_IMAGE_PATH;
if (!TEST_IMAGE_PATH) {
  console.error('Set SMOKE_LI_IMAGE_PATH to a local PNG file path.');
  process.exit(1);
}

const accountResult = resolveAccount('adl_org');
if (!accountResult.ok) {
  console.error(accountResult.error);
  process.exit(2);
}

const { credentials } = accountResult.value;
const buffer = await readFile(TEST_IMAGE_PATH);
const stamp = new Date().toISOString();
const commentary = `TEST · DELETE ME · social-publisher LinkedIn smoke ${stamp}`;

log.info('starting LinkedIn smoke', { commentary });
const result = await publishLinkedInImage({
  credentials,
  imageBuffer: buffer,
  title: 'Smoke',
  commentary,
});
log.info('LinkedIn smoke posted', {
  postUrn: result.postUrn,
  permalink: result.permalink,
});

console.log('Waiting 60s before delete attempt...');
await new Promise((r) => setTimeout(r, 60_000));

try {
  const res = await fetch(
    `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(result.postUrn)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );
  if (!res.ok) {
    log.warn(
      'LinkedIn smoke delete returned non-OK; remove the post MANUALLY',
      { status: res.status, permalink: result.permalink }
    );
  } else {
    log.info('LinkedIn smoke post deleted via API');
  }
} catch (err) {
  log.error('LinkedIn smoke delete failed; remove manually', err, {
    permalink: result.permalink,
  });
}
