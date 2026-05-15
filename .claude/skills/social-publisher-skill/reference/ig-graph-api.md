# Instagram API — Content Publishing (Instagram Login)

API base: `https://graph.instagram.com/v22.0`

This skill uses the **Instagram API with Instagram Login** (released by Meta in 2024). Unlike the older Instagram Graph API, this flow does NOT require the IG account to be linked to a Facebook Page. The IG Business or Creator account authorizes the app directly via Instagram OAuth.

## Auth

All calls take `access_token=<IG_ACCESS_TOKEN>` query param. The token is a **long-lived Instagram User Access Token** (~60 days), refreshable via `/refresh_access_token` while still valid.

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

## Required scopes

- `instagram_business_basic`
- `instagram_business_content_publish`

(Optional, if you also want to manage messages or insights: `instagram_business_manage_messages`, `instagram_business_manage_insights`.)

## Rate limits

200 calls/hour per IG user. Add ≥1s spacing between container creates to stay well under.

## Token refresh

`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<current-token>`

Returns a new 60-day token. No client_secret required for refresh (only for the initial short→long exchange during OAuth bootstrap).

## Delete

`DELETE /{media-id}?access_token=<token>` — works for self-posted media. If it 4xxs, remove manually via the IG app.

## Why not the older Instagram Graph API (via Facebook)?

The older flow required a Facebook Page linked to the IG Business account, Page tokens, and the `graph.facebook.com` host. African Data Layer's IG account has no FB Page — the Instagram Login API removes that dependency entirely.
