import type { SubmissionInput } from '../../shared/types';

const DB_NAME = 'adl_offline_queue';
const STORE_NAME = 'submission_queue';
const SYNC_ERROR_STORE_NAME = 'submission_sync_errors';
const DB_VERSION = 2;
const SESSION_SYNC_COUNT_KEY = 'adl_queue_session_synced';
const MAX_QUEUE_ITEMS = 75;
const MAX_QUEUE_RETRY_COUNT = 6;
const MAX_QUEUE_ITEM_AGE_MS = 72 * 60 * 60 * 1000;

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

export interface QueueSnapshot {
  pending: number;
  failed: number;
  total: number;
  synced: number;
  queuedFailed: number;
  rejected: number;
  storageBytes: number;
}

type QueueSnapshotListener = (snapshot: QueueSnapshot) => void;

const queueSnapshotListeners = new Set<QueueSnapshotListener>();

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

function isStaleItem(item: QueueItem, now = Date.now()): boolean {
  return now - new Date(item.createdAt).getTime() > MAX_QUEUE_ITEM_AGE_MS;
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

function readSyncedCount(): number {
  try {
    const raw = window.localStorage.getItem(SESSION_SYNC_COUNT_KEY);
    const parsed = Number(raw ?? '0');
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  } catch {
    return 0;
  }
}

function writeSyncedCount(value: number): void {
  try {
    window.localStorage.setItem(SESSION_SYNC_COUNT_KEY, String(Math.max(0, Math.floor(value))));
  } catch {
    // Ignore storage failures; queue persistence still works via IndexedDB.
  }
}

function incrementSyncedCount(value: number): void {
  if (!Number.isFinite(value) || value <= 0) return;
  writeSyncedCount(readSyncedCount() + Math.floor(value));
}

async function emitQueueSnapshot(): Promise<void> {
  if (queueSnapshotListeners.size === 0) return;
  try {
    const snapshot = await getQueueSnapshot();
    queueSnapshotListeners.forEach((listener) => listener(snapshot));
  } catch {
    // Snapshot reads should never break queue operations.
  }
}

export function subscribeQueueSnapshot(listener: QueueSnapshotListener): () => void {
  queueSnapshotListeners.add(listener);
  void getQueueSnapshot().then(listener).catch(() => undefined);
  return () => {
    queueSnapshotListeners.delete(listener);
  };
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

async function putItem(item: QueueItem, options: { notify?: boolean } = {}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(item);
  await transactionDone(tx);
  db.close();
  if (options.notify !== false) await emitQueueSnapshot();
}

async function deleteSyncErrorRecordsByQueueItemId(queueItemId: string, options: { notify?: boolean } = {}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SYNC_ERROR_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SYNC_ERROR_STORE_NAME);
  const request = store.getAll();
  const result = await requestToPromise(request);
  for (const record of result as SyncErrorRecord[]) {
    if (record.queueItemId === queueItemId) {
      store.delete(record.id);
    }
  }
  await transactionDone(tx);
  db.close();
  if (options.notify !== false) await emitQueueSnapshot();
}

export async function enqueueSubmission(payload: SubmissionInput): Promise<QueueItem> {
  const existingItems = await listQueueItems();
  if (existingItems.length >= MAX_QUEUE_ITEMS) {
    throw new Error(`Offline queue is full (${MAX_QUEUE_ITEMS} items). Sync or clear older items before adding more.`);
  }
  const now = new Date().toISOString();
  const item: QueueItem = {
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    payload,
    status: 'pending',
    attempts: 0,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
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

export async function getQueueItem(id: string): Promise<QueueItem | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).get(id);
  const result = await requestToPromise(request);
  await transactionDone(tx);
  db.close();
  return (result as QueueItem | undefined) ?? null;
}

async function updateItem(
  id: string,
  updater: (item: QueueItem) => QueueItem,
  options: { notify?: boolean } = {},
): Promise<QueueItem | null> {
  const db = await openDb();
  const updated = await new Promise<QueueItem | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let nextItem: QueueItem | null = null;
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result as QueueItem | undefined;
      if (!existing) return;
      nextItem = updater(existing);
      store.put(nextItem);
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => resolve(nextItem);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
  db.close();
  if (options.notify !== false) await emitQueueSnapshot();
  return updated;
}

async function removeItem(id: string, options: { notify?: boolean } = {}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  await transactionDone(tx);
  db.close();
  if (options.notify !== false) await emitQueueSnapshot();
}

async function putSyncErrorRecord(record: SyncErrorRecord, options: { notify?: boolean } = {}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SYNC_ERROR_STORE_NAME, 'readwrite');
  tx.objectStore(SYNC_ERROR_STORE_NAME).put(record);
  await transactionDone(tx);
  db.close();
  if (options.notify !== false) await emitQueueSnapshot();
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
  await emitQueueSnapshot();
}

export async function deleteQueueItem(id: string): Promise<void> {
  await removeItem(id, { notify: false });
  await deleteSyncErrorRecordsByQueueItemId(id, { notify: false });
  await emitQueueSnapshot();
}

export async function updateQueueItemPayload(id: string, payload: SubmissionInput): Promise<QueueItem | null> {
  const updated = await updateItem(
    id,
    (current) => ({
      ...current,
      payload,
      status: 'pending',
      retryCount: 0,
      nextRetryAt: undefined,
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    }),
    { notify: false },
  );
  await deleteSyncErrorRecordsByQueueItemId(id, { notify: false });
  await emitQueueSnapshot();
  return updated;
}

export async function retryQueueItem(
  id: string,
  sendFn?: (payload: SubmissionInput, options?: { idempotencyKey?: string }) => Promise<void>,
): Promise<QueueSyncSummary | null> {
  const item = await updateItem(
    id,
    (current) => ({
      ...current,
      status: 'pending',
      retryCount: 0,
      nextRetryAt: undefined,
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    }),
    { notify: false },
  );
  await deleteSyncErrorRecordsByQueueItemId(id, { notify: false });
  await emitQueueSnapshot();
  if (!item || !sendFn || !navigator.onLine) return null;
  return flushOfflineQueue(sendFn);
}

export async function getQueueSnapshot(): Promise<QueueSnapshot> {
  const [items, syncErrors] = await Promise.all([listQueueItems(), listSyncErrorRecords()]);
  const pending = items.filter((item) => item.status === 'pending' || item.status === 'syncing').length;
  const queuedFailed = items.filter((item) => item.status === 'failed').length;
  const rejected = syncErrors.length;
  const storageBytes = new TextEncoder().encode(JSON.stringify(items)).length;
  return {
    pending,
    failed: queuedFailed + rejected,
    total: items.length,
    synced: readSyncedCount(),
    queuedFailed,
    rejected,
    storageBytes,
  };
}

export async function getQueueStats(): Promise<{ pending: number; failed: number; total: number }> {
  const snapshot = await getQueueSnapshot();
  return {
    pending: snapshot.pending,
    failed: snapshot.failed,
    total: snapshot.total,
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
    if (isStaleItem(item, now)) {
      permanentFailures += 1;
      permanentFailureIds.push(item.id);
      permanentFailureMessages.add('Queued submission expired before it could be synced');
      await putSyncErrorRecord(
        {
          id: crypto.randomUUID(),
          queueItemId: item.id,
          message: 'Queued submission expired before it could be synced',
          createdAt: new Date().toISOString(),
          payloadSummary: {
            eventType: item.payload.eventType,
            category: item.payload.category,
            pointId: item.payload.pointId,
            location: item.payload.location,
          },
        },
        { notify: false },
      );
      await removeItem(item.id, { notify: false });
      continue;
    }

    if (item.nextRetryAt && new Date(item.nextRetryAt).getTime() > now) {
      failed += 1;
      failedIds.push(item.id);
      continue;
    }

    await updateItem(
      item.id,
      (current) => ({
        ...current,
        status: 'syncing',
        attempts: current.attempts + 1,
        updatedAt: new Date().toISOString(),
      }),
      { notify: false },
    );

    try {
      await sendFn(item.payload, { idempotencyKey: item.idempotencyKey });
      await removeItem(item.id, { notify: false });
      await deleteSyncErrorRecordsByQueueItemId(item.id, { notify: false });
      synced += 1;
      syncedIds.push(item.id);
    } catch (error) {
      const details = toQueueErrorInfo(error);
      if (details.retryable) {
        const retryCount = (item.retryCount ?? 0) + 1;
        if (retryCount > MAX_QUEUE_RETRY_COUNT) {
          permanentFailures += 1;
          permanentFailureIds.push(item.id);
          permanentFailureMessages.add(details.message);
          await putSyncErrorRecord(
            {
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
            },
            { notify: false },
          );
          await removeItem(item.id, { notify: false });
          continue;
        }
        failed += 1;
        failedIds.push(item.id);
        const baseDelay = Math.min(30000, 1000 * Math.pow(2, retryCount));
        const jitter = Math.random() * 1000;
        const nextRetryAt = new Date(now + baseDelay + jitter).toISOString();
        await updateItem(
          item.id,
          (current) => ({
            ...current,
            status: 'failed',
            retryCount,
            nextRetryAt,
            updatedAt: new Date().toISOString(),
            lastError: details.message,
          }),
          { notify: false },
        );
        continue;
      }

      permanentFailures += 1;
      permanentFailureIds.push(item.id);
      permanentFailureMessages.add(details.message);
      await putSyncErrorRecord(
        {
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
        },
        { notify: false },
      );
      await removeItem(item.id, { notify: false });
    }
  }

  if (synced > 0) {
    incrementSyncedCount(synced);
  }

  const remaining = (await listQueueItems()).length;
  await emitQueueSnapshot();
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
