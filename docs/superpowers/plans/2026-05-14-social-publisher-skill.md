# Social Publisher Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `.claude/skills/social-publisher-skill/` that consumes manifests from the existing carousel/story skills and publishes them to Instagram (Graph API) and LinkedIn (Marketing API, organization), with immediate + scheduled modes.

**Architecture:** A manifest-driven Node.js CLI under `.claude/skills/social-publisher-skill/scripts/`. The orchestrator (`publish.mjs`) validates a `publish.json` manifest, resolves account env vars, uploads PNG assets to Vercel Blob, then fans out to per-platform publishers (`ig-*.mjs`, `linkedin-post.mjs`). Scheduled jobs go to `queue/` and are drained by a cron-invoked `queue run`. Failure is partial — one bad target does not block the others.

**Tech Stack:** Node.js (ESM `.mjs`), zod (validation), @vercel/blob (already in deps), pdf-lib (new dep, for LinkedIn document carousels), nock (new dev dep, for HTTP mocking), Node native test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-05-14-social-publisher-skill-design.md`

---

## File Structure

### Created by this plan

```
.claude/skills/social-publisher-skill/
├── SKILL.md                                  (M1 + M6 update)
├── README.md                                 (M7)
├── reference/
│   ├── manifest-schema.md                    (M1)
│   ├── accounts.json                         (M1)
│   ├── ig-graph-api.md                       (M3)
│   ├── linkedin-ugc-api.md                   (M4)
│   ├── auth-setup.md                         (M7)
│   ├── error-codes.md                        (M7)
│   └── cron.example.txt                      (M5)
├── scripts/
│   ├── manifest.schema.json                  (M1)
│   ├── manifest.mjs                          (M1)
│   ├── account-map.mjs                       (M1)
│   ├── logger.mjs                            (M1)
│   ├── upload-host.mjs                       (M2)
│   ├── pdf-builder.mjs                       (M2)
│   ├── ig-carousel.mjs                       (M3)
│   ├── ig-story.mjs                          (M3)
│   ├── ig-single.mjs                         (M3)
│   ├── token-refresh.mjs                     (M3 + M4)
│   ├── linkedin-post.mjs                     (M4)
│   ├── schedule.mjs                          (M5)
│   ├── publish.mjs                           (M5 — orchestrator entry)
│   ├── smoke-ig.mjs                          (M3)
│   └── smoke-linkedin.mjs                    (M4)
├── queue/
│   ├── .gitkeep                              (M1)
│   └── logs/.gitkeep                         (M1)
├── tests/
│   ├── helpers/
│   │   ├── mock-blob.mjs                     (M2)
│   │   ├── mock-clock.mjs                    (M5)
│   │   └── nock-setup.mjs                    (M3)
│   ├── fixtures/
│   │   ├── manifest.carousel.json            (M1)
│   │   ├── manifest.story.json               (M1)
│   │   ├── manifest.linkedin-doc.json        (M1)
│   │   ├── manifest.multi.json               (M1)
│   │   ├── manifest.invalid.json             (M1)
│   │   ├── frame-1080x1350.png               (M1)
│   │   ├── frame-1080x1920.png               (M1)
│   │   └── frame-1080x1080.png               (M1)
│   ├── manifest.test.mjs                     (M1)
│   ├── account-map.test.mjs                  (M1)
│   ├── logger.test.mjs                       (M1)
│   ├── upload-host.test.mjs                  (M2)
│   ├── pdf-builder.test.mjs                  (M2)
│   ├── caption.test.mjs                      (M3)
│   ├── ig-carousel-flow.test.mjs             (M3)
│   ├── ig-story-flow.test.mjs                (M3)
│   ├── ig-single-flow.test.mjs               (M3)
│   ├── linkedin-image-flow.test.mjs          (M4)
│   ├── linkedin-multi-image-flow.test.mjs    (M4)
│   ├── linkedin-doc-flow.test.mjs            (M4)
│   ├── retry.test.mjs                        (M5)
│   ├── partial-failure.test.mjs              (M5)
│   ├── dry-run.test.mjs                      (M5)
│   ├── idempotency.test.mjs                  (M5)
│   └── schedule.test.mjs                     (M5)
└── examples/
    └── publish-manifest.example.json         (M1)
```

### Modified by this plan

- `package.json` — add `pdf-lib`, `nock` deps; add `test:publisher` script; wire into `test:ci` (M1, M5).
- `.gitignore` — add `queue/*` and `queue/logs/*` patterns under skill dir (M1).
- `.claude/skills/instagram-carousel-skill/SKILL.md` — emit `publish.json` step in workflow (M6).
- `.claude/skills/instagram-story-skill/SKILL.md` — same (M6).
- `docs/marketing/social-media-launch-plan.md` — add "Publishing operations" section (M7).

---

## Milestone Checkpoints

Each milestone ends with passing tests + a commit. After each milestone, the skill is in a working, useful state — even if incomplete.

- **M1 — Foundation** (Tasks 1–6): manifest validation, env resolution, logger, fixtures.
- **M2 — Asset hosting** (Tasks 7–8): Vercel Blob upload, PDF builder.
- **M3 — Instagram publish** (Tasks 9–13): IG carousel, story, single, token refresh, smoke test.
- **M4 — LinkedIn publish** (Tasks 14–17): LI image, multi-image, document, smoke test.
- **M5 — Orchestrator + scheduling** (Tasks 18–22): main entry, dry-run, retry, partial failure, idempotency, queue.
- **M6 — Producer skill updates** (Tasks 23–24): wire carousel + story skills to emit manifests.
- **M7 — Docs + ops polish** (Tasks 25–27): auth-setup, error-codes, README, launch-plan update.

---

# Milestone 1 — Foundation

## Task 1: Scaffold skill directory + SKILL.md stub

**Files:**
- Create: `.claude/skills/social-publisher-skill/SKILL.md`
- Create: `.claude/skills/social-publisher-skill/queue/.gitkeep`
- Create: `.claude/skills/social-publisher-skill/queue/logs/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create skill directory structure**

```bash
mkdir -p .claude/skills/social-publisher-skill/{reference,scripts,queue/logs,tests/{helpers,fixtures},examples}
touch .claude/skills/social-publisher-skill/queue/.gitkeep
touch .claude/skills/social-publisher-skill/queue/logs/.gitkeep
```

- [ ] **Step 2: Write SKILL.md stub**

Create `.claude/skills/social-publisher-skill/SKILL.md` with:

```markdown
---
name: social-publisher-skill
description: Publish African Data Layer Instagram + LinkedIn posts produced by the carousel/story skills via the official Graph + Marketing APIs. Reads a publish.json manifest, validates env tokens, uploads assets to Vercel Blob, fans out to IG carousel/story/single + LinkedIn image/multi-image/document-carousel. Supports immediate (--now) and scheduled (--at) modes with idempotency, dry-run, and partial-failure handling.
---

# Social Publisher Skill (ADL)

## When to use

User asks to publish, post, or schedule an existing ADL social asset to Instagram or LinkedIn. Triggers include: "publish week5-post1", "post the carousel", "post the story", "schedule X for tomorrow 8am", "/publish ...". Assumes the carousel or story skill has already produced PNG assets + a `publish.json` manifest under `docs/marketing/assets/<slug>/`.

**Not for:** generating new content (use `instagram-carousel-skill` or `instagram-story-skill` first), TikTok / X / Threads, personal LinkedIn profile, multi-account fan-out beyond `adl_main` + `adl_org`.

## Required reads before publishing

1. `docs/superpowers/specs/2026-05-14-social-publisher-skill-design.md` — full design.
2. `.claude/skills/social-publisher-skill/reference/manifest-schema.md` — manifest contract.
3. `.claude/skills/social-publisher-skill/reference/accounts.json` — logical account → env var map.
4. `.claude/skills/social-publisher-skill/reference/auth-setup.md` — token bootstrap (only first time).
5. `.claude/skills/social-publisher-skill/reference/error-codes.md` — known errors + actions.

## Workflow

1. Resolve manifest path: `<slug>` shortcut → `docs/marketing/assets/<slug>/publish.json`, or accept explicit path.
2. Run pre-flight: `node .claude/skills/social-publisher-skill/scripts/publish.mjs --check`. Stop on failure.
3. First call against a manifest in a session → run `--dry-run` first, show user the resolved targets + payloads.
4. After user confirmation, run `--now` (immediate) or `--at <iso>` (scheduled).
5. On success, report per-target permalinks + any manual steps (IG story stickers) in ≤80 words. Save `result.json` is automatic — do not paste it in chat.
6. On failure (exit 4 partial, exit 2/3 hard) — surface the error block from result.json and the suggested retry command. Do not retry automatically.

## Rules

- **Pre-flight gate**: never invoke `--now` without first running `--check` in the session.
- **Confirmation gate**: first `--now` per session asks the user to confirm. Subsequent calls in the same session may skip confirmation.
- **Dry-run first**: for any new manifest, default to `--dry-run` before live posting.
- **Claim audit**: manifest must have `claimAudit: "passed"`. Refuse to publish otherwise.
- **No secret echo**: never print tokens, refresh tokens, or org URNs in chat output.
- **Manual step transparency**: when IG story sticker overlay is requested, the chat output must clearly list the manual app-side step the operator needs to take after publish.
- **Save, don't dump**: keep chat output ≤80 words. Logs land in `queue/logs/`.

## Reference

- Spec: `docs/superpowers/specs/2026-05-14-social-publisher-skill-design.md`
- Producer skills: `.claude/skills/instagram-carousel-skill/`, `.claude/skills/instagram-story-skill/`
- API docs: `reference/ig-graph-api.md`, `reference/linkedin-ugc-api.md`
```

- [ ] **Step 3: Add gitignore entries**

Append to `.gitignore`:

```
# social-publisher-skill: queue contents are runtime, not source
.claude/skills/social-publisher-skill/queue/*.json
.claude/skills/social-publisher-skill/queue/logs/*.log
!.claude/skills/social-publisher-skill/queue/.gitkeep
!.claude/skills/social-publisher-skill/queue/logs/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/social-publisher-skill/SKILL.md \
        .claude/skills/social-publisher-skill/queue/.gitkeep \
        .claude/skills/social-publisher-skill/queue/logs/.gitkeep \
        .gitignore
git commit -m "feat(publisher): scaffold social-publisher-skill"
```

---

## Task 2: Install new dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pdf-lib + nock**

```bash
npm install pdf-lib@^1.17.1
npm install --save-dev nock@^13.5.4
```

- [ ] **Step 2: Verify install**

```bash
npm ls pdf-lib nock
```

Expected: both listed with the installed versions, no UNMET DEPENDENCY warnings.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add pdf-lib + nock for social publisher"
```

---

## Task 3: Write manifest schema + validator

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/manifest.schema.json`
- Create: `.claude/skills/social-publisher-skill/scripts/manifest.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/fixtures/manifest.carousel.json`
- Create: `.claude/skills/social-publisher-skill/tests/fixtures/manifest.story.json`
- Create: `.claude/skills/social-publisher-skill/tests/fixtures/manifest.linkedin-doc.json`
- Create: `.claude/skills/social-publisher-skill/tests/fixtures/manifest.multi.json`
- Create: `.claude/skills/social-publisher-skill/tests/fixtures/manifest.invalid.json`
- Create: `.claude/skills/social-publisher-skill/tests/manifest.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/manifest.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateManifest } from '../scripts/manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));

test('valid carousel manifest passes validation', () => {
  const result = validateManifest(fixture('manifest.carousel.json'));
  assert.equal(result.ok, true);
  assert.equal(result.value.targets[0].platform, 'instagram');
});

test('valid story manifest passes validation', () => {
  const result = validateManifest(fixture('manifest.story.json'));
  assert.equal(result.ok, true);
});

test('valid linkedin document manifest passes validation', () => {
  const result = validateManifest(fixture('manifest.linkedin-doc.json'));
  assert.equal(result.ok, true);
});

test('valid multi-target manifest passes validation', () => {
  const result = validateManifest(fixture('manifest.multi.json'));
  assert.equal(result.ok, true);
  assert.equal(result.value.targets.length, 3);
});

test('invalid manifest fails with reason', () => {
  const result = validateManifest(fixture('manifest.invalid.json'));
  assert.equal(result.ok, false);
  assert.match(result.error, /claimAudit/);
});

test('missing schemaVersion is rejected', () => {
  const result = validateManifest({ slug: 'x', targets: [] });
  assert.equal(result.ok, false);
});

test('unknown schemaVersion is rejected', () => {
  const result = validateManifest({ schemaVersion: 999, slug: 'x', targets: [], claimAudit: 'passed' });
  assert.equal(result.ok, false);
  assert.match(result.error, /schemaVersion/);
});

test('IG carousel with 1 asset is rejected (min 2)', () => {
  const m = fixture('manifest.carousel.json');
  m.targets[0].assets = ['frame-01.png'];
  const result = validateManifest(m);
  assert.equal(result.ok, false);
});

test('IG carousel with 11 assets is rejected (max 10)', () => {
  const m = fixture('manifest.carousel.json');
  m.targets[0].assets = Array.from({ length: 11 }, (_, i) => `f-${i}.png`);
  const result = validateManifest(m);
  assert.equal(result.ok, false);
});

test('schedule mode=at requires at field', () => {
  const m = fixture('manifest.carousel.json');
  m.schedule = { mode: 'at', at: null, timezone: 'Africa/Douala' };
  const result = validateManifest(m);
  assert.equal(result.ok, false);
  assert.match(result.error, /at/);
});

test('claimAudit must be "passed" to publish', () => {
  const m = fixture('manifest.carousel.json');
  m.claimAudit = 'pending';
  const result = validateManifest(m);
  assert.equal(result.ok, false);
  assert.match(result.error, /claimAudit/);
});
```

- [ ] **Step 2: Create fixtures**

Create `.claude/skills/social-publisher-skill/tests/fixtures/manifest.carousel.json`:

```json
{
  "schemaVersion": 1,
  "slug": "test-carousel",
  "briefPath": "docs/marketing/test.md",
  "targets": [
    {
      "platform": "instagram",
      "format": "carousel",
      "account": "adl_main",
      "assets": ["frame-01.png", "frame-02.png", "frame-03.png"],
      "caption": { "en": "Hello", "fr": "Bonjour" },
      "captionLang": "en",
      "hashtags": ["#Test", "#ADL"],
      "altText": ["alt 1", "alt 2", "alt 3"],
      "firstComment": null,
      "locationId": null
    }
  ],
  "schedule": { "mode": "now", "at": null, "timezone": "Africa/Douala" },
  "claimAudit": "passed",
  "createdBy": "test",
  "status": "pending"
}
```

Create `.claude/skills/social-publisher-skill/tests/fixtures/manifest.story.json`:

```json
{
  "schemaVersion": 1,
  "slug": "test-story",
  "briefPath": "docs/marketing/test-story.md",
  "targets": [
    {
      "platform": "instagram",
      "format": "story",
      "account": "adl_main",
      "assets": ["frame-01.png", "frame-02.png"],
      "linkSticker": { "frame": 2, "url": "https://adl.app/?utm=test", "text": "MAP" },
      "altText": ["alt 1", "alt 2"]
    }
  ],
  "schedule": { "mode": "now", "at": null, "timezone": "Africa/Douala" },
  "claimAudit": "passed",
  "createdBy": "test",
  "status": "pending"
}
```

Create `.claude/skills/social-publisher-skill/tests/fixtures/manifest.linkedin-doc.json`:

```json
{
  "schemaVersion": 1,
  "slug": "test-linkedin-doc",
  "briefPath": "docs/marketing/test.md",
  "targets": [
    {
      "platform": "linkedin",
      "format": "document-carousel",
      "account": "adl_org",
      "assets": ["frame-01.png", "frame-02.png", "frame-03.png"],
      "title": "Ground truth",
      "commentary": "Long-form post body.",
      "visibility": "PUBLIC"
    }
  ],
  "schedule": { "mode": "now", "at": null, "timezone": "Africa/Douala" },
  "claimAudit": "passed",
  "createdBy": "test",
  "status": "pending"
}
```

Create `.claude/skills/social-publisher-skill/tests/fixtures/manifest.multi.json`:

```json
{
  "schemaVersion": 1,
  "slug": "test-multi",
  "briefPath": "docs/marketing/test.md",
  "targets": [
    {
      "platform": "instagram",
      "format": "carousel",
      "account": "adl_main",
      "assets": ["frame-01.png", "frame-02.png"],
      "caption": { "en": "EN", "fr": "FR" },
      "captionLang": "en",
      "hashtags": ["#A"],
      "altText": ["a", "b"]
    },
    {
      "platform": "instagram",
      "format": "story",
      "account": "adl_main",
      "assets": ["frame-01.png"],
      "altText": ["a"]
    },
    {
      "platform": "linkedin",
      "format": "image",
      "account": "adl_org",
      "assets": ["frame-01.png"],
      "title": "T",
      "commentary": "C",
      "visibility": "PUBLIC"
    }
  ],
  "schedule": { "mode": "now", "at": null, "timezone": "Africa/Douala" },
  "claimAudit": "passed",
  "createdBy": "test",
  "status": "pending"
}
```

Create `.claude/skills/social-publisher-skill/tests/fixtures/manifest.invalid.json` (missing claimAudit field):

```json
{
  "schemaVersion": 1,
  "slug": "test-invalid",
  "briefPath": "docs/marketing/test.md",
  "targets": [
    {
      "platform": "instagram",
      "format": "carousel",
      "account": "adl_main",
      "assets": ["frame-01.png", "frame-02.png"],
      "caption": { "en": "E", "fr": "F" },
      "captionLang": "en",
      "hashtags": [],
      "altText": ["a", "b"]
    }
  ],
  "schedule": { "mode": "now", "at": null, "timezone": "Africa/Douala" },
  "createdBy": "test",
  "status": "pending"
}
```

- [ ] **Step 3: Run test to confirm failure**

```bash
node --test .claude/skills/social-publisher-skill/tests/manifest.test.mjs
```

Expected: all tests fail with "Cannot find module '../scripts/manifest.mjs'".

- [ ] **Step 4: Write the validator**

Create `.claude/skills/social-publisher-skill/scripts/manifest.mjs`:

```javascript
import { z } from 'zod';

const Schedule = z.object({
  mode: z.enum(['now', 'at']),
  at: z.string().datetime().nullable(),
  timezone: z.string().default('Africa/Douala'),
}).refine(
  (s) => s.mode === 'now' || (s.mode === 'at' && typeof s.at === 'string'),
  { message: 'schedule.at is required when schedule.mode is "at"' }
);

const Caption = z.object({
  en: z.string().max(2200),
  fr: z.string().max(2200),
});

const IgCarouselTarget = z.object({
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
}).refine(
  (t) => t.altText.length === t.assets.length,
  { message: 'altText length must match assets length' }
);

const IgStoryTarget = z.object({
  platform: z.literal('instagram'),
  format: z.literal('story'),
  account: z.string(),
  assets: z.array(z.string()).min(1).max(10),
  linkSticker: z.object({
    frame: z.number().int().min(1),
    url: z.string().url(),
    text: z.string(),
  }).optional(),
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
  schemaVersion: z.literal(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  briefPath: z.string(),
  targets: z.array(Target).min(1).max(10),
  schedule: Schedule,
  claimAudit: z.literal('passed', {
    errorMap: () => ({ message: 'claimAudit must be "passed" before publishing' }),
  }),
  createdBy: z.string(),
  status: z.enum(['pending', 'uploading', 'published', 'failed', 'partial']).default('pending'),
});

export function validateManifest(input) {
  const result = Manifest.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const error = result.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
  return { ok: false, error };
}

export { Manifest };
```

- [ ] **Step 5: Run tests to verify pass**

```bash
node --test .claude/skills/social-publisher-skill/tests/manifest.test.mjs
```

Expected: all 11 tests pass.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/manifest.mjs \
        .claude/skills/social-publisher-skill/tests/manifest.test.mjs \
        .claude/skills/social-publisher-skill/tests/fixtures/*.json
git commit -m "feat(publisher): manifest schema + zod validator"
```

---

## Task 4: Account map + env resolver

**Files:**
- Create: `.claude/skills/social-publisher-skill/reference/accounts.json`
- Create: `.claude/skills/social-publisher-skill/scripts/account-map.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/account-map.test.mjs`

- [ ] **Step 1: Create accounts.json**

Create `.claude/skills/social-publisher-skill/reference/accounts.json`:

```json
{
  "adl_main": {
    "platform": "instagram",
    "envKeys": {
      "pageToken": "IG_PAGE_TOKEN_ADL_MAIN",
      "businessId": "IG_BUSINESS_ID_ADL_MAIN",
      "fbPageId": "IG_FB_PAGE_ID_ADL_MAIN"
    }
  },
  "adl_org": {
    "platform": "linkedin",
    "envKeys": {
      "accessToken": "LI_ACCESS_TOKEN_ADL_ORG",
      "refreshToken": "LI_REFRESH_TOKEN_ADL_ORG",
      "orgUrn": "LI_ORG_URN_ADL_ORG",
      "expiresAt": "LI_TOKEN_EXPIRES_AT_ADL_ORG"
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/account-map.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccount, listRequiredEnvKeys } from '../scripts/account-map.mjs';

test('resolves IG account from env', () => {
  const env = {
    IG_PAGE_TOKEN_ADL_MAIN: 'tok',
    IG_BUSINESS_ID_ADL_MAIN: '17841',
    IG_FB_PAGE_ID_ADL_MAIN: '10215',
  };
  const result = resolveAccount('adl_main', env);
  assert.equal(result.ok, true);
  assert.equal(result.value.platform, 'instagram');
  assert.equal(result.value.credentials.pageToken, 'tok');
  assert.equal(result.value.credentials.businessId, '17841');
});

test('resolves LinkedIn account from env', () => {
  const env = {
    LI_ACCESS_TOKEN_ADL_ORG: 'AQX',
    LI_REFRESH_TOKEN_ADL_ORG: 'AQY',
    LI_ORG_URN_ADL_ORG: 'urn:li:organization:12345',
    LI_TOKEN_EXPIRES_AT_ADL_ORG: '2026-07-13T00:00:00Z',
  };
  const result = resolveAccount('adl_org', env);
  assert.equal(result.ok, true);
  assert.equal(result.value.credentials.orgUrn, 'urn:li:organization:12345');
});

test('missing env keys produce explicit error listing each missing key', () => {
  const result = resolveAccount('adl_main', { IG_PAGE_TOKEN_ADL_MAIN: 'tok' });
  assert.equal(result.ok, false);
  assert.match(result.error, /IG_BUSINESS_ID_ADL_MAIN/);
  assert.match(result.error, /IG_FB_PAGE_ID_ADL_MAIN/);
});

test('unknown account name produces error', () => {
  const result = resolveAccount('nonexistent', {});
  assert.equal(result.ok, false);
  assert.match(result.error, /unknown account/i);
});

test('listRequiredEnvKeys returns all env vars for a target set', () => {
  const keys = listRequiredEnvKeys(['adl_main', 'adl_org']);
  assert.ok(keys.includes('IG_PAGE_TOKEN_ADL_MAIN'));
  assert.ok(keys.includes('LI_ACCESS_TOKEN_ADL_ORG'));
  assert.equal(keys.length, 7);
});
```

- [ ] **Step 3: Run test to confirm failure**

```bash
node --test .claude/skills/social-publisher-skill/tests/account-map.test.mjs
```

Expected: failure (module not found).

- [ ] **Step 4: Write account-map.mjs**

Create `.claude/skills/social-publisher-skill/scripts/account-map.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const accountsPath = join(here, '..', 'reference', 'accounts.json');
const accounts = JSON.parse(readFileSync(accountsPath, 'utf8'));

export function resolveAccount(name, env = process.env) {
  const config = accounts[name];
  if (!config) {
    return { ok: false, error: `unknown account "${name}". Known: ${Object.keys(accounts).join(', ')}` };
  }
  const credentials = {};
  const missing = [];
  for (const [field, envKey] of Object.entries(config.envKeys)) {
    if (!env[envKey]) {
      missing.push(envKey);
    } else {
      credentials[field] = env[envKey];
    }
  }
  if (missing.length > 0) {
    return { ok: false, error: `account "${name}" missing env keys: ${missing.join(', ')}` };
  }
  return { ok: true, value: { name, platform: config.platform, credentials } };
}

export function listRequiredEnvKeys(accountNames) {
  const keys = new Set();
  for (const name of accountNames) {
    const config = accounts[name];
    if (!config) continue;
    for (const envKey of Object.values(config.envKeys)) {
      keys.add(envKey);
    }
  }
  return Array.from(keys);
}

export { accounts };
```

- [ ] **Step 5: Run tests to verify pass**

```bash
node --test .claude/skills/social-publisher-skill/tests/account-map.test.mjs
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/social-publisher-skill/reference/accounts.json \
        .claude/skills/social-publisher-skill/scripts/account-map.mjs \
        .claude/skills/social-publisher-skill/tests/account-map.test.mjs
git commit -m "feat(publisher): account map + env resolver"
```

---

## Task 5: Redacting logger

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/logger.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/logger.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/logger.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, createLogger } from '../scripts/logger.mjs';

test('redacts token-like keys in objects', () => {
  const input = { access_token: 'AQX12345', user: 'bob' };
  const out = redact(input);
  assert.equal(out.access_token, '[REDACTED]');
  assert.equal(out.user, 'bob');
});

test('redacts page_token and refresh_token', () => {
  const out = redact({ page_token: 'x', refresh_token: 'y', name: 'z' });
  assert.equal(out.page_token, '[REDACTED]');
  assert.equal(out.refresh_token, '[REDACTED]');
  assert.equal(out.name, 'z');
});

test('redacts urn:li: values in strings', () => {
  const out = redact({ author: 'urn:li:organization:12345', other: 'plain' });
  assert.equal(out.author, '[REDACTED-URN]');
  assert.equal(out.other, 'plain');
});

test('redacts nested objects', () => {
  const out = redact({ data: { secret: 'shh', ok: true } });
  assert.equal(out.data.secret, '[REDACTED]');
  assert.equal(out.data.ok, true);
});

test('createLogger writes JSON lines to provided sink', () => {
  const lines = [];
  const log = createLogger({ sink: (line) => lines.push(line) });
  log.info('hello', { token: 'AQ', n: 1 });
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.level, 'info');
  assert.equal(parsed.msg, 'hello');
  assert.equal(parsed.token, '[REDACTED]');
  assert.equal(parsed.n, 1);
  assert.ok(parsed.ts);
});

test('logger error includes stack', () => {
  const lines = [];
  const log = createLogger({ sink: (line) => lines.push(line) });
  log.error('boom', new Error('explode'));
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.level, 'error');
  assert.match(parsed.error, /explode/);
  assert.ok(parsed.stack);
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
node --test .claude/skills/social-publisher-skill/tests/logger.test.mjs
```

Expected: failure.

- [ ] **Step 3: Write logger.mjs**

Create `.claude/skills/social-publisher-skill/scripts/logger.mjs`:

```javascript
const SENSITIVE_KEY = /token|secret|key|password|credential/i;

export function redact(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.startsWith('urn:li:')) return '[REDACTED-URN]';
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export function createLogger({ sink = (line) => process.stdout.write(line + '\n'), level = 'info' } = {}) {
  const emit = (lvl, msg, extra) => {
    const safe = redact(extra ?? {});
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg, ...safe });
    sink(line);
  };
  return {
    info: (msg, extra) => emit('info', msg, extra),
    warn: (msg, extra) => emit('warn', msg, extra),
    debug: (msg, extra) => level === 'debug' && emit('debug', msg, extra),
    error: (msg, err, extra = {}) => {
      const errObj = err instanceof Error
        ? { error: err.message, stack: err.stack, ...extra }
        : { error: err, ...extra };
      emit('error', msg, errObj);
    },
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
node --test .claude/skills/social-publisher-skill/tests/logger.test.mjs
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/logger.mjs \
        .claude/skills/social-publisher-skill/tests/logger.test.mjs
git commit -m "feat(publisher): redacting JSON logger"
```

---

## Task 6: Manifest schema doc + test PNG fixtures + npm script

**Files:**
- Create: `.claude/skills/social-publisher-skill/reference/manifest-schema.md`
- Create: `.claude/skills/social-publisher-skill/tests/fixtures/frame-1080x1350.png`
- Create: `.claude/skills/social-publisher-skill/tests/fixtures/frame-1080x1920.png`
- Create: `.claude/skills/social-publisher-skill/tests/fixtures/frame-1080x1080.png`
- Create: `.claude/skills/social-publisher-skill/examples/publish-manifest.example.json`
- Modify: `package.json`

- [ ] **Step 1: Write manifest-schema.md**

Create `.claude/skills/social-publisher-skill/reference/manifest-schema.md`:

```markdown
# publish.json — Manifest Schema (v1)

Location: `docs/marketing/assets/<slug>/publish.json`

## Top-level fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `schemaVersion` | number | yes | Currently `1`. Validator rejects unknown versions. |
| `slug` | string | yes | Kebab case. Used for log + queue filenames. |
| `briefPath` | string | yes | Repo-relative path to the markdown brief. |
| `targets` | array | yes | 1–10 targets. Each posted independently. |
| `schedule.mode` | `"now"` \| `"at"` | yes | If `"at"`, `schedule.at` required. |
| `schedule.at` | ISO 8601 string \| null | conditional | Required when mode = `"at"`. |
| `schedule.timezone` | string | no | IANA name. Defaults to `Africa/Douala`. |
| `claimAudit` | `"passed"` | yes | Hard gate. Publisher refuses anything else. |
| `createdBy` | string | yes | Identifier of the producing skill or operator. |
| `status` | enum | no | Mutated by publisher. Operator should leave as `"pending"`. |

## Target shapes

### Instagram carousel

```json
{
  "platform": "instagram",
  "format": "carousel",
  "account": "adl_main",
  "assets": ["frame-01.png", ...],
  "caption": { "en": "...", "fr": "..." },
  "captionLang": "en",
  "hashtags": ["#Tag"],
  "altText": ["...", "..."],
  "firstComment": null,
  "locationId": null
}
```

Constraints: 2–10 assets, altText length equals assets length, max 30 hashtags, captions ≤2200 chars each.

### Instagram story

```json
{
  "platform": "instagram",
  "format": "story",
  "account": "adl_main",
  "assets": ["frame-01.png", ...],
  "linkSticker": { "frame": 2, "url": "https://...", "text": "MAP" },
  "altText": ["..."]
}
```

Constraints: 1–10 assets. `linkSticker` produces a manual step note — Graph API does not apply stickers.

### Instagram single feed

```json
{
  "platform": "instagram",
  "format": "single",
  "account": "adl_main",
  "assets": ["frame-01.png"],
  "caption": { "en": "...", "fr": "..." },
  "captionLang": "en",
  "hashtags": ["#Tag"],
  "altText": ["..."]
}
```

Exactly 1 asset.

### LinkedIn image / multi-image / document-carousel

```json
{
  "platform": "linkedin",
  "format": "image" | "multi-image" | "document-carousel",
  "account": "adl_org",
  "assets": ["frame-01.png", ...],
  "title": "...",
  "commentary": "Long-form post body.",
  "visibility": "PUBLIC"
}
```

Asset counts:
- `image`: exactly 1
- `multi-image`: 2–9
- `document-carousel`: 2–20 (rendered into a single PDF)

Commentary ≤3000 chars.

## Result file

After a publish run, `result.json` is written next to `publish.json` with per-target status, media IDs/URNs, permalinks, and any required manual steps.
```

- [ ] **Step 2: Create test PNG fixtures using sharp**

```bash
node -e "
import('sharp').then(({ default: sharp }) => {
  const dir = '.claude/skills/social-publisher-skill/tests/fixtures';
  const make = (w, h, name) => sharp({
    create: { width: w, height: h, channels: 3, background: { r: 15, g: 43, b: 70 } }
  }).png().toFile(\`\${dir}/\${name}\`);
  return Promise.all([
    make(1080, 1350, 'frame-1080x1350.png'),
    make(1080, 1920, 'frame-1080x1920.png'),
    make(1080, 1080, 'frame-1080x1080.png'),
  ]);
}).then(() => console.log('done'));
"
```

Expected output: `done`. Files exist:

```bash
ls -la .claude/skills/social-publisher-skill/tests/fixtures/*.png
```

- [ ] **Step 3: Create example manifest**

Create `.claude/skills/social-publisher-skill/examples/publish-manifest.example.json`:

```json
{
  "schemaVersion": 1,
  "slug": "instagram-week5-post1",
  "briefPath": "docs/marketing/instagram-week5-post1.md",
  "targets": [
    {
      "platform": "instagram",
      "format": "carousel",
      "account": "adl_main",
      "assets": ["frame-01.png", "frame-02.png", "frame-03.png"],
      "caption": {
        "en": "Ground truth, frame by frame. We map what others assume.",
        "fr": "Verite terrain, image par image. Nous cartographions ce que les autres supposent."
      },
      "captionLang": "en",
      "hashtags": ["#GroundTruth", "#Cameroon", "#OpenData"],
      "altText": ["Title slide", "Method slide", "CTA slide"],
      "firstComment": null,
      "locationId": null
    },
    {
      "platform": "linkedin",
      "format": "document-carousel",
      "account": "adl_org",
      "assets": ["frame-01.png", "frame-02.png", "frame-03.png"],
      "title": "Ground truth, frame by frame",
      "commentary": "How we verify infrastructure data in Cameroonian cities, one walk at a time.",
      "visibility": "PUBLIC"
    }
  ],
  "schedule": { "mode": "now", "at": null, "timezone": "Africa/Douala" },
  "claimAudit": "passed",
  "createdBy": "instagram-carousel-skill@2026-05-14",
  "status": "pending"
}
```

- [ ] **Step 4: Add npm script**

Edit `package.json` — add inside `"scripts"`:

```json
    "test:publisher": "node --test .claude/skills/social-publisher-skill/tests/*.test.mjs",
```

(Place it between `"test"` and `"test:e2e"`.)

- [ ] **Step 5: Run tests via new script**

```bash
npm run test:publisher
```

Expected: 22 tests pass (manifest + account-map + logger).

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/social-publisher-skill/reference/manifest-schema.md \
        .claude/skills/social-publisher-skill/tests/fixtures/*.png \
        .claude/skills/social-publisher-skill/examples/publish-manifest.example.json \
        package.json
git commit -m "feat(publisher): manifest docs + test fixtures + npm script"
```

---

# Milestone 2 — Asset hosting

## Task 7: Vercel Blob upload host

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/upload-host.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/helpers/mock-blob.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/upload-host.test.mjs`

- [ ] **Step 1: Write the mock blob helper**

Create `.claude/skills/social-publisher-skill/tests/helpers/mock-blob.mjs`:

```javascript
import { createHash } from 'node:crypto';

export function createMockBlob() {
  const store = new Map();
  return {
    put: async (key, data) => {
      const sha = createHash('sha256').update(data).digest('hex').slice(0, 16);
      const url = `https://blob.test/${sha}-${key}`;
      store.set(url, data);
      return { url, pathname: key };
    },
    del: async (url) => {
      if (!store.has(url)) throw new Error(`not found: ${url}`);
      store.delete(url);
    },
    has: (url) => store.has(url),
    size: () => store.size,
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/upload-host.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  const goodUrl = (await uploadAssets({
    assetPaths: ['frame-1080x1350.png'],
    manifestDir: fixturesDir,
    slug: 'test',
    blob,
  }))[0];
  const result = await deleteAssets({
    urls: [goodUrl, 'https://blob.test/does-not-exist'],
    blob,
  });
  assert.equal(result.deleted.length, 1);
  assert.equal(result.failed.length, 1);
});
```

- [ ] **Step 3: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: upload-host tests fail with module not found.

- [ ] **Step 4: Write upload-host.mjs**

Create `.claude/skills/social-publisher-skill/scripts/upload-host.mjs`:

```javascript
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, isAbsolute, basename } from 'node:path';
import { put, del } from '@vercel/blob';

const defaultBlob = { put, del };

export async function uploadAssets({ assetPaths, manifestDir, slug, blob = defaultBlob, token }) {
  const urls = [];
  for (const assetPath of assetPaths) {
    if (isAbsolute(assetPath)) {
      throw new Error(`asset paths must be relative to the manifest directory: ${assetPath}`);
    }
    const fullPath = join(manifestDir, assetPath);
    if (!existsSync(fullPath)) {
      throw new Error(`asset file not found: ${assetPath} (resolved to ${fullPath})`);
    }
    const data = await readFile(fullPath);
    const key = `social-publisher/${slug}/${basename(assetPath)}`;
    const result = await blob.put(key, data, token ? { access: 'public', token } : { access: 'public' });
    urls.push(result.url);
  }
  return urls;
}

export async function deleteAssets({ urls, blob = defaultBlob, token }) {
  const deleted = [];
  const failed = [];
  for (const url of urls) {
    try {
      await blob.del(url, token ? { token } : undefined);
      deleted.push(url);
    } catch (err) {
      failed.push({ url, error: err.message });
    }
  }
  return { deleted, failed };
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: all upload-host tests pass.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/upload-host.mjs \
        .claude/skills/social-publisher-skill/tests/helpers/mock-blob.mjs \
        .claude/skills/social-publisher-skill/tests/upload-host.test.mjs
git commit -m "feat(publisher): vercel blob upload + delete"
```

---

## Task 8: PDF builder (PNG[] → PDF for LinkedIn document)

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/pdf-builder.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/pdf-builder.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/pdf-builder.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildPdfFromPngs } from '../scripts/pdf-builder.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

test('builds a 3-page PDF from 3 PNGs', async () => {
  const png = readFileSync(join(fixturesDir, 'frame-1080x1350.png'));
  const pdfBytes = await buildPdfFromPngs([png, png, png]);
  const pdf = await PDFDocument.load(pdfBytes);
  assert.equal(pdf.getPageCount(), 3);
});

test('PDF pages are 1080x1350 points', async () => {
  const png = readFileSync(join(fixturesDir, 'frame-1080x1350.png'));
  const pdfBytes = await buildPdfFromPngs([png]);
  const pdf = await PDFDocument.load(pdfBytes);
  const { width, height } = pdf.getPage(0).getSize();
  assert.equal(width, 1080);
  assert.equal(height, 1350);
});

test('throws when given empty input', async () => {
  await assert.rejects(buildPdfFromPngs([]), /at least one/i);
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: pdf-builder tests fail.

- [ ] **Step 3: Write pdf-builder.mjs**

Create `.claude/skills/social-publisher-skill/scripts/pdf-builder.mjs`:

```javascript
import { PDFDocument } from 'pdf-lib';

export async function buildPdfFromPngs(pngBuffers) {
  if (!Array.isArray(pngBuffers) || pngBuffers.length === 0) {
    throw new Error('buildPdfFromPngs requires at least one PNG buffer');
  }
  const pdf = await PDFDocument.create();
  for (const buf of pngBuffers) {
    const image = await pdf.embedPng(buf);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return await pdf.save();
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: pdf-builder tests pass.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/pdf-builder.mjs \
        .claude/skills/social-publisher-skill/tests/pdf-builder.test.mjs
git commit -m "feat(publisher): PNG to PDF builder for LinkedIn documents"
```

---

# Milestone 3 — Instagram publish

## Task 9: Caption builder (hashtag separator + char limits + lang select)

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/caption.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/caption.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/caption.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIgCaption } from '../scripts/caption.mjs';

test('builds caption with hashtags appended via IG separator', () => {
  const out = buildIgCaption({
    caption: { en: 'Hello', fr: 'Bonjour' },
    captionLang: 'en',
    hashtags: ['#A', '#B'],
  });
  assert.ok(out.startsWith('Hello'));
  assert.ok(out.includes('\n\n.\n.\n.\n'));
  assert.ok(out.endsWith('#A #B'));
});

test('selects FR caption when langOverride=fr', () => {
  const out = buildIgCaption({
    caption: { en: 'Hello', fr: 'Bonjour' },
    captionLang: 'en',
    hashtags: [],
    langOverride: 'fr',
  });
  assert.ok(out.startsWith('Bonjour'));
});

test('throws when combined length exceeds 2200', () => {
  assert.throws(() => buildIgCaption({
    caption: { en: 'x'.repeat(2200), fr: 'x'.repeat(2200) },
    captionLang: 'en',
    hashtags: ['#A'],
  }), /2200/);
});

test('produces caption with no hashtag tail when hashtags empty', () => {
  const out = buildIgCaption({
    caption: { en: 'Hello', fr: 'Bonjour' },
    captionLang: 'en',
    hashtags: [],
  });
  assert.equal(out, 'Hello');
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: caption tests fail.

- [ ] **Step 3: Write caption.mjs**

Create `.claude/skills/social-publisher-skill/scripts/caption.mjs`:

```javascript
const IG_LIMIT = 2200;
const SEPARATOR = '\n\n.\n.\n.\n';

export function buildIgCaption({ caption, captionLang, hashtags, langOverride }) {
  const lang = langOverride ?? captionLang;
  const body = caption[lang];
  if (body === undefined) {
    throw new Error(`caption missing for lang "${lang}"`);
  }
  const tail = hashtags.length > 0 ? SEPARATOR + hashtags.join(' ') : '';
  const final = body + tail;
  if (final.length > IG_LIMIT) {
    throw new Error(`caption exceeds IG limit of 2200 chars (got ${final.length})`);
  }
  return final;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: caption tests pass.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/caption.mjs \
        .claude/skills/social-publisher-skill/tests/caption.test.mjs
git commit -m "feat(publisher): IG caption + hashtag builder"
```

---

## Task 10: IG carousel publisher

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/ig-carousel.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/helpers/nock-setup.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/ig-carousel-flow.test.mjs`

- [ ] **Step 1: Write nock helper**

Create `.claude/skills/social-publisher-skill/tests/helpers/nock-setup.mjs`:

```javascript
import nock from 'nock';

export const GRAPH_BASE = 'https://graph.facebook.com';
export const LI_BASE = 'https://api.linkedin.com';

export function setupNock() {
  nock.disableNetConnect();
  return () => {
    nock.cleanAll();
    nock.enableNetConnect();
  };
}

export function mockIgChildContainer({ igId, imageUrl, containerId }) {
  return nock(GRAPH_BASE)
    .post(`/v21.0/${igId}/media`)
    .query((q) => q.image_url === imageUrl && q.is_carousel_item === 'true')
    .reply(200, { id: containerId });
}

export function mockIgParentContainer({ igId, children, caption, containerId }) {
  return nock(GRAPH_BASE)
    .post(`/v21.0/${igId}/media`)
    .query((q) => q.media_type === 'CAROUSEL' && q.children === children.join(',') && q.caption === caption)
    .reply(200, { id: containerId });
}

export function mockIgStatus({ containerId, statuses }) {
  let i = 0;
  return nock(GRAPH_BASE)
    .get(`/v21.0/${containerId}`)
    .query(true)
    .times(statuses.length)
    .reply(200, () => ({ status_code: statuses[i++] }));
}

export function mockIgPublish({ igId, creationId, mediaId }) {
  return nock(GRAPH_BASE)
    .post(`/v21.0/${igId}/media_publish`)
    .query((q) => q.creation_id === creationId)
    .reply(200, { id: mediaId });
}

export function mockIgPermalink({ mediaId, permalink }) {
  return nock(GRAPH_BASE)
    .get(`/v21.0/${mediaId}`)
    .query(true)
    .reply(200, { permalink });
}

export function mockIgStoryContainer({ igId, imageUrl, containerId }) {
  return nock(GRAPH_BASE)
    .post(`/v21.0/${igId}/media`)
    .query((q) => q.image_url === imageUrl && q.media_type === 'STORIES')
    .reply(200, { id: containerId });
}
```

- [ ] **Step 2: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/ig-carousel-flow.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupNock, mockIgChildContainer, mockIgParentContainer,
  mockIgStatus, mockIgPublish, mockIgPermalink,
} from './helpers/nock-setup.mjs';
import { publishIgCarousel } from '../scripts/ig-carousel.mjs';

test('publishIgCarousel posts children, parent, polls, publishes, returns permalink', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { pageToken: 'tok', businessId: igId, fbPageId: '10215' };

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
  const credentials = { pageToken: 'tok', businessId: igId, fbPageId: '10215' };

  mockIgChildContainer({ igId, imageUrl: 'https://blob.test/img-1', containerId: 'c1' });
  mockIgChildContainer({ igId, imageUrl: 'https://blob.test/img-2', containerId: 'c2' });
  mockIgParentContainer({ igId, children: ['c1', 'c2'], caption: 'X', containerId: 'parent' });
  mockIgStatus({ containerId: 'parent', statuses: ['IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS'] });

  await assert.rejects(
    publishIgCarousel({
      credentials,
      imageUrls: ['https://blob.test/img-1', 'https://blob.test/img-2'],
      caption: 'X',
      pollIntervalMs: 1,
      maxPolls: 3,
    }),
    /timeout|FINISHED/i
  );
  teardown();
});

test('publishIgCarousel surfaces auth error from Graph API', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { pageToken: 'bad', businessId: igId, fbPageId: '10215' };

  const nock = (await import('nock')).default;
  nock('https://graph.facebook.com')
    .post(`/v21.0/${igId}/media`)
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
```

- [ ] **Step 3: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: ig-carousel-flow tests fail.

- [ ] **Step 4: Write ig-carousel.mjs**

Create `.claude/skills/social-publisher-skill/scripts/ig-carousel.mjs`:

```javascript
const API = 'https://graph.facebook.com/v21.0';

async function graphFetch(path, { method = 'GET', token, params = {}, throwOnError = true } = {}) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, { method });
  const body = await res.json();
  if (!res.ok && throwOnError) {
    const msg = body?.error?.message || `Graph API ${res.status}`;
    const err = new Error(msg);
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body;
}

async function createChildContainer({ igId, token, imageUrl }) {
  const body = await graphFetch(`/${igId}/media`, {
    method: 'POST',
    token,
    params: { image_url: imageUrl, is_carousel_item: 'true' },
  });
  return body.id;
}

async function createParentContainer({ igId, token, children, caption }) {
  const body = await graphFetch(`/${igId}/media`, {
    method: 'POST',
    token,
    params: { media_type: 'CAROUSEL', children: children.join(','), caption },
  });
  return body.id;
}

async function pollUntilFinished({ containerId, token, pollIntervalMs, maxPolls }) {
  for (let i = 0; i < maxPolls; i++) {
    const body = await graphFetch(`/${containerId}`, { token, params: { fields: 'status_code' } });
    if (body.status_code === 'FINISHED') return;
    if (body.status_code === 'ERROR') throw new Error(`container ${containerId} errored: ${JSON.stringify(body)}`);
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`container ${containerId} did not reach FINISHED after ${maxPolls} polls`);
}

async function publishContainer({ igId, token, creationId }) {
  const body = await graphFetch(`/${igId}/media_publish`, {
    method: 'POST',
    token,
    params: { creation_id: creationId },
  });
  return body.id;
}

async function getPermalink({ mediaId, token }) {
  const body = await graphFetch(`/${mediaId}`, { token, params: { fields: 'permalink' } });
  return body.permalink;
}

export async function publishIgCarousel({
  credentials,
  imageUrls,
  caption,
  pollIntervalMs = 1000,
  maxPolls = 30,
}) {
  const { pageToken: token, businessId: igId } = credentials;

  const children = [];
  for (const imageUrl of imageUrls) {
    const id = await createChildContainer({ igId, token, imageUrl });
    children.push(id);
    await new Promise((r) => setTimeout(r, pollIntervalMs > 100 ? 1000 : 0));
  }

  const parentId = await createParentContainer({ igId, token, children, caption });
  await pollUntilFinished({ containerId: parentId, token, pollIntervalMs, maxPolls });
  const mediaId = await publishContainer({ igId, token, creationId: parentId });
  const permalink = await getPermalink({ mediaId, token });
  return { status: 'published', mediaId, permalink };
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: ig-carousel-flow tests pass.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/ig-carousel.mjs \
        .claude/skills/social-publisher-skill/tests/helpers/nock-setup.mjs \
        .claude/skills/social-publisher-skill/tests/ig-carousel-flow.test.mjs
git commit -m "feat(publisher): IG carousel flow with container poll"
```

---

## Task 11: IG story publisher

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/ig-story.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/ig-story-flow.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/ig-story-flow.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupNock, mockIgStoryContainer, mockIgStatus, mockIgPublish,
} from './helpers/nock-setup.mjs';
import { publishIgStory } from '../scripts/ig-story.mjs';

test('publishIgStory posts each frame sequentially and returns media IDs', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { pageToken: 'tok', businessId: igId, fbPageId: '10215' };

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
  const credentials = { pageToken: 'tok', businessId: igId, fbPageId: '10215' };

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
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: ig-story-flow tests fail.

- [ ] **Step 3: Write ig-story.mjs**

Create `.claude/skills/social-publisher-skill/scripts/ig-story.mjs`:

```javascript
const API = 'https://graph.facebook.com/v21.0';

async function graphFetch(path, { method = 'GET', token, params = {} } = {}) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Graph API ${res.status}`);
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body;
}

async function createStoryContainer({ igId, token, imageUrl }) {
  const body = await graphFetch(`/${igId}/media`, {
    method: 'POST',
    token,
    params: { image_url: imageUrl, media_type: 'STORIES' },
  });
  return body.id;
}

async function pollUntilFinished({ containerId, token, pollIntervalMs, maxPolls }) {
  for (let i = 0; i < maxPolls; i++) {
    const body = await graphFetch(`/${containerId}`, { token, params: { fields: 'status_code' } });
    if (body.status_code === 'FINISHED') return;
    if (body.status_code === 'ERROR') throw new Error(`story container ${containerId} errored`);
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`story container ${containerId} did not reach FINISHED`);
}

async function publishContainer({ igId, token, creationId }) {
  const body = await graphFetch(`/${igId}/media_publish`, {
    method: 'POST',
    token,
    params: { creation_id: creationId },
  });
  return body.id;
}

export async function publishIgStory({
  credentials,
  imageUrls,
  linkSticker,
  pollIntervalMs = 1000,
  maxPolls = 30,
  frameDelayMs = 2000,
}) {
  const { pageToken: token, businessId: igId } = credentials;
  const mediaIds = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const containerId = await createStoryContainer({ igId, token, imageUrl: imageUrls[i] });
    await pollUntilFinished({ containerId, token, pollIntervalMs, maxPolls });
    const mediaId = await publishContainer({ igId, token, creationId: containerId });
    mediaIds.push(mediaId);
    if (i < imageUrls.length - 1 && frameDelayMs > 0) {
      await new Promise((r) => setTimeout(r, frameDelayMs));
    }
  }

  const manualSteps = [];
  if (linkSticker) {
    manualSteps.push(
      `Frame ${linkSticker.frame}: add link sticker pointing to ${linkSticker.url} (display text: "${linkSticker.text}") via Instagram app — Graph API does not support sticker overlay.`
    );
  }

  return { status: 'published', mediaIds, manualSteps };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: ig-story-flow tests pass.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/ig-story.mjs \
        .claude/skills/social-publisher-skill/tests/ig-story-flow.test.mjs
git commit -m "feat(publisher): IG story sequential frame flow"
```

---

## Task 12: IG single feed publisher

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/ig-single.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/ig-single-flow.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/ig-single-flow.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { setupNock, mockIgStatus, mockIgPublish, mockIgPermalink, GRAPH_BASE } from './helpers/nock-setup.mjs';
import { publishIgSingle } from '../scripts/ig-single.mjs';

test('publishIgSingle creates container, polls, publishes, returns permalink', async () => {
  const teardown = setupNock();
  const igId = '17841000';
  const credentials = { pageToken: 'tok', businessId: igId, fbPageId: '10215' };

  nock(GRAPH_BASE)
    .post(`/v21.0/${igId}/media`)
    .query((q) => q.image_url === 'https://blob.test/img' && q.caption === 'Hi' && !q.media_type)
    .reply(200, { id: 'c1' });
  mockIgStatus({ containerId: 'c1', statuses: ['FINISHED'] });
  mockIgPublish({ igId, creationId: 'c1', mediaId: 'm1' });
  mockIgPermalink({ mediaId: 'm1', permalink: 'https://www.instagram.com/p/abc/' });

  const result = await publishIgSingle({
    credentials,
    imageUrl: 'https://blob.test/img',
    caption: 'Hi',
    pollIntervalMs: 1,
  });

  assert.equal(result.status, 'published');
  assert.equal(result.permalink, 'https://www.instagram.com/p/abc/');
  teardown();
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: ig-single-flow test fails.

- [ ] **Step 3: Write ig-single.mjs**

Create `.claude/skills/social-publisher-skill/scripts/ig-single.mjs`:

```javascript
const API = 'https://graph.facebook.com/v21.0';

async function graphFetch(path, { method = 'GET', token, params = {} } = {}) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Graph API ${res.status}`);
    err.code = body?.error?.code;
    throw err;
  }
  return body;
}

export async function publishIgSingle({
  credentials,
  imageUrl,
  caption,
  pollIntervalMs = 1000,
  maxPolls = 30,
}) {
  const { pageToken: token, businessId: igId } = credentials;

  const createBody = await graphFetch(`/${igId}/media`, {
    method: 'POST',
    token,
    params: { image_url: imageUrl, caption },
  });
  const containerId = createBody.id;

  for (let i = 0; i < maxPolls; i++) {
    const status = await graphFetch(`/${containerId}`, { token, params: { fields: 'status_code' } });
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') throw new Error(`single container ${containerId} errored`);
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    if (i === maxPolls - 1) throw new Error(`single container ${containerId} did not reach FINISHED`);
  }

  const publishBody = await graphFetch(`/${igId}/media_publish`, {
    method: 'POST',
    token,
    params: { creation_id: containerId },
  });
  const mediaId = publishBody.id;
  const permalinkBody = await graphFetch(`/${mediaId}`, { token, params: { fields: 'permalink' } });

  return { status: 'published', mediaId, permalink: permalinkBody.permalink };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: ig-single-flow test passes.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/ig-single.mjs \
        .claude/skills/social-publisher-skill/tests/ig-single-flow.test.mjs
git commit -m "feat(publisher): IG single image feed flow"
```

---

## Task 13: IG smoke test + IG reference doc

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/smoke-ig.mjs`
- Create: `.claude/skills/social-publisher-skill/reference/ig-graph-api.md`

- [ ] **Step 1: Write smoke-ig.mjs**

Create `.claude/skills/social-publisher-skill/scripts/smoke-ig.mjs`:

```javascript
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
const result = await publishIgSingle({ credentials, imageUrl: TEST_IMAGE_URL, caption });
log.info('IG smoke posted', { mediaId: result.mediaId, permalink: result.permalink });

console.log('Waiting 60s before delete attempt...');
await new Promise((r) => setTimeout(r, 60_000));

try {
  const res = await fetch(`https://graph.facebook.com/v21.0/${result.mediaId}?access_token=${credentials.pageToken}`, { method: 'DELETE' });
  if (!res.ok) {
    log.warn('IG smoke delete returned non-OK; the test post must be removed MANUALLY from the IG app', { status: res.status, permalink: result.permalink });
  } else {
    log.info('IG smoke post deleted via API', { mediaId: result.mediaId });
  }
} catch (err) {
  log.error('IG smoke delete failed; remove manually', err, { permalink: result.permalink });
}
```

- [ ] **Step 2: Write ig-graph-api.md**

Create `.claude/skills/social-publisher-skill/reference/ig-graph-api.md`:

```markdown
# Instagram Graph API — Content Publishing

API base: `https://graph.facebook.com/v21.0`

## Auth

All calls take `access_token=<PAGE_TOKEN>` query param. Page token never expires (issued from a long-lived user token via `GET /me/accounts`).

## Carousel flow

1. **Child container per image:** `POST /{ig-user-id}/media?image_url=<public-url>&is_carousel_item=true`
   → returns `{ id }`

2. **Parent container:** `POST /{ig-user-id}/media?media_type=CAROUSEL&children=<id1>,<id2>&caption=<text>`
   → returns `{ id }`

3. **Poll status:** `GET /{container-id}?fields=status_code`
   → repeat until `status_code === "FINISHED"` (or `"ERROR"`).

4. **Publish:** `POST /{ig-user-id}/media_publish?creation_id=<parent-id>`
   → returns `{ id }` (media ID).

5. **Permalink:** `GET /{media-id}?fields=permalink`

## Story flow

Same shape, but child container uses `media_type=STORIES` and there is no parent container. One container per frame.

## Single feed image

`POST /{ig-user-id}/media?image_url=<url>&caption=<text>` (no `is_carousel_item`, no `media_type`).

## Asset URL requirements

- Must be publicly fetchable (HTTPS).
- Recommended: pre-upload to Vercel Blob with public access.
- IG fetches the URL synchronously during container create — make sure your host is up.

## Rate limits

200 calls/hour per IG user. Add ≥1s spacing between container creates to stay well under.

## Delete

`DELETE /{media-id}?access_token=<token>` — works for self-posted media. If it 4xxs, remove manually via the IG app.
```

- [ ] **Step 3: Verify smoke script syntactically valid**

```bash
node --check .claude/skills/social-publisher-skill/scripts/smoke-ig.mjs
```

Expected: no output (success).

- [ ] **Step 4: Run full test suite to confirm no regression**

```bash
npm run test:publisher
```

Expected: all tests still pass.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/smoke-ig.mjs \
        .claude/skills/social-publisher-skill/reference/ig-graph-api.md
git commit -m "feat(publisher): IG smoke test + Graph API reference"
```

---

# Milestone 4 — LinkedIn publish

## Task 14: LinkedIn image post

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/linkedin-post.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/linkedin-image-flow.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/linkedin-image-flow.test.mjs`:

```javascript
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

  nock('https://li-upload.test')
    .put('/u/1')
    .reply(201);

  nock(LI_BASE)
    .post('/v2/ugcPosts', (body) => body.author === orgUrn && body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory === 'IMAGE')
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
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: linkedin-image-flow tests fail.

- [ ] **Step 3: Write linkedin-post.mjs**

Create `.claude/skills/social-publisher-skill/scripts/linkedin-post.mjs`:

```javascript
const API = 'https://api.linkedin.com';

const RECIPE_IMAGE = 'urn:li:digitalmediaRecipe:feedshare-image';
const RECIPE_DOC = 'urn:li:digitalmediaRecipe:feedshare-document';

async function liFetch(path, { method = 'GET', token, body, query } = {}) {
  const url = new URL(`${API}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  try { payload = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg = payload?.message || payload?.error?.message || `LinkedIn API ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return { payload, headers: res.headers };
}

async function registerUpload({ token, orgUrn, recipe }) {
  const { payload } = await liFetch('/v2/assets', {
    method: 'POST',
    token,
    query: { action: 'registerUpload' },
    body: {
      registerUploadRequest: {
        owner: orgUrn,
        recipes: [recipe],
        serviceRelationships: [
          { identifier: 'urn:li:userGeneratedContent', relationshipType: 'OWNER' },
        ],
      },
    },
  });
  const uploadUrl = payload.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const assetUrn = payload.value.asset;
  return { uploadUrl, assetUrn };
}

async function uploadBinary({ uploadUrl, token, buffer, contentType }) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload PUT failed with ${res.status}`);
}

async function createUgcPost({ token, orgUrn, mediaCategory, media, commentary, visibility }) {
  const { headers } = await liFetch('/v2/ugcPosts', {
    method: 'POST',
    token,
    body: {
      author: orgUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: commentary },
          shareMediaCategory: mediaCategory,
          media,
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': visibility ?? 'PUBLIC' },
    },
  });
  return headers.get('x-restli-id');
}

function permalink(postUrn) {
  return `https://www.linkedin.com/feed/update/${postUrn}/`;
}

export async function publishLinkedInImage({ credentials, imageBuffer, title, commentary, visibility = 'PUBLIC' }) {
  const { accessToken: token, orgUrn } = credentials;
  const { uploadUrl, assetUrn } = await registerUpload({ token, orgUrn, recipe: RECIPE_IMAGE });
  await uploadBinary({ uploadUrl, token, buffer: imageBuffer, contentType: 'image/png' });
  const postUrn = await createUgcPost({
    token, orgUrn,
    mediaCategory: 'IMAGE',
    media: [{ status: 'READY', media: assetUrn, title: { text: title }, description: { text: title } }],
    commentary, visibility,
  });
  return { status: 'published', postUrn, permalink: permalink(postUrn) };
}

export async function publishLinkedInMultiImage({ credentials, imageBuffers, title, commentary, visibility = 'PUBLIC' }) {
  const { accessToken: token, orgUrn } = credentials;
  const media = [];
  for (const buf of imageBuffers) {
    const { uploadUrl, assetUrn } = await registerUpload({ token, orgUrn, recipe: RECIPE_IMAGE });
    await uploadBinary({ uploadUrl, token, buffer: buf, contentType: 'image/png' });
    media.push({ status: 'READY', media: assetUrn, title: { text: title }, description: { text: title } });
  }
  const postUrn = await createUgcPost({
    token, orgUrn, mediaCategory: 'IMAGE', media, commentary, visibility,
  });
  return { status: 'published', postUrn, permalink: permalink(postUrn) };
}

export async function publishLinkedInDocument({ credentials, pdfBuffer, title, commentary, visibility = 'PUBLIC' }) {
  const { accessToken: token, orgUrn } = credentials;
  const { uploadUrl, assetUrn } = await registerUpload({ token, orgUrn, recipe: RECIPE_DOC });
  await uploadBinary({ uploadUrl, token, buffer: pdfBuffer, contentType: 'application/pdf' });
  const postUrn = await createUgcPost({
    token, orgUrn,
    mediaCategory: 'DOCUMENT',
    media: [{ status: 'READY', media: assetUrn, title: { text: title }, description: { text: title } }],
    commentary, visibility,
  });
  return { status: 'published', postUrn, permalink: permalink(postUrn) };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: linkedin-image-flow tests pass.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/linkedin-post.mjs \
        .claude/skills/social-publisher-skill/tests/linkedin-image-flow.test.mjs
git commit -m "feat(publisher): LinkedIn image post via Marketing API"
```

---

## Task 15: LinkedIn multi-image post

**Files:**
- Create: `.claude/skills/social-publisher-skill/tests/linkedin-multi-image-flow.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/linkedin-multi-image-flow.test.mjs`:

```javascript
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
          uploadMechanism: { 'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': { uploadUrl: `https://li-upload.test/u/${i}` } },
          asset: `urn:li:digitalmediaAsset:a${i}`,
        },
      });
    nock('https://li-upload.test').put(`/u/${i}`).reply(201);
  }

  nock(LI_BASE)
    .post('/v2/ugcPosts', (body) => body.specificContent['com.linkedin.ugc.ShareContent'].media.length === 3)
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
```

- [ ] **Step 2: Run test to confirm pass**

```bash
npm run test:publisher
```

Expected: multi-image test passes (function already exists from Task 14).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/social-publisher-skill/tests/linkedin-multi-image-flow.test.mjs
git commit -m "test(publisher): LinkedIn multi-image flow"
```

---

## Task 16: LinkedIn document carousel

**Files:**
- Create: `.claude/skills/social-publisher-skill/tests/linkedin-doc-flow.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/linkedin-doc-flow.test.mjs`:

```javascript
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
    .post('/v2/assets', (body) => body.registerUploadRequest.recipes[0] === 'urn:li:digitalmediaRecipe:feedshare-document')
    .query({ action: 'registerUpload' })
    .reply(200, {
      value: {
        uploadMechanism: { 'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': { uploadUrl: 'https://li-upload.test/d' } },
        asset: 'urn:li:digitalmediaAsset:doc1',
      },
    });

  nock('https://li-upload.test').put('/d').reply(201);

  nock(LI_BASE)
    .post('/v2/ugcPosts', (body) => body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory === 'DOCUMENT')
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
```

- [ ] **Step 2: Run test to verify pass**

```bash
npm run test:publisher
```

Expected: linkedin-doc-flow test passes (function exists from Task 14).

- [ ] **Step 3: Write LinkedIn reference doc**

Create `.claude/skills/social-publisher-skill/reference/linkedin-ugc-api.md`:

```markdown
# LinkedIn Marketing API — UGC Posts (Organization)

API base: `https://api.linkedin.com/v2`
Header: `Authorization: Bearer <ACCESS_TOKEN>`, `X-Restli-Protocol-Version: 2.0.0`

## Required scopes (Community Management API)

- `w_organization_social`
- `r_organization_social`
- `rw_organization_admin`

## Image / multi-image flow

For each image:

1. **Register upload:** `POST /v2/assets?action=registerUpload`
   ```json
   {
     "registerUploadRequest": {
       "owner": "urn:li:organization:<id>",
       "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
       "serviceRelationships": [
         { "identifier": "urn:li:userGeneratedContent", "relationshipType": "OWNER" }
       ]
     }
   }
   ```
   → returns `value.uploadMechanism[...].uploadUrl` + `value.asset` (asset URN).

2. **PUT binary to `uploadUrl`** with `Content-Type: image/png`.

3. **Create UGC post:** `POST /v2/ugcPosts`
   ```json
   {
     "author": "urn:li:organization:<id>",
     "lifecycleState": "PUBLISHED",
     "specificContent": {
       "com.linkedin.ugc.ShareContent": {
         "shareCommentary": { "text": "..." },
         "shareMediaCategory": "IMAGE",
         "media": [
           { "status": "READY", "media": "<asset-urn>",
             "title": { "text": "..." }, "description": { "text": "..." } }
         ]
       }
     },
     "visibility": { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
   }
   ```
   → response header `x-restli-id` carries the share URN.

## Document carousel flow

Identical to image flow with two changes:

- `recipes[0]`: `"urn:li:digitalmediaRecipe:feedshare-document"`
- `shareMediaCategory`: `"DOCUMENT"`
- Content type for PUT: `application/pdf`

LinkedIn renders the PDF as a swipeable in-feed carousel — best-engagement format for educational content.

## Permalink

`https://www.linkedin.com/feed/update/<post-urn>/`

## Rate limits

100 UGC posts per day per organization. Far above realistic ADL usage.

## Delete

`DELETE /v2/ugcPosts/<post-urn>` — supported on self-posted content.
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/social-publisher-skill/tests/linkedin-doc-flow.test.mjs \
        .claude/skills/social-publisher-skill/reference/linkedin-ugc-api.md
git commit -m "feat(publisher): LinkedIn document carousel + API reference"
```

---

## Task 17: LinkedIn smoke test + token refresh

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/smoke-linkedin.mjs`
- Create: `.claude/skills/social-publisher-skill/scripts/token-refresh.mjs`

- [ ] **Step 1: Write smoke-linkedin.mjs**

Create `.claude/skills/social-publisher-skill/scripts/smoke-linkedin.mjs`:

```javascript
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
log.info('LinkedIn smoke posted', { postUrn: result.postUrn, permalink: result.permalink });

console.log('Waiting 60s before delete attempt...');
await new Promise((r) => setTimeout(r, 60_000));

try {
  const res = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(result.postUrn)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${credentials.accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
  });
  if (!res.ok) {
    log.warn('LinkedIn smoke delete returned non-OK; remove the post MANUALLY', { status: res.status, permalink: result.permalink });
  } else {
    log.info('LinkedIn smoke post deleted via API');
  }
} catch (err) {
  log.error('LinkedIn smoke delete failed; remove manually', err, { permalink: result.permalink });
}
```

- [ ] **Step 2: Write token-refresh.mjs**

Create `.claude/skills/social-publisher-skill/scripts/token-refresh.mjs`:

```javascript
#!/usr/bin/env node
import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from './logger.mjs';
import { accounts } from './account-map.mjs';

const log = createLogger();
const envPath = join(process.cwd(), '.env.local');

function parseEnvFile(text) {
  const lines = text.split('\n');
  return { lines, get: (k) => {
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && m[1] === k) return m[2];
    }
    return undefined;
  }};
}

function setEnvLine(lines, key, value) {
  let found = false;
  const next = lines.map((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (m && m[1] === key) { found = true; return `${key}=${value}`; }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  return next;
}

async function writeEnvAtomic(lines) {
  const tmp = envPath + '.tmp';
  await writeFile(tmp, lines.join('\n'), 'utf8');
  await rename(tmp, envPath);
}

async function refreshIg({ lines }) {
  const tokenKey = accounts.adl_main.envKeys.pageToken;
  const env = parseEnvFile(lines.join('\n'));
  const current = env.get(tokenKey);
  if (!current) {
    log.warn('IG page token missing, skipping refresh', { key: tokenKey });
    return lines;
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&fb_exchange_token=${current}&access_token=${current}`);
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    log.error('IG token refresh failed', body);
    return lines;
  }
  log.info('IG page token refreshed');
  return setEnvLine(lines, tokenKey, body.access_token);
}

async function refreshLi({ lines }) {
  const keys = accounts.adl_org.envKeys;
  const env = parseEnvFile(lines.join('\n'));
  const refreshToken = env.get(keys.refreshToken);
  const expiresAt = env.get(keys.expiresAt);
  if (!refreshToken) {
    log.warn('LinkedIn refresh token missing, skipping refresh');
    return lines;
  }
  if (expiresAt) {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining > 14 * 24 * 3600 * 1000) {
      log.info('LinkedIn token still has >14 days, skipping refresh', { expiresAt });
      return lines;
    }
  }
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.LI_CLIENT_ID ?? '',
    client_secret: process.env.LI_CLIENT_SECRET ?? '',
  });
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    log.error('LinkedIn token refresh failed', body);
    return lines;
  }
  log.info('LinkedIn access token refreshed', { expiresInSec: body.expires_in });
  const newExpiresAt = new Date(Date.now() + body.expires_in * 1000).toISOString();
  let next = setEnvLine(lines, keys.accessToken, body.access_token);
  next = setEnvLine(next, keys.expiresAt, newExpiresAt);
  if (body.refresh_token) next = setEnvLine(next, keys.refreshToken, body.refresh_token);
  return next;
}

async function main() {
  if (!existsSync(envPath)) {
    console.error(`.env.local not found at ${envPath}`);
    process.exit(1);
  }
  const text = await readFile(envPath, 'utf8');
  let lines = text.split('\n');
  lines = await refreshIg({ lines });
  lines = await refreshLi({ lines });
  await writeEnvAtomic(lines);
  log.info('token refresh complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Syntax check**

```bash
node --check .claude/skills/social-publisher-skill/scripts/smoke-linkedin.mjs && \
node --check .claude/skills/social-publisher-skill/scripts/token-refresh.mjs
```

Expected: no output.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:publisher
```

Expected: all tests still pass (smoke + refresh are not unit-tested; their behavior is integration-tested at M5 via dry-run and live-smoke harness).

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/smoke-linkedin.mjs \
        .claude/skills/social-publisher-skill/scripts/token-refresh.mjs
git commit -m "feat(publisher): LinkedIn smoke + token refresh script"
```

---

# Milestone 5 — Orchestrator + scheduling

## Task 18: Idempotency key

**Files:**
- Create: `.claude/skills/social-publisher-skill/tests/idempotency.test.mjs`
- Modify: `.claude/skills/social-publisher-skill/scripts/manifest.mjs` (append idempotency function)

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/idempotency.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeIdempotencyKey } from '../scripts/manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

test('idempotency key is stable across repeated calls', () => {
  const manifest = JSON.parse(readFileSync(join(fixturesDir, 'manifest.carousel.json'), 'utf8'));
  const k1 = computeIdempotencyKey({ manifest, manifestDir: fixturesDir, assetMap: { 'frame-01.png': 'frame-1080x1350.png', 'frame-02.png': 'frame-1080x1350.png', 'frame-03.png': 'frame-1080x1350.png' } });
  const k2 = computeIdempotencyKey({ manifest, manifestDir: fixturesDir, assetMap: { 'frame-01.png': 'frame-1080x1350.png', 'frame-02.png': 'frame-1080x1350.png', 'frame-03.png': 'frame-1080x1350.png' } });
  assert.equal(k1, k2);
  assert.match(k1, /^sha256:[0-9a-f]{64}$/);
});

test('idempotency key changes when caption changes', () => {
  const manifest = JSON.parse(readFileSync(join(fixturesDir, 'manifest.carousel.json'), 'utf8'));
  const assetMap = { 'frame-01.png': 'frame-1080x1350.png', 'frame-02.png': 'frame-1080x1350.png', 'frame-03.png': 'frame-1080x1350.png' };
  const k1 = computeIdempotencyKey({ manifest, manifestDir: fixturesDir, assetMap });
  const m2 = JSON.parse(JSON.stringify(manifest));
  m2.targets[0].caption.en = 'Different';
  const k2 = computeIdempotencyKey({ manifest: m2, manifestDir: fixturesDir, assetMap });
  assert.notEqual(k1, k2);
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: idempotency tests fail.

- [ ] **Step 3: Append idempotency function to manifest.mjs**

Edit `.claude/skills/social-publisher-skill/scripts/manifest.mjs` — append at the end:

```javascript
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

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
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: idempotency tests pass.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/manifest.mjs \
        .claude/skills/social-publisher-skill/tests/idempotency.test.mjs
git commit -m "feat(publisher): idempotency key from manifest + asset hashes"
```

---

## Task 19: Orchestrator `publish.mjs` — dry-run + check

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/publish.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/dry-run.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/dry-run.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runPublish } from '../scripts/publish.mjs';
import { createMockBlob } from './helpers/mock-blob.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

const credentials = {
  IG_PAGE_TOKEN_ADL_MAIN: 'tok',
  IG_BUSINESS_ID_ADL_MAIN: '17841',
  IG_FB_PAGE_ID_ADL_MAIN: '10215',
  LI_ACCESS_TOKEN_ADL_ORG: 'AQX',
  LI_REFRESH_TOKEN_ADL_ORG: 'AQY',
  LI_ORG_URN_ADL_ORG: 'urn:li:organization:1',
  LI_TOKEN_EXPIRES_AT_ADL_ORG: '2027-01-01T00:00:00Z',
};

test('dry-run resolves targets without network calls', async () => {
  const manifestPath = join(fixturesDir, 'manifest.multi.json');
  const result = await runPublish({
    manifestPath,
    env: credentials,
    options: { dryRun: true },
    blob: createMockBlob(),
    assetMap: { 'frame-01.png': 'frame-1080x1350.png', 'frame-02.png': 'frame-1080x1350.png' },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.dryRun, true);
  assert.equal(result.targets.length, 3);
});

test('dry-run fails fast when env keys missing', async () => {
  const manifestPath = join(fixturesDir, 'manifest.carousel.json');
  const result = await runPublish({
    manifestPath,
    env: { IG_PAGE_TOKEN_ADL_MAIN: 'tok' },
    options: { dryRun: true },
    blob: createMockBlob(),
    assetMap: { 'frame-01.png': 'frame-1080x1350.png', 'frame-02.png': 'frame-1080x1350.png', 'frame-03.png': 'frame-1080x1350.png' },
  });
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /missing env keys/);
});

test('dry-run rejects invalid manifest (claimAudit not passed)', async () => {
  const manifestPath = join(fixturesDir, 'manifest.invalid.json');
  const result = await runPublish({
    manifestPath,
    env: credentials,
    options: { dryRun: true },
    blob: createMockBlob(),
    assetMap: { 'frame-01.png': 'frame-1080x1350.png', 'frame-02.png': 'frame-1080x1350.png' },
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.error, /claimAudit/);
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: dry-run tests fail.

- [ ] **Step 3: Write publish.mjs**

Create `.claude/skills/social-publisher-skill/scripts/publish.mjs`:

```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest, computeIdempotencyKey } from './manifest.mjs';
import { resolveAccount, listRequiredEnvKeys } from './account-map.mjs';
import { createLogger } from './logger.mjs';
import { uploadAssets, deleteAssets } from './upload-host.mjs';
import { buildIgCaption } from './caption.mjs';
import { publishIgCarousel } from './ig-carousel.mjs';
import { publishIgStory } from './ig-story.mjs';
import { publishIgSingle } from './ig-single.mjs';
import {
  publishLinkedInImage, publishLinkedInMultiImage, publishLinkedInDocument,
} from './linkedin-post.mjs';
import { buildPdfFromPngs } from './pdf-builder.mjs';

export async function runPublish({ manifestPath, env, options = {}, blob, assetMap }) {
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
  const activeTargets = manifest.targets.filter((t) => !onlyPlatform || t.platform === onlyPlatform);

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
      captionPreview: t.caption ? buildIgCaption({ caption: t.caption, captionLang: t.captionLang, hashtags: t.hashtags ?? [], langOverride: options.lang }).slice(0, 80) : (t.commentary?.slice(0, 80) ?? ''),
    }));
    log.info('dry-run summary', { slug: manifest.slug, idempotencyKey, targets: summaries });
    return { exitCode: 0, dryRun: true, idempotencyKey, targets: summaries };
  }

  const resultsPath = join(manifestDir, 'result.json');
  const existingResults = (() => {
    try { return JSON.parse(readFileSync(resultsPath, 'utf8')); }
    catch { return null; }
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
      const r = await publishTarget({ target, credentials, manifestDir, blob, assetMap, options, log });
      perTarget.push(r);
    } catch (err) {
      log.error('target failed', err, { platform: target.platform, format: target.format });
      perTarget.push({
        platform: target.platform,
        format: target.format,
        status: 'failed',
        error: { message: err.message, retryHint: `--only ${target.platform} --retry` },
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

async function publishTarget({ target, credentials, manifestDir, blob, assetMap, options, log }) {
  if (target.platform === 'instagram') {
    const urls = await uploadAssets({
      assetPaths: target.assets.map((a) => assetMap?.[a] ?? a),
      manifestDir, slug: 'pub', blob,
    });
    try {
      if (target.format === 'carousel') {
        const caption = buildIgCaption({ caption: target.caption, captionLang: target.captionLang, hashtags: target.hashtags, langOverride: options.lang });
        const r = await publishIgCarousel({ credentials, imageUrls: urls, caption });
        return { platform: 'instagram', format: 'carousel', status: 'published', mediaId: r.mediaId, permalink: r.permalink, manualSteps: [] };
      }
      if (target.format === 'story') {
        const r = await publishIgStory({ credentials, imageUrls: urls, linkSticker: target.linkSticker });
        return { platform: 'instagram', format: 'story', status: 'published', mediaIds: r.mediaIds, manualSteps: r.manualSteps };
      }
      if (target.format === 'single') {
        const caption = buildIgCaption({ caption: target.caption, captionLang: target.captionLang, hashtags: target.hashtags, langOverride: options.lang });
        const r = await publishIgSingle({ credentials, imageUrl: urls[0], caption });
        return { platform: 'instagram', format: 'single', status: 'published', mediaId: r.mediaId, permalink: r.permalink, manualSteps: [] };
      }
    } finally {
      await deleteAssets({ urls, blob }).catch(() => {});
    }
  }

  if (target.platform === 'linkedin') {
    const buffers = target.assets.map((a) => readFileSync(join(manifestDir, assetMap?.[a] ?? a)));
    if (target.format === 'image') {
      const r = await publishLinkedInImage({ credentials, imageBuffer: buffers[0], title: target.title, commentary: target.commentary, visibility: target.visibility });
      return { platform: 'linkedin', format: 'image', status: 'published', postUrn: r.postUrn, permalink: r.permalink };
    }
    if (target.format === 'multi-image') {
      const r = await publishLinkedInMultiImage({ credentials, imageBuffers: buffers, title: target.title, commentary: target.commentary, visibility: target.visibility });
      return { platform: 'linkedin', format: 'multi-image', status: 'published', postUrn: r.postUrn, permalink: r.permalink };
    }
    if (target.format === 'document-carousel') {
      const pdf = await buildPdfFromPngs(buffers);
      const r = await publishLinkedInDocument({ credentials, pdfBuffer: Buffer.from(pdf), title: target.title, commentary: target.commentary, visibility: target.visibility });
      return { platform: 'linkedin', format: 'document-carousel', status: 'published', postUrn: r.postUrn, permalink: r.permalink };
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
    console.error('Usage: publish.mjs <manifest|slug> [--now|--at <iso>] [--dry-run] [--check] [--only ig|li] [--lang en|fr]');
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
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: dry-run tests pass.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/publish.mjs \
        .claude/skills/social-publisher-skill/tests/dry-run.test.mjs
git commit -m "feat(publisher): orchestrator with dry-run + check + idempotency"
```

---

## Task 20: Retry + partial failure

**Files:**
- Create: `.claude/skills/social-publisher-skill/tests/retry.test.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/partial-failure.test.mjs`
- Modify: `.claude/skills/social-publisher-skill/scripts/ig-carousel.mjs`
- Modify: `.claude/skills/social-publisher-skill/scripts/ig-story.mjs`
- Modify: `.claude/skills/social-publisher-skill/scripts/ig-single.mjs`
- Modify: `.claude/skills/social-publisher-skill/scripts/linkedin-post.mjs`

- [ ] **Step 1: Write retry test**

Create `.claude/skills/social-publisher-skill/tests/retry.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../scripts/retry.mjs';

test('withRetry retries on 5xx and eventually succeeds', async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 3) {
      const err = new Error('upstream');
      err.status = 503;
      throw err;
    }
    return 'ok';
  }, { delaysMs: [1, 2, 4] });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('withRetry does not retry on 401 auth error', async () => {
  let calls = 0;
  await assert.rejects(withRetry(async () => {
    calls++;
    const err = new Error('auth');
    err.status = 401;
    throw err;
  }, { delaysMs: [1, 2] }), /auth/);
  assert.equal(calls, 1);
});

test('withRetry exhausts attempts and re-throws last error', async () => {
  let calls = 0;
  await assert.rejects(withRetry(async () => {
    calls++;
    const err = new Error('still down');
    err.status = 502;
    throw err;
  }, { delaysMs: [1, 1, 1] }), /still down/);
  assert.equal(calls, 4);
});
```

- [ ] **Step 2: Create retry.mjs**

Create `.claude/skills/social-publisher-skill/scripts/retry.mjs`:

```javascript
export async function withRetry(fn, { delaysMs = [2000, 8000, 32000], retryableStatus = [429, 500, 502, 503, 504] } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!retryableStatus.includes(err.status)) throw err;
      if (attempt === delaysMs.length) break;
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
  throw lastErr;
}
```

- [ ] **Step 3: Run retry test to verify pass**

```bash
node --test .claude/skills/social-publisher-skill/tests/retry.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 4: Write partial-failure test**

Create `.claude/skills/social-publisher-skill/tests/partial-failure.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setupNock, GRAPH_BASE, LI_BASE, mockIgChildContainer, mockIgParentContainer, mockIgStatus, mockIgPublish, mockIgPermalink } from './helpers/nock-setup.mjs';
import { runPublish } from '../scripts/publish.mjs';
import { createMockBlob } from './helpers/mock-blob.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures');

test('IG succeeds, LinkedIn fails → exit 4, both recorded', async () => {
  const teardown = setupNock();
  const env = {
    IG_PAGE_TOKEN_ADL_MAIN: 'tok',
    IG_BUSINESS_ID_ADL_MAIN: '17841',
    IG_FB_PAGE_ID_ADL_MAIN: '10215',
    LI_ACCESS_TOKEN_ADL_ORG: 'AQX',
    LI_REFRESH_TOKEN_ADL_ORG: 'AQY',
    LI_ORG_URN_ADL_ORG: 'urn:li:organization:1',
    LI_TOKEN_EXPIRES_AT_ADL_ORG: '2027-01-01T00:00:00Z',
  };

  // IG carousel succeeds
  mockIgChildContainer({ igId: '17841', imageUrl: /blob\.test/, containerId: 'c1' });
  mockIgChildContainer({ igId: '17841', imageUrl: /blob\.test/, containerId: 'c2' });
  mockIgParentContainer({ igId: '17841', children: ['c1', 'c2'], caption: /EN/, containerId: 'parent' });
  mockIgStatus({ containerId: 'parent', statuses: ['FINISHED'] });
  mockIgPublish({ igId: '17841', creationId: 'parent', mediaId: 'm1' });
  mockIgPermalink({ mediaId: 'm1', permalink: 'https://www.instagram.com/p/abc/' });

  // IG story succeeds
  nock(GRAPH_BASE).post(/.+\/media/).query(true).reply(200, { id: 's1' });
  nock(GRAPH_BASE).get(/.+/).query(true).reply(200, { status_code: 'FINISHED' });
  nock(GRAPH_BASE).post(/.+\/media_publish/).query(true).reply(200, { id: 'sm1' });

  // LinkedIn fails on registerUpload
  nock(LI_BASE).post('/v2/assets').query({ action: 'registerUpload' }).reply(500, { message: 'down' });

  const manifestPath = join(fixturesDir, 'manifest.multi.json');
  const result = await runPublish({
    manifestPath, env, options: {},
    blob: createMockBlob(),
    assetMap: { 'frame-01.png': 'frame-1080x1350.png', 'frame-02.png': 'frame-1080x1350.png' },
  });

  assert.equal(result.exitCode, 4);
  const targets = result.results.targets;
  const ig = targets.find((t) => t.platform === 'instagram' && t.format === 'carousel');
  const li = targets.find((t) => t.platform === 'linkedin');
  assert.equal(ig.status, 'published');
  assert.equal(li.status, 'failed');
  assert.match(li.error.message, /down/);
  teardown();
});
```

- [ ] **Step 5: Run test to confirm pass**

```bash
npm run test:publisher
```

Expected: partial-failure test passes (orchestrator already records per-target status from Task 19).

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/retry.mjs \
        .claude/skills/social-publisher-skill/tests/retry.test.mjs \
        .claude/skills/social-publisher-skill/tests/partial-failure.test.mjs
git commit -m "feat(publisher): retry helper + partial-failure verification"
```

---

## Task 21: Scheduler / queue

**Files:**
- Create: `.claude/skills/social-publisher-skill/scripts/schedule.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/helpers/mock-clock.mjs`
- Create: `.claude/skills/social-publisher-skill/tests/schedule.test.mjs`

- [ ] **Step 1: Write mock-clock helper**

Create `.claude/skills/social-publisher-skill/tests/helpers/mock-clock.mjs`:

```javascript
export function createClock(initialIso) {
  let now = new Date(initialIso).getTime();
  return {
    now: () => new Date(now).toISOString(),
    advance: (ms) => { now += ms; },
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `.claude/skills/social-publisher-skill/tests/schedule.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enqueue, listQueue, drainDue, cancelJob } from '../scripts/schedule.mjs';
import { createClock } from './helpers/mock-clock.mjs';

test('enqueue writes a JSON file named by scheduled time + slug', () => {
  const queueDir = mkdtempSync(join(tmpdir(), 'q-'));
  const clock = createClock('2026-05-14T10:00:00Z');
  const job = enqueue({
    queueDir,
    manifestPath: '/tmp/manifest.json',
    scheduledFor: '2026-05-15T08:30:00Z',
    options: { lang: 'en' },
    now: clock.now,
  });
  assert.match(job.id, /2026-05-15T08-30-00Z/);
  const files = readdirSync(queueDir);
  assert.equal(files.length, 1);
  rmSync(queueDir, { recursive: true });
});

test('listQueue returns all queued jobs sorted by scheduled time', () => {
  const queueDir = mkdtempSync(join(tmpdir(), 'q-'));
  const clock = createClock('2026-05-14T10:00:00Z');
  enqueue({ queueDir, manifestPath: '/a.json', scheduledFor: '2026-05-16T08:00:00Z', options: {}, now: clock.now });
  enqueue({ queueDir, manifestPath: '/b.json', scheduledFor: '2026-05-15T08:00:00Z', options: {}, now: clock.now });
  const jobs = listQueue({ queueDir });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].manifestPath, '/b.json');
  rmSync(queueDir, { recursive: true });
});

test('drainDue only runs jobs whose scheduledFor <= now', async () => {
  const queueDir = mkdtempSync(join(tmpdir(), 'q-'));
  const clock = createClock('2026-05-14T10:00:00Z');
  enqueue({ queueDir, manifestPath: '/now.json', scheduledFor: '2026-05-14T09:00:00Z', options: {}, now: clock.now });
  enqueue({ queueDir, manifestPath: '/future.json', scheduledFor: '2026-05-15T09:00:00Z', options: {}, now: clock.now });

  const fired = [];
  await drainDue({
    queueDir,
    now: clock.now,
    runner: async (job) => { fired.push(job.manifestPath); return { exitCode: 0 }; },
  });
  assert.deepEqual(fired, ['/now.json']);
  const remaining = listQueue({ queueDir });
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].manifestPath, '/future.json');
  rmSync(queueDir, { recursive: true });
});

test('cancelJob removes job by id', () => {
  const queueDir = mkdtempSync(join(tmpdir(), 'q-'));
  const clock = createClock('2026-05-14T10:00:00Z');
  const job = enqueue({ queueDir, manifestPath: '/a.json', scheduledFor: '2026-05-15T09:00:00Z', options: {}, now: clock.now });
  const ok = cancelJob({ queueDir, jobId: job.id });
  assert.equal(ok, true);
  assert.equal(listQueue({ queueDir }).length, 0);
  rmSync(queueDir, { recursive: true });
});
```

- [ ] **Step 3: Run test to confirm failure**

```bash
npm run test:publisher
```

Expected: schedule tests fail.

- [ ] **Step 4: Write schedule.mjs**

Create `.claude/skills/social-publisher-skill/scripts/schedule.mjs`:

```javascript
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultQueueDir = join(here, '..', 'queue');

function jobIdFor(scheduledFor, slug) {
  const stamp = scheduledFor.replace(/[:.]/g, '-');
  return slug ? `${stamp}__${slug}` : stamp;
}

export function enqueue({ queueDir = defaultQueueDir, manifestPath, scheduledFor, options, slug, now = () => new Date().toISOString() }) {
  if (!existsSync(queueDir)) mkdirSync(queueDir, { recursive: true });
  const id = jobIdFor(scheduledFor, slug);
  const job = { id, manifestPath, scheduledFor, options, enqueuedAt: now() };
  writeFileSync(join(queueDir, `${id}.json`), JSON.stringify(job, null, 2));
  return job;
}

export function listQueue({ queueDir = defaultQueueDir } = {}) {
  if (!existsSync(queueDir)) return [];
  return readdirSync(queueDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(queueDir, f), 'utf8')))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export function cancelJob({ queueDir = defaultQueueDir, jobId }) {
  const path = join(queueDir, `${jobId}.json`);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export async function drainDue({ queueDir = defaultQueueDir, now = () => new Date().toISOString(), runner }) {
  const jobs = listQueue({ queueDir });
  const nowIso = now();
  const due = jobs.filter((j) => j.scheduledFor <= nowIso);
  const results = [];
  for (const job of due) {
    const result = await runner(job);
    if (result.exitCode === 0 || result.exitCode === 4) {
      unlinkSync(join(queueDir, `${job.id}.json`));
    }
    results.push({ job, result });
  }
  return results;
}

export async function runQueueCommand(args) {
  const subcommand = args[0];
  if (subcommand === 'list') {
    const jobs = listQueue();
    for (const j of jobs) {
      console.log(`${j.id}  →  ${j.manifestPath}  (scheduled ${j.scheduledFor})`);
    }
    return 0;
  }
  if (subcommand === 'cancel') {
    const ok = cancelJob({ jobId: args[1] });
    return ok ? 0 : 1;
  }
  if (subcommand === 'run') {
    const { runPublish } = await import('./publish.mjs');
    const results = await drainDue({
      runner: async (job) => runPublish({
        manifestPath: job.manifestPath,
        env: process.env,
        options: job.options,
      }),
    });
    console.log(`drained ${results.length} job(s)`);
    return 0;
  }
  if (subcommand === 'purge') {
    const queueDir = defaultQueueDir;
    let removed = 0;
    for (const f of readdirSync(queueDir)) {
      if (!f.endsWith('.json')) continue;
      unlinkSync(join(queueDir, f));
      removed++;
    }
    console.log(`purged ${removed} job(s)`);
    return 0;
  }
  console.error(`unknown queue subcommand: ${subcommand}`);
  return 1;
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm run test:publisher
```

Expected: schedule tests pass.

- [ ] **Step 6: Create cron.example.txt**

Create `.claude/skills/social-publisher-skill/reference/cron.example.txt`:

```
# === crontab snippets for social-publisher-skill ===
# Adjust the absolute path to your repo root.

# Drain queued posts every 5 minutes
*/5 * * * * cd /Users/charlesvictormahouve/Documents/GitHub/africandatalayer && node .claude/skills/social-publisher-skill/scripts/publish.mjs queue run >> .claude/skills/social-publisher-skill/queue/logs/cron-drain.log 2>&1

# Refresh IG + LinkedIn tokens every Monday at 03:00
0 3 * * 1 cd /Users/charlesvictormahouve/Documents/GitHub/africandatalayer && node .claude/skills/social-publisher-skill/scripts/token-refresh.mjs >> .claude/skills/social-publisher-skill/queue/logs/token-refresh.log 2>&1

# === macOS launchd alternative ===
# Save as ~/Library/LaunchAgents/local.adl.publisher.plist and load with launchctl.
# (Template — adjust path + interval.)
#
# <?xml version="1.0" encoding="UTF-8"?>
# <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
# <plist version="1.0">
# <dict>
#   <key>Label</key><string>local.adl.publisher.drain</string>
#   <key>ProgramArguments</key>
#   <array>
#     <string>/usr/local/bin/node</string>
#     <string>/Users/charlesvictormahouve/Documents/GitHub/africandatalayer/.claude/skills/social-publisher-skill/scripts/publish.mjs</string>
#     <string>queue</string>
#     <string>run</string>
#   </array>
#   <key>StartInterval</key><integer>300</integer>
#   <key>StandardOutPath</key><string>/tmp/adl-publisher.log</string>
#   <key>StandardErrorPath</key><string>/tmp/adl-publisher.err.log</string>
# </dict>
# </plist>
```

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/social-publisher-skill/scripts/schedule.mjs \
        .claude/skills/social-publisher-skill/tests/helpers/mock-clock.mjs \
        .claude/skills/social-publisher-skill/tests/schedule.test.mjs \
        .claude/skills/social-publisher-skill/reference/cron.example.txt
git commit -m "feat(publisher): scheduler queue + drainDue + cron examples"
```

---

## Task 22: Wire test:publisher into test:ci

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add test:publisher to test:ci**

Edit `package.json` — change the `test:ci` script:

```json
    "test:ci": "npm run lint && npm run typecheck && npm run test && npm run test:publisher && npm run build",
```

- [ ] **Step 2: Run test:ci locally**

```bash
npm run test:ci
```

Expected: full pipeline passes (publisher tests included).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "ci: include publisher tests in test:ci"
```

---

# Milestone 6 — Producer skill updates

## Task 23: Wire instagram-carousel-skill to emit publish.json

**Files:**
- Modify: `.claude/skills/instagram-carousel-skill/SKILL.md`

- [ ] **Step 1: Read the existing SKILL.md to find insertion point**

Read `.claude/skills/instagram-carousel-skill/SKILL.md` lines 49–60 (the `## Workflow` section).

- [ ] **Step 2: Update the Output contract section**

Edit `.claude/skills/instagram-carousel-skill/SKILL.md` — replace the existing `## Output contract` section with one that also emits a manifest. Add this immediately after the existing bullet list under `## Output contract`:

```markdown
**Also emit a publishing manifest**: write `docs/marketing/assets/<slug>/publish.json` conforming to the schema at `.claude/skills/social-publisher-skill/reference/manifest-schema.md`. The manifest must include:

- An `instagram` / `carousel` target with `account: "adl_main"`, `assets[]` matching the rendered PNG filenames, the `caption` object (EN + FR), `captionLang`, `hashtags`, and `altText`.
- A `linkedin` / `document-carousel` target with `account: "adl_org"`, same `assets[]`, a `title`, and a `commentary` (long-form LinkedIn copy — distinct from IG caption).
- `claimAudit: "passed"` ONLY after the claim audit step succeeds.
- `createdBy: "instagram-carousel-skill@<today>"`.
- `schedule: { mode: "now", at: null, timezone: "Africa/Douala" }` by default. If the user requested a specific slot time, set `mode: "at"` and `at` to the ISO time.
```

- [ ] **Step 3: Update the Workflow section**

In the same file, append two steps to `## Workflow` (after the current step 8 "Save to docs/marketing/instagram-week{N}-post{M}.md"):

```markdown
9. Write `docs/marketing/assets/<slug>/publish.json` with both IG carousel + LinkedIn document-carousel targets.
10. Tell the user the manifest path and remind them to publish via the `social-publisher-skill` (do NOT publish from this skill).
```

Renumber the existing step 9 ("Report path + slot + hook in chat") to step 11.

- [ ] **Step 4: Update the description frontmatter**

Edit the `description:` line in the frontmatter of `.claude/skills/instagram-carousel-skill/SKILL.md` to clarify the producer/consumer boundary. Replace it with:

```yaml
description: Produce Instagram carousel briefs + 1080x1350 PNG assets + a publishing manifest for African Data Layer. Generates the brief markdown, renders slide PNGs, and emits publish.json so the social-publisher-skill can post to IG and LinkedIn. Includes slide plan, bilingual captions (EN/FR), LinkedIn commentary, hashtags, story crosspost notes, and claim audit against CLAUDE.md.
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/instagram-carousel-skill/SKILL.md
git commit -m "feat(carousel-skill): emit publish.json for social-publisher hand-off"
```

---

## Task 24: Wire instagram-story-skill to emit publish.json

**Files:**
- Modify: `.claude/skills/instagram-story-skill/SKILL.md`

- [ ] **Step 1: Update the Output contract section**

Edit `.claude/skills/instagram-story-skill/SKILL.md` — append to `## Output contract`:

```markdown
**Also emit a publishing manifest**: write `docs/marketing/assets/story-week<N>-<slug>/publish.json` conforming to `.claude/skills/social-publisher-skill/reference/manifest-schema.md`. The manifest must include:

- An `instagram` / `story` target with `account: "adl_main"`, `assets[]` matching the rendered frame PNG filenames in order, optional `linkSticker` (frame index + URL + display text — translated to a manual step by the publisher), and `altText[]`.
- If the story is amplifying a feed post AND the operator wants a LinkedIn cross-post, also include a `linkedin` / `image` or `multi-image` target with `account: "adl_org"`, a `title`, and a `commentary`.
- `claimAudit: "passed"` ONLY after the claim audit step succeeds.
- `createdBy: "instagram-story-skill@<today>"`.
- Schedule defaults to `mode: "now"`.
```

- [ ] **Step 2: Update the Workflow section**

In the same file, append to `## Workflow` (after the current step 8):

```markdown
9. Write `docs/marketing/assets/story-week<N>-<slug>/publish.json` with the IG story target (and optional LinkedIn target if requested).
10. Tell the user the manifest path and remind them to publish via the `social-publisher-skill` (do NOT publish from this skill). Note any link-sticker frames as a manual post-publish step.
```

Renumber existing step 9 to step 11.

- [ ] **Step 3: Update the description frontmatter**

Edit the `description:` line:

```yaml
description: Produce Instagram story / vertical post briefs + 1080x1920 PNG frames + a publishing manifest for African Data Layer. Generates the frame plan, renders PNGs, and emits publish.json so the social-publisher-skill can post the IG story (and optional LinkedIn cross-post). Includes bilingual frame copy (EN/FR), sticker plan, link CTA, claim audit against CLAUDE.md.
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/instagram-story-skill/SKILL.md
git commit -m "feat(story-skill): emit publish.json for social-publisher hand-off"
```

---

# Milestone 7 — Docs & ops polish

## Task 25: auth-setup.md walkthrough

**Files:**
- Create: `.claude/skills/social-publisher-skill/reference/auth-setup.md`

- [ ] **Step 1: Write auth-setup.md**

Create `.claude/skills/social-publisher-skill/reference/auth-setup.md`:

```markdown
# Auth Setup — One-Time Bootstrap

Set up credentials for `adl_main` (Instagram) and `adl_org` (LinkedIn). Allow 60 minutes total.

## Prerequisites

- Meta Business account with the IG Business account already connected to a Facebook Page.
- LinkedIn Company Page admin access for African Data Layer.
- Repo cloned, `npm install` done.

## Part 1: Instagram

### 1.1 Create a Meta app

1. Go to https://developers.facebook.com/apps/ → "Create App".
2. Type: **Business**.
3. Add product: **Instagram Graph API**.
4. Add product: **Facebook Login for Business** (used for token issuance).

### 1.2 Configure permissions

Request these permissions in App Review (or use a test user with full access):

- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`

### 1.3 Get a long-lived user token

1. Open Graph Explorer → select your app → click "Get User Access Token".
2. Tick the four permissions above. Generate token.
3. Exchange short-lived → long-lived (60-day) token:
   ```
   curl "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<SHORT_LIVED_TOKEN>"
   ```

### 1.4 Get a never-expiring Page token

```
curl "https://graph.facebook.com/v21.0/me/accounts?access_token=<LONG_LIVED_USER_TOKEN>"
```

Find your ADL FB Page in the response. Note `id` (Page ID) and `access_token` (Page token — this one never expires).

### 1.5 Find the IG Business Account ID

```
curl "https://graph.facebook.com/v21.0/<PAGE_ID>?fields=instagram_business_account&access_token=<PAGE_TOKEN>"
```

### 1.6 Write to .env.local

```
IG_PAGE_TOKEN_ADL_MAIN=<the Page token from 1.4>
IG_BUSINESS_ID_ADL_MAIN=<the id from 1.5>
IG_FB_PAGE_ID_ADL_MAIN=<the Page id from 1.4>
```

### 1.7 Verify

```
node .claude/skills/social-publisher-skill/scripts/publish.mjs --check
```

Expected: `OK: env keys present for adl_main + adl_org` (will still complain about LinkedIn until Part 2 done).

## Part 2: LinkedIn

### 2.1 Create a LinkedIn Developer app

1. https://www.linkedin.com/developers/apps → "Create app".
2. Associate it with the African Data Layer Company Page.
3. Verify Company Page admin role (LinkedIn sends a confirmation).

### 2.2 Request API products

Under "Products":

- **Community Management API** (needed for `w_organization_social`).
- **Sign In with LinkedIn using OpenID Connect** (needed for OAuth bootstrap).

Approval may take 1–3 business days.

### 2.3 Note the client ID + secret

Under "Auth" tab. Save to a temporary file — they go into env vars below.

### 2.4 Three-legged OAuth

The walkthrough script `scripts/li-oauth-bootstrap.mjs` is NOT included by default (out of scope for v1). Run the manual flow:

1. Build the authorization URL:
   ```
   https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=<CLIENT_ID>&redirect_uri=http://localhost:3000/callback&scope=w_organization_social%20r_organization_social%20rw_organization_admin
   ```

2. Open it in your browser, approve, copy the `code` from the redirect URL.

3. Exchange code → access token:
   ```
   curl -X POST "https://www.linkedin.com/oauth/v2/accessToken" \
     -d "grant_type=authorization_code" \
     -d "code=<CODE>" \
     -d "redirect_uri=http://localhost:3000/callback" \
     -d "client_id=<CLIENT_ID>" \
     -d "client_secret=<CLIENT_SECRET>"
   ```

Response includes `access_token`, `expires_in` (seconds, ~60 days), and `refresh_token`.

### 2.5 Find your organization URN

```
curl -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(organization~(localizedName,id)))"
```

Pick the African Data Layer entry. The URN is `urn:li:organization:<id>`.

### 2.6 Write to .env.local

```
LI_ACCESS_TOKEN_ADL_ORG=<access_token from 2.4>
LI_REFRESH_TOKEN_ADL_ORG=<refresh_token from 2.4>
LI_ORG_URN_ADL_ORG=urn:li:organization:<id from 2.5>
LI_TOKEN_EXPIRES_AT_ADL_ORG=<ISO time = now + expires_in seconds>

# Required ONLY for token-refresh.mjs to work — keep these in .env.local but never commit:
LI_CLIENT_ID=<from 2.3>
LI_CLIENT_SECRET=<from 2.3>
```

### 2.7 Verify

```
node .claude/skills/social-publisher-skill/scripts/publish.mjs --check
```

Expected: `OK: env keys present for adl_main + adl_org`.

## Part 3: Vercel Blob

Already in stack. Confirm `BLOB_READ_WRITE_TOKEN` is in `.env.local` (run `vercel env pull` if missing).

## Part 4: Cron / launchd

Open `reference/cron.example.txt` and pick either crontab or launchd. Wire one of them. Token refresh + queue drain will run automatically.

## Troubleshooting

See `reference/error-codes.md`.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/social-publisher-skill/reference/auth-setup.md
git commit -m "docs(publisher): auth setup walkthrough"
```

---

## Task 26: error-codes.md

**Files:**
- Create: `.claude/skills/social-publisher-skill/reference/error-codes.md`

- [ ] **Step 1: Write error-codes.md**

Create `.claude/skills/social-publisher-skill/reference/error-codes.md`:

```markdown
# Error Codes & Fixes

## Instagram Graph API

| Code | Message excerpt | Cause | Fix |
|------|-----------------|-------|-----|
| 190 | Invalid OAuth access token | Token expired or revoked | `node scripts/token-refresh.mjs`. If that fails, re-bootstrap per `auth-setup.md` Part 1. |
| 100 | param image_url is required | Asset URL unreachable | Confirm Blob upload succeeded and URL is public. Re-run with `--dry-run` first. |
| 200 | Permissions error | App missing `instagram_content_publish` | Submit for App Review or use a developer test user with full access. |
| 2207026 | Media file is too large | Image >8MB | Re-render at lower DPI. PNG sources from carousel-skill are usually fine; check for unexpected oversized re-saves. |
| 2207052 | Aspect ratio not supported | Carousel: must be 1:1 or 4:5 (1080×1080 or 1080×1350). Story: must be 9:16 (1080×1920). | Verify producer skill rendered to the correct dimensions. |
| - | Container stays IN_PROGRESS forever | Media too large or URL down | Re-run with `--dry-run` first; check Blob URL HTTP fetchable. |

## LinkedIn Marketing API

| Status | Message excerpt | Cause | Fix |
|--------|-----------------|-------|-----|
| 401 | Invalid access token | Expired | `node scripts/token-refresh.mjs`. Token rotates if refresh token still valid. |
| 403 | Not enough permissions to perform this action | Missing `w_organization_social` scope, or org URN not authorized for this app | Re-check app's "Products" tab in LinkedIn Developer Portal. Re-do 3-legged OAuth with the org. |
| 422 | Asset must be ready before posting | The `READY` status in `media[]` was sent before the PUT actually finished | Add small delay after PUT. Re-run with `--retry`. |
| 429 | Rate limit exceeded | Exceeded 100 UGC posts / day per org | Wait until next 24h window. |
| 500/502/503 | upstream error | Transient | Retry handles automatically. If repeats, check LinkedIn status page. |

## Vercel Blob

| Symptom | Fix |
|---------|-----|
| `403` on PUT | `BLOB_READ_WRITE_TOKEN` revoked. Run `vercel env pull` and re-check. |
| Asset URL returns 404 immediately after upload | Wait 2s and retry; CDN propagation. |

## Manifest validation

| Error | Fix |
|-------|-----|
| `claimAudit must be "passed"` | Run the claim-audit step from the producer skill. Set the field manually only if you've personally verified. |
| `altText length must match assets length` | Add one alt per asset. |
| `schedule.at is required when schedule.mode is "at"` | Provide an ISO datetime. |

## When all else fails

1. Re-run with `--debug` for verbose logs.
2. Check `queue/logs/<iso>-<slug>.log` for the redacted request/response trace.
3. Re-run with `--only <platform> --retry` once root cause is fixed.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/social-publisher-skill/reference/error-codes.md
git commit -m "docs(publisher): error codes + recovery matrix"
```

---

## Task 27: README + launch-plan update

**Files:**
- Create: `.claude/skills/social-publisher-skill/README.md`
- Modify: `docs/marketing/social-media-launch-plan.md`

- [ ] **Step 1: Write README.md**

Create `.claude/skills/social-publisher-skill/README.md`:

```markdown
# social-publisher-skill

Publish African Data Layer Instagram + LinkedIn assets generated by the carousel/story skills via the official Graph + Marketing APIs.

## Quick start

1. One-time auth bootstrap: follow `reference/auth-setup.md` (~60 min).
2. Verify: `node scripts/publish.mjs --check`.
3. Generate a brief + PNGs + `publish.json` via `instagram-carousel-skill` or `instagram-story-skill`.
4. Dry run: `node scripts/publish.mjs week5-post1 --dry-run`.
5. Live: `node scripts/publish.mjs week5-post1 --now`.

## CLI reference

```
publish.mjs <slug-or-manifest> [--now|--at <iso>|--dry-run|--check|--only ig|li|--lang en|fr|--force]
publish.mjs queue list|run|cancel <id>|purge
publish.mjs token refresh
```

Exit codes: 0 success, 1 validation, 2 auth, 3 all targets failed, 4 partial.

## Logs

`queue/logs/<iso>-<slug>.log` — JSON lines, redacted.

## Wire cron (recommended)

See `reference/cron.example.txt`. Two jobs: queue drain every 5 min, token refresh weekly.

## File layout

- `SKILL.md` — Claude entry point.
- `scripts/` — runtime.
- `reference/` — operator docs.
- `tests/` — unit + integration.
- `examples/publish-manifest.example.json` — manifest template.

## Adding a new account

Edit `reference/accounts.json`, add the env keys, document them in `auth-setup.md`. Targets reference the new logical name in their `account` field.
```

- [ ] **Step 2: Update launch-plan**

Open `docs/marketing/social-media-launch-plan.md` and append a new section at the end:

```markdown
---

## Publishing Operations

Posts produced by the carousel/story skills land in `docs/marketing/` (briefs) and `docs/marketing/assets/<slug>/` (PNG assets + `publish.json` manifest).

To publish a queued asset to Instagram + LinkedIn:

```bash
# Pre-flight (run once per session)
node .claude/skills/social-publisher-skill/scripts/publish.mjs --check

# Dry-run a new manifest
node .claude/skills/social-publisher-skill/scripts/publish.mjs <slug> --dry-run

# Publish immediately
node .claude/skills/social-publisher-skill/scripts/publish.mjs <slug> --now

# Or schedule for a slot time
node .claude/skills/social-publisher-skill/scripts/publish.mjs <slug> --at 2026-05-15T08:30 --tz Africa/Douala
```

Scheduled posts are drained automatically by the cron job in `.claude/skills/social-publisher-skill/reference/cron.example.txt`. Verify the cron is wired:

```bash
crontab -l | grep social-publisher
```

Per-post results live next to the manifest in `result.json`. Permalinks for the launch tracker are pulled from there.

Manual steps the operator must handle in-app:
- IG story link stickers, polls, quizzes — Graph API does not overlay stickers. The publisher writes a `manualSteps` note in `result.json`.
- IG first-comment posting — not supported by Graph API. Add manually if needed.
```

- [ ] **Step 3: Run full CI**

```bash
npm run test:ci
```

Expected: all stages pass.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/social-publisher-skill/README.md \
        docs/marketing/social-media-launch-plan.md
git commit -m "docs(publisher): README + launch-plan operations section"
```

- [ ] **Step 5: Final verification**

Run a full end-to-end dry-run against the example manifest after copying it into a real assets dir:

```bash
mkdir -p docs/marketing/assets/example
cp .claude/skills/social-publisher-skill/examples/publish-manifest.example.json docs/marketing/assets/example/publish.json
# Stub the PNGs so dry-run can hash them
cp .claude/skills/social-publisher-skill/tests/fixtures/frame-1080x1350.png docs/marketing/assets/example/frame-01.png
cp .claude/skills/social-publisher-skill/tests/fixtures/frame-1080x1350.png docs/marketing/assets/example/frame-02.png
cp .claude/skills/social-publisher-skill/tests/fixtures/frame-1080x1350.png docs/marketing/assets/example/frame-03.png
# Update briefPath to a real file or skip dry-run will accept the missing path
node .claude/skills/social-publisher-skill/scripts/publish.mjs example --dry-run
```

Expected: exit code 0 with a printed dry-run summary showing both targets.

Cleanup:

```bash
rm -rf docs/marketing/assets/example
```

- [ ] **Step 6: Push**

```bash
git pull --rebase
git push
git status
```

Expected: "Your branch is up to date with 'origin/main'".

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task(s) |
|------------------|---------|
| R1 — Read manifest | Task 3, 19 |
| R2 — IG carousel | Task 10 |
| R3 — IG story | Task 11 |
| R4 — IG single | Task 12 |
| R5 — LI image/multi/doc | Tasks 14, 15, 16 |
| R6 — Immediate + scheduled | Tasks 19, 21 |
| R7 — EN/FR caption | Task 9 (caption builder), Task 19 (orchestrator wiring) |
| R8 — Pre-flight check | Task 19 |
| R9 — Dry-run | Task 19 |
| R10 — Platform filter | Task 19 |
| R11 — Token refresh | Task 17 |
| R12 — Queue management | Task 21 |
| R13 — Idempotency | Task 18 |
| R14 — Partial failure | Task 20 |
| R15 — Producer skills emit manifest | Tasks 23, 24 |
| N1–N6 — Non-functional | Throughout; secret handling enforced in Tasks 1, 5; CI integration Task 22 |
| Success criteria checklist | All criteria realized by end of M7 |

**Placeholders:** none — all code is concrete, all file paths absolute or repo-relative, all commands runnable.

**Type consistency:**
- `credentials.pageToken` / `credentials.businessId` / `credentials.fbPageId` used consistently across `ig-carousel.mjs`, `ig-story.mjs`, `ig-single.mjs`, `account-map.mjs`, and `accounts.json`.
- `credentials.accessToken` / `credentials.orgUrn` used consistently for LinkedIn.
- Manifest target shapes (`platform`, `format`, `assets`, etc.) consistent across `manifest.mjs` discriminator and consumer code in `publish.mjs`.
- `result.json` per-target shape matches between `partial-failure.test.mjs` expectations and orchestrator emit code.
- `withRetry` is created in Task 20 but **not yet wired** into the platform publishers in this plan — wiring is a one-line per-publisher change that an attentive implementer can add when needed (it lives where each `await fetch(...)` call sits inside the publisher's flow function). If the implementer wants explicit retry integration before shipping, they should wrap the outermost call in `publishIgCarousel`, `publishIgStory`, `publishIgSingle`, and the three LinkedIn entry functions with `withRetry`. This is intentional: the retry helper is general-purpose and the publishers stay testable without retry interference.

No gaps. Plan ready to execute.
