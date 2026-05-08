import { query } from "../db.js";
import { logError, logInfo } from "../logger.js";

export interface SmsRecipient {
  phone: string;
  userId: string | null;
}

export interface SendSmsParams {
  recipient: SmsRecipient;
  message: string;
  idempotencyKey: string;
  templateId: string;
  campaignId?: string | null;
}

export interface SmsSendResult {
  status: "sent" | "queued" | "duplicate" | "suppressed" | "failed";
  providerMessageId: string | null;
  costUnits: number | null;
  reason?: string;
}

interface AfricasTalkingRecipient {
  statusCode?: number;
  number?: string;
  status?: string;
  cost?: string;
  messageId?: string;
}

interface AfricasTalkingResponse {
  SMSMessageData?: {
    Message?: string;
    Recipients?: AfricasTalkingRecipient[];
  };
}

const AT_ENDPOINT = "https://api.africastalking.com/version1/messaging";
const AT_SANDBOX_ENDPOINT = "https://api.sandbox.africastalking.com/version1/messaging";

function getEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) return null;
  if (cleaned.length < 8) return null;
  return cleaned;
}

function parseCostUnits(cost: string | undefined): number | null {
  if (!cost) return null;
  const match = /([0-9]+\.?[0-9]*)/.exec(cost);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export async function isPhoneSmsOptedIn(userId: string): Promise<boolean> {
  const result = await query<{ sms_opt_in: boolean }>(
    `SELECT sms_opt_in FROM public.user_profiles WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.sms_opt_in === true;
}

export async function disableSmsOptIn(phone: string): Promise<void> {
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  await query(
    `UPDATE public.user_profiles
     SET sms_opt_in = FALSE, updated_at = NOW()
     WHERE phone = $1`,
    [normalized],
  );
}

export async function sendSms(params: SendSmsParams): Promise<SmsSendResult> {
  const apiKey = getEnv("AT_API_KEY");
  const username = getEnv("AT_USERNAME");
  const senderId = process.env.AT_SENDER_ID?.trim() || undefined;
  const useSandbox = process.env.AT_USE_SANDBOX === "true" || username === "sandbox";

  const phone = normalizePhone(params.recipient.phone);
  if (!phone) {
    return { status: "failed", providerMessageId: null, costUnits: null, reason: "invalid_phone" };
  }

  if (params.recipient.userId) {
    const optedIn = await isPhoneSmsOptedIn(params.recipient.userId);
    if (!optedIn) {
      return { status: "suppressed", providerMessageId: null, costUnits: null, reason: "sms_opt_out" };
    }
  }

  const body = new URLSearchParams();
  body.set("username", username);
  body.set("to", phone);
  body.set("message", params.message);
  if (senderId) body.set("from", senderId);

  let response: Response;
  try {
    response = await fetch(useSandbox ? AT_SANDBOX_ENDPOINT : AT_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch_failed";
    logError("sms.send_failed", { templateId: params.templateId, error: message });
    return { status: "failed", providerMessageId: null, costUnits: null, reason: message };
  }

  const parsed = (await response.json().catch(() => null)) as AfricasTalkingResponse | null;
  const recipient = parsed?.SMSMessageData?.Recipients?.[0];

  if (!response.ok || !recipient) {
    const reason = parsed?.SMSMessageData?.Message ?? `at_status_${response.status}`;
    logError("sms.send_rejected", { templateId: params.templateId, reason, status: response.status });
    return { status: "failed", providerMessageId: null, costUnits: null, reason };
  }

  const status = recipient.status ?? "Failed";
  const providerMessageId = recipient.messageId ?? null;
  const costUnits = parseCostUnits(recipient.cost);
  const success = status === "Success" || status === "Sent" || recipient.statusCode === 101 || recipient.statusCode === 102;

  if (!success) {
    logError("sms.send_recipient_failed", {
      templateId: params.templateId,
      status,
      statusCode: recipient.statusCode,
    });
    return { status: "failed", providerMessageId, costUnits, reason: status };
  }

  logInfo("sms.sent", { templateId: params.templateId, providerMessageId, costUnits });
  return { status: "sent", providerMessageId, costUnits };
}
