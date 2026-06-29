import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { submitPointOperatorSignal } from "../lib/client/pointOperatorApi.ts";
import {
  enqueuePointOperatorMutation,
  flushPointOperatorQueue,
  listPointOperatorQueueItems,
} from "../lib/client/pointOperatorQueue.ts";

type StoreData = Map<string, unknown>;

class FakeIDBRequest<T = unknown> {
  result!: T;
  error: Error | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;

  succeed(result: T): void {
    this.result = result;
    queueMicrotask(() => this.onsuccess?.());
  }
}

class FakeIDBOpenRequest extends FakeIDBRequest<FakeIDBDatabase> {
  onupgradeneeded: (() => void) | null = null;
}

class FakeIDBObjectStore {
  constructor(
    private readonly data: StoreData,
    private readonly tx: FakeIDBTransaction,
  ) {}

  put(value: { id: string }): FakeIDBRequest<string> {
    const request = new FakeIDBRequest<string>();
    queueMicrotask(() => {
      this.data.set(value.id, structuredClone(value));
      request.succeed(value.id);
      this.tx.finish();
    });
    return request;
  }

  get(id: string): FakeIDBRequest<unknown> {
    const request = new FakeIDBRequest<unknown>();
    queueMicrotask(() => {
      const value = this.data.get(id);
      request.succeed(value === undefined ? undefined : structuredClone(value));
      this.tx.finish();
    });
    return request;
  }

  getAll(): FakeIDBRequest<unknown[]> {
    const request = new FakeIDBRequest<unknown[]>();
    queueMicrotask(() => {
      request.succeed(Array.from(this.data.values(), (item) => structuredClone(item)));
      this.tx.finish();
    });
    return request;
  }

  delete(id: string): FakeIDBRequest<undefined> {
    const request = new FakeIDBRequest<undefined>();
    queueMicrotask(() => {
      this.data.delete(id);
      request.succeed(undefined);
      this.tx.finish();
    });
    return request;
  }

  clear(): FakeIDBRequest<undefined> {
    const request = new FakeIDBRequest<undefined>();
    queueMicrotask(() => {
      this.data.clear();
      request.succeed(undefined);
      this.tx.finish();
    });
    return request;
  }
}

class FakeIDBTransaction {
  private completeHandler: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  error: Error | null = null;
  private pending = 0;
  private completed = false;

  constructor(private readonly stores: Map<string, StoreData>) {}

  get oncomplete(): (() => void) | null {
    return this.completeHandler;
  }

  set oncomplete(handler: (() => void) | null) {
    this.completeHandler = handler;
    if (this.completed && handler) queueMicrotask(handler);
  }

  objectStore(name: string): FakeIDBObjectStore {
    this.pending += 1;
    return new FakeIDBObjectStore(this.stores.get(name) ?? new Map(), this);
  }

  finish(): void {
    this.pending -= 1;
    if (!this.completed && this.pending <= 0) {
      this.completed = true;
      queueMicrotask(() => this.completeHandler?.());
    }
  }
}

class FakeIDBDatabase {
  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };

  constructor(private readonly stores: Map<string, StoreData>) {}

  createObjectStore(name: string): void {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
  }

  transaction(name: string): FakeIDBTransaction {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    return new FakeIDBTransaction(this.stores);
  }

  close(): void {}
}

class FakeIDBFactory {
  private readonly databases = new Map<string, Map<string, StoreData>>();

  open(name: string): FakeIDBOpenRequest {
    const request = new FakeIDBOpenRequest();
    queueMicrotask(() => {
      let stores = this.databases.get(name);
      const isNew = !stores;
      if (!stores) {
        stores = new Map();
        this.databases.set(name, stores);
      }
      request.result = new FakeIDBDatabase(stores);
      if (isNew) request.onupgradeneeded?.();
      request.succeed(request.result);
    });
    return request;
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: new FakeIDBFactory(),
  });
});

test("queued signal replays with stable idempotency key", async () => {
  const item = await enqueuePointOperatorMutation({
    kind: "signal",
    field: "isOpenNow",
    value: true,
    capturedAt: "2026-06-24T08:00:00.000Z",
  });
  const calls: Array<{ key: string; field: string }> = [];
  const result = await flushPointOperatorQueue(async (mutation, options) => {
    assert.equal(mutation.kind, "signal");
    calls.push({ key: options.idempotencyKey, field: mutation.field });
  });
  assert.equal(result.synced, 1);
  assert.deepEqual(calls, [{ key: item.idempotencyKey, field: "isOpenNow" }]);
});

test("retryable failure leaves item queued as failed with next retry", async () => {
  const item = await enqueuePointOperatorMutation({
    kind: "signal",
    field: "isOpenNow",
    value: false,
    capturedAt: "2026-06-24T08:00:00.000Z",
  });

  const error = new Error("Network unavailable") as Error & { retryable: boolean };
  error.retryable = true;
  const result = await flushPointOperatorQueue(async () => {
    throw error;
  });

  assert.equal(result.failed, 1);
  assert.deepEqual(result.failedIds, [item.id]);
  assert.equal(result.remaining, 1);

  const [queued] = await listPointOperatorQueueItems();
  assert.equal(queued.id, item.id);
  assert.equal(queued.status, "failed");
  assert.equal(queued.retryCount, 1);
  assert.equal(queued.lastError, "Network unavailable");
  assert.ok(queued.nextRetryAt);
});

test("permanent 403 removes item and reports permanent failure", async () => {
  const item = await enqueuePointOperatorMutation({
    kind: "signal",
    field: "isOpenNow",
    value: true,
    capturedAt: "2026-06-24T08:00:00.000Z",
  });
  const error = new Error("Forbidden") as Error & { status: number };
  error.status = 403;

  const result = await flushPointOperatorQueue(async () => {
    throw error;
  });

  assert.equal(result.permanentFailures, 1);
  assert.deepEqual(result.permanentFailureIds, [item.id]);
  assert.deepEqual(result.permanentFailureMessages, ["Forbidden"]);
  assert.equal(result.remaining, 0);
  assert.deepEqual(await listPointOperatorQueueItems(), []);
});

test("point operator API 403 error is permanent and removes queued item", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      headers: { "Content-Type": "text/plain" },
    });

  try {
    await assert.rejects(
      () =>
        submitPointOperatorSignal(
          {
            field: "isOpenNow",
            value: true,
            capturedAt: "2026-06-24T08:00:00.000Z",
          },
          { idempotencyKey: "idem-direct" },
        ),
      (error) => {
        const typed = error as Error & { status?: number; retryable?: boolean };
        assert.equal(typed.status, 403);
        assert.equal(typed.retryable, false);
        return true;
      },
    );

    const item = await enqueuePointOperatorMutation({
      kind: "signal",
      field: "isOpenNow",
      value: true,
      capturedAt: "2026-06-24T08:00:00.000Z",
    });
    const result = await flushPointOperatorQueue((mutation, options) => {
      assert.equal(mutation.kind, "signal");
      return submitPointOperatorSignal(mutation, options);
    });

    assert.equal(result.permanentFailures, 1);
    assert.deepEqual(result.permanentFailureIds, [item.id]);
    assert.deepEqual(result.permanentFailureMessages, ["Forbidden"]);
    assert.equal(result.remaining, 0);
    assert.deepEqual(await listPointOperatorQueueItems(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submitPointOperatorSignal returns mutation response with point from po_me", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; idempotencyKey: string | null }> = [];
  const point = {
    id: "point-1",
    pointId: "point-1",
    category: "pharmacy",
    location: { latitude: 4.05, longitude: 9.76 },
    details: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    gaps: [],
    eventsCount: 1,
    eventIds: ["event-1"],
  };
  const signal = {
    field: "isOpenNow",
    value: true,
    reportedBy: "point_operator",
    reportedAt: "2026-06-24T08:00:00.000Z",
    expiresAt: "2026-06-24T12:00:00.000Z",
    isExpired: false,
    eventId: "event-1",
    reviewState: "pending",
  };
  const responses = [
    new Response(JSON.stringify({ eventId: "event-1" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
    new Response(
      JSON.stringify({
        assignment: {
          id: "assign-1",
          operatorUserId: "op@example.com",
          pointId: "point-1",
          status: "active",
          grantedBy: "admin@example.com",
          grantedAt: "2026-01-01T00:00:00.000Z",
        },
        point,
        controls: [],
        signals: { isOpenNow: signal },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  ];

  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      idempotencyKey: headers.get("Idempotency-Key"),
    });
    const response = responses.shift();
    assert.ok(response, "unexpected extra fetch call");
    return response;
  };

  try {
    const result = await submitPointOperatorSignal(
      {
        field: "isOpenNow",
        value: true,
        capturedAt: "2026-06-24T08:00:00.000Z",
      },
      { idempotencyKey: "idem-signal" },
    );

    assert.equal(result.eventId, "event-1");
    assert.deepEqual(result.point, point);
    assert.deepEqual(result.signal, signal);
    assert.deepEqual(calls, [
      {
        url: "/api/user?view=po_status",
        method: "POST",
        idempotencyKey: "idem-signal",
      },
      {
        url: "/api/user?view=po_me",
        method: "GET",
        idempotencyKey: null,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("duplicate replay does not duplicate after first flush succeeds", async () => {
  await enqueuePointOperatorMutation({
    kind: "photo",
    imageData: "data:image/jpeg;base64,abc",
    capturedAt: "2026-06-24T08:00:00.000Z",
  });
  let calls = 0;

  const first = await flushPointOperatorQueue(async () => {
    calls += 1;
  });
  const second = await flushPointOperatorQueue(async () => {
    calls += 1;
  });

  assert.equal(first.synced, 1);
  assert.equal(second.synced, 0);
  assert.equal(calls, 1);
});

test("concurrent flushes do not double-send the same queued item", async () => {
  await enqueuePointOperatorMutation({
    kind: "signal",
    field: "isOpenNow",
    value: true,
    capturedAt: "2026-06-24T08:00:00.000Z",
  });
  let calls = 0;
  let releaseSend: (() => void) | null = null;
  const sendStarted = new Promise<void>((resolve) => {
    releaseSend = resolve;
  });

  const first = flushPointOperatorQueue(async () => {
    calls += 1;
    await sendStarted;
  });
  const second = flushPointOperatorQueue(async () => {
    calls += 1;
  });

  assert.equal(calls, 0);
  releaseSend?.();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(calls, 1);
  assert.equal(firstResult.synced, 1);
  assert.equal(secondResult.synced, 1);
  assert.deepEqual(await listPointOperatorQueueItems(), []);
});

test("queue capacity is enforced", async () => {
  for (let index = 0; index < 75; index += 1) {
    await enqueuePointOperatorMutation({
      kind: "signal",
      field: "isOpenNow",
      value: index % 2 === 0,
      capturedAt: "2026-06-24T08:00:00.000Z",
    });
  }

  await assert.rejects(
    () =>
      enqueuePointOperatorMutation({
        kind: "signal",
        field: "isOpenNow",
        value: true,
        capturedAt: "2026-06-24T08:00:00.000Z",
      }),
    /Point operator queue is full \(75 items\)/,
  );
});
