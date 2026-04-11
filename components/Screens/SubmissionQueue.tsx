import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pencil, RefreshCw, RotateCcw, Trash2, Wifi, WifiOff } from 'lucide-react';
import ScreenHeader from '../shared/ScreenHeader';
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
        setActionError(error instanceof Error ? error.message : 'LOAD_FAILED');
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
  }, []);

  const failedItems = useMemo(() => items.filter((item) => item.status === 'failed'), [items]);
  const pendingItems = useMemo(() => items.filter((item) => item.status === 'pending' || item.status === 'syncing'), [items]);

  const handleForceSync = async () => {
    setActionError('');
    setActionMessage('');
    try {
      setIsRefreshing(true);
      const summary = await flushOfflineQueue(sendSubmissionPayload);
      if (summary.synced > 0) {
        setActionMessage(t(`${summary.synced} item(s) uploaded.`, `${summary.synced} élément(s) envoyé(s).`));
      } else if (summary.failed > 0 || summary.permanentFailures > 0) {
        setActionMessage(t('Some uploads still need attention.', 'Certains envois nécessitent encore une action.'));
      } else {
        setActionMessage(t('Everything is already uploaded.', 'Tout est déjà envoyé.'));
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Unable to upload. Try again later.', 'Impossible d\'envoyer. Réessayez plus tard.'));
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
      setActionMessage(t('Retrying now...', 'Nouvelle tentative en cours...'));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Unable to retry. Check your connection.', 'Impossible de réessayer. Vérifiez votre connexion.'));
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
      setActionMessage(t('Upload removed.', 'Envoi supprimé.'));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Unable to remove. Try again.', 'Impossible de supprimer. Réessayez.'));
    } finally {
      setActiveItemId(null);
    }
  };

  const handleClearRejected = async () => {
    setActionError('');
    setActionMessage('');
    try {
      await clearSyncErrorRecords();
      setActionMessage(t('Cleared.', 'Effacé.'));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('Unable to clear. Try again.', 'Impossible d\'effacer. Réessayez.'));
    }
  };

  return (
    <div data-testid="screen-submission-queue" className="screen-shell">
      <ScreenHeader
        title={t('Pending Uploads', 'Envois en attente')}
        onBack={onBack}
        language={language}
        trailing={
          <button
            type="button"
            onClick={handleForceSync}
            disabled={isRefreshing}
            className="p-2 text-navy disabled:text-gray-300"
            aria-label={t('Upload now', 'Envoyer maintenant')}
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="p-4 pb-24 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="micro-label text-gray-400">{t('Pending', 'En attente')}</div>
            <div className="mt-2 text-2xl font-bold text-navy">{snapshot.pending}</div>
          </div>
          <div className="card p-4">
            <div className="micro-label text-gray-400">{t('Failed', 'Échecs')}</div>
            <div className="mt-2 text-2xl font-bold text-terra">{snapshot.failed}</div>
          </div>
          <div className="card p-4">
            <div className="micro-label text-gray-400">{t('Uploaded', 'Envoyés')}</div>
            <div className="mt-2 text-2xl font-bold text-forest">{snapshot.synced}</div>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="micro-label text-gray-400">{t('Storage', 'Stockage')}</div>
              <div className="text-sm font-semibold text-gray-900">{formatStorage(snapshot.storageBytes, language)}</div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              {navigator.onLine ? <Wifi size={14} className="text-forest" /> : <WifiOff size={14} className="text-terra" />}
              <span>{navigator.onLine ? t('Online', 'En ligne') : t('Offline', 'Hors ligne')}</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-navy"
              style={{ width: `${Math.min(100, snapshot.total > 0 ? (snapshot.pending / snapshot.total) * 100 : 0)}%` }}
            />
          </div>
        </div>

        {actionMessage && (
          <div className="rounded-2xl border border-forest-wash bg-forest-wash p-4 text-xs text-forest">
            {actionMessage}
          </div>
        )}

        {actionError && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
            {actionError === 'LOAD_FAILED' ? t('Unable to load uploads.', 'Impossible de charger les envois.') : actionError}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-widest text-navy">
              {t('Failed Uploads', 'Envois échoués')}
            </h4>
            <span className="micro-label text-gray-400">{failedItems.length}</span>
          </div>
          {failedItems.length === 0 && (
            <div className="card p-4 text-xs text-gray-500">
              {t('No issues here. All uploads are good.', 'Aucun problème. Tous les envois sont bons.')}
            </div>
          )}
          {failedItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-terra-wash bg-white p-4 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">{queueTitle(item, language)}</div>
                  <div className="micro-label text-terra">
                    {categoryLabel(item.payload.category, language)}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{formatWhen(item.updatedAt, language)}</div>
                </div>
                <span className="rounded-full bg-terra-wash px-2 py-1 micro-label text-terra">
                  {t('Failed', 'Échoué')}
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
                  className="h-10 rounded-xl bg-navy text-white micro-label disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <span className="inline-flex items-center gap-1">
                    <RotateCcw size={12} />
                    {t('Retry', 'Relancer')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onEditDraft(item)}
                  className="h-10 rounded-xl border border-gray-100 bg-gray-50 micro-label text-gray-700"
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
                  className="h-10 rounded-xl border border-red-100 bg-red-50 micro-label text-red-600 disabled:bg-gray-100 disabled:text-gray-400"
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
            <h4 className="text-xs font-bold uppercase tracking-widest text-navy">
              {t('Waiting to Upload', 'En attente d\'envoi')}
            </h4>
            <span className="micro-label text-gray-400">{pendingItems.length}</span>
          </div>
          {pendingItems.length === 0 && (
            <div className="card p-4 text-xs text-gray-500">
              {t('All clear! No uploads waiting.', 'Tout est envoyé ! Rien en attente.')}
            </div>
          )}
          {pendingItems.map((item) => (
            <div key={item.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">{queueTitle(item, language)}</div>
                  <div className="micro-label text-navy">
                    {categoryLabel(item.payload.category, language)}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{formatWhen(item.createdAt, language)}</div>
                </div>
                <span className="rounded-full bg-navy-light px-2 py-1 micro-label text-navy">
                  {item.status === 'syncing' ? t('Uploading', 'Envoi') : t('Waiting', 'En attente')}
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
                <span className="micro-label">
                  {t('Could not be processed', 'Impossible à traiter')} ({syncErrors.length})
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearRejected}
                className="micro-label text-red-700"
              >
                {t('Clear', 'Effacer')}
              </button>
            </div>
            <div className="space-y-2">
              {syncErrors.map((record) => (
                <div key={record.id} className="rounded-xl border border-red-100 bg-white p-3">
                  <div className="micro-label text-red-700">
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
