import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Pencil, RefreshCw, RotateCcw, Trash2, Wifi, WifiOff } from 'lucide-react';
import {
  clearSyncErrorRecords,
  deleteQueueItem,
  flushOfflineQueue,
  getQueueSnapshot,
  listQueueItems,
  listSyncErrorRecords,
  retryQueueItem,
  subscribeQueueSnapshot,
  type QueueItem,
  type QueueSnapshot,
  type SyncErrorRecord,
} from '../../lib/client/offlineQueue';
import { sendSubmissionPayload } from '../../lib/client/submissionSync';
import { categoryLabel } from '../../shared/verticals';

interface Props {
  onBack: () => void;
  onEditDraft: (item: QueueItem) => void;
  language: 'en' | 'fr';
}

function formatStorage(bytes: number, language: 'en' | 'fr'): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return language === 'fr' ? '0 Mo' : '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} ${language === 'fr' ? 'Mo' : 'MB'}`;
}

function queueTitle(item: QueueItem, language: 'en' | 'fr'): string {
  const details = (item.payload.details ?? {}) as Record<string, unknown>;
  const name =
    (typeof details.siteName === 'string' && details.siteName.trim()) ||
    (typeof details.name === 'string' && details.name.trim()) ||
    (typeof details.roadName === 'string' && details.roadName.trim());
  return name || categoryLabel(item.payload.category, language);
}

function formatWhen(iso: string, language: 'en' | 'fr'): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return language === 'fr' ? 'Date inconnue' : 'Unknown date';
  return parsed.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SubmissionQueue: React.FC<Props> = ({ onBack, onEditDraft, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [syncErrors, setSyncErrors] = useState<SyncErrorRecord[]>([]);
  const [snapshot, setSnapshot] = useState<QueueSnapshot>({
    pending: 0,
    failed: 0,
    total: 0,
    synced: 0,
    queuedFailed: 0,
    rejected: 0,
    storageBytes: 0,
  });
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [queueItems, records, nextSnapshot] = await Promise.all([
          listQueueItems(),
          listSyncErrorRecords(),
          getQueueSnapshot(),
        ]);
        if (cancelled) return;
        setItems(queueItems);
        setSyncErrors(records);
        setSnapshot(nextSnapshot);
      } catch (error) {
        if (cancelled) return;
        setActionError(error instanceof Error ? error.message : t('Unable to load queue.', 'Impossible de charger la file.'));
      }
    };

    void load();
    const unsubscribe = subscribeQueueSnapshot((nextSnapshot) => {
      if (cancelled) return;
      setSnapshot(nextSnapshot);
      void listQueueItems().then((queueItems) => {
        if (!cancelled) setItems(queueItems);
      });
      void listSyncErrorRecords().then((records) => {
        if (!cancelled) setSyncErrors(records);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [language]);

  const failedItems = useMemo(() => items.filter((item) => item.status === 'failed'), [items]);
  const pendingItems = useMemo(() => items.filter((item) => item.status === 'pending' || item.status === 'syncing'), [items]);

  const handleForceSync = async () => {
    setActionError('');
    setActionMessage('');
    try {
      setIsRefreshing(true);
      const summary = await flushOfflineQueue(sendSubmissionPayload);
      if (summary.synced > 0) {
        setActionMessage(t(`${summary.synced} item(s) synced.`, `${summary.synced} element(s) synchronises.`));
      } else if (summary.failed > 0 || summary.permanentFailures > 0) {
        setActionMessage(t('Some items still need attention.', 'Certains elements necessitent encore une action.'));
      } else {
        setActionMessage(t('Queue already up to date.', 'La file est deja a jour.'));
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Unable to sync queue.', 'Impossible de synchroniser la file.'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetryItem = async (itemId: string) => {
    setActionError('');
    setActionMessage('');
    try {
      setActiveItemId(itemId);
      await retryQueueItem(itemId, sendSubmissionPayload);
      setActionMessage(t('Retry scheduled.', 'Nouvelle tentative planifiee.'));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Unable to retry item.', 'Impossible de relancer cet element.'));
    } finally {
      setActiveItemId(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setActionError('');
    setActionMessage('');
    try {
      setActiveItemId(itemId);
      await deleteQueueItem(itemId);
      setActionMessage(t('Queue item deleted.', 'Element supprime.'));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Unable to delete queue item.', 'Impossible de supprimer cet element.'));
    } finally {
      setActiveItemId(null);
    }
  };

  const handleClearRejected = async () => {
    setActionError('');
    setActionMessage('');
    try {
      await clearSyncErrorRecords();
      setActionMessage(t('Rejected records cleared.', 'Les rejets ont ete effaces.'));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Unable to clear rejected records.', 'Impossible d effacer les rejets.'));
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-[#0f2b46] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">{t('Submission Queue', 'File de soumission')}</h3>
        <button
          type="button"
          onClick={handleForceSync}
          disabled={isRefreshing}
          className="p-2 text-[#0f2b46] absolute right-2 disabled:text-gray-300"
          aria-label={t('Force sync', 'Forcer la synchronisation')}
        >
          <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Pending', 'En attente')}</div>
            <div className="mt-2 text-2xl font-bold text-[#0f2b46]">{snapshot.pending}</div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Failed', 'Echecs')}</div>
            <div className="mt-2 text-2xl font-bold text-[#c86b4a]">{snapshot.failed}</div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Synced', 'Synchronises')}</div>
            <div className="mt-2 text-2xl font-bold text-[#4c7c59]">{snapshot.synced}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Storage', 'Stockage')}</div>
              <div className="text-sm font-semibold text-gray-900">{formatStorage(snapshot.storageBytes, language)}</div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              {navigator.onLine ? <Wifi size={14} className="text-[#4c7c59]" /> : <WifiOff size={14} className="text-[#c86b4a]" />}
              <span>{navigator.onLine ? t('Online', 'En ligne') : t('Offline', 'Hors ligne')}</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-[#0f2b46]"
              style={{ width: `${Math.min(100, snapshot.total > 0 ? (snapshot.pending / snapshot.total) * 100 : 0)}%` }}
            />
          </div>
        </div>

        {actionMessage && (
          <div className="rounded-2xl border border-[#d2e6d8] bg-[#eaf3ee] p-4 text-xs text-[#2f855a]">
            {actionMessage}
          </div>
        )}

        {actionError && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
            {actionError}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#0f2b46]">
              {t('Failed Queue Items', 'Elements en echec')}
            </h4>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{failedItems.length}</span>
          </div>
          {failedItems.length === 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 text-xs text-gray-500">
              {t('No failed queue items.', 'Aucun element en echec.')}
            </div>
          )}
          {failedItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[#f5d5c6] bg-white p-4 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">{queueTitle(item, language)}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#c86b4a]">
                    {categoryLabel(item.payload.category, language)}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{formatWhen(item.updatedAt, language)}</div>
                </div>
                <span className="rounded-full bg-[#fff8f4] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#c86b4a]">
                  {item.status}
                </span>
              </div>
              {item.lastError && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-600">
                  {item.lastError}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleRetryItem(item.id)}
                  disabled={activeItemId === item.id}
                  className="h-10 rounded-xl bg-[#0f2b46] text-white text-[10px] font-bold uppercase tracking-widest disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <span className="inline-flex items-center gap-1">
                    <RotateCcw size={12} />
                    {t('Retry', 'Relancer')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onEditDraft(item)}
                  className="h-10 rounded-xl border border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-700"
                >
                  <span className="inline-flex items-center gap-1">
                    <Pencil size={12} />
                    {t('Edit', 'Modifier')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={activeItemId === item.id}
                  className="h-10 rounded-xl border border-red-100 bg-red-50 text-[10px] font-bold uppercase tracking-widest text-red-600 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <span className="inline-flex items-center gap-1">
                    <Trash2 size={12} />
                    {t('Delete', 'Supprimer')}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#0f2b46]">
              {t('Pending Queue', 'File en attente')}
            </h4>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{pendingItems.length}</span>
          </div>
          {pendingItems.length === 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 text-xs text-gray-500">
              {t('No queued items.', 'Aucun element en file.')}
            </div>
          )}
          {pendingItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">{queueTitle(item, language)}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
                    {categoryLabel(item.payload.category, language)}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{formatWhen(item.createdAt, language)}</div>
                </div>
                <span className="rounded-full bg-[#e7eef4] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {syncErrors.length > 0 && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-red-700">
                <AlertTriangle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {t('Rejected by Server', 'Rejetes par le serveur')} ({syncErrors.length})
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearRejected}
                className="text-[10px] font-bold uppercase tracking-widest text-red-700"
              >
                {t('Clear', 'Effacer')}
              </button>
            </div>
            <div className="space-y-2">
              {syncErrors.map((record) => (
                <div key={record.id} className="rounded-xl border border-red-100 bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-red-700">
                    {categoryLabel(record.payloadSummary.category, language)}
                  </div>
                  <div className="text-xs text-red-600 mt-1">{record.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionQueue;
