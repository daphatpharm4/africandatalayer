---
name: instagram-story-skill
description: Produce and prepare publishing packets for African Data Layer Instagram stories / vertical assets at 1080×1920 (9:16), plus LinkedIn vertical/image post adaptations from docs/marketing — frame plan, bilingual copy (EN/FR), interactive sticker plan, LinkedIn copy, link CTA, upload order, URLs/status, claim audit against CLAUDE.md content guidelines.
---

# Instagram Story Skill (ADL)

## When to use

User asks to create, draft, plan, schedule, post, publish, or cross-post an Instagram **story** (24h ephemeral) **or** vertical 9:16 post for African Data Layer at **1080×1920**. Applies to:

- Story sequences (1–10 frames, ephemeral)
- Story highlights (pinned, evergreen)
- Reels covers (single 9:16 frame)
- Vertical single-image posts to feed (9:16 ratio)
- LinkedIn vertical/image post adaptations from story frames

**Not for:** 1080×1350 carousels (use `instagram-carousel-skill`), Reels video edits (use Short-Video Editing Coach), non-ADL brands.

## Required reads before producing a frame set

1. `docs/marketing/social-media-launch-plan.md` — content calendar, claim rules, hashtag strategy, posting schedule.
2. `docs/marketing/social-publishing-workflow.md` — cross-platform publish packet, status, and URL capture rules.
3. `CLAUDE.md` — brand palette (navy/terra/forest/gold), anti-references, voice.
4. `.claude/skills/instagram-story-skill/reference/safe-zones.md` — IG story safe areas (avatar overlap top, action bar bottom).
5. `.claude/skills/instagram-story-skill/reference/story-anatomy.md` — frame archetypes (hook / proof / CTA / poll / question).
6. `.claude/skills/instagram-story-skill/reference/base-template.md` — reusable HTML scaffold.
7. `.claude/skills/instagram-carousel-skill/reference/color-systems.md` — shared brand color tokens.
8. `.claude/skills/instagram-carousel-skill/reference/typography-pairings.md` — shared Inter pairings.
9. `.claude/skills/instagram-story-skill/examples/sample-frames.md` — completed example brief.

## Output contract

Write one markdown brief to `docs/marketing/instagram-story-week{N}-{slug}.md` containing:

- Header: date, slot (day + time WAT), format (story / reels-cover / vertical-feed), series, parent post reference (if amplifying a feed/carousel post).
- Concept paragraph — why story format fits the message.
- Frame plan table: frame number, archetype (hook / proof / poll / question / link / CTA), background color, headline, sticker plan, safe-zone notes.
- Typography + dimensions (1080×1920, Inter weights, top safe-zone 250px, bottom safe-zone 250px).
- Copy EN per frame.
- Copy FR mirror per frame (plain ASCII for any tag/handle text).
- Sticker stack — polls, quizzes, questions, link, location, music, mention, hashtag (max 10 stickers per frame to stay under IG limit).
- Hashtag overlay (1–3 max for stories, hidden via shrink/color trick if needed).
- Link CTA: which frame carries the link sticker, where it points, UTM tag.
- DM keyword reply armed (e.g. "MAP", "CARTE").
- LinkedIn adaptation — professional post copy, selected frame(s), first-comment link copy, 3–5 hashtags, and upload notes.
- Publish packet — Instagram story fields, LinkedIn fields, asset paths, upload order, account/status fields, and post URL placeholders.
- Posting plan: order, hold time per frame (5s default, 7s for high-density text), pin to highlight (yes/no + which highlight).
- Success signals table — frame-by-frame tap-forward / tap-back / exit / sticker tap / link tap.
- Claim audit — each claim mapped to accuracy per CLAUDE.md rules.
- Asset checklist + render command.

**Also emit a publishing manifest**: write `docs/marketing/assets/story-week<N>-<slug>/publish.json` conforming to `.claude/skills/social-publisher-skill/reference/manifest-schema.md`. The manifest must include:

- An `instagram` / `story` target with `account: "adl_main"`, `assets[]` matching the rendered frame PNG filenames in order, optional `linkSticker` (frame index + URL + display text — translated to a manual step by the publisher), and `altText[]`.
- If the story is amplifying a feed post AND the operator wants a LinkedIn cross-post, also include a `linkedin` / `image` or `multi-image` target with `account: "adl_org"`, a `title`, and a `commentary`.
- `claimAudit: "passed"` ONLY after the claim audit step succeeds.
- `createdBy: "instagram-story-skill@<today>"`.
- Schedule defaults to `mode: "now"`.

## Build + render workflow

Same pattern as carousel skill — diverge only on dimensions and renderer:

1. Create asset dir: `docs/marketing/assets/story-week{N}-{slug}/`
2. Write `build-frames.mjs` (EN) and `build-frames-fr.mjs` (FR) producing `frames.json` / `frames-fr.json`.
3. Each entry: `{ id: "01", html: "<full html doc>" }`. HTML body sized 1080×1920.
4. Render: `node .claude/skills/instagram-story-skill/scripts/render-story.mjs <frames-json> <out-dir>`
5. Output PNGs land at `<out-dir>/frame-NN.png` (EN) and `frame-NN-fr.png` (FR).

Renderer hard-coded to 1080×1920 viewport, deviceScaleFactor 2.

## Rules

- **Dimensions locked**: 1080×1920 only. Do not adapt for 1080×1350 — use carousel skill instead.
- **Safe zones**: top 250px overlapped by IG handle/avatar/timer; bottom 250px overlapped by reply bar + send arrow + close-friends ring. Hero text stays in middle 1420px band.
- **Sticker collision**: poll/quiz stickers expand vertically — leave 320px clear band in lower-mid where stickers will land. Mark expected sticker zone in frame plan.
- **Hook in first 1.5s**: viewer taps forward on second 2 if frame 1 hasn't earned attention. Headline + visual anchor must read at glance.
- **Claim discipline**: only "verified", "ground truth", "fraud-resistant" — never "fraud-proof", never exact numbers, never accuracy %. Same as carousel skill.
- **Anti-references hard stop**: no stock African imagery, no pin-drop heroes, no gradient fades, no NGO aesthetics, no SaaS dashboard cliches.
- **Bilingual parity**: every frame EN must have FR mirror. Plain ASCII for any text rendered onto the image (avoid accents that break IG OCR search).
- **Accessibility**: alt text per frame. Min 60px text height for body copy on 1080×1920 (story viewing distance is closer than feed).
- **Slot conflict check**: read existing week's plan before assigning slot — stories typically run alongside a feed/carousel post, not as standalone.
- **LinkedIn adaptation**: stories do not map 1:1 to LinkedIn. Convert the frame sequence into either a single image post using the strongest proof/CTA frame or a short image carousel with professional copy. No interactive IG sticker language unless rewritten as text.
- **Posting truth**: if no authenticated publishing tool, browser session, or user-provided platform access is available, create a ready-to-post packet and say it is not posted yet. Only mark `Posted` when a platform/API returns a live URL.
- **Save, don't dump**: write brief to `docs/marketing/`, don't paste full brief in chat — summarize path + slot + hook frame headline.

## Workflow

1. Identify week (from current date vs plan start) and which story slot is free or amplifying which feed post.
2. Pick story archetype: launch echo / poll harvest / quiz / link drive / countdown / behind-the-scenes / community share.
3. Draft frame plan — 5 frames default, 3 min, 10 max. Each frame names archetype + sticker.
4. Write EN copy per frame, mirror to FR.
5. Map sticker stack + link CTA + DM keyword.
6. Add LinkedIn adaptation + publish packet.
7. Write `build-frames.mjs` + `build-frames-fr.mjs`.
8. Render PNGs via `scripts/render-story.mjs`.
9. Save brief to `docs/marketing/instagram-story-week{N}-{slug}.md`.
10. Write `docs/marketing/assets/story-week<N>-<slug>/publish.json` with the IG story target (and optional LinkedIn target if requested).
11. Tell the user the manifest path and remind them to publish via the `social-publisher-skill` (do NOT publish from this skill). Note any link-sticker frames as a manual post-publish step.
12. Report path + slot + first-frame hook in chat (≤80 words).

## Publishing workflow

When user asks to post or publish an existing generated story:

1. Locate the source brief in `docs/marketing/` and the asset directory in `docs/marketing/assets/story-week{N}-{slug}/`.
2. Confirm required assets exist: `frame-01.png` through final frame, optional FR variants, sticker copy, link targets, and alt text.
3. Update or create the brief's `Publish Packet` section with:
   - Instagram story: account, date/time WAT, frame upload order, sticker positions, link sticker URL, highlight target, status, story URL or highlight URL.
   - LinkedIn: account/page, selected frame(s), post text, first-comment link copy, hashtags, upload asset path, status, post URL.
4. If a publishing tool/session is available and user requested posting, publish Instagram first, then LinkedIn. Capture live URLs immediately.
5. If publishing cannot be done from the current environment, leave status as `Ready to post`, keep all upload fields complete, and report the missing access/tool.

## Reference

- Carousel sibling skill: `.claude/skills/instagram-carousel-skill/SKILL.md` (use for 1080×1350 feed carousels).
- Renderer reuse: identical pattern to `scripts/render-ig-carousel.mjs`, with viewport swapped to 1080×1920.
