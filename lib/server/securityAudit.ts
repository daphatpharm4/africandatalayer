import { query } from "./db.js";

export type SecurityAuditEventType =
  | "login_success"
  | "login_failure"
  | "logout"
  | "session_expired"
  | "session_revoked"
  | "account_locked"
  | "account_unlocked"
  | "role_changed"
  | "admin_account_created"
  | "point_operator_account_created"
  | "point_operator_assignment_granted"
  | "point_operator_assignment_revoked"
  | "point_operator_assignment_replaced"
  | "point_operator_password_changed"
  | "remote_wipe_triggered"
  | "remote_wipe_executed"
  | "data_export"
  | "privacy_request"
  | "privacy_erasure"
  | "submission_flagged"
  | "submission_rejected"
  | "admin_review"
  | "api_rate_limited"
  | "idempotency_conflict"
  | "suspicious_activity"
  | "policy_accepted"
  | "ip_report_filed"
  | "ip_report_updated";

function normalizeIp(raw: string | null): string | null {
  const value = raw?.split(",")[0]?.trim();
  if (!value) return null;
  return value.replace(/^\[|\]$/g, "");
}

function requestMetadata(request: Request | null | undefined): { ip: string | null; userAgent: string | null } {
  if (!request) return { ip: null, userAgent: null };
  return {
    ip: normalizeIp(
      request.headers.get("x-vercel-forwarded-for") ??
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip"),
    ),
    userAgent: request.headers.get("user-agent"),
  };
}

export interface SecurityAuditEventInput {
  eventType: SecurityAuditEventType;
  userId?: string | null;
  request?: Request | null;
  details?: Record<string, unknown> | null;
}

export type SecurityAuditQueryFn = (
  text: string,
  values?: unknown[],
) => Promise<unknown>;

export async function insertSecurityAuditEvent(
  queryFn: SecurityAuditQueryFn,
  input: SecurityAuditEventInput,
): Promise<void> {
  const meta = requestMetadata(input.request);
  await queryFn(
    `INSERT INTO security_audit_log (event_type, user_id, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      input.eventType,
      input.userId ?? null,
      meta.ip,
      meta.userAgent,
      JSON.stringify(input.details ?? {}),
    ],
  );
}

export async function logSecurityEvent(
  input: SecurityAuditEventInput,
): Promise<void> {
  await insertSecurityAuditEvent(query, input);
}
