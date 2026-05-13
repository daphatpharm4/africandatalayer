# Instagram — Week 5, Post 2 (Why We Built the Queue First)

**Date:** 2026-05-11
**Slot:** Thursday 2026-05-14, 6:30pm WAT
**Format:** Carousel (5 slides, 1080×1350)
**Series:** Week 5 — Post-launch reset · agent-thesis slot · proof-of-feature
**Companion same-week:** Tue 2026-05-12 IG post-launch · Fri 2026-05-15 IG FFF #04 · Sat 2026-05-16 IG community
**Cross-post:** Mirrors wk1 Twitter offline-first thread — IG carries the post-launch proof beat

---

## Concept

The wk1 promise ("we built the queue first, not last") now has a launched app behind it. Five slides re-center the offline-first thesis, name the failure modes it absorbs (2G dead zones, switched-off radios, bus tunnels, low-battery mode), and close on agent-respect framing — the queue exists because the field is honest work, not because engineering wanted a feature.

**Why carousel:** Step-by-step "what happens when signal drops" reads better paced than a single hero. Each slide owns one failure mode + one resolution.

**Why now:** Thu agent slot. Audience that didn't engage with wk1 abstract messaging will respond to post-launch proof framing.

---

## Slide Plan

| # | Background | Headline | Supporting detail |
|---|-----------|----------|-------------------|
| 1 | Navy + gold stamp + terra corner | We built the queue first, not last. | Hook headline — Inter 700 ~96pt navy-wash. Terra accent on second line. |
| 2 | Navy-wash + signal icon | 2G one street. Nothing the next. | Body: "Connectivity in Douala is honest work. The queue holds your submissions until you're back online." |
| 3 | Navy-wash + clock icon | No re-entries. No data lost. | Body: "Up to 75 captures stored on device. 72-hour TTL. Auto-sync the moment you reconnect." |
| 4 | Navy-wash + battery icon | Battery low. Signal off. Work continues. | Body: "Idempotency keys prevent duplicate sync. Six retry windows before a submission asks for review." |
| 5 | Terra CTA + gold micro | Field-first means field-real. | CTA pill: `DM "MAP" to join`. Sub: "Bonamoussadi · Douala · Cameroon onward". |

---

## Typography + Dimensions

Same grid as wk5-post1: 1080×1350, Inter 700/500/400, slide padding 80, navy/navy-wash/terra accent rotation.

---

## Caption — EN

We built the queue first, not last.

Connectivity in Douala is honest work — 2G one street, nothing the next. So your captures save on device, hold up to 72 hours, and sync the moment you're back online. Idempotency keys block duplicates. Six retries before a submission asks for review.

Field-first means field-real. The map doesn't punish you for the network.

Field agents in Douala — beta is open. Drop "MAP" in the comments or in DM.

---

## Caption — FR

On a construit la file d'attente en premier, pas en dernier.

La connectivite a Douala, c'est un travail honnete — 2G dans une rue, rien dans la suivante. Vos captures restent sur le telephone, jusqu'a 72 heures, et se synchronisent au retour du reseau. Les cles d'idempotence bloquent les doublons. Six tentatives avant qu'une soumission demande une revue.

Terrain d'abord, reellement. La carte ne te punit pas pour le reseau.

Agents de terrain a Douala — la beta est ouverte. Ecrivez CARTE en commentaire ou en message prive.

---

## Hashtags

#AfricanDataLayer #ADL #OfflineFirst #FieldData #GroundTruth #Douala #Bonamoussadi #Cameroon #MadeInCameroon #MobileFirst #DataInfrastructure #UrbanMapping

---

## Story Crosspost (3 frames)

| # | Background | Visual + copy |
|---|-----------|---------------|
| 1 | Navy + gold stamp | "Queue first / File d'attente d'abord." Inter 700 64pt navy-wash. |
| 2 | Navy-wash | Stat tile mock: `OFFLINE QUEUE · 75 ITEMS · 72H TTL · 6 RETRIES`. No counts of real submissions. |
| 3 | Terra | DM sticker `MAP / CARTE` + link sticker. CTA "Field-first / Terrain d'abord". |

---

## Reels Cutdown (optional, ≤9s)

Five 1.5s cuts mirroring slide order. Audio: low-BPM instrumental.

---

## Success Signals

| Metric | Target | Why |
|--------|--------|-----|
| Saves | ≥ 1.3× wk5-post1 | Technical-thesis posts save high in dev/data audience |
| Comments | ≥ 1.0× wk5-post1 | Specifics invite "does it really" replies — answer in thread |
| DM "MAP"/"CARTE" hits | ≥ 1.0× wk5-post1 | Recruit signal |
| Profile visits | ≥ 1.0× wk5-post1 | Proof framing pulls bio click |

---

## Claim Audit

| Claim | Source / accuracy |
|-------|-------------------|
| "Queue first, not last" | Accurate per `lib/client/offlineQueue.ts` |
| "75 items, 72h TTL, 6 retries" | Accurate per `lib/client/offlineQueue.ts` constants + CLAUDE.md tech stack section |
| "Idempotency keys block duplicates" | Accurate per offline queue impl |
| "Beta is open" Douala | Accurate per wk4 launch posts |
| No exact submission count, no agent count | Compliant with claim rules |
| No real agent name or photo | Compliant — typography only |

---

## Asset Checklist

- [ ] 5 carousel slides 1080×1350 PNG (EN + FR)
- [ ] 3 story frames 1080×1920 PNG
- [ ] Optional Reels MP4 ≤9s
- [ ] Alt text per slide (EN + FR)
- [ ] DM auto-reply rule — keyword `MAP` / `CARTE`
- [ ] Schedule confirmed Thu 2026-05-14 6:30pm WAT
