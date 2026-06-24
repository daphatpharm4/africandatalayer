import assert from 'node:assert/strict';
import test from 'node:test';
import { createPointOperatorHandler } from '../api/point-operator/index.js';
import {
  createAdminAccountAccessHandler,
  createAdminAccountCreateHandler,
} from '../api/user/index.js';
import { StorageUnavailableError } from '../lib/server/db.js';
import type {
  AbortableIdempotencyStore,
  IdempotencyCompletion,
} from '../lib/server/idempotencyGeneric.js';
import { PointOperatorConflictError } from '../lib/server/pointOperatorService.js';
import type {
  PointOperatorAssignment,
  ProjectedPoint,
  UserRole,
} from '../shared/types.js';

const allowRateLimit = async () => ({
  allowed: true,
  remaining: 9,
  retryAfterSeconds: 60,
  count: 1,
});

function assignment(
  overrides: Partial<PointOperatorAssignment> = {},
): PointOperatorAssignment {
  return {
    id: 'assignment-1',
    operatorUserId: 'op@example.com',
    pointId: 'point-1',
    status: 'active',
    grantedBy: 'admin@example.com',
    grantedAt: '2026-06-24T00:00:00.000Z',
    revokedBy: null,
    revokedAt: null,
    revokeReason: null,
    ...overrides,
  };
}

function point(overrides: Partial<ProjectedPoint> = {}): ProjectedPoint {
  return {
    id: 'event-1',
    pointId: 'point-1',
    category: 'pharmacy',
    location: { latitude: 4.0511, longitude: 9.7679 },
    details: {
      name: 'Central Pharmacy',
      phone: '+237600000000',
      reviewerApproved: true,
    },
    photoUrl: 'https://example.com/point.jpg',
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-24T00:00:00.000Z',
    gaps: [],
    eventsCount: 2,
    eventIds: ['event-1', 'event-2'],
    ...overrides,
  };
}

function auth(role: UserRole, token: Record<string, unknown> = {}) {
  return async () => ({
    id: `${role}@example.com`,
    token,
    role,
  });
}

function memStore(): AbortableIdempotencyStore {
  const rows = new Map<
    string,
    {
      requestHash: string;
      responseJson: unknown;
      responseStatus: number;
      createdAtMs: number;
    }
  >();
  return {
    async find(scope, userId, key) {
      return rows.get(`${scope}:${userId}:${key}`) ?? null;
    },
    async insert(scope, userId, key, requestHash) {
      const id = `${scope}:${userId}:${key}`;
      if (rows.has(id)) return false;
      rows.set(id, {
        requestHash,
        responseJson: null,
        responseStatus: 0,
        createdAtMs: Date.now(),
      });
      return true;
    },
    async reclaim(scope, userId, key, requestHash) {
      rows.set(`${scope}:${userId}:${key}`, {
        requestHash,
        responseJson: null,
        responseStatus: 0,
        createdAtMs: Date.now(),
      });
    },
    async complete(scope, userId, key, responseJson, responseStatus) {
      const id = `${scope}:${userId}:${key}`;
      const existing = rows.get(id);
      assert.ok(existing);
      rows.set(id, { ...existing, responseJson, responseStatus });
    },
    async abort(scope, userId, key) {
      rows.delete(`${scope}:${userId}:${key}`);
    },
  };
}

async function completeAssignmentReplay(
  store: AbortableIdempotencyStore,
  idempotency: IdempotencyCompletion | undefined,
  value: PointOperatorAssignment,
): Promise<void> {
  assert.ok(idempotency);
  await store.complete(
    idempotency.scope,
    idempotency.userId,
    idempotency.key,
    { assignment: value },
    idempotency.responseStatus,
  );
}

test('agent cannot create point operator account', async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({
      id: 'agent@example.com',
      token: {},
      role: 'agent',
    }),
    consumeRateLimitFn: allowRateLimit,
  });

  const response = await handler(
    new Request('http://localhost/api/point-operator?view=admin_create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'create-1',
      },
      body: JSON.stringify({}),
    }),
  );

  assert.equal(response.status, 403);
});

test('operator status rejects a spoofed point id before calling its dependency', async () => {
  let received: unknown;
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({
      id: 'op@example.com',
      token: {},
      role: 'point_operator',
    }),
    consumeRateLimitFn: allowRateLimit,
    getActiveAssignmentByUserFn: async () => ({
      id: 'assignment-1',
      operatorUserId: 'op@example.com',
      pointId: 'point-1',
      status: 'active',
      grantedBy: 'admin@example.com',
      grantedAt: '2026-06-24T00:00:00.000Z',
      revokedBy: null,
      revokedAt: null,
      revokeReason: null,
    }),
    submitSignalFn: async (input) => {
      received = input;
      return { eventId: 'event-1' };
    },
  });

  const response = await handler(
    new Request('http://localhost/api/point-operator?view=status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'status-1',
      },
      body: JSON.stringify({
        field: 'isOpenNow',
        value: true,
        pointId: 'spoofed',
      }),
    }),
  );

  assert.equal(response.status, 422);
  assert.equal(received, undefined);
});

test('operator status passes only operator-owned fields to the injected dependency', async () => {
  let received: unknown;
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({
      id: 'op@example.com',
      token: {},
      role: 'point_operator',
    }),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: memStore(),
    getActiveAssignmentByUserFn: async () => assignment(),
    submitSignalFn: async (input) => {
      received = input;
      return { eventId: 'event-1' };
    },
  });

  const response = await handler(
    new Request('http://localhost/api/point-operator?view=status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'status-2',
      },
      body: JSON.stringify({ field: 'isOpenNow', value: true }),
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(received, {
    operatorUserId: 'op@example.com',
    field: 'isOpenNow',
    value: true,
    idempotencyKey: 'status-2',
  });
});

test('status write replays the first result for the same idempotency key', async () => {
  let calls = 0;
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({
      id: 'op@example.com',
      token: {},
      role: 'point_operator',
    }),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: memStore(),
    getActiveAssignmentByUserFn: async () => assignment(),
    submitSignalFn: async () => {
      calls += 1;
      return { eventId: `event-${calls}` };
    },
  });
  const request = () =>
    new Request('http://localhost/api/point-operator?view=status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'status-replay',
      },
      body: JSON.stringify({ field: 'isOpenNow', value: true }),
    });

  const first = await handler(request());
  const second = await handler(request());

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.deepEqual(await second.json(), { eventId: 'event-1' });
  assert.equal(calls, 1);
});

test('agent, client, and admin roles cannot submit operator status', async () => {
  for (const role of ['agent', 'client', 'admin'] as const) {
    const handler = createPointOperatorHandler({
      requireUserFn: auth(role),
      consumeRateLimitFn: allowRateLimit,
    });
    const response = await handler(
      new Request('http://localhost/api/point-operator?view=status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `status-${role}`,
        },
        body: JSON.stringify({ field: 'isOpenNow', value: true }),
      }),
    );
    assert.equal(response.status, 403, role);
  }
});

test('operator writes require an idempotency key', async () => {
  let calls = 0;
  const handler = createPointOperatorHandler({
    requireUserFn: auth('point_operator'),
    consumeRateLimitFn: allowRateLimit,
    getActiveAssignmentByUserFn: async () => assignment(),
    submitSignalFn: async () => {
      calls += 1;
      return { eventId: 'event-1' };
    },
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'isOpenNow', value: true }),
    }),
  );
  assert.equal(response.status, 422);
  assert.equal(calls, 0);
});

test('status defaults to a controlled unavailable response until Task 5', async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: auth('point_operator'),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: memStore(),
    getActiveAssignmentByUserFn: async () => assignment(),
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'status-unavailable',
      },
      body: JSON.stringify({ field: 'isOpenNow', value: true }),
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(
    ((await response.json()) as { code?: string }).code,
    'point_operator_status_unavailable',
  );
});

test('admin create normalizes identity and grants a prepared profile atomically', async () => {
  let hashInput: unknown;
  let grantInput: unknown;
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({
      id: 'admin@example.com',
      token: { isAdmin: true },
      role: 'agent',
    }),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: memStore(),
    getUserProfileFn: async () => null,
    findReadablePointFn: async () => ({
      point: point(),
      source: { kind: 'point_event' },
    }),
    getActiveAssignmentByPointFn: async () => null,
    hashPasswordFn: async (password, rounds) => {
      hashInput = { password, rounds };
      return 'hashed-password';
    },
    grantAssignmentFn: async (input) => {
      grantInput = input;
      return assignment();
    },
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=admin_create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'create-atomic',
      },
      body: JSON.stringify({
        identifier: ' Operator@Example.COM ',
        name: ' Point Operator ',
        password: 'StrongPass123!',
        pointId: ' point-1 ',
        note: ' Primary custodian ',
      }),
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(hashInput, {
    password: 'StrongPass123!',
    rounds: 12,
  });
  const typedGrantInput = grantInput as {
    audit?: {
      request?: Request;
      identifierType?: string;
      note?: string;
    };
    idempotency?: IdempotencyCompletion;
  } & Record<string, unknown>;
  assert.equal(typedGrantInput.audit?.request instanceof Request, true);
  assert.deepEqual(
    { ...typedGrantInput, audit: undefined, idempotency: undefined },
    {
    actorUserId: 'admin@example.com',
    operatorUserId: 'operator@example.com',
    pointId: 'point-1',
    pointSource: { kind: 'point_event' },
    profile: {
      kind: 'new',
      userId: 'operator@example.com',
      email: 'operator@example.com',
      phone: null,
      name: 'Point Operator',
      passwordHash: 'hashed-password',
      mustChangePassword: true,
    },
      audit: undefined,
      idempotency: undefined,
    },
  );
  assert.deepEqual(
    {
      identifierType: typedGrantInput.audit?.identifierType,
      note: typedGrantInput.audit?.note,
    },
    {
      identifierType: 'email',
      note: 'Primary custodian',
    },
  );
  assert.deepEqual(typedGrantInput.idempotency, {
    scope: 'point-operator:admin_create',
    userId: 'admin@example.com',
    key: 'create-atomic',
    responseStatus: 201,
  });
  const body = (await response.json()) as {
    assignment?: PointOperatorAssignment;
  };
  assert.equal(body.assignment?.id, 'assignment-1');
});

test('admin create replays an identical idempotent retry without re-granting', async () => {
  let grantCalls = 0;
  let accountExists = false;
  const store = memStore();
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: store,
    getUserProfileFn: async () =>
      accountExists
        ? {
            id: 'operator@example.com',
            name: 'Operator',
            email: 'operator@example.com',
            XP: 0,
            role: 'point_operator',
          }
        : null,
    findReadablePointFn: async () => ({
      point: point(),
      source: { kind: 'point_event' },
    }),
    getActiveAssignmentByPointFn: async () =>
      accountExists ? assignment() : null,
    hashPasswordFn: async () => 'hashed-password',
    grantAssignmentFn: async (input) => {
      grantCalls += 1;
      accountExists = true;
      const created = assignment();
      await completeAssignmentReplay(store, input.idempotency, created);
      return created;
    },
  });
  const request = () =>
    new Request('http://localhost/api/point-operator?view=admin_create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'create-replay',
      },
      body: JSON.stringify({
        identifier: 'operator@example.com',
        name: 'Operator',
        password: 'StrongPass123!',
        pointId: 'point-1',
      }),
    });

  const first = await handler(request());
  const second = await handler(request());

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(grantCalls, 1);
  assert.deepEqual(await second.json(), {
    assignment: assignment(),
  });
});

test('admin create rejects an existing account without attempting a grant', async () => {
  let grantCalls = 0;
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: memStore(),
    getUserProfileFn: async () => ({
      id: 'operator@example.com',
      name: 'Existing',
      email: 'operator@example.com',
      XP: 0,
      role: 'client',
    }),
    grantAssignmentFn: async () => {
      grantCalls += 1;
      return assignment();
    },
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=admin_create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'create-duplicate',
      },
      body: JSON.stringify({
        identifier: 'operator@example.com',
        name: 'Operator',
        password: 'StrongPass123!',
        pointId: 'point-1',
      }),
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(grantCalls, 0);
});

test('admin create caches deterministic 404 and 409 responses instead of leaving reservations in flight', async () => {
  for (const [name, deps, expectedStatus] of [
    [
      'missing point',
      {
        getUserProfileFn: async () => null,
        findReadablePointFn: async () => null,
      },
      404,
    ],
    [
      'duplicate account',
      {
        getUserProfileFn: async () => ({
          id: 'operator@example.com',
          name: 'Existing',
          email: 'operator@example.com',
          XP: 0,
          role: 'client' as const,
        }),
      },
      409,
    ],
  ] as const) {
    let grantCalls = 0;
    const handler = createPointOperatorHandler({
      requireUserFn: auth('admin'),
      consumeRateLimitFn: allowRateLimit,
      idempotencyStore: memStore(),
      grantAssignmentFn: async () => {
        grantCalls += 1;
        return assignment();
      },
      ...deps,
    });
    const request = () =>
      new Request('http://localhost/api/point-operator?view=admin_create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `create-${name}`,
        },
        body: JSON.stringify({
          identifier: 'operator@example.com',
          name: 'Operator',
          password: 'StrongPass123!',
          pointId: 'missing-point',
        }),
      });

    const first = await handler(request());
    const second = await handler(request());

    assert.equal(first.status, expectedStatus, name);
    assert.equal(second.status, expectedStatus, name);
    assert.deepEqual(await second.json(), await first.json(), name);
    assert.equal(grantCalls, 0, name);
  }
});

test('admin create aborts a retryable storage failure so the same key can succeed immediately', async () => {
  let grantCalls = 0;
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: memStore(),
    getUserProfileFn: async () => null,
    findReadablePointFn: async () => ({
      point: point(),
      source: { kind: 'point_event' },
    }),
    getActiveAssignmentByPointFn: async () => null,
    hashPasswordFn: async () => 'hashed-password',
    grantAssignmentFn: async () => {
      grantCalls += 1;
      if (grantCalls === 1) {
        throw new StorageUnavailableError('database offline');
      }
      return assignment();
    },
  });
  const request = () =>
    new Request('http://localhost/api/point-operator?view=admin_create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'create-storage-retry',
      },
      body: JSON.stringify({
        identifier: 'operator@example.com',
        name: 'Operator',
        password: 'StrongPass123!',
        pointId: 'point-1',
      }),
    });

  assert.equal((await handler(request())).status, 503);
  assert.equal((await handler(request())).status, 201);
  assert.equal(grantCalls, 2);
});

test('admin create preserves the controlled response when idempotency abort cleanup fails', async () => {
  const store = memStore();
  store.abort = async () => {
    throw new Error('cleanup unavailable');
  };
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: store,
    getUserProfileFn: async () => null,
    findReadablePointFn: async () => ({
      point: point(),
      source: { kind: 'point_event' },
    }),
    getActiveAssignmentByPointFn: async () => null,
    hashPasswordFn: async () => 'hashed-password',
    grantAssignmentFn: async () => {
      throw new StorageUnavailableError('database offline');
    },
  });

  const response = await handler(
    new Request('http://localhost/api/point-operator?view=admin_create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'create-cleanup-failure',
      },
      body: JSON.stringify({
        identifier: 'operator@example.com',
        name: 'Operator',
        password: 'StrongPass123!',
        pointId: 'point-1',
      }),
    }),
  );

  assert.equal(response.status, 503);
  assert.equal(
    ((await response.json()) as { code?: string }).code,
    'storage_unavailable',
  );
});

test('admin create falls back to abort when deterministic response caching fails', async () => {
  const store = memStore();
  const complete = store.complete.bind(store);
  let completeCalls = 0;
  store.complete = async (...args) => {
    completeCalls += 1;
    if (completeCalls === 1) throw new Error('cache unavailable');
    await complete(...args);
  };
  let pointLookups = 0;
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: store,
    getUserProfileFn: async () => null,
    findReadablePointFn: async () => {
      pointLookups += 1;
      return null;
    },
  });
  const request = () =>
    new Request('http://localhost/api/point-operator?view=admin_create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'create-cache-cleanup-failure',
      },
      body: JSON.stringify({
        identifier: 'operator@example.com',
        name: 'Operator',
        password: 'StrongPass123!',
        pointId: 'missing-point',
      }),
    });

  assert.equal((await handler(request())).status, 404);
  assert.equal((await handler(request())).status, 404);
  assert.equal(pointLookups, 2);
});

test('admin create maps assignment uniqueness conflicts to 409', async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: memStore(),
    getUserProfileFn: async () => null,
    findReadablePointFn: async () => ({
      point: point(),
      source: { kind: 'point_event' },
    }),
    getActiveAssignmentByPointFn: async () => null,
    hashPasswordFn: async () => 'hashed-password',
    grantAssignmentFn: async () => {
      throw new PointOperatorConflictError(
        'Point already has an active operator',
      );
    },
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=admin_create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'create-conflict',
      },
      body: JSON.stringify({
        identifier: 'operator@example.com',
        name: 'Operator',
        password: 'StrongPass123!',
        pointId: 'point-1',
      }),
    }),
  );
  assert.equal(response.status, 409);
});

test('admin search excludes missing projections and returns minimal active state', async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    searchReadablePointsFn: async () => [point(), null],
    getActiveAssignmentByPointFn: async (pointId) =>
      pointId === 'point-1' ? assignment() : null,
  });
  const response = await handler(
    new Request(
      'http://localhost/api/point-operator?view=admin_search_points&q=central',
    ),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    points: [
      {
        pointId: 'point-1',
        name: 'Central Pharmacy',
        category: 'pharmacy',
        location: { latitude: 4.0511, longitude: 9.7679 },
        photoUrl: 'https://example.com/point.jpg',
        activeOperator: {
          operatorUserId: 'op@example.com',
          grantedAt: '2026-06-24T00:00:00.000Z',
        },
      },
    ],
  });
});

test('admin assignment loads active assignment, history, operator, and point', async () => {
  const active = assignment();
  const revoked = assignment({
    id: 'assignment-old',
    status: 'revoked',
    revokedBy: 'admin@example.com',
    revokedAt: '2026-06-23T00:00:00.000Z',
    revokeReason: 'Replaced',
  });
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    getActiveAssignmentByPointFn: async () => active,
    listAssignmentHistoryFn: async () => [active, revoked],
    getUserProfileFn: async () => ({
      id: 'op@example.com',
      name: 'Operator',
      email: 'op@example.com',
      XP: 0,
      role: 'point_operator',
    }),
    findProjectedPointFn: async () => point(),
  });
  const response = await handler(
    new Request(
      'http://localhost/api/point-operator?view=admin_assignment&pointId=point-1',
    ),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    assignment?: PointOperatorAssignment;
    history?: PointOperatorAssignment[];
    operator?: { id?: string };
    point?: ProjectedPoint;
  };
  assert.equal(body.assignment?.id, 'assignment-1');
  assert.equal(body.history?.length, 2);
  assert.equal(body.operator?.id, 'op@example.com');
  assert.equal(body.point?.pointId, 'point-1');
});

test('admin revoke passes transactional audit context to the lifecycle', async () => {
  let revokeInput: unknown;
  const revoked = assignment({
    status: 'revoked',
    revokedBy: 'admin@example.com',
    revokedAt: '2026-06-24T01:00:00.000Z',
    revokeReason: 'Ownership changed',
  });
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: memStore(),
    revokeAssignmentFn: async (input) => {
      revokeInput = input;
      return revoked;
    },
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=admin_revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'revoke-1',
      },
      body: JSON.stringify({
        operatorUserId: ' OP@Example.com ',
        reason: ' Ownership changed ',
      }),
    }),
  );
  assert.equal(response.status, 200);
  const typedRevokeInput = revokeInput as {
    auditRequest?: Request;
    idempotency?: IdempotencyCompletion;
  } & Record<string, unknown>;
  assert.equal(typedRevokeInput.auditRequest instanceof Request, true);
  assert.deepEqual(
    {
      ...typedRevokeInput,
      auditRequest: undefined,
      idempotency: undefined,
    },
    {
      actorUserId: 'admin@example.com',
      operatorUserId: 'op@example.com',
      reason: 'Ownership changed',
      auditRequest: undefined,
      idempotency: undefined,
    },
  );
  assert.deepEqual(typedRevokeInput.idempotency, {
    scope: 'point-operator:admin_revoke',
    userId: 'admin@example.com',
    key: 'revoke-1',
    responseStatus: 200,
  });
});

test('admin revoke caches deterministic failure and aborts retryable failure', async () => {
  {
    let calls = 0;
    const handler = createPointOperatorHandler({
      requireUserFn: auth('admin'),
      consumeRateLimitFn: allowRateLimit,
      idempotencyStore: memStore(),
      revokeAssignmentFn: async () => {
        calls += 1;
        throw new Error('Active operator assignment not found');
      },
    });
    const request = () =>
      new Request('http://localhost/api/point-operator?view=admin_revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'revoke-missing',
        },
        body: JSON.stringify({
          operatorUserId: 'op@example.com',
          reason: 'Ownership changed',
        }),
      });
    assert.equal((await handler(request())).status, 404);
    assert.equal((await handler(request())).status, 404);
    assert.equal(calls, 1);
  }

  {
    let calls = 0;
    const handler = createPointOperatorHandler({
      requireUserFn: auth('admin'),
      consumeRateLimitFn: allowRateLimit,
      idempotencyStore: memStore(),
      revokeAssignmentFn: async () => {
        calls += 1;
        if (calls === 1) {
          throw new StorageUnavailableError('database offline');
        }
        return assignment({
          status: 'revoked',
          revokedBy: 'admin@example.com',
          revokedAt: '2026-06-24T01:00:00.000Z',
          revokeReason: 'Ownership changed',
        });
      },
    });
    const request = () =>
      new Request('http://localhost/api/point-operator?view=admin_revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'revoke-storage-retry',
        },
        body: JSON.stringify({
          operatorUserId: 'op@example.com',
          reason: 'Ownership changed',
        }),
      });
    assert.equal((await handler(request())).status, 503);
    assert.equal((await handler(request())).status, 200);
    assert.equal(calls, 2);
  }
});

test('admin revoke replays the original successful response', async () => {
  let calls = 0;
  const store = memStore();
  const revoked = assignment({
    status: 'revoked',
    revokedBy: 'admin@example.com',
    revokedAt: '2026-06-24T01:00:00.000Z',
    revokeReason: 'Ownership changed',
  });
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    idempotencyStore: store,
    revokeAssignmentFn: async (input) => {
      calls += 1;
      await completeAssignmentReplay(store, input.idempotency, revoked);
      return revoked;
    },
  });
  const request = () =>
    new Request('http://localhost/api/point-operator?view=admin_revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'revoke-replay',
      },
      body: JSON.stringify({
        operatorUserId: 'op@example.com',
        reason: 'Ownership changed',
      }),
    });

  const first = await handler(request());
  const second = await handler(request());

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), await first.json());
  assert.equal(calls, 1);
});

test('operator me returns the assigned canonical point, controls, and signal placeholder', async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: async () => ({
      id: 'op@example.com',
      token: {},
      role: 'point_operator',
    }),
    consumeRateLimitFn: allowRateLimit,
    getActiveAssignmentByUserFn: async () => assignment(),
    findProjectedPointFn: async () => point(),
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=me'),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    assignment?: PointOperatorAssignment;
    point?: ProjectedPoint;
    controls?: Array<{ field?: string }>;
    signals?: Record<string, unknown>;
  };
  assert.equal(body.assignment?.operatorUserId, 'op@example.com');
  assert.equal(body.point?.pointId, 'point-1');
  assert.ok(body.controls?.some((control) => control.field === 'isOpenNow'));
  assert.deepEqual(body.signals, {});
});

test('operator me fails closed after assignment revocation', async () => {
  let pointLookups = 0;
  const handler = createPointOperatorHandler({
    requireUserFn: auth('point_operator'),
    consumeRateLimitFn: allowRateLimit,
    getActiveAssignmentByUserFn: async () => null,
    findProjectedPointFn: async () => {
      pointLookups += 1;
      return point();
    },
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=me'),
  );
  assert.equal(response.status, 403);
  assert.equal(pointLookups, 0);
});

test('photo and password defaults return controlled unavailable responses', async () => {
  for (const [view, body, code] of [
    [
      'photo',
      { imageData: 'data:image/png;base64,AA==' },
      'point_operator_photo_unavailable',
    ],
    [
      'password',
      {
        currentPassword: 'TemporaryPass123!',
        newPassword: 'ReplacementPass123!',
      },
      'point_operator_password_unavailable',
    ],
  ] as const) {
    const handler = createPointOperatorHandler({
      requireUserFn: auth('point_operator'),
      consumeRateLimitFn: allowRateLimit,
      idempotencyStore: memStore(),
      getActiveAssignmentByUserFn: async () => assignment(),
    });
    const response = await handler(
      new Request(`http://localhost/api/point-operator?view=${view}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `${view}-1`,
        },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(response.status, 503, view);
    assert.equal(((await response.json()) as { code?: string }).code, code);
  }
});

test('unimplemented photo writes still require an idempotency key', async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: auth('point_operator'),
    consumeRateLimitFn: allowRateLimit,
    getActiveAssignmentByUserFn: async () => assignment(),
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: 'data:image/png;base64,AA==',
      }),
    }),
  );
  assert.equal(response.status, 422);
  assert.equal(
    ((await response.json()) as { code?: string }).code,
    'idempotency_key_required',
  );
});

test('photo and password strict schemas reject spoofed fields before dependencies', async () => {
  let calls = 0;
  for (const [view, body, dependency] of [
    [
      'photo',
      {
        imageData: 'data:image/png;base64,AA==',
        pointId: 'spoofed',
      },
      {
        submitPhotoFn: async () => {
          calls += 1;
          return { eventId: 'photo-1' };
        },
      },
    ],
    [
      'password',
      {
        currentPassword: 'TemporaryPass123!',
        newPassword: 'ReplacementPass123!',
        operatorUserId: 'spoofed',
      },
      {
        changePasswordFn: async () => {
          calls += 1;
          return { changed: true };
        },
      },
    ],
  ] as const) {
    const handler = createPointOperatorHandler({
      requireUserFn: auth('point_operator'),
      consumeRateLimitFn: allowRateLimit,
      idempotencyStore: memStore(),
      getActiveAssignmentByUserFn: async () => assignment(),
      ...dependency,
    });
    const response = await handler(
      new Request(`http://localhost/api/point-operator?view=${view}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `${view}-spoof`,
        },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(response.status, 422, view);
  }
  assert.equal(calls, 0);
});

test('unknown views and wrong methods are controlled', async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: auth('point_operator'),
    consumeRateLimitFn: allowRateLimit,
  });
  const unknown = await handler(
    new Request('http://localhost/api/point-operator?view=surprise'),
  );
  const wrongMethod = await handler(
    new Request('http://localhost/api/point-operator?view=me', {
      method: 'POST',
    }),
  );
  assert.equal(unknown.status, 404);
  assert.equal(wrongMethod.status, 405);
});

test('storage failures map to a controlled 503 response', async () => {
  const handler = createPointOperatorHandler({
    requireUserFn: auth('admin'),
    consumeRateLimitFn: allowRateLimit,
    searchReadablePointsFn: async () => {
      throw new StorageUnavailableError('database offline');
    },
  });
  const response = await handler(
    new Request('http://localhost/api/point-operator?view=admin_search_points'),
  );
  assert.equal(response.status, 503);
  assert.equal(
    ((await response.json()) as { code?: string }).code,
    'storage_unavailable',
  );
});

test('generic user handlers reject point_operator role changes', async () => {
  const createHandler = createAdminAccountCreateHandler();
  const accessHandler = createAdminAccountAccessHandler();
  const createResponse = await createHandler(
    new Request('http://localhost/api/user?view=account_create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'operator@example.com',
        name: 'Operator',
        password: 'StrongPass123!',
        role: 'point_operator',
      }),
    }),
    'admin@example.com',
  );
  const accessResponse = await accessHandler(
    new Request('http://localhost/api/user?view=account_access', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'operator@example.com',
        role: 'point_operator',
      }),
    }),
    'admin@example.com',
  );
  assert.equal(createResponse.status, 400);
  assert.equal(accessResponse.status, 400);
});
