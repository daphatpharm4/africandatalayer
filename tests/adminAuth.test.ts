import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { applyRoleClaimsToToken, createCredentialsAuthorize } from "../lib/server/auth/handler.js";
import type { UserProfile } from "../shared/types.js";

function makeAuthRequest(ip = "203.0.113.10"): Request {
  return new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

async function withAdminEnv<T>(
  values: { email?: string; passwordHash?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const previousEmail = process.env.ADMIN_EMAIL;
  const previousPassword = process.env.ADMIN_PASSWORD;

  if (values.email === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = values.email;

  if (values.passwordHash === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = values.passwordHash;

  try {
    return await fn();
  } finally {
    if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previousEmail;

    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
}

test("credentials authorize authenticates admin user from DB profile with role=admin", async () => {
  const dbHash = await bcrypt.hash("DbAdmin123!", 4);
  const events: string[] = [];
  const authorize = createCredentialsAuthorize({
    consumeRateLimitFn: async () => ({ allowed: true, remaining: 9, retryAfterSeconds: 60, count: 1 }),
    getUserProfileFn: async () =>
      ({
        id: "admin@example.com",
        name: "DB Admin",
        email: "admin@example.com",
        XP: 0,
        role: "admin",
        passwordHash: dbHash,
      }) satisfies UserProfile,
    logSecurityEventFn: async ({ details }) => {
      events.push(String((details as { method?: string } | undefined)?.method ?? ""));
    },
  });

  const user = await withAdminEnv({}, async () =>
    authorize(
      { identifier: "admin@example.com", password: "DbAdmin123!" },
      makeAuthRequest(),
    ));

  assert.deepEqual(user, {
    id: "admin@example.com",
    name: "DB Admin",
    email: "admin@example.com",
  });
  assert.deepEqual(events, ["credentials_admin_db"]);
});

test("credentials authorize still allows env bootstrap admin when no DB admin exists", async () => {
  const envHash = await bcrypt.hash("Bootstrap123!", 4);
  const events: string[] = [];
  const authorize = createCredentialsAuthorize({
    consumeRateLimitFn: async () => ({ allowed: true, remaining: 9, retryAfterSeconds: 60, count: 1 }),
    getUserProfileFn: async () => null,
    logSecurityEventFn: async ({ details }) => {
      events.push(String((details as { method?: string } | undefined)?.method ?? ""));
    },
  });

  const user = await withAdminEnv(
    { email: "admin@example.com", passwordHash: envHash },
    async () =>
      authorize(
        { identifier: "admin@example.com", password: "Bootstrap123!" },
        makeAuthRequest(),
      ),
  );

  assert.deepEqual(user, {
    id: "admin@example.com",
    name: "Admin",
    email: "admin@example.com",
  });
  assert.deepEqual(events, ["credentials_admin_env_bootstrap"]);
});

test("credentials authorize prefers DB admin over env bootstrap for the same email", async () => {
  const dbHash = await bcrypt.hash("DbPreferred123!", 4);
  const envHash = await bcrypt.hash("EnvBootstrap123!", 4);
  const authorize = createCredentialsAuthorize({
    consumeRateLimitFn: async () => ({ allowed: true, remaining: 9, retryAfterSeconds: 60, count: 1 }),
    getUserProfileFn: async () =>
      ({
        id: "admin@example.com",
        name: "DB Preferred Admin",
        email: "admin@example.com",
        XP: 0,
        role: "admin",
        passwordHash: dbHash,
      }) satisfies UserProfile,
    logSecurityEventFn: async () => {},
  });

  const user = await withAdminEnv(
    { email: "admin@example.com", passwordHash: envHash },
    async () =>
      authorize(
        { identifier: "admin@example.com", password: "DbPreferred123!" },
        makeAuthRequest(),
      ),
  );

  assert.deepEqual(user, {
    id: "admin@example.com",
    name: "DB Preferred Admin",
    email: "admin@example.com",
  });
});

test("credentials authorize rejects locked DB admin even with correct password", async () => {
  const dbHash = await bcrypt.hash("DbAdmin123!", 4);
  const events: Array<{ eventType: string; details: Record<string, unknown> }> = [];
  const authorize = createCredentialsAuthorize({
    consumeRateLimitFn: async () => ({ allowed: true, remaining: 9, retryAfterSeconds: 60, count: 1 }),
    getUserProfileFn: async () =>
      ({
        id: "locked-admin@example.com",
        name: "Locked Admin",
        email: "locked-admin@example.com",
        XP: 0,
        role: "admin",
        passwordHash: dbHash,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }) satisfies UserProfile,
    logSecurityEventFn: async ({ eventType, details }) => {
      events.push({ eventType, details: details as Record<string, unknown> });
    },
  });

  const user = await withAdminEnv({}, async () =>
    authorize(
      { identifier: "locked-admin@example.com", password: "DbAdmin123!" },
      makeAuthRequest(),
    ));

  assert.equal(user, null);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "login_failure");
  assert.equal(events[0].details.reason, "account_locked");
});

test("credentials authorize increments lockout counter on DB admin wrong password", async () => {
  const dbHash = await bcrypt.hash("CorrectPass123!", 4);
  let savedProfile: UserProfile | null = null;
  const authorize = createCredentialsAuthorize({
    consumeRateLimitFn: async () => ({ allowed: true, remaining: 9, retryAfterSeconds: 60, count: 1 }),
    getUserProfileFn: async () =>
      ({
        id: "admin@example.com",
        name: "DB Admin",
        email: "admin@example.com",
        XP: 0,
        role: "admin",
        passwordHash: dbHash,
        failedLoginCount: 3,
      }) satisfies UserProfile,
    upsertUserProfileFn: async (_id, profile) => {
      savedProfile = profile as UserProfile;
    },
    logSecurityEventFn: async () => {},
  });

  const user = await withAdminEnv({}, async () =>
    authorize(
      { identifier: "admin@example.com", password: "WrongPass123!" },
      makeAuthRequest(),
    ));

  assert.equal(user, null);
  assert.notEqual(savedProfile, null);
  assert.equal((savedProfile as UserProfile).failedLoginCount, 4);
});

test("credentials authorize locks DB admin after 5 failed attempts", async () => {
  const dbHash = await bcrypt.hash("CorrectPass123!", 4);
  let savedProfile: UserProfile | null = null;
  const events: Array<{ eventType: string }> = [];
  const authorize = createCredentialsAuthorize({
    consumeRateLimitFn: async () => ({ allowed: true, remaining: 9, retryAfterSeconds: 60, count: 1 }),
    getUserProfileFn: async () =>
      ({
        id: "admin@example.com",
        name: "DB Admin",
        email: "admin@example.com",
        XP: 0,
        role: "admin",
        passwordHash: dbHash,
        failedLoginCount: 4,
      }) satisfies UserProfile,
    upsertUserProfileFn: async (_id, profile) => {
      savedProfile = profile as UserProfile;
    },
    logSecurityEventFn: async ({ eventType }) => {
      events.push({ eventType });
    },
  });

  const user = await withAdminEnv({}, async () =>
    authorize(
      { identifier: "admin@example.com", password: "WrongPass123!" },
      makeAuthRequest(),
    ));

  assert.equal(user, null);
  assert.notEqual(savedProfile, null);
  assert.equal((savedProfile as UserProfile).failedLoginCount, 5);
  assert.notEqual((savedProfile as UserProfile).lockedUntil, null);
  assert.equal(events.some((e) => e.eventType === "account_locked"), true);
});

test("credentials authorize rejects rate-limited admin", async () => {
  const dbHash = await bcrypt.hash("DbAdmin123!", 4);
  let profileLookups = 0;
  let compareCalls = 0;
  const authorize = createCredentialsAuthorize({
    consumeRateLimitFn: async () => ({ allowed: false, remaining: 0, retryAfterSeconds: 60, count: 11 }),
    comparePasswordFn: async () => {
      compareCalls += 1;
      return true;
    },
    getUserProfileFn: async () => {
      profileLookups += 1;
      return {
        id: "admin@example.com",
        name: "DB Admin",
        email: "admin@example.com",
        XP: 0,
        role: "admin",
        passwordHash: dbHash,
      } satisfies UserProfile;
    },
    logSecurityEventFn: async () => {},
  });

  const user = await withAdminEnv({}, async () =>
    authorize(
      { identifier: "admin@example.com", password: "DbAdmin123!" },
      makeAuthRequest(),
    ));

  assert.equal(user, null);
  assert.equal(profileLookups, 0);
  assert.equal(compareCalls, 0);
});

test("jwt role claims mark DB admins as admin even when they are not the env bootstrap admin", async () => {
  const token = await withAdminEnv({}, async () =>
    applyRoleClaimsToToken(
      { email: "db-admin@example.com" },
      { email: "db-admin@example.com", id: "db-admin@example.com" },
      {
        getUserProfileFn: async () =>
          ({
            id: "db-admin@example.com",
            name: "DB Admin",
            email: "db-admin@example.com",
            XP: 0,
            role: "admin",
          }) satisfies UserProfile,
      },
    ),
  );

  assert.equal(token.role, "admin");
  assert.equal(token.isAdmin, true);
  assert.equal(token.uid, "db-admin@example.com");
});
