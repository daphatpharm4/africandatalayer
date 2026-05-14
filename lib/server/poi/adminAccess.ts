import { requireUser } from "../../auth.js";
import { getUserProfile } from "../storage/index.js";
import { errorResponse } from "../http.js";

export type PoiAuthUser = Awaited<ReturnType<typeof requireUser>>;
export type RequireUserFn = typeof requireUser;
export type GetUserProfileFn = typeof getUserProfile;

export interface PoiAdminAccess {
  id: string;
  auth: NonNullable<PoiAuthUser>;
}

export async function requirePoiAdmin(
  request: Request,
  deps: {
    requireUserFn?: RequireUserFn;
    getUserProfileFn?: GetUserProfileFn;
  } = {},
): Promise<PoiAdminAccess | Response> {
  const requireUserFn = deps.requireUserFn ?? requireUser;
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  const auth = await requireUserFn(request);
  if (!auth) return errorResponse("Unauthorized", 401);

  const profile = await getUserProfileFn(auth.id);
  if (profile?.role !== "admin" && profile?.isAdmin !== true) {
    return errorResponse("Forbidden", 403);
  }

  return { id: auth.id, auth };
}
