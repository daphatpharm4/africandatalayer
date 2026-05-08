import { query } from "../db.js";
import { logInfo, logWarn } from "../logger.js";
import { disableSmsOptIn, normalizePhone } from "./provider.js";

const STOP_KEYWORDS = new Set(["stop", "arret", "arrêt", "unsubscribe", "stop all", "stopall", "quit", "cancel"]);

export interface InboundSmsEvent {
  from: string;
  text: string;
  to?: string;
  date?: string;
  id?: string;
}

export async function handleInboundSms(event: InboundSmsEvent): Promise<{ accepted: boolean; action?: string }> {
  const phone = normalizePhone(event.from);
  if (!phone) {
    logWarn("sms.inbound_invalid_phone", { from: event.from });
    return { accepted: false };
  }

  const normalized = event.text.trim().toLowerCase();
  if (STOP_KEYWORDS.has(normalized)) {
    await disableSmsOptIn(phone);
    logInfo("sms.opt_out", { phone });
    return { accepted: true, action: "opted_out" };
  }

  return { accepted: true, action: "noop" };
}

interface DeliveryReport {
  id: string;
  status: string;
  phoneNumber?: string;
  failureReason?: string;
}

export async function handleSmsDeliveryReport(report: DeliveryReport): Promise<{ accepted: boolean }> {
  if (!report.id) return { accepted: false };

  const status = report.status.toLowerCase();
  let nextStatus: string | null = null;
  if (status === "success" || status === "delivered") nextStatus = "delivered";
  else if (status === "failed" || status === "rejected") nextStatus = "undelivered";
  else if (status === "expired") nextStatus = "undelivered";

  if (!nextStatus) return { accepted: true };

  const result = await query<{ campaign_id: string; user_id: string }>(
    `UPDATE public.sms_campaign_recipients
     SET status = $2,
         delivered_at = CASE WHEN $2 = 'delivered' THEN NOW() ELSE delivered_at END,
         error = COALESCE($3, error)
     WHERE provider_message_id = $1
     RETURNING campaign_id, user_id`,
    [report.id, nextStatus, report.failureReason ?? null],
  );

  if (result.rowCount === 0) {
    logWarn("sms.dlr_unmatched", { providerMessageId: report.id });
    return { accepted: false };
  }

  logInfo("sms.dlr_processed", { providerMessageId: report.id, status: nextStatus });
  return { accepted: true };
}
