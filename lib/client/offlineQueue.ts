import type { SubmissionInput } from '../../shared/types';

const DB_NAME = 'adl_offline_queue';
const STORE_NAME = 'submission_queue';
const SYNC_ERROR_STORE_NAME = 'submission_sync_errors';
const DB_VERSION = 2;

export type QueueStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface QueueItem {
  id: string;
  idempotencyKey: string;
  payload: SubmissionInput;
  status: QueueStatus;
  attempts: number;
  retryCount: number;
  nextRetryAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncErrorRecord {
  id: string;
  queueItemId: string;
  message: string;
  createdAt: string;
  payloadSummary: {
    eventType: SubmissionInput['eventType'];
    category: SubmissionInput['category'];
    pointId?: string;
    location?: SubmissionInput['location'];
  };
}

export interface QueueSyncSummary {
  synced: number;
  failed: number;
  syncedIds: string[];
  failedIds: string[];
  permanentFailures: number;
  permanentFailureIds: string[];
  permanentFailureMessages: string[];
  remaining: number;
}

function toQueueErrorInfo(error: unknown): { message: string; retryable: boolean } {
  const fallback = 'Unable to sync queued submission';
  if (error instanceof Error) {
    const withRetryable = error as Error & { retryable?: unknown };
    const retryable = typeof withRetryable.retryable === 'boolean' ? withRetryable.retryable : true;
    const message = error.message?.trim() || fallback;
    return { message, retryable };
  }
  return { message: String(error ?? fallback), retryable: true };
}

function ensureIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available');
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
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function openDb(): Promise<IDBDatabase> {
  const db = ensureIndexedDb();
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = db.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const nextDb = request.result;
      if (!nextDb.objectStoreNames.contains(STORE_NAME)) {
        nextDb.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!nextDb.objectStoreNames.contains(SYNC_ERROR_STORE_NAME)) {
        nextDb.createObjectStore(SYNC_ERROR_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putItem(item: QueueItem): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(item);
  await transactionDone(tx);
  db.close();
}

export async function enqueueSubmission(payload: SubmissionInput): Promise<QueueItem> {
  const now = new Date().toISOString();
  const item: QueueItem = {
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    payload,
    status: 'pending',
    attempts: 0,
    retryCount: 0,
    createdAt: now,
    updatedAt: now
  };
  await putItem(item);
  return item;
}

export async function listQueueItems(): Promise<QueueItem[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).getAll();
  const result = await requestToPromise(request);
  await transactionDone(tx);
  db.close();
  return (result as QueueItem[]).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function updateItem(id: string, updater: (item: QueueItem) => QueueItem): Promise<QueueItem | null> {
  const db = await openDb();
  return await new Promise<QueueItem | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let updated: QueueItem | null = null;
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result as QueueItem | undefined;
      if (!existing) return;
      updated = updater(existing);
      store.put(updated);
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => {
      db.close();
      resolve(updated);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    };
  });
}

async function removeItem(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  await transactionDone(tx);
  db.close();
}

async function putSyncErrorRecord(record: SyncErrorRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SYNC_ERROR_STORE_NAME, 'readwrite');
  tx.objectStore(SYNC_ERROR_STORE_NAME).put(record);
  await transactionDone(tx);
  db.close();
}

export async function listSyncErrorRecords(): Promise<SyncErrorRecord[]> {
  const db = await openDb();
  const tx = db.transaction(SYNC_ERROR_STORE_NAME, 'readonly');
  const request = tx.objectStore(SYNC_ERROR_STORE_NAME).getAll();
  const result = await requestToPromise(request);
  await transactionDone(tx);
  db.close();
  return (result as SyncErrorRecord[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function clearSyncErrorRecords(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SYNC_ERROR_STORE_NAME, 'readwrite');
  tx.objectStore(SYNC_ERROR_STORE_NAME).clear();
  await transactionDone(tx);
  db.close();
}

export async function getQueueStats(): Promise<{ pending: number; failed: number; total: number }> {
  const items = await listQueueItems();
  return {
    pending: items.filter((item) => item.status === 'pending' || item.status === 'syncing').length,
    failed: items.filter((item) => item.status === 'failed').length,
    total: items.length
  };
}

export async function flushOfflineQueue(
  sendFn: (payload: SubmissionInput, options?: { idempotencyKey?: string }) => Promise<void>,
): Promise<QueueSyncSummary> {
  const items = await listQueueItems();
  const now = Date.now();
  let synced = 0;
  let failed = 0;
  const syncedIds: string[] = [];
  const failedIds: string[] = [];
  let permanentFailures = 0;
  const permanentFailureIds: string[] = [];
  const permanentFailureMessages = new Set<string>();

  for (const item of items) {
    // Skip items not yet ready for retry (exponential backoff).
    if (item.nextRetryAt && new Date(item.nextRetryAt).getTime() > now) {
      failed += 1;
      failedIds.push(item.id);
      continue;
    }

    await updateItem(item.id, (current) => ({
      ...current,
      status: 'syncing',
      attempts: current.attempts + 1,
      updatedAt: new Date().toISOString()
    }));

    try {
      await sendFn(item.payload, { idempotencyKey: item.idempotencyKey });
      await removeItem(item.id);
      synced += 1;
      syncedIds.push(item.id);
    } catch (error) {
      const details = toQueueErrorInfo(error);
      if (details.retryable) {
        failed += 1;
        failedIds.push(item.id);
        const retryCount = (item.retryCount ?? 0) + 1;
        const baseDelay = Math.min(30000, 1000 * Math.pow(2, retryCount));
        const jitter = Math.random() * 1000;
        const nextRetryAt = new Date(now + baseDelay + jitter).toISOString();
        await updateItem(item.id, (current) => ({
          ...current,
          status: 'failed',
          retryCount,
          nextRetryAt,
          updatedAt: new Date().toISOString(),
          lastError: details.message,
        }));
        continue;
      }

      permanentFailures += 1;
      permanentFailureIds.push(item.id);
      permanentFailureMessages.add(details.message);
      await putSyncErrorRecord({
        id: crypto.randomUUID(),
        queueItemId: item.id,
        message: details.message,
        createdAt: new Date().toISOString(),
        payloadSummary: {
          eventType: item.payload.eventType,
          category: item.payload.category,
          pointId: item.payload.pointId,
          location: item.payload.location,
        },
      });
      await removeItem(item.id);
    }
  }

  const remaining = (await listQueueItems()).length;
  return {
    synced,
    failed,
    syncedIds,
    failedIds,
    permanentFailures,
    permanentFailureIds,
    permanentFailureMessages: Array.from(permanentFailureMessages),
    remaining,
  };
}
