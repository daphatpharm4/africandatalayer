import { query } from "./db.js";
import type { TrustTier } from "../../shared/types.js";

export const DEFAULT_TRUST_SCORE = 50;

export function normalizeTrustScore(input: unknown, fallback = DEFAULT_TRUST_SCORE): number {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getTrustTier(score: number): TrustTier {
  if (score >= 90) return "elite";
  if (score >= 80) return "trusted";
  if (score <= 20) return "restricted";
  if (score <= 49) return "new";
  return "standard";
}

export async function updateUserTrust(input: {
  userId: string;
  delta?: number;
  setScore?: number;
  suspendedUntil?: string | null;
  wipeRequested?: boolean;
}): Promise<{ trustScore: number; trustTier: TrustTier; suspendedUntil: string | null; wipeRequested: boolean }> {
  const current = await query<{
    trust_score: number | null;
    suspended_until: string | null;
    wipe_requested: boolean | null;
  }>(
    `SELECT trust_score, suspended_until, wipe_requested
     FROM user_profiles
     WHERE id = $1
     LIMIT 1`,
    [input.userId.toLowerCase().trim()],
  );

  const row = current.rows[0];
  const nextTrustScore = normalizeTrustScore(
    input.setScore ?? normalizeTrustScore(row?.trust_score, DEFAULT_TRUST_SCORE) + (input.delta ?? 0),
  );
  const trustTier = getTrustTier(nextTrustScore);
  const suspendedUntil = input.suspendedUntil === undefined ? row?.suspended_until ?? null : input.suspendedUntil;
  const wipeRequested = input.wipeRequested === undefined ? row?.wipe_requested === true : input.wipeRequested;

  await query(
    `UPDATE user_profiles
     SET trust_score = $2,
         trust_tier = $3,
         suspended_until = $4::timestamptz,
         wipe_requested = $5
     WHERE id = $1`,
    [input.userId.toLowerCase().trim(), nextTrustScore, trustTier, suspendedUntil, wipeRequested],
  );

  return { trustScore: nextTrustScore, trustTier, suspendedUntil, wipeRequested };
}

export async function getTrustTierWithStats(userId: string): Promise<TrustTier> {
  const result = await query<{ trust_score: number | null; total_approved: number }>(
    `SELECT
       up.trust_score,
       COALESCE((
         SELECT COUNT(*)::int FROM admin_reviews ar
         JOIN point_events pe ON pe.id = ar.event_id
         WHERE pe.user_id = $1 AND ar.decision = 'approved'
       ), 0) AS total_approved
     FROM user_profiles up
     WHERE up.id = $1
     LIMIT 1`,
    [userId.toLowerCase().trim()],
  );
  const row = result.rows[0];
  if (!row) return "new";
  const score = normalizeTrustScore(row.trust_score);
  if (score >= 85 && row.total_approved >= 50) return "elite";
  return getTrustTier(score);
}

export async function adjustTrustOnReview(input: {
  userId: string;
  decision: "approved" | "rejected" | "flagged";
}): Promise<{ trustScore: number; trustTier: TrustTier }> {
  let delta: number;
  if (input.decision === "approved") {
    // Check consecutive clean submissions
    let consecutiveClean = 0;
    try {
      const recent = await query<{ decision: string }>(
        `SELECT ar.decision
         FROM admin_reviews ar
         JOIN point_events pe ON pe.id = ar.event_id
         WHERE pe.user_id = $1
         ORDER BY ar.reviewed_at DESC
         LIMIT 20`,
        [input.userId.toLowerCase().trim()],
      );
      for (const row of recent.rows) {
        if (row.decision === "approved") consecutiveClean++;
        else break;
      }
    } catch {
      consecutiveClean = 0;
    }
    delta = consecutiveClean > 10 ? 2 : 1;
  } else if (input.decision === "rejected") {
    delta = -15;
  } else {
    delta = -5;
  }

  const result = await updateUserTrust({ userId: input.userId, delta });
  return { trustScore: result.trustScore, trustTier: result.trustTier };
}

export async function decayInactiveTrust(): Promise<{ usersDecayed: number }> {
  const inactive = await query<{ id: string }>(
    `SELECT up.id
     FROM user_profiles up
     WHERE up.trust_score > 0
       AND NOT EXISTS (
         SELECT 1 FROM point_events pe
         WHERE pe.user_id = up.id
           AND pe.created_at > NOW() - INTERVAL '30 days'
       )
       AND EXISTS (
         SELECT 1 FROM point_events pe2
         WHERE pe2.user_id = up.id
       )`,
  );

  let decayed = 0;
  for (const row of inactive.rows) {
    await updateUserTrust({ userId: row.id, delta: -1 });
    decayed++;
  }
  return { usersDecayed: decayed };
}
