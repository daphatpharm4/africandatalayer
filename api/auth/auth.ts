import { Auth } from "@auth/core";
import Credentials from "@auth/core/providers/credentials";
import Google from "@auth/core/providers/google";
import type { AppProviders } from "@auth/core/providers";
import bcrypt from "bcryptjs";
import type { UserProfile } from "../../shared/types.js";
import { errorResponse } from "../../lib/server/http.js";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import { getAuthSecret, getSessionCookieName, isSecureRequest } from "../../lib/auth.js";
import { inferDefaultDisplayName, normalizeEmail, normalizeIdentifier } from "../../lib/shared/identifier.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

const providers: AppProviders = [
  Credentials({
    name: "Credentials",
    credentials: {
      identifier: { label: "Phone or email", type: "text" },
      email: { label: "Email", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
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

      const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
      const adminPassword = process.env.ADMIN_PASSWORD ?? "";
      if (adminEmail && adminPassword && normalizedIdentifier.type === "email" && identifier === adminEmail) {
        let adminMatch = false;
        if (adminPassword.startsWith("$2")) {
          adminMatch = await bcrypt.compare(password, adminPassword);
        } else {
          // Fallback for plain-text password (legacy). Update ADMIN_PASSWORD to a bcrypt hash.
          console.warn("[auth] ADMIN_PASSWORD is not a bcrypt hash. Please update it to a bcrypt hash.");
          adminMatch = password === adminPassword;
        }
        if (adminMatch) return { id: identifier, name: "Admin", email: identifier };
      }

      const profile = await getUserProfile(identifier);
      if (!profile?.passwordHash) return null;

      const valid = bcrypt.compareSync(password, profile.passwordHash);
      if (!valid) return null;

      const fallbackName = inferDefaultDisplayName(profile.email ?? profile.phone ?? profile.id);
      return { id: profile.id, name: profile.name || fallbackName, email: profile.email ?? undefined };
    },
  }),
];

if (googleClientId && googleClientSecret) {
  providers.unshift(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
}

const authSecret = getAuthSecret();
if (!authSecret) {
  throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is required for Auth.js");
}

async function withAbsoluteUrl(request: Request): Promise<Request> {
  try {
    // eslint-disable-next-line no-new
    new URL(request.url);
    return request;
  } catch {
    const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const url = new URL(request.url || "/", base);
    const method = request.method ?? "GET";
    const init: RequestInit = {
      method,
      headers: request.headers,
      redirect: request.redirect,
    };
    if (method !== "GET" && method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }
    return new Request(url, init);
  }
}

export default async function handler(request: Request): Promise<Response> {
  try {
    const normalizedRequest = await withAbsoluteUrl(request);
    return await Auth(normalizedRequest, {
      providers,
      secret: authSecret,
      session: { strategy: "jwt" },
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
      callbacks: {
        async signIn({ user, account }) {
          const email = normalizeEmail(user?.email);
          const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);

          if (email && adminEmail && email === adminEmail) {
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
                image: user?.image ?? "",
                occupation: "",
                XP: 0,
                isAdmin: true,
                mapScope: "global",
              };
              await upsertUserProfile(email, profile);
            }
            return true;
          }

          if (account?.provider !== "google") return true;
          if (!email) return true;

          const existing = await getUserProfile(email);
          if (existing) {
            if (!existing.mapScope) {
              existing.mapScope = "bonamoussadi";
              await upsertUserProfile(email, existing);
            }
            return true;
          }

          const profile: UserProfile = {
            id: email,
            name: user?.name ?? inferDefaultDisplayName(email),
            email,
            phone: null,
            image: user?.image ?? "",
            occupation: "",
            XP: 0,
            mapScope: "bonamoussadi",
          };
          await upsertUserProfile(email, profile);
          return true;
        },
        async jwt({ token, user }) {
          const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
          const email = normalizeEmail(user?.email ?? token?.email);
          if (adminEmail && email && adminEmail === email) {
            (token as { isAdmin?: boolean }).isAdmin = true;
          } else {
            (token as { isAdmin?: boolean }).isAdmin = false;
          }
          if (email) {
            (token as { uid?: string }).uid = email.trim();
          } else if (user) {
            const id = (user as { id?: string }).id ?? user.email;
            if (id) (token as { uid?: string }).uid = id;
          }
          return token;
        },
        async session({ session, token }) {
          if (session.user && token?.uid) {
            (session.user as { id?: string }).id = token.uid as string;
          }
          if (session.user && (token as { isAdmin?: boolean })?.isAdmin !== undefined) {
            (session.user as { isAdmin?: boolean }).isAdmin = Boolean((token as { isAdmin?: boolean }).isAdmin);
          }
          return session;
        },
      },
    });
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
    }
    throw error;
  }
}
