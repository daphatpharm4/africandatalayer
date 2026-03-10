import { query } from "./db.js";
import type { TrustTier } from "../../shared/types.js";

export const DEFAULT_TRUST_SCORE = 50;

export function normalizeTrustScore(input: unknown, fallback = DEFAULT_TRUST_SCORE): number {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getTrustTier(score: number): TrustTier {
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
