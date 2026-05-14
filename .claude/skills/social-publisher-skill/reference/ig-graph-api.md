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
