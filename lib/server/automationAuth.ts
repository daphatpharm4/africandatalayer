import { requireUser } from "../auth.js";
import { toSubmissionAuthContext } from "./submissionAccess.js";
import { errorResponse } from "./http.js";

export type AutomationAccess = {
  kind: "automation" | "admin";
  userId: string | null;
};

function getAutomationSecret(): string | null {
  const secret = process.env.AUTOMATION_SECRET?.trim();
  if (secret) return secret;
  const fallback = process.env.CRON_SECRET?.trim();
  return fallback || null;
}

export function isAutomationSecretAuthorized(request: Request): boolean {
  const secret = getAutomationSecret();
  const authHeader = request.headers.get("authorization");
  return Boolean(secret && authHeader === `Bearer ${secret}`);
}

export async function requireAutomationSecret(request: Request): Promise<Response | AutomationAccess> {
  const secret = getAutomationSecret();
  if (!secret) return errorResponse("AUTOMATION_SECRET is not configured", 500);
  if (!isAutomationSecretAuthorized(request)) return errorResponse("Unauthorized", 401);
  return { kind: "automation", userId: null };
}

export async function requireAutomationOrAdmin(request: Request): Promise<Response | AutomationAccess> {
  if (isAutomationSecretAuthorized(request)) {
    return { kind: "automation", userId: null };
  }

  const auth = await requireUser(request);
  const viewer = toSubmissionAuthContext(auth);
  if (!viewer) return errorResponse("Unauthorized", 401);
  if (!viewer.isAdmin) return errorResponse("Forbidden", 403);
  return { kind: "admin", userId: viewer.id };
}
