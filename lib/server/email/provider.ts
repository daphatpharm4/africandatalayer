import { query } from "../db.js";
import { logError, logInfo } from "../logger.js";

export type EmailClass = "transactional" | "marketing";

export interface EmailRecipient {
  email: string;
  userId: string | null;
}

export interface SendTransactionalParams {
  recipient: EmailRecipient;
  templateId: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  campaignId?: string | null;
  emailClass?: EmailClass;
  unsubscribeUrl?: string | null;
  headers?: Record<string, string>;
}

export interface SendResult {
  status: "sent" | "suppressed" | "duplicate" | "failed";
  providerMessageId: string | null;
  reason?: string;
}

interface ResendSendBody {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

interface ResendSendResponse {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function getEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const result = await query<{ email: string }>(
    `SELECT email FROM public.email_suppression WHERE email = $1 LIMIT 1`,
    [normalized],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function suppressEmail(
  email: string,
  reason: "unsubscribe" | "bounce" | "complaint" | "manual",
  source: string | null,
): Promise<void> {
  const normalized = normalizeEmail(email);
  await query(
    `INSERT INTO public.email_suppression (email, reason, source)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source`,
    [normalized, reason, source],
  );
}

interface CommunicationsLogRow {
  id: string;
  status: string;
  provider_message_id: string | null;
}

async function upsertLogRow(params: {
  userId: string | null;
  recipient: string;
  templateId: string;
  campaignId: string | null;
  idempotencyKey: string;
}): Promise<{ row: CommunicationsLogRow; isNew: boolean }> {
  const result = await query<CommunicationsLogRow>(
    `INSERT INTO public.communications_log
       (user_id, channel, template_id, recipient, campaign_id, idempotency_key, status)
     VALUES ($1, 'email', $2, $3, $4, $5, 'queued')
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id, status, provider_message_id`,
    [
      params.userId,
      params.templateId,
      params.recipient,
      params.campaignId,
      params.idempotencyKey,
    ],
  );

  if (result.rowCount && result.rowCount > 0 && result.rows[0]) {
    return { row: result.rows[0], isNew: true };
  }

  const existing = await query<CommunicationsLogRow>(
    `SELECT id, status, provider_message_id
     FROM public.communications_log
     WHERE idempotency_key = $1
     LIMIT 1`,
    [params.idempotencyKey],
  );
  const row = existing.rows[0];
  if (!row) {
    throw new Error("communications_log: failed to read row after insert");
  }
  return { row, isNew: false };
}

async function markLogStatus(
  id: string,
  status: "sent" | "failed" | "suppressed",
  providerMessageId: string | null,
  error: string | null,
): Promise<void> {
  await query(
    `UPDATE public.communications_log
     SET status = $2,
         provider_message_id = COALESCE($3, provider_message_id),
         error = $4,
         sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE sent_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [id, status, providerMessageId, error],
  );
}

export async function sendTransactional(params: SendTransactionalParams): Promise<SendResult> {
  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("RESEND_FROM");
  const recipient = normalizeEmail(params.recipient.email);
  const emailClass = params.emailClass ?? "transactional";

  if (await isEmailSuppressed(recipient)) {
    return { status: "suppressed", providerMessageId: null, reason: "email_suppressed" };
  }

  const { row, isNew } = await upsertLogRow({
    userId: params.recipient.userId,
    recipient,
    templateId: params.templateId,
    campaignId: params.campaignId ?? null,
    idempotencyKey: params.idempotencyKey,
  });

  if (!isNew && row.status !== "queued") {
    return {
      status: "duplicate",
      providerMessageId: row.provider_message_id,
      reason: `already_${row.status}`,
    };
  }

  const headers: Record<string, string> = { ...(params.headers ?? {}) };
  if (emailClass === "marketing" && params.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${params.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const body: ResendSendBody = {
    from,
    to: [recipient],
    subject: params.subject,
    html: params.html,
    text: params.text,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  };

  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": params.idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch_failed";
    await markLogStatus(row.id, "failed", null, message);
    logError("email.send_failed", { templateId: params.templateId, error: message });
    return { status: "failed", providerMessageId: null, reason: message };
  }

  const parsed: ResendSendResponse | null = await response
    .json()
    .then((value) => value as ResendSendResponse)
    .catch(() => null);

  if (!response.ok) {
    const reason = parsed?.message ?? `resend_status_${response.status}`;
    await markLogStatus(row.id, "failed", null, reason);
    logError("email.send_rejected", { templateId: params.templateId, reason, status: response.status });
    return { status: "failed", providerMessageId: null, reason };
  }

  const providerMessageId = parsed?.id ?? null;
  await markLogStatus(row.id, "sent", providerMessageId, null);
  logInfo("email.sent", { templateId: params.templateId, providerMessageId });
  return { status: "sent", providerMessageId };
}
