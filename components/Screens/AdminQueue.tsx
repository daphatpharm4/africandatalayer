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

interface GroupedPoint {
  pointId: string;
  events: AdminSubmissionEvent[];
  category: AdminSubmissionEvent['event']['category'];
  siteName: string;
  latestEvent: AdminSubmissionEvent;
  createdEvent: AdminSubmissionEvent | null;
  enrichEvents: AdminSubmissionEvent[];
  allPhotos: { url: string; eventType: string; createdAt: string; metadata: SubmissionPhotoMetadata | null }[];
}

function groupEventsByPoint(items: AdminSubmissionEvent[], language: 'en' | 'fr'): GroupedPoint[] {
  const groups = new Map<string, AdminSubmissionEvent[]>();
  for (const item of items) {
    const pid = item.event.pointId;
    const existing = groups.get(pid);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(pid, [item]);
    }
  }
  const result: GroupedPoint[] = [];
  for (const [pointId, events] of groups) {
    const sorted = [...events].sort((a, b) => new Date(a.event.createdAt).getTime() - new Date(b.event.createdAt).getTime());
    const latestEvent = sorted[sorted.length - 1]!;
    const createdEvent = sorted.find((e) => e.event.eventType === 'CREATE_EVENT') ?? null;
    const enrichEvents = sorted.filter((e) => e.event.eventType === 'ENRICH_EVENT');
    const allPhotos: GroupedPoint['allPhotos'] = [];
    for (const ev of sorted) {
      const photoUrl = ev.event.photoUrl;
      if (photoUrl && typeof photoUrl === 'string' && photoUrl.trim()) {
        allPhotos.push({
          url: photoUrl,
          eventType: ev.event.eventType,
          createdAt: ev.event.createdAt,
          metadata: ev.fraudCheck?.primaryPhoto ?? null,
        });
      }
      const details = ev.event.details as SubmissionDetails;
      const secondUrl = typeof details.secondPhotoUrl === 'string' && details.secondPhotoUrl.trim() ? details.secondPhotoUrl : null;
      if (secondUrl) {
        allPhotos.push({
          url: secondUrl,
          eventType: ev.event.eventType + ' (secondary)',
          createdAt: ev.event.createdAt,
          metadata: ev.fraudCheck?.secondaryPhoto ?? null,
        });
      }
    }
    result.push({
      pointId,
      events: sorted,
      category: latestEvent.event.category,
      siteName: getSiteName(createdEvent ?? latestEvent, language),
      latestEvent,
      createdEvent,
      enrichEvents,
      allPhotos,
    });
  }
  return result.sort((a, b) => new Date(b.latestEvent.event.createdAt).getTime() - new Date(a.latestEvent.event.createdAt).getTime());
}

const AdminQueue: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [items, setItems] = useState<AdminSubmissionEvent[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
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
        setSelectedPointId((prev) => {
          if (!prev) return safeItems[0]?.event.pointId ?? null;
          if (safeItems.some((item) => item.event.pointId === prev)) return prev;
          return safeItems[0]?.event.pointId ?? null;
        });
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : t('Unable to load submissions.', 'Impossible de charger les soumissions.');
        setError(message);
        setItems([]);
        setSelectedPointId(null);
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
  }, [selectedPointId]);

  const groupedPoints = useMemo(() => groupEventsByPoint(items, language), [items, language]);
  const selectedGroup = useMemo(() => groupedPoints.find((g) => g.pointId === selectedPointId) ?? null, [groupedPoints, selectedPointId]);
  const unavailableLabel = t('Unavailable', 'Indisponible');

  const handleDeleteSelected = async () => {
    if (!selectedGroup) return;
    const hasReadOnly = selectedGroup.events.some(isReadOnlySubmission);
    if (hasReadOnly) {
      setDeleteError(t('This point contains read-only events that cannot be deleted.', 'Ce point contient des evenements en lecture seule qui ne peuvent pas etre supprimes.'));
      return;
    }

    const evtCount = selectedGroup.events.length;
    const confirmed = window.confirm(
      evtCount > 1
        ? t(`Delete all ${evtCount} events for this point permanently?`, `Supprimer definitivement les ${evtCount} evenements de ce point ?`)
        : t('Delete this submission event permanently?', 'Supprimer definitivement cet evenement de soumission ?')
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError('');
    setActionMessage('');
    try {
      for (const ev of selectedGroup.events) {
        const response = await apiFetch(`/api/submissions/${encodeURIComponent(ev.event.id)}?view=event`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const message = (await response.text()) || t('Unable to delete submission.', 'Impossible de supprimer la soumission.');
          setDeleteError(message);
          return;
        }
      }

      const deletedIds = new Set(selectedGroup.events.map((e) => e.event.id));
      const nextItems = items.filter((item) => !deletedIds.has(item.event.id));
      setItems(nextItems);
      setSelectedPointId(nextItems[0]?.event.pointId ?? null);
      setActionMessage(t('Point deleted successfully.', 'Point supprime avec succes.'));
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

        {!isLoading && !error && selectedGroup && (() => {
          const hasReadOnly = selectedGroup.events.some(isReadOnlySubmission);
          const latestFraudCheck = selectedGroup.latestEvent.fraudCheck ?? null;
          const latestDevice = getClientDevice(selectedGroup.latestEvent);
          const contributors = [...new Map(selectedGroup.events.map((e) => [e.user.id, e.user])).values()];
          return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">{t('Point Detail', 'Detail du point')}</h4>
              <button
                type="button"
                onClick={() => setSelectedPointId(null)}
                className="h-8 w-8 rounded-full border border-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                {selectedGroup.events.length} {t('event(s)', 'evenement(s)')}
              </p>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={isDeleting || hasReadOnly}
                className={`h-10 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2 ${
                  isDeleting || hasReadOnly
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-50 border border-red-100 text-red-600 hover:bg-red-100'
                }`}
              >
                <Trash2 size={14} />
                <span>
                  {isDeleting
                    ? t('Deleting...', 'Suppression...')
                    : hasReadOnly
                      ? t('Cannot delete', 'Suppression impossible')
                      : t('Delete point', 'Supprimer point')}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-[11px]">
              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Contributors', 'Contributeurs')}</div>
                {contributors.map((user) => (
                  <div key={user.id} className="space-y-0.5">
                    <div className="text-gray-900 font-semibold">{user.name}</div>
                    <div className="text-gray-600">{user.email ?? unavailableLabel}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Point Metadata', 'Metadonnees du point')}</div>
                <div>{t('Category', 'Categorie')}: {categoryLabel(selectedGroup.category, language)}</div>
                <div>Point ID: {selectedGroup.pointId}</div>
                <div>{t('Events', 'Evenements')}: {selectedGroup.events.length}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Event Timeline', 'Historique des evenements')}</div>
                {selectedGroup.events.map((ev, idx) => {
                  const device = getClientDevice(ev);
                  return (
                    <div key={ev.event.id} className={`p-2 rounded-xl ${idx === 0 ? 'bg-[#eaf3ee] border border-[#d2e6d8]' : 'bg-gray-50 border border-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
                          {ev.event.eventType === 'CREATE_EVENT' ? t('Create', 'Creation') : t('Enrich', 'Enrichissement')}
                        </span>
                        <span className="text-[10px] text-gray-500">{formatDate(ev.event.createdAt, unavailableLabel)}</span>
                      </div>
                      <div className="text-gray-600 mt-1">{t('By', 'Par')}: {ev.user.name}</div>
                      {device && <div className="text-gray-500">{t('Device', 'Appareil')}: {device.platform ?? 'Unknown'}</div>}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Location', 'Localisation')}</div>
                <div>{t('Submission GPS', 'GPS soumis')}: {formatLocation(latestFraudCheck?.submissionLocation, unavailableLabel)}</div>
                <div>{t('Effective GPS', 'GPS effectif')}: {formatLocation(latestFraudCheck?.effectiveLocation, unavailableLabel)}</div>
                <div>{t('IP GPS', 'GPS IP')}: {formatLocation(latestFraudCheck?.ipLocation, unavailableLabel)}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t('Client Device', 'Appareil client')}</div>
                <div>{t('Device ID', 'Device ID')}: {latestDevice?.deviceId ?? unavailableLabel}</div>
                <div>{t('Platform', 'Plateforme')}: {latestDevice?.platform ?? unavailableLabel}</div>
                <div>
                  {t('Low-end flag', 'Indicateur entree de gamme')}:{' '}
                  {latestDevice ? (latestDevice.isLowEnd === true ? t('Yes', 'Oui') : t('No', 'Non')) : unavailableLabel}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {t('All Photos', 'Toutes les photos')} ({selectedGroup.allPhotos.length})
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {selectedGroup.allPhotos.length === 0 && (
                    <div className="col-span-2 rounded-2xl border border-gray-100 bg-gray-50 h-28 flex items-center justify-center">
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center px-2">
                        {t('No photos available', 'Aucune photo disponible')}
                      </div>
                    </div>
                  )}
                  {selectedGroup.allPhotos.map((photo, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 h-28 flex items-center justify-center">
                        <img src={photo.url} alt={`${t('Photo', 'Photo')} ${idx + 1}`} className="h-full w-full object-cover" />
                      </div>
                      <div className="text-[10px] text-gray-500 text-center">
                        {photo.eventType === 'CREATE_EVENT' ? t('Create', 'Creation') : photo.eventType === 'ENRICH_EVENT' ? t('Enrich', 'Enrichissement') : photo.eventType}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {t('Photo EXIF Metadata', 'Metadonnees EXIF des photos')}
                </div>
                {selectedGroup.allPhotos.length === 0 && (
                  <div className="text-[11px] text-gray-500">{unavailableLabel}</div>
                )}
                {selectedGroup.allPhotos.map((photo, idx) => (
                  <DetailMetadataBlock
                    key={idx}
                    label={`${t('Photo', 'Photo')} ${idx + 1} — ${photo.eventType === 'CREATE_EVENT' ? t('Create', 'Creation') : photo.eventType === 'ENRICH_EVENT' ? t('Enrich', 'Enrichissement') : photo.eventType}`}
                    metadata={photo.metadata}
                    thresholdKm={latestFraudCheck?.submissionMatchThresholdKm ?? 1}
                    unavailable={unavailableLabel}
                    language={language}
                  />
                ))}
                <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                  {t('IP Match Threshold', 'Seuil correspondance IP')}: {latestFraudCheck?.ipMatchThresholdKm ?? 50} km
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {!isLoading && !error && groupedPoints.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-xs text-gray-500 text-center">
            {t('No submissions found.', 'Aucune soumission trouvee.')}
          </div>
        )}

        {!isLoading && !error && groupedPoints.length > 0 && (
          <div className="space-y-3">
            {groupedPoints.map((group) => {
              const isSelected = selectedPointId === group.pointId;
              const state = getMatchState(group.latestEvent.fraudCheck);
              const preview = group.allPhotos[0]?.url ?? null;
              const contributors = [...new Set(group.events.map((e) => e.user.name))];
              return (
                <button
                  key={group.pointId}
                  type="button"
                  onClick={() => setSelectedPointId(group.pointId)}
                  className={`w-full text-left bg-white border rounded-2xl overflow-hidden shadow-sm transition-colors ${
                    isSelected ? 'border-[#0f2b46]' : 'border-gray-100 hover:border-[#d5e1eb]'
                  }`}
                >
                  <div className="flex">
                    <div className="w-24 h-24 bg-gray-100 shrink-0 flex items-center justify-center relative">
                      {preview ? (
                        <img src={preview} alt={t('submission', 'soumission')} className="h-full w-full object-cover" />
                      ) : (
                        <Camera size={18} className="text-gray-300" />
                      )}
                      {group.allPhotos.length > 1 && (
                        <div className="absolute top-1 right-1 bg-[#0f2b46] text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {group.allPhotos.length}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 leading-tight">{group.siteName}</h4>
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">
                            {categoryLabel(group.category, language)}
                            {group.events.length > 1 && ` · ${group.events.length} ${t('events', 'evenements')}`}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border ${matchStateClass(state)}`}>
                          {matchStateLabel(state, language)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-600 flex items-center gap-1">
                        <User size={12} />
                        <span className="truncate">{contributors.join(', ')}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <MapPin size={12} />
                        <span>{formatDate(group.latestEvent.event.createdAt, unavailableLabel)}</span>
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
