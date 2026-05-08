import { query } from "../db.js";
import { logInfo, logWarn } from "../logger.js";
import { suppressEmail } from "./provider.js";

const RESEND_EVENT_TO_STATUS: Record<string, string | null> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": null,
};

interface ResendEventEnvelope {
  type?: unknown;
  data?: {
    email_id?: unknown;
    to?: unknown;
    from?: unknown;
    subject?: unknown;
    created_at?: unknown;
  } & Record<string, unknown>;
}

function readEmailFromTo(value: unknown): string | null {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim().toLowerCase();
  return null;
}

export async function handleResendWebhookEvent(payload: unknown): Promise<{ accepted: boolean; reason?: string }> {
  if (!payload || typeof payload !== "object") {
    return { accepted: false, reason: "invalid_payload" };
  }
  const envelope = payload as ResendEventEnvelope;
  const type = typeof envelope.type === "string" ? envelope.type : "";
  const status = RESEND_EVENT_TO_STATUS[type];
  if (status === undefined) {
    return { accepted: false, reason: "unknown_event_type" };
  }
  if (status === null) {
    return { accepted: true };
  }

  const data = envelope.data ?? {};
  const messageId = typeof data.email_id === "string" ? data.email_id : null;
  if (!messageId) {
    return { accepted: false, reason: "missing_message_id" };
  }

  const recipientEmail = readEmailFromTo(data.to);

  const updateResult = await query<{ id: string }>(
    `UPDATE public.communications_log
     SET status = $2,
         delivered_at = CASE WHEN $2 = 'delivered' THEN NOW() ELSE delivered_at END,
         opened_at = CASE WHEN $2 = 'opened' THEN COALESCE(opened_at, NOW()) ELSE opened_at END,
         clicked_at = CASE WHEN $2 = 'clicked' THEN COALESCE(clicked_at, NOW()) ELSE clicked_at END,
         updated_at = NOW()
     WHERE provider_message_id = $1
     RETURNING id`,
    [messageId, status],
  );

  if (updateResult.rowCount === 0) {
    logWarn("email.webhook_unmatched", { messageId, type });
    return { accepted: false, reason: "unknown_message_id" };
  }

  if (status === "bounced" && recipientEmail) {
    await suppressEmail(recipientEmail, "bounce", "resend_webhook");
  }
  if (status === "complained" && recipientEmail) {
    await suppressEmail(recipientEmail, "complaint", "resend_webhook");
  }

  logInfo("email.webhook_processed", { messageId, type, status });
  return { accepted: true };
}
