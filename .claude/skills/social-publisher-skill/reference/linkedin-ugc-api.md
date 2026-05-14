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
