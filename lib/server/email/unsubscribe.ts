import { query } from "../db.js";
import { suppressEmail } from "./provider.js";

export interface UnsubscribeRecipient {
  userId: string;
  email: string;
}

export async function findRecipientByUnsubscribeToken(
  token: string,
): Promise<UnsubscribeRecipient | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const result = await query<{ id: string; email: string }>(
    `SELECT id, email
     FROM public.user_profiles
     WHERE unsubscribe_token = $1
     LIMIT 1`,
    [trimmed],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { userId: row.id, email: row.email };
}

export async function applyUnsubscribe(recipient: UnsubscribeRecipient): Promise<void> {
  await query(
    `UPDATE public.user_profiles
     SET email_opt_in = FALSE, updated_at = NOW()
     WHERE id = $1`,
    [recipient.userId],
  );
  await suppressEmail(recipient.email, "unsubscribe", "user_action");
}

export function buildUnsubscribeUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/comms/unsubscribe?token=${encodeURIComponent(token)}`;
}
