import type { SubmissionInput } from '../../shared/types';

const DB_NAME = 'adl_offline_queue';
const STORE_NAME = 'submission_queue';
const DB_VERSION = 1;

export type QueueStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface QueueItem {
  id: string;
  payload: SubmissionInput;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueueSyncSummary {
  synced: number;
  failed: number;
  remaining: number;
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
    payload,
    status: 'pending',
    attempts: 0,
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

export async function getQueueStats(): Promise<{ pending: number; failed: number; total: number }> {
  const items = await listQueueItems();
  return {
    pending: items.filter((item) => item.status === 'pending' || item.status === 'syncing').length,
    failed: items.filter((item) => item.status === 'failed').length,
    total: items.length
  };
}

export async function flushOfflineQueue(sendFn: (payload: SubmissionInput) => Promise<void>): Promise<QueueSyncSummary> {
  const items = await listQueueItems();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    await updateItem(item.id, (current) => ({
      ...current,
      status: 'syncing',
      attempts: current.attempts + 1,
      updatedAt: new Date().toISOString()
    }));

    try {
      await sendFn(item.payload);
      await removeItem(item.id);
      synced += 1;
    } catch (error) {
      failed += 1;
      await updateItem(item.id, (current) => ({
        ...current,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : String(error)
      }));
    }
  }

  const remaining = (await listQueueItems()).length;
  return { synced, failed, remaining };
}
