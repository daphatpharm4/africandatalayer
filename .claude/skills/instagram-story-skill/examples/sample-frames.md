# Sample Brief — Launch Echo Story (Reference)

Reference brief for new users of `instagram-story-skill`. Mirror the structure for real stories.

---

# Instagram Story — Week 4 Launch Echo

**Date:** 2026-05-04
**Slot:** Monday 2026-05-04, 7:30pm WAT (immediately after feed launch carousel)
**Format:** Story sequence (5 frames, 1080×1920)
**Series:** Week 4 — Launch row · story crosspost
**Parent post:** `docs/marketing/instagram-week4-post1.md` (feed launch carousel)

---

## Concept

5-frame story echoing the launch carousel for the audience that consumes stories first, feed second. Frame 1 hooks; 2 proves with offline-first; 3 collects audience signal via poll; 4 drives link tap to download; 5 closes with DM keyword fallback.

---

## Frame Plan

| # | Archetype | Background | Headline | Sticker plan | Safe-zone notes |
|---|-----------|-----------|----------|--------------|-----------------|
| 1 | Hook | Navy `#0f2b46` | "ADL is live on mobile." | None | Headline y=600–900 |
| 2 | Proof | Forest-wash `#eaf1ec` | "Offline-first queue. No data lost." | Hashtag `#GroundTruth` y=320 | Body y=320–1000 |
| 3 | Poll | Navy-wash `#f2f6fa` | "Will you map your quartier this week?" | Poll 2-option (Oui / Yes) y=1100 | Headline y=600–950, poll fills 1100–1420 |
| 4 | Link | Terra `#c86b4a` | "Tap below to download." | Link sticker y=1500 ("Tap to download") | Arrow at y=1380 points to sticker |
| 5 | CTA | Navy `#0f2b46` | "Need help? DM 'MAP' or 'CARTE'." | Mention `@africandatalayer` y=320 | CTA pill y=1500 |

## Typography + Dimensions

- 1080×1920, deviceScaleFactor 2.
- Inter 700 headlines (60–104pt), Inter 500 body (24–28pt), Inter 700 uppercase 14pt for micro-labels and stamp.
- Top safe zone 250px (avatar/handle/timer overlap). Bottom safe zone 250px (reply bar).
- Hero band 250–1670px holds all critical text.

## Copy EN per frame

- Frame 1: "ADL is live on mobile."
- Frame 2: "Offline-first queue. Captures hold until signal returns. No data lost."
- Frame 3: "Will you map your quartier this week?" (poll: "Yes, this week" / "Soon")
- Frame 4: "Tap below to download. Native app. Same verified data."
- Frame 5: "Need help with your first capture? DM 'MAP' (English) or 'CARTE' (French)."

## Copy FR mirror per frame

- Frame 1: « ADL est en ligne sur mobile. »
- Frame 2: « File hors-ligne. Les captures attendent le retour du signal. Aucune donnee perdue. »
- Frame 3: « Allez-vous cartographier votre quartier cette semaine ? » (poll : « Oui, cette semaine » / « Bientot »)
- Frame 4: « Tapez ci-dessous pour telecharger. App native. Memes donnees verifiees. »
- Frame 5: « Besoin d'aide pour votre premiere capture ? DM « CARTE » ou « MAP ». »

## Sticker stack

| Frame | Stickers |
|-------|----------|
| 1 | None |
| 2 | Hashtag #GroundTruth (small, top of hero band) |
| 3 | Poll 2-option |
| 4 | Link sticker → app store landing with UTM `utm_source=instagram&utm_medium=story&utm_campaign=launch_w4` |
| 5 | Mention `@africandatalayer` |

## Hashtag overlay

`#AfricanDataLayer` on frame 2 only (small, navy 40% opacity). Stories don't reward hashtag stuffing.

## Link CTA

- Frame 4 carries the link sticker.
- Destination: launch landing page with App Store + Play Store split.
- UTM: `utm_source=instagram&utm_medium=story&utm_campaign=launch_w4&utm_content=frame4`

## DM keyword reply

Auto-reply armed for "MAP" + "CARTE" via Meta Business Suite — first-capture walkthrough message.

## Posting plan

- Order: 1 → 2 → 3 → 4 → 5, posted in single batch.
- Hold time: 5s frames 1, 4, 5 · 7s frame 2 (denser text) · 15s frame 3 (poll) · 5s default for the rest.
- Pin to highlight: yes, "LAUNCH" highlight (covers frame 1).

## Success signals (check Tue 2026-05-05)

| Frame | Metric | Target | Floor |
|-------|--------|--------|-------|
| 1 | Tap-forward rate | <40% (good = audience watching) | <60% |
| 2 | Tap-forward rate | <50% | <70% |
| 3 | Sticker tap (poll vote) | 80+ votes | 25+ |
| 4 | Link sticker tap | 60+ | 20+ |
| 5 | DMs with "MAP" or "CARTE" | 15+ | 5+ |
| All | Story completion (frame 5 view rate) | >35% of frame 1 viewers | >20% |

## Claim audit

- ✅ "Live on mobile" — accurate Mon AM (verify with eng before posting).
- ✅ "Offline-first queue" — accurate per `lib/client/offlineQueue.ts`.
- ✅ "Captures hold until signal returns" — accurate.
- ✅ "Verified data" — accurate.
- ❌ No exact submission counts.
- ❌ No accuracy percentage.
- ❌ No real agent identity.
- ⚠️ Pre-flight: confirm app-store live status before posting.

## Asset checklist

- [ ] 5× 1080×1920 frame PNGs (EN)
- [ ] 5× 1080×1920 frame PNGs (FR)
- [ ] Build scripts: `build-frames.mjs` + `build-frames-fr.mjs`
- [ ] DM keyword auto-reply armed
- [ ] Link sticker UTM tested
- [ ] Highlight cover ready
- [ ] Render command ran cleanly:
      ```
      node .claude/skills/instagram-story-skill/scripts/render-story.mjs \
        docs/marketing/assets/story-week4-launch-echo/frames.json \
        docs/marketing/assets/story-week4-launch-echo
      ```
