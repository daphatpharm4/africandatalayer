import { decode, getToken } from "@auth/core/jwt";
import type { JWT } from "@auth/core/jwt";

export function getAuthSecret(): string | null {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;
}

export function isSecureRequest(): boolean {
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  if (typeof authUrl === "string" && authUrl.startsWith("https://")) return true;
  return process.env.NODE_ENV === "production";
}

export function getSessionCookieName(): string {
  return isSecureRequest() ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export async function getAuthToken(request: Request): Promise<JWT | null> {
  const secret = getAuthSecret();
  if (!secret) return null;
  const cookieName = getSessionCookieName();
  const secureCookie = isSecureRequest();
  const salt = cookieName;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const raw = authHeader.slice(7).trim();
    const decoded = await decode({ token: raw, secret, salt });
    return decoded ?? null;
  }
  return await getToken({ req: request, secret, salt, cookieName, secureCookie });
}

export async function requireUser(request: Request): Promise<{ id: string; token: JWT } | null> {
  const token = await getAuthToken(request);
  if (!token) return null;
  const email = typeof token.email === "string" ? token.email.toLowerCase().trim() : null;
  const uid = (token as JWT & { uid?: unknown }).uid;
  const normalizedUid = typeof uid === "string" ? uid.trim() : null;
  const sub = typeof token.sub === "string" ? token.sub.trim() : null;
  const id = email || normalizedUid || sub;
  if (!id) return null;
  return { id, token };
}
