import { query } from "./db.js";
import { computeDhash, computePhash, encodeSegments, isMissingDbObjectError } from "./imageSimilarity.js";
import {
  EMBEDDING_SOFT_DUP_SIM,
  findSimilarEmbeddings,
  getEmbeddingProvider,
  markEmbeddingStatus,
  persistEmbedding,
} from "./imageEmbeddings.js";

// Each item costs a Blob fetch + two sharp passes + a couple of queries
// (~1-2s), and both drains share one 30s cron function with five other
// jobs. Batch sizes stay small and a wall-clock budget stops the loops
// early; leftovers are picked up by the next daily tick.
const EMBED_BATCH_SIZE = Number(process.env.IMAGE_EMBEDDING_BATCH ?? "10") || 10;
const BACKFILL_BATCH_SIZE = Number(process.env.IMAGE_HASH_BACKFILL_BATCH ?? "25") || 25;
const TIME_BUDGET_MS = Number(process.env.IMAGE_CRON_BUDGET_MS ?? "20000") || 20000;
const STATUS_UPGRADE_WINDOW_HOURS = Number(process.env.IMAGE_EMBEDDING_UPGRADE_WINDOW_HOURS ?? "24") || 24;
const MAX_EDGE_PX = 1024;

export interface ImageSimilarityDrainResult {
  backfill: { scanned: number; updated: number; failed: number; outOfBudget: boolean };
  embeddings: {
    scanned: number;
    embedded: number;
    failed: number;
    skippedNoProvider: boolean;
    statusUpgrades: number;
    outOfBudget: boolean;
  };
}

async function resizedJpeg(imageBuffer: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return await sharp(imageBuffer)
    .resize(MAX_EDGE_PX, MAX_EDGE_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function fetchPhotoBytes(photoUrl: string): Promise<Buffer> {
  const response = await fetch(photoUrl);
  if (!response.ok) throw new Error(`fetch ${photoUrl} failed: ${response.status}`);
  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function upgradeReviewStatusIfDuplicate(
  eventId: string,
  similarities: Array<{ eventId: string; similarity: number }>,
  threshold: number,
): Promise<boolean> {
  if (!similarities.some((s) => s.similarity >= threshold)) return false;
  const result = await query(
    `UPDATE point_events
     SET details = jsonb_set(
       COALESCE(details, '{}'::jsonb),
       '{reviewStatus}',
       '"pending_review"'::jsonb,
       true
     )
     WHERE id = $1::uuid
       AND details->>'reviewStatus' = 'auto_approved'
       AND created_at > NOW() - make_interval(hours => $2::int)`,
    [eventId, STATUS_UPGRADE_WINDOW_HOURS],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function runHashBackfill(deadline: number): Promise<ImageSimilarityDrainResult["backfill"]> {
  let result;
  try {
    result = await query<{ event_id: string; photo_url: string | null }>(
      `SELECT sih.event_id::text, pe.photo_url
       FROM submission_image_hashes sih
       JOIN point_events pe ON pe.id = sih.event_id
       WHERE sih.hash_version < 2
         AND pe.photo_url IS NOT NULL
       ORDER BY sih.created_at DESC
       LIMIT $1`,
      [BACKFILL_BATCH_SIZE],
    );
  } catch (error) {
    // Migration not applied yet: report a clean no-op instead of failing
    // the whole cron_dispatch response.
    if (isMissingDbObjectError(error)) return { scanned: 0, updated: 0, failed: 0, outOfBudget: false };
    throw error;
  }

  let updated = 0;
  let failed = 0;
  let outOfBudget = false;
  for (const row of result.rows) {
    if (Date.now() >= deadline) {
      outOfBudget = true;
      break;
    }
    if (!row.photo_url) continue;
    try {
      const bytes = await resizedJpeg(await fetchPhotoBytes(row.photo_url));
      const [phash, dhash] = await Promise.all([computePhash(bytes), computeDhash(bytes)]);
      if (!phash) {
        failed += 1;
        continue;
      }
      const segs = encodeSegments(phash);
      await query(
        `UPDATE submission_image_hashes
         SET phash = $2,
             dhash = $3,
             hash_version = 2,
             phash_seg_0 = $4,
             phash_seg_1 = $5,
             phash_seg_2 = $6,
             phash_seg_3 = $7,
             perceptual_hash = COALESCE(perceptual_hash, $2),
             embedding_status = CASE WHEN embedding_status = 'skipped' THEN 'pending' ELSE embedding_status END
         WHERE event_id = $1::uuid`,
        [row.event_id, phash, dhash, segs?.[0] ?? null, segs?.[1] ?? null, segs?.[2] ?? null, segs?.[3] ?? null],
      );
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error("[imageSimilarityCron] backfill failed", row.event_id, error);
    }
  }
  return { scanned: result.rowCount ?? 0, updated, failed, outOfBudget };
}

export async function runEmbeddingDrain(deadline: number): Promise<ImageSimilarityDrainResult["embeddings"]> {
  const provider = getEmbeddingProvider();
  if (!provider) {
    return { scanned: 0, embedded: 0, failed: 0, skippedNoProvider: true, statusUpgrades: 0, outOfBudget: false };
  }

  let result;
  try {
    result = await query<{
      event_id: string;
      photo_url: string | null;
      phash: string | null;
    }>(
      `SELECT sih.event_id::text, pe.photo_url, sih.phash
       FROM submission_image_hashes sih
       JOIN point_events pe ON pe.id = sih.event_id
       WHERE sih.embedding_status = 'pending'
         AND pe.photo_url IS NOT NULL
       ORDER BY sih.created_at ASC
       LIMIT $1`,
      [EMBED_BATCH_SIZE],
    );
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      return { scanned: 0, embedded: 0, failed: 0, skippedNoProvider: false, statusUpgrades: 0, outOfBudget: false };
    }
    throw error;
  }

  let embedded = 0;
  let failed = 0;
  let statusUpgrades = 0;
  let outOfBudget = false;

  for (const row of result.rows) {
    if (Date.now() >= deadline) {
      outOfBudget = true;
      break;
    }
    if (!row.photo_url) {
      await markEmbeddingStatus(row.event_id, "skipped");
      continue;
    }
    try {
      const resized = await resizedJpeg(await fetchPhotoBytes(row.photo_url));
      const vector = await provider.embedImage(resized);
      await persistEmbedding(row.event_id, vector, provider.modelVersion);

      // Run ANN to detect post-write semantic duplicates.
      const similar = await findSimilarEmbeddings(vector, row.event_id, 5);
      // pHash-misses-but-embedding-hits → use the higher (soft) threshold.
      // The Stage-A-already-fired path is handled inline at submission time;
      // here we only catch the cases Stage A missed.
      const upgraded = await upgradeReviewStatusIfDuplicate(
        row.event_id,
        similar,
        EMBEDDING_SOFT_DUP_SIM,
      );
      if (upgraded) statusUpgrades += 1;

      await markEmbeddingStatus(row.event_id, "done");
      embedded += 1;
    } catch (error) {
      failed += 1;
      console.error("[imageSimilarityCron] embed failed", row.event_id, error);
      try {
        await markEmbeddingStatus(row.event_id, "failed");
      } catch {
        // best-effort
      }
    }
  }

  return {
    scanned: result.rowCount ?? 0,
    embedded,
    failed,
    skippedNoProvider: false,
    statusUpgrades,
    outOfBudget,
  };
}

export async function runImageSimilarityDrain(): Promise<ImageSimilarityDrainResult> {
  const deadline = Date.now() + TIME_BUDGET_MS;
  const [backfill, embeddings] = await Promise.all([runHashBackfill(deadline), runEmbeddingDrain(deadline)]);
  return { backfill, embeddings };
}

