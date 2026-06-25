import assert from "node:assert/strict";
import test from "node:test";
import { createPointOperatorLifecycle } from "../lib/server/pointOperatorService.js";
import type { PointOperatorAssignment, ProjectedPoint } from "../shared/types.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeAssignment(overrides: Partial<PointOperatorAssignment> = {}): PointOperatorAssignment {
  return {
    id: "assign-1",
    operatorUserId: "operator@example.com",
    pointId: "p1",
    status: "active",
    grantedBy: "admin@example.com",
    grantedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePoint(pointId = "p1"): ProjectedPoint {
  return {
    id: pointId,
    pointId,
    category: "pharmacy",
    location: { latitude: 4.0, longitude: 9.7 },
    details: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gaps: [],
    eventsCount: 1,
    eventIds: ["evt-1"],
  };
}

// ─── Step 1 / Step 2: basic failing tests (now must pass after implementation) ──

test("grant rejects a missing verified point", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => null,
    getOperatorProfileFn: async () => ({ role: "agent" as const }),
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "missing-point",
    }),
    /Verified point not found/,
  );
});

test("grant rejects a second active operator for one point", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => makePoint("p1"),
    getOperatorProfileFn: async () => ({ role: "agent" as const }),
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => makeAssignment({ pointId: "p1" }),
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "p1",
    }),
    /already has an active operator/,
  );
});

// ─── Step 5: additional coverage ─────────────────────────────────────────────

test("grant rejects operator that already has an active point", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => makePoint("p2"),
    getOperatorProfileFn: async () => ({ role: "agent" as const }),
    getActiveByOperatorFn: async () => makeAssignment({ pointId: "p1" }), // already active on p1
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "p2",
    }),
    /Operator already has an active point/,
  );
});

test("grant rejects assigning an admin account as point operator", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => makePoint("p1"),
    getOperatorProfileFn: async () => ({ role: "admin" as const }),
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "superadmin@example.com",
      operatorUserId: "admin-user@example.com",
      pointId: "p1",
    }),
    /Admin accounts cannot become point operators/,
  );
});

test("grant rejects admin (isAdmin flag) as point operator", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => makePoint("p1"),
    getOperatorProfileFn: async () => ({ role: "agent" as const, isAdmin: true }),
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "superadmin@example.com",
      operatorUserId: "admin-user@example.com",
      pointId: "p1",
    }),
    /Admin accounts cannot become point operators/,
  );
});

test("grant succeeds when all checks pass", async () => {
  const expected = makeAssignment();
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => makePoint("p1"),
    getOperatorProfileFn: async () => ({ role: "agent" as const }),
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => null,
    transactionFn: async () => expected,
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  const result = await lifecycle.grant({
    actorUserId: "admin@example.com",
    operatorUserId: "operator@example.com",
    pointId: "p1",
  });

  assert.deepEqual(result, expected);
});

test("revoke rejects when no active assignment exists", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => {
      throw new Error("getProjectedPointFn must not run");
    },
    getOperatorProfileFn: async () => ({ role: "agent" as const }),
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  await assert.rejects(
    lifecycle.revoke({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      revokeReason: "No longer needed",
    }),
    /Active operator assignment not found/,
  );
});

test("revoke rejects when reason is empty", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => {
      throw new Error("getProjectedPointFn must not run");
    },
    getOperatorProfileFn: async () => ({ role: "agent" as const }),
    getActiveByOperatorFn: async () => makeAssignment(),
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  await assert.rejects(
    lifecycle.revoke({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      revokeReason: "",
    }),
    /Revoke reason is required/,
  );
});

test("revoke rejects when reason is missing", async () => {
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => {
      throw new Error("getProjectedPointFn must not run");
    },
    getOperatorProfileFn: async () => ({ role: "agent" as const }),
    getActiveByOperatorFn: async () => makeAssignment(),
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  await assert.rejects(
    lifecycle.revoke({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      revokeReason: "   ", // whitespace only
    }),
    /Revoke reason is required/,
  );
});

test("revoke succeeds and returns revoked assignment", async () => {
  const revokedAssignment = makeAssignment({
    status: "revoked",
    revokedBy: "admin@example.com",
    revokedAt: new Date().toISOString(),
    revokeReason: "Terminated",
  });

  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => {
      throw new Error("getProjectedPointFn must not run");
    },
    getOperatorProfileFn: async () => ({ role: "agent" as const }),
    getActiveByOperatorFn: async () => makeAssignment(),
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("transaction must not run");
    },
    revokeFn: async () => revokedAssignment,
  });

  const result = await lifecycle.revoke({
    actorUserId: "admin@example.com",
    operatorUserId: "operator@example.com",
    revokeReason: "Terminated",
  });

  assert.equal(result.status, "revoked");
  assert.equal(result.revokeReason, "Terminated");
  assert.equal(result.revokedBy, "admin@example.com");
});

test("transactional failure leaves no profile-role change (rollback proven via injected fn)", async () => {
  let transactionCalled = false;
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => makePoint("p1"),
    getOperatorProfileFn: async () => ({ role: "agent" as const }),
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      transactionCalled = true;
      throw new Error("DB transaction failed");
    },
    revokeFn: async () => {
      throw new Error("revokeFn must not run");
    },
  });

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "admin@example.com",
      operatorUserId: "operator@example.com",
      pointId: "p1",
    }),
    /DB transaction failed/,
  );

  assert.equal(transactionCalled, true, "transactionFn must have been called");
});

test("validation order: point check before operator-not-admin check", async () => {
  // point is missing → should fail with "Verified point not found" even if operator is admin
  const lifecycle = createPointOperatorLifecycle({
    getProjectedPointFn: async () => null,
    getOperatorProfileFn: async () => ({ role: "admin" as const }),
    getActiveByOperatorFn: async () => null,
    getActiveByPointFn: async () => null,
    transactionFn: async () => {
      throw new Error("must not run");
    },
    revokeFn: async () => {
      throw new Error("must not run");
    },
  });

  await assert.rejects(
    lifecycle.grant({
      actorUserId: "superadmin@example.com",
      operatorUserId: "admin-user@example.com",
      pointId: "missing",
    }),
    /Verified point not found/,
  );
});
