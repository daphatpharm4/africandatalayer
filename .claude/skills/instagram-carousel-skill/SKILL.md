---
name: instagram-carousel-skill
description: Produce and prepare publishing packets for African Data Layer Instagram carousels and LinkedIn document/image carousel cross-posts from docs/marketing — slide plan, bilingual captions (EN/FR), LinkedIn post copy, asset checklist, upload order, URLs/status, hashtags, story crosspost, claim audit against CLAUDE.md content guidelines.
---

# Instagram Carousel Skill (ADL)

## When to use

User asks to create, draft, plan, schedule, post, publish, or cross-post an Instagram carousel for African Data Layer. Applies to feed carousels (2–10 slides, 1080×1350) and LinkedIn native document/image carousel adaptations generated from the same source brief. Not for single-image posts, Reels-first, or non-ADL brands.

## Required reads before producing a post

1. `docs/marketing/social-media-launch-plan.md` — content calendar, claim rules, hashtag strategy, posting schedule.
2. `docs/marketing/social-publishing-workflow.md` — cross-platform publish packet, status, and URL capture rules.
3. `CLAUDE.md` — brand palette (navy/terra/forest/gold), anti-references, voice.
4. `.claude/skills/instagram-carousel-skill/reference/color-systems.md`
5. `.claude/skills/instagram-carousel-skill/reference/typography-pairings.md`
6. `.claude/skills/instagram-carousel-skill/reference/components-library.md`
7. `.claude/skills/instagram-carousel-skill/examples/carousel-captions.txt`

## Output contract

Write one markdown brief to `docs/marketing/instagram-week{N}-post{M}.md` containing:

- Header: date, slot (day + time WAT), format, series, companion cross-post references.
- Concept paragraph — why carousel fits the message.
- Slide plan table: slide number, background color, headline, supporting detail.
- Typography + dimensions (1080×1350, Inter weights).
- Caption EN (hook first 125 chars).
- Caption FR mirror (no accents that break IG search — use plain ASCII for tags).
- Hashtags — 10–15, mixed tier per `social-media-launch-plan.md`.
- Story crosspost (3 frames).
- LinkedIn crosspost — native document/image carousel title, post copy, first-comment link copy, 3–5 hashtags, and upload notes.
- Publish packet — Instagram fields, LinkedIn fields, asset paths, upload order, account/status fields, and post URL placeholders.
- Optional Reels cutdown.
- Success signals table — saves, shares, DM CTA hits, profile visits.
- Claim audit — each claim mapped to accuracy per CLAUDE.md rules.
- Asset checklist.

## Rules

- **Claim discipline**: only "verified", "ground truth", "fraud-resistant" — never "fraud-proof", never exact numbers, never accuracy %. See `docs/marketing/social-media-launch-plan.md` claim rules.
- **Anti-references hard stop**: no stock African imagery, no pin-drop heroes, no gradient fades, no NGO aesthetics, no SaaS dashboard clichés.
- **Bilingual parity**: every caption EN must have FR mirror. Keep DM CTA keyword short ("MAP" / "CARTE").
- **First-125-char hook**: IG feed truncates there. Hook must stand alone.
- **Accessibility**: alt text per slide. Min 44×44 touch CTA equivalents in visuals.
- **Slot conflict check**: read existing week's plan before assigning day — don't double-book Fri if already taken.
- **LinkedIn adaptation**: do not paste the IG caption directly. Rewrite for a professional reader with one clear point of view, shorter hashtag stack (3–5), and no external link in the body; put any link in first comment.
- **Posting truth**: if no authenticated publishing tool, browser session, or user-provided platform access is available, create a ready-to-post packet and say it is not posted yet. Only mark `Posted` when a platform/API returns a live URL.
- **Save, don't dump**: write brief to `docs/marketing/`, don't paste full brief in chat — summarize path + slot + hook.

## Workflow

1. Identify week (from current date vs plan start) and which IG slots are free.
2. Pick theme aligned with that week's plan row (Teaser / BTS / Recruit / Launch).
3. Draft slide plan — 5 slides default, 3 min, 7 max.
4. Write EN caption, mirror to FR.
5. Pull 10–15 hashtags from tier list.
6. Story + Reels extensions.
7. Claim audit.
8. Add LinkedIn crosspost + publish packet.
9. Save to `docs/marketing/instagram-week{N}-post{M}.md`.
10. Report path + slot + hook in chat (≤80 words).

## Publishing workflow

When user asks to post or publish an existing generated carousel:

1. Locate the source brief in `docs/marketing/` and the asset directory in `docs/marketing/assets/{slug}/`.
2. Confirm required assets exist: `slide-01.png` through final slide, optional FR variants, alt text, and any PDF export for LinkedIn native document upload.
3. Update or create the brief's `Publish Packet` section with:
   - Instagram feed: account, date/time WAT, slide upload order, caption EN/FR, hashtags, location, alt text, DM keyword, status, post URL.
   - LinkedIn: account/page, document title, post text, first-comment link copy, hashtags, upload asset path, status, post URL.
4. If a publishing tool/session is available and user requested posting, publish Instagram first, then LinkedIn. Capture live URLs immediately.
5. If publishing cannot be done from the current environment, leave status as `Ready to post`, keep all upload fields complete, and report the missing access/tool.

## Reference

Original Agency agent: `.claude/agents/marketing/marketing-instagram-curator.md`.
Carousel growth engine agent: `.claude/agents/marketing/marketing-carousel-growth-engine.md`.
