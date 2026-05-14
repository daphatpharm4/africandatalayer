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
