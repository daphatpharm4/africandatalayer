# Auth Setup — One-Time Bootstrap

Set up credentials for `adl_main` (Instagram) and `adl_org` (LinkedIn). Allow 45 minutes total.

## Prerequisites

- Instagram Business or Creator account (NOT Personal). To check: open IG app → Settings → Account. If you see "Switch to Personal", you're already Professional. Otherwise: Settings → Account → Switch to Professional → Business.
- LinkedIn Company Page admin access for African Data Layer.
- Repo cloned, `npm install` done.

## Part 1: Instagram (Instagram Login — no Facebook Page required)

We use the **Instagram API with Instagram Login** which lets a Business/Creator IG account authorize the app directly. No FB Page link needed.

### 1.1 Create a Meta app and add the Instagram product

1. Go to https://developers.facebook.com/apps/ → "Create App".
2. Use case: **Other** → app type: **Business**.
3. After creation, in the left sidebar, add the **Instagram** product (not "Instagram Graph API" — the new "Instagram" product is the one with Instagram Login).
4. Inside Instagram product → **API setup with Instagram business login**.

### 1.2 Configure Instagram business login

1. Click **Set up** under "Configure Instagram business login".
2. **OAuth redirect URI:** add `https://localhost/callback` (any URL you control; never need it to actually receive — you'll copy the `code` from the browser URL bar manually).
3. **Deauthorize callback URL** + **Data deletion request URL**: same placeholder is fine for solo use.
4. Save.

### 1.3 Note the Instagram App ID + Instagram App Secret

In the same Instagram product → **API setup** → **Instagram App ID** and **Instagram App Secret** are listed near the top. These are DIFFERENT from the top-level Meta App ID/Secret. Save both.

### 1.4 Add scopes and (optional) Instagram Tester

If your IG account is not yet linked as a Tester (recommended during development):

1. In the Meta App Dashboard → **App roles** → **Roles** → click **Add People** → **Instagram Tester** → enter the IG handle.
2. Open IG app on phone → Settings → Apps and websites → **Tester Invites** → accept.

For scopes, the publisher requires:
- `instagram_business_basic`
- `instagram_business_content_publish`

### 1.5 Generate a user token (manual 3-legged OAuth)

1. Build this URL in your browser, replacing `<INSTAGRAM_APP_ID>` and the `redirect_uri` with the value from 1.2:

   ```
   https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authn=1&client_id=<INSTAGRAM_APP_ID>&redirect_uri=https://localhost/callback&response_type=code&scope=instagram_business_basic,instagram_business_content_publish
   ```

2. Approve in the browser. After approval, IG redirects to your redirect URI with `?code=<CODE>#_` in the URL. Copy the `<CODE>` portion (everything between `code=` and `#`).

3. Exchange code → short-lived access token:

   ```bash
   INSTAGRAM_APP_ID=<from 1.3>
   read -s "INSTAGRAM_APP_SECRET?Instagram App Secret: "; echo
   read -s "AUTH_CODE?Auth code: "; echo

   curl -X POST "https://api.instagram.com/oauth/access_token" \
     -F "client_id=${INSTAGRAM_APP_ID}" \
     -F "client_secret=${INSTAGRAM_APP_SECRET}" \
     -F "grant_type=authorization_code" \
     -F "redirect_uri=https://localhost/callback" \
     -F "code=${AUTH_CODE}" | jq
   ```

   Response:
   ```json
   { "access_token": "IGAA...", "user_id": 17841... , "permissions": ["..."] }
   ```

   Note the `user_id` — this is your `IG_USER_ID_ADL_MAIN`.

4. Exchange short-lived → long-lived (60-day) token:

   ```bash
   read -s "SHORT_TOKEN?short access_token from step 3: "; echo

   curl -s "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${SHORT_TOKEN}" | jq
   ```

   Response:
   ```json
   { "access_token": "IGAA...long...", "token_type": "bearer", "expires_in": 5183944 }
   ```

   This is your `IG_ACCESS_TOKEN_ADL_MAIN`.

### 1.6 Write to .env.local

```
IG_ACCESS_TOKEN_ADL_MAIN=<long-lived access_token from 1.5 step 4>
IG_USER_ID_ADL_MAIN=<user_id from 1.5 step 3>
```

### 1.7 Verify

```bash
node .claude/skills/social-publisher-skill/scripts/publish.mjs --check
```

Expected: `OK: env keys present for adl_main + adl_org` (will still complain about LinkedIn until Part 2).

Quick API smoke (no posting):

```bash
read -s "TOK?IG access token: "; echo
curl -s "https://graph.instagram.com/v22.0/me?fields=id,username,account_type&access_token=${TOK}" | jq
```

Should return your IG handle and `account_type: "BUSINESS"` (or `"CREATOR"`).

## Part 2: LinkedIn (Marketing API, Organization)

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

1. Build the authorization URL:
   ```
   https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=<CLIENT_ID>&redirect_uri=http://localhost:3000/callback&scope=w_organization_social%20r_organization_social%20rw_organization_admin
   ```

2. Open it in your browser, approve, copy the `code` from the redirect URL.

3. Exchange code → access token:
   ```bash
   curl -X POST "https://www.linkedin.com/oauth/v2/accessToken" \
     -d "grant_type=authorization_code" \
     -d "code=<CODE>" \
     -d "redirect_uri=http://localhost:3000/callback" \
     -d "client_id=<CLIENT_ID>" \
     -d "client_secret=<CLIENT_SECRET>"
   ```

Response includes `access_token`, `expires_in` (seconds, ~60 days), and `refresh_token`.

### 2.5 Find your organization URN

```bash
curl -H "Authorization: Bearer <ACCESS_TOKEN>" "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(organization~(localizedName,id)))"
```

Pick the African Data Layer entry. The URN is `urn:li:organization:<id>`.

### 2.6 Write to .env.local

```
LI_ACCESS_TOKEN_ADL_ORG=<access_token from 2.4>
LI_REFRESH_TOKEN_ADL_ORG=<refresh_token from 2.4>
LI_ORG_URN_ADL_ORG=urn:li:organization:<id from 2.5>
LI_TOKEN_EXPIRES_AT_ADL_ORG=<ISO time = now + expires_in seconds>

# Required ONLY for token-refresh.mjs to work — keep in .env.local but never commit:
LI_CLIENT_ID=<from 2.3>
LI_CLIENT_SECRET=<from 2.3>
```

### 2.7 Verify

```bash
node .claude/skills/social-publisher-skill/scripts/publish.mjs --check
```

Expected: `OK: env keys present for adl_main + adl_org`.

## Part 3: Vercel Blob

Already in stack. Confirm `BLOB_READ_WRITE_TOKEN` is in `.env.local` (run `vercel env pull` if missing).

## Part 4: Cron / launchd

Open `reference/cron.example.txt` and pick either crontab or launchd. Wire one of them. Token refresh + queue drain will run automatically. Token refresh is critical for Instagram — the 60-day token must be refreshed before expiry, otherwise you need to redo OAuth.

## Troubleshooting

See `reference/error-codes.md`.
