import assert from "node:assert/strict";
import test from "node:test";
import { createAdminAccountAccessHandler, createAdminAccountCreateHandler } from "../api/user/index.js";
import type { UserProfile } from "../shared/types.js";

function makeCreateRequest(body: unknown): Request {
  return new Request("http://localhost/api/user?view=account_create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.44",
    },
    body: JSON.stringify(body),
  });
}

function makeAccessRequest(body: unknown): Request {
  return new Request("http://localhost/api/user?view=account_access", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.44",
    },
    body: JSON.stringify(body),
  });
}

test("admin account create handler creates a client account by default", async () => {
  let saved: { id: string; profile: UserProfile } | null = null;
  const auditEvents: Array<{ eventType: string; userId?: string | null; details?: Record<string, unknown> | null }> = [];

  const handler = createAdminAccountCreateHandler({
    getUserProfileFn: async () => null,
    hashPasswordFn: async (password) => `hashed:${password}`,
    upsertUserProfileFn: async (id, profile) => {
      saved = { id, profile };
    },
    logSecurityEventFn: async (input) => {
      auditEvents.push({
        eventType: input.eventType,
        userId: input.userId,
        details: input.details,
      });
    },
  });

  const response = await handler(
    makeCreateRequest({
      identifier: "New.Client@Example.com",
      name: "New Client",
      password: "ClientPass123!",
    }),
    "admin.ops@adl.test",
  );

  assert.equal(response.status, 201);
  assert.notEqual(saved, null);
  assert.equal(saved?.id, "new.client@example.com");
  assert.equal(saved?.profile.id, "new.client@example.com");
  assert.equal(saved?.profile.email, "new.client@example.com");
  assert.equal(saved?.profile.phone, null);
  assert.equal(saved?.profile.name, "New Client");
  assert.equal(saved?.profile.role, "client");
  assert.equal(saved?.profile.isAdmin, false);
  assert.equal(saved?.profile.mapScope, "bonamoussadi");
  assert.equal(saved?.profile.passwordHash, "hashed:ClientPass123!");
  assert.equal(saved?.profile.XP, 0);
  assert.equal(saved?.profile.trustScore, 50);
  assert.equal(saved?.profile.trustTier, "standard");

  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.id, "new.client@example.com");
  assert.equal(body.role, "client");
  assert.equal(Object.prototype.hasOwnProperty.call(body, "passwordHash"), false);

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0]?.eventType, "admin_account_created");
  assert.equal(auditEvents[0]?.userId, "new.client@example.com");
  assert.equal(auditEvents[0]?.details?.actorUserId, "admin.ops@adl.test");
  assert.equal(auditEvents[0]?.details?.role, "client");
});

test("admin account create handler creates admin accounts with global access", async () => {
  let saved: UserProfile | null = null;
  const handler = createAdminAccountCreateHandler({
    getUserProfileFn: async () => null,
    hashPasswordFn: async (password) => `hashed:${password}`,
    upsertUserProfileFn: async (_id, profile) => {
      saved = profile;
    },
    logSecurityEventFn: async () => {},
  });

  const response = await handler(
    makeCreateRequest({
      identifier: "ops-admin@example.com",
      name: "Ops Admin",
      role: "admin",
      password: "AdminPass123!",
    }),
    "admin.ops@adl.test",
  );

  assert.equal(response.status, 201);
  assert.equal(saved?.role, "admin");
  assert.equal(saved?.isAdmin, true);
  assert.equal(saved?.mapScope, "global");
});

test("admin account create handler rejects duplicate identifiers", async () => {
  let upsertCalls = 0;
  const handler = createAdminAccountCreateHandler({
    getUserProfileFn: async () => ({
      id: "existing@example.com",
      name: "Existing",
      email: "existing@example.com",
      XP: 0,
      role: "client",
    }),
    upsertUserProfileFn: async () => {
      upsertCalls += 1;
    },
    logSecurityEventFn: async () => {},
  });

  const response = await handler(
    makeCreateRequest({
      identifier: "existing@example.com",
      name: "Existing",
      password: "ClientPass123!",
    }),
    "admin.ops@adl.test",
  );

  assert.equal(response.status, 409);
  assert.equal(upsertCalls, 0);
});

test("admin account create handler rejects invalid identifiers", async () => {
  let profileLookups = 0;
  const handler = createAdminAccountCreateHandler({
    getUserProfileFn: async () => {
      profileLookups += 1;
      return null;
    },
    logSecurityEventFn: async () => {},
  });

  const response = await handler(
    makeCreateRequest({
      identifier: "not-an-email-or-phone",
      password: "ClientPass123!",
    }),
    "admin.ops@adl.test",
  );

  assert.equal(response.status, 400);
  assert.equal(profileLookups, 0);
});

test("admin account access handler updates roles even if audit logging is unavailable", async () => {
  let saved: UserProfile | null = null;
  const handler = createAdminAccountAccessHandler({
    getUserProfileFn: async () => ({
      id: "field.agent@example.com",
      name: "Field Agent",
      email: "field.agent@example.com",
      XP: 10,
      role: "agent",
      isAdmin: false,
      mapScope: "bonamoussadi",
    }),
    upsertUserProfileFn: async (_id, profile) => {
      saved = profile;
    },
    logSecurityEventFn: async () => {
      throw new Error("security_audit_log unavailable");
    },
  });

  const originalWarn = console.warn;
  console.warn = () => {};
  let response: Response;
  try {
    response = await handler(
      makeAccessRequest({
        userId: "field.agent@example.com",
        role: "admin",
      }),
      "ops-admin@example.com",
    );
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(response.status, 200);
  assert.equal(saved?.role, "admin");
  assert.equal(saved?.isAdmin, true);
  assert.equal(saved?.mapScope, "global");

  const body = (await response.json()) as UserProfile;
  assert.equal(body.role, "admin");
  assert.equal(body.isAdmin, true);
  assert.equal(body.mapScope, "global");
});

test("admin account access handler returns a controlled self-edit error", async () => {
  let upsertCalls = 0;
  const handler = createAdminAccountAccessHandler({
    getUserProfileFn: async () => null,
    upsertUserProfileFn: async () => {
      upsertCalls += 1;
    },
    logSecurityEventFn: async () => {},
  });

  const response = await handler(
    makeAccessRequest({
      userId: "Ops-Admin@Example.com",
      role: "agent",
    }),
    "ops-admin@example.com",
  );

  assert.equal(response.status, 400);
  assert.equal(upsertCalls, 0);
  const body = (await response.json()) as { error?: string };
  assert.match(body.error ?? "", /cannot change their own role/i);
});
