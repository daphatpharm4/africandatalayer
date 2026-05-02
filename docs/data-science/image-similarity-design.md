# Image-Similarity Verification — Design

Owner: data science  
Status: design approved, PR #1 (Stages A + B) pending implementation  
Last updated: 2026-05-02

## 1. Problem

ADL field agents submit geotagged photos across 7 verticals. The pipeline already runs EXIF/GPS heuristics plus a basic perceptual-hash pass. That pass has three concrete defects:

1. **Wrong hash family.** `computePerceptualHash` (`lib/server/submissionRisk.ts:194-217`) is **aHash** — 8×8 grayscale + mean threshold. The weakest perceptual hash; brittle to luminance shifts and JPEG re-encoding.
2. **Silent recall failure.** `getPerceptualHashMatches` (`lib/server/submissionRisk.ts:369-385`) is a `LIMIT 100` linear scan over the most-recent rows. As the corpus grows, older duplicates become unfindable and there is no telemetry to notice.
3. **No semantic layer.** Perceptual hashes do not catch crops, rotations, color shifts, or re-encodings that a human reviewer would call "the same photo."

Image-based dedup was deferred from the Capacitor cut (`docs/ops/fraud-review-capacitor.md`). This doc closes that gap as a layered system: **fix Stage A (hash) → add Stage B (embeddings) → tighten Stage C (policy) → close the loop with Stage D (evaluation)**. Each stage ships independently. PR #1 covers Stages A + B; Stages C + D follow once Stage B is producing data in production.

## 2. Existing implementation (verified against source)

| Piece | File / line | Notes |
|---|---|---|
| aHash compute | `lib/server/submissionRisk.ts:194-217` | 8×8 grayscale, mean threshold, 64-bit hex |
| Hamming distance | `lib/server/submissionRisk.ts:219-230` | per-nibble bit compare on hex strings |
| SHA256 exact-match lookup | `lib/server/submissionRisk.ts:352-367` | `getDuplicateImageMatches`, queries `submission_image_hashes` |
| pHash near-match lookup | `lib/server/submissionRisk.ts:369-385` | **`LIMIT 100` linear scan**, threshold Hamming ≤ 5 |
| Risk integration | `lib/server/submissionRisk.ts:747-760` | `photoRisk += 30` and `reviewFlags.add("perceptual_near_duplicate")` when match found at a *different* `pointId` |
| Insertion | `lib/server/submissionRisk.ts:814-834` | `INSERT INTO submission_image_hashes (event_id, point_id, user_id, sha256_hash, perceptual_hash)` |
| Schema | `supabase/migrations/20260305_fraud_analytics_foundation.sql:27-44` | `submission_image_hashes` table; unique on `event_id`, btree on `sha256_hash` and `user_id` |
| pHash index | `supabase/migrations/20260311_research_gap_closure.sql:11-14` | partial btree on `perceptual_hash WHERE NOT NULL` (not useful for Hamming search) |
| Risk score weighting | `lib/server/submissionRisk.ts:272-279` | 0.25 location, **0.25 photo**, 0.15 temporal, 0.20 user, 0.15 behavioral |
| Decision tiers | `lib/server/submissionRisk.ts:737, 765-775` | `riskScore ≥ 40` → pending review; `> 50` → escrow XP; `> 75` → deny XP |
| Function budget | `scripts/check-vercel-function-budget.mjs:4` | hard cap **13** (api routes + crons combined) |
| Cron slot in use | `vercel.json:6-9` | one cron: `/api/analytics?view=cron_dispatch` |
| Function timeout | `vercel.json:132-134` | 30 s on `api/**/*.ts` |
| Available ML deps | `package.json` | `sharp`, `exifr`, `@google/genai` (Gemini) — no pgvector client, no embedding lib |

## 3. Constraints

- **Function budget at cap.** No new cron endpoints; piggyback on the existing dispatch.
- **30 s function timeout.** Embedding inference must be **async post-write**, not inline (with a tightly-scoped sync fallback only when a high-confidence Stage A signal is already present).
- **18-month photo retention** (`docs/compliance/data-retention-policy.md`). Embeddings — not pixels — are the long-term artifact.
- **Offline queue stores base64 in IndexedDB.** Server is the only sane place to compute similarity.
- **Privacy.** Don't surface agent-to-agent linkage to end users; admin sees anonymized agent IDs (initials only).

## 4. Stage A — Harden the perceptual-hash layer (no new infra)

Goal: fix the recall bug and replace aHash with stronger hashes. Days, not weeks.

1. Replace `computePerceptualHash` with a **pHash** (DCT-based: 32×32 grayscale → DCT → 8×8 low-frequency block → median threshold) and add a parallel **dHash** (9×8 horizontal gradient). Both 64-bit, hex-encoded. Both via `sharp` only — no new deps.
2. Migration `<date>_image_similarity_v2.sql`:
   - `ALTER TABLE submission_image_hashes ADD COLUMN phash text, ADD COLUMN dhash text, ADD COLUMN hash_version smallint DEFAULT 2;`
   - Add 4×16-bit segment columns `phash_seg_0..3` (smallint each), each indexed.
   - Drop the unused partial index on the legacy `perceptual_hash` column; keep the column for backfill compat.
3. Lookup rewrite: `WHERE phash_seg_0 = $1 OR phash_seg_1 = $2 OR phash_seg_2 = $3 OR phash_seg_3 = $4`. By the pigeonhole principle, two 64-bit hashes within Hamming distance ≤ 8 share at least one identical 16-bit segment. The OR-on-indexed-smallints query gives a candidate set typically <500 rows, refined in-process with full 64-bit Hamming. This is the standard BK-tree alternative for fixed-bit hashes and gives effectively O(log N) lookup at our scale.
4. Multi-hash AND rule for higher precision: flag only when **pHash Hamming ≤ 8 AND dHash Hamming ≤ 6** (thresholds calibrated in Stage D). Single-hash hits become a soft signal (logged, not flagged).
5. Backfill: extend `cron_dispatch` to compute pHash/dHash for any rows with `hash_version < 2`, batch of 200/run.
6. **Remove the `LIMIT 100` correctness bug.**

New module: `lib/server/imageSimilarity.ts` — exports `computePhash`, `computeDhash`, `encodeSegments`, `findCandidatesByPhashSegments`, `scoreCandidate`. The legacy `computePerceptualHash` becomes a thin alias for backward compat during rollout.

## 5. Stage B — Semantic embedding layer with pgvector

Goal: catch crops, rotations, re-encodes, and color shifts that pHash misses.

### Embedding provider — **Vertex `multimodalembedding@001` (1408-d)**

- **Why:** the repo already authenticates Google services via `@google/genai`; latency ~300 ms p50; cost ~$0.0002/image; multimodal text+image space supports future "find similar by text query" features (already a product theme in `docs/ai-spatial-intelligence-reporting.md`).
- **Alternatives considered.** OpenAI has no native image embedding. Hugging Face Inference Endpoint for `openai/clip-vit-base-patch32` (512-d) is cheaper at scale but adds a vendor and an API token. Self-hosted Modal/Replicate with ONNX CLIP gives full control and EU residency but adds ops.
- **Data-residency escape hatch.** Vertex inference means photos leave the data plane. Flag for legal review before the first batch of real Cameroonian photos is sent; if blocked, fall back to self-hosted CLIP on Modal in EU region. The Stage B interface (`lib/server/imageEmbeddings.ts`) is provider-agnostic to make this swap cheap.

### Schema (in the same migration)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE submission_image_embeddings (
  event_id      uuid PRIMARY KEY REFERENCES point_events(id) ON DELETE CASCADE,
  embedding     vector(1408) NOT NULL,
  model_version text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sie_embedding_hnsw
  ON submission_image_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE submission_image_hashes
  ADD COLUMN embedding_status text DEFAULT 'pending'
    CHECK (embedding_status IN ('pending','done','failed','skipped'));
```

### Compute path (async, no new function slot)

- On submission write, set `embedding_status='pending'`.
- Existing cron `/api/analytics?view=cron_dispatch` (`vercel.json:6-9`) gains a sub-task that:
  1. Drains up to 50 pending rows per run.
  2. Re-fetches the photo bytes from `point_events.photo_url` (Vercel Blob), passes through `sharp` (resize to max edge 1024 px), calls Vertex.
  3. Persists the embedding, runs an ANN query, and post-hoc upgrades `reviewStatus` from `auto_approved` → `pending_review` if a high-confidence semantic dup is found within a defined post-write window (default 24 h).
- **Sync fallback.** If Stage A pHash already fires AND `riskScore` is in the kill-zone, run a single-image embedding inline (~300 ms) for confirmation before blocking. This bypass is gated by an env-driven kill switch.

ANN query:

```sql
SELECT event_id, 1 - (embedding <=> $1) AS sim
FROM submission_image_embeddings
WHERE event_id <> $2
ORDER BY embedding <=> $1
LIMIT 10;
```

New module: `lib/server/imageEmbeddings.ts` — Vertex client wrapper with retries and batching, plus the ANN query helper.

Touch: `api/analytics/index.ts` — extend `cron_dispatch` view to call the embedding drainer (no new function slot consumed).

## 6. Stage C — Decision policy

The current rule (`pointId !== input.pointId` → `+30 photoRisk`) is too coarse. Replace with a 2×2×time matrix:

| Same agent? | Same point? | Time gap | Decision |
|---|---|---|---|
| Yes | Yes | ≥ 7 days | Legitimate re-visit — **no flag, full XP** (positive presence signal) |
| Yes | Yes | < 7 days | Soft flag — **escrow XP** if any other risk component fires |
| Yes | No | any | Strong fraud — **block** (`duplicate_photo_cross_point`) |
| No  | Yes | < 24 h | Collusion suspicion — **always admin review, escrow XP** |
| No  | Yes | ≥ 24 h | Tolerate (two agents legitimately covered same site) — **soft flag, full XP** |
| No  | No  | any | Strong fraud — **block** |

Risk-score updates (replacing the current flat `+30`):

- Stage A only: `photoRisk += 25`.
- Stage B agrees (pHash AND embedding sim ≥ 0.92): `photoRisk += 50` (forces auto-block via the existing `> 75` threshold in `lib/server/submissionRisk.ts:769`).
- Stage B alone (pHash misses, embedding sim ≥ 0.95): `photoRisk += 35`, always pending_review.

**Admin UI.** Extend `components/Screens/AdminQueue.tsx` with a "Similar submissions" panel — top-3 nearest neighbors with thumbnails, similarity scores, anonymized agent IDs (initials only), time delta, and "approve / reject / mark legitimate re-visit" actions. The "mark legitimate re-visit" action writes a labeled pair into the eval store (Stage D).

**Telemetry.** Every decision logs `(eventId, sha256, pHash, dHash, embedding_top1_event_id, embedding_top1_sim, decision, rule_triggered)` into `fraud_audit_log` (table already exists, see `supabase/migrations/20260305_fraud_analytics_foundation.sql:58-78`).

## 7. Stage D — Evaluation harness and ongoing calibration

### Build the labeled set

- `scripts/build-similarity-eval-set.mjs`: pull pairs from `admin_reviews` joined with `submission_image_hashes` and `submission_image_embeddings`. Tag pairs as `duplicate`, `legitimate_revisit`, or `unrelated` from admin notes + reviewer action. Target 500 / 500 / 500 minimum.
- Cold-start substitute (until enough real labels exist): synthetic positives from JPEG re-encode (qualities 95→50), small crops (5–15 %), rotations (±5°), brightness shifts (±20 %). Synthetic negatives = random pairs from disjoint points.

### Calibrate

- `scripts/calibrate-similarity-thresholds.mjs`: ROC + PR for (a) pHash Hamming, (b) dHash Hamming, (c) embedding cosine, (d) the `(pHash AND dHash)` AND-rule, (e) the `(pHash AND embedding)` AND-rule.
- Operating point: hold **FPR ≤ 1 %** (legitimate re-visits flagged as fraud) at maximum TPR. This is the deliberate bias — false fraud accusations damage agent trust more than missed duplicates.
- Lock thresholds into `lib/server/imageSimilarity.ts` constants with the calibration date + dataset hash in a comment, so production behavior is reproducible.

### Monitor

- Sentry breadcrumb for every similarity decision; alert on inference failure rate > 1 %.
- Weekly Vercel cron emits a digest of threshold-zone submissions for human re-labeling. Re-calibrate quarterly.
- Embedding queue depth metric (cron logs `pending_count`); alert if > 200.

## 8. Privacy and compliance

- Embeddings are derived data, not PII. Retain beyond the 18-month photo TTL.
- Photos can be deleted on user request; the embedding row is kept (with `event_id` retained for audit) — confirm with `docs/compliance/data-retention-policy.md` before shipping.
- Do not surface "your photo matches user X" to agents. Admin sees anonymized agent IDs (initials).
- Vertex inference: photos leave the data plane. Confirm Cameroon data-residency story is acceptable; if not, fall back to self-hosted CLIP on Modal in EU region.

## 9. File map for execution

| Path | Action |
|---|---|
| `lib/server/imageSimilarity.ts` | **new** — pHash, dHash, segment encode/lookup, candidate refine |
| `lib/server/imageEmbeddings.ts` | **new** — Vertex multimodal client + ANN query |
| `lib/server/submissionRisk.ts` | **modify** — swap hash compute, replace lookup, add tiered policy logic, set `embedding_status='pending'` on insert |
| `supabase/migrations/<date>_image_similarity_v2.sql` | **new** — pHash/dHash columns + segments, pgvector extension, embeddings table + hnsw index, `embedding_status` column |
| `api/analytics/index.ts` | **modify** — extend `cron_dispatch` to drain embedding queue and pHash/dHash backfill |
| `components/Screens/AdminQueue.tsx` | **modify** (Stage C) — "Similar submissions" panel + "mark legitimate re-visit" action |
| `tests/imageSimilarity.test.ts` | **new** — determinism, segment encoding, AND-rule, threshold golden cases |
| `tests/submissionRisk.imageDup.test.ts` | **new** — policy matrix coverage |
| `scripts/build-similarity-eval-set.mjs` | **new** (Stage D) — assemble labeled pairs |
| `scripts/calibrate-similarity-thresholds.mjs` | **new** (Stage D) — ROC/PR + threshold picker |

## 10. Verification

1. `npm run typecheck && npm run lint && npm test` — unit tests green (hash determinism, segment encoding, policy matrix).
2. `npm run migrate:dry` then `npm run migrate` — schema applies cleanly; pgvector extension installs.
3. `npm run check:function-budget` — still ≤ 13.
4. Manual E2E:
   - Submit photo P1 to point A by user U1 → `auto_approved`.
   - Submit identical bytes (P1) to point B by user U1 → **block** with code `duplicate_photo_cross_point`.
   - Submit P1 cropped 10 % to point C by user U2 → Stage A misses, Stage B catches within cron tick → status flips to `pending_review`.
   - Submit P1 to point A by user U1 again ≥ 7 days later → no flag, full XP.
5. Calibration: `node scripts/calibrate-similarity-thresholds.mjs` → emits ROC/PR; confirm operating point at FPR ≤ 1 %, TPR ≥ 0.95 on the held-out set.
6. Production smoke: Sentry shows similarity decisions logged; cron `pending_count` drains; admin queue panel renders nearest neighbors.

## 11. Decisions

**Locked**

- **PR #1 scope.** Stages A + B together. Stages C and D follow in PR #2 once embeddings are flowing in production.
- **Embedding provider.** Vertex `multimodalembedding@001` (1408-d), via the existing `@google/genai` auth path. Self-hosted CLIP on Modal EU is the pre-tested escape hatch if data residency blocks Vertex.

**Deferred to PR #2**

1. **Cross-agent same-photo policy** — block outright vs. always admin-review with escrow. Default in PR #1 is admin-review-with-escrow (safer); the matrix in §6 re-opens this once calibration data exists.
2. **Doc location.** Currently in `docs/data-science/`; easy to move to `docs/ops/` if the team prefers it alongside the existing fraud docs.
