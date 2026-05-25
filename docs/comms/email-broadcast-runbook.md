# Email Broadcast Runbook

How email campaigns are dispatched from African Data Layer admin and what to do when they fail.

## Architecture

```
Admin UI (CommunicationsPanel)
        │
        ▼ POST /api/privacy?view=campaigns
createCampaign() ── inserts email_campaigns row (status='sending')
                 └─ inserts email_campaign_recipients rows (status='pending')
        │
        ▼ (waits for cron)
GitHub Actions cron */5 min
        │ Authorization: Bearer CRON_SECRET
        ▼
GET /api/analytics?view=campaign_drain
        │
        ▼
drainPendingCampaigns()
        │
        ▼ batch of 50 recipients
dispatchCampaignSendBatch()
        │   throttled @ EMAIL_SEND_RATE_PER_SECOND (default 4/s)
        ▼
sendTransactional()
        │   5x retry on Resend 429 (Retry-After honored, exponential backoff)
        ▼
Resend API → recipient inbox
```

## Layers and limits

| Layer | File / location | Limit |
|---|---|---|
| Per-send throttle | `lib/server/email/campaigns.ts` (`dispatchCampaignSendBatch`) | `EMAIL_SEND_RATE_PER_SECOND` env (default 4) |
| 429 retry | `lib/server/email/provider.ts` (`sendTransactional`) | 5 attempts, Retry-After or exponential backoff |
| Cron drain | `.github/workflows/campaign-drain.yml` | Every 5 min |
| Batch size | `dispatchCampaignSendBatch` | 50 recipients per tick |
| Recipient cap | `EMAIL_CAMPAIGN_MAX_RECIPIENTS` env | Default 5000 |
| Resend free plan | external | 100 emails/day, 5 req/sec |
| Vercel Hobby cron | `vercel.json` | Daily max — that's why drain runs via GitHub Actions, not Vercel |

## Required configuration

### Vercel environment variables
- `RESEND_API_KEY` — Resend API key
- `RESEND_FROM` — `African Data Layer <noreply@app.africandatalayer.com>`
- `RESEND_REPLY_TO` — `support@app.africandatalayer.com` (optional)
- `CRON_SECRET` — random string, also stored in GitHub secrets
- `EMAIL_SEND_RATE_PER_SECOND` — defaults to 4

### GitHub Actions secrets
- `CRON_SECRET` — must match Vercel `CRON_SECRET`
- `CAMPAIGN_DRAIN_URL` — `https://www.app.africandatalayer.com/api/analytics?view=campaign_drain`

## Sending a broadcast (operator)

1. Admin → Communications panel → **Email** tab.
2. Audience: pick roles / trust tiers / `lastActiveDays`. Keep **Require email opt-in** checked.
3. Compose subject + HTML body + plain text. Use `{firstName}` / `{name}` / `{city}` / `{role}` / `{trustTier}` / `{language}` vars.
4. **Dry-run** → confirm recipient count matches expectation.
5. **Send** → campaign goes to `status='sending'` immediately, recipients to `status='pending'`.
6. Drain cron picks it up within 5 minutes; or trigger manually: GitHub → Actions → **Campaign Drain** → **Run workflow**.
7. Verify in Resend dashboard logs.

## Common failure modes

### "Too many requests: 5 requests per second"
- Cause: Resend free tier rate limit.
- Mitigation: throttle (4/s) + 5x retry already in code.
- If still hitting: lower `EMAIL_SEND_RATE_PER_SECOND` to 3, or upgrade Resend.

### Recipients stuck in `pending` for hours
- Cause: drain cron not running.
- Check: GitHub → Actions → Campaign Drain → recent runs all green?
- Check: `curl -i -H "Authorization: Bearer $CRON_SECRET" "$CAMPAIGN_DRAIN_URL"` returns 200.
- Fix: rerun workflow manually, then investigate failing schedule.

### Cert error from curl/GH Actions
- Cause: wrong domain. Production is `www.app.africandatalayer.com` (note the `www.`).
- Fix: update `CAMPAIGN_DRAIN_URL` secret.

### Recipients marked `failed` with rate-limit error
- Recovery SQL (replace pattern in WHERE if errors look different):

```sql
-- Find the campaign
SELECT id, subject, status, recipient_count, sent_count, failed_count
FROM public.email_campaigns
ORDER BY created_at DESC
LIMIT 10;

-- Requeue failed recipients (no <CAMPAIGN_ID> needed if using CTE match)
WITH target AS (
  SELECT id FROM public.email_campaigns
  WHERE subject ILIKE '%<your subject keyword>%'
  ORDER BY created_at DESC LIMIT 1
)
UPDATE public.email_campaign_recipients r
SET status = 'pending', error = NULL
FROM target
WHERE r.campaign_id = target.id
  AND r.status = 'failed'
  AND (r.error ILIKE '%rate%' OR r.error ILIKE '%429%' OR r.error ILIKE '%Too many%');

-- Clear stale log rows so idempotency doesn't block resend
WITH target AS (
  SELECT id FROM public.email_campaigns
  WHERE subject ILIKE '%<your subject keyword>%'
  ORDER BY created_at DESC LIMIT 1
)
UPDATE public.communications_log l
SET status = 'queued', error = NULL
FROM target
WHERE l.campaign_id = target.id
  AND l.status = 'failed'
  AND (l.error ILIKE '%rate%' OR l.error ILIKE '%429%' OR l.error ILIKE '%Too many%');

-- Reopen campaign and recompute counters
WITH target AS (
  SELECT id FROM public.email_campaigns
  WHERE subject ILIKE '%<your subject keyword>%'
  ORDER BY created_at DESC LIMIT 1
)
UPDATE public.email_campaigns c
SET status = 'sending',
    completed_at = NULL,
    updated_at = NOW(),
    failed_count = (
      SELECT COUNT(*)::int FROM public.email_campaign_recipients
      WHERE campaign_id = c.id AND status = 'failed'
    )
FROM target
WHERE c.id = target.id;
```

Drain cron will resend within 5 min, or run the workflow manually.

### Daily Resend quota exhausted
- Free plan: 100 emails/day. Any further sends fail.
- Resend dashboard → Usage → reset at UTC midnight.
- Upgrade: Pro $20/mo = 50k/mo + 10 req/sec.

## Capacity reference

- 22 recipients: ~5 seconds, 1 batch, 1 drain tick.
- 500 recipients: ~125 seconds, 10 batches, 10 drain ticks (~50 min).
- 5000 recipients (cap): ~21 minutes of sends, ~17 hours via 5-min drain (or raise `batchSize`).

To raise throughput:
1. Upgrade Resend plan, raise `EMAIL_SEND_RATE_PER_SECOND` to 10.
2. Raise `batchSize` in `drainPendingCampaigns()` call.
3. Run GH Actions every 1 min instead of 5.

## Schema reference

- `public.email_campaigns` — one row per campaign. Status: `draft | scheduled | sending | completed | cancelled | failed`.
- `public.email_campaign_recipients` — composite PK (`campaign_id`, `user_id`). Status: `pending | sent | failed | suppressed | duplicate`. **No `id` column** — query by composite key.
- `public.communications_log` — per-send log, indexed by `idempotency_key`. Reused for retries.
- `public.email_suppression` — unsubscribes + bounces + complaints. Recipient marked `suppressed` if email present.

Migrations: `supabase/migrations/20260508_email_campaigns.sql`.

## Change history

- 2026-05-25: throttle (`EMAIL_SEND_RATE_PER_SECOND=4`), Resend 429 retry, drain moved from daily Vercel cron to GitHub Actions every 5 min (Hobby plan constraint).
