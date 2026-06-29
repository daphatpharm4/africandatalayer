const DB_NAME = "adl_point_operator_queue";
const STORE_NAME = "point_operator_mutation_queue";
const DB_VERSION = 1;
const MAX_QUEUE_ITEMS = 75;
const MAX_QUEUE_RETRY_COUNT = 6;

export type PointOperatorMutation =
  | { kind: "signal"; field: string; value: boolean; capturedAt: string }
  | { kind: "photo"; imageData: string; capturedAt: string };

export interface PointOperatorQueueItem {
  id: string;
  idempotencyKey: string;
  mutation: PointOperatorMutation;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  nextRetryAt?: string;
  lastError?: string;
  createdAt: string;
}

export interface PointOperatorQueueFlushSummary {
  synced: number;
  failed: number;
  syncedIds: string[];
  failedIds: string[];
  permanentFailures: number;
  permanentFailureIds: string[];
  permanentFailureMessages: string[];
  remaining: number;
}

type SendPointOperatorMutation = (
  mutation: PointOperatorMutation,
  options: { idempotencyKey: string },
) => Promise<void>;

function ensureIndexedDb(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available");
  }
  return indexedDB;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function openDb(): Promise<IDBDatabase> {
  const db = ensureIndexedDb();
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = db.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const nextDb = request.result;
      if (!nextDb.objectStoreNames.contains(STORE_NAME)) {
        nextDb.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putItem(item: PointOperatorQueueItem): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(item);
  await transactionDone(tx);
  db.close();
}

async function updateItem(id: string, updater: (item: PointOperatorQueueItem) => PointOperatorQueueItem): Promise<void> {
  const current = await getPointOperatorQueueItem(id);
  if (!current) return;
  await putItem(updater(current));
}

function getQueueErrorInfo(error: unknown): { message: string; retryable: boolean } {
  const fallback = "Unable to sync point operator mutation";
  if (error instanceof Error) {
    const typed = error as Error & { retryable?: unknown; status?: unknown };
    const message = error.message.trim() || fallback;
    if (typeof typed.retryable === "boolean") {
      return { message, retryable: typed.retryable };
    }
    if (
      typeof typed.status === "number" &&
      [401, 403, 409, 422].includes(typed.status)
    ) {
      return { message, retryable: false };
    }
    return { message, retryable: true };
  }

  const typed = error as { retryable?: unknown; status?: unknown } | null | undefined;
  if (typed && typeof typed.retryable === "boolean") {
    return { message: String(error ?? fallback), retryable: typed.retryable };
  }
  if (typed && typeof typed.status === "number" && [401, 403, 409, 422].includes(typed.status)) {
    return { message: String(error ?? fallback), retryable: false };
  }
  return { message: String(error ?? fallback), retryable: true };
}

function nextRetryIso(now: number, retryCount: number): string {
  const baseDelay = Math.min(30000, 1000 * Math.pow(2, retryCount));
  const jitter = Math.random() * 1000;
  return new Date(now + baseDelay + jitter).toISOString();
}

export async function enqueuePointOperatorMutation(
  mutation: PointOperatorMutation,
): Promise<PointOperatorQueueItem> {
  const existingItems = await listPointOperatorQueueItems();
  if (existingItems.length >= MAX_QUEUE_ITEMS) {
    throw new Error(`Point operator queue is full (${MAX_QUEUE_ITEMS} items). Sync or clear older items before adding more.`);
  }

  const now = new Date().toISOString();
  const item: PointOperatorQueueItem = {
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    mutation,
    status: "pending",
    retryCount: 0,
    createdAt: now,
  };
  await putItem(item);
  return item;
}

export async function listPointOperatorQueueItems(): Promise<PointOperatorQueueItem[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const request = tx.objectStore(STORE_NAME).getAll();
  const result = await requestToPromise(request);
  await transactionDone(tx);
  db.close();
  return (result as PointOperatorQueueItem[]).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export async function getPointOperatorQueueItem(id: string): Promise<PointOperatorQueueItem | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const request = tx.objectStore(STORE_NAME).get(id);
  const result = await requestToPromise(request);
  await transactionDone(tx);
  db.close();
  return (result as PointOperatorQueueItem | undefined) ?? null;
}

export async function removePointOperatorQueueItem(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await transactionDone(tx);
  db.close();
}

export async function flushPointOperatorQueue(
  sendFn: SendPointOperatorMutation,
): Promise<PointOperatorQueueFlushSummary> {
  const items = await listPointOperatorQueueItems();
  const now = Date.now();
  let synced = 0;
  let failed = 0;
  const syncedIds: string[] = [];
  const failedIds: string[] = [];
  let permanentFailures = 0;
  const permanentFailureIds: string[] = [];
  const permanentFailureMessages = new Set<string>();

  for (const item of items) {
    if (item.nextRetryAt && new Date(item.nextRetryAt).getTime() > now) {
      failed += 1;
      failedIds.push(item.id);
      continue;
    }

    await updateItem(item.id, (current) => ({
      ...current,
      status: "syncing",
    }));

    try {
      await sendFn(item.mutation, { idempotencyKey: item.idempotencyKey });
      await removePointOperatorQueueItem(item.id);
      synced += 1;
      syncedIds.push(item.id);
    } catch (error) {
      const details = getQueueErrorInfo(error);
      if (details.retryable) {
        const retryCount = (item.retryCount ?? 0) + 1;
        if (retryCount > MAX_QUEUE_RETRY_COUNT) {
          permanentFailures += 1;
          permanentFailureIds.push(item.id);
          permanentFailureMessages.add(details.message);
          await removePointOperatorQueueItem(item.id);
          continue;
        }

        failed += 1;
        failedIds.push(item.id);
        await updateItem(item.id, (current) => ({
          ...current,
          status: "failed",
          retryCount,
          nextRetryAt: nextRetryIso(now, retryCount),
          lastError: details.message,
        }));
        continue;
      }

      permanentFailures += 1;
      permanentFailureIds.push(item.id);
      permanentFailureMessages.add(details.message);
      await removePointOperatorQueueItem(item.id);
    }
  }

  return {
    synced,
    failed,
    syncedIds,
    failedIds,
    permanentFailures,
    permanentFailureIds,
    permanentFailureMessages: Array.from(permanentFailureMessages),
    remaining: (await listPointOperatorQueueItems()).length,
  };
}
