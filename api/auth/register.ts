import bcrypt from "bcryptjs";
import { getUserProfile, setUserProfile } from "../../lib/edgeConfig.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import type { UserProfile } from "../../shared/types.js";

export async function POST(request: Request): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const email = (body?.email as string | undefined)?.toLowerCase().trim();
  const password = body?.password as string | undefined;
  const name = (body?.name as string | undefined)?.trim() ?? "";

  if (!email || !password) {
    return errorResponse("Email and password are required", 400);
  }

  if (password.length < 8) {
    return errorResponse("Password must be at least 8 characters", 400);
  }

  const existing = await getUserProfile(email);
  if (existing) {
    return errorResponse("User already exists", 409);
  }

  const profile: UserProfile = {
    id: email,
    name: name || email.split("@")[0],
    email,
    image: "",
    occupation: "",
    XP: 0,
    passwordHash: bcrypt.hashSync(password, 10),
  };

  await setUserProfile(email, profile);
  return jsonResponse({ ok: true }, { status: 201 });
}
