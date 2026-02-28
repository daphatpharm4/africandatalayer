import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Camera, MapPin, ShieldCheck, Trash2, User, X } from 'lucide-react';
import { apiFetch, apiJson } from '../../lib/client/api';
import { clearSyncErrorRecords, listSyncErrorRecords, type SyncErrorRecord } from '../../lib/client/offlineQueue';
import type {
  AdminSubmissionEvent,
  ClientDeviceInfo,
  SubmissionDetails,
  SubmissionFraudCheck,
  SubmissionLocation,
  SubmissionPhotoMetadata,
} from '../../shared/types';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

type MatchState = 'match' | 'mismatch' | 'unavailable';

function exifStatusLabel(status: SubmissionPhotoMetadata['exifStatus'] | null | undefined, language: 'en' | 'fr'): string {
  if (status === 'ok') return language === 'fr' ? 'EXIF present' : 'EXIF present';
  if (status === 'fallback_recovered') return language === 'fr' ? 'Recupere via URL' : 'Recovered via URL';
  if (status === 'missing') return language === 'fr' ? 'EXIF absent' : 'EXIF missing';
  if (status === 'unsupported_format') return language === 'fr' ? 'Format non supporte' : 'Unsupported format';
  if (status === 'parse_error') return language === 'fr' ? 'Erreur de lecture EXIF' : 'EXIF parse error';
  return language === 'fr' ? 'Indisponible' : 'Unavailable';
}

function exifSourceLabel(source: SubmissionPhotoMetadata['exifSource'] | null | undefined, language: 'en' | 'fr'): string {
  if (source === 'upload_buffer') return language === 'fr' ? 'Upload initial' : 'Initial upload';
  if (source === 'remote_url') return language === 'fr' ? 'Photo distante' : 'Remote photo';
  if (source === 'none') return language === 'fr' ? 'Aucune source' : 'No source';
  return language === 'fr' ? 'Indisponible' : 'Unavailable';
}

function formatLocation(location: SubmissionLocation | null | undefined, unavailable: string): string {
  if (!location) return unavailable;
  return `${location.latitude.toFixed(5)}°, ${location.longitude.toFixed(5)}°`;
}

function formatDistance(distanceKm: number | null | undefined, unavailable: string): string {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return unavailable;
  return `${distanceKm.toFixed(3)} km`;
}

function formatDate(iso: string | null | undefined, unavailable: string): string {
  if (!iso) return unavailable;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return unavailable;
  return parsed.toLocaleString();
}

function categoryLabel(category: AdminSubmissionEvent['event']['category'], language: 'en' | 'fr'): string {
  if (category === 'pharmacy') return language === 'fr' ? 'Pharmacie' : 'Pharmacy';
  if (category === 'fuel_station') return language === 'fr' ? 'Station-service' : 'Fuel Station';
  return language === 'fr' ? 'Kiosque mobile money' : 'Mobile Money Kiosk';
}

function getSiteName(item: AdminSubmissionEvent, language: 'en' | 'fr'): string {
  const details = item.event.details as SubmissionDetails;
  if (typeof details.siteName === 'string' && details.siteName.trim()) return details.siteName.trim();
  if (typeof details.name === 'string' && details.name.trim()) return details.name.trim();
  return language === 'fr' ? 'Soumission sans nom' : 'Unnamed submission';
}

function getPrimaryImageUrl(item: AdminSubmissionEvent): string | null {
  if (typeof item.event.photoUrl === 'string' && item.event.photoUrl.trim()) return item.event.photoUrl;
  const details = item.event.details as SubmissionDetails;
  if (typeof details.secondPhotoUrl === 'string' && details.secondPhotoUrl.trim()) return details.secondPhotoUrl;
  return null;
}

function getSecondaryImageUrl(item: AdminSubmissionEvent): string | null {
  const details = item.event.details as SubmissionDetails;
  if (typeof details.secondPhotoUrl === 'string' && details.secondPhotoUrl.trim()) return details.secondPhotoUrl;
  return null;
}

function getClientDevice(item: AdminSubmissionEvent): ClientDeviceInfo | null {
  const details = item.event.details as SubmissionDetails;
  if (!details.clientDevice || typeof details.clientDevice !== 'object') return null;
  const raw = details.clientDevice as Record<string, unknown>;
  if (typeof raw.deviceId !== 'string' || !raw.deviceId.trim()) return null;
  return {
    deviceId: raw.deviceId.trim(),
    platform: typeof raw.platform === 'string' ? raw.platform.trim() : undefined,
    userAgent: typeof raw.userAgent === 'string' ? raw.userAgent.trim() : undefined,
    deviceMemoryGb: typeof raw.deviceMemoryGb === 'number' && Number.isFinite(raw.deviceMemoryGb) ? raw.deviceMemoryGb : null,
    hardwareConcurrency:
      typeof raw.hardwareConcurrency === 'number' && Number.isFinite(raw.hardwareConcurrency) ? raw.hardwareConcurrency : null,
    isLowEnd: raw.isLowEnd === true
  };
}

function isReadOnlySubmission(item: AdminSubmissionEvent): boolean {
  const source = typeof item.event.source === 'string' ? item.event.source.trim().toLowerCase() : '';
  if (source === 'legacy_submission' || source === 'osm_overpass') return true;
  if (item.event.id.startsWith('legacy-event-')) return true;
  return false;
}

function getMatchState(fraudCheck: SubmissionFraudCheck | null): MatchState {
  const match = fraudCheck?.primaryPhoto?.submissionGpsMatch;
  if (match === true) return 'match';
  if (match === false) return 'mismatch';
  return 'unavailable';
}

function matchStateLabel(state: MatchState, language: 'en' | 'fr'): string {
  if (state === 'match') return language === 'fr' ? 'OK' : 'Match';
  if (state === 'mismatch') return language === 'fr' ? 'Ecart' : 'Mismatch';
  return language === 'fr' ? 'Indisponible' : 'Unavailable';
}

function matchStateClass(state: MatchState): string {
  if (state === 'match') return 'text-[#4c7c59] bg-[#eaf3ee] border-[#d2e6d8]';
  if (state === 'mismatch') return 'text-[#c86b4a] bg-[#fdf0ea] border-[#f4d5c6]';
  return 'text-gray-500 bg-gray-100 border-gray-200';
}

const DetailMetadataBlock: React.FC<{
  label: string;
  metadata: SubmissionPhotoMetadata | null;
  thresholdKm: number;
  unavailable: string;
  language: 'en' | 'fr';
}> = ({ label, metadata, thresholdKm, unavailable, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const status = metadata?.submissionGpsMatch;
  const statusText =
    status === true ? t('Match', 'OK') : status === false ? t('Mismatch', 'Ecart') : t('Unavailable', 'Indisponible');
  const statusClass =
    status === true ? 'text-[#4c7c59]' : status === false ? 'text-[#c86b4a]' : 'text-gray-500';
  const exifStatusText = metadata ? exifStatusLabel(metadata.exifStatus, language) : unavailable;
  const exifReasonText = metadata?.exifReason ?? unavailable;
  const exifSourceText = metadata ? exifSourceLabel(metadata.exifSource, language) : unavailable;

  return (
    <div className="rounded-2xl border border-gray-100 bg-[#f9fafb] p-4 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">{label}</div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{t('EXIF Status', 'Statut EXIF')}</span>
        <span className="text-gray-800">{exifStatusText}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{t('EXIF Source', 'Source EXIF')}</span>
        <span className="text-gray-800">{exifSourceText}</span>
      </div>
      <div className="text-[11px]">
        <div className="text-gray-500">{t('EXIF Reason', 'Raison EXIF')}</div>
        <div className="text-gray-800 break-words">{exifReasonText}</div>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{t('Photo EXIF GPS', 'GPS EXIF photo')}</span>
        <span className="text-gray-800">{formatLocation(metadata?.gps, unavailable)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{t('Capture Time', 'Heure de capture')}</span>
        <span className="text-gray-800">{formatDate(metadata?.capturedAt, unavailable)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{t('Device', 'Appareil')}</span>
        <span className="text-gray-800">
          {metadata?.deviceMake || metadata?.deviceModel ? `${metadata?.deviceMake ?? ''} ${metadata?.deviceModel ?? ''}`.trim() : unavailable}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{t('Distance to Submission GPS', 'Distance au GPS soumis')}</span>
        <span className="text-gray-800">{formatDistance(metadata?.submissionDistanceKm, unavailable)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{t('Distance to IP GPS', 'Distance au GPS IP')}</span>
        <span className="text-gray-800">{formatDistance(metadata?.ipDistanceKm, unavailable)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{t('Submission GPS Match', 'Correspondance GPS soumission')}</span>
        <span className={statusClass}>{statusText}</span>
      </div>
      <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
        {t('Threshold', 'Seuil')}: {thresholdKm} km
      </div>
    </div>
  );
};

const AdminQueue: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [items, setItems] = useState<AdminSubmissionEvent[]>([]);
  const [selectedItem, setSelectedItem] = useState<AdminSubmissionEvent | null>(null);
  const [syncErrors, setSyncErrors] = useState<SyncErrorRecord[]>([]);
  const [isClearingSyncErrors, setIsClearingSyncErrors] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError('');
        setDeleteError('');
        setActionMessage('');
        const data = await apiJson<AdminSubmissionEvent[]>('/api/submissions?view=admin_events&scope=global');
        if (cancelled) return;
        const safeItems = Array.isArray(data) ? data : [];
        setItems(safeItems);
        setSelectedItem((prev) => {
          if (!prev) return safeItems[0] ?? null;
          return safeItems.find((item) => item.event.id === prev.event.id) ?? safeItems[0] ?? null;
        });
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : t('Unable to load submissions.', 'Impossible de charger les soumissions.');
        setError(message);
        setItems([]);
        setSelectedItem(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    const loadSyncErrors = async () => {
      try {
        const records = await listSyncErrorRecords();
        if (!cancelled) setSyncErrors(records);
      } catch {
        if (!cancelled) setSyncErrors([]);
      }
    };

    void loadSyncErrors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDeleteError('');
    setActionMessage('');
  }, [selectedItem?.event.id]);

  const selectedFraudCheck = selectedItem?.fraudCheck ?? null;
  const selectedPrimaryPhoto = selectedItem ? getPrimaryImageUrl(selectedItem) : null;
  const selectedSecondaryPhoto = selectedItem ? getSecondaryImageUrl(selectedItem) : null;
  const selectedClientDevice = selectedItem ? getClientDevice(selectedItem) : null;
  const isSelectedReadOnly = selectedItem ? isReadOnlySubmission(selectedItem) : false;
  const unavailableLabel = t('Unavailable', 'Indisponible');

  const listItems = useMemo(() => {
    return items.map((item) => {
      const state = getMatchState(item.fraudCheck);
      return {
        item,
        state,
        siteName: getSiteName(item, language),
        preview: getPrimaryImageUrl(item),
      };
    });
  }, [items, language]);

  const handleDeleteSelected = async () => {
    if (!selectedItem) return;
    if (isReadOnlySubmission(selectedItem)) {
      setDeleteError(t('This submission source is read-only and cannot be deleted.', 'Cette source de soumission est en lecture seule et ne peut pas etre supprimee.'));
      return;
    }

    const confirmed = window.confirm(
      t('Delete this submission event permanently?', 'Supprimer definitivement cet evenement de soumission ?')
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError('');
    setActionMessage('');
    try {
      const response = await apiFetch(`/api/submissions/${encodeURIComponent(selectedItem.event.id)}?view=event`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const message = (await response.text()) || t('Unable to delete submission.', 'Impossible de supprimer la soumission.');
        setDeleteError(message);
        return;
      }

      const deletedId = selectedItem.event.id;
      const nextItems = items.filter((item) => item.event.id !== deletedId);
      setItems(nextItems);
      setSelectedItem(nextItems[0] ?? null);
      setActionMessage(t('Submission deleted successfully.', 'Soumission supprimee avec succes.'));
    } catch (deleteActionError) {
      const message =
        deleteActionError instanceof Error
          ? deleteActionError.message
          : t('Unable to delete submission.', 'Impossible de supprimer la soumission.');
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearSyncErrors = async () => {
    if (isClearingSyncErrors) return;
    try {
      setIsClearingSyncErrors(true);
      await clearSyncErrorRecords();
      setSyncErrors([]);
    } finally {
      setIsClearingSyncErrors(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-[#1f2933] text-white px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 hover:text-[#c86b4a] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em]">{t('Submission Forensics', 'Analyse forensique')}</h3>
        <ShieldCheck size={18} className="text-[#c86b4a]" />
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white border border-gray-100 rounded-xl p-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center justify-between">
          <span>{t('Global Admin Scope', 'Portee admin globale')}</span>
          <span>{items.length} {t('items', 'elements')}</span>
        </div>

        {syncErrors.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertTriangle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {t('Local Sync Errors', 'Erreurs locales de synchronisation')} ({syncErrors.length})
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearSyncErrors}
                disabled={isClearingSyncErrors}
                className={`text-[10px] font-bold uppercase tracking-widest ${isClearingSyncErrors ? 'text-red-300' : 'text-red-700'}`}
              >
                {isClearingSyncErrors ? t('Clearing...', 'Suppression...') : t('Clear', 'Effacer')}
              </button>
            </div>
            <div className="text-xs text-red-700">
              {syncErrors[0]?.message ?? t('Unknown sync error.', 'Erreur de synchronisation inconnue.')}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 text-xs text-gray-500">
            {t('Loading submissions...', 'Chargement des soumissions...')}
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-xs text-red-600">
            {error}
          </div>
        )}

        {!isLoading && !error && actionMessage && (
          <div className="bg-[#eaf3ee] border border-[#d2e6d8] rounded-2xl p-4 text-xs text-[#2f855a]">
            {actionMessage}
          </div>
        )}

        {!isLoading && !error && deleteError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600">
            {deleteError}
          </div>
        )}

        {!isLoading && !error && selectedItem && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">{t('Submission Detail', 'Detail de la soumission')}</h4>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="h-8 w-8 rounded-full border border-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                {isSelectedReadOnly
                  ? t('Read-only source', 'Source en lecture seule')
                  : t('Admin action', 'Action admin')}
              </p>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={isDeleting || isSelectedReadOnly}
                className={`h-10 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2 ${
                  isDeleting || isSelectedReadOnly
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-50 border border-red-100 text-red-600 hover:bg-red-100'
                }`}
              >
                <Trash2 size={14} />
                <span>
                  {isDeleting
                    ? t('Deleting...', 'Suppression...')
                    : isSelectedReadOnly
                      ? t('Cannot delete', 'Suppression impossible')
                      : t('Delete submission', 'Supprimer soumission')}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-[11px]">
              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Submitter', 'Soumis par')}</div>
                <div className="text-gray-900 font-semibold">{selectedItem.user.name}</div>
                <div className="text-gray-600">{selectedItem.user.email ?? unavailableLabel}</div>
                <div className="text-gray-500">ID: {selectedItem.user.id}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Submission Metadata', 'Metadonnees soumission')}</div>
                <div>{t('Time', 'Heure')}: {formatDate(selectedItem.event.createdAt, unavailableLabel)}</div>
                <div>{t('Event Type', 'Type d\'evenement')}: {selectedItem.event.eventType}</div>
                <div>{t('Category', 'Categorie')}: {categoryLabel(selectedItem.event.category, language)}</div>
                <div>Point ID: {selectedItem.event.pointId}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Client Device', 'Appareil client')}</div>
                <div>{t('Device ID', 'Device ID')}: {selectedClientDevice?.deviceId ?? unavailableLabel}</div>
                <div>{t('Platform', 'Plateforme')}: {selectedClientDevice?.platform ?? unavailableLabel}</div>
                <div>
                  {t('Low-end flag', 'Indicateur entree de gamme')}:{' '}
                  {selectedClientDevice ? (selectedClientDevice.isLowEnd === true ? t('Yes', 'Oui') : t('No', 'Non')) : unavailableLabel}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Location', 'Localisation')}</div>
                <div>{t('Submission GPS', 'GPS soumis')}: {formatLocation(selectedFraudCheck?.submissionLocation, unavailableLabel)}</div>
                <div>{t('Effective GPS', 'GPS effectif')}: {formatLocation(selectedFraudCheck?.effectiveLocation, unavailableLabel)}</div>
                <div>{t('IP GPS', 'GPS IP')}: {formatLocation(selectedFraudCheck?.ipLocation, unavailableLabel)}</div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Photos', 'Photos')}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 h-28 flex items-center justify-center">
                    {selectedPrimaryPhoto ? (
                      <img src={selectedPrimaryPhoto} alt={t('Primary photo', 'Photo principale')} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center px-2">
                        {t('Primary photo unavailable', 'Photo principale indisponible')}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 h-28 flex items-center justify-center">
                    {selectedSecondaryPhoto ? (
                      <img src={selectedSecondaryPhoto} alt={t('Secondary photo', 'Photo secondaire')} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center px-2">
                        {t('Secondary photo unavailable', 'Photo secondaire indisponible')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Fraud Metadata', 'Metadonnees anti-fraude')}</div>
                <DetailMetadataBlock
                  label={t('Primary Photo Metadata', 'Metadonnees photo principale')}
                  metadata={selectedFraudCheck?.primaryPhoto ?? null}
                  thresholdKm={selectedFraudCheck?.submissionMatchThresholdKm ?? 1}
                  unavailable={unavailableLabel}
                  language={language}
                />
                <DetailMetadataBlock
                  label={t('Secondary Photo Metadata', 'Metadonnees photo secondaire')}
                  metadata={selectedFraudCheck?.secondaryPhoto ?? null}
                  thresholdKm={selectedFraudCheck?.submissionMatchThresholdKm ?? 1}
                  unavailable={unavailableLabel}
                  language={language}
                />
                <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                  {t('IP Match Threshold', 'Seuil correspondance IP')}: {selectedFraudCheck?.ipMatchThresholdKm ?? 50} km
                </div>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && listItems.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-xs text-gray-500 text-center">
            {t('No submissions found.', 'Aucune soumission trouvee.')}
          </div>
        )}

        {!isLoading && !error && listItems.length > 0 && (
          <div className="space-y-3">
            {listItems.map(({ item, state, siteName, preview }) => {
              const isSelected = selectedItem?.event.id === item.event.id;
              return (
                <button
                  key={item.event.id}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className={`w-full text-left bg-white border rounded-2xl overflow-hidden shadow-sm transition-colors ${
                    isSelected ? 'border-[#0f2b46]' : 'border-gray-100 hover:border-[#d5e1eb]'
                  }`}
                >
                  <div className="flex">
                    <div className="w-24 h-24 bg-gray-100 shrink-0 flex items-center justify-center">
                      {preview ? (
                        <img src={preview} alt={t('submission', 'soumission')} className="h-full w-full object-cover" />
                      ) : (
                        <Camera size={18} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 leading-tight">{siteName}</h4>
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">{categoryLabel(item.event.category, language)}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border ${matchStateClass(state)}`}>
                          {matchStateLabel(state, language)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-600 flex items-center gap-1">
                        <User size={12} />
                        <span>{item.user.name}</span>
                        <span className="text-gray-400">•</span>
                        <span className="truncate">{item.user.email ?? item.user.id}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <MapPin size={12} />
                        <span>{formatDate(item.event.createdAt, unavailableLabel)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminQueue;
