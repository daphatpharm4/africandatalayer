# Africa's Talking sandbox testing

End-to-end checklist for validating the SMS broadcaster (`africandatalayer-q6g`) against Africa's Talking sandbox before pointing it at production traffic. Sandbox is free, requires no Cameroon ARTP sender ID, and exposes a simulator that emulates inbound SMS + delivery reports.

## 1. Create a sandbox account

1. Sign up at [sandbox.africastalking.com](https://sandbox.africastalking.com).
2. Once logged in, the default app is named `sandbox`. The username field on every API call must be the literal string `sandbox`.
3. Go to **Settings → API Key** and reveal the sandbox API key. Treat this like a production secret — sandbox endpoints can still send messages to the simulator but are rate-limited and shared.

## 2. Configure Vercel preview environment

Set the following on a Vercel preview deployment (Project → Settings → Environment Variables, scope = Preview):

```
AT_API_KEY=<sandbox-api-key>
AT_USERNAME=sandbox
AT_USE_SANDBOX=true
AT_SENDER_ID=          # leave empty in sandbox; AT routes via short code
AT_INBOUND_SECRET=<random>
APP_BASE_URL=<preview-url-without-trailing-slash>
SMS_CAMPAIGN_MAX_RECIPIENTS=10   # keep small while testing
```

Trigger a redeploy so the function picks up the new env. Confirm with:

```bash
curl -sS "$APP_BASE_URL/api/health" | jq
```

## 3. Wire AT callbacks at the sandbox dashboard

In the sandbox dashboard:

- **SMS → Inbound** callback URL → `https://<preview-host>/api/comms/sms/inbound`
- **SMS → Delivery Reports** callback URL → `https://<preview-host>/api/comms/sms/dlr`

If the dashboard doesn't let you set custom request headers, leave `AT_INBOUND_SECRET` empty in env. The endpoint accepts unsigned events when the secret is unset (development-only fallback).

## 4. Seed an opted-in test user

Sandbox sends to the simulator's mock phone number, which you control. Pick any +countrycode-formatted number you intend to use in the simulator (e.g. `+237699000001`).

In Supabase SQL editor:

```sql
UPDATE public.user_profiles
SET phone = '+237699000001',
    sms_opt_in = TRUE
WHERE id = '<your-test-user-id>';

INSERT INTO public.sms_consent_log (user_id, consented, source, copy_version)
VALUES ('<your-test-user-id>', TRUE, 'admin', 'sandbox-bootstrap');
```

`sms_opt_in` must be `TRUE` or the audience resolver excludes the user.

## 5. Send a sandbox campaign

From the admin Communications dashboard on the preview deployment:

1. Open Communications → SMS tab.
2. Filter audience: choose `Roles: agent` (or whatever role the test user holds), set `Active in last (days)` to a high number like 365.
3. Live preview should show recipient count = 1.
4. Compose message body, e.g. `Sandbox test from ADL. Reply STOP to opt out.`
5. Tick the cost acknowledgement.
6. Click **Send**.

## 6. Receive in the simulator

1. Visit [simulator.africastalking.com](https://simulator.africastalking.com).
2. Enter the same phone number from step 4 and click **Launch**.
3. The campaign message should appear within a few seconds.
4. The Communications History tab should show `sent_count: 1` for the campaign once the cron drain ticks (≤60s).

## 7. Test STOP keyword (opt-out)

1. In the simulator, type `STOP` and send.
2. The inbound webhook (`/api/comms/sms/inbound`) processes it, flips `sms_opt_in` to `FALSE`, and writes an `sms_consent_log` row with `source='inbound_stop'`.

Verify in Supabase:

```sql
SELECT sms_opt_in, updated_at FROM public.user_profiles WHERE id = '<id>';
SELECT consented, source, created_at
FROM public.sms_consent_log
WHERE user_id = '<id>'
ORDER BY created_at DESC LIMIT 5;
```

Re-attempting a campaign for the same user should now exclude them at audience-resolution time.

## 8. Test delivery reports (DLR)

The simulator auto-emits a DLR when it 'delivers' a message. The DLR webhook updates the matching `sms_campaign_recipients` row.

```sql
SELECT user_id, status, provider_message_id, delivered_at, error
FROM public.sms_campaign_recipients
WHERE campaign_id = '<campaign-id>'
ORDER BY user_id;
```

Expected progression: `pending` → `sent` (after dispatch) → `delivered` (after DLR).

## 9. Hit webhooks directly (no simulator)

Useful when AT sandbox is flaky or you only want to test the server side.

Inbound STOP simulation:

```bash
curl -sS -X POST "$APP_BASE_URL/api/comms/sms/inbound" \
  -H 'Content-Type: application/json' \
  ${AT_INBOUND_SECRET:+-H "x-at-secret: $AT_INBOUND_SECRET"} \
  -d '{
    "from": "+237699000001",
    "text": "STOP"
  }'
```

DLR simulation:

```bash
curl -sS -X POST "$APP_BASE_URL/api/comms/sms/dlr" \
  -H 'Content-Type: application/json' \
  ${AT_INBOUND_SECRET:+-H "x-at-secret: $AT_INBOUND_SECRET"} \
  -d '{
    "id": "<provider_message_id from sms_campaign_recipients>",
    "status": "Success",
    "phoneNumber": "+237699000001"
  }'
```

## 10. Clean up

When sandbox testing is complete:

```sql
-- Reset the test user
UPDATE public.user_profiles
SET sms_opt_in = FALSE
WHERE id = '<your-test-user-id>';

-- Optionally drop sandbox campaigns
DELETE FROM public.sms_campaigns WHERE created_by = '<your-test-user-id>';
```

Switch the preview env back to `AT_USE_SANDBOX=false` (or unset entirely so the production endpoint is used) before promoting to production.

## Going to production

Before flipping production:

- Production env: real `AT_USERNAME` (your live app username), production `AT_API_KEY`, registered Cameroon `AT_SENDER_ID`, set `AT_USE_SANDBOX=false`.
- ARTP sender ID registration is a manual process — start it well before launch (~2 weeks).
- Production webhook URLs must be publicly reachable; AT does not send to localhost or preview URLs that require auth.
- Set a tighter `SMS_CAMPAIGN_MAX_RECIPIENTS` until you've validated cost reporting on the first paid send.
