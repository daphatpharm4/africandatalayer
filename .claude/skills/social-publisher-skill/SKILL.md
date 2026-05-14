---
name: social-publisher-skill
description: Publish African Data Layer Instagram + LinkedIn posts produced by the carousel/story skills via the official Graph + Marketing APIs. Reads a publish.json manifest, validates env tokens, uploads assets to Vercel Blob, fans out to IG carousel/story/single + LinkedIn image/multi-image/document-carousel. Supports immediate (--now) and scheduled (--at) modes with idempotency, dry-run, and partial-failure handling.
---

# Social Publisher Skill (ADL)

## When to use

User asks to publish, post, or schedule an existing ADL social asset to Instagram or LinkedIn. Triggers include: "publish week5-post1", "post the carousel", "post the story", "schedule X for tomorrow 8am", "/publish ...". Assumes the carousel or story skill has already produced PNG assets + a `publish.json` manifest under `docs/marketing/assets/<slug>/`.

**Not for:** generating new content (use `instagram-carousel-skill` or `instagram-story-skill` first), TikTok / X / Threads, personal LinkedIn profile, multi-account fan-out beyond `adl_main` + `adl_org`.

## Required reads before publishing

1. `docs/superpowers/specs/2026-05-14-social-publisher-skill-design.md` — full design.
2. `.claude/skills/social-publisher-skill/reference/manifest-schema.md` — manifest contract.
3. `.claude/skills/social-publisher-skill/reference/accounts.json` — logical account → env var map.
4. `.claude/skills/social-publisher-skill/reference/auth-setup.md` — token bootstrap (only first time).
5. `.claude/skills/social-publisher-skill/reference/error-codes.md` — known errors + actions.

## Workflow

1. Resolve manifest path: `<slug>` shortcut → `docs/marketing/assets/<slug>/publish.json`, or accept explicit path.
2. Run pre-flight: `node .claude/skills/social-publisher-skill/scripts/publish.mjs --check`. Stop on failure.
3. First call against a manifest in a session → run `--dry-run` first, show user the resolved targets + payloads.
4. After user confirmation, run `--now` (immediate) or `--at <iso>` (scheduled).
5. On success, report per-target permalinks + any manual steps (IG story stickers) in ≤80 words. Save `result.json` is automatic — do not paste it in chat.
6. On failure (exit 4 partial, exit 2/3 hard) — surface the error block from result.json and the suggested retry command. Do not retry automatically.

## Rules

- **Pre-flight gate**: never invoke `--now` without first running `--check` in the session.
- **Confirmation gate**: first `--now` per session asks the user to confirm. Subsequent calls in the same session may skip confirmation.
- **Dry-run first**: for any new manifest, default to `--dry-run` before live posting.
- **Claim audit**: manifest must have `claimAudit: "passed"`. Refuse to publish otherwise.
- **No secret echo**: never print tokens, refresh tokens, or org URNs in chat output.
- **Manual step transparency**: when IG story sticker overlay is requested, the chat output must clearly list the manual app-side step the operator needs to take after publish.
- **Save, don't dump**: keep chat output ≤80 words. Logs land in `queue/logs/`.

## Reference

- Spec: `docs/superpowers/specs/2026-05-14-social-publisher-skill-design.md`
- Producer skills: `.claude/skills/instagram-carousel-skill/`, `.claude/skills/instagram-story-skill/`
- API docs: `reference/ig-graph-api.md`, `reference/linkedin-ugc-api.md`
