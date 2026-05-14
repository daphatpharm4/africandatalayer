# Social Publisher Skill — Design Spec

**Date:** 2026-05-14
**Author:** Charles Victor Mahouve (with Claude)
**Status:** Approved — ready for implementation plan
**Skill path:** `.claude/skills/social-publisher-skill/`

---

## 0. Context & Goal

African Data Layer produces social marketing content via two existing skills:

- `.claude/skills/instagram-carousel-skill/` — generates 1080×1350 IG carousels (briefs + PNG assets).
- `.claude/skills/instagram-story-skill/` — generates 1080×1920 IG stories / vertical assets (briefs + PNG assets).

These skills currently stop at **producing a brief + rendered PNGs in `docs/marketing/` and `docs/marketing/assets/<slug>/`**. Publishing is fully manual: open Instagram on phone, drag images into Meta Business Suite, copy/paste captions, hand-add hashtags, hand-add link sticker, repeat for LinkedIn.

**Goal:** add a publisher skill that consumes the assets + brief produced by the existing skills and publishes them to Instagram (Business account, FB Page linked) and LinkedIn (Company Page only) via the official Graph + Marketing APIs. Supports immediate publish and scheduled publish.

---

## 1. Requirements

### Functional

- **R1** Read a manifest file describing what to publish, where, when.
- **R2** Publish Instagram carousels (2–10 slides, 1080×1350).
- **R3** Publish Instagram stories (1–10 frames, 1080×1920) in sequence.
- **R4** Publish Instagram single-image feed posts (1:1 or 9:16).
- **R5** Publish LinkedIn organization posts in three variants: single image, multi-image (≤9), document carousel (PDF generated from PNG frames).
- **R6** Support immediate publish (`--now`) and scheduled publish (`--at <ISO>` queued for a cron worker to drain).
- **R7** Support EN or FR caption selection per call (`--lang`).
- **R8** Pre-flight validation (`--check`): env vars present, tokens valid, blob writable, manifest schema valid, asset files exist and match required dimensions.
- **R9** Dry run (`--dry-run`): emit final API payloads without making network calls.
- **R10** Per-platform filter (`--only instagram|linkedin`).
- **R11** Token refresh (`token refresh`) for IG long-lived tokens and LinkedIn OAuth tokens.
- **R12** Queue management (`queue list|run|cancel|purge`).
- **R13** Idempotency: re-invoking with the same manifest + assets must not produce duplicate posts; `--force` overrides.
- **R14** Partial failure handling: when one target fails, other targets continue; result.json records per-target status.
- **R15** Existing producer skills (carousel + story) extended to emit a `publish.json` manifest alongside their existing outputs.

### Non-functional

- **N1** Single-operator setup. No multi-user secret store yet.
- **N2** Secrets in `.env.local` (gitignored). Never logged, never committed.
- **N3** Claim audit (per `CLAUDE.md` content rules) must be marked `passed` in the manifest before publish proceeds. Gate, not warning.
- **N4** Compatible with project conventions: Node.js scripts, native test runner (`node --test`), no new heavy framework.
- **N5** Bilingual parity from upstream skills is preserved — manifest carries both EN + FR captions; publisher picks one per call.
- **N6** Cost: zero recurring cost beyond existing Vercel Blob usage (IG asset hosting).

### Out of scope (explicit YAGNI)

- TikTok / Threads / X / Facebook Page publishing.
- Multi-account fan-out beyond `adl_main` (IG) + `adl_org` (LinkedIn).
- Analytics fetch / engagement metrics post-publish — separate future skill.
- IG comment automation, IG story interactive sticker overlay (link/poll/quiz) — not supported by Graph API, requires manual step.
- Buffer / Hootsuite / Upload-Post.com fallback — rejected in brainstorming.
- Browser-automation fallback for unsupported features.

---

## 2. Architecture

### Skill layout

```
.claude/skills/social-publisher-skill/
├── SKILL.md                          # trigger + workflow + rules
├── README.md
├── reference/
│   ├── ig-graph-api.md               # endpoints, container flow, token refresh
│   ├── linkedin-ugc-api.md           # org URN, asset upload, share post
│   ├── auth-setup.md                 # one-time token bootstrap walkthrough
│   ├── manifest-schema.md            # publish.json contract
│   ├── accounts.json                 # logical account → env-var key map (committed, no secrets)
│   ├── error-codes.md                # known IG/LI errors → action
│   └── cron.example.txt              # launchd / cron snippets
├── scripts/
│   ├── publish.mjs                   # main CLI entry — orchestrator
│   ├── manifest.mjs                  # schema validation
│   ├── manifest.schema.json
│   ├── account-map.mjs               # env resolver
│   ├── logger.mjs                    # redacting logger
│   ├── upload-host.mjs               # Vercel Blob upload/delete
│   ├── pdf-builder.mjs               # PNG[] → PDF via pdf-lib
│   ├── ig-carousel.mjs               # IG carousel flow
│   ├── ig-story.mjs                  # IG story sequential flow
│   ├── ig-single.mjs                 # IG single-image flow
│   ├── linkedin-post.mjs             # LI image / multi-image / document
│   ├── token-refresh.mjs             # IG + LI token rotation
│   └── schedule.mjs                  # queue write/read, fire due jobs
├── queue/
│   ├── .gitkeep                      # queue contents gitignored
│   └── logs/                         # per-run logs (last 50 retained)
├── tests/
│   ├── fixtures/
│   │   ├── manifest.carousel.json
│   │   ├── manifest.story.json
│   │   ├── manifest.linkedin-doc.json
│   │   ├── manifest.multi.json
│   │   ├── manifest.invalid.json
│   │   ├── frame-1080x1350.png       # small solid-color test asset
│   │   ├── frame-1080x1920.png
│   │   └── frame-1080x1080.png
│   ├── manifest.test.mjs
│   ├── caption.test.mjs
│   ├── idempotency.test.mjs
│   ├── account-map.test.mjs
│   ├── pdf-builder.test.mjs
│   ├── ig-carousel-flow.test.mjs
│   ├── ig-story-flow.test.mjs
│   ├── linkedin-image-flow.test.mjs
│   ├── linkedin-doc-flow.test.mjs
│   ├── retry.test.mjs
│   ├── partial-failure.test.mjs
│   ├── dry-run.test.mjs
│   └── schedule.test.mjs
└── examples/
    └── publish-manifest.example.json
```

### Data flow

```
carousel/story skill brief MD  ──┐
docs/marketing/assets/<slug>/    ├─▶ publish.json (manifest)
                                 │       │
                                 │       ▼
                                 │   publish.mjs (orchestrator)
                                 │       │
                                 │       ├─ now ──▶ upload-host ──▶ ig-* / linkedin-post ──▶ result.json
                                 │       │
                                 │       └─ --schedule / manifest.schedule.at
                                 │              ──▶ queue/<iso>-<slug>.json
                                 │
                                 └─ cron tick (every 5 min)
                                        ──▶ schedule.mjs drains due jobs
                                              ──▶ publish.mjs --now <queued-manifest>
```

Manifest = single source of truth. Generated by carousel/story skills, or hand-written for ad-hoc posts.

---

## 3. Manifest Schema (`publish.json`)

Stored at `docs/marketing/assets/<slug>/publish.json`, alongside the rendered PNGs.

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
      "caption": { "en": "...", "fr": "..." },
      "captionLang": "en",
      "hashtags": ["#GroundTruth", "#Cameroon"],
      "altText": ["slide 1 alt", "slide 2 alt", "slide 3 alt"],
      "firstComment": null,
      "locationId": null
    },
    {
      "platform": "instagram",
      "format": "story",
      "account": "adl_main",
      "assets": ["frame-01.png", "frame-02.png"],
      "linkSticker": {
        "frame": 2,
        "url": "https://adl.app/?utm=ig-story-w5",
        "text": "MAP"
      },
      "altText": ["frame 1 alt", "frame 2 alt"]
    },
    {
      "platform": "linkedin",
      "format": "document-carousel",
      "account": "adl_org",
      "assets": ["frame-01.png", "frame-02.png", "frame-03.png"],
      "title": "Ground truth, frame by frame",
      "commentary": "Long-form LinkedIn post body with hashtags inline.",
      "visibility": "PUBLIC"
    }
  ],
  "schedule": {
    "mode": "now",
    "at": null,
    "timezone": "Africa/Douala"
  },
  "claimAudit": "passed",
  "createdBy": "instagram-carousel-skill@2026-05-14",
  "status": "pending"
}
```

### Field rules

| Field | Constraint |
|-------|------------|
| `schemaVersion` | Integer. Currently `1`. Validator rejects unknown versions. |
| `slug` | Kebab case. Used for log filenames + queue job IDs. |
| `briefPath` | Repo-relative path to the markdown brief. Existence validated. |
| `targets[]` | Min 1, max 10. Each target publishes independently. |
| `targets[].platform` | `"instagram"` \| `"linkedin"`. |
| `targets[].format` | IG: `"carousel"` \| `"story"` \| `"single"`. LI: `"image"` \| `"multi-image"` \| `"document-carousel"`. |
| `targets[].account` | Logical name resolved via `reference/accounts.json` → env var keys. |
| `targets[].assets` | Repo-relative or manifest-relative PNG paths. 2–10 for carousel; 1–10 for story; 1 for single/image; 2–9 for multi-image; 2–20 for document-carousel. |
| `targets[].caption.en` / `.fr` | IG: 0–2200 chars. LI: 0–3000 chars. Both required for IG; LI uses `commentary` instead. |
| `targets[].captionLang` | `"en"` \| `"fr"`. CLI `--lang` overrides. |
| `targets[].hashtags` | IG only. Array of strings starting with `#`. Appended to caption with `\n\n.\n.\n.\n` separator. |
| `targets[].altText` | One per asset for IG. Optional for LI (uses title/description). |
| `targets[].linkSticker` | IG story only. Generates manual-step note (Graph API does not support sticker overlay). |
| `targets[].visibility` | LinkedIn only. `"PUBLIC"` \| `"CONNECTIONS"`. Defaults to `"PUBLIC"`. |
| `schedule.mode` | `"now"` \| `"at"`. |
| `schedule.at` | ISO-8601 string required when mode = `"at"`. |
| `schedule.timezone` | IANA name. Defaults to `"Africa/Douala"`. |
| `claimAudit` | Must be `"passed"` for publish to proceed. Producer skills set this after their claim-audit step. |
| `status` | Mutated by publisher: `pending` → `uploading` → `published` \| `failed` \| `partial`. |

### Generated companion file: `result.json`

Written alongside the manifest after publish. Per-target outcome:

```json
{
  "manifestSlug": "instagram-week5-post1",
  "idempotencyKey": "sha256:abc123...",
  "completedAt": "2026-05-14T18:34:21Z",
  "targets": [
    {
      "platform": "instagram",
      "format": "carousel",
      "status": "published",
      "mediaId": "17985432109876543",
      "permalink": "https://www.instagram.com/p/Cxyz123/",
      "manualSteps": []
    },
    {
      "platform": "instagram",
      "format": "story",
      "status": "published",
      "mediaIds": ["17995...", "17996..."],
      "manualSteps": [
        "Frame 2: add link sticker → https://adl.app/?utm=ig-story-w5 (text: MAP)"
      ]
    },
    {
      "platform": "linkedin",
      "format": "document-carousel",
      "status": "failed",
      "error": {
        "code": "ASSET_NOT_READY",
        "message": "LinkedIn document asset not ready after 60s",
        "retryHint": "Re-run with --only linkedin --retry"
      }
    }
  ]
}
```

---

## 4. Auth & Credentials

### Instagram (Graph API)

Required env vars in `.env.local`:

```
IG_PAGE_TOKEN_ADL_MAIN=
IG_BUSINESS_ID_ADL_MAIN=
IG_FB_PAGE_ID_ADL_MAIN=
```

Bootstrap (documented in `reference/auth-setup.md`):

1. Meta Business Manager — app with scopes: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
2. Short-lived user token via Graph Explorer.
3. Exchange for long-lived user token (60 days).
4. `GET /me/accounts` → Page token (never expires).
5. `GET /{page-id}?fields=instagram_business_account` → IG Business Account ID.

`token-refresh.mjs` runs monthly via cron → `GET /refresh_access_token`. Warns if <14 days remaining.

### LinkedIn (Marketing API, organization)

Required env vars:

```
LI_ACCESS_TOKEN_ADL_ORG=
LI_REFRESH_TOKEN_ADL_ORG=
LI_ORG_URN_ADL_ORG=
LI_TOKEN_EXPIRES_AT_ADL_ORG=
```

Bootstrap:

1. LinkedIn Developer app → request "Community Management API" + "Sign In with LinkedIn using OpenID Connect".
2. Authorize the African Data Layer Company Page.
3. 3-legged OAuth → access token with scopes: `w_organization_social`, `r_organization_social`, `rw_organization_admin`.
4. Access token valid 60 days; refresh token 365 days.

`token-refresh.mjs` auto-rotates access token when expiry <14 days. Writes back to `.env.local` atomically (preserves comments, atomic rename).

### Asset hosting

IG Graph API requires public URLs for assets. Vercel Blob (already in project stack) is used:

```
BLOB_READ_WRITE_TOKEN=
```

Upload before container create; delete 24 hours after publish confirms (delayed cleanup job in queue).

### Secret handling rules

- All tokens in `.env.local`. Never committed (already gitignored).
- Never logged. `logger.mjs` redacts any field matching `/token|secret|key|urn:li:/i`.
- `accounts.json` lists logical names + which env keys each needs. Committed, no secrets.
- `publish.mjs` fails fast with clear missing-key error before any network call.
- No multi-user secret store yet. 1Password CLI hook documented but not wired.

### Pre-flight check (`publish.mjs --check`)

Required before `--now` ships; bypass with `--force` (logged):

- All env vars present per target.
- IG token valid (`GET /me` returns 200).
- LI token valid (`GET /v2/organizationAcls` returns 200).
- Blob token writable (test upload + delete).
- Manifest schema valid.
- Asset files exist with correct dimensions per format.

---

## 5. CLI Surface

Single entry: `node .claude/skills/social-publisher-skill/scripts/publish.mjs`

```
# Pre-flight
publish.mjs --check                                  # validate env + tokens, no posting

# Publish from manifest
publish.mjs <manifest.json>                          # respects manifest schedule field
publish.mjs <manifest.json> --now                    # override → post immediately
publish.mjs <manifest.json> --at 2026-05-15T08:30 --tz Africa/Douala
publish.mjs <manifest.json> --only instagram         # filter targets
publish.mjs <manifest.json> --only linkedin
publish.mjs <manifest.json> --dry-run                # render payloads, no network
publish.mjs <manifest.json> --lang fr
publish.mjs <manifest.json> --force                  # skip pre-flight gates

# Slug shortcut: resolves to docs/marketing/assets/<slug>/publish.json
publish.mjs week5-post1

# Queue management
publish.mjs queue list
publish.mjs queue run                                # cron entry point
publish.mjs queue cancel <job-id>
publish.mjs queue purge --status=failed

# Token ops
publish.mjs token refresh
publish.mjs token status
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Validation / schema error |
| `2` | Auth failure |
| `3` | API failure (all targets) |
| `4` | Partial success — some targets ok, some failed; check `result.json` |

### Logs

Per-run log → `queue/logs/<iso>-<slug>.log`. Contains redacted payloads, response IDs, timing. Last 50 retained.

### Cron wiring

`reference/cron.example.txt` provides launchd plist (macOS) + crontab snippet:

```
*/5 * * * * cd /path/to/repo && node .claude/skills/social-publisher-skill/scripts/publish.mjs queue run
0 3 * * 1   cd /path/to/repo && node .claude/skills/social-publisher-skill/scripts/publish.mjs token refresh
```

Skill documents how to wire one; does not install automatically.

### SKILL.md trigger contract

Skill activates when user says: "publish week5-post1", "post the carousel", "post story-week4-mon", "schedule X for tomorrow 8am", "/publish ...". SKILL.md tells Claude:

- Read the manifest first.
- Run `--check` before any publish.
- Confirm with user before `--now` on live accounts (first time per session).
- Dry-run by default for first call against a new manifest.

---

## 6. Platform Publish Flows

### IG Carousel (1080×1350, 2–10 slides)

```
1. For each asset → upload to Vercel Blob → record public URL.
2. For each URL → POST /{ig-user-id}/media
     ?image_url=<url>&is_carousel_item=true
   → returns child container ID.
3. POST /{ig-user-id}/media
     ?media_type=CAROUSEL&children=<id1>,<id2>,...&caption=<text + hashtags>
   → returns parent container ID.
4. Poll GET /{container-id}?fields=status_code until FINISHED (max 30s, 1s interval).
5. POST /{ig-user-id}/media_publish?creation_id=<parent>
   → returns published media ID.
6. GET /{media-id}?fields=permalink → final URL.
7. Queue blob asset deletion for 24h later.
```

Caption: EN or FR per `--lang`. Hashtags appended via `\n\n.\n.\n.\n` separator (IG convention to visually hide them). First-comment posting not in Graph API → skipped.

### IG Story (1080×1920, 1–10 frames sequential)

```
For each frame in order:
  1. Upload PNG to Blob.
  2. POST /{ig-user-id}/media?image_url=<url>&media_type=STORIES.
  3. Poll container until FINISHED.
  4. POST /{ig-user-id}/media_publish?creation_id=<id>.
  5. Wait 2s before next frame.
```

**Sticker limitation:** Graph API does not support poll, quiz, link sticker overlay. Publisher posts raw frames and writes `manualSteps` notes in `result.json` + chat output for the user to apply manually via IG app.

### IG Single (feed)

Single-image variant: no `is_carousel_item`, no `media_type=CAROUSEL`. Used for 1:1 feed and 9:16 vertical feed.

### LinkedIn Image Post (organization)

```
1. POST /v2/assets?action=registerUpload
   { registerUploadRequest: {
       owner: <ORG_URN>,
       recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
       serviceRelationships: [{ identifier: "urn:li:userGeneratedContent", relationshipType: "OWNER" }]
   }}
   → returns uploadUrl + asset URN.
2. PUT binary PNG to uploadUrl.
3. POST /v2/ugcPosts:
   { author: <ORG_URN>,
     lifecycleState: "PUBLISHED",
     specificContent: { "com.linkedin.ugc.ShareContent": {
       shareCommentary: { text: <commentary + hashtags> },
       shareMediaCategory: "IMAGE",
       media: [{ status: "READY", media: <asset URN>, title: {text: ...}, description: {text: ...} }]
     }},
     visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
   }
   → returns post URN.
4. Permalink: https://www.linkedin.com/feed/update/<urn>/
```

### LinkedIn Multi-image (≤9)

Same flow; `shareMediaCategory: "IMAGE"`, `media[]` carries N asset URNs from N separate registerUpload calls.

### LinkedIn Document Carousel (PDF — highest engagement)

```
1. Build PDF from PNG frames via pdf-lib (one PNG per page, 1080×1350 page size).
2. registerUpload with recipe "urn:li:digitalmediaRecipe:feedshare-document".
3. PUT PDF to uploadUrl.
4. POST /v2/ugcPosts with shareMediaCategory: "DOCUMENT", media[0].media = <doc URN>.
```

Manifest `format: "document-carousel"` routes here. PDF saved to `<assets>/build/<slug>.pdf` for re-use.

### Error handling

- Transient (5xx, rate limit 4) → exponential backoff: 2s, 8s, 32s, abort.
- Permanent (auth, validation, content policy) → fail target, continue other targets, exit 4.
- Network timeout > 60s → fail target.
- Partial: `result.json` per-target status; failed targets re-runnable via `publish.mjs <manifest> --only <platform> --retry`.

### Idempotency

Each publish run writes `result.json` with idempotency key = sha256 of `(asset hashes + caption + target list)`. Re-run with same key returns cached result, no re-post. `--force` overrides.

### Rate limits

- IG: 200 calls/hour per user. In-memory counter + 1s spacing between container creates.
- LinkedIn: 100 UGC posts/day per org. Warn at 80.

---

## 7. Testing

### Unit (Node test runner, no network)

- `manifest.test.mjs` — schema validation, required fields, target shapes, schedule modes, claim-audit gate.
- `caption.test.mjs` — hashtag separator, char limits (IG 2200, LI 3000), lang switch.
- `idempotency.test.mjs` — sha256 key stable across re-runs.
- `account-map.test.mjs` — logical name → env var resolution, missing-key errors.
- `pdf-builder.test.mjs` — N PNGs → N-page PDF, 1080×1350 page size.

### Integration (mocked APIs via nock)

- `ig-carousel-flow.test.mjs` — container create → poll FINISHED → publish → permalink; asserts call order + payload shape.
- `ig-story-flow.test.mjs` — sequential frame post, 2s spacing, manual-step note generation.
- `linkedin-image-flow.test.mjs` — registerUpload → PUT → ugcPosts.
- `linkedin-doc-flow.test.mjs` — PDF build → registerUpload (document recipe) → ugcPosts.
- `retry.test.mjs` — 5xx triggers backoff; 4xx auth aborts immediately.
- `partial-failure.test.mjs` — IG succeeds, LI fails → exit 4, result.json captures both.
- `dry-run.test.mjs` — `--dry-run` emits payloads, zero network calls (nock saw nothing).
- `schedule.test.mjs` — `--at` writes queue file; `queue run` fires only due jobs.

### Live smoke (manual, gated by `ALLOW_LIVE_SMOKE=1`)

- `smoke:ig` — posts a clearly labeled test image (caption begins "TEST · DELETE ME ·"); attempts `DELETE /{media-id}` after 60s; if API rejects, logs a hard warning telling the operator to remove manually.
- `smoke:li` — same pattern via `DELETE /v2/ugcPosts/{urn}`.

### Mocking

- Network: `nock` intercepts `graph.facebook.com` + `api.linkedin.com`.
- Blob: `BLOB_READ_WRITE_TOKEN=test` short-circuits to in-memory store with deterministic URLs.
- Time: injected clock for scheduler tests.

### Coverage

- Branch coverage 80%+ on `scripts/*.mjs`.
- 100% on auth resolution + manifest validation.

### CI

Add `npm run test:publisher` running `node --test .claude/skills/social-publisher-skill/tests/*.test.mjs`. Wire into existing `test:ci`. No live smoke in CI.

### TDD discipline

Each script file ships with a failing test first. Order: `manifest` → `account-map` → `upload-host` → `ig-carousel` → `ig-story` → `ig-single` → `linkedin-image` → `linkedin-doc` → `schedule` → `publish` (orchestrator).

---

## 8. Sequencing & Decomposition

Build order matches dependency graph + risk. Each milestone independently shippable.

### M1 — Foundation (no network)

1. Skill scaffold: `SKILL.md`, `README.md`, `reference/*.md` stubs.
2. `manifest.schema.json` + `manifest.mjs` validator.
3. `account-map.mjs` env resolver.
4. `logger.mjs` redacting logger.
5. Tests for the above.
6. `examples/publish-manifest.example.json`.

**Exit:** `publish.mjs --check` validates manifest + env presence, no API calls yet.

### M2 — Asset hosting

1. `upload-host.mjs` — Vercel Blob upload + delete.
2. `pdf-builder.mjs` — PNG → PDF via pdf-lib.
3. Tests with in-memory blob mock.

**Exit:** assets pushable to Blob, PDFs generated.

### M3 — Instagram publish

1. `ig-carousel.mjs` (most complex IG path; story + single fall out of it).
2. `ig-story.mjs`.
3. `ig-single.mjs`.
4. IG side of `token-refresh.mjs`.
5. Integration tests with nock.
6. Live smoke script.

**Exit:** `publish.mjs <manifest> --only instagram --dry-run` works; live smoke posts + deletes a test image.

### M4 — LinkedIn publish

1. `linkedin-post.mjs` — image, multi-image, document paths.
2. LinkedIn side of `token-refresh.mjs`.
3. Integration tests.
4. Live smoke.

**Exit:** same as M3 for `--only linkedin`.

### M5 — Orchestrator + scheduling

1. `publish.mjs` main — manifest → fan-out → result.json.
2. Pre-flight `--check`, `--dry-run`, `--force`, `--lang`, `--only`.
3. Idempotency key.
4. Partial-failure handling.
5. `schedule.mjs` — queue write/list/run/cancel.
6. `cron.example.txt`.

**Exit:** end-to-end one-manifest IG + LI cross-post; schedule path drains via cron.

### M6 — Producer skill updates

1. Update `instagram-carousel-skill/SKILL.md` workflow: emit `publish.json` alongside MD brief + PNGs.
2. Same for `instagram-story-skill/SKILL.md`.
3. Reference `social-publisher-skill` in their "after produce" step.

**Exit:** producer skills hand off cleanly. End-to-end: brief generation → publish in one session.

### M7 — Docs & ops polish

1. `reference/auth-setup.md` final walkthrough (Meta + LinkedIn dev portal screenshots).
2. `reference/error-codes.md` known errors + fixes.
3. README quickstart.
4. Operations section added to `docs/marketing/social-media-launch-plan.md`.

**Exit:** another operator can bootstrap from zero using docs alone.

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Meta rejects Instagram app review for `instagram_content_publish` | Medium | Blocks all IG publishing | Auth setup doc has app-review checklist; fallback: continue manual IG posting until approval |
| LinkedIn Community Management API access denied | Medium | Blocks all LI publishing | Personal-profile fallback (`w_member_social`) documented as escape hatch (not a target) |
| IG container stuck in `IN_PROGRESS` >30s | Low | Single post fails | Extended timeout to 60s with backoff; failure surfaces in result.json with retry hint |
| Token expiry between runs | Medium | Posts fail | Weekly cron auto-refresh; pre-flight `--check` catches before publish |
| Vercel Blob asset URL becomes private mid-upload | Low | IG container fails | Use public Blob; verify URL fetchable in pre-flight |
| LinkedIn document recipe stops accepting PDFs | Low | LI carousels fail | Fallback to multi-image format documented in error-codes.md |
| Producer skill manifest contract drifts | Medium | Publisher rejects manifests | Schema validator + schemaVersion field gates compatibility |
| Operator commits `.env.local` | Low | Token leak | `.env.local` already gitignored; auth-setup doc reinforces; `logger.mjs` redacts |
| Accidental live post during test | Low | Embarrassing public post | `ALLOW_LIVE_SMOKE=1` gate; `--dry-run` default for first call; user-confirmation on first `--now` per session |

---

## 10. Success Criteria

- [ ] `publish.mjs --check` reports OK on a clean repo.
- [ ] A carousel-skill-generated manifest publishes IG carousel + LI document carousel end-to-end with one command, in under 90 seconds.
- [ ] A story-skill-generated manifest publishes IG story frames in correct order with manual-step note for the link sticker.
- [ ] Re-running the same manifest returns the cached result and does not double-post.
- [ ] A scheduled job written at T+0 fires at T+10 via cron and reaches `status: "published"`.
- [ ] Killing a publish mid-flight and re-running completes without orphan containers or duplicate posts.
- [ ] All unit + integration tests pass in CI; live smoke passes locally on demand.
- [ ] An operator following `reference/auth-setup.md` from zero can publish a test post within 60 minutes.

---

## 11. Open Questions

None blocking. Items deferred to post-MVP:

- Multi-account expansion (additional IG handles, additional LI Pages).
- Engagement analytics fetch (likes / saves / shares / impressions per post).
- First-comment posting (requires browser automation — explicitly out of scope unless Meta adds API support).
- Thread/Reels publishing.
- Buffer/Hootsuite ingest format (export manifest → their CSV).

---

## 12. References

- Existing skills: `.claude/skills/instagram-carousel-skill/SKILL.md`, `.claude/skills/instagram-story-skill/SKILL.md`.
- Marketing operations: `docs/marketing/social-media-launch-plan.md`.
- Brand & content rules: `CLAUDE.md` (Design Context, palette, anti-references, voice).
- Meta Graph API — Content Publishing: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
- LinkedIn Marketing API — Share on LinkedIn: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
- pdf-lib: https://pdf-lib.js.org/
- Vercel Blob: https://vercel.com/docs/storage/vercel-blob
