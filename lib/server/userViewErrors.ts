import { isStorageUnavailableError } from "./storage/index.js";

export interface ViewError {
  status: number;
  code: string;
  message: string;
}

/** Classify a failure from a `/api/user` data view (e.g. assignments) into a
 *  clear, client-safe response. Transient storage outages become 503; anything
 *  else becomes a 500 with a generic message so SQL/internal details never reach
 *  the client. The real error should be logged server-side at the call site. */
export function classifyUserViewError(error: unknown): ViewError {
  if (isStorageUnavailableError(error)) {
    return { status: 503, code: "storage_unavailable", message: "Storage service temporarily unavailable" };
  }
  return { status: 500, code: "assignments_failed", message: "Unable to load assignments" };
}
