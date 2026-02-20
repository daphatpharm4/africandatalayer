import type { PointEvent } from "../../shared/types.js";

export interface SubmissionAuthContext {
  id: string;
  isAdmin: boolean;
}

type RawAuth = {
  id: string;
  token?: unknown;
} | null;

export function normalizeActorId(input: string): string {
  return input.toLowerCase().trim();
}

export function toSubmissionAuthContext(auth: RawAuth): SubmissionAuthContext | null {
  if (!auth || typeof auth.id !== "string") return null;
  const id = normalizeActorId(auth.id);
  if (!id) return null;
  const token = auth.token as { isAdmin?: unknown } | undefined;
  const isAdmin = token?.isAdmin === true;
  return { id, isAdmin };
}

export function redactEventUserIds(events: PointEvent[]): Array<Omit<PointEvent, "userId">> {
  return events.map(({ userId: _userId, ...rest }) => rest as Omit<PointEvent, "userId">);
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
