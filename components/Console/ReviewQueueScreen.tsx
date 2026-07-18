import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  FileText,
  MapPin,
  RotateCw,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import {
  listApprovedPlatformRecordsRequest,
  listPlatformRecordsRequest,
  PlatformApiError,
  reviewPlatformRecordRequest,
} from '../../lib/client/platformApi';
import type { PlatformRecord } from '../../shared/platformTypes';

interface ReviewQueueScreenProps {
  organizationId: string;
  language: 'en' | 'fr';
  readOnly?: boolean;
}

type Filter = 'pending_review' | 'approved' | 'rejected' | 'all';

function formatFieldValue(value: unknown, language: 'en' | 'fr'): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return language === 'fr' ? (value ? 'Oui' : 'Non') : (value ? 'Yes' : 'No');
  if (Array.isArray(value)) return value.map((item) => formatFieldValue(item, language)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function formatBytes(value: number | undefined, language: 'en' | 'fr'): string {
  if (!Number.isFinite(value)) return language === 'fr' ? 'Inconnu' : 'Unknown';
  const bytes = value ?? 0;
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const ReviewQueueScreen: React.FC<ReviewQueueScreenProps> = ({ organizationId, language, readOnly = false }) => {
  const t = useCallback((en: string, fr: string) => (language === 'fr' ? fr : en), [language]);
  const [records, setRecords] = useState<PlatformRecord[] | null>(null);
  const [filter, setFilter] = useState<Filter>(readOnly ? 'approved' : 'pending_review');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [photoPreview, setPhotoPreview] = useState<{ src: string; alt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    setError(null);
    setExpandedId(null);
    void (readOnly ? listApprovedPlatformRecordsRequest(organizationId) : listPlatformRecordsRequest(organizationId))
      .then((next) => { if (!cancelled) setRecords(next); })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof PlatformApiError && reason.status < 500
          ? reason.message
          : t('Could not load company records. Check your connection and try again.', 'Impossible de charger les données entreprise. Vérifiez votre connexion et réessayez.'));
      });
    return () => { cancelled = true; };
  }, [organizationId, readOnly, reloadKey, t]);

  useEffect(() => {
    if (!photoPreview) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPhotoPreview(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [photoPreview]);

  const visible = useMemo(
    () => (records ?? []).filter((record) => filter === 'all' || record.status === filter),
    [filter, records],
  );

  // Read-only (browse/approved) mode groups records that share a pointId under one
  // header pill; records with no pointId stay in the existing flat list, unchanged.
  const pointGroups = useMemo(() => {
    if (!readOnly) return null;
    const groups = new Map<string, PlatformRecord[]>();
    const ungrouped: PlatformRecord[] = [];
    for (const record of visible) {
      if (record.pointId) {
        const list = groups.get(record.pointId) ?? [];
        list.push(record);
        groups.set(record.pointId, list);
      } else {
        ungrouped.push(record);
      }
    }
    return { groups, ungrouped };
  }, [readOnly, visible]);

  const decide = async (recordId: string, status: 'approved' | 'rejected') => {
    const note = reviewNotes[recordId]?.trim() ?? '';
    if (status === 'rejected' && !note) {
      setError(t('Add a rejection reason before rejecting this record.', 'Ajoutez un motif avant de rejeter cette donnée.'));
      return;
    }
    setBusyId(recordId);
    setError(null);
    try {
      const updated = await reviewPlatformRecordRequest({ organizationId, recordId, status, reviewNotes: note || undefined });
      setRecords((current) => current?.map((record) => record.id === recordId ? updated : record) ?? null);
      setExpandedId(null);
    } catch (reason) {
      setError(reason instanceof PlatformApiError && reason.status < 500
        ? reason.message
        : t('The review decision was not saved. Check your connection and try again.', 'La décision n’a pas été enregistrée. Vérifiez votre connexion et réessayez.'));
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
    <div className="flex min-h-0 flex-col gap-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            {readOnly ? t('Approved company data', 'Données entreprise approuvées') : t('Evidence review', 'Révision des justificatifs')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
            {readOnly
              ? t('Open any record to inspect its form values, photos, GPS and capture metadata.', 'Ouvrez une donnée pour consulter le formulaire, les photos, le GPS et les métadonnées de capture.')
              : t('Inspect the complete field evidence before approving or rejecting a company record.', 'Inspectez tous les justificatifs terrain avant d’approuver ou de rejeter une donnée entreprise.')}
          </p>
        </div>
        <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-ghost flex min-h-12 items-center justify-center gap-2 px-4">
          <RotateCw size={16} /> {t('Refresh records', 'Actualiser les données')}
        </button>
      </div>

      {!readOnly && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label={t('Review filters', 'Filtres de révision')}>
          {filters.map((item) => (
            <button key={item.value} type="button" onClick={() => setFilter(item.value)} aria-pressed={filter === item.value}
              className={`min-h-12 shrink-0 rounded-xl px-4 text-sm font-medium ${filter === item.value ? 'bg-navy text-white' : 'border border-navy-border bg-white text-ink-muted'}`}>
              {t(item.en, item.fr)}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
      {records === null && !error && <p role="status" className="micro-label text-ink-muted">{t('Loading company records…', 'Chargement des données entreprise…')}</p>}
      {records !== null && visible.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-ink">{t('No records in this queue', 'Aucune donnée dans cette file')}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('New field captures will appear here after they sync.', 'Les nouvelles captures terrain apparaîtront ici après synchronisation.')}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(() => {
          const renderRecordCard = (record: PlatformRecord) => {
          const expanded = expandedId === record.id;
          const capturedAt = record.evidence.capturedAt ?? record.createdAt;
          return (
            <article key={record.id} className="card overflow-hidden">
              <button type="button" onClick={() => setExpandedId(expanded ? null : record.id)} aria-expanded={expanded}
                className="flex min-h-16 w-full items-start justify-between gap-4 p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold capitalize text-ink">{record.recordTypeKey.replaceAll('_', ' ')}</h2>
                    <span className={`micro-label rounded-full px-2.5 py-1 text-[10px] ${record.status === 'approved' ? 'bg-forest-wash text-forest-dark' : record.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-gold/20 text-ink'}`}>
                      {record.status === 'pending_review' ? t('Pending review', 'En attente') : record.status === 'approved' ? t('Approved', 'Approuvée') : t('Rejected', 'Rejetée')}
                    </span>
                    {record.pointId && (
                      <span className="micro-label inline-flex max-w-[9rem] items-center gap-1 rounded-full bg-navy-wash px-2.5 py-1 text-[10px] text-navy">
                        <MapPin size={11} className="shrink-0" />
                        <span className="truncate">{t('Linked point', 'Point associé')} {record.pointId}</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-all text-xs leading-5 text-ink-muted">{record.capturedBy} · {new Date(record.createdAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1"><Camera size={14} />{record.evidence.photos.length} {t('photos', 'photos')}</span>
                    <span className="inline-flex items-center gap-1"><FileText size={14} />{Object.keys(record.data).length} {t('fields', 'champs')}</span>
                    <span className="inline-flex items-center gap-1"><Eye size={14} />{expanded ? t('Close evidence', 'Fermer') : t('Inspect evidence', 'Inspecter')}</span>
                  </div>
                </div>
                <ChevronDown size={20} className={`mt-1 shrink-0 text-navy transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {expanded && (
                <div className="border-t border-navy-border px-5 pb-5 pt-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
                    <section aria-labelledby={`fields-${record.id}`}>
                      <h3 id={`fields-${record.id}`} className="flex items-center gap-2 text-sm font-semibold text-ink"><FileText size={16} />{t('Submitted form', 'Formulaire soumis')}</h3>
                      <dl className="mt-3 grid grid-cols-1 gap-3 rounded-2xl bg-page p-4 sm:grid-cols-2">
                        {Object.entries(record.data).map(([key, value]) => (
                          <div key={key} className="min-w-0">
                            <dt className="micro-label text-ink-muted">{key.replaceAll('_', ' ')}</dt>
                            <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{formatFieldValue(value, language)}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>

                    <section aria-labelledby={`metadata-${record.id}`}>
                      <h3 id={`metadata-${record.id}`} className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck size={16} />{t('Capture metadata', 'Métadonnées de capture')}</h3>
                      <dl className="mt-3 space-y-3 rounded-2xl border border-navy-border bg-white p-4 text-sm">
                        <div><dt className="micro-label text-ink-muted">{t('Record ID', 'ID de donnée')}</dt><dd className="mt-1 break-all font-medium text-ink">{record.id}</dd></div>
                        <div><dt className="micro-label text-ink-muted">{t('Captured at', 'Capturé le')}</dt><dd className="mt-1 inline-flex items-center gap-1 text-ink"><Clock3 size={14} />{new Date(capturedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')}</dd></div>
                        <div><dt className="micro-label text-ink-muted">GPS</dt><dd className="mt-1 text-ink">{record.evidence.gps ? `${record.evidence.gps.latitude.toFixed(6)}, ${record.evidence.gps.longitude.toFixed(6)}${record.evidence.gps.accuracyMeters !== undefined ? ` · ±${Math.round(record.evidence.gps.accuracyMeters)} m` : ''}` : t('Not captured', 'Non capturé')}</dd></div>
                        <div><dt className="micro-label text-ink-muted">{t('Device', 'Appareil')}</dt><dd className="mt-1 inline-flex items-start gap-1 break-words text-ink"><Smartphone size={14} className="mt-0.5 shrink-0" />{[record.evidence.device?.platform, record.evidence.device?.language, record.evidence.device?.userAgent].filter(Boolean).join(' · ') || t('Not reported', 'Non renseigné')}</dd></div>
                      </dl>
                    </section>
                  </div>

                  <section className="mt-5" aria-labelledby={`photos-${record.id}`}>
                    <h3 id={`photos-${record.id}`} className="flex items-center gap-2 text-sm font-semibold text-ink"><Camera size={16} />{t('Field photos', 'Photos terrain')} ({record.evidence.photos.length})</h3>
                    {record.evidence.photos.length === 0 ? (
                      <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t('No photo evidence was submitted.', 'Aucun justificatif photo n’a été soumis.')}</p>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {record.evidence.photos.map((photo, index) => {
                          const metadata = record.evidence.photoMetadata?.[index];
                          const alt = t(`Field evidence photo ${index + 1}`, `Photo terrain ${index + 1}`);
                          return (
                            <figure key={`${record.id}-photo-${index}`} className="overflow-hidden rounded-2xl border border-navy-border bg-page">
                              <button type="button" onClick={() => setPhotoPreview({ src: photo, alt })} className="block aspect-square w-full overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">
                                <img src={photo} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform hover:scale-[1.02]" />
                              </button>
                              <figcaption className="p-2 text-[11px] leading-5 text-ink-muted">
                                {metadata
                                  ? `${metadata.width ?? '?'}×${metadata.height ?? '?'} · ${formatBytes(metadata.originalBytes, language)} → ${formatBytes(metadata.storedBytes, language)}`
                                  : t('Legacy photo · metadata unavailable', 'Photo historique · métadonnées indisponibles')}
                              </figcaption>
                            </figure>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {record.evidence.notes && (
                    <section className="mt-5 rounded-2xl bg-navy-wash p-4">
                      <h3 className="text-sm font-semibold text-navy">{t('Collector notes', 'Notes du collecteur')}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{record.evidence.notes}</p>
                    </section>
                  )}

                  {record.reviewedAt && (
                    <section className="mt-5 rounded-2xl border border-navy-border p-4 text-sm">
                      <h3 className="font-semibold text-ink">{t('Review history', 'Historique de révision')}</h3>
                      <p className="mt-1 text-ink-muted">{record.reviewedBy ?? t('Unknown reviewer', 'Réviseur inconnu')} · {new Date(record.reviewedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')}</p>
                      {record.reviewNotes && <p className="mt-2 whitespace-pre-wrap leading-6 text-ink">{record.reviewNotes}</p>}
                    </section>
                  )}

                  {!readOnly && record.status === 'pending_review' && (
                    <section className="mt-5 rounded-2xl border border-navy-border bg-page p-4" aria-labelledby={`decision-${record.id}`}>
                      <h3 id={`decision-${record.id}`} className="text-sm font-semibold text-ink">{t('Review decision', 'Décision de révision')}</h3>
                      <label className="mt-3 block">
                        <span className="micro-label text-ink-muted">{t('Decision notes', 'Notes de décision')}</span>
                        <textarea value={reviewNotes[record.id] ?? ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [record.id]: event.target.value }))}
                          rows={3} maxLength={2_000} placeholder={t('Required when rejecting; optional when approving.', 'Obligatoire pour un rejet ; facultatif pour une approbation.')}
                          className="mt-2 min-h-24 w-full resize-y rounded-xl border border-navy-border bg-white p-3 text-base text-ink outline-none focus:border-navy" />
                      </label>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button type="button" disabled={busyId === record.id} onClick={() => void decide(record.id, 'rejected')}
                          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 disabled:opacity-50"><X size={16} />{busyId === record.id ? t('Saving…', 'Enregistrement…') : t('Reject record', 'Rejeter la donnée')}</button>
                        <button type="button" disabled={busyId === record.id} onClick={() => void decide(record.id, 'approved')}
                          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white disabled:opacity-50"><Check size={16} />{busyId === record.id ? t('Saving…', 'Enregistrement…') : t('Approve record', 'Approuver la donnée')}</button>
                      </div>
                    </section>
                  )}
                </div>
              )}
            </article>
          );
          };

          if (readOnly && pointGroups) {
            return (
              <>
                {Array.from(pointGroups.groups.entries()).map(([pointId, groupRecords]) => (
                  <div key={pointId} className="flex flex-col gap-3">
                    <div className="flex min-h-11 items-center gap-2 rounded-xl bg-navy-wash px-4 py-2.5">
                      <MapPin size={14} className="shrink-0 text-navy" />
                      <span className="micro-label max-w-[60%] truncate text-navy">{t('Linked point', 'Point associé')} {pointId}</span>
                      <span className="ml-auto shrink-0 text-xs font-semibold text-navy">{groupRecords.length} {t('records', 'données')}</span>
                    </div>
                    {groupRecords.map(renderRecordCard)}
                  </div>
                ))}
                {pointGroups.ungrouped.map(renderRecordCard)}
              </>
            );
          }

          return visible.map(renderRecordCard);
        })()}
      </div>

      {photoPreview && (
        <div role="dialog" aria-modal="true" aria-label={photoPreview.alt} className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/90 p-4" onClick={() => setPhotoPreview(null)}>
          <button type="button" onClick={() => setPhotoPreview(null)} aria-label={t('Close photo', 'Fermer la photo')} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-12 w-12 items-center justify-center rounded-full bg-white text-navy"><X size={22} /></button>
          <img src={photoPreview.src} alt={photoPreview.alt} className="max-h-full max-w-full rounded-2xl object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default ReviewQueueScreen;
