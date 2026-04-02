import { Auth } from "@auth/core";
import Credentials from "@auth/core/providers/credentials";
import Google from "@auth/core/providers/google";
import type { AppProviders } from "@auth/core/providers";
import bcrypt from "bcryptjs";
import type { UserProfile } from "../../../shared/types.js";
import { DEFAULT_AVATAR_PRESET, encodeAvatarPresetImage } from "../../../shared/avatarPresets.js";
import { errorResponse } from "../http.js";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../storage/index.js";
import { getAuthBaseUrl, getAuthSecret, getSessionCookieName, isSecureRequest, SESSION_CONFIG } from "../../auth.js";
import { inferDefaultDisplayName, normalizeEmail, normalizeIdentifier } from "../../shared/identifier.js";
import { withAbsoluteUrl } from "./requestUrl.js";
import { consumeRateLimit } from "../rateLimit.js";
import { logSecurityEvent } from "../securityAudit.js";
import { captureServerException } from "../sentry.js";
import { logWarn } from "../logger.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

function extractRequestIp(request: Request | undefined): string | null {
  if (!request) return null;
  const header =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  const value = header?.split(",")[0]?.trim();
  return value || null;
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$/.test(value);
}

type GetUserProfileFn = typeof getUserProfile;
type UpsertUserProfileFn = typeof upsertUserProfile;
type ConsumeRateLimitFn = typeof consumeRateLimit;
type ComparePasswordFn = typeof bcrypt.compare;
type LogSecurityEventFn = typeof logSecurityEvent;
type LogWarnFn = typeof logWarn;

type CredentialsAuthorizeDeps = {
  getUserProfileFn?: GetUserProfileFn;
  upsertUserProfileFn?: UpsertUserProfileFn;
  consumeRateLimitFn?: ConsumeRateLimitFn;
  comparePasswordFn?: ComparePasswordFn;
  logSecurityEventFn?: LogSecurityEventFn;
  logWarnFn?: LogWarnFn;
};

type JwtRoleClaimsToken = {
  email?: string | null;
  uid?: string;
  sub?: string | null;
  isAdmin?: boolean;
  role?: string;
};

async function persistLoginFailure(
  profile: UserProfile | null,
  request: Request | undefined,
  userId: string,
  deps: { upsertUserProfileFn: UpsertUserProfileFn; logSecurityEventFn: LogSecurityEventFn },
): Promise<void> {
  if (!profile) {
    await deps.logSecurityEventFn({
      eventType: "login_failure",
      userId,
      request,
      details: { reason: "invalid_credentials", hasProfile: false },
    });
    return;
  }

  const nextCount = (profile.failedLoginCount ?? 0) + 1;
  profile.failedLoginCount = nextCount;
  if (nextCount >= LOCKOUT_MAX_ATTEMPTS) {
    profile.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
  }
  await deps.upsertUserProfileFn(profile.id, profile);
  await deps.logSecurityEventFn({
    eventType: nextCount >= LOCKOUT_MAX_ATTEMPTS ? "account_locked" : "login_failure",
    userId: profile.id,
    request,
    details: {
      failedLoginCount: nextCount,
      lockedUntil: profile.lockedUntil ?? null,
    },
  });
}

async function clearLoginFailure(
  profile: UserProfile,
  deps: { upsertUserProfileFn: UpsertUserProfileFn },
): Promise<void> {
  if (!profile.failedLoginCount && !profile.lockedUntil) return;
  profile.failedLoginCount = 0;
  profile.lockedUntil = null;
  await deps.upsertUserProfileFn(profile.id, profile);
}

export function createCredentialsAuthorize(deps: CredentialsAuthorizeDeps = {}) {
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  const upsertUserProfileFn = deps.upsertUserProfileFn ?? upsertUserProfile;
  const consumeRateLimitFn = deps.consumeRateLimitFn ?? consumeRateLimit;
  const comparePasswordFn = deps.comparePasswordFn ?? bcrypt.compare;
  const logSecurityEventFn = deps.logSecurityEventFn ?? logSecurityEvent;
  const logWarnFn = deps.logWarnFn ?? logWarn;

  return async function authorize(credentials: Record<string, unknown> | undefined, request: Request | undefined) {
    const rawIdentifier =
      typeof credentials?.identifier === "string"
        ? credentials.identifier
        : typeof credentials?.email === "string"
          ? credentials.email
          : "";
    const normalizedIdentifier = normalizeIdentifier(rawIdentifier);
    const password = typeof credentials?.password === "string" ? credentials.password : "";

    if (!normalizedIdentifier || !password) return null;
    const identifier = normalizedIdentifier.value;
    const ip = extractRequestIp(request);
    if (ip) {
      const authRate = await consumeRateLimitFn({
        route: "POST /api/auth/callback/credentials",
        key: `${ip}:${identifier}`,
        windowSeconds: 15 * 60,
        max: 10,
        request,
        userId: identifier,
      });
      if (!authRate.allowed) {
        return null;
      }
    }

    const profile = await getUserProfileFn(identifier);
    if (profile?.role === "admin") {
      if (profile.lockedUntil && new Date(profile.lockedUntil).getTime() > Date.now()) {
        await logSecurityEventFn({
          eventType: "login_failure",
          userId: profile.id,
          request,
          details: { reason: "account_locked", lockedUntil: profile.lockedUntil },
        });
        return null;
      }
      if (!profile.passwordHash) {
        await persistLoginFailure(profile, request, identifier, { upsertUserProfileFn, logSecurityEventFn });
        return null;
      }
      const adminMatch = await comparePasswordFn(password, profile.passwordHash);
      if (adminMatch) {
        await clearLoginFailure(profile, { upsertUserProfileFn });
        await logSecurityEventFn({
          eventType: "login_success",
          userId: profile.id,
          request,
          details: { method: "credentials_admin_db" },
        });
        return {
          id: profile.id,
          name: profile.name || inferDefaultDisplayName(profile.email ?? profile.phone ?? profile.id),
          email: profile.email ?? undefined,
        };
      }
      await persistLoginFailure(profile, request, identifier, { upsertUserProfileFn, logSecurityEventFn });
      return null;
    }

    // Env-var bootstrap fallback: only fires when no DB admin matched above.
    // This emergency path is intentionally rate-limited but not tied to any
    // per-profile lockout state because it is configured at the server level.
    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
    const adminPassword = process.env.ADMIN_PASSWORD ?? "";
    if (adminEmail && adminPassword && normalizedIdentifier.type === "email" && identifier === adminEmail) {
      if (!isBcryptHash(adminPassword)) {
        logWarnFn("auth.admin_password_invalid_format", { userId: identifier });
        return null;
      }
      const adminMatch = await comparePasswordFn(password, adminPassword);
      if (adminMatch) {
        await logSecurityEventFn({
          eventType: "login_success",
          userId: identifier,
          request,
          details: { method: "credentials_admin_env_bootstrap" },
        });
        return { id: identifier, name: "Admin", email: identifier };
      }
      await logSecurityEventFn({
        eventType: "login_failure",
        userId: identifier,
        request,
        details: { reason: "invalid_admin_credentials" },
      });
      return null;
    }

    if (profile?.lockedUntil && new Date(profile.lockedUntil).getTime() > Date.now()) {
      await logSecurityEventFn({
        eventType: "login_failure",
        userId: profile.id,
        request,
        details: { reason: "account_locked", lockedUntil: profile.lockedUntil },
      });
      return null;
    }
    if (!profile?.passwordHash) {
      await persistLoginFailure(profile ?? null, request, identifier, { upsertUserProfileFn, logSecurityEventFn });
      return null;
    }

    const valid = await comparePasswordFn(password, profile.passwordHash);
    if (!valid) {
      await persistLoginFailure(profile, request, identifier, { upsertUserProfileFn, logSecurityEventFn });
      return null;
    }

    await clearLoginFailure(profile, { upsertUserProfileFn });
    await logSecurityEventFn({
      eventType: "login_success",
      userId: profile.id,
      request,
      details: { method: "credentials" },
    });

    const fallbackName = inferDefaultDisplayName(profile.email ?? profile.phone ?? profile.id);
    return { id: profile.id, name: profile.name || fallbackName, email: profile.email ?? undefined };
  };
}

export async function applyRoleClaimsToToken(
  token: JwtRoleClaimsToken,
  user: { email?: string | null; id?: string | null } | null | undefined,
  deps: { getUserProfileFn?: GetUserProfileFn } = {},
): Promise<JwtRoleClaimsToken> {
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  // Env-var admin email gets admin claims unconditionally. This takes precedence
  // over the DB profile lookup below, so the bootstrap email cannot be demoted
  // by a conflicting stored role in user_profiles.
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const email = normalizeEmail(user?.email ?? token.email);
  if (adminEmail && email && adminEmail === email) {
    token.isAdmin = true;
    token.role = "admin";
  }
  if (email) {
    token.uid = email.trim();
  } else if (user?.id) {
    token.uid = user.id.trim();
  } else if (typeof token.sub === "string" && token.sub.trim()) {
    token.uid = token.sub.trim();
  }
  if (!token.role) {
    const uid = typeof token.uid === "string" ? token.uid.trim() : "";
    if (uid) {
      try {
        const profile = await getUserProfileFn(uid);
        token.role = profile?.role ?? (profile?.isAdmin ? "admin" : "agent");
        if (profile?.role === "admin" || profile?.isAdmin === true) {
          token.isAdmin = true;
        }
      } catch {
        token.role = "agent";
      }
    } else {
      token.role = "agent";
    }
  }
  if (token.role === "admin") {
    token.isAdmin = true;
  } else if (token.isAdmin !== true) {
    token.isAdmin = false;
  }
  return token;
}

const providers: AppProviders = [
  Credentials({
    name: "Credentials",
    credentials: {
      identifier: { label: "Phone or email", type: "text" },
      email: { label: "Email", type: "text" },
      password: { label: "Password", type: "password" },
    },
    authorize: createCredentialsAuthorize(),
  }),
];

if (googleClientId && googleClientSecret) {
  providers.unshift(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      token: {
        async conform(response) {
          // Auth.js v0.33 throws "TODO: Handle OIDC response body error" when
          // the token response content-type isn't exactly "application/json".
          // Google sometimes returns "application/json; charset=utf-8" which
          // triggers this bug. Fix by re-wrapping with a clean content-type.
          if (!response.ok) {
            const body = await response.text().catch(() => "");
            const trimmed = body.length > 1200 ? `${body.slice(0, 1200)}…` : body;
            console.error("[auth] google token endpoint response error", {
              status: response.status,
              statusText: response.statusText,
              body: trimmed,
            });
            return undefined;
          }
          const contentType = response.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            // Re-create response with clean content-type so Auth.js parses it
            const body = await response.text();
            return new Response(body, {
              status: response.status,
              headers: { "Content-Type": "application/json" },
            });
          }
          return undefined;
        },
      },
    })
  );
}

export default async function handler(request: Request): Promise<Response> {
  try {
    const authSecret = getAuthSecret();
    if (!authSecret) {
      throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required for Auth.js");
    }
    const authBaseUrl = getAuthBaseUrl();
    if (!authBaseUrl) {
      throw new Error("AUTH_URL (or NEXTAUTH_URL) is required for Auth.js");
    }
    const normalizedRequest = await withAbsoluteUrl(request, authBaseUrl);
    return await Auth(normalizedRequest, {
      providers,
      secret: authSecret,
      session: { strategy: "jwt", maxAge: SESSION_CONFIG.maxAge, updateAge: SESSION_CONFIG.updateAge },
      // Auth.js requires trusted hosts. We already require AUTH_URL and normalize
      // relative auth requests against that configured origin before calling Auth().
      trustHost: true,
      basePath: "/api/auth",
      cookies: {
        sessionToken: {
          name: getSessionCookieName(),
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: isSecureRequest(),
          },
        },
      },
      events: {
        async signOut(message) {
          const token = "token" in message ? message.token : null;
          const uid = (token as { uid?: string } | null)?.uid;
          if (uid) {
            await logSecurityEvent({
              eventType: "logout",
              userId: uid,
              details: { method: "signout" },
            });
          }
        },
      },
      callbacks: {
        async signIn({ user, account }) {
          const email = normalizeEmail(user?.email);
          const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
          const isAdminAccount = Boolean(email && adminEmail && email === adminEmail);
          const provider = account?.provider ?? "unknown";

          if (!email) return true;
          if (!isAdminAccount && account?.provider !== "google") return true;

          try {
            if (isAdminAccount) {
              const existing = await getUserProfile(email);
              if (existing) {
                let shouldUpdate = false;
                if (!existing.isAdmin) {
                  existing.isAdmin = true;
                  shouldUpdate = true;
                }
                if (existing.mapScope !== "global") {
                  existing.mapScope = "global";
                  shouldUpdate = true;
                }
                if (shouldUpdate) {
                  await upsertUserProfile(email, existing);
                }
              } else {
                const profile: UserProfile = {
                  id: email,
                  name: user?.name ?? inferDefaultDisplayName(email),
                  email,
                  phone: null,
                  image: encodeAvatarPresetImage(DEFAULT_AVATAR_PRESET),
                  avatarPreset: DEFAULT_AVATAR_PRESET,
                  occupation: "",
                  XP: 0,
                  isAdmin: true,
                  mapScope: "global",
                };
                await upsertUserProfile(email, profile);
              }
              await logSecurityEvent({
                eventType: "login_success",
                userId: email,
                request: normalizedRequest,
                details: { method: provider },
              });
              return true;
            }

            const existing = await getUserProfile(email);
            if (existing) {
              if (!existing.mapScope) {
                existing.mapScope = "bonamoussadi";
                await upsertUserProfile(email, existing);
              }
              await logSecurityEvent({
                eventType: "login_success",
                userId: email,
                request: normalizedRequest,
                details: { method: provider },
              });
              return true;
            }

            const profile: UserProfile = {
              id: email,
              name: user?.name ?? inferDefaultDisplayName(email),
              email,
              phone: null,
              image: encodeAvatarPresetImage(DEFAULT_AVATAR_PRESET),
              avatarPreset: DEFAULT_AVATAR_PRESET,
              occupation: "",
              XP: 0,
              mapScope: "bonamoussadi",
            };
            await upsertUserProfile(email, profile);
            await logSecurityEvent({
              eventType: "login_success",
              userId: email,
              request: normalizedRequest,
              details: { method: provider },
            });
            return true;
          } catch (error) {
            // Do not block OAuth sign-in if profile sync fails.
            if (isStorageUnavailableError(error)) {
              console.error("[auth] profile sync skipped: storage unavailable", { email, provider });
              return true;
            }
            console.error("[auth] profile sync failed during sign-in", {
              email,
              provider,
              message: error instanceof Error ? error.message : String(error),
            });
            return true;
          }
        },
        async jwt({ token, user }) {
          return await applyRoleClaimsToToken(
            token as JwtRoleClaimsToken,
            user ? { email: user.email, id: (user as { id?: string }).id ?? null } : null,
          );
        },
        async session({ session, token }) {
          if (session.user && token?.uid) {
            (session.user as { id?: string }).id = token.uid as string;
          }
          if (session.user && (token as { isAdmin?: boolean })?.isAdmin !== undefined) {
            (session.user as { isAdmin?: boolean }).isAdmin = Boolean((token as { isAdmin?: boolean }).isAdmin);
          }
          if (session.user && (token as { role?: string })?.role) {
            (session.user as { role?: string }).role = (token as { role?: string }).role;
          }
          return session;
        },
      },
    });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    captureServerException(error, { route: "auth_handler" });
    throw error;
  }
}
