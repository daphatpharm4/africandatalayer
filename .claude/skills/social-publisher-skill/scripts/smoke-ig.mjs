#!/usr/bin/env node
import { resolveAccount } from './account-map.mjs';
import { publishIgSingle } from './ig-single.mjs';
import { createLogger } from './logger.mjs';

const log = createLogger();

if (process.env.ALLOW_LIVE_SMOKE !== '1') {
  console.error('Refusing to run live IG smoke. Set ALLOW_LIVE_SMOKE=1 to enable.');
  process.exit(1);
}

const TEST_IMAGE_URL = process.env.SMOKE_IG_IMAGE_URL;
if (!TEST_IMAGE_URL) {
  console.error('Set SMOKE_IG_IMAGE_URL to a public PNG/JPG URL hosted on Vercel Blob.');
  process.exit(1);
}

const accountResult = resolveAccount('adl_main');
if (!accountResult.ok) {
  console.error(accountResult.error);
  process.exit(2);
}

const { credentials } = accountResult.value;
const stamp = new Date().toISOString();
const caption = `TEST · DELETE ME · social-publisher smoke ${stamp}`;

log.info('starting IG smoke', { caption });
const result = await publishIgSingle({
  credentials,
  imageUrl: TEST_IMAGE_URL,
  caption,
});
log.info('IG smoke posted', { mediaId: result.mediaId, permalink: result.permalink });

console.log('Waiting 60s before delete attempt...');
await new Promise((r) => setTimeout(r, 60_000));

try {
  const res = await fetch(
    `https://graph.instagram.com/v22.0/${result.mediaId}?access_token=${credentials.accessToken}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    log.warn(
      'IG smoke delete returned non-OK; the test post must be removed MANUALLY from the IG app',
      { status: res.status, permalink: result.permalink }
    );
  } else {
    log.info('IG smoke post deleted via API', { mediaId: result.mediaId });
  }
} catch (err) {
  log.error('IG smoke delete failed; remove manually', err, {
    permalink: result.permalink,
  });
}
