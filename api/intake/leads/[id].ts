import { errorResponse, jsonResponse } from "../../../lib/server/http.js";
import { isStorageUnavailableError } from "../../../lib/server/db.js";
import { requireAutomationOrAdmin } from "../../../lib/server/automationAuth.js";
import { applyAutomationLeadAction } from "../../../lib/server/automationLeads.js";
import { automationLeadActionSchema } from "../../../lib/server/validation.js";

export const maxDuration = 30;

export async function PATCH(request: Request): Promise<Response> {
  const access = await requireAutomationOrAdmin(request);
  if (access instanceof Response) return access;

  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  if (!id) return errorResponse("Missing lead id", 400);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validation = automationLeadActionSchema.safeParse(rawBody);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid lead action", 400);
  }

  try {
    const updated = await applyAutomationLeadAction(id, validation.data);
    if (!updated) return errorResponse("Automation lead not found", 404);
    return jsonResponse(updated, { status: 200 });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    const message = error instanceof Error ? error.message : "Unable to update automation lead";
    return errorResponse(message, 400);
  }
}
