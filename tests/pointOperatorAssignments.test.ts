import assert from "node:assert/strict";
import test from "node:test";
import type {
  PointEvent,
  PointOperatorAssignment,
  ProjectedPoint,
  UserProfile,
} from "../shared/types.js";
import {
  PointOperatorConflictError,
  createPointOperatorLifecycle,
} from "../lib/server/pointOperatorService.js";
import {
  createPointOperatorStore,
  type GrantAssignmentInput,
} from "../lib/server/pointOperatorStore.js";

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
    getProjectedPointFn: async () => projectedPoint(),
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
      getProjectedPointFn: async () => null,
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
      getProjectedPointFn: async (pointId) => {
        projectedLookup = pointId;
        return projectedPoint(pointId);
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
    getPointEventsFn: async () => [],
  });

  const result = await store.getActivePointOperatorAssignmentByUser(" OPERATOR@EXAMPLE.COM ");

  assert.deepEqual(calls[0].values, ["operator@example.com"]);
  assert.deepEqual(result, assignment());
});

test("findProjectedPointForAssignment loads events and projects by ID", async () => {
  const event: PointEvent = {
    id: "event-1",
    pointId: "point-1",
    eventType: "CREATE_EVENT",
    userId: "agent@example.com",
    category: "pharmacy",
    location: { latitude: 4.08, longitude: 9.73 },
    details: { name: "Server Pharmacy" },
    createdAt: "2026-06-24T07:00:00.000Z",
  };
  let loaded = false;
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [], rowCount: 0 }),
    connectFn: async () => {
      throw new Error("transaction client not expected");
    },
    getPointEventsFn: async () => {
      loaded = true;
      return [event];
    },
  });

  const point = await store.findProjectedPointForAssignment(" point-1 ");

  assert.equal(loaded, true);
  assert.equal(point?.pointId, "point-1");
  assert.equal(point?.details.name, "Server Pharmacy");
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
    getPointEventsFn: async () => [],
  });

  await assert.rejects(
    store.grantPointOperatorAssignmentTx({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "point-1",
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
  const client = {
    async query(text: string, values: unknown[] = []) {
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
      return { rows: [], rowCount: null };
    },
    release() {},
  };
  const store = createPointOperatorStore({
    queryFn: async () => ({ rows: [row], rowCount: 1 }),
    connectFn: async () => client,
    getPointEventsFn: async () => [],
  });

  const revoked = await store.revokePointOperatorAssignmentTx({
    assignmentId: row.id,
    actorUserId: "admin@example.com",
    operatorUserId: "operator@example.com",
    reason: "responsibility changed",
  });
  const history = await store.listPointOperatorAssignmentHistory("point-1");

  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.revokeReason, "responsibility changed");
  assert.equal(history.length, 1);
  assert.equal(history[0].status, "revoked");
});
