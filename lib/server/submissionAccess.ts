import type { PointEvent } from "../../shared/types.js";

export type RbacAction = "submit" | "read" | "review" | "manage_users" | "delete";

const ROLE_PERMISSIONS: Record<string, ReadonlySet<RbacAction>> = {
  agent: new Set<RbacAction>(["submit", "read"]),
  client: new Set<RbacAction>(["read"]),
  admin: new Set<RbacAction>(["submit", "read", "review", "manage_users", "delete"]),
};

export function canPerformAction(role: string, action: RbacAction): boolean {
  const allowed = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.agent!;
  return allowed.has(action);
}

export interface SubmissionAuthContext {
  id: string;
  isAdmin: boolean;
  role: string;
}

type RawAuth = {
  id: string;
  token?: unknown;
  role?: string;
} | null;

export function normalizeActorId(input: string): string {
  return input.toLowerCase().trim();
}

export function toSubmissionAuthContext(auth: RawAuth): SubmissionAuthContext | null {
  if (!auth || typeof auth.id !== "string") return null;
  const id = normalizeActorId(auth.id);
  if (!id) return null;
  const token = auth.token as { isAdmin?: unknown; role?: unknown } | undefined;
  const isAdmin = token?.isAdmin === true;
  const role = typeof token?.role === "string" ? token.role : "agent";
  return { id, isAdmin, role };
}

export function redactEventUserIds(events: PointEvent[]): Array<Omit<PointEvent, "userId">> {
  return events.map((event) => {
    const redacted = { ...event };
    delete redacted.userId;
    return redacted as Omit<PointEvent, "userId">;
  });
}

export function filterEventsForViewer(events: PointEvent[], viewer: SubmissionAuthContext): PointEvent[] {
  if (viewer.isAdmin) return events;
  return events.filter((event) => normalizeActorId(event.userId) === viewer.id);
}

export function canViewEventDetail(event: PointEvent, viewer: SubmissionAuthContext): boolean {
  if (viewer.isAdmin) return true;
  return normalizeActorId(event.userId) === viewer.id;
}

export function resolveAdminViewAccess(viewer: SubmissionAuthContext | null): "ok" | "unauthorized" | "forbidden" {
  if (!viewer) return "unauthorized";
  if (!viewer.isAdmin) return "forbidden";
  return "ok";
}
