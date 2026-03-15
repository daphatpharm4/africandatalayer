import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Camera, MapPin, ShieldCheck, Trash2, X } from 'lucide-react';
import ProfileAvatar from '../shared/ProfileAvatar';
import { coerceAvatarPreset } from '../../shared/avatarPresets';
import { apiFetch, apiJson } from '../../lib/client/api';
import { clearSyncErrorRecords, listSyncErrorRecords, type SyncErrorRecord } from '../../lib/client/offlineQueue';
import type {
  AdminSubmissionEvent,
  AutomationLeadPriority,
  AutomationLeadStatus,
  AssignmentPlannerContext,
  ClientDeviceInfo,
  CollectionAssignment,
  LeadCandidate,
  SubmissionDetails,
  SubmissionFraudCheck,
  SubmissionLocation,
  SubmissionPhotoMetadata,
  SubmissionCategory,
} from '../../shared/types';
import { categoryLabel as getCategoryLabel, VERTICAL_IDS } from '../../shared/verticals';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

type MatchState = 'match' | 'mismatch' | 'unavailable';
type RiskFilter = 'all' | 'flagged' | 'pending' | 'low_risk';
type ReviewDecision = 'approved' | 'rejected' | 'flagged';
type AutomationStatusFilter = '' | AutomationLeadStatus;
type AutomationPriorityFilter = '' | AutomationLeadPriority;

function exifStatusLabel(status: SubmissionPhotoMetadata['exifStatus'] | null | undefined, language: 'en' | 'fr'): string {
  if (status === 'ok') return language === 'fr' ? 'EXIF present' : 'EXIF present';
  if (status === 'fallback_recovered') return language === 'fr' ? 'Récupéré via fallback' : 'Recovered via fallback';
  if (status === 'missing') return language === 'fr' ? 'EXIF absent' : 'EXIF missing';
  if (status === 'unsupported_format') return language === 'fr' ? 'Format non supporté' : 'Unsupported format';
  if (status === 'parse_error') return language === 'fr' ? 'Erreur de lecture EXIF' : 'EXIF parse error';
  return language === 'fr' ? 'Indisponible' : 'Unavailable';
}

function exifSourceLabel(source: SubmissionPhotoMetadata['exifSource'] | null | undefined, language: 'en' | 'fr'): string {
  if (source === 'upload_buffer') return language === 'fr' ? 'Upload initial' : 'Initial upload';
  if (source === 'remote_url') return language === 'fr' ? 'Photo distante' : 'Remote photo';
  if (source === 'client_fallback') return language === 'fr' ? 'Fallback client' : 'Client fallback';
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

function categoryLabelLocal(category: AdminSubmissionEvent['event']['category'], language: 'en' | 'fr'): string {
  return getCategoryLabel(category, language);
}

function getSiteName(item: AdminSubmissionEvent, language: 'en' | 'fr'): string {
  const details = item.event.details as SubmissionDetails;
  if (typeof details.siteName === 'string' && details.siteName.trim()) return details.siteName.trim();
  if (typeof details.name === 'string' && details.name.trim()) return details.name.trim();
  return language === 'fr' ? 'Soumission sans nom' : 'Unnamed submission';
}

function getClientDevice(item: AdminSubmissionEvent): ClientDeviceInfo | null {
  const details = item.event.details as SubmissionDetails;
  if (!details.clientDevice || typeof details.clientDevice !== 'object') return null;
  const raw = details.clientDevice;
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
  if (state === 'mismatch') return language === 'fr' ? 'Écart' : 'Mismatch';
  return language === 'fr' ? 'Indisponible' : 'Unavailable';
}

function matchStateClass(state: MatchState): string {
  if (state === 'match') return 'text-forest bg-forest-wash border-forest-wash';
  if (state === 'mismatch') return 'text-terra bg-terra-wash border-terra-wash';
  return 'text-gray-500 bg-gray-100 border-gray-200';
}

function getRiskScore(item: AdminSubmissionEvent): number {
  const details = item.event.details as SubmissionDetails;
  const riskScore = details.riskScore;
  return typeof riskScore === 'number' && Number.isFinite(riskScore) ? riskScore : 0;
}

function getReviewStatus(item: AdminSubmissionEvent): string {
  const details = item.event.details as SubmissionDetails;
  return typeof details.reviewStatus === 'string' ? details.reviewStatus : 'auto_approved';
}

function getRiskBucket(item: AdminSubmissionEvent): Exclude<RiskFilter, 'all'> {
  const riskScore = getRiskScore(item);
  const reviewStatus = getReviewStatus(item);
  if (riskScore >= 60) return 'flagged';
  if (reviewStatus === 'pending_review') return 'pending';
  return 'low_risk';
}

function getAutomationLeadName(lead: LeadCandidate, language: 'en' | 'fr'): string {
  const details = lead.normalizedDetails as SubmissionDetails;
  const direct =
    (typeof details.siteName === 'string' && details.siteName.trim()) ||
    (typeof details.name === 'string' && details.name.trim()) ||
    (typeof details.roadName === 'string' && details.roadName.trim()) ||
    (typeof details.brand === 'string' && details.brand.trim());
  return direct || (language === 'fr' ? 'Lead automatisé' : 'Automated lead');
}

function getAutomationEvidenceUrl(lead: LeadCandidate): string | null {
  if (Array.isArray(lead.evidenceUrls) && lead.evidenceUrls.length > 0) {
    return lead.evidenceUrls[0] ?? null;
  }
  return lead.sourceUrl ?? null;
}

function automationStatusClass(status: AutomationLeadStatus): string {
  if (status === 'ready_for_assignment') return 'bg-forest-wash border-forest-wash text-forest';
  if (status === 'matched_existing' || status === 'assignment_created' || status === 'verified') {
    return 'bg-navy-light border-navy-border text-navy';
  }
  if (status.startsWith('rejected')) return 'bg-red-50 border-red-100 text-red-600';
  return 'bg-terra-wash border-terra-wash text-terra';
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
    status === true ? t('Match', 'OK') : status === false ? t('Mismatch', 'Écart') : t('Unavailable', 'Indisponible');
  const statusClass =
    status === true ? 'text-forest' : status === false ? 'text-terra' : 'text-gray-500';
  const exifStatusText = metadata ? exifStatusLabel(metadata.exifStatus, language) : unavailable;
  const exifReasonText = metadata?.exifReason ?? unavailable;
  const exifSourceText = metadata ? exifSourceLabel(metadata.exifSource, language) : unavailable;

  return (
    <div className="rounded-2xl border border-gray-100 bg-page p-4 space-y-2">
      <div className="micro-label text-navy">{label}</div>
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

interface SchemaGuardStatus {
  ok: boolean | null;
  expected: string[];
  actual: string[];
  missing: string[];
  extra: string[];
  reason?: string;
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

function addDaysDateOnly(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const DEFAULT_ASSIGNMENT_STATUS: CollectionAssignment['status'] = 'pending';
const ASSIGNMENT_STATUSES: CollectionAssignment['status'][] = ['pending', 'in_progress', 'completed', 'expired'];
const ASSIGNABLE_VERTICALS = VERTICAL_IDS as SubmissionCategory[];
const AUTOMATION_LEAD_STATUSES: AutomationLeadStatus[] = [
  'ready_for_assignment',
  'needs_field_verify',
  'matched_existing',
  'assignment_created',
  'verified',
  'import_candidate',
  'rejected_manual',
  'rejected_out_of_zone',
];
const AUTOMATION_PRIORITIES: AutomationLeadPriority[] = ['high', 'medium', 'low'];

const AdminQueue: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [items, setItems] = useState<AdminSubmissionEvent[]>([]);
  const [schemaGuard, setSchemaGuard] = useState<SchemaGuardStatus | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<SyncErrorRecord[]>([]);
  const [isClearingSyncErrors, setIsClearingSyncErrors] = useState(false);
  const [assignmentContext, setAssignmentContext] = useState<AssignmentPlannerContext | null>(null);
  const [assignments, setAssignments] = useState<CollectionAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentActionMessage, setAssignmentActionMessage] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<CollectionAssignment['status'] | ''>(DEFAULT_ASSIGNMENT_STATUS);
  const [assignmentAgentFilter, setAssignmentAgentFilter] = useState('');
  const [automationLeads, setAutomationLeads] = useState<LeadCandidate[]>([]);
  const [isLoadingAutomationLeads, setIsLoadingAutomationLeads] = useState(true);
  const [automationLeadError, setAutomationLeadError] = useState('');
  const [automationLeadMessage, setAutomationLeadMessage] = useState('');
  const [automationStatusFilter, setAutomationStatusFilter] = useState<AutomationStatusFilter>('ready_for_assignment');
  const [automationPriorityFilter, setAutomationPriorityFilter] = useState<AutomationPriorityFilter>('');
  const [automationCategoryFilter, setAutomationCategoryFilter] = useState<SubmissionCategory | ''>('');
  const [selectedAutomationLeadIds, setSelectedAutomationLeadIds] = useState<Set<string>>(new Set());
  const [isApplyingAutomationAction, setIsApplyingAutomationAction] = useState(false);
  const [plannerAgent, setPlannerAgent] = useState('');
  const [plannerZone, setPlannerZone] = useState('');
  const [plannerDueDate, setPlannerDueDate] = useState(addDaysDateOnly(4));
  const [plannerExpected, setPlannerExpected] = useState('30');
  const [plannerNotes, setPlannerNotes] = useState('');
  const [plannerVerticals, setPlannerVerticals] = useState<SubmissionCategory[]>(['pharmacy', 'mobile_money']);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [isApplyingDecision, setIsApplyingDecision] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());

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
    const loadSchemaGuard = async () => {
      try {
        const data = await apiJson<SchemaGuardStatus>('/api/submissions?view=schema_guard');
        if (!cancelled) setSchemaGuard(data);
      } catch {
        if (!cancelled) setSchemaGuard(null);
      }
    };
    void loadSchemaGuard();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAssignments = async () => {
      try {
        setIsLoadingAssignments(true);
        setAssignmentError('');
        const params = new URLSearchParams();
        params.set('view', 'assignment_planner_context');
        if (assignmentStatusFilter) params.set('status', assignmentStatusFilter);
        if (assignmentAgentFilter) params.set('agentUserId', assignmentAgentFilter);
        const data = await apiJson<{ context: AssignmentPlannerContext; assignments: CollectionAssignment[] }>(
          `/api/user?${params.toString()}`,
        );
        if (cancelled) return;
        setAssignmentContext(data.context);
        setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
        setPlannerAgent((prev) => prev || data.context?.agents?.[0]?.id || '');
        setPlannerZone((prev) => prev || data.context?.zones?.[0]?.id || '');
      } catch (assignmentLoadError) {
        if (cancelled) return;
        const message =
          assignmentLoadError instanceof Error
            ? assignmentLoadError.message
            : t('Unable to load assignments.', 'Impossible de charger les affectations.');
        setAssignmentError(message);
        setAssignments([]);
        setAssignmentContext(null);
      } finally {
        if (!cancelled) setIsLoadingAssignments(false);
      }
    };

    void loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [assignmentStatusFilter, assignmentAgentFilter, language]);

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
    let cancelled = false;

    const loadAutomationLeads = async () => {
      try {
        setIsLoadingAutomationLeads(true);
        setAutomationLeadError('');
        const params = new URLSearchParams();
        if (automationStatusFilter) params.set('status', automationStatusFilter);
        if (automationPriorityFilter) params.set('priority', automationPriorityFilter);
        if (automationCategoryFilter) params.set('category', automationCategoryFilter);
        params.set('limit', '120');
        const data = await apiJson<LeadCandidate[]>(`/api/intake/leads?${params.toString()}`);
        if (cancelled) return;
        setAutomationLeads(Array.isArray(data) ? data : []);
      } catch (loadError) {
        if (cancelled) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : t('Unable to load automation leads.', 'Impossible de charger les leads automatisés.');
        setAutomationLeadError(message);
        setAutomationLeads([]);
      } finally {
        if (!cancelled) setIsLoadingAutomationLeads(false);
      }
    };

    void loadAutomationLeads();
    return () => {
      cancelled = true;
    };
  }, [automationStatusFilter, automationPriorityFilter, automationCategoryFilter, language]);

  useEffect(() => {
    setDeleteError('');
    setActionMessage('');
  }, [selectedPointId]);

  useEffect(() => {
    setSelectedAutomationLeadIds((prev) => new Set([...prev].filter((id) => automationLeads.some((lead) => lead.id === id))));
  }, [automationLeads]);

  const groupedPoints = useMemo(() => groupEventsByPoint(items, language), [items, language]);
  const filteredGroups = useMemo(() => {
    const filtered = groupedPoints.filter((group) => {
      if (riskFilter === 'all') return true;
      return getRiskBucket(group.latestEvent) === riskFilter;
    });

    return filtered.sort((a, b) => {
      const riskDelta = getRiskScore(b.latestEvent) - getRiskScore(a.latestEvent);
      if (riskDelta !== 0) return riskDelta;
      const reviewPriority = (value: string) => (value === 'pending_review' ? 1 : 0);
      const reviewDelta = reviewPriority(getReviewStatus(b.latestEvent)) - reviewPriority(getReviewStatus(a.latestEvent));
      if (reviewDelta !== 0) return reviewDelta;
      return new Date(b.latestEvent.event.createdAt).getTime() - new Date(a.latestEvent.event.createdAt).getTime();
    });
  }, [groupedPoints, riskFilter]);
  const selectedGroup = useMemo(() => filteredGroups.find((g) => g.pointId === selectedPointId) ?? null, [filteredGroups, selectedPointId]);
  const selectedAutomationLeads = useMemo(
    () => automationLeads.filter((lead) => selectedAutomationLeadIds.has(lead.id)),
    [automationLeads, selectedAutomationLeadIds],
  );
  const unavailableLabel = t('Unavailable', 'Indisponible');

  useEffect(() => {
    if (filteredGroups.length === 0) {
      if (selectedPointId !== null) setSelectedPointId(null);
      return;
    }
    if (!selectedPointId || !filteredGroups.some((group) => group.pointId === selectedPointId)) {
      setSelectedPointId(filteredGroups[0]?.pointId ?? null);
    }
  }, [filteredGroups, selectedPointId]);

  const handleDeleteSelected = async () => {
    if (!selectedGroup) return;
    const hasReadOnly = selectedGroup.events.some(isReadOnlySubmission);
    if (hasReadOnly) {
      setDeleteError(t('This point contains read-only events that cannot be deleted.', 'Ce point contient des événements en lecture seule qui ne peuvent pas être supprimés.'));
      return;
    }

    const evtCount = selectedGroup.events.length;
    const confirmed = window.confirm(
      evtCount > 1
        ? t(`Delete all ${evtCount} events for this point permanently?`, `Supprimer definitivement les ${evtCount} evenements de ce point ?`)
        : t('Delete this submission event permanently?', 'Supprimer définitivement cet événement de soumission ?')
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
      setActionMessage(t('Point deleted successfully.', 'Point supprimé avec succès.'));
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

  const applyReviewToLocalState = (eventId: string, decision: ReviewDecision) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.event.id !== eventId) return item;
        const nextReviewStatus = decision === 'approved' ? 'auto_approved' : 'pending_review';
        return {
          ...item,
          event: {
            ...item.event,
            details: {
              ...(item.event.details as SubmissionDetails),
              reviewDecision: decision,
              reviewStatus: nextReviewStatus,
              reviewedAt: new Date().toISOString(),
            },
          },
        };
      }),
    );
  };

  const handleReviewDecision = async (group: GroupedPoint, decision: ReviewDecision) => {
    if (isApplyingDecision) return;
    setActionMessage('');
    setDeleteError('');
    try {
      setIsApplyingDecision(true);
      await apiJson(`/api/submissions/${encodeURIComponent(group.latestEvent.event.id)}?view=review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      applyReviewToLocalState(group.latestEvent.event.id, decision);
      setActionMessage(
        decision === 'approved'
          ? t('Latest event approved.', 'Dernier événement approuvé.')
          : decision === 'rejected'
            ? t('Latest event rejected.', 'Dernier événement rejeté.')
            : t('Latest event put on hold.', 'Dernier événement mis en attente.'),
      );
    } catch (reviewError) {
      const message =
        reviewError instanceof Error
          ? reviewError.message
          : t('Unable to apply review decision.', 'Impossible d\'appliquer la décision.');
      setDeleteError(message);
    } finally {
      setIsApplyingDecision(false);
    }
  };

  const toggleBulkItem = (pointId: string) => {
    setSelectedForBulk((prev) => {
      const next = new Set(prev);
      if (next.has(pointId)) next.delete(pointId);
      else next.add(pointId);
      return next;
    });
  };

  const selectAllLowRisk = () => {
    const lowRiskIds = filteredGroups
      .filter((g) => getRiskBucket(g.latestEvent) === 'low_risk')
      .map((g) => g.pointId);
    setSelectedForBulk((prev) => {
      const allSelected = lowRiskIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(lowRiskIds);
    });
  };

  const handleBulkApproveLowRisk = async () => {
    if (isApplyingDecision) return;

    const targetGroups = selectedForBulk.size > 0
      ? filteredGroups.filter((g) => selectedForBulk.has(g.pointId) && getReviewStatus(g.latestEvent) === 'pending_review')
      : filteredGroups.filter(
          (group) => getRiskBucket(group.latestEvent) === 'low_risk' && getReviewStatus(group.latestEvent) === 'pending_review',
        );

    if (targetGroups.length === 0) {
      setActionMessage(t('No pending groups to approve.', 'Aucun groupe en attente à approuver.'));
      return;
    }

    setActionMessage('');
    setDeleteError('');
    try {
      setIsApplyingDecision(true);
      for (const group of targetGroups) {
        await apiJson(`/api/submissions/${encodeURIComponent(group.latestEvent.event.id)}?view=review`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'approved' }),
        });
        applyReviewToLocalState(group.latestEvent.event.id, 'approved');
      }
      setSelectedForBulk(new Set());
      setActionMessage(
        t(`${targetGroups.length} group(s) approved.`, `${targetGroups.length} groupe(s) approuves.`),
      );
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t('Bulk approve failed.', 'Approbation en lot impossible.'));
    } finally {
      setIsApplyingDecision(false);
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

  useEffect(() => {
    if (filteredGroups.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
        || target?.isContentEditable === true;
      if (isTypingTarget) return;

      const currentIndex = filteredGroups.findIndex((group) => group.pointId === selectedPointId);
      const selected = currentIndex >= 0 ? filteredGroups[currentIndex] : null;
      const key = event.key.toLowerCase();

      if (key === 'j') {
        event.preventDefault();
        const next = filteredGroups[Math.min(filteredGroups.length - 1, Math.max(0, currentIndex + 1))];
        if (next) setSelectedPointId(next.pointId);
      }
      if (key === 'k') {
        event.preventDefault();
        const prev = filteredGroups[Math.max(0, currentIndex - 1)];
        if (prev) setSelectedPointId(prev.pointId);
      }
      if (!selected || isApplyingDecision) return;
      if (key === 'a') {
        event.preventDefault();
        void handleReviewDecision(selected, 'approved');
      }
      if (key === 'r') {
        event.preventDefault();
        void handleReviewDecision(selected, 'rejected');
      }
      if (key === 'h') {
        event.preventDefault();
        void handleReviewDecision(selected, 'flagged');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredGroups, isApplyingDecision, selectedPointId]);

  const togglePlannerVertical = (vertical: SubmissionCategory) => {
    setPlannerVerticals((prev) => {
      if (prev.includes(vertical)) return prev.filter((item) => item !== vertical);
      return [...prev, vertical];
    });
  };

  const handleCreateAssignment = async () => {
    if (isCreatingAssignment) return;
    setAssignmentError('');
    setAssignmentActionMessage('');
    if (!plannerAgent) {
      setAssignmentError(t('Select an agent.', 'Sélectionnez un agent.'));
      return;
    }
    if (!plannerZone) {
      setAssignmentError(t('Select a zone.', 'Sélectionnez une zone.'));
      return;
    }
    if (!plannerDueDate) {
      setAssignmentError(t('Select a due date.', 'Sélectionnez une date limite.'));
      return;
    }
    if (plannerVerticals.length === 0) {
      setAssignmentError(t('Select at least one vertical.', 'Sélectionnez au moins une verticale.'));
      return;
    }

    const pointsExpected = Number(plannerExpected);
    const normalizedExpected = Number.isFinite(pointsExpected) ? Math.max(0, Math.round(pointsExpected)) : 0;

    try {
      setIsCreatingAssignment(true);
      const created = await apiJson<CollectionAssignment>('/api/user?view=assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentUserId: plannerAgent,
          zoneId: plannerZone,
          assignedVerticals: plannerVerticals,
          dueDate: plannerDueDate,
          pointsExpected: normalizedExpected,
          notes: plannerNotes.trim() ? plannerNotes.trim() : null,
        }),
      });
      setAssignments((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setPlannerNotes('');
      setAssignmentActionMessage(t('Assignment created.', 'Affectation créée.'));
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : t('Unable to create assignment.', 'Impossible de créer l\'affectation.');
      setAssignmentError(message);
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const toggleAutomationLead = (leadId: string) => {
    setSelectedAutomationLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const handleRejectAutomationLeads = async () => {
    if (isApplyingAutomationAction) return;
    if (selectedAutomationLeads.length === 0) {
      setAutomationLeadMessage(t('Select at least one automation lead.', 'Sélectionnez au moins un lead automatisé.'));
      return;
    }

    try {
      setIsApplyingAutomationAction(true);
      setAutomationLeadError('');
      setAutomationLeadMessage('');
      for (const lead of selectedAutomationLeads) {
        const updated = await apiJson<LeadCandidate>(`/api/intake/leads/${encodeURIComponent(lead.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject' }),
        });
        setAutomationLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      setSelectedAutomationLeadIds(new Set());
      setAutomationLeadMessage(
        t(`${selectedAutomationLeads.length} automation lead(s) rejected.`, `${selectedAutomationLeads.length} lead(s) automatisés rejetés.`),
      );
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : t('Unable to reject automation leads.', 'Impossible de rejeter les leads automatisés.');
      setAutomationLeadError(message);
    } finally {
      setIsApplyingAutomationAction(false);
    }
  };

  const handleCreateAssignmentFromAutomationLeads = async () => {
    if (isApplyingAutomationAction || isCreatingAssignment) return;
    if (!plannerAgent) {
      setAutomationLeadError(t('Select an agent first.', 'Sélectionnez d\'abord un agent.'));
      return;
    }
    if (!plannerDueDate) {
      setAutomationLeadError(t('Select a due date first.', 'Sélectionnez d\'abord une date limite.'));
      return;
    }
    if (selectedAutomationLeads.length === 0) {
      setAutomationLeadMessage(t('Select at least one automation lead.', 'Sélectionnez au moins un lead automatisé.'));
      return;
    }

    const actionable = selectedAutomationLeads.filter((lead) => lead.zoneId);
    if (actionable.length !== selectedAutomationLeads.length) {
      setAutomationLeadError(
        t('Selected leads must all be within a known collection zone.', 'Les leads sélectionnés doivent tous appartenir à une zone de collecte connue.'),
      );
      return;
    }

    const zoneIds = Array.from(new Set(actionable.map((lead) => lead.zoneId)));
    if (zoneIds.length !== 1 || !zoneIds[0]) {
      setAutomationLeadError(t('Select leads from a single zone.', 'Sélectionnez des leads provenant d\'une seule zone.'));
      return;
    }

    const assignedVerticals = Array.from(new Set(actionable.map((lead) => lead.category)));
    const sources = Array.from(new Set(actionable.map((lead) => lead.sourceSystem)));
    const leadIds = actionable.map((lead) => lead.id).join(', ');
    const notes = [
      `Automation leads: ${actionable.length}`,
      `Sources: ${sources.join(', ')}`,
      `Lead IDs: ${leadIds}`,
    ]
      .join(' | ')
      .slice(0, 950);

    try {
      setIsApplyingAutomationAction(true);
      setIsCreatingAssignment(true);
      setAutomationLeadError('');
      setAutomationLeadMessage('');
      const created = await apiJson<CollectionAssignment>('/api/user?view=assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentUserId: plannerAgent,
          zoneId: zoneIds[0],
          assignedVerticals,
          dueDate: plannerDueDate,
          pointsExpected: actionable.length,
          notes,
        }),
      });
      const patchedIds = new Set<string>();
      for (const lead of actionable) {
        try {
          const updated = await apiJson<LeadCandidate>(`/api/intake/leads/${encodeURIComponent(lead.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_assigned', assignmentId: created.id }),
          });
          patchedIds.add(updated.id);
          setAutomationLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        } catch {
          // Keep the assignment creation successful even if one lead patch fails.
        }
      }
      setAssignments((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setSelectedAutomationLeadIds(new Set());
      setAutomationLeadMessage(
        patchedIds.size === actionable.length
          ? t('Assignment created from automation leads.', 'Affectation créée à partir des leads automatisés.')
          : t('Assignment created. Some lead statuses need a manual refresh.', 'Affectation créée. Certains statuts de lead doivent être rafraîchis manuellement.'),
      );
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : t('Unable to create assignment from leads.', 'Impossible de créer une affectation depuis les leads.');
      setAutomationLeadError(message);
    } finally {
      setIsApplyingAutomationAction(false);
      setIsCreatingAssignment(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-page overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-ink text-white px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 hover:text-terra transition-colors" aria-label={t('Go back', 'Retour')}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xs font-bold uppercase tracking-[0.2em]">{t('Submission Forensics', 'Analyse forensique')}</h1>
        <ShieldCheck size={18} className="text-terra" />
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white border border-gray-100 rounded-xl p-3 micro-label text-gray-500 flex items-center justify-between">
          <span>{t('All Submissions', 'Toutes les soumissions')}</span>
          <span>{items.length} {t('items', 'éléments')}</span>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="micro-label-wide text-gray-400">{t('Risk Queue', 'File de risque')}</div>
              <div className="mt-1 text-sm font-bold text-gray-900">{filteredGroups.length} {t('visible groups', 'groupes visibles')}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllLowRisk}
                className="h-10 rounded-2xl px-3 micro-label bg-gray-50 text-gray-600 border border-gray-100"
              >
                {t('Select Low-Risk', 'Sélectionner faible risque')}
              </button>
              <button
                type="button"
                onClick={handleBulkApproveLowRisk}
                disabled={isApplyingDecision}
                className={`h-10 rounded-2xl px-4 micro-label ${
                  isApplyingDecision ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
                }`}
              >
                {selectedForBulk.size > 0
                  ? `${t('Approve', 'Approuver')} (${selectedForBulk.size})`
                  : t('Approve Low-Risk', 'Approuver faible risque')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {([
              ['all', t('All', 'Tous')],
              ['flagged', t('Flagged', 'Signalés')],
              ['pending', t('Pending', 'En attente')],
              ['low_risk', t('Low Risk', 'Faible risque')],
            ] as Array<[RiskFilter, string]>).map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                onClick={() => setRiskFilter(filter)}
                className={`h-10 rounded-xl border micro-label ${
                  riskFilter === filter ? 'bg-navy text-white border-navy' : 'bg-page text-gray-600 border-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="micro-label text-gray-400">
            {t('Keyboard', 'Clavier')}: J/K {t('navigate', 'naviguer')} • A {t('approve', 'approuver')} • R {t('reject', 'rejeter')} • H {t('hold', 'mettre en attente')}
          </div>
        </div>

        {schemaGuard?.ok === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="micro-label text-amber-700">
              {t('Schema Guard Warning', 'Alerte garde schéma')}
            </div>
            {schemaGuard.missing.length > 0 && (
              <div className="text-xs text-amber-800">
                {t('Missing categories:', 'Catégories manquantes :')} {schemaGuard.missing.map((value) => getCategoryLabel(value, language)).join(', ')}
              </div>
            )}
            {schemaGuard.extra.length > 0 && (
              <div className="text-xs text-amber-800">
                {t('Unexpected categories:', 'Catégories inattendues :')} {schemaGuard.extra.join(', ')}
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-widest text-navy">
              {t('Assignment Planner', 'Planification des affectations')}
            </h4>
            <span className="micro-label text-gray-400">
              {assignments.length} {t('active rows', 'lignes')}
            </span>
          </div>

          {assignmentActionMessage && (
            <div className="rounded-xl border border-forest-wash bg-forest-wash p-3 text-[11px] text-forest">
              {assignmentActionMessage}
            </div>
          )}

          {assignmentError && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600">
              {assignmentError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <select
              value={assignmentStatusFilter}
              onChange={(event) => setAssignmentStatusFilter((event.target.value as CollectionAssignment['status']) || '')}
              className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50"
            >
              <option value="">{t('All statuses', 'Tous les statuts')}</option>
              {ASSIGNMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={assignmentAgentFilter}
              onChange={(event) => setAssignmentAgentFilter(event.target.value)}
              className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50"
            >
              <option value="">{t('All agents', 'Tous les agents')}</option>
              {(assignmentContext?.agents ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-gray-100 p-3 space-y-3 bg-page">
            <div className="micro-label text-gray-500">
              {t('Add Assignment', 'Ajouter une affectation')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={plannerAgent}
                onChange={(event) => setPlannerAgent(event.target.value)}
                className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white"
              >
                <option value="">{t('Select agent', 'Choisir agent')}</option>
                {(assignmentContext?.agents ?? []).map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <select
                value={plannerZone}
                onChange={(event) => setPlannerZone(event.target.value)}
                className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white"
              >
                <option value="">{t('Select zone', 'Choisir zone')}</option>
                {(assignmentContext?.zones ?? []).map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={plannerDueDate}
                onChange={(event) => setPlannerDueDate(event.target.value)}
                className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white"
              />
              <input
                type="number"
                min={0}
                value={plannerExpected}
                onChange={(event) => setPlannerExpected(event.target.value)}
                placeholder={t('Expected points', 'Points attendus')}
                className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white"
              />
            </div>
            <input
              value={plannerNotes}
              onChange={(event) => setPlannerNotes(event.target.value)}
              placeholder={t('Optional notes', 'Notes optionnelles')}
              className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white"
            />
            <div className="grid grid-cols-2 gap-2">
              {ASSIGNABLE_VERTICALS.map((vertical) => {
                const active = plannerVerticals.includes(vertical);
                return (
                  <button
                    key={vertical}
                    type="button"
                    onClick={() => togglePlannerVertical(vertical)}
                    className={`h-9 rounded-xl border micro-label ${
                      active ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-100'
                    }`}
                  >
                    {getCategoryLabel(vertical, language)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleCreateAssignment}
              disabled={isCreatingAssignment}
              className={`h-10 rounded-xl micro-label ${
                isCreatingAssignment ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white hover:bg-navy-mid'
              }`}
            >
              {isCreatingAssignment ? t('Creating...', 'Création...') : t('Create Assignment', 'Créer affectation')}
            </button>
          </div>

          {isLoadingAssignments ? (
            <div className="text-xs text-gray-500">{t('Loading assignments...', 'Chargement des affectations...')}</div>
          ) : (
            <div className="space-y-2">
              {assignments.length === 0 && (
                <div className="rounded-xl border border-gray-100 bg-page p-3 text-xs text-gray-500">
                  {t('No assignments found.', 'Aucune affectation trouvée.')}
                </div>
              )}
              {assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border border-gray-100 p-3 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-gray-900">{assignment.zoneLabel}</div>
                    <span className="text-[10px] uppercase tracking-widest text-gray-500">{assignment.status}</span>
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {assignment.agentUserId} · {assignment.pointsSubmitted}/{assignment.pointsExpected} ({assignment.completionRate}%)
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {t('Due', 'Échéance')}: {assignment.dueDate}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {assignment.assignedVerticals.map((vertical) => getCategoryLabel(vertical, language)).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-navy">
                {t('Automation Intake', 'Intake automatisé')}
              </h4>
              <div className="mt-1 text-[11px] text-gray-500">
                {automationLeads.length} {t('lead(s) loaded', 'lead(s) chargés')}
              </div>
            </div>
            <div className="micro-label text-gray-400">
              {selectedAutomationLeadIds.size} {t('selected', 'sélectionnés')}
            </div>
          </div>

          {automationLeadMessage && (
            <div className="rounded-xl border border-forest-wash bg-forest-wash p-3 text-[11px] text-forest">
              {automationLeadMessage}
            </div>
          )}

          {automationLeadError && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600">
              {automationLeadError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={automationStatusFilter}
              onChange={(event) => setAutomationStatusFilter(event.target.value as AutomationStatusFilter)}
              className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50"
            >
              <option value="">{t('All statuses', 'Tous les statuts')}</option>
              {AUTOMATION_LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={automationCategoryFilter}
              onChange={(event) => setAutomationCategoryFilter((event.target.value as SubmissionCategory) || '')}
              className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50"
            >
              <option value="">{t('All verticals', 'Toutes les verticales')}</option>
              {ASSIGNABLE_VERTICALS.map((vertical) => (
                <option key={vertical} value={vertical}>
                  {getCategoryLabel(vertical, language)}
                </option>
              ))}
            </select>
            <select
              value={automationPriorityFilter}
              onChange={(event) => setAutomationPriorityFilter((event.target.value as AutomationPriorityFilter) || '')}
              className="h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50"
            >
              <option value="">{t('All priorities', 'Toutes les priorités')}</option>
              {AUTOMATION_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreateAssignmentFromAutomationLeads}
              disabled={isApplyingAutomationAction || isCreatingAssignment}
              className={`h-10 rounded-xl px-4 micro-label ${
                isApplyingAutomationAction || isCreatingAssignment ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
              }`}
            >
              {t('Create Assignment from Selection', 'Créer affectation depuis la sélection')}
            </button>
            <button
              type="button"
              onClick={handleRejectAutomationLeads}
              disabled={isApplyingAutomationAction}
              className={`h-10 rounded-xl px-4 micro-label ${
                isApplyingAutomationAction ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-600 border border-red-100'
              }`}
            >
              {t('Reject Selection', 'Rejeter la sélection')}
            </button>
          </div>

          {isLoadingAutomationLeads ? (
            <div className="text-xs text-gray-500">{t('Loading automation leads...', 'Chargement des leads automatisés...')}</div>
          ) : automationLeads.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-page p-3 text-xs text-gray-500">
              {t('No automation leads found.', 'Aucun lead automatisé trouvé.')}
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {automationLeads.map((lead) => {
                const evidenceUrl = getAutomationEvidenceUrl(lead);
                return (
                  <div key={lead.id} className="rounded-xl border border-gray-100 p-3 bg-page">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedAutomationLeadIds.has(lead.id)}
                        onChange={() => toggleAutomationLead(lead.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-navy"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-gray-900">{getAutomationLeadName(lead, language)}</div>
                            <div className="text-[10px] uppercase tracking-widest text-gray-400">
                              {getCategoryLabel(lead.category, language)} • {lead.sourceSystem}
                            </div>
                          </div>
                          <span className={`rounded-lg border px-2 py-1 micro-label ${automationStatusClass(lead.status)}`}>
                            {lead.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-gray-600">
                          <div>{t('Zone', 'Zone')}: {lead.zoneId ?? unavailableLabel}</div>
                          <div>{t('Priority', 'Priorité')}: {lead.priority}</div>
                          <div>
                            {t('Match', 'Correspondance')}: {lead.matchPointId ? `${lead.matchPointId} (${typeof lead.matchConfidence === 'number' ? lead.matchConfidence.toFixed(2) : '--'})` : unavailableLabel}
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-600">
                          {t('Source record', 'Enregistrement source')}: {lead.sourceRecordId}
                        </div>
                        {evidenceUrl && (
                          <a
                            href={evidenceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-navy underline break-all"
                          >
                            <MapPin size={12} />
                            {t('Evidence', 'Preuve')}: {evidenceUrl}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {syncErrors.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertTriangle size={14} />
                <span className="micro-label">
                  {t('Local Sync Errors', 'Erreurs locales de synchronisation')} ({syncErrors.length})
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearSyncErrors}
                disabled={isClearingSyncErrors}
                className={`micro-label ${isClearingSyncErrors ? 'text-red-300' : 'text-red-700'}`}
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
          <div className="bg-forest-wash border border-forest-wash rounded-2xl p-4 text-xs text-forest">
            {actionMessage}
          </div>
        )}

        {!isLoading && !error && deleteError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600">
            {deleteError}
          </div>
        )}

        <div className="lg:flex lg:gap-4">
        <div className="lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:max-h-[calc(100vh-200px)]">
        {!isLoading && !error && filteredGroups.length > 0 && (
          <div className="space-y-3">
            {filteredGroups.map((group) => {
              const isSelected = selectedPointId === group.pointId;
              const preview = group.allPhotos[0]?.url ?? null;
              const riskScore = getRiskScore(group.latestEvent);
              const reviewStatus = getReviewStatus(group.latestEvent);
              return (
                <div
                  key={`desktop-${group.pointId}`}
                  className={`hidden lg:block w-full text-left bg-white border rounded-2xl overflow-hidden shadow-sm transition-colors ${
                    isSelected ? 'border-navy' : 'border-gray-100 hover:border-navy-border'
                  }`}
                >
                  <div className="flex">
                    <div className="flex items-center pl-2">
                      <input
                        type="checkbox"
                        checked={selectedForBulk.has(group.pointId)}
                        onChange={() => toggleBulkItem(group.pointId)}
                        className="w-4 h-4 rounded border-gray-300 text-navy shrink-0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPointId(group.pointId)}
                      className="flex flex-1 text-left"
                    >
                    <div className="w-16 h-16 bg-gray-100 shrink-0 flex items-center justify-center relative">
                      {preview ? (
                        <img src={preview} alt={t('submission', 'soumission')} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Camera size={14} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 p-2 space-y-1">
                      <h4 className="text-xs font-bold text-gray-900 leading-tight truncate">{group.siteName}</h4>
                      <p className="text-[10px] uppercase tracking-widest text-gray-400">
                        {categoryLabelLocal(group.category, language)} • {riskScore} • {reviewStatus}
                      </p>
                    </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto lg:max-h-[calc(100vh-200px)]">

        {!isLoading && !error && selectedGroup && (() => {
          const hasReadOnly = selectedGroup.events.some(isReadOnlySubmission);
          const latestFraudCheck = selectedGroup.latestEvent.fraudCheck ?? null;
          const latestDevice = getClientDevice(selectedGroup.latestEvent);
          const contributors = [...new Map<string, AdminSubmissionEvent['user']>(selectedGroup.events.map((e) => [e.user.id, e.user])).values()];
          return (
          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">{t('Point Detail', 'Détail du point')}</h4>
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
                {selectedGroup.events.length} {t('event(s)', 'événement(s)')}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleReviewDecision(selectedGroup, 'approved')}
                  disabled={isApplyingDecision}
                  className={`h-10 px-3 rounded-xl micro-label ${
                    isApplyingDecision ? 'bg-gray-100 text-gray-400' : 'bg-forest-wash text-forest'
                  }`}
                >
                  {t('Approve', 'Approuver')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleReviewDecision(selectedGroup, 'flagged')}
                  disabled={isApplyingDecision}
                  className={`h-10 px-3 rounded-xl micro-label ${
                    isApplyingDecision ? 'bg-gray-100 text-gray-400' : 'bg-terra-wash text-terra'
                  }`}
                >
                  {t('Hold', 'Mettre en attente')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleReviewDecision(selectedGroup, 'rejected')}
                  disabled={isApplyingDecision}
                  className={`h-10 px-3 rounded-xl micro-label ${
                    isApplyingDecision ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {t('Reject', 'Rejeter')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={isDeleting || hasReadOnly}
                  className={`h-10 px-3 rounded-xl micro-label flex items-center space-x-2 ${
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
            </div>

            <div className="grid grid-cols-1 gap-3 text-[11px]">
              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="micro-label text-gray-400">{t('Contributors', 'Contributeurs')}</div>
                {contributors.map((user) => (
                  <div key={user.id} className="flex items-start gap-2">
                    <ProfileAvatar preset={coerceAvatarPreset(user.avatarPreset)} alt={user.name} className="w-8 h-8 shrink-0" />
                    <div className="space-y-0.5">
                    <div className="text-gray-900 font-semibold">{user.name}</div>
                    <div className="text-gray-600">{user.email ?? unavailableLabel}</div>
                    <div className="text-[11px] text-gray-500">
                      {t('Trust', 'Confiance')}: {typeof user.trustScore === 'number' ? user.trustScore : '--'} • {user.trustTier ?? unavailableLabel}
                    </div>
                    {user.suspendedUntil && (
                      <div className="text-[11px] text-terra-dark">
                        {t("Suspended until", "Suspendu jusqu’au")}: {formatDate(user.suspendedUntil, unavailableLabel)}
                      </div>
                    )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="micro-label text-gray-400">{t('Point Metadata', 'Métadonnées du point')}</div>
                <div>{t('Category', 'Catégorie')}: {categoryLabelLocal(selectedGroup.category, language)}</div>
                <div>Point ID: {selectedGroup.pointId}</div>
                <div>{t('Events', 'Événements')}: {selectedGroup.events.length}</div>
                <div>{t('Risk Score', 'Score de risque')}: {getRiskScore(selectedGroup.latestEvent)}</div>
                <div>{t('Review Status', 'Statut revue')}: {getReviewStatus(selectedGroup.latestEvent)}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-2">
                <div className="micro-label text-gray-400">{t('Event Timeline', 'Historique des événements')}</div>
                {selectedGroup.events.map((ev, idx) => {
                  const device = getClientDevice(ev);
                  return (
                    <div key={ev.event.id} className={`p-2 rounded-xl ${idx === 0 ? 'bg-forest-wash border border-forest-wash' : 'bg-gray-50 border border-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <span className="micro-label text-navy">
                          {ev.event.eventType === 'CREATE_EVENT' ? t('Create', 'Création') : t('Enrich', 'Enrichissement')}
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
                <div className="micro-label text-gray-400">{t('Location', 'Localisation')}</div>
                <div>{t('Submission GPS', 'GPS soumis')}: {formatLocation(latestFraudCheck?.submissionLocation, unavailableLabel)}</div>
                <div>{t('Effective GPS', 'GPS effectif')}: {formatLocation(latestFraudCheck?.effectiveLocation, unavailableLabel)}</div>
                <div>{t('IP GPS', 'GPS IP')}: {formatLocation(latestFraudCheck?.ipLocation, unavailableLabel)}</div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                <div className="micro-label text-gray-400">{t('Client Device', 'Appareil client')}</div>
                <div>{t('Device ID', 'Device ID')}: {latestDevice?.deviceId ?? unavailableLabel}</div>
                <div>{t('Platform', 'Plateforme')}: {latestDevice?.platform ?? unavailableLabel}</div>
                <div>
                  {t('Low-end flag', 'Indicateur entrée de gamme')}:{' '}
                  {latestDevice ? (latestDevice.isLowEnd === true ? t('Yes', 'Oui') : t('No', 'Non')) : unavailableLabel}
                </div>
              </div>

              <div className="space-y-2">
                <div className="micro-label text-gray-400">
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
                        <img src={photo.url} alt={`${t('Photo', 'Photo')} ${idx + 1}`} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                      <div className="text-[10px] text-gray-500 text-center">
                        {photo.eventType === 'CREATE_EVENT' ? t('Create', 'Création') : photo.eventType === 'ENRICH_EVENT' ? t('Enrich', 'Enrichissement') : photo.eventType}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="micro-label text-gray-400">
                  {t('Photo EXIF Metadata', 'Métadonnées EXIF des photos')}
                </div>
                {selectedGroup.allPhotos.length === 0 && (
                  <div className="text-[11px] text-gray-500">{unavailableLabel}</div>
                )}
                {selectedGroup.allPhotos.map((photo, idx) => (
                  <DetailMetadataBlock
                    key={idx}
                    label={`${t('Photo', 'Photo')} ${idx + 1} — ${photo.eventType === 'CREATE_EVENT' ? t('Create', 'Création') : photo.eventType === 'ENRICH_EVENT' ? t('Enrich', 'Enrichissement') : photo.eventType}`}
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

        {!isLoading && !error && !selectedGroup && filteredGroups.length > 0 && (
          <div className="hidden lg:flex bg-white border border-gray-100 rounded-2xl p-8 items-center justify-center text-xs text-gray-400 min-h-[200px]">
            {t('Select an item to view details', 'Sélectionnez un élément pour voir les détails')}
          </div>
        )}

        </div>
        </div>

        {!isLoading && !error && filteredGroups.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-xs text-gray-500 text-center">
            {t('No submissions found.', 'Aucune soumission trouvée.')}
          </div>
        )}

        {!isLoading && !error && filteredGroups.length > 0 && (
          <div className="space-y-3 lg:hidden">
            {filteredGroups.map((group) => {
              const isSelected = selectedPointId === group.pointId;
              const state = getMatchState(group.latestEvent.fraudCheck);
              const preview = group.allPhotos[0]?.url ?? null;
              const contributors = [...new Set(group.events.map((e) => e.user.name))];
              const riskScore = getRiskScore(group.latestEvent);
              const reviewStatus = getReviewStatus(group.latestEvent);
              return (
                <div
                  key={group.pointId}
                  className={`w-full text-left bg-white border rounded-2xl overflow-hidden shadow-sm transition-colors ${
                    isSelected ? 'border-navy' : 'border-gray-100 hover:border-navy-border'
                  }`}
                >
                  <div className="flex">
                    <div className="flex items-center pl-2">
                      <input
                        type="checkbox"
                        checked={selectedForBulk.has(group.pointId)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleBulkItem(group.pointId);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-navy shrink-0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPointId(group.pointId)}
                      className="flex flex-1 text-left"
                    >
                    <div className="w-24 h-24 bg-gray-100 shrink-0 flex items-center justify-center relative">
                      {preview ? (
                        <img src={preview} alt={t('submission', 'soumission')} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Camera size={18} className="text-gray-300" />
                      )}
                      {group.allPhotos.length > 1 && (
                        <div className="absolute top-1 right-1 bg-navy text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {group.allPhotos.length}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 leading-tight">{group.siteName}</h4>
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">
                            {categoryLabelLocal(group.category, language)}
                            {group.events.length > 1 && ` · ${group.events.length} ${t('events', 'événements')}`}
                          </p>
                        </div>
                        <span className={`micro-label px-2 py-1 rounded-lg border ${matchStateClass(state)}`}>
                          {matchStateLabel(state, language)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-600 flex items-center gap-1">
                        <ProfileAvatar preset={coerceAvatarPreset(group.events[0]?.user.avatarPreset)} alt="" className="w-4 h-4 shrink-0" />
                        <span className="truncate">{contributors.join(', ')}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <MapPin size={12} />
                        <span>{formatDate(group.latestEvent.event.createdAt, unavailableLabel)}</span>
                      </div>
                      <div className="micro-label text-gray-400">
                        {t('Risk', 'Risque')}: {riskScore} • {reviewStatus}
                      </div>
                    </div>
                  </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminQueue;
