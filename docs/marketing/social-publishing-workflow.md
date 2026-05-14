# Social Publishing Workflow

Use this workflow when a generated `docs/marketing` Instagram carousel or story needs to become a publishable Instagram and LinkedIn packet.

## Source Files

| Content type | Brief path | Asset path |
|---|---|---|
| Instagram carousel | `docs/marketing/instagram-week{N}-post{M}.md` | `docs/marketing/assets/week{N}-post{M}/` |
| Instagram story | `docs/marketing/instagram-story-week{N}-{slug}.md` | `docs/marketing/assets/story-week{N}-{slug}/` |

Each brief should carry the strategy, copy, asset list, claim audit, and `Publish Packet`. Assets remain beside the brief under `docs/marketing/assets/`.

## Status Rules

Use one status per platform:

| Status | Meaning |
|---|---|
| `Draft` | Content or assets still incomplete. |
| `Ready to post` | Copy, assets, alt text, account, timing, and link fields are complete. |
| `Posted` | Platform/API returned a live URL. |
| `Blocked` | Missing asset, claim approval, platform access, or account decision. |

Never mark content as `Posted` without a live Instagram or LinkedIn URL. Do not store passwords, tokens, session cookies, or private account credentials in repo files.

## Publish Packet Template

Add this section near the end of each brief, after claim audit and before final asset notes if possible.

```markdown
## Publish Packet

| Platform | Status | Account/Page | Scheduled WAT | Asset(s) | URL |
|---|---|---|---|---|---|
| Instagram | Ready to post | @account | YYYY-MM-DD HH:mm | docs/marketing/assets/... | TBD |
| LinkedIn | Ready to post | Page/Profile name | YYYY-MM-DD HH:mm | docs/marketing/assets/... | TBD |

### Instagram Upload

- Format:
- Upload order:
- Caption EN:
- Caption FR:
- Hashtags:
- Location:
- Alt text:
- Link/DM CTA:
- Notes:

### LinkedIn Upload

- Format:
- Document/image title:
- Post copy:
- First comment link:
- Hashtags:
- Asset(s):
- Notes:
```

## Instagram Carousel Packet

- Upload 1080x1350 PNG slides in numeric order.
- Use the EN caption unless the post is explicitly FR-first. Include FR mirror below the EN body when bilingual reach matters.
- Keep 10-15 hashtags pulled from the ADL primary, secondary, local, and industry tiers in `docs/marketing/social-media-launch-plan.md`.
- Add alt text per slide. Describe visible text, icon, and visual meaning.
- If the post asks for conversion, use `MAP` / `CARTE` as DM keywords instead of relying on bio-link clicks.
- If the same carousel has a story echo, post the story 5-10 minutes after the feed post.

## Instagram Story Packet

- Upload 1080x1920 PNG frames in numeric order.
- Keep all headline text inside the 250px top and 250px bottom safe zones defined by the story skill.
- Recreate stickers in Instagram or Meta Business Suite; rendered PNGs should leave clear bands where stickers will sit.
- Link stickers need full URLs with UTM tags. No shortened links unless explicitly approved.
- Pin to a highlight only when the story remains useful after 24 hours.

## LinkedIn Cross-Post Packet

Instagram content should be adapted, not copied.

- Carousel: prefer native LinkedIn document upload when a PDF exists; otherwise use an image carousel if supported by the publishing surface.
- Story: convert to one professional image post or a short image carousel using the strongest proof/CTA frames. Remove IG-only sticker language or rewrite it as body copy.
- Opening line needs a clear point of view for a professional reader.
- Use 3-5 hashtags maximum.
- Do not put external links in the post body. Use `link in first comment` and write the first-comment copy in the packet.
- Best default window: Tuesday-Thursday, 8-9am WAT, unless the campaign plan says otherwise.

## Posting Order

1. Verify claim audit and assets.
2. Update `Publish Packet` status to `Ready to post`.
3. Publish Instagram feed/story first when it is the source format.
4. Publish LinkedIn second with adapted copy.
5. Paste live URLs back into the brief and mark platform status `Posted`.
6. Record early engagement notes in the brief only when they affect a follow-up decision.
