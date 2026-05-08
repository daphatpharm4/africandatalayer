import { createHash, randomBytes } from "node:crypto";
import { query } from "../db.js";

export const RESET_TOKEN_TTL_MINUTES = 30;
const RESET_TOKEN_BYTES = 32;

export interface IssuedResetToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ResetTokenRecord {
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateResetToken(): IssuedResetToken {
  const token = randomBytes(RESET_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  return { token, tokenHash, expiresAt };
}

export async function persistResetToken(params: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipHash: string | null;
  userAgent: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO public.password_reset_tokens
       (token_hash, user_id, expires_at, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.tokenHash, params.userId, params.expiresAt.toISOString(), params.ipHash, params.userAgent],
  );
}

export async function findActiveResetToken(rawToken: string): Promise<ResetTokenRecord | null> {
  const tokenHash = hashResetToken(rawToken);
  const result = await query<{ user_id: string; expires_at: string; used_at: string | null }>(
    `SELECT user_id, expires_at, used_at
     FROM public.password_reset_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    expiresAt: new Date(row.expires_at),
    usedAt: row.used_at ? new Date(row.used_at) : null,
  };
}

export function isResetTokenValid(record: ResetTokenRecord, now: Date = new Date()): boolean {
  if (record.usedAt !== null) return false;
  if (record.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export async function consumeResetToken(rawToken: string): Promise<boolean> {
  const tokenHash = hashResetToken(rawToken);
  const result = await query<{ token_hash: string }>(
    `UPDATE public.password_reset_tokens
     SET used_at = NOW()
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING token_hash`,
    [tokenHash],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function invalidateAllResetTokensForUser(userId: string): Promise<void> {
  await query(
    `UPDATE public.password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );
}

export function buildResetLandingUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/reset?token=${encodeURIComponent(token)}`;
}

export async function setUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  await query(
    `UPDATE public.user_profiles
     SET password_hash = $2,
         failed_login_count = 0,
         locked_until = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, passwordHash],
  );
}
