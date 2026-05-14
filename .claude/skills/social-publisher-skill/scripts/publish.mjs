import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { validateManifest, computeIdempotencyKey } from './manifest.mjs';
import { resolveAccount, listRequiredEnvKeys } from './account-map.mjs';
import { createLogger } from './logger.mjs';
import { uploadAssets, deleteAssets } from './upload-host.mjs';
import { buildIgCaption } from './caption.mjs';
import { publishIgCarousel } from './ig-carousel.mjs';
import { publishIgStory } from './ig-story.mjs';
import { publishIgSingle } from './ig-single.mjs';
import {
  publishLinkedInImage,
  publishLinkedInMultiImage,
  publishLinkedInDocument,
} from './linkedin-post.mjs';
import { buildPdfFromPngs } from './pdf-builder.mjs';

export async function runPublish({
  manifestPath,
  env,
  options = {},
  blob,
  assetMap,
}) {
  const log = createLogger({ level: options.debug ? 'debug' : 'info' });

  let manifestRaw;
  try {
    manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return { exitCode: 1, error: `failed to read manifest: ${err.message}` };
  }

  const validation = validateManifest(manifestRaw);
  if (!validation.ok) {
    return { exitCode: 1, error: validation.error };
  }
  const manifest = validation.value;
  const manifestDir = dirname(resolve(manifestPath));

  const accountsNeeded = [...new Set(manifest.targets.map((t) => t.account))];
  for (const acc of accountsNeeded) {
    const r = resolveAccount(acc, env);
    if (!r.ok) return { exitCode: 2, error: r.error };
  }

  const onlyPlatform = options.only;
  const activeTargets = manifest.targets.filter(
    (t) => !onlyPlatform || t.platform === onlyPlatform
  );

  if (activeTargets.length === 0) {
    return { exitCode: 1, error: `no targets match --only ${onlyPlatform}` };
  }

  const idempotencyKey = computeIdempotencyKey({ manifest, manifestDir, assetMap });

  if (options.dryRun) {
    const summaries = activeTargets.map((t) => ({
      platform: t.platform,
      format: t.format,
      account: t.account,
      assetCount: t.assets.length,
      captionPreview: t.caption
        ? buildIgCaption({
            caption: t.caption,
            captionLang: t.captionLang,
            hashtags: t.hashtags ?? [],
            langOverride: options.lang,
          }).slice(0, 80)
        : t.commentary?.slice(0, 80) ?? '',
    }));
    log.info('dry-run summary', { slug: manifest.slug, idempotencyKey, targets: summaries });
    return { exitCode: 0, dryRun: true, idempotencyKey, targets: summaries };
  }

  const resultsPath = join(manifestDir, 'result.json');
  const existingResults = (() => {
    try {
      return JSON.parse(readFileSync(resultsPath, 'utf8'));
    } catch {
      return null;
    }
  })();
  if (existingResults?.idempotencyKey === idempotencyKey && !options.force) {
    log.info('idempotency match, returning cached result', { idempotencyKey });
    return { exitCode: 0, cached: true, results: existingResults };
  }

  const perTarget = [];
  for (const target of activeTargets) {
    const accountResult = resolveAccount(target.account, env);
    const { credentials } = accountResult.value;
    try {
      const r = await publishTarget({
        target,
        credentials,
        manifestDir,
        blob,
        assetMap,
        options,
        log,
      });
      perTarget.push(r);
    } catch (err) {
      log.error('target failed', err, {
        platform: target.platform,
        format: target.format,
      });
      perTarget.push({
        platform: target.platform,
        format: target.format,
        status: 'failed',
        error: {
          message: err.message,
          retryHint: `--only ${target.platform} --retry`,
        },
      });
    }
  }

  const anyFailed = perTarget.some((t) => t.status === 'failed');
  const anyOk = perTarget.some((t) => t.status === 'published');
  const overallExit = anyFailed ? (anyOk ? 4 : 3) : 0;
  const overallStatus = anyFailed ? (anyOk ? 'partial' : 'failed') : 'published';

  const resultDoc = {
    manifestSlug: manifest.slug,
    idempotencyKey,
    completedAt: new Date().toISOString(),
    status: overallStatus,
    targets: perTarget,
  };
  writeFileSync(resultsPath, JSON.stringify(resultDoc, null, 2));
  return { exitCode: overallExit, results: resultDoc };
}

async function publishTarget({
  target,
  credentials,
  manifestDir,
  blob,
  assetMap,
  options,
  log,
}) {
  if (target.platform === 'instagram') {
    const urls = await uploadAssets({
      assetPaths: target.assets.map((a) => assetMap?.[a] ?? a),
      manifestDir,
      slug: 'pub',
      blob,
    });
    try {
      if (target.format === 'carousel') {
        const caption = buildIgCaption({
          caption: target.caption,
          captionLang: target.captionLang,
          hashtags: target.hashtags,
          langOverride: options.lang,
        });
        const r = await publishIgCarousel({ credentials, imageUrls: urls, caption });
        return {
          platform: 'instagram',
          format: 'carousel',
          status: 'published',
          mediaId: r.mediaId,
          permalink: r.permalink,
          manualSteps: [],
        };
      }
      if (target.format === 'story') {
        const r = await publishIgStory({
          credentials,
          imageUrls: urls,
          linkSticker: target.linkSticker,
        });
        return {
          platform: 'instagram',
          format: 'story',
          status: 'published',
          mediaIds: r.mediaIds,
          manualSteps: r.manualSteps,
        };
      }
      if (target.format === 'single') {
        const caption = buildIgCaption({
          caption: target.caption,
          captionLang: target.captionLang,
          hashtags: target.hashtags,
          langOverride: options.lang,
        });
        const r = await publishIgSingle({ credentials, imageUrl: urls[0], caption });
        return {
          platform: 'instagram',
          format: 'single',
          status: 'published',
          mediaId: r.mediaId,
          permalink: r.permalink,
          manualSteps: [],
        };
      }
    } finally {
      await deleteAssets({ urls, blob }).catch(() => {});
    }
  }

  if (target.platform === 'linkedin') {
    const buffers = target.assets.map((a) =>
      readFileSync(join(manifestDir, assetMap?.[a] ?? a))
    );
    if (target.format === 'image') {
      const r = await publishLinkedInImage({
        credentials,
        imageBuffer: buffers[0],
        title: target.title,
        commentary: target.commentary,
        visibility: target.visibility,
      });
      return {
        platform: 'linkedin',
        format: 'image',
        status: 'published',
        postUrn: r.postUrn,
        permalink: r.permalink,
      };
    }
    if (target.format === 'multi-image') {
      const r = await publishLinkedInMultiImage({
        credentials,
        imageBuffers: buffers,
        title: target.title,
        commentary: target.commentary,
        visibility: target.visibility,
      });
      return {
        platform: 'linkedin',
        format: 'multi-image',
        status: 'published',
        postUrn: r.postUrn,
        permalink: r.permalink,
      };
    }
    if (target.format === 'document-carousel') {
      const pdf = await buildPdfFromPngs(buffers);
      const r = await publishLinkedInDocument({
        credentials,
        pdfBuffer: Buffer.from(pdf),
        title: target.title,
        commentary: target.commentary,
        visibility: target.visibility,
      });
      return {
        platform: 'linkedin',
        format: 'document-carousel',
        status: 'published',
        postUrn: r.postUrn,
        permalink: r.permalink,
      };
    }
  }

  throw new Error(`unsupported target: ${target.platform}/${target.format}`);
}

function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a === '--now') opts.now = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--lang') opts.lang = argv[++i];
    else if (a === '--only') opts.only = argv[++i];
    else if (a === '--at') opts.at = argv[++i];
    else if (a === '--tz') opts.tz = argv[++i];
    else if (a === '--retry') opts.retry = true;
    else if (a === '--debug') opts.debug = true;
    else positional.push(a);
  }
  return { opts, positional };
}

function resolveManifestPath(arg) {
  if (arg.endsWith('.json')) return resolve(arg);
  return resolve('docs/marketing/assets', arg, 'publish.json');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { opts, positional } = parseArgs(process.argv.slice(2));

  if (opts.check) {
    const requiredKeys = listRequiredEnvKeys(['adl_main', 'adl_org']);
    const missing = requiredKeys.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.error('Missing env keys:', missing.join(', '));
      process.exit(2);
    }
    console.log('OK: env keys present for adl_main + adl_org');
    process.exit(0);
  }

  if (positional[0] === 'queue') {
    const { runQueueCommand } = await import('./schedule.mjs');
    const code = await runQueueCommand(positional.slice(1), opts);
    process.exit(code);
  }

  if (positional[0] === 'token' && positional[1] === 'refresh') {
    await import('./token-refresh.mjs');
    process.exit(0);
  }

  if (positional.length === 0) {
    console.error(
      'Usage: publish.mjs <manifest|slug> [--now|--at <iso>] [--dry-run] [--check] [--only ig|li] [--lang en|fr]'
    );
    process.exit(1);
  }

  const manifestPath = resolveManifestPath(positional[0]);
  const result = await runPublish({
    manifestPath,
    env: process.env,
    options: opts,
  });
  if (result.error) console.error(result.error);
  process.exit(result.exitCode);
}
