import { z } from "zod";
import { query } from "../db.js";
import { logInfo, logWarn } from "../logger.js";
import { sendTransactional } from "./provider.js";
import { buildUnsubscribeUrl } from "./unsubscribe.js";
import { renderEmailWithVariables } from "./variables.js";
import { sanitizeEmailHtml } from "./sanitize.js";

export const audienceSchema = z.object({
  roles: z.array(z.enum(["agent", "admin", "client"])).optional(),
  trustTiers: z
    .array(z.enum(["new", "standard", "trusted", "elite", "restricted"]))
    .optional(),
  mapScopes: z.array(z.string().min(1).max(64)).optional(),
  requireEmailOptIn: z.boolean().optional(),
  lastActiveDays: z.number().int().positive().max(3650).optional(),
});

export type AudienceFilter = z.infer<typeof audienceSchema>;

export const campaignCreateSchema = z.object({
  subject: z.string().min(1).max(255),
  htmlBody: z.string().min(1),
  textBody: z.string().min(1),
  language: z.enum(["en", "fr"]).default("en"),
  audience: audienceSchema.default({}),
  scheduledAt: z.string().datetime().nullable().optional(),
  dryRun: z.boolean().optional(),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export interface AudienceRecipient {
  userId: string;
  email: string;
  unsubscribeToken: string;
}

export interface AudienceResolution {
  recipients: AudienceRecipient[];
  totalCount: number;
  suppressedCount: number;
}

export const MAX_CAMPAIGN_RECIPIENTS = Number(process.env.EMAIL_CAMPAIGN_MAX_RECIPIENTS ?? "5000") || 5000;

export async function resolveAudience(filter: AudienceFilter): Promise<AudienceResolution> {
  const conditions: string[] = ["up.email IS NOT NULL"];
  const values: unknown[] = [];

  const requireOptIn = filter.requireEmailOptIn !== false;
  if (requireOptIn) {
    conditions.push("up.email_opt_in = TRUE");
  }

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

  const whereClause = conditions.join(" AND ");
  const rowResult = await query<{ id: string; email: string; unsubscribe_token: string; suppressed: boolean }>(
    `SELECT
       up.id,
       up.email,
       up.unsubscribe_token,
       (es.email IS NOT NULL) AS suppressed
     FROM public.user_profiles up
     LEFT JOIN public.email_suppression es ON LOWER(up.email) = es.email
     WHERE ${whereClause}
     LIMIT $${values.length + 1}::int`,
    [...values, MAX_CAMPAIGN_RECIPIENTS + 1],
  );

  let suppressedCount = 0;
  const recipients: AudienceRecipient[] = [];
  for (const row of rowResult.rows) {
    if (row.suppressed) {
      suppressedCount += 1;
      continue;
    }
    recipients.push({
      userId: row.id,
      email: row.email,
      unsubscribeToken: row.unsubscribe_token,
    });
  }

  return {
    recipients: recipients.slice(0, MAX_CAMPAIGN_RECIPIENTS),
    totalCount: rowResult.rowCount ?? 0,
    suppressedCount,
  };
}

interface CreateCampaignParams extends CampaignCreateInput {
  createdBy: string;
}

export interface CreatedCampaign {
  id: string;
  status: string;
  recipientCount: number;
  suppressedCount: number;
  capped: boolean;
}

export function isFutureScheduledAt(scheduledAt: string | null | undefined): boolean {
  if (!scheduledAt) return false;
  const t = new Date(scheduledAt).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export async function createCampaign(params: CreateCampaignParams): Promise<CreatedCampaign> {
  const audience = await resolveAudience(params.audience);
  const capped = audience.totalCount > MAX_CAMPAIGN_RECIPIENTS;
  const recipients = audience.recipients;
  const isScheduled = !params.dryRun && isFutureScheduledAt(params.scheduledAt ?? null);
  const initialStatus = params.dryRun ? "draft" : isScheduled ? "scheduled" : "sending";

  const sanitizedHtml = sanitizeEmailHtml(params.htmlBody).html;
  const insert = await query<{ id: string; status: string }>(
    `INSERT INTO public.email_campaigns
       (subject, html_body, text_body, audience, language, status, recipient_count, suppressed_count, created_by, scheduled_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
     RETURNING id, status`,
    [
      params.subject,
      sanitizedHtml,
      params.textBody,
      JSON.stringify(params.audience),
      params.language,
      initialStatus,
      recipients.length,
      audience.suppressedCount,
      params.createdBy,
      params.scheduledAt ?? null,
    ],
  );
  const campaign = insert.rows[0];
  if (!campaign) throw new Error("Failed to insert campaign row");

  for (const recipient of recipients) {
    await query(
      `INSERT INTO public.email_campaign_recipients (campaign_id, user_id, email, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (campaign_id, user_id) DO NOTHING`,
      [campaign.id, recipient.userId, recipient.email],
    );
  }

  if (params.dryRun) {
    return {
      id: campaign.id,
      status: campaign.status,
      recipientCount: recipients.length,
      suppressedCount: audience.suppressedCount,
      capped,
    };
  }

  if (isScheduled) {
    return {
      id: campaign.id,
      status: "scheduled",
      recipientCount: recipients.length,
      suppressedCount: audience.suppressedCount,
      capped,
    };
  }

  await query(
    `UPDATE public.email_campaigns
     SET started_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [campaign.id],
  );

  return {
    id: campaign.id,
    status: "sending",
    recipientCount: recipients.length,
    suppressedCount: audience.suppressedCount,
    capped,
  };
}

export interface DispatchResult {
  sent: number;
  failed: number;
  suppressed: number;
  duplicate: number;
}

export async function dispatchCampaignSendBatch(params: {
  campaignId: string;
  baseUrl: string;
  batchSize?: number;
}): Promise<DispatchResult> {
  const batchSize = params.batchSize ?? 50;
  const campaignResult = await query<{
    subject: string;
    html_body: string;
    text_body: string;
    language: string;
    status: string;
  }>(
    `SELECT subject, html_body, text_body, language, status
     FROM public.email_campaigns
     WHERE id = $1
     LIMIT 1`,
    [params.campaignId],
  );
  const campaign = campaignResult.rows[0];
  if (!campaign) throw new Error(`Campaign not found: ${params.campaignId}`);
  if (campaign.status === "cancelled" || campaign.status === "completed") {
    return { sent: 0, failed: 0, suppressed: 0, duplicate: 0 };
  }

  const pending = await query<{
    user_id: string;
    email: string;
    unsubscribe_token: string;
    name: string | null;
    map_scope: string | null;
    role: string | null;
    trust_tier: string | null;
  }>(
    `SELECT cr.user_id, cr.email, up.unsubscribe_token,
            up.name, up.map_scope, up.role, up.trust_tier
     FROM public.email_campaign_recipients cr
     JOIN public.user_profiles up ON up.id = cr.user_id
     WHERE cr.campaign_id = $1 AND cr.status = 'pending'
     ORDER BY cr.user_id
     LIMIT $2::int`,
    [params.campaignId, batchSize],
  );

  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  let duplicate = 0;

  const sendsPerSecond = Number(process.env.EMAIL_SEND_RATE_PER_SECOND ?? "4") || 4;
  const minGapMs = Math.ceil(1000 / Math.max(1, sendsPerSecond));
  let lastSendStart = 0;

  for (const row of pending.rows) {
    const elapsed = Date.now() - lastSendStart;
    if (lastSendStart > 0 && elapsed < minGapMs) {
      await new Promise((resolve) => setTimeout(resolve, minGapMs - elapsed));
    }
    lastSendStart = Date.now();
    const unsubscribeUrl = buildUnsubscribeUrl(params.baseUrl, row.unsubscribe_token);
    const idempotencyKey = `email_campaign:${params.campaignId}:${row.user_id}`;
    const firstName = row.name ? row.name.split(/\s+/)[0] : "";
    const rendered = renderEmailWithVariables(
      { subject: campaign.subject, html: campaign.html_body, text: campaign.text_body },
      {
        values: {
          firstName,
          name: row.name ?? "",
          city: row.map_scope ?? "",
          role: row.role ?? "",
          trustTier: row.trust_tier ?? "",
          language: campaign.language,
        },
      },
    );
    try {
      const result = await sendTransactional({
        recipient: { email: row.email, userId: row.user_id },
        templateId: `email_campaign:${params.campaignId}`,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey,
        campaignId: params.campaignId,
        emailClass: "marketing",
        unsubscribeUrl,
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
        `UPDATE public.email_campaign_recipients
         SET status = $3,
             provider_message_id = COALESCE($4, provider_message_id),
             error = $5,
             sent_at = CASE WHEN $3 = 'sent' THEN NOW() ELSE sent_at END
         WHERE campaign_id = $1 AND user_id = $2`,
        [
          params.campaignId,
          row.user_id,
          nextStatus,
          result.providerMessageId,
          result.status === "failed" ? result.reason ?? "send_failed" : null,
        ],
      );

      if (result.status === "sent") sent += 1;
      else if (result.status === "suppressed") suppressed += 1;
      else if (result.status === "duplicate") duplicate += 1;
      else failed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      logWarn("campaign.send_error", { campaignId: params.campaignId, userId: row.user_id, error: message });
      await query(
        `UPDATE public.email_campaign_recipients
         SET status = 'failed', error = $3
         WHERE campaign_id = $1 AND user_id = $2`,
        [params.campaignId, row.user_id, message],
      );
      failed += 1;
    }
  }

  await query(
    `UPDATE public.email_campaigns
     SET sent_count = sent_count + $2,
         failed_count = failed_count + $3,
         suppressed_count = suppressed_count + $4,
         updated_at = NOW()
     WHERE id = $1`,
    [params.campaignId, sent, failed, suppressed],
  );

  const remaining = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM public.email_campaign_recipients
     WHERE campaign_id = $1 AND status = 'pending'`,
    [params.campaignId],
  );
  if (remaining.rows[0] && Number(remaining.rows[0].count) === 0) {
    await query(
      `UPDATE public.email_campaigns
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'sending'`,
      [params.campaignId],
    );
  }

  logInfo("campaign.batch_dispatched", {
    campaignId: params.campaignId,
    sent,
    failed,
    suppressed,
    duplicate,
    pendingRemaining: remaining.rows[0] ? Number(remaining.rows[0].count) : 0,
  });

  return { sent, failed, suppressed, duplicate };
}

export async function promoteDueScheduledCampaigns(): Promise<number> {
  const result = await query<{ id: string }>(
    `UPDATE public.email_campaigns
     SET status = 'sending', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
     WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
     RETURNING id`,
  );
  return result.rowCount ?? 0;
}

export async function drainPendingCampaigns(baseUrl: string, maxCampaigns = 5): Promise<number> {
  await promoteDueScheduledCampaigns();
  const result = await query<{ id: string }>(
    `SELECT id FROM public.email_campaigns
     WHERE status = 'sending'
     ORDER BY started_at ASC NULLS FIRST
     LIMIT $1::int`,
    [maxCampaigns],
  );
  let drained = 0;
  for (const row of result.rows) {
    await dispatchCampaignSendBatch({ campaignId: row.id, baseUrl });
    drained += 1;
  }
  return drained;
}

export async function listCampaigns(limit = 50): Promise<Array<{
  id: string;
  subject: string;
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
    subject: string;
    status: string;
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    suppressed_count: number;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
  }>(
    `SELECT id, subject, status, recipient_count, sent_count, failed_count, suppressed_count,
            created_at, started_at, completed_at
     FROM public.email_campaigns
     ORDER BY created_at DESC
     LIMIT $1::int`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    subject: row.subject,
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

export async function cancelCampaign(campaignId: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `UPDATE public.email_campaigns
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND status IN ('draft', 'scheduled', 'sending')
     RETURNING id`,
    [campaignId],
  );
  if (!result.rowCount) return false;
  await query(
    `UPDATE public.email_campaign_recipients
     SET status = 'failed', error = 'campaign_cancelled'
     WHERE campaign_id = $1 AND status = 'pending'`,
    [campaignId],
  );
  return true;
}
