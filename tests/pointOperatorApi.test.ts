import assert from "node:assert/strict";
import test from "node:test";
import { createPointOperatorHandler } from "../lib/server/pointOperatorApi.js";
import type { PointOperatorAssignment, ProjectedPoint } from "../shared/types.js";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeRequest(
  view: string,
  opts: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Request {
  const url = `http://localhost/api/user?view=po_${view}`;
  const method = opts.method ?? "POST";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...opts.headers,
  };
  return new Request(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const MOCK_ASSIGNMENT: PointOperatorAssignment = {
  id: "assign-1",
  operatorUserId: "op@example.com",
  pointId: "point-1",
  status: "active",
  grantedBy: "admin@example.com",
  grantedAt: "2026-01-01T00:00:00.000Z",
};

const MOCK_POINT: ProjectedPoint = {
  id: "point-1",
  pointId: "point-1",
  category: "pharmacy",
  location: { latitude: 4.0511, longitude: 9.7679 },
  details: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  gaps: [],
  eventsCount: 1,
  eventIds: ["event-1"],
};

// ─── Auth / role guard tests ──────────────────────────────────────────────────

test("agent cannot call po_admin_create", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "agent@example.com", token: {}, role: "agent" }),
  });
  const response = await handler(makeRequest("admin_create"));
  assert.equal(response.status, 403);
});

test("client cannot call po_admin_create", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "client@example.com", token: {}, role: "client" }),
  });
  const response = await handler(makeRequest("admin_create"));
  assert.equal(response.status, 403);
});

test("unauthenticated request returns 401", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => null,
  });
  const response = await handler(makeRequest("admin_create"));
  assert.equal(response.status, 401);
});

test("point_operator cannot call po_admin_create", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
  });
  const response = await handler(makeRequest("admin_create"));
  assert.equal(response.status, 403);
});

test("agent cannot call po_status endpoint", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "agent@example.com", token: {}, role: "agent" }),
  });
  const response = await handler(
    makeRequest("status", {
      body: { field: "isOpenNow", value: true },
      headers: { "Idempotency-Key": "key-1" },
    }),
  );
  assert.equal(response.status, 403);
});

test("client cannot call po_status endpoint", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "client@example.com", token: {}, role: "client" }),
  });
  const response = await handler(
    makeRequest("status", {
      body: { field: "isOpenNow", value: true },
      headers: { "Idempotency-Key": "key-1" },
    }),
  );
  assert.equal(response.status, 403);
});

test("admin cannot call po_status endpoint (must be an operator)", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
  });
  const response = await handler(
    makeRequest("status", {
      body: { field: "isOpenNow", value: true },
      headers: { "Idempotency-Key": "key-1" },
    }),
  );
  assert.equal(response.status, 403);
});

// ─── po_status: spoofed field rejection ──────────────────────────────────────

test("operator status endpoint ignores client-supplied pointId", async () => {
  let received: unknown;
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    getActiveAssignmentByUserFn: async () => MOCK_ASSIGNMENT,
    getPointFn: async () => MOCK_POINT,
    submitSignalFn: async (input) => {
      received = input;
      return { eventId: "event-1" };
    },
  });
  const response = await handler(
    makeRequest("status", {
      body: { field: "isOpenNow", value: true, pointId: "spoofed" },
      headers: { "Idempotency-Key": "key-1" },
    }),
  );
  assert.equal(response.status, 201);
  // pointId must not be forwarded — it is resolved server-side from the assignment
  const r = received as Record<string, unknown>;
  assert.equal("pointId" in r, false, "pointId must not be forwarded to submitSignalFn");
  assert.equal(r.field, "isOpenNow");
  assert.equal(r.value, true);
  assert.equal(r.idempotencyKey, "key-1");
  assert.equal(r.operatorUserId, "op@example.com");
});

test("strict schema rejects spoofed category in status body", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    getActiveAssignmentByUserFn: async () => MOCK_ASSIGNMENT,
    getPointFn: async () => MOCK_POINT,
    submitSignalFn: async () => ({ eventId: "event-1" }),
  });
  const response = await handler(
    makeRequest("status", {
      // category is an extra field that strict() should reject
      body: { field: "isOpenNow", value: true, category: "pharmacy" },
      headers: { "Idempotency-Key": "key-1" },
    }),
  );
  assert.equal(response.status, 422);
});

// ─── po_status: missing idempotency key ──────────────────────────────────────

test("status endpoint requires Idempotency-Key header", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    getActiveAssignmentByUserFn: async () => MOCK_ASSIGNMENT,
    getPointFn: async () => MOCK_POINT,
    submitSignalFn: async () => ({ eventId: "event-1" }),
  });
  const response = await handler(
    makeRequest("status", {
      body: { field: "isOpenNow", value: true },
      // no Idempotency-Key
    }),
  );
  assert.equal(response.status, 422);
});

// ─── po_status: no active assignment ─────────────────────────────────────────

test("status endpoint returns 403 when operator has no active assignment", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    getActiveAssignmentByUserFn: async () => null,
    submitSignalFn: async () => ({ eventId: "event-1" }),
  });
  const response = await handler(
    makeRequest("status", {
      body: { field: "isOpenNow", value: true },
      headers: { "Idempotency-Key": "key-1" },
    }),
  );
  assert.equal(response.status, 403);
});

// ─── po_me: operator loads only assigned point ───────────────────────────────

test("po_me returns assignment and point for active operator", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    getActiveAssignmentByUserFn: async () => MOCK_ASSIGNMENT,
    getPointFn: async () => MOCK_POINT,
  });
  const response = await handler(makeRequest("me", { method: "GET" }));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { assignment: PointOperatorAssignment; point: ProjectedPoint };
  assert.equal(body.assignment.id, "assign-1");
  assert.equal(body.point.id, "point-1");
});

test("po_me returns 403 when operator has no active assignment", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    getActiveAssignmentByUserFn: async () => null,
  });
  const response = await handler(makeRequest("me", { method: "GET" }));
  assert.equal(response.status, 403);
});

// ─── po_admin_create: admin success ──────────────────────────────────────────

test("admin can create a point operator and receives the assignment", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    lifecycleFn: () => ({
      grant: async () => MOCK_ASSIGNMENT,
      revoke: async () => MOCK_ASSIGNMENT,
    }),
    getUserProfileFn: async () => null,
    upsertUserProfileFn: async () => {},
    hashPasswordFn: async (pw: string) => `hashed:${pw}`,
    logSecurityEventFn: async () => {},
  });
  const response = await handler(
    makeRequest("admin_create", {
      headers: { "Idempotency-Key": "idem-create-1" },
      body: {
        identifier: "newop@example.com",
        name: "New Op",
        password: "Secure1234!",
        pointId: "point-1",
      },
    }),
  );
  assert.equal(response.status, 201);
  const body = (await response.json()) as { assignment: PointOperatorAssignment };
  assert.equal(body.assignment.id, "assign-1");
});

test("po_admin_create rejects when operator already has an active point (409)", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    lifecycleFn: () => ({
      grant: async () => {
        throw new Error("Operator already has an active point");
      },
      revoke: async () => {
        throw new Error("not used");
      },
    }),
    getUserProfileFn: async () => null,
    upsertUserProfileFn: async () => {},
    hashPasswordFn: async (pw: string) => `hashed:${pw}`,
    logSecurityEventFn: async () => {},
  });
  const response = await handler(
    makeRequest("admin_create", {
      headers: { "Idempotency-Key": "idem-create-2" },
      body: {
        identifier: "op2@example.com",
        name: "Op Two",
        password: "Secure1234!",
        pointId: "point-2",
      },
    }),
  );
  assert.equal(response.status, 409);
});

test("po_admin_create returns 404 when point not found", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    lifecycleFn: () => ({
      grant: async () => {
        throw new Error("Verified point not found");
      },
      revoke: async () => {
        throw new Error("not used");
      },
    }),
    getUserProfileFn: async () => null,
    upsertUserProfileFn: async () => {},
    hashPasswordFn: async (pw: string) => `hashed:${pw}`,
    logSecurityEventFn: async () => {},
  });
  const response = await handler(
    makeRequest("admin_create", {
      headers: { "Idempotency-Key": "idem-create-3" },
      body: {
        identifier: "op3@example.com",
        name: "Op Three",
        password: "Secure1234!",
        pointId: "nonexistent",
      },
    }),
  );
  assert.equal(response.status, 404);
});

test("po_admin_create returns 403 when target is an admin account", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    lifecycleFn: () => ({
      grant: async () => {
        throw new Error("Admin accounts cannot become point operators");
      },
      revoke: async () => {
        throw new Error("not used");
      },
    }),
    getUserProfileFn: async () => null,
    upsertUserProfileFn: async () => {},
    hashPasswordFn: async (pw: string) => `hashed:${pw}`,
    logSecurityEventFn: async () => {},
  });
  const response = await handler(
    makeRequest("admin_create", {
      headers: { "Idempotency-Key": "idem-create-4" },
      body: {
        identifier: "other.admin@example.com",
        name: "Other Admin",
        password: "Secure1234!",
        pointId: "point-1",
      },
    }),
  );
  assert.equal(response.status, 403);
});

// ─── po_admin_revoke ──────────────────────────────────────────────────────────

test("admin can revoke an active operator assignment", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    lifecycleFn: () => ({
      grant: async () => MOCK_ASSIGNMENT,
      revoke: async () => ({ ...MOCK_ASSIGNMENT, status: "revoked" as const }),
    }),
    logSecurityEventFn: async () => {},
  });
  const response = await handler(
    makeRequest("admin_revoke", {
      headers: { "Idempotency-Key": "idem-revoke-1" },
      body: {
        operatorUserId: "op@example.com",
        reason: "Closed their business",
      },
    }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { assignment: PointOperatorAssignment };
  assert.equal(body.assignment.status, "revoked");
});

test("po_admin_revoke returns 404 when assignment not found", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    lifecycleFn: () => ({
      grant: async () => MOCK_ASSIGNMENT,
      revoke: async () => {
        throw new Error("Active operator assignment not found");
      },
    }),
    logSecurityEventFn: async () => {},
  });
  const response = await handler(
    makeRequest("admin_revoke", {
      headers: { "Idempotency-Key": "idem-revoke-2" },
      body: {
        operatorUserId: "nobody@example.com",
        reason: "Test reason",
      },
    }),
  );
  assert.equal(response.status, 404);
});

// ─── po_admin_assignment: admin can look up assignment history ────────────────

test("admin can retrieve assignment for an operator", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    getActiveAssignmentByUserFn: async () => MOCK_ASSIGNMENT,
  });
  const response = await handler(
    new Request("http://localhost/api/user?view=po_admin_assignment&operatorUserId=op@example.com", {
      method: "GET",
    }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { assignment: PointOperatorAssignment | null };
  assert.equal(body.assignment?.id, "assign-1");
});

// ─── po_admin_create: strict schema rejects point_operator role ───────────────
// (this is handled at the generic user endpoint, but we also verify
//  that the po_admin_create schema does not accept role fields)

test("po_admin_create schema rejects extra fields (strict)", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    getUserProfileFn: async () => null,
    upsertUserProfileFn: async () => {},
    hashPasswordFn: async (pw: string) => `hashed:${pw}`,
    logSecurityEventFn: async () => {},
  });
  const response = await handler(
    makeRequest("admin_create", {
      headers: { "Idempotency-Key": "idem-schema-1" },
      body: {
        identifier: "newop@example.com",
        name: "New Op",
        password: "Secure1234!",
        pointId: "point-1",
        // extra field: role should be rejected by strict schema
        role: "agent",
      },
    }),
  );
  assert.equal(response.status, 422);
});

// ─── po_password ──────────────────────────────────────────────────────────────

test("po_password rejects body with extra fields (strict schema)", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    getActiveAssignmentByUserFn: async () => MOCK_ASSIGNMENT,
  });
  const response = await handler(
    makeRequest("password", {
      headers: { "Idempotency-Key": "idem-pw-strict" },
      body: {
        currentPassword: "OldPass123",
        newPassword: "NewPass1234!",
        extraField: "bad",
      },
    }),
  );
  assert.equal(response.status, 422);
});

// ─── unknown view ─────────────────────────────────────────────────────────────

test("unknown po_ view returns 400", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
  });
  const response = await handler(
    new Request("http://localhost/api/user?view=po_unknown_view", {
      method: "GET",
    }),
  );
  assert.equal(response.status, 400);
});

// ─── Fix 1: po_admin_search_points real implementation ───────────────────────

test("po_admin_search_points returns all projected points when no query", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    searchAssignablePointsFn: async () => [MOCK_POINT],
  });
  const response = await handler(
    new Request("http://localhost/api/user?view=po_admin_search_points", {
      method: "GET",
    }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { points: ProjectedPoint[] };
  assert.equal(body.points.length, 1);
  assert.equal(body.points[0].pointId, "point-1");
});

test("po_admin_search_points passes query param to searchFn and returns matches", async () => {
  let receivedQuery: string | undefined;
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    searchAssignablePointsFn: async (q) => {
      receivedQuery = q;
      // Only return MOCK_POINT if query matches "pharmacy"
      return q && MOCK_POINT.category.includes(q) ? [MOCK_POINT] : [];
    },
  });
  const response = await handler(
    new Request("http://localhost/api/user?view=po_admin_search_points&q=pharmacy", {
      method: "GET",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(receivedQuery, "pharmacy");
  const body = (await response.json()) as { points: ProjectedPoint[] };
  assert.equal(body.points.length, 1);
});

test("po_admin_search_points excludes projected-away points (not returned by searchFn)", async () => {
  // A "projected-away" point is one not returned by the store (projection returned null for it).
  // The fake searchFn returns only the verified point, not the projected-away one.
  const projectedAwayPoint: ProjectedPoint = {
    ...MOCK_POINT,
    id: "point-gone",
    pointId: "point-gone",
  };
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    searchAssignablePointsFn: async () =>
      // searchAssignableProjectedPoints only returns points that projected successfully;
      // "point-gone" is excluded because its projection returned null.
      [MOCK_POINT],
  });
  const response = await handler(
    new Request("http://localhost/api/user?view=po_admin_search_points", {
      method: "GET",
    }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { points: ProjectedPoint[] };
  // projected-away point must not appear
  const ids = body.points.map((p) => p.pointId);
  assert.equal(ids.includes(projectedAwayPoint.pointId), false, "projected-away point must be excluded");
  assert.equal(ids.includes(MOCK_POINT.pointId), true, "verified point must be included");
});

test("non-admin cannot call po_admin_search_points", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    searchAssignablePointsFn: async () => [MOCK_POINT],
  });
  const response = await handler(
    new Request("http://localhost/api/user?view=po_admin_search_points", {
      method: "GET",
    }),
  );
  assert.equal(response.status, 403);
});

// ─── Fix 2: audit fires for existing-account grants ──────────────────────────

test("audit event fires even when operator account already exists", async () => {
  const auditEvents: Array<{ eventType: string; details: Record<string, unknown> }> = [];
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    lifecycleFn: () => ({
      grant: async () => MOCK_ASSIGNMENT,
      revoke: async () => MOCK_ASSIGNMENT,
    }),
    // Simulate existing account: getUserProfileFn returns a profile
    getUserProfileFn: async () => ({
      id: "op@example.com",
      name: "Existing Op",
      email: "op@example.com",
      phone: null,
      image: null,
      avatarPreset: null,
      occupation: "",
      XP: 100,
      isAdmin: false,
      role: "point_operator" as const,
      mapScope: "bonamoussadi" as const,
      trustScore: 50,
      trustTier: "standard" as const,
      failedLoginCount: 0,
      lockedUntil: null,
      wipeRequested: false,
      suspendedUntil: null,
      mustChangePassword: false,
    }),
    upsertUserProfileFn: async () => {},
    hashPasswordFn: async (pw: string) => `hashed:${pw}`,
    logSecurityEventFn: async (event) => {
      auditEvents.push({
        eventType: event.eventType,
        details: event.details as Record<string, unknown>,
      });
    },
  });

  const response = await handler(
    makeRequest("admin_create", {
      headers: { "Idempotency-Key": "idem-existing-1" },
      body: {
        identifier: "op@example.com",
        name: "Existing Op",
        password: "Secure1234!",
        pointId: "point-1",
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(auditEvents.length, 1, "audit event must fire for existing-account grant");
  assert.equal(auditEvents[0].eventType, "point_operator_granted");
  assert.equal(auditEvents[0].details.accountProvisioned, false, "accountProvisioned must be false for existing accounts");
});

test("audit event fires for new account with accountProvisioned=true", async () => {
  const auditEvents: Array<{ eventType: string; details: Record<string, unknown> }> = [];
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    lifecycleFn: () => ({
      grant: async () => MOCK_ASSIGNMENT,
      revoke: async () => MOCK_ASSIGNMENT,
    }),
    getUserProfileFn: async () => null, // new account
    upsertUserProfileFn: async () => {},
    hashPasswordFn: async (pw: string) => `hashed:${pw}`,
    logSecurityEventFn: async (event) => {
      auditEvents.push({
        eventType: event.eventType,
        details: event.details as Record<string, unknown>,
      });
    },
  });

  const response = await handler(
    makeRequest("admin_create", {
      headers: { "Idempotency-Key": "idem-new-1" },
      body: {
        identifier: "brand.new@example.com",
        name: "Brand New Op",
        password: "Secure1234!",
        pointId: "point-1",
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(auditEvents.length, 1, "audit event must fire for new account grant");
  assert.equal(auditEvents[0].eventType, "point_operator_granted");
  assert.equal(auditEvents[0].details.accountProvisioned, true, "accountProvisioned must be true for new accounts");
});

// ─── Fix 3: idempotency key required on all po_ writes ───────────────────────

test("po_admin_create returns 422 when Idempotency-Key header is missing", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    getUserProfileFn: async () => null,
    upsertUserProfileFn: async () => {},
    hashPasswordFn: async (pw: string) => `hashed:${pw}`,
    logSecurityEventFn: async () => {},
  });
  const response = await handler(
    makeRequest("admin_create", {
      // no Idempotency-Key header
      body: {
        identifier: "op@example.com",
        name: "Op",
        password: "Secure1234!",
        pointId: "point-1",
      },
    }),
  );
  assert.equal(response.status, 422);
});

test("po_admin_revoke returns 422 when Idempotency-Key header is missing", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "admin@example.com", token: {}, role: "admin" }),
    lifecycleFn: () => ({
      grant: async () => MOCK_ASSIGNMENT,
      revoke: async () => ({ ...MOCK_ASSIGNMENT, status: "revoked" as const }),
    }),
    logSecurityEventFn: async () => {},
  });
  const response = await handler(
    makeRequest("admin_revoke", {
      // no Idempotency-Key header
      body: {
        operatorUserId: "op@example.com",
        reason: "Test",
      },
    }),
  );
  assert.equal(response.status, 422);
});

test("po_password returns 422 when Idempotency-Key header is missing", async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({ id: "op@example.com", token: {}, role: "point_operator" }),
    getActiveAssignmentByUserFn: async () => MOCK_ASSIGNMENT,
  });
  const response = await handler(
    makeRequest("password", {
      // no Idempotency-Key header
      body: {
        currentPassword: "OldPass123",
        newPassword: "NewPass1234!",
      },
    }),
  );
  assert.equal(response.status, 422);
});
