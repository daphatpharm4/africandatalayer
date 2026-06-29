import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
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
