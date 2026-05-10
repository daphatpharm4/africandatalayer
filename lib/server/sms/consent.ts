import { createHash } from "node:crypto";
import { query } from "../db.js";

export const SMS_CONSENT_COPY_VERSION = "2026-05-08-v1";

export type SmsConsentSource = "signup" | "settings" | "inbound_stop" | "admin" | "import";

export interface RecordSmsConsentParams {
  userId: string;
  consented: boolean;
  source: SmsConsentSource;
  ip?: string | null;
  userAgent?: string | null;
  copyVersion?: string;
}

export async function recordSmsConsent(params: RecordSmsConsentParams): Promise<void> {
  const ipHash = params.ip ? createHash("sha256").update(params.ip).digest("hex") : null;
  await query(
    `INSERT INTO public.sms_consent_log
       (user_id, consented, source, copy_version, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.userId,
      params.consented,
      params.source,
      params.copyVersion ?? SMS_CONSENT_COPY_VERSION,
      ipHash,
      params.userAgent ?? null,
    ],
  );
  await query(
    `UPDATE public.user_profiles
     SET sms_opt_in = $2, updated_at = NOW()
     WHERE id = $1`,
    [params.userId, params.consented],
  );
}

export async function getCurrentSmsConsent(userId: string): Promise<{
  optedIn: boolean;
  lastChangedAt: string | null;
  lastSource: SmsConsentSource | null;
}> {
  const result = await query<{
    sms_opt_in: boolean;
    created_at: string | null;
    source: SmsConsentSource | null;
  }>(
    `SELECT up.sms_opt_in, latest.created_at, latest.source
     FROM public.user_profiles up
     LEFT JOIN LATERAL (
       SELECT created_at, source
       FROM public.sms_consent_log
       WHERE user_id = up.id
       ORDER BY created_at DESC
       LIMIT 1
     ) latest ON TRUE
     WHERE up.id = $1
     LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return { optedIn: false, lastChangedAt: null, lastSource: null };
  return {
    optedIn: row.sms_opt_in === true,
    lastChangedAt: row.created_at ?? null,
    lastSource: row.source ?? null,
  };
}
