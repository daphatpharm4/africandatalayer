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
