import assert from "node:assert/strict";
import test from "node:test";
import type {
  PointOperatorAssignment,
  ProjectedPoint,
  UserProfile,
} from "../shared/types.js";
import {
  PointOperatorConflictError,
  createPointOperatorLifecycle,
} from "../lib/server/pointOperatorService.js";
import {
  PointOperatorDataIntegrityError,
  createPointOperatorStore,
  type GrantAssignmentInput,
} from "../lib/server/pointOperatorStore.js";
import type { ReadableProjectedPoint } from "../lib/server/submissionEvents.js";

function assignment(overrides: Partial<PointOperatorAssignment> = {}): PointOperatorAssignment {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    operatorUserId: "operator@example.com",
    pointId: "point-1",
    status: "active",
    grantedBy: "admin@example.com",
    grantedAt: "2026-06-24T08:00:00.000Z",
    revokedBy: null,
    revokedAt: null,
    revokeReason: null,
    ...overrides,
  };
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "operator@example.com",
    email: "operator@example.com",
    phone: null,
    name: "Operator",
    XP: 0,
    role: "agent",
    mapScope: "cameroon",
    ...overrides,
  };
}

function projectedPoint(pointId = "point-1"): ProjectedPoint {
  return {
    id: pointId,
    pointId,
    category: "pharmacy",
    location: { latitude: 4.08, longitude: 9.73 },
    details: { name: "Server Pharmacy" },
    createdAt: "2026-06-24T07:00:00.000Z",
    updatedAt: "2026-06-24T07:00:00.000Z",
    gaps: [],
    eventsCount: 1,
    eventIds: ["event-1"],
  };
}

function lifecycleDeps(
  overrides: Partial<Parameters<typeof createPointOperatorLifecycle>[0]> = {},
): Parameters<typeof createPointOperatorLifecycle>[0] {
  return {
    getReadablePointFn: async () => ({
      point: projectedPoint(),
      source: { kind: "point_event" },
    }),
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => null,
    getProfileFn: async () => profile(),
    transactionFn: async () => assignment(),
    revokeFn: async () => assignment({ status: "revoked" }),
    ...overrides,
  };
}

test("grant rejects a missing verified projected point", async () => {
  let transactionCalled = false;
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      getReadablePointFn: async () => null,
      transactionFn: async () => {
        transactionCalled = true;
        return assignment();
      },
    }),
  );

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "missing-point",
    }),
    /Verified point not found/,
  );
  assert.equal(transactionCalled, false);
});

test("grant rejects an operator that already has an active point", async () => {
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      getActiveByOperatorFn: async () => assignment(),
    }),
  );

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "point-2",
    }),
    /Operator already has an active point/,
  );
});

test("grant rejects a point that already has an active operator", async () => {
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      getActiveByPointFn: async () => assignment(),
    }),
  );

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator-2@example.com",
      pointId: "point-1",
    }),
    /Point already has an active operator/,
  );
});

test("grant requires an existing profile and rejects an admin target", async () => {
  const missingLifecycle = createPointOperatorLifecycle(
    lifecycleDeps({ getProfileFn: async () => null }),
  );
  await assert.rejects(
    missingLifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "missing@example.com",
      pointId: "point-1",
    }),
    /Operator profile not found/,
  );

  const adminLifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      getProfileFn: async () => profile({ role: "admin", isAdmin: true }),
    }),
  );
  await assert.rejects(
    adminLifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "admin-target@example.com",
      pointId: "point-1",
    }),
    /Admin accounts cannot become point operators/,
  );
});

test("grant ignores client point data and uses the server projection", async () => {
  let projectedLookup = "";
  let transactionInput: GrantAssignmentInput | null = null;
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      getReadablePointFn: async (pointId) => {
        projectedLookup = pointId;
        return {
          point: projectedPoint(pointId),
          source: { kind: "point_event" },
        };
      },
      transactionFn: async (input) => {
        transactionInput = input;
        return assignment({ pointId: input.pointId });
      },
    }),
  );
  const untrustedInput = {
    actorUserId: " ADMIN@EXAMPLE.COM ",
    operatorUserId: " OPERATOR@EXAMPLE.COM ",
    pointId: " point-1 ",
    point: {
      pointId: "forged-point",
      category: "fuel_station",
      location: { latitude: 0, longitude: 0 },
    },
  };

  await lifecycle.grant(untrustedInput);

  assert.equal(projectedLookup, "point-1");
  assert.equal(transactionInput?.pointId, "point-1");
  assert.equal(transactionInput?.operatorUserId, "operator@example.com");
  assert.deepEqual(transactionInput?.pointSource, { kind: "point_event" });
  assert.equal("point" in (transactionInput ?? {}), false);
});

test("unique assignment violations become typed control conflicts", async () => {
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      transactionFn: async () => {
        throw Object.assign(new Error("duplicate key"), {
          code: "23505",
          constraint: "point_operator_one_active_per_point",
        });
      },
    }),
  );

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "point-1",
    }),
    (error: unknown) =>
      error instanceof PointOperatorConflictError &&
      error.code === "point_operator_conflict" &&
      /active operator/.test(error.message),
  );
});

test("per-user assignment races become typed control conflicts", async () => {
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      transactionFn: async () => {
        throw Object.assign(new Error("duplicate key"), {
          code: "23505",
          constraint: "point_operator_one_active_per_user",
        });
      },
    }),
  );

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "point-1",
    }),
    (error: unknown) =>
      error instanceof PointOperatorConflictError &&
      /already has an active point/.test(error.message),
  );
});

test("unrelated unique violations propagate unchanged", async () => {
  const duplicateEmail = Object.assign(new Error("duplicate email"), {
    code: "23505",
    constraint: "user_profiles_email_key",
  });
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      transactionFn: async () => {
        throw duplicateEmail;
      },
    }),
  );

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "point-1",
    }),
    (error: unknown) => error === duplicateEmail,
  );
});

test("legacy point provenance is passed to the canonical store wrapper", async () => {
  const lookup: ReadableProjectedPoint = {
    point: projectedPoint("legacy-1"),
    source: { kind: "legacy_submission", submissionId: "legacy-1" },
  };
  let transactionSource: GrantAssignmentInput["pointSource"] | null = null;
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      getReadablePointFn: async () => lookup,
      transactionFn: async (input) => {
        transactionSource = input.pointSource;
        return assignment({ pointId: input.pointId });
      },
    }),
  );

  await lifecycle.grant({
    actorUserId: "admin@example.com",
    operatorUserId: "operator@example.com",
    pointId: "legacy-1",
  });

  assert.deepEqual(transactionSource, {
    kind: "legacy_submission",
    submissionId: "legacy-1",
  });
});

test("curated seed provenance is passed to the canonical store wrapper", async () => {
  let lookupCount = 0;
  let transactionSource: GrantAssignmentInput["pointSource"] | null = null;
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({
      getReadablePointFn: async () => {
        lookupCount += 1;
        return {
          point: projectedPoint("seed-point-1"),
          source: { kind: "curated_seed", eventId: "seed-event-1" },
        };
      },
      transactionFn: async (input) => {
        transactionSource = input.pointSource;
        return assignment({ pointId: input.pointId });
      },
    }),
  );

  await lifecycle.grant({
    actorUserId: "admin@example.com",
    operatorUserId: "operator@example.com",
    pointId: "seed-point-1",
  });

  assert.equal(lookupCount, 1);
  assert.deepEqual(transactionSource, {
    kind: "curated_seed",
    eventId: "seed-event-1",
  });
});

test("revoke trims and requires a reason, then targets the active assignment", async () => {
  const lifecycle = createPointOperatorLifecycle(lifecycleDeps());
  await assert.rejects(
    lifecycle.revoke({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      reason: "   ",
    }),
    /Revocation reason is required/,
  );

  let revokeInput: unknown;
  const active = assignment();
  const successful = createPointOperatorLifecycle(
    lifecycleDeps({
      getActiveByOperatorFn: async () => active,
      revokeFn: async (input) => {
        revokeInput = input;
        return assignment({
          status: "revoked",
          revokedBy: input.actorUserId,
          revokedAt: "2026-06-24T09:00:00.000Z",
          revokeReason: input.reason,
        });
      },
    }),
  );

  await successful.revoke({
    actorUserId: " ADMIN@EXAMPLE.COM ",
    operatorUserId: " OPERATOR@EXAMPLE.COM ",
    reason: "  responsibility changed  ",
  });

  assert.deepEqual(revokeInput, {
    assignmentId: active.id,
    actorUserId: "admin@example.com",
    operatorUserId: "operator@example.com",
    reason: "responsibility changed",
  });
});

test("revoke requires an active assignment", async () => {
  const lifecycle = createPointOperatorLifecycle(
    lifecycleDeps({ getActiveByOperatorFn: async () => null }),
  );

  await assert.rejects(
    lifecycle.revoke({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      reason: "closed",
    }),
    /Active operator assignment not found/,
  );
});

test("store maps assignment rows and normalizes lookup IDs", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const store = createPointOperatorStore({
    queryFn: async (text, values = []) => {
      calls.push({ text, values });
      return {
        rows: [
          {
            id: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
            operator_user_id: " OPERATOR@EXAMPLE.COM ",
            point_id: " point-1 ",
            status: "active",
            granted_by: " ADMIN@EXAMPLE.COM ",
            granted_at: new Date("2026-06-24T08:00:00.000Z"),
            revoked_by: null,
            revoked_at: null,
            revoke_reason: null,
          },
        ],
        rowCount: 1,
      };
    },
    connectFn: async () => {
      throw new Error("transaction client not expected");
    },
  });

  const result = await store.getActivePointOperatorAssignmentByUser(" OPERATOR@EXAMPLE.COM ");

  assert.deepEqual(calls[0].values, ["operator@example.com"]);
  assert.deepEqual(result, assignment());
});

test("findProjectedPointForAssignment uses the canonical readable point lookup", async () => {
  let lookedUpPointId = "";
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => {
      throw new Error("transaction client not expected");
    },
    findReadablePointFn: async (pointId) => {
      lookedUpPointId = pointId;
      return {
        point: projectedPoint(pointId),
        source: { kind: "point_event" },
      };
    },
  });

  const point = await store.findProjectedPointForAssignment(" point-1 ");

  assert.equal(lookedUpPointId, "point-1");
  assert.equal(point?.pointId, "point-1");
  assert.equal(point?.details.name, "Server Pharmacy");
});

test("store rejects mismatched prepared profile and operator IDs before opening a transaction", async () => {
  let connected = false;
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => {
      connected = true;
      throw new Error("must not connect");
    },
    findReadablePointFn: async () => null,
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "point-1",
      pointSource: { kind: "point_event" },
      profile: {
        kind: "existing",
        userId: "different@example.com",
        mustChangePassword: false,
      },
    }),
    /Prepared profile user does not match operator/,
  );
  assert.equal(connected, false);
});

test("direct grant cannot bypass canonical point lookup with forged seed provenance", async () => {
  let canonicalLookupCalled = false;
  let connected = false;
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => {
      connected = true;
      throw new Error("must not connect");
    },
    findReadablePointFn: async () => {
      canonicalLookupCalled = true;
      return null;
    },
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "seed-point-1",
      pointSource: { kind: "curated_seed", eventId: "forged-seed-event" },
      profile: {
        kind: "existing",
        userId: "operator@example.com",
        mustChangePassword: false,
      },
    }),
    /Verified point not found/,
  );
  assert.equal(canonicalLookupCalled, true);
  assert.equal(connected, false);
});

test("grant rejects when a legacy point disappears before the transaction", async () => {
  let connected = false;
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => {
      connected = true;
      throw new Error("must not connect");
    },
    findReadablePointFn: async () => null,
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "legacy-1",
      pointSource: { kind: "legacy_submission", submissionId: "legacy-1" },
      profile: {
        kind: "existing",
        userId: "operator@example.com",
        mustChangePassword: false,
      },
    }),
    /Verified point not found/,
  );
  assert.equal(connected, false);
});

test("grant rejects when canonical point provenance changes before the transaction", async () => {
  let connected = false;
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => {
      connected = true;
      throw new Error("must not connect");
    },
    findReadablePointFn: async () => ({
      point: projectedPoint("seed-point-1"),
      source: { kind: "point_event" },
    }),
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "seed-point-1",
      pointSource: { kind: "curated_seed", eventId: "seed-event-1" },
      profile: {
        kind: "existing",
        userId: "operator@example.com",
        mustChangePassword: false,
      },
    }),
    /Verified point source changed before assignment/,
  );
  assert.equal(connected, false);
});

test("grant transaction rolls back the role update when assignment insert fails", async () => {
  let role = "agent";
  let snapshot = role;
  let released = false;
  const statements: string[] = [];
  const client = {
    async query(text: string) {
      statements.push(text);
      if (/^begin$/i.test(text.trim())) {
        snapshot = role;
        return { rows: [], rowCount: null };
      }
      if (/update user_profiles/i.test(text)) {
        role = "point_operator";
        return { rows: [{ id: "operator@example.com" }], rowCount: 1 };
      }
      if (/from point_events/i.test(text)) {
        return { rows: [{ point_id: "point-1" }], rowCount: 1 };
      }
      if (/insert into point_operator_assignments/i.test(text)) {
        throw new Error("assignment insert failed");
      }
      if (/^rollback$/i.test(text.trim())) {
        role = snapshot;
        return { rows: [], rowCount: null };
      }
      return { rows: [], rowCount: null };
    },
    release() {
      released = true;
    },
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
    findReadablePointFn: async () => ({
      point: projectedPoint("point-1"),
      source: { kind: "point_event" },
    }),
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "point-1",
      pointSource: { kind: "point_event" },
      profile: {
        kind: "existing",
        userId: "operator@example.com",
        mustChangePassword: false,
      },
    }),
    /assignment insert failed/,
  );

  assert.equal(role, "agent");
  assert.equal(released, true);
  assert.equal(statements.some((text) => /^rollback$/i.test(text.trim())), true);
});

test("grant audit insertion failure rolls back the new profile and assignment", async () => {
  let profileCreated = false;
  let assignmentCreated = false;
  let auditInsertCount = 0;
  let snapshot = { profileCreated, assignmentCreated };
  const statements: string[] = [];
  const client = {
    async query(text: string) {
      statements.push(text);
      if (/^begin$/i.test(text.trim())) {
        snapshot = { profileCreated, assignmentCreated };
        return { rows: [], rowCount: null };
      }
      if (/insert into user_profiles/i.test(text)) {
        profileCreated = true;
        return { rows: [{ id: "new@example.com" }], rowCount: 1 };
      }
      if (/insert into point_operator_assignments/i.test(text)) {
        assignmentCreated = true;
        return {
          rows: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              operator_user_id: "new@example.com",
              point_id: "seed-point-1",
              status: "active",
              granted_by: "admin@example.com",
              granted_at: "2026-06-24T08:00:00.000Z",
              revoked_by: null,
              revoked_at: null,
              revoke_reason: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (/insert into security_audit_log/i.test(text)) {
        auditInsertCount += 1;
        if (auditInsertCount === 2) throw new Error("audit insert failed");
        return { rows: [], rowCount: 1 };
      }
      if (/^rollback$/i.test(text.trim())) {
        ({ profileCreated, assignmentCreated } = snapshot);
        return { rows: [], rowCount: null };
      }
      return { rows: [], rowCount: null };
    },
    release() {},
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
    findReadablePointFn: async () => ({
      point: projectedPoint("seed-point-1"),
      source: { kind: "curated_seed", eventId: "seed-event-1" },
    }),
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "new@example.com",
      pointId: "seed-point-1",
      pointSource: { kind: "curated_seed", eventId: "seed-event-1" },
      profile: {
        kind: "new",
        userId: "new@example.com",
        email: "new@example.com",
        phone: null,
        name: "New Operator",
        passwordHash: "hashed-password",
        mustChangePassword: true,
      },
      audit: {
        request: new Request("http://localhost/api/point-operator", {
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
        identifierType: "email",
        note: "Primary custodian",
      },
    }),
    /audit insert failed/,
  );

  assert.equal(profileCreated, false);
  assert.equal(assignmentCreated, false);
  assert.equal(auditInsertCount, 2);
  assert.equal(statements.some((text) => /^rollback$/i.test(text.trim())), true);
});

test("grant idempotency completion failure rolls back profile assignment and audit", async () => {
  let profileCreated = false;
  let assignmentCreated = false;
  let auditCreated = false;
  let replayCompleted = false;
  let snapshot = {
    profileCreated,
    assignmentCreated,
    auditCreated,
    replayCompleted,
  };
  const client = {
    async query(text: string) {
      if (/^begin$/i.test(text.trim())) {
        snapshot = {
          profileCreated,
          assignmentCreated,
          auditCreated,
          replayCompleted,
        };
        return { rows: [], rowCount: null };
      }
      if (/insert into user_profiles/i.test(text)) {
        profileCreated = true;
        return { rows: [{ id: "new@example.com" }], rowCount: 1 };
      }
      if (/insert into point_operator_assignments/i.test(text)) {
        assignmentCreated = true;
        return {
          rows: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              operator_user_id: "new@example.com",
              point_id: "seed-point-1",
              status: "active",
              granted_by: "admin@example.com",
              granted_at: "2026-06-24T08:00:00.000Z",
              revoked_by: null,
              revoked_at: null,
              revoke_reason: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (/insert into security_audit_log/i.test(text)) {
        auditCreated = true;
        return { rows: [], rowCount: 1 };
      }
      if (/update api_idempotency_keys/i.test(text)) {
        replayCompleted = true;
        throw new Error("idempotency completion failed");
      }
      if (/^rollback$/i.test(text.trim())) {
        ({
          profileCreated,
          assignmentCreated,
          auditCreated,
          replayCompleted,
        } = snapshot);
        return { rows: [], rowCount: null };
      }
      return { rows: [], rowCount: null };
    },
    release() {},
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
    findReadablePointFn: async () => ({
      point: projectedPoint("seed-point-1"),
      source: { kind: "curated_seed", eventId: "seed-event-1" },
    }),
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "new@example.com",
      pointId: "seed-point-1",
      pointSource: { kind: "curated_seed", eventId: "seed-event-1" },
      profile: {
        kind: "new",
        userId: "new@example.com",
        email: "new@example.com",
        phone: null,
        name: "New Operator",
        passwordHash: "hashed-password",
        mustChangePassword: true,
      },
      audit: {
        request: new Request("http://localhost/api/point-operator"),
        identifierType: "email",
      },
      idempotency: {
        scope: "point-operator:admin_create",
        userId: "admin@example.com",
        key: "create-atomic",
        responseStatus: 201,
      },
    }),
    /idempotency completion failed/,
  );

  assert.equal(profileCreated, false);
  assert.equal(assignmentCreated, false);
  assert.equal(auditCreated, false);
  assert.equal(replayCompleted, false);
});

test("grant revalidates event-backed point existence inside the transaction", async () => {
  const statements: string[] = [];
  const client = {
    async query(text: string) {
      statements.push(text);
      if (/from point_events/i.test(text)) return { rows: [], rowCount: 0 };
      if (/update user_profiles/i.test(text)) {
        return { rows: [{ id: "operator@example.com" }], rowCount: 1 };
      }
      return { rows: [], rowCount: null };
    },
    release() {},
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
    findReadablePointFn: async () => ({
      point: projectedPoint("point-1"),
      source: { kind: "point_event" },
    }),
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "point-1",
      pointSource: { kind: "point_event" },
      profile: {
        kind: "existing",
        userId: "operator@example.com",
        mustChangePassword: false,
      },
    }),
    /Verified point not found/,
  );
  const profileIndex = statements.findIndex((text) => /update user_profiles/i.test(text));
  const pointIndex = statements.findIndex((text) => /from point_events/i.test(text));
  const assignmentIndex = statements.findIndex((text) =>
    /insert into point_operator_assignments/i.test(text),
  );
  assert.equal(profileIndex >= 0, true);
  assert.equal(pointIndex > profileIndex, true);
  assert.equal(assignmentIndex, -1);
  assert.equal(statements.some((text) => /^rollback$/i.test(text.trim())), true);
});

test("event-backed point validation locks a matching row through commit", async () => {
  let lockQuery = "";
  const client = {
    async query(text: string) {
      if (/update user_profiles/i.test(text)) {
        return { rows: [{ id: "operator@example.com" }], rowCount: 1 };
      }
      if (/from point_events/i.test(text)) {
        lockQuery = text;
        return { rows: [{ point_id: "point-1" }], rowCount: 1 };
      }
      if (/insert into point_operator_assignments/i.test(text)) {
        return {
          rows: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              operator_user_id: "operator@example.com",
              point_id: "point-1",
              status: "active",
              granted_by: "admin@example.com",
              granted_at: "2026-06-24T08:00:00.000Z",
              revoked_by: null,
              revoked_at: null,
              revoke_reason: null,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: null };
    },
    release() {},
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
    findReadablePointFn: async () => ({
      point: projectedPoint("point-1"),
      source: { kind: "point_event" },
    }),
  });

  await store.grantPointOperatorAssignmentTx({
    actorUserId: "admin@example.com",
    operatorUserId: "operator@example.com",
    pointId: "point-1",
    pointSource: { kind: "point_event" },
    profile: {
      kind: "existing",
      userId: "operator@example.com",
      mustChangePassword: false,
    },
  });

  assert.match(lockQuery, /for share/i);
});

test("prepared new profiles are created in the assignment transaction", async () => {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  const client = {
    async query(text: string, values: unknown[] = []) {
      statements.push({ text, values });
      if (/insert into user_profiles/i.test(text)) {
        return { rows: [{ id: "new@example.com" }], rowCount: 1 };
      }
      if (/insert into point_operator_assignments/i.test(text)) {
        return {
          rows: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              operator_user_id: "new@example.com",
              point_id: "seed-point-1",
              status: "active",
              granted_by: "admin@example.com",
              granted_at: "2026-06-24T08:00:00.000Z",
              revoked_by: null,
              revoked_at: null,
              revoke_reason: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (/update api_idempotency_keys/i.test(text)) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: null };
    },
    release() {},
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
    findReadablePointFn: async () => ({
      point: projectedPoint("seed-point-1"),
      source: { kind: "curated_seed", eventId: "seed-event-1" },
    }),
  });

  const created = await store.grantPointOperatorAssignmentTx({
    actorUserId: "admin@example.com",
    operatorUserId: "new@example.com",
    pointId: "seed-point-1",
    pointSource: { kind: "curated_seed", eventId: "seed-event-1" },
    profile: {
      kind: "new",
      userId: "new@example.com",
      email: " NEW@EXAMPLE.COM ",
      phone: null,
      name: " New Operator ",
      passwordHash: "prepared-hash",
      mustChangePassword: true,
    },
    idempotency: {
      scope: "point-operator:admin_create",
      userId: "admin@example.com",
      key: "create-success",
      responseStatus: 201,
    },
  });

  const profileInsert = statements.find(({ text }) => /insert into user_profiles/i.test(text));
  const assignmentIndex = statements.findIndex(({ text }) =>
    /insert into point_operator_assignments/i.test(text),
  );
  const replayIndex = statements.findIndex(({ text }) =>
    /update api_idempotency_keys/i.test(text),
  );
  const commitIndex = statements.findIndex(({ text }) =>
    /^commit$/i.test(text.trim()),
  );
  assert.equal(created.operatorUserId, "new@example.com");
  assert.deepEqual(profileInsert?.values, [
    "new@example.com",
    "new@example.com",
    null,
    "New Operator",
    "prepared-hash",
    true,
  ]);
  assert.equal(statements.some(({ text }) => /from point_events/i.test(text)), false);
  assert.equal(replayIndex > assignmentIndex, true);
  assert.equal(commitIndex > replayIndex, true);
});

test("commit failure rolls back and disposes the suspect client", async () => {
  const commitError = new Error("commit failed");
  const statements: string[] = [];
  let releaseError: Error | undefined;
  const client = {
    async query(text: string) {
      statements.push(text);
      if (/update user_profiles/i.test(text)) {
        return { rows: [{ id: "operator@example.com" }], rowCount: 1 };
      }
      if (/insert into point_operator_assignments/i.test(text)) {
        return {
          rows: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              operator_user_id: "operator@example.com",
              point_id: "seed-point-1",
              status: "active",
              granted_by: "admin@example.com",
              granted_at: "2026-06-24T08:00:00.000Z",
              revoked_by: null,
              revoked_at: null,
              revoke_reason: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (/^commit$/i.test(text.trim())) throw commitError;
      return { rows: [], rowCount: null };
    },
    release(error?: Error) {
      releaseError = error;
    },
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
    findReadablePointFn: async () => ({
      point: projectedPoint("seed-point-1"),
      source: { kind: "curated_seed", eventId: "seed-event-1" },
    }),
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "seed-point-1",
      pointSource: { kind: "curated_seed", eventId: "seed-event-1" },
      profile: {
        kind: "existing",
        userId: "operator@example.com",
        mustChangePassword: false,
      },
    }),
    (error: unknown) => error === commitError,
  );
  assert.equal(statements.some((text) => /^rollback$/i.test(text.trim())), true);
  assert.equal(releaseError, commitError);
});

test("rollback failure disposes the client with the rollback error", async () => {
  const operationError = new Error("insert failed");
  const rollbackError = new Error("rollback failed");
  let releaseError: Error | undefined;
  const client = {
    async query(text: string) {
      if (/update user_profiles/i.test(text)) {
        return { rows: [{ id: "operator@example.com" }], rowCount: 1 };
      }
      if (/insert into point_operator_assignments/i.test(text)) throw operationError;
      if (/^rollback$/i.test(text.trim())) throw rollbackError;
      return { rows: [], rowCount: null };
    },
    release(error?: Error) {
      releaseError = error;
    },
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
    findReadablePointFn: async () => ({
      point: projectedPoint("seed-point-1"),
      source: { kind: "curated_seed", eventId: "seed-event-1" },
    }),
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "seed-point-1",
      pointSource: { kind: "curated_seed", eventId: "seed-event-1" },
      profile: {
        kind: "existing",
        userId: "operator@example.com",
        mustChangePassword: false,
      },
    }),
    (error: unknown) => error === operationError,
  );
  assert.equal(releaseError, rollbackError);
});

test("corrupt assignment rows fail closed with a controlled integrity error", async () => {
  const store = createPointOperatorStore({
    queryFn: async () => ({
      rows: [
        {
          id: "",
          operator_user_id: "operator@example.com",
          point_id: "point-1",
          status: "unknown",
          granted_by: "admin@example.com",
          granted_at: "not-a-date",
        },
      ],
      rowCount: 1,
    }),
    connectFn: async () => {
      throw new Error("transaction client not expected");
    },
    findReadablePointFn: async () => null,
  });

  await assert.rejects(
    store.getActivePointOperatorAssignmentByUser("operator@example.com"),
    (error: unknown) =>
      error instanceof PointOperatorDataIntegrityError &&
      error.code === "point_operator_data_integrity",
  );
});

test("revoke updates the active row and history retains the revoked assignment", async () => {
  let row = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    operator_user_id: "operator@example.com",
    point_id: "point-1",
    status: "active",
    granted_by: "admin@example.com",
    granted_at: "2026-06-24T08:00:00.000Z",
    revoked_by: null as string | null,
    revoked_at: null as string | null,
    revoke_reason: null as string | null,
  };
  const statements: string[] = [];
  const client = {
    async query(text: string, values: unknown[] = []) {
      statements.push(text);
      if (/update point_operator_assignments/i.test(text)) {
        row = {
          ...row,
          status: "revoked",
          revoked_by: String(values[1]),
          revoked_at: "2026-06-24T09:00:00.000Z",
          revoke_reason: String(values[2]),
        };
        return { rows: [row], rowCount: 1 };
      }
      if (/update api_idempotency_keys/i.test(text)) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: null };
    },
    release() {},
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [row], rowCount: 1 }),
    connectFn: async () => client,
    findReadablePointFn: async () => null,
  });

  const revoked = await store.revokePointOperatorAssignmentTx({
    assignmentId: row.id,
    actorUserId: "admin@example.com",
    operatorUserId: "operator@example.com",
    reason: "responsibility changed",
    idempotency: {
      scope: "point-operator:admin_revoke",
      userId: "admin@example.com",
      key: "revoke-success",
      responseStatus: 200,
    },
  });
  const history = await store.listPointOperatorAssignmentHistory("point-1");

  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.revokeReason, "responsibility changed");
  assert.equal(history.length, 1);
  assert.equal(history[0].status, "revoked");
  const revokeIndex = statements.findIndex((text) =>
    /update point_operator_assignments/i.test(text),
  );
  const replayIndex = statements.findIndex((text) =>
    /update api_idempotency_keys/i.test(text),
  );
  const commitIndex = statements.findIndex((text) =>
    /^commit$/i.test(text.trim()),
  );
  assert.equal(replayIndex > revokeIndex, true);
  assert.equal(commitIndex > replayIndex, true);
});

test("revoke audit insertion failure rolls back the assignment revocation", async () => {
  let status = "active";
  let snapshot = status;
  const statements: string[] = [];
  const client = {
    async query(text: string) {
      statements.push(text);
      if (/^begin$/i.test(text.trim())) {
        snapshot = status;
        return { rows: [], rowCount: null };
      }
      if (/update point_operator_assignments/i.test(text)) {
        status = "revoked";
        return {
          rows: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              operator_user_id: "operator@example.com",
              point_id: "point-1",
              status: "revoked",
              granted_by: "admin@example.com",
              granted_at: "2026-06-24T08:00:00.000Z",
              revoked_by: "admin@example.com",
              revoked_at: "2026-06-24T09:00:00.000Z",
              revoke_reason: "responsibility changed",
            },
          ],
          rowCount: 1,
        };
      }
      if (/insert into security_audit_log/i.test(text)) {
        throw new Error("audit insert failed");
      }
      if (/^rollback$/i.test(text.trim())) {
        status = snapshot;
        return { rows: [], rowCount: null };
      }
      return { rows: [], rowCount: null };
    },
    release() {},
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
    findReadablePointFn: async () => null,
  });

  await assert.rejects(
    store.revokePointOperatorAssignmentTx({
      assignmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      reason: "responsibility changed",
      auditRequest: new Request("http://localhost/api/point-operator"),
    }),
    /audit insert failed/,
  );

  assert.equal(status, "active");
  assert.equal(
    statements.filter((text) => /insert into security_audit_log/i.test(text))
      .length,
    1,
  );
  assert.equal(statements.some((text) => /^rollback$/i.test(text.trim())), true);
});

test("revoke idempotency completion failure rolls back revocation and audit", async () => {
  let status = "active";
  let auditCreated = false;
  let replayCompleted = false;
  let snapshot = { status, auditCreated, replayCompleted };
  const client = {
    async query(text: string) {
      if (/^begin$/i.test(text.trim())) {
        snapshot = { status, auditCreated, replayCompleted };
        return { rows: [], rowCount: null };
      }
      if (/update point_operator_assignments/i.test(text)) {
        status = "revoked";
        return {
          rows: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              operator_user_id: "operator@example.com",
              point_id: "point-1",
              status: "revoked",
              granted_by: "admin@example.com",
              granted_at: "2026-06-24T08:00:00.000Z",
              revoked_by: "admin@example.com",
              revoked_at: "2026-06-24T09:00:00.000Z",
              revoke_reason: "Ownership changed",
            },
          ],
          rowCount: 1,
        };
      }
      if (/insert into security_audit_log/i.test(text)) {
        auditCreated = true;
        return { rows: [], rowCount: 1 };
      }
      if (/update api_idempotency_keys/i.test(text)) {
        replayCompleted = true;
        throw new Error("idempotency completion failed");
      }
      if (/^rollback$/i.test(text.trim())) {
        ({ status, auditCreated, replayCompleted } = snapshot);
        return { rows: [], rowCount: null };
      }
      return { rows: [], rowCount: null };
    },
    release() {},
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => client,
  });

  await assert.rejects(
    store.revokePointOperatorAssignmentTx({
      assignmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      reason: "Ownership changed",
      auditRequest: new Request("http://localhost/api/point-operator"),
      idempotency: {
        scope: "point-operator:admin_revoke",
        userId: "admin@example.com",
        key: "revoke-atomic",
        responseStatus: 200,
      },
    }),
    /idempotency completion failed/,
  );

  assert.equal(status, "active");
  assert.equal(auditCreated, false);
  assert.equal(replayCompleted, false);
});
