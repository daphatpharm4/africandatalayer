import { z } from "zod";
import { query } from "../db.js";
import { logInfo, logWarn } from "../logger.js";
import { audienceSchema, type AudienceFilter } from "../email/campaigns.js";
import { normalizePhone, sendSms } from "./provider.js";

export { audienceSchema };

export const smsCampaignCreateSchema = z.object({
  message: z.string().min(1).max(459),
  language: z.enum(["en", "fr"]).default("en"),
  audience: audienceSchema.default({}),
  scheduledAt: z.string().datetime().nullable().optional(),
  dryRun: z.boolean().optional(),
  acknowledgeCost: z.boolean().optional(),
});

export type SmsCampaignCreateInput = z.infer<typeof smsCampaignCreateSchema>;

export const MAX_SMS_CAMPAIGN_RECIPIENTS = Number(process.env.SMS_CAMPAIGN_MAX_RECIPIENTS ?? "300") || 300;
export const SMS_SEGMENT_GSM7_LIMIT = 160;
export const SMS_SEGMENT_UNICODE_LIMIT = 70;

export interface SmsAudienceRecipient {
  userId: string;
  phone: string;
}

export interface SmsAudienceResolution {
  recipients: SmsAudienceRecipient[];
  totalCount: number;
  optedOutCount: number;
}

function isGsm7(message: string): boolean {
  for (let i = 0; i < message.length; i += 1) {
    const code = message.charCodeAt(i);
    if (code === 0x0a || code === 0x0d) continue;
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

export function estimateSegments(message: string): number {
  if (!message) return 0;
  const limit = isGsm7(message) ? SMS_SEGMENT_GSM7_LIMIT : SMS_SEGMENT_UNICODE_LIMIT;
  return Math.max(1, Math.ceil(message.length / limit));
}

export async function resolveSmsAudience(filter: AudienceFilter): Promise<SmsAudienceResolution> {
  const conditions: string[] = ["up.phone IS NOT NULL"];
  const values: unknown[] = [];

  conditions.push("up.sms_opt_in = TRUE");

  if (filter.roles && filter.roles.length > 0) {
    values.push(filter.roles);
    conditions.push(`up.role = ANY($${values.length}::text[])`);
  }
  if (filter.trustTiers && filter.trustTiers.length > 0) {
    values.push(filter.trustTiers);
    conditions.push(`up.trust_tier = ANY($${values.length}::text[])`);
  }
  if (filter.mapScopes && filter.mapScopes.length > 0) {
    values.push(filter.mapScopes);
    conditions.push(`up.map_scope = ANY($${values.length}::text[])`);
  }
  if (filter.lastActiveDays && filter.lastActiveDays > 0) {
    values.push(filter.lastActiveDays);
    conditions.push(`up.updated_at >= NOW() - ($${values.length}::int * INTERVAL '1 day')`);
  }

  values.push(MAX_SMS_CAMPAIGN_RECIPIENTS + 1);
  const result = await query<{ id: string; phone: string }>(
    `SELECT up.id, up.phone
     FROM public.user_profiles up
     WHERE ${conditions.join(" AND ")}
     LIMIT $${values.length}::int`,
    values,
  );

  const recipients: SmsAudienceRecipient[] = [];
  for (const row of result.rows) {
    const normalized = normalizePhone(row.phone);
    if (!normalized) continue;
    recipients.push({ userId: row.id, phone: normalized });
  }

  return {
    recipients: recipients.slice(0, MAX_SMS_CAMPAIGN_RECIPIENTS),
    totalCount: result.rowCount ?? 0,
    optedOutCount: 0,
  };
}

interface CreateSmsCampaignParams extends SmsCampaignCreateInput {
  createdBy: string;
}

export interface CreatedSmsCampaign {
  id: string;
  status: string;
  recipientCount: number;
  capped: boolean;
  segmentsPerRecipient: number;
  estimatedCostUnits: number | null;
}

export async function createSmsCampaign(params: CreateSmsCampaignParams): Promise<CreatedSmsCampaign> {
  const audience = await resolveSmsAudience(params.audience);
  const capped = audience.totalCount > MAX_SMS_CAMPAIGN_RECIPIENTS;
  const segmentsPerRecipient = estimateSegments(params.message);
  const totalSegments = segmentsPerRecipient * audience.recipients.length;

  const insert = await query<{ id: string; status: string }>(
    `INSERT INTO public.sms_campaigns
       (message, audience, language, status, recipient_count, created_by, scheduled_at)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7)
     RETURNING id, status`,
    [
      params.message,
      JSON.stringify(params.audience),
      params.language,
      params.dryRun ? "draft" : "sending",
      audience.recipients.length,
      params.createdBy,
      params.scheduledAt ?? null,
    ],
  );
  const campaign = insert.rows[0];
  if (!campaign) throw new Error("Failed to insert sms_campaigns row");

  for (const recipient of audience.recipients) {
    await query(
      `INSERT INTO public.sms_campaign_recipients (campaign_id, user_id, phone, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (campaign_id, user_id) DO NOTHING`,
      [campaign.id, recipient.userId, recipient.phone],
    );
  }

  if (params.dryRun) {
    return {
      id: campaign.id,
      status: campaign.status,
      recipientCount: audience.recipients.length,
      capped,
      segmentsPerRecipient,
      estimatedCostUnits: totalSegments,
    };
  }

  await query(
    `UPDATE public.sms_campaigns
     SET started_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [campaign.id],
  );

  return {
    id: campaign.id,
    status: "sending",
    recipientCount: audience.recipients.length,
    capped,
    segmentsPerRecipient,
    estimatedCostUnits: totalSegments,
  };
}

export async function dispatchSmsCampaignBatch(params: {
  campaignId: string;
  batchSize?: number;
}): Promise<{ sent: number; failed: number; suppressed: number }> {
  const batchSize = params.batchSize ?? 50;
  const campaignResult = await query<{ message: string; status: string }>(
    `SELECT message, status FROM public.sms_campaigns WHERE id = $1 LIMIT 1`,
    [params.campaignId],
  );
  const campaign = campaignResult.rows[0];
  if (!campaign) throw new Error(`SMS campaign not found: ${params.campaignId}`);
  if (campaign.status === "cancelled" || campaign.status === "completed") {
    return { sent: 0, failed: 0, suppressed: 0 };
  }

  const pending = await query<{ user_id: string; phone: string }>(
    `SELECT user_id, phone
     FROM public.sms_campaign_recipients
     WHERE campaign_id = $1 AND status = 'pending'
     ORDER BY user_id
     LIMIT $2::int`,
    [params.campaignId, batchSize],
  );

  let sent = 0;
  let failed = 0;
  let suppressed = 0;

  for (const row of pending.rows) {
    const idempotencyKey = `sms_campaign:${params.campaignId}:${row.user_id}`;
    try {
      const result = await sendSms({
        recipient: { phone: row.phone, userId: row.user_id },
        message: campaign.message,
        idempotencyKey,
        templateId: `sms_campaign:${params.campaignId}`,
        campaignId: params.campaignId,
      });

      const nextStatus =
        result.status === "sent"
          ? "sent"
          : result.status === "suppressed"
            ? "suppressed"
            : result.status === "duplicate"
              ? "duplicate"
              : "failed";

      await query(
        `UPDATE public.sms_campaign_recipients
         SET status = $3,
             provider_message_id = COALESCE($4, provider_message_id),
             cost_units = COALESCE($5, cost_units),
             error = $6,
             sent_at = CASE WHEN $3 = 'sent' THEN NOW() ELSE sent_at END
         WHERE campaign_id = $1 AND user_id = $2`,
        [
          params.campaignId,
          row.user_id,
          nextStatus,
          result.providerMessageId,
          result.costUnits,
          result.status === "failed" ? result.reason ?? "send_failed" : null,
        ],
      );

      if (result.status === "sent") sent += 1;
      else if (result.status === "suppressed") suppressed += 1;
      else failed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      logWarn("sms_campaign.send_error", { campaignId: params.campaignId, userId: row.user_id, error: message });
      await query(
        `UPDATE public.sms_campaign_recipients
         SET status = 'failed', error = $3
         WHERE campaign_id = $1 AND user_id = $2`,
        [params.campaignId, row.user_id, message],
      );
      failed += 1;
    }
  }

  await query(
    `UPDATE public.sms_campaigns
     SET sent_count = sent_count + $2,
         failed_count = failed_count + $3,
         suppressed_count = suppressed_count + $4,
         updated_at = NOW()
     WHERE id = $1`,
    [params.campaignId, sent, failed, suppressed],
  );

  const remaining = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM public.sms_campaign_recipients
     WHERE campaign_id = $1 AND status = 'pending'`,
    [params.campaignId],
  );
  if (remaining.rows[0] && Number(remaining.rows[0].count) === 0) {
    await query(
      `UPDATE public.sms_campaigns
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'sending'`,
      [params.campaignId],
    );
  }

  logInfo("sms_campaign.batch_dispatched", {
    campaignId: params.campaignId,
    sent,
    failed,
    suppressed,
    pendingRemaining: remaining.rows[0] ? Number(remaining.rows[0].count) : 0,
  });

  return { sent, failed, suppressed };
}

export async function listSmsCampaigns(limit = 50): Promise<Array<{
  id: string;
  message: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}>> {
  const result = await query<{
    id: string;
    message: string;
    status: string;
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    suppressed_count: number;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
  }>(
    `SELECT id, message, status, recipient_count, sent_count, failed_count, suppressed_count,
            created_at, started_at, completed_at
     FROM public.sms_campaigns
     ORDER BY created_at DESC
     LIMIT $1::int`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    message: row.message,
    status: row.status,
    recipientCount: row.recipient_count,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    suppressedCount: row.suppressed_count,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));
}

export async function cancelSmsCampaign(campaignId: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `UPDATE public.sms_campaigns
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND status IN ('draft', 'sending')
     RETURNING id`,
    [campaignId],
  );
  if (!result.rowCount) return false;
  await query(
    `UPDATE public.sms_campaign_recipients
     SET status = 'failed', error = 'campaign_cancelled'
     WHERE campaign_id = $1 AND status = 'pending'`,
    [campaignId],
  );
  return true;
}
