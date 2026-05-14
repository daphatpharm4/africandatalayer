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
  "assets": ["frame-01.png", "..."],
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
  "assets": ["frame-01.png", "..."],
  "linkSticker": { "frame": 2, "url": "https://...", "text": "MAP" },
  "altText": ["..."]
}
```

Constraints: 1–10 assets. `linkSticker` produces a manual-step note — Graph API does not apply stickers.

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
  "format": "image | multi-image | document-carousel",
  "account": "adl_org",
  "assets": ["frame-01.png", "..."],
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
