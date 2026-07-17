import { query } from "../db.js";
import { logError } from "../logger.js";
import type { StoreDeps } from "./orgStore.js";

export type PlatformAuditEventType =
  | "org_created"
  | "org_branding_updated"
  | "member_invited"
  | "invite_revoked"
  | "invite_accepted"
  | "member_role_changed"
  | "member_removed"
  | "project_created"
  | "schema_draft_saved"
  | "schema_published"
  | "record_created"
  | "record_reviewed";

export interface PlatformAuditEvent {
  organizationId: string;
  projectId?: string | null;
  actorUserId: string;
  eventType: PlatformAuditEventType;
  payload?: Record<string, unknown>;
}

export async function writePlatformAudit(event: PlatformAuditEvent, deps: StoreDeps = {}): Promise<void> {
  const run = deps.queryFn ?? (query as NonNullable<StoreDeps["queryFn"]>);
  try {
    await run(
      `INSERT INTO public.platform_audit_events (organization_id, project_id, actor_user_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [event.organizationId, event.projectId ?? null, event.actorUserId, event.eventType, JSON.stringify(event.payload ?? {})],
    );
  } catch (error) {
    logError("platform audit write failed", { eventType: event.eventType, error });
  }
}
