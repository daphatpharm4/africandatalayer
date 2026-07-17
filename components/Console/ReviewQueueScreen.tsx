import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, MapPin, RotateCw, X } from 'lucide-react';
import { listApprovedPlatformRecordsRequest, listPlatformRecordsRequest, PlatformApiError, reviewPlatformRecordRequest } from '../../lib/client/platformApi';
import type { PlatformRecord } from '../../shared/platformTypes';

interface ReviewQueueScreenProps {
  organizationId: string;
  language: 'en' | 'fr';
  readOnly?: boolean;
}

type Filter = 'pending_review' | 'approved' | 'rejected' | 'all';

const ReviewQueueScreen: React.FC<ReviewQueueScreenProps> = ({ organizationId, language, readOnly = false }) => {
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);
  const [records, setRecords] = useState<PlatformRecord[] | null>(null);
  const [filter, setFilter] = useState<Filter>(readOnly ? 'approved' : 'pending_review');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    setError(null);
    void (readOnly ? listApprovedPlatformRecordsRequest(organizationId) : listPlatformRecordsRequest(organizationId))
      .then((next) => { if (!cancelled) setRecords(next); })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof PlatformApiError && reason.status < 500
          ? reason.message
          : t('Could not load the review queue.', 'Impossible de charger la file de révision.'));
      });
    return () => { cancelled = true; };
  }, [organizationId, readOnly, reloadKey, t]);

  const visible = useMemo(
    () => (records ?? []).filter((record) => filter === 'all' || record.status === filter),
    [filter, records],
  );

  const decide = async (recordId: string, status: 'approved' | 'rejected') => {
    setBusyId(recordId);
    setError(null);
    try {
      const updated = await reviewPlatformRecordRequest({ organizationId, recordId, status });
      setRecords((current) => current?.map((record) => record.id === recordId ? updated : record) ?? null);
    } catch (reason) {
      setError(reason instanceof PlatformApiError && reason.status < 500
        ? reason.message
        : t('Could not save the review decision.', 'Impossible d’enregistrer la décision.'));
    } finally {
      setBusyId(null);
    }
  };

  const filters: Array<{ value: Filter; en: string; fr: string }> = [
    { value: 'pending_review', en: 'Pending', fr: 'En attente' },
    { value: 'approved', en: 'Approved', fr: 'Approuvées' },
    { value: 'rejected', en: 'Rejected', fr: 'Rejetées' },
    { value: 'all', en: 'All', fr: 'Toutes' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-xl font-semibold text-ink">{readOnly ? t('Approved company data', 'Données entreprise approuvées') : t('Review queue', 'File de révision')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{readOnly ? t('Read verified records and their field evidence.', 'Consultez les données vérifiées et leurs justificatifs terrain.') : t('Verify company records and their field evidence.', 'Vérifiez les données de l’entreprise et leurs justificatifs terrain.')}</p>
        </div>
        <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-ghost flex min-h-12 items-center justify-center gap-2 px-4">
          <RotateCw size={16} /> {t('Refresh', 'Actualiser')}
        </button>
      </div>
      {!readOnly && <div className="flex gap-2 overflow-x-auto pb-1" aria-label={t('Review filters', 'Filtres de révision')}>
        {filters.map((item) => (
          <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`min-h-12 shrink-0 rounded-xl px-4 text-sm font-medium ${filter === item.value ? 'bg-navy text-white' : 'border border-navy-border bg-white text-ink-muted'}`}>
            {t(item.en, item.fr)}
          </button>
        ))}
      </div>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {records === null && !error && <p role="status" className="micro-label text-ink-muted">{t('Loading records…', 'Chargement des données…')}</p>}
      {records !== null && visible.length === 0 && (
        <div className="card p-8 text-center"><p className="text-sm text-ink-muted">{t('No records in this queue.', 'Aucune donnée dans cette file.')}</p></div>
      )}
      <div className="flex flex-col gap-3">
        {visible.map((record) => (
          <article key={record.id} className="card p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink">{record.recordTypeKey.replaceAll('_', ' ')}</h2>
                  <span className={`micro-label rounded-full px-2.5 py-1 text-[10px] ${record.status === 'approved' ? 'bg-forest-wash text-forest-dark' : record.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-gold/20 text-ink'}`}>{record.status.replace('_', ' ')}</span>
                </div>
                <p className="mt-1 break-all text-xs text-ink-muted">{record.capturedBy} · {new Date(record.createdAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')}</p>
              </div>
              {!readOnly && record.status === 'pending_review' && (
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button type="button" disabled={busyId === record.id} onClick={() => void decide(record.id, 'rejected')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50"><X size={16} />{t('Reject', 'Rejeter')}</button>
                  <button type="button" disabled={busyId === record.id} onClick={() => void decide(record.id, 'approved')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white disabled:opacity-50"><Check size={16} />{t('Approve', 'Approuver')}</button>
                </div>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-2 rounded-2xl bg-page p-4 text-sm sm:grid-cols-2">
              {Object.entries(record.data).map(([key, value]) => (
                <div key={key} className="min-w-0"><dt className="micro-label text-ink-muted">{key.replaceAll('_', ' ')}</dt><dd className="mt-1 break-words text-ink">{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</dd></div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-muted">
              {record.evidence.gps && <span className="flex items-center gap-1"><MapPin size={14} />{record.evidence.gps.latitude.toFixed(5)}, {record.evidence.gps.longitude.toFixed(5)}</span>}
              <span>{record.evidence.photos.length} {t('photo(s)', 'photo(s)')}</span>
              {record.evidence.notes && <span>{record.evidence.notes}</span>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default ReviewQueueScreen;
