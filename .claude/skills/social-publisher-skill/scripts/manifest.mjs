import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const Schedule = z
  .object({
    mode: z.enum(['now', 'at']),
    at: z.string().datetime().nullable(),
    timezone: z.string().default('Africa/Douala'),
  })
  .refine((s) => s.mode === 'now' || (s.mode === 'at' && typeof s.at === 'string'), {
    message: 'schedule.at is required when schedule.mode is "at"',
    path: ['at'],
  });

const Caption = z.object({
  en: z.string().max(2200),
  fr: z.string().max(2200),
});

const IgCarouselTarget = z
  .object({
    platform: z.literal('instagram'),
    format: z.literal('carousel'),
    account: z.string(),
    assets: z.array(z.string()).min(2).max(10),
    caption: Caption,
    captionLang: z.enum(['en', 'fr']),
    hashtags: z.array(z.string().regex(/^#/)).max(30),
    altText: z.array(z.string()),
    firstComment: z.string().nullable().optional(),
    locationId: z.string().nullable().optional(),
  })
  .refine((t) => t.altText.length === t.assets.length, {
    message: 'altText length must match assets length',
    path: ['altText'],
  });

const IgStoryTarget = z.object({
  platform: z.literal('instagram'),
  format: z.literal('story'),
  account: z.string(),
  assets: z.array(z.string()).min(1).max(10),
  linkSticker: z
    .object({
      frame: z.number().int().min(1),
      url: z.url(),
      text: z.string(),
    })
    .optional(),
  altText: z.array(z.string()),
});

const IgSingleTarget = z.object({
  platform: z.literal('instagram'),
  format: z.literal('single'),
  account: z.string(),
  assets: z.array(z.string()).length(1),
  caption: Caption,
  captionLang: z.enum(['en', 'fr']),
  hashtags: z.array(z.string().regex(/^#/)).max(30),
  altText: z.array(z.string()).length(1),
});

const LiBase = z.object({
  account: z.string(),
  title: z.string(),
  commentary: z.string().max(3000),
  visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC'),
});

const LiImageTarget = LiBase.extend({
  platform: z.literal('linkedin'),
  format: z.literal('image'),
  assets: z.array(z.string()).length(1),
});

const LiMultiImageTarget = LiBase.extend({
  platform: z.literal('linkedin'),
  format: z.literal('multi-image'),
  assets: z.array(z.string()).min(2).max(9),
});

const LiDocTarget = LiBase.extend({
  platform: z.literal('linkedin'),
  format: z.literal('document-carousel'),
  assets: z.array(z.string()).min(2).max(20),
});

const Target = z.discriminatedUnion('format', [
  IgCarouselTarget,
  IgStoryTarget,
  IgSingleTarget,
  LiImageTarget,
  LiMultiImageTarget,
  LiDocTarget,
]);

const Manifest = z.object({
  schemaVersion: z.literal(1, {
    message: 'schemaVersion must be 1 (current schema version)',
  }),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  briefPath: z.string(),
  targets: z.array(Target).min(1).max(10),
  schedule: Schedule,
  claimAudit: z.literal('passed', {
    message: 'claimAudit must be "passed" before publishing',
  }),
  createdBy: z.string(),
  status: z.enum(['pending', 'uploading', 'published', 'failed', 'partial']).default('pending'),
});

export function validateManifest(input) {
  const result = Manifest.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const error = result.error.issues
    .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
    .join('; ');
  return { ok: false, error };
}

export { Manifest };

export function computeIdempotencyKey({ manifest, manifestDir, assetMap = {} }) {
  const hash = createHash('sha256');
  for (const target of manifest.targets) {
    hash.update(target.platform);
    hash.update(target.format);
    hash.update(target.account);
    if (target.caption) {
      hash.update(target.caption.en);
      hash.update(target.caption.fr);
    }
    if (target.commentary) hash.update(target.commentary);
    if (target.title) hash.update(target.title);
    if (target.hashtags) hash.update(target.hashtags.join(','));
    for (const asset of target.assets) {
      const realPath = assetMap[asset] ?? asset;
      const data = readFileSync(join(manifestDir, realPath));
      hash.update(createHash('sha256').update(data).digest());
    }
  }
  return 'sha256:' + hash.digest('hex');
}
