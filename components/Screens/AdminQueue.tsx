import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import ProfileAvatar from '../shared/ProfileAvatar';
import { coerceAvatarPreset } from '../../shared/avatarPresets';
import { apiFetch, apiJson } from '../../lib/client/api';
import { clearSyncErrorRecords, listSyncErrorRecords, type SyncErrorRecord } from '../../lib/client/offlineQueue';
import {
  buildAdminSubmissionGroups,
  createEmptyAdminReviewStats,
  type AdminReviewQueueResponse,
  type AdminRiskFilter,
  type AdminSubmissionGroup,
} from '../../lib/shared/adminReviewQueue';
import type {
  AssignmentPlannerContext,
  AutomationLeadPriority,
  AutomationLeadStatus,
  ClientDeviceInfo,
  CollectionAssignment,
  LeadCandidate,
  SubmissionCategory,
  SubmissionDetails,
  SubmissionFraudCheck,
  SubmissionLocation,
  SubmissionPhotoMetadata,
} from '../../shared/types';
import { categoryLabel as getCategoryLabel, VERTICAL_IDS } from '../../shared/verticals';

interface Props {
  onBack: () => void;
  language: 'en' | 'fr';
}

type ReviewDecision = 'approved' | 'rejected' | 'flagged';
type AutomationStatusFilter = '' | AutomationLeadStatus;
type AutomationPriorityFilter = '' | AutomationLeadPriority;
type AdminMode = 'review' | 'assignments' | 'automation';
type MatchState = 'match' | 'mismatch' | 'unavailable';

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => void;
};

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
const REVIEW_PAGE_LIMIT = 24;
const AUTOMATION_LEADS_PAGE_SIZE = 50;
const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-page';

function exifStatusLabel(status: SubmissionPhotoMetadata['exifStatus'] | null | undefined, language: 'en' | 'fr'): string {
  if (status === 'ok') return language === 'fr' ? 'EXIF présent' : 'EXIF present';
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
  return `${distanceKm.toFixed(2)} km`;
}

function formatDate(iso: string | null | undefined, unavailable: string, language: 'en' | 'fr'): string {
  if (!iso) return unavailable;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return unavailable;
  return parsed.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatAgeFromHours(hours: number, language: 'en' | 'fr'): string {
  if (hours < 1) return language === 'fr' ? 'à l’instant' : 'just now';
  if (hours < 24) return language === 'fr' ? `${hours} h` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return language === 'fr' ? `${days} j` : `${days}d`;
}

function categoryLabelLocal(category: SubmissionCategory, language: 'en' | 'fr'): string {
  return getCategoryLabel(category, language);
}

function reviewStatusLabel(status: string, language: 'en' | 'fr'): string {
  switch (status) {
    case 'pending_review':
      return language === 'fr' ? 'À revoir' : 'Needs review';
    case 'approved':
    case 'auto_approved':
      return language === 'fr' ? 'Approuvé' : 'Approved';
    case 'flagged':
      return language === 'fr' ? 'En attente' : 'On hold';
    case 'rejected':
      return language === 'fr' ? 'Rejeté' : 'Rejected';
    default:
      return status.replace(/_/g, ' ');
  }
}

function assignmentStatusLabel(status: CollectionAssignment['status'], language: 'en' | 'fr'): string {
  switch (status) {
    case 'pending':
      return language === 'fr' ? 'Planifiée' : 'Queued';
    case 'in_progress':
      return language === 'fr' ? 'En cours terrain' : 'In field';
    case 'completed':
      return language === 'fr' ? 'Terminée' : 'Completed';
    case 'expired':
      return language === 'fr' ? 'Expirée' : 'Expired';
    default:
      return status;
  }
}

function trustTierLabel(tier: AdminSubmissionGroup['summary']['trustTier'], language: 'en' | 'fr'): string {
  switch (tier) {
    case 'new':
      return language === 'fr' ? 'Nouveau' : 'New';
    case 'standard':
      return language === 'fr' ? 'Standard' : 'Standard';
    case 'trusted':
      return language === 'fr' ? 'Fiable' : 'Trusted';
    case 'elite':
      return language === 'fr' ? 'Élite' : 'Elite';
    case 'restricted':
      return language === 'fr' ? 'Restreint' : 'Restricted';
    default:
      return language === 'fr' ? 'Indisponible' : 'Unavailable';
  }
}

function trustTierClass(tier: AdminSubmissionGroup['summary']['trustTier']): string {
  if (tier === 'elite' || tier === 'trusted') return 'bg-forest-wash text-forest border-forest-wash';
  if (tier === 'restricted') return 'bg-red-50 text-red-600 border-red-100';
  if (tier === 'new') return 'bg-gold-wash text-amber-700 border-gold-wash';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function automationStatusLabel(status: AutomationLeadStatus, language: 'en' | 'fr'): string {
  switch (status) {
    case 'ready_for_assignment':
      return language === 'fr' ? 'Prêt à affecter' : 'Ready to assign';
    case 'needs_field_verify':
      return language === 'fr' ? 'Vérification terrain' : 'Needs field verify';
    case 'matched_existing':
      return language === 'fr' ? 'Correspondance existante' : 'Matched existing';
    case 'assignment_created':
      return language === 'fr' ? 'Affectation créée' : 'Assignment created';
    case 'verified':
      return language === 'fr' ? 'Vérifié' : 'Verified';
    case 'import_candidate':
      return language === 'fr' ? 'Candidat import' : 'Import candidate';
    case 'rejected_manual':
      return language === 'fr' ? 'Rejet manuel' : 'Rejected manually';
    case 'rejected_out_of_zone':
      return language === 'fr' ? 'Hors zone' : 'Out of zone';
    default:
      return status;
  }
}

function automationPriorityLabel(priority: AutomationLeadPriority, language: 'en' | 'fr'): string {
  switch (priority) {
    case 'high':
      return language === 'fr' ? 'Haute' : 'High';
    case 'medium':
      return language === 'fr' ? 'Moyenne' : 'Medium';
    case 'low':
      return language === 'fr' ? 'Basse' : 'Low';
    default:
      return priority;
  }
}

function getClientDevice(item: AdminSubmissionEventLike): ClientDeviceInfo | null {
  const details = item.details;
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
    isLowEnd: raw.isLowEnd === true,
  };
}

interface AdminSubmissionEventLike {
  details: SubmissionDetails;
}

function isReadOnlySubmission(item: AdminSubmissionGroup['events'][number]): boolean {
  const source = typeof item.event.source === 'string' ? item.event.source.trim().toLowerCase() : '';
  if (source === 'legacy_submission' || source === 'osm_overpass') return true;
  if (item.event.id.startsWith('legacy-event-')) return true;
  return false;
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

function automationStatusClass(status: AutomationLeadStatus): string {
  if (status === 'ready_for_assignment') return 'bg-forest-wash border-forest-wash text-forest';
  if (status === 'matched_existing' || status === 'assignment_created' || status === 'verified') {
    return 'bg-navy-light border-navy-border text-navy';
  }
  if (status.startsWith('rejected')) return 'bg-red-50 border-red-100 text-red-600';
  return 'bg-terra-wash border-terra-wash text-terra';
}

function runViewTransition(callback: () => void) {
  if (typeof document === 'undefined') {
    startTransition(callback);
    return;
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    startTransition(callback);
    return;
  }

  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(() => {
      startTransition(callback);
    });
    return;
  }

  startTransition(callback);
}

function addDaysDateOnly(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function queueAccentClass(group: AdminSubmissionGroup): string {
  if (group.summary.riskBucket === 'flagged') return 'border-l-terra';
  if (group.summary.riskBucket === 'pending') return 'border-l-gold';
  return 'border-l-forest';
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
  const statusClass = status === true ? 'text-forest' : status === false ? 'text-terra' : 'text-gray-500';
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
        <span className="text-gray-800">{formatDate(metadata?.capturedAt, unavailable, language)}</span>
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
      <div className="micro-label text-gray-400">
        {t('Threshold', 'Seuil')}: {thresholdKm} km
      </div>
    </div>
  );
};

const AdminQueue: React.FC<Props> = ({ onBack, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const unavailableLabel = t('Unavailable', 'Indisponible');
  const unnamedLabel = t('Unnamed submission', 'Soumission sans nom');
  const reviewCacheRef = useRef(new Map<string, AdminReviewQueueResponse>());

  const [activeMode, setActiveMode] = useState<AdminMode>('review');
  const [reviewData, setReviewData] = useState<AdminReviewQueueResponse>({
    groups: [],
    reviewers: [],
    stats: createEmptyAdminReviewStats(),
    page: 1,
    totalPages: 1,
    totalGroups: 0,
    limit: REVIEW_PAGE_LIMIT,
  });
  const [isLoadingReview, setIsLoadingReview] = useState(true);
  const [reviewError, setReviewError] = useState('');
  const [reviewPage, setReviewPage] = useState(1);
  const [schemaGuard, setSchemaGuard] = useState<SchemaGuardStatus | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<SyncErrorRecord[]>([]);
  const [isClearingSyncErrors, setIsClearingSyncErrors] = useState(false);
  const [assignmentContext, setAssignmentContext] = useState<AssignmentPlannerContext | null>(null);
  const [assignments, setAssignments] = useState<CollectionAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentActionMessage, setAssignmentActionMessage] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<CollectionAssignment['status'] | ''>(DEFAULT_ASSIGNMENT_STATUS);
  const [assignmentAgentFilter, setAssignmentAgentFilter] = useState('');
  const [automationLeads, setAutomationLeads] = useState<LeadCandidate[]>([]);
  const [isLoadingAutomationLeads, setIsLoadingAutomationLeads] = useState(false);
  const [automationLeadError, setAutomationLeadError] = useState('');
  const [automationLeadMessage, setAutomationLeadMessage] = useState('');
  const [automationStatusFilter, setAutomationStatusFilter] = useState<AutomationStatusFilter>('ready_for_assignment');
  const [automationPriorityFilter, setAutomationPriorityFilter] = useState<AutomationPriorityFilter>('');
  const [automationCategoryFilter, setAutomationCategoryFilter] = useState<SubmissionCategory | ''>('');
  const [automationSourceFilter, setAutomationSourceFilter] = useState('');
  const [automationLeadsOffset, setAutomationLeadsOffset] = useState(0);
  const [hasMoreAutomationLeads, setHasMoreAutomationLeads] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [selectedAutomationLeadIds, setSelectedAutomationLeadIds] = useState<Set<string>>(new Set());
  const [isApplyingAutomationAction, setIsApplyingAutomationAction] = useState(false);
  const [plannerAgent, setPlannerAgent] = useState('');
  const [plannerZone, setPlannerZone] = useState('');
  const [plannerDueDate, setPlannerDueDate] = useState(addDaysDateOnly(4));
  const [plannerExpected, setPlannerExpected] = useState('30');
  const [plannerNotes, setPlannerNotes] = useState('');
  const [plannerVerticals, setPlannerVerticals] = useState<SubmissionCategory[]>(['pharmacy', 'mobile_money']);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [riskFilter, setRiskFilter] = useState<AdminRiskFilter>('all');
  const [userFilter, setUserFilter] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplyingDecision, setIsApplyingDecision] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());

  const assignmentAgentNameById = useMemo(
    () => new Map((assignmentContext?.agents ?? []).map((agent) => [agent.id, agent.name] as const)),
    [assignmentContext],
  );

  const selectedAutomationLeads = useMemo(
    () => automationLeads.filter((lead) => selectedAutomationLeadIds.has(lead.id)),
    [automationLeads, selectedAutomationLeadIds],
  );
  const selectedGroup = useMemo(
    () => reviewData.groups.find((group) => group.pointId === selectedPointId) ?? null,
    [reviewData.groups, selectedPointId],
  );
  const eligibleGroups = useMemo(
    () =>
      reviewData.groups.filter(
        (group) =>
          (group.summary.riskBucket === 'pending' || group.summary.riskBucket === 'low_risk')
          && group.summary.reviewStatus === 'pending_review',
      ),
    [reviewData.groups],
  );
  const selectedPageLabel = useMemo(() => {
    if (reviewData.totalGroups === 0) return t('No groups', 'Aucun groupe');
    const start = (reviewData.page - 1) * reviewData.limit + 1;
    const end = Math.min(reviewData.totalGroups, start + reviewData.groups.length - 1);
    return `${start}-${end} / ${reviewData.totalGroups}`;
  }, [reviewData.groups.length, reviewData.limit, reviewData.page, reviewData.totalGroups, t]);

  const makeQueueCacheKey = (page: number) => `${riskFilter}:${userFilter || 'all'}:${page}`;

  const fetchReviewQueue = async (page: number, options: { force?: boolean; background?: boolean } = {}) => {
    const key = makeQueueCacheKey(page);
    if (!options.force) {
      const cached = reviewCacheRef.current.get(key);
      if (cached) {
        if (!options.background) {
          setReviewData(cached);
          setIsLoadingReview(false);
          setReviewError('');
        }
        return cached;
      }
    }

    if (!options.background) {
      setIsLoadingReview(true);
      setReviewError('');
    }

    const params = new URLSearchParams({
      view: 'review_queue',
      scope: 'global',
      page: String(page),
      limit: String(REVIEW_PAGE_LIMIT),
    });
    if (riskFilter !== 'all') params.set('risk', riskFilter);
    if (userFilter) params.set('userId', userFilter);

    const data = await apiJson<AdminReviewQueueResponse>(`/api/submissions?${params.toString()}`);
    reviewCacheRef.current.set(key, data);

    if (!options.background) {
      setReviewData(data);
      setIsLoadingReview(false);
      setReviewError('');
    }

    return data;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchReviewQueue(reviewPage);
        if (cancelled) return;
        setReviewData(data);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : t('Unable to load submissions.', 'Impossible de charger les soumissions.');
        setReviewError(message);
        setReviewData((prev) => ({ ...prev, groups: [], totalGroups: 0, totalPages: 1, page: 1 }));
        setIsLoadingReview(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reviewPage, riskFilter, userFilter]);

  useEffect(() => {
    if (reviewData.page >= reviewData.totalPages) return;
    void fetchReviewQueue(reviewData.page + 1, { background: true });
  }, [reviewData.page, reviewData.totalPages, riskFilter, userFilter]);

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
    if (activeMode !== 'assignments' && activeMode !== 'automation') return;

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
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : t('Unable to load assignments.', 'Impossible de charger les affectations.');
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
  }, [activeMode, assignmentAgentFilter, assignmentStatusFilter]);

  useEffect(() => {
    if (activeMode !== 'automation') return;

    let cancelled = false;

    const loadAutomationLeads = async () => {
      try {
        setIsLoadingAutomationLeads(true);
        setAutomationLeadError('');
        const params = new URLSearchParams();
        if (automationStatusFilter) params.set('status', automationStatusFilter);
        if (automationPriorityFilter) params.set('priority', automationPriorityFilter);
        if (automationCategoryFilter) params.set('category', automationCategoryFilter);
        if (automationSourceFilter.trim()) params.set('sourceSystem', automationSourceFilter.trim());
        params.set('limit', String(AUTOMATION_LEADS_PAGE_SIZE));
        if (automationLeadsOffset > 0) params.set('offset', String(automationLeadsOffset));
        const data = await apiJson<LeadCandidate[]>(`/api/intake/leads?${params.toString()}`);
        if (cancelled) return;
        const newLeads = Array.isArray(data) ? data : [];
        if (automationLeadsOffset === 0) {
          setAutomationLeads(newLeads);
        } else {
          setAutomationLeads((prev) => [...prev, ...newLeads]);
        }
        setHasMoreAutomationLeads(newLeads.length === AUTOMATION_LEADS_PAGE_SIZE);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : t('Unable to load automation leads.', 'Impossible de charger les leads automatisés.');
        setAutomationLeadError(message);
        if (automationLeadsOffset === 0) setAutomationLeads([]);
        setHasMoreAutomationLeads(false);
      } finally {
        if (!cancelled) setIsLoadingAutomationLeads(false);
      }
    };

    void loadAutomationLeads();
    return () => {
      cancelled = true;
    };
  }, [activeMode, automationStatusFilter, automationPriorityFilter, automationCategoryFilter, automationSourceFilter, automationLeadsOffset]);

  useEffect(() => {
    setSelectedForBulk((prev) => new Set([...prev].filter((id) => reviewData.groups.some((group) => group.pointId === id))));
  }, [reviewData.groups]);

  useEffect(() => {
    setSelectedAutomationLeadIds((prev) => new Set([...prev].filter((id) => automationLeads.some((lead) => lead.id === id))));
  }, [automationLeads]);

  useEffect(() => {
    if (reviewData.groups.length === 0) {
      if (selectedPointId !== null) setSelectedPointId(null);
      return;
    }

    if (!selectedPointId || !reviewData.groups.some((group) => group.pointId === selectedPointId)) {
      setSelectedPointId(reviewData.groups[0]?.pointId ?? null);
    }
  }, [reviewData.groups, selectedPointId]);

  useEffect(() => {
    setDeleteError('');
    setActionMessage('');
  }, [selectedPointId]);

  useEffect(() => {
    if (activeMode !== 'review' || reviewData.groups.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
        || target?.isContentEditable === true;

      if (isTypingTarget) return;

      const currentIndex = reviewData.groups.findIndex((group) => group.pointId === selectedPointId);
      const selected = currentIndex >= 0 ? reviewData.groups[currentIndex] : null;
      const key = event.key.toLowerCase();

      if (key === 'j') {
        event.preventDefault();
        const next = reviewData.groups[Math.min(reviewData.groups.length - 1, Math.max(0, currentIndex + 1))];
        if (next) {
          runViewTransition(() => {
            setSelectedPointId(next.pointId);
          });
        }
      }

      if (key === 'k') {
        event.preventDefault();
        const previous = reviewData.groups[Math.max(0, currentIndex - 1)];
        if (previous) {
          runViewTransition(() => {
            setSelectedPointId(previous.pointId);
          });
        }
      }

      if (key === '[' && reviewData.page > 1) {
        event.preventDefault();
        runViewTransition(() => {
          setReviewPage((prev) => Math.max(1, prev - 1));
        });
      }

      if (key === ']' && reviewData.page < reviewData.totalPages) {
        event.preventDefault();
        runViewTransition(() => {
          setReviewPage((prev) => Math.min(reviewData.totalPages, prev + 1));
        });
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
  }, [activeMode, isApplyingDecision, reviewData.groups, reviewData.page, reviewData.totalPages, selectedPointId]);

  const togglePlannerVertical = (vertical: SubmissionCategory) => {
    setPlannerVerticals((prev) => {
      if (prev.includes(vertical)) return prev.filter((item) => item !== vertical);
      return [...prev, vertical];
    });
  };

  const applyReviewToLocalState = (eventId: string, decision: ReviewDecision) => {
    setReviewData((prev) => {
      const updatedEvents = prev.groups.flatMap((group) =>
        group.events.map((item) => {
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

      return {
        ...prev,
        groups: buildAdminSubmissionGroups(updatedEvents),
      };
    });
  };

  const handleDeleteSelected = async () => {
    if (!selectedGroup) return;
    const hasReadOnly = selectedGroup.events.some(isReadOnlySubmission);
    if (hasReadOnly) {
      setDeleteError(t('This point contains read-only events that cannot be deleted.', 'Ce point contient des événements en lecture seule qui ne peuvent pas être supprimés.'));
      return;
    }

    const eventCount = selectedGroup.events.length;
    const confirmed = window.confirm(
      eventCount > 1
        ? t(`Delete all ${eventCount} events for this point permanently?`, `Supprimer définitivement les ${eventCount} événements de ce point ?`)
        : t('Delete this submission event permanently?', 'Supprimer définitivement cet événement de soumission ?'),
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError('');
    setActionMessage('');
    try {
      for (const event of selectedGroup.events) {
        const response = await apiFetch(`/api/submissions/${encodeURIComponent(event.event.id)}?view=event`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const message = (await response.text()) || t('Unable to delete submission.', 'Impossible de supprimer la soumission.');
          setDeleteError(message);
          return;
        }
      }

      reviewCacheRef.current.clear();
      await fetchReviewQueue(reviewPage, { force: true });
      setActionMessage(t('Point deleted successfully.', 'Point supprimé avec succès.'));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Unable to delete submission.', 'Impossible de supprimer la soumission.');
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReviewDecision = async (group: AdminSubmissionGroup, decision: ReviewDecision) => {
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
      reviewCacheRef.current.clear();
      void fetchReviewQueue(reviewPage, { force: true, background: true });
      setActionMessage(
        decision === 'approved'
          ? t('Latest event approved.', 'Dernier événement approuvé.')
          : decision === 'rejected'
            ? t('Latest event rejected.', 'Dernier événement rejeté.')
            : t('Latest event put on hold.', 'Dernier événement mis en attente.'),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("Unable to apply review decision.", "Impossible d'appliquer la décision.");
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

  const selectAllEligible = () => {
    const eligibleIds = eligibleGroups.map((group) => group.pointId);
    setSelectedForBulk((prev) => {
      const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(eligibleIds);
    });
  };

  const handleBulkApprove = async () => {
    if (isApplyingDecision) return;

    const targetGroups =
      selectedForBulk.size > 0
        ? reviewData.groups.filter(
            (group) => selectedForBulk.has(group.pointId) && group.summary.reviewStatus === 'pending_review',
          )
        : eligibleGroups;

    if (targetGroups.length === 0) {
      setActionMessage(t('No pending groups to approve.', 'Aucun groupe en attente à approuver.'));
      return;
    }

    const confirmed = window.confirm(
      t(`Approve ${targetGroups.length} visible submissions?`, `Approuver ${targetGroups.length} soumissions visibles ?`),
    );
    if (!confirmed) return;

    setActionMessage('');
    setDeleteError('');
    try {
      setIsApplyingDecision(true);
      const eventIds = targetGroups.map((group) => group.latestEvent.event.id);
      const response = await apiJson<{
        results: Array<{ eventId: string; decision: ReviewDecision; status: 'ok' | 'error'; error?: string }>;
      }>('/api/submissions/batch-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds, decision: 'approved' }),
      });

      const groupNameByEventId = new Map(
        targetGroups.map((group) => [group.latestEvent.event.id, group.siteName ?? unnamedLabel] as const),
      );
      let okCount = 0;
      const failedNames: string[] = [];

      for (const result of response.results ?? []) {
        if (result.status === 'ok') {
          applyReviewToLocalState(result.eventId, 'approved');
          okCount += 1;
          continue;
        }
        const siteName = groupNameByEventId.get(result.eventId);
        if (siteName) failedNames.push(siteName);
      }

      reviewCacheRef.current.clear();
      void fetchReviewQueue(reviewPage, { force: true, background: true });
      setSelectedForBulk(new Set());

      if (failedNames.length === 0) {
        setActionMessage(t(`${okCount} group(s) approved.`, `${okCount} groupe(s) approuvés.`));
      } else {
        setActionMessage(
          t(
            `${okCount} approved, ${failedNames.length} failed. Failed: ${failedNames.join(', ')}`,
            `${okCount} approuvés, ${failedNames.length} échecs. Échecs : ${failedNames.join(', ')}`,
          ),
        );
      }
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("Unable to create assignment.", "Impossible de créer l'affectation.");
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
        t(
          `${selectedAutomationLeads.length} automation lead(s) rejected.`,
          `${selectedAutomationLeads.length} lead(s) automatisés rejetés.`,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('Unable to reject automation leads.', 'Impossible de rejeter les leads automatisés.');
      setAutomationLeadError(message);
    } finally {
      setIsApplyingAutomationAction(false);
    }
  };

  const handlePromoteToImportCandidate = async (lead: LeadCandidate) => {
    if (isApplyingAutomationAction) return;
    try {
      setIsApplyingAutomationAction(true);
      setAutomationLeadError('');
      const updated = await apiJson<LeadCandidate>(`/api/intake/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote_to_import_candidate' }),
      });
      setAutomationLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setAutomationLeadMessage(t('Lead marked as import candidate.', "Lead marqué comme candidat à l'import."));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Unable to promote lead.', 'Impossible de promouvoir le lead.');
      setAutomationLeadError(message);
    } finally {
      setIsApplyingAutomationAction(false);
    }
  };

  const handleCreateAssignmentFromAutomationLeads = async () => {
    if (isApplyingAutomationAction || isCreatingAssignment) return;
    if (!plannerAgent) {
      setAutomationLeadError(t('Select an assignment owner first.', "Sélectionnez d'abord un responsable."));
      return;
    }
    if (!plannerDueDate) {
      setAutomationLeadError(t('Select a due date first.', "Sélectionnez d'abord une date limite."));
      return;
    }
    if (selectedAutomationLeads.length === 0) {
      setAutomationLeadMessage(t('Select at least one automation lead.', 'Sélectionnez au moins un lead automatisé.'));
      return;
    }

    const actionable = selectedAutomationLeads.filter((lead) => lead.zoneId);
    if (actionable.length !== selectedAutomationLeads.length) {
      setAutomationLeadError(
        t(
          'Selected leads must all be within a known collection zone.',
          'Les leads sélectionnés doivent tous appartenir à une zone de collecte connue.',
        ),
      );
      return;
    }

    const zoneIds = Array.from(new Set(actionable.map((lead) => lead.zoneId)));
    if (zoneIds.length !== 1 || !zoneIds[0]) {
      setAutomationLeadError(t('Select leads from a single zone.', "Sélectionnez des leads provenant d'une seule zone."));
      return;
    }

    const assignedVerticals = Array.from(new Set(actionable.map((lead) => lead.category)));
    const sources = Array.from(new Set(actionable.map((lead) => lead.sourceSystem)));
    const leadIds = actionable.map((lead) => lead.id).join(', ');
    const notes = [`Automation leads: ${actionable.length}`, `Sources: ${sources.join(', ')}`, `Lead IDs: ${leadIds}`]
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
          // Keep the assignment if lead patching partially fails.
        }
      }

      setAssignments((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setSelectedAutomationLeadIds(new Set());
      setAutomationLeadMessage(
        patchedIds.size === actionable.length
          ? t('Assignment created from automation leads.', 'Affectation créée à partir des leads automatisés.')
          : t(
              'Assignment created. Some lead statuses need a manual refresh.',
              'Affectation créée. Certains statuts de lead doivent être rafraîchis manuellement.',
            ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("Unable to create assignment from leads.", "Impossible de créer une affectation depuis les leads.");
      setAutomationLeadError(message);
    } finally {
      setIsApplyingAutomationAction(false);
      setIsCreatingAssignment(false);
    }
  };

  const openMode = (mode: AdminMode) => {
    runViewTransition(() => {
      setActiveMode(mode);
    });
  };

  const changeRiskFilter = (nextFilter: AdminRiskFilter) => {
    reviewCacheRef.current.clear();
    runViewTransition(() => {
      setRiskFilter(nextFilter);
      setReviewPage(1);
      setSelectedForBulk(new Set());
    });
  };

  const changeUserFilter = (nextUserFilter: string) => {
    reviewCacheRef.current.clear();
    runViewTransition(() => {
      setUserFilter(nextUserFilter);
      setReviewPage(1);
      setSelectedForBulk(new Set());
    });
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > reviewData.totalPages || page === reviewPage) return;
    runViewTransition(() => {
      setReviewPage(page);
    });
  };

  const selectPoint = (pointId: string) => {
    runViewTransition(() => {
      setSelectedPointId(pointId);
    });
  };

  return (
    <div
      data-testid="screen-admin-queue"
      className="flex flex-col h-full bg-page overflow-y-auto overflow-x-hidden no-scrollbar"
      style={{ scrollPaddingBottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 1rem)' }}
    >
      <div className="sticky top-0 z-30 bg-ink text-white px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className={`p-2 -ml-2 hover:text-terra transition-colors ${focusRingClass}`} aria-label={t('Go back', 'Retour')}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xs font-bold uppercase tracking-[0.2em]">{t('Submission Forensics', 'Analyse forensique')}</h1>
        <ShieldCheck size={18} className="text-terra" />
      </div>

      <div className="p-4 pb-24 space-y-4">
        <div className="card p-2">
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={t('Admin workspace modes', 'Modes de travail admin')}>
            {([
              ['review', t('Review cockpit', 'Cockpit revue')],
              ['assignments', t('Assignments', 'Affectations')],
              ['automation', t('Automation', 'Automatisation')],
            ] as Array<[AdminMode, string]>).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={activeMode === mode}
                onClick={() => openMode(mode)}
                className={`h-11 rounded-2xl px-2 sm:px-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest transition-all ${focusRingClass} ${
                  activeMode === mode ? 'bg-navy text-white shadow-sm' : 'bg-page text-gray-600 border border-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeMode === 'review' && (
          <>
            <div className="card route-grid-soft p-4 space-y-4 overflow-hidden">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="micro-label-wide text-navy">{t('Review cockpit', 'Cockpit de revue')}</div>
                  <div className="text-lg font-bold text-ink-dark">
                    {reviewData.totalGroups} {t('groups in scope', 'groupes dans le périmètre')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {t('Server-filtered risk queue with page-level forensics and keyboard review commands.', 'File de risque filtrée côté serveur avec forensics par page et commandes clavier.')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(reviewData.page - 1)}
                    disabled={reviewData.page <= 1}
                    className={`h-10 w-10 rounded-2xl border ${focusRingClass} ${
                      reviewData.page <= 1 ? 'bg-gray-100 text-gray-300 border-gray-100' : 'bg-white text-navy border-gray-100'
                    }`}
                    aria-label={t('Previous review page', 'Page précédente')}
                  >
                    <ChevronLeft size={16} className="mx-auto" />
                  </button>
                  <div className="rounded-2xl bg-white/85 border border-white px-2 sm:px-3 py-2 text-center min-w-[80px] sm:min-w-[110px]">
                    <div className="micro-label text-gray-400">{t('Page window', 'Fenêtre page')}</div>
                    <div className="text-sm font-bold text-gray-900">{selectedPageLabel}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToPage(reviewData.page + 1)}
                    disabled={reviewData.page >= reviewData.totalPages}
                    className={`h-10 w-10 rounded-2xl border ${focusRingClass} ${
                      reviewData.page >= reviewData.totalPages ? 'bg-gray-100 text-gray-300 border-gray-100' : 'bg-white text-navy border-gray-100'
                    }`}
                    aria-label={t('Next review page', 'Page suivante')}
                  >
                    <ChevronRight size={16} className="mx-auto" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="rounded-2xl bg-white/90 border border-white p-3">
                  <div className="micro-label text-gray-400">{t('Flagged', 'Signalés')}</div>
                  <div className="mt-1 text-xl font-bold text-terra">{reviewData.stats.flagged}</div>
                </div>
                <div className="rounded-2xl bg-white/90 border border-white p-3">
                  <div className="micro-label text-gray-400">{t('Pending', 'En attente')}</div>
                  <div className="mt-1 text-xl font-bold text-amber-700">{reviewData.stats.pending}</div>
                </div>
                <div className="rounded-2xl bg-white/90 border border-white p-3">
                  <div className="micro-label text-gray-400">{t('Low risk', 'Faible risque')}</div>
                  <div className="mt-1 text-xl font-bold text-forest">{reviewData.stats.lowRisk}</div>
                </div>
                <div className="rounded-2xl bg-white/90 border border-white p-3">
                  <div className="micro-label text-gray-400">{t('Eligible now', 'Éligibles')}</div>
                  <div className="mt-1 text-xl font-bold text-navy">{reviewData.stats.eligible}</div>
                </div>
                <div className="rounded-2xl bg-white/90 border border-white p-3">
                  <div className="micro-label text-gray-400">{t('Visible page', 'Page visible')}</div>
                  <div className="mt-1 text-xl font-bold text-gray-900">{reviewData.groups.length}</div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-white bg-white/90 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllEligible}
                      className={`h-10 rounded-2xl px-3 micro-label bg-gray-50 text-gray-600 border border-gray-100 ${focusRingClass}`}
                    >
                      {t('Select eligible', 'Sélectionner éligibles')}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkApprove}
                      disabled={isApplyingDecision}
                      className={`h-10 rounded-2xl px-4 micro-label ${focusRingClass} ${
                        isApplyingDecision ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
                      }`}
                    >
                      {isApplyingDecision
                        ? t('Approving...', 'Approbation...')
                        : selectedForBulk.size > 0
                          ? `${t('Approve selected', 'Approuver sélection')} (${selectedForBulk.size})`
                          : `${t('Approve eligible', 'Approuver éligibles')} (${eligibleGroups.length})`}
                    </button>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {t('Keyboard', 'Clavier')}: J/K {t('move', 'parcourir')} • A {t('approve', 'approuver')} • R {t('reject', 'rejeter')} • H {t('hold', 'mettre en attente')} • [ ] {t('pages', 'pages')}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {([
                    ['all', `${t('All', 'Tous')} (${reviewData.stats.all})`],
                    ['flagged', `${t('Flagged', 'Signalés')} (${reviewData.stats.flagged})`],
                    ['pending', `${t('Pending', 'En attente')} (${reviewData.stats.pending})`],
                    ['low_risk', `${t('Low risk', 'Faible risque')} (${reviewData.stats.lowRisk})`],
                  ] as Array<[AdminRiskFilter, string]>).map(([filter, label]) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => changeRiskFilter(filter)}
                      className={`h-10 rounded-xl border micro-label ${focusRingClass} ${
                        riskFilter === filter ? 'bg-navy text-white border-navy' : 'bg-page text-gray-600 border-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),220px] gap-2">
                  <div className="rounded-2xl border border-gray-100 bg-page px-3 py-2 text-[11px] text-gray-600 flex items-center gap-2">
                    <Clock3 size={14} className="text-gray-400 shrink-0" />
                    <span>{t('Visible rows already include adjacent detail records, and the next page is prefetched in the background.', 'Les lignes visibles incluent déjà les détails adjacents, et la page suivante est préchargée en arrière-plan.')}</span>
                  </div>
                  <select
                    value={userFilter}
                    onChange={(event) => changeUserFilter(event.target.value)}
                    className={`h-10 rounded-xl border micro-label bg-page text-gray-600 border-gray-100 px-3 ${focusRingClass}`}
                    aria-label={t('Filter by reviewer', 'Filtrer par relecteur')}
                  >
                    <option value="">{t('All agents', 'Tous les agents')}</option>
                    {reviewData.reviewers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedGroup && (
                <div
                  className="rounded-2xl border border-white bg-ink text-white p-4 space-y-3"
                  style={{ viewTransitionName: `admin-review-point-${selectedGroup.pointId}` }}
                >
                  <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="micro-label-wide text-white/65">{t('Selected triage strip', 'Bandeau triage')}</div>
                      <div className="text-lg font-bold">{selectedGroup.siteName ?? unnamedLabel}</div>
                    </div>
                    <div className="text-xs text-white/70">
                      {categoryLabelLocal(selectedGroup.category, language)} • {reviewStatusLabel(selectedGroup.summary.reviewStatus, language)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 micro-label ${trustTierClass(selectedGroup.summary.trustTier)}`}>
                      {t('Trust', 'Confiance')}: {trustTierLabel(selectedGroup.summary.trustTier, language)}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 micro-label">
                      {t('Evidence', 'Preuves')}: {selectedGroup.summary.evidenceCount}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 micro-label">
                      {t('Age', 'Âge')}: {formatAgeFromHours(selectedGroup.summary.staleHours, language)}
                    </span>
                    <span className={`rounded-full border px-3 py-1 micro-label ${selectedGroup.summary.hasSubmissionMismatch ? 'border-terra/40 bg-terra/15 text-white' : 'border-white/15 bg-white/10 text-white'}`}>
                      {t('Submission gap', 'Écart GPS')}: {formatDistance(selectedGroup.summary.submissionDistanceKm, unavailableLabel)}
                    </span>
                    <span className={`rounded-full border px-3 py-1 micro-label ${selectedGroup.summary.hasIpMismatch ? 'border-terra/40 bg-terra/15 text-white' : 'border-white/15 bg-white/10 text-white'}`}>
                      {t('IP drift', 'Dérive IP')}: {formatDistance(selectedGroup.summary.ipDistanceKm, unavailableLabel)}
                    </span>
                    {selectedGroup.summary.isLowEndDevice && (
                      <span className="rounded-full border border-gold/40 bg-gold/20 px-3 py-1 micro-label text-white">
                        {t('Low-end device', 'Appareil entrée de gamme')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {schemaGuard?.ok === false && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                <div className="micro-label text-amber-700">{t('Schema guard warning', 'Alerte garde schéma')}</div>
                {schemaGuard.missing.length > 0 && (
                  <div className="text-xs text-amber-800">
                    {t('Missing categories:', 'Catégories manquantes :')} {schemaGuard.missing.map((value) => getCategoryLabel(value as SubmissionCategory, language)).join(', ')}
                  </div>
                )}
                {schemaGuard.extra.length > 0 && (
                  <div className="text-xs text-amber-800">
                    {t('Unexpected categories:', 'Catégories inattendues :')} {schemaGuard.extra.join(', ')}
                  </div>
                )}
                {schemaGuard.reason && <div className="text-[11px] text-amber-700">{schemaGuard.reason}</div>}
              </div>
            )}

            {syncErrors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 text-red-700">
                    <AlertTriangle size={14} />
                    <span className="micro-label">
                      {t('Local sync errors', 'Erreurs locales de synchronisation')} ({syncErrors.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSyncErrors}
                    disabled={isClearingSyncErrors}
                    className={`micro-label ${focusRingClass} ${isClearingSyncErrors ? 'text-red-300' : 'text-red-700'}`}
                  >
                    {isClearingSyncErrors ? t('Clearing...', 'Suppression...') : t('Clear', 'Effacer')}
                  </button>
                </div>
                <div className="text-xs text-red-700">
                  {syncErrors[0]?.message ?? t('Unknown sync error.', 'Erreur de synchronisation inconnue.')}
                </div>
              </div>
            )}

            {actionMessage && (
              <div className="bg-forest-wash border border-forest-wash rounded-2xl p-4 text-xs text-forest" aria-live="polite">
                {actionMessage}
              </div>
            )}

            {deleteError && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600" aria-live="assertive">
                {deleteError}
              </div>
            )}

            {reviewError && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600" aria-live="assertive">
                {reviewError}
              </div>
            )}

            <div className="space-y-4 lg:grid lg:grid-cols-[360px,minmax(0,1fr)] lg:gap-4 lg:space-y-0">
              <div
                data-testid="admin-review-queue"
                className="order-2 lg:order-1 space-y-3"
                role="listbox"
                aria-label={t('Review queue', 'File de revue')}
                aria-busy={isLoadingReview}
              >
                {isLoadingReview && (
                  <div className="card p-5 text-xs text-gray-500">{t('Loading review queue...', 'Chargement de la file de revue...')}</div>
                )}

                {!isLoadingReview && reviewData.groups.length === 0 && (
                  <div className="card p-6 text-xs text-gray-500 text-center">
                    {t('No submissions match the current filters.', 'Aucune soumission ne correspond aux filtres actuels.')}
                  </div>
                )}

                {!isLoadingReview &&
                  reviewData.groups.map((group) => {
                    const isSelected = selectedPointId === group.pointId;
                    const preview = group.allPhotos[0]?.url ?? null;
                    const contributors = [...new Set(group.events.map((event) => event.user.name))];
                    const gpsChipTone = group.summary.hasSubmissionMismatch ? 'bg-terra-wash text-terra border-terra-wash' : 'bg-gray-100 text-gray-600 border-gray-200';
                    const ipChipTone = group.summary.hasIpMismatch ? 'bg-terra-wash text-terra border-terra-wash' : 'bg-gray-100 text-gray-600 border-gray-200';

                    return (
                      <div
                        key={group.pointId}
                        role="option"
                        aria-selected={isSelected}
                        className={`card border-l-4 ${queueAccentClass(group)} ${isSelected ? 'ring-2 ring-navy ring-offset-2 ring-offset-page' : ''}`}
                      >
                        <div className="flex gap-3 p-3">
                          <div className="flex items-start pt-1">
                            <input
                              type="checkbox"
                              checked={selectedForBulk.has(group.pointId)}
                              onChange={() => toggleBulkItem(group.pointId)}
                              className={`h-4 w-4 rounded border-gray-300 text-navy ${focusRingClass}`}
                              aria-label={t('Select group for bulk approval', 'Sélectionner le groupe pour approbation en lot')}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => selectPoint(group.pointId)}
                            className={`flex flex-1 gap-3 text-left ${focusRingClass}`}
                            style={isSelected ? { viewTransitionName: `admin-review-point-${group.pointId}` } : undefined}
                          >
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                              {preview ? (
                                <img src={preview} alt={t('submission', 'soumission')} className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <Camera size={18} className="text-gray-300" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-gray-900 truncate">{group.siteName ?? unnamedLabel}</div>
                                  <div className="text-[11px] text-gray-500">
                                    {categoryLabelLocal(group.category, language)} • {reviewStatusLabel(group.summary.reviewStatus, language)}
                                  </div>
                                </div>
                                <span className={`micro-label px-2 py-1 rounded-lg border ${matchStateClass(getMatchState(group.latestEvent.fraudCheck))}`}>
                                  {matchStateLabel(getMatchState(group.latestEvent.fraudCheck), language)}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <span className={`rounded-full border px-2 py-1 micro-label ${trustTierClass(group.summary.trustTier)}`}>
                                  {trustTierLabel(group.summary.trustTier, language)}
                                </span>
                                <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 micro-label text-gray-600">
                                  {t('Risk', 'Risque')} {group.summary.riskScore}
                                </span>
                                <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 micro-label text-gray-600">
                                  {t('Evidence', 'Preuves')} {group.summary.evidenceCount}
                                </span>
                                <span className={`rounded-full border px-2 py-1 micro-label ${gpsChipTone}`}>
                                  {t('GPS', 'GPS')} {formatDistance(group.summary.submissionDistanceKm, unavailableLabel)}
                                </span>
                                <span className={`rounded-full border px-2 py-1 micro-label ${ipChipTone}`}>
                                  {t('IP', 'IP')} {formatDistance(group.summary.ipDistanceKm, unavailableLabel)}
                                </span>
                                <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 micro-label text-gray-600">
                                  {t('Age', 'Âge')} {formatAgeFromHours(group.summary.staleHours, language)}
                                </span>
                                {group.summary.isLowEndDevice && (
                                  <span className="rounded-full border border-gold-wash bg-gold-wash px-2 py-1 micro-label text-amber-700">
                                    {t('Low-end', 'Entrée de gamme')}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-3 text-[11px] text-gray-500">
                                <div className="flex items-center gap-1 min-w-0">
                                  <Users size={12} className="shrink-0" />
                                  <span className="truncate">{contributors.join(', ')}</span>
                                </div>
                                <span className="shrink-0">{formatDate(group.latestEvent.event.createdAt, unavailableLabel, language)}</span>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {!isLoadingReview && reviewData.totalPages > 1 && (
                  <div className="card p-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => goToPage(reviewData.page - 1)}
                      disabled={reviewData.page <= 1}
                      className={`h-10 rounded-2xl px-3 micro-label border ${focusRingClass} ${
                        reviewData.page <= 1 ? 'bg-gray-100 text-gray-300 border-gray-100' : 'bg-white text-navy border-gray-100'
                      }`}
                    >
                      {t('Previous', 'Précédent')}
                    </button>
                    <div className="text-xs text-gray-500">
                      {t('Page', 'Page')} {reviewData.page} / {reviewData.totalPages}
                    </div>
                    <button
                      type="button"
                      onClick={() => goToPage(reviewData.page + 1)}
                      disabled={reviewData.page >= reviewData.totalPages}
                      className={`h-10 rounded-2xl px-3 micro-label border ${focusRingClass} ${
                        reviewData.page >= reviewData.totalPages ? 'bg-gray-100 text-gray-300 border-gray-100' : 'bg-white text-navy border-gray-100'
                      }`}
                    >
                      {t('Next', 'Suivant')}
                    </button>
                  </div>
                )}
              </div>

              <div className="order-1 lg:order-2">
                {!isLoadingReview && selectedGroup && (() => {
                  const hasReadOnly = selectedGroup.events.some(isReadOnlySubmission);
                  const latestFraudCheck = selectedGroup.latestEvent.fraudCheck ?? null;
                  const latestDevice = getClientDevice({ details: selectedGroup.latestEvent.event.details as SubmissionDetails });
                  const contributors = [...new Map(selectedGroup.events.map((event) => [event.user.id, event.user])).values()];

                  return (
                    <div
                      className="card p-4 space-y-4"
                      style={{ viewTransitionName: `admin-review-point-${selectedGroup.pointId}` }}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="micro-label-wide text-gray-400">{t('Point detail', 'Détail du point')}</div>
                          <h2 id="admin-review-detail-title" className="mt-1 text-xl font-bold text-gray-900">
                            {selectedGroup.siteName ?? unnamedLabel}
                          </h2>
                          <div className="mt-1 text-xs text-gray-500">
                            {categoryLabelLocal(selectedGroup.category, language)} • {reviewStatusLabel(selectedGroup.summary.reviewStatus, language)} • {selectedGroup.pointId}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedPointId(null)}
                          className={`h-10 w-10 rounded-full border border-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center ${focusRingClass}`}
                          aria-label={t('Clear selection', 'Annuler la sélection')}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 micro-label ${trustTierClass(selectedGroup.summary.trustTier)}`}>
                          {t('Trust', 'Confiance')}: {trustTierLabel(selectedGroup.summary.trustTier, language)}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 micro-label text-gray-600">
                          {t('Risk score', 'Score risque')}: {selectedGroup.summary.riskScore}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 micro-label text-gray-600">
                          {t('Evidence', 'Preuves')}: {selectedGroup.summary.evidenceCount}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 micro-label text-gray-600">
                          {t('Age', 'Âge')}: {formatAgeFromHours(selectedGroup.summary.staleHours, language)}
                        </span>
                        <span className={`rounded-full border px-3 py-1 micro-label ${selectedGroup.summary.hasSubmissionMismatch ? 'bg-terra-wash text-terra border-terra-wash' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {t('Submission gap', 'Écart GPS')}: {formatDistance(selectedGroup.summary.submissionDistanceKm, unavailableLabel)}
                        </span>
                        <span className={`rounded-full border px-3 py-1 micro-label ${selectedGroup.summary.hasIpMismatch ? 'bg-terra-wash text-terra border-terra-wash' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {t('IP drift', 'Dérive IP')}: {formatDistance(selectedGroup.summary.ipDistanceKm, unavailableLabel)}
                        </span>
                        {selectedGroup.summary.isLowEndDevice && (
                          <span className="rounded-full border border-gold-wash bg-gold-wash px-3 py-1 micro-label text-amber-700">
                            {t('Low-end device', 'Appareil entrée de gamme')}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2" aria-label={t('Review actions', 'Actions de revue')}>
                        <button
                          type="button"
                          onClick={() => void handleReviewDecision(selectedGroup, 'approved')}
                          disabled={isApplyingDecision}
                          className={`h-10 px-3 rounded-xl micro-label ${focusRingClass} ${
                            isApplyingDecision ? 'bg-gray-100 text-gray-400' : 'bg-forest-wash text-forest'
                          }`}
                        >
                          {t('Approve', 'Approuver')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReviewDecision(selectedGroup, 'flagged')}
                          disabled={isApplyingDecision}
                          className={`h-10 px-3 rounded-xl micro-label ${focusRingClass} ${
                            isApplyingDecision ? 'bg-gray-100 text-gray-400' : 'bg-terra-wash text-terra'
                          }`}
                        >
                          {t('Hold', 'Mettre en attente')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReviewDecision(selectedGroup, 'rejected')}
                          disabled={isApplyingDecision}
                          className={`h-10 px-3 rounded-xl micro-label ${focusRingClass} ${
                            isApplyingDecision ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {t('Reject', 'Rejeter')}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteSelected}
                          disabled={isDeleting || hasReadOnly}
                          className={`h-10 px-3 rounded-xl micro-label flex items-center space-x-2 ${focusRingClass} ${
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

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 text-[11px]" aria-labelledby="admin-review-detail-title">
                        <div className="rounded-2xl border border-gray-100 p-3 space-y-2">
                          <div className="micro-label text-gray-400">{t('Contributors', 'Contributeurs')}</div>
                          {contributors.map((user) => (
                            <div key={user.id} className="flex items-start gap-2">
                              <ProfileAvatar preset={coerceAvatarPreset(user.avatarPreset)} alt={user.name} className="w-8 h-8 shrink-0" />
                              <div className="space-y-0.5">
                                <div className="text-gray-900 font-semibold">{user.name}</div>
                                <div className="text-gray-600">{user.email ?? unavailableLabel}</div>
                                <div className="text-[11px] text-gray-500">
                                  {t('Trust', 'Confiance')}: {typeof user.trustScore === 'number' ? user.trustScore : '--'} • {trustTierLabel(user.trustTier ?? null, language)}
                                </div>
                                {user.suspendedUntil && (
                                  <div className="text-[11px] text-terra-dark">
                                    {t('Suspended until', 'Suspendu jusqu’au')}: {formatDate(user.suspendedUntil, unavailableLabel, language)}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-3 space-y-1">
                          <div className="micro-label text-gray-400">{t('Point metadata', 'Métadonnées du point')}</div>
                          <div>{t('Category', 'Catégorie')}: {categoryLabelLocal(selectedGroup.category, language)}</div>
                          <div>Point ID: {selectedGroup.pointId}</div>
                          <div>{t('Events', 'Événements')}: {selectedGroup.events.length}</div>
                          <div>{t('Contributors', 'Contributeurs')}: {selectedGroup.summary.contributorCount}</div>
                          <div>{t('Review status', 'Statut revue')}: {reviewStatusLabel(selectedGroup.summary.reviewStatus, language)}</div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-3 space-y-2">
                          <div className="micro-label text-gray-400">{t('Geo risk timeline', 'Chronologie géo-risque')}</div>
                          {selectedGroup.events.map((event, index) => {
                            const device = getClientDevice({ details: event.event.details as SubmissionDetails });
                            return (
                              <div
                                key={event.event.id}
                                className={`p-2 rounded-xl ${index === selectedGroup.events.length - 1 ? 'bg-forest-wash border border-forest-wash' : 'bg-gray-50 border border-gray-100'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="micro-label text-navy">
                                    {event.event.eventType === 'CREATE_EVENT' ? t('Create', 'Création') : t('Enrich', 'Enrichissement')}
                                  </span>
                                  <span className="text-[11px] text-gray-500">{formatDate(event.event.createdAt, unavailableLabel, language)}</span>
                                </div>
                                <div className="text-gray-600 mt-1">{t('By', 'Par')}: {event.user.name}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className={`rounded-full border px-2 py-1 micro-label ${matchStateClass(getMatchState(event.fraudCheck))}`}>
                                    {matchStateLabel(getMatchState(event.fraudCheck), language)}
                                  </span>
                                  <span className="rounded-full border border-gray-200 bg-white px-2 py-1 micro-label text-gray-600">
                                    {formatDistance(event.fraudCheck?.primaryPhoto?.submissionDistanceKm ?? null, unavailableLabel)}
                                  </span>
                                  {device && (
                                    <span className="rounded-full border border-gray-200 bg-white px-2 py-1 micro-label text-gray-600">
                                      {device.platform ?? t('Unknown device', 'Appareil inconnu')}
                                    </span>
                                  )}
                                </div>
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
                          <div className="micro-label text-gray-400">{t('Client device', 'Appareil client')}</div>
                          <div>{t('Device ID', 'Device ID')}: {latestDevice?.deviceId ?? unavailableLabel}</div>
                          <div>{t('Platform', 'Plateforme')}: {latestDevice?.platform ?? unavailableLabel}</div>
                          <div>
                            {t('Low-end flag', 'Indicateur entrée de gamme')}:{' '}
                            {latestDevice ? (latestDevice.isLowEnd === true ? t('Yes', 'Oui') : t('No', 'Non')) : unavailableLabel}
                          </div>
                        </div>

                        <div className="xl:col-span-2 space-y-2">
                          <div className="micro-label text-gray-400">
                            {t('All photos', 'Toutes les photos')} ({selectedGroup.allPhotos.length})
                          </div>
                          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                            {selectedGroup.allPhotos.length === 0 && (
                              <div className="col-span-full rounded-2xl border border-gray-100 bg-gray-50 h-28 flex items-center justify-center">
                                <div className="micro-label text-gray-400 text-center px-2">
                                  {t('No photos available', 'Aucune photo disponible')}
                                </div>
                              </div>
                            )}
                            {selectedGroup.allPhotos.map((photo, index) => (
                              <div key={`${photo.url}-${index}`} className="space-y-1">
                                <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 h-28 flex items-center justify-center">
                                  <img src={photo.url} alt={`${t('Photo', 'Photo')} ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                                </div>
                                <div className="text-[11px] text-gray-500 text-center">{photo.eventType}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="xl:col-span-2 space-y-3">
                          <div className="micro-label text-gray-400">{t('Photo EXIF metadata', 'Métadonnées EXIF des photos')}</div>
                          {selectedGroup.allPhotos.length === 0 && <div className="text-[11px] text-gray-500">{unavailableLabel}</div>}
                          {selectedGroup.allPhotos.map((photo, index) => (
                            <DetailMetadataBlock
                              key={`${photo.url}-${index}`}
                              label={`${t('Photo', 'Photo')} ${index + 1} — ${photo.eventType}`}
                              metadata={photo.metadata}
                              thresholdKm={latestFraudCheck?.submissionMatchThresholdKm ?? 1}
                              unavailable={unavailableLabel}
                              language={language}
                            />
                          ))}
                          <div className="micro-label text-gray-400">
                            {t('IP match threshold', 'Seuil correspondance IP')}: {latestFraudCheck?.ipMatchThresholdKm ?? 50} km
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {!isLoadingReview && !selectedGroup && reviewData.groups.length > 0 && (
                  <div className="card p-8 items-center justify-center text-xs text-gray-400 min-h-[220px] flex">
                    {t('Select an item to view details', 'Sélectionnez un élément pour voir les détails')}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeMode === 'assignments' && (
          <div className="card p-4 space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="micro-label-wide text-navy">{t('Assignment planner', 'Planification des affectations')}</div>
                <div className="mt-1 text-sm text-gray-500">
                  {t('Keep collection work out of the review queue. Plan owners, zones, and expected output here.', 'Gardez la planification hors de la file de revue. Planifiez responsables, zones, et volume ici.')}
                </div>
              </div>
              <div className="text-xs text-gray-500">{assignments.length} {t('active assignments', 'affectations actives')}</div>
            </div>

            {assignmentActionMessage && (
              <div className="rounded-xl border border-forest-wash bg-forest-wash p-3 text-[11px] text-forest" aria-live="polite">
                {assignmentActionMessage}
              </div>
            )}

            {assignmentError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600" aria-live="assertive">
                {assignmentError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[220px,220px,1fr] gap-2">
              <select
                value={assignmentStatusFilter}
                onChange={(event) => setAssignmentStatusFilter((event.target.value as CollectionAssignment['status']) || '')}
                className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50 ${focusRingClass}`}
              >
                <option value="">{t('All statuses', 'Tous les statuts')}</option>
                {ASSIGNMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {assignmentStatusLabel(status, language)}
                  </option>
                ))}
              </select>
              <select
                value={assignmentAgentFilter}
                onChange={(event) => setAssignmentAgentFilter(event.target.value)}
                className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50 ${focusRingClass}`}
              >
                <option value="">{t('All agents', 'Tous les agents')}</option>
                {(assignmentContext?.agents ?? []).map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <div className="rounded-xl border border-gray-100 bg-page px-3 py-2 text-[11px] text-gray-600">
                {t('Assignments now load only when this mode is opened, keeping review load fast.', 'Les affectations se chargent seulement à l’ouverture de ce mode, pour garder la revue rapide.')}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-4 bg-page space-y-3">
              <div className="micro-label text-gray-500">{t('Create assignment', 'Créer une affectation')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <select
                  value={plannerAgent}
                  onChange={(event) => setPlannerAgent(event.target.value)}
                  className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white ${focusRingClass}`}
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
                  className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white ${focusRingClass}`}
                >
                  <option value="">{t('Select zone', 'Choisir zone')}</option>
                  {(assignmentContext?.zones ?? []).map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="date"
                  value={plannerDueDate}
                  onChange={(event) => setPlannerDueDate(event.target.value)}
                  className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white ${focusRingClass}`}
                />
                <input
                  type="number"
                  min={0}
                  value={plannerExpected}
                  onChange={(event) => setPlannerExpected(event.target.value)}
                  placeholder={t('Expected points', 'Points attendus')}
                  className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white ${focusRingClass}`}
                />
              </div>
              <input
                value={plannerNotes}
                onChange={(event) => setPlannerNotes(event.target.value)}
                placeholder={t('Optional notes', 'Notes optionnelles')}
                className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white ${focusRingClass}`}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ASSIGNABLE_VERTICALS.map((vertical) => {
                  const active = plannerVerticals.includes(vertical);
                  return (
                    <button
                      key={vertical}
                      type="button"
                      onClick={() => togglePlannerVertical(vertical)}
                      className={`h-9 rounded-xl border micro-label ${focusRingClass} ${
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
                className={`h-10 rounded-xl micro-label ${focusRingClass} ${
                  isCreatingAssignment ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white hover:bg-navy-mid'
                }`}
              >
                {isCreatingAssignment ? t('Creating...', 'Création...') : t('Create assignment', 'Créer affectation')}
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
                  <div key={assignment.id} className="rounded-2xl border border-gray-100 p-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{assignment.zoneLabel}</div>
                        <div className="text-[11px] text-gray-500">
                          {assignmentAgentNameById.get(assignment.agentUserId) ?? assignment.agentUserId}
                        </div>
                      </div>
                      <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 micro-label text-gray-600">
                        {assignmentStatusLabel(assignment.status, language)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-gray-600">
                      <div>{t('Progress', 'Progression')}: {assignment.pointsSubmitted}/{assignment.pointsExpected} ({assignment.completionRate}%)</div>
                      <div>{t('Due', 'Échéance')}: {formatDate(assignment.dueDate, unavailableLabel, language)}</div>
                      <div>{t('Verticals', 'Verticales')}: {assignment.assignedVerticals.map((vertical) => getCategoryLabel(vertical, language)).join(', ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeMode === 'automation' && (
          <div className="card p-4 space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="micro-label-wide text-navy">{t('Automation intake', 'Intake automatisé')}</div>
                <div className="mt-1 text-sm text-gray-500">
                  {t('Triage incoming machine-sourced leads, then hand off only the verified work to field owners.', 'Triez les leads automatiques, puis transmettez uniquement le travail vérifié aux agents terrain.')}
                </div>
              </div>
              <div className="text-xs text-gray-500">{automationLeads.length} {t('leads loaded', 'leads chargés')}</div>
            </div>

            {automationLeadMessage && (
              <div className="rounded-xl border border-forest-wash bg-forest-wash p-3 text-[11px] text-forest" aria-live="polite">
                {automationLeadMessage}
              </div>
            )}

            {automationLeadError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600" aria-live="assertive">
                {automationLeadError}
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 bg-page p-4 space-y-3">
              <div className="micro-label text-gray-500">{t('Automation handoff rail', 'Rail de transfert')}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select
                  value={plannerAgent}
                  onChange={(event) => setPlannerAgent(event.target.value)}
                  className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white ${focusRingClass}`}
                >
                  <option value="">{t('Select owner', 'Choisir responsable')}</option>
                  {(assignmentContext?.agents ?? []).map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={plannerDueDate}
                  onChange={(event) => setPlannerDueDate(event.target.value)}
                  className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-white ${focusRingClass}`}
                />
                <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 text-[11px] text-gray-600">
                  {t('Selected leads: ', 'Leads sélectionnés : ')}{selectedAutomationLeadIds.size}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              <select
                value={automationStatusFilter}
                onChange={(event) => { setAutomationLeadsOffset(0); setAutomationStatusFilter(event.target.value as AutomationStatusFilter); }}
                className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50 ${focusRingClass}`}
              >
                <option value="">{t('All statuses', 'Tous les statuts')}</option>
                {AUTOMATION_LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {automationStatusLabel(status, language)}
                  </option>
                ))}
              </select>
              <select
                value={automationCategoryFilter}
                onChange={(event) => { setAutomationLeadsOffset(0); setAutomationCategoryFilter((event.target.value as SubmissionCategory) || ''); }}
                className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50 ${focusRingClass}`}
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
                onChange={(event) => { setAutomationLeadsOffset(0); setAutomationPriorityFilter((event.target.value as AutomationPriorityFilter) || ''); }}
                className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50 ${focusRingClass}`}
              >
                <option value="">{t('All priorities', 'Toutes les priorités')}</option>
                {AUTOMATION_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {automationPriorityLabel(priority, language)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={automationSourceFilter}
                onChange={(event) => { setAutomationLeadsOffset(0); setAutomationSourceFilter(event.target.value); }}
                placeholder={t('Source system', 'Système source')}
                className={`h-10 rounded-xl border border-gray-100 px-3 text-xs bg-gray-50 ${focusRingClass}`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCreateAssignmentFromAutomationLeads}
                disabled={isApplyingAutomationAction || isCreatingAssignment}
                className={`h-10 rounded-xl px-4 micro-label ${focusRingClass} ${
                  isApplyingAutomationAction || isCreatingAssignment ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
                }`}
              >
                {t('Create assignment from selection', 'Créer affectation depuis la sélection')}
              </button>
              <button
                type="button"
                onClick={handleRejectAutomationLeads}
                disabled={isApplyingAutomationAction}
                className={`h-10 rounded-xl px-4 micro-label ${focusRingClass} ${
                  isApplyingAutomationAction ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-600 border border-red-100'
                }`}
              >
                {t('Reject selection', 'Rejeter la sélection')}
              </button>
              {automationLeads.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = new Set(automationLeads.map((l) => l.id));
                    setSelectedAutomationLeadIds((prev) => {
                      const allSelected = automationLeads.every((l) => prev.has(l.id));
                      return allSelected ? new Set() : allIds;
                    });
                  }}
                  className={`h-10 rounded-xl px-4 micro-label border border-gray-200 bg-white text-gray-700 ${focusRingClass}`}
                >
                  {automationLeads.every((l) => selectedAutomationLeadIds.has(l.id))
                    ? t('Deselect all', 'Tout désélectionner')
                    : t('Select all visible', 'Tout sélectionner')}
                </button>
              )}
            </div>

            {isLoadingAutomationLeads && automationLeadsOffset === 0 ? (
              <div className="text-xs text-gray-500">{t('Loading automation leads...', 'Chargement des leads automatisés...')}</div>
            ) : automationLeads.length === 0 ? (
              <div className="rounded-xl border border-gray-100 bg-page p-3 text-xs text-gray-500">
                {t('No automation leads found.', 'Aucun lead automatisé trouvé.')}
              </div>
            ) : (
              <div className="space-y-2">
                {automationLeads.map((lead) => {
                  const isExpanded = expandedLeadId === lead.id;
                  const details = lead.normalizedDetails as SubmissionDetails;
                  const detailEntries = Object.entries(details).filter(([, v]) => v != null && v !== '');
                  return (
                    <div key={lead.id} className="rounded-2xl border border-gray-100 bg-page overflow-hidden">
                      <div className="p-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedAutomationLeadIds.has(lead.id)}
                            onChange={() => toggleAutomationLead(lead.id)}
                            className={`mt-1 h-4 w-4 rounded border-gray-300 text-navy ${focusRingClass}`}
                            aria-label={t('Select automation lead', 'Sélectionner le lead automatisé')}
                          />
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-gray-900 truncate">{getAutomationLeadName(lead, language)}</div>
                                <div className="micro-label text-gray-400">
                                  {getCategoryLabel(lead.category, language)} • {lead.sourceSystem}
                                </div>
                              </div>
                              <span className={`shrink-0 rounded-lg border px-2 py-1 micro-label ${automationStatusClass(lead.status)}`}>
                                {automationStatusLabel(lead.status, language)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-gray-600">
                              <div>{t('Zone', 'Zone')}: {lead.zoneId ?? unavailableLabel}</div>
                              <div>{t('Priority', 'Priorité')}: {automationPriorityLabel(lead.priority, language)}</div>
                              {lead.matchPointId && (
                                <div className="col-span-2 md:col-span-1">
                                  {t('Match', 'Correspond.')}:{' '}
                                  <span className="font-mono">{lead.matchPointId.slice(0, 8)}…</span>
                                  {' '}({typeof lead.matchConfidence === 'number' ? (lead.matchConfidence * 100).toFixed(0) : '--'}%)
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                                className={`text-[11px] text-navy underline ${focusRingClass}`}
                              >
                                {isExpanded ? t('Hide details', 'Masquer les détails') : t('Show details', 'Voir les détails')}
                              </button>
                              {lead.status === 'matched_existing' && (
                                <button
                                  type="button"
                                  onClick={() => handlePromoteToImportCandidate(lead)}
                                  disabled={isApplyingAutomationAction}
                                  className={`text-[11px] text-forest underline ${focusRingClass}`}
                                >
                                  {t('Mark for import', 'Marquer pour import')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-3 text-[11px] text-gray-700">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div><span className="font-semibold">{t('Coords', 'Coords')}:</span> {lead.location.latitude.toFixed(5)}, {lead.location.longitude.toFixed(5)}</div>
                            <div><span className="font-semibold">{t('Source ID', 'ID source')}:</span> {lead.sourceRecordId}</div>
                            {lead.freshnessAt && (
                              <div><span className="font-semibold">{t('Freshness', 'Fraîcheur')}:</span> {lead.freshnessAt.slice(0, 10)}</div>
                            )}
                            {lead.sourceUrl && (
                              <div className="col-span-2">
                                <span className="font-semibold">{t('Source URL', 'URL source')}:</span>{' '}
                                <a href={lead.sourceUrl} target="_blank" rel="noreferrer" className={`text-navy underline break-all ${focusRingClass}`}>{lead.sourceUrl}</a>
                              </div>
                            )}
                          </div>

                          {lead.evidenceUrls.length > 0 && (
                            <div>
                              <div className="micro-label text-gray-500 mb-1">{t('Evidence URLs', 'URLs de preuves')} ({lead.evidenceUrls.length})</div>
                              <div className="space-y-0.5">
                                {lead.evidenceUrls.map((url, i) => (
                                  <div key={i}>
                                    <a href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-navy underline break-all ${focusRingClass}`}>
                                      <MapPin size={10} />
                                      {url}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {detailEntries.length > 0 && (
                            <div>
                              <div className="micro-label text-gray-500 mb-1">{t('Normalized details', 'Détails normalisés')}</div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                {detailEntries.map(([k, v]) => (
                                  <div key={k}><span className="font-semibold">{k}:</span> {String(v)}</div>
                                ))}
                              </div>
                            </div>
                          )}

                          {Object.keys(lead.rawPayload).length > 0 && (
                            <div>
                              <div className="micro-label text-gray-500 mb-1">{t('Raw payload', 'Données brutes')}</div>
                              <pre className="bg-white border border-gray-100 rounded-lg p-2 text-[10px] text-gray-600 overflow-x-auto max-h-40 no-scrollbar">
                                {JSON.stringify(lead.rawPayload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(hasMoreAutomationLeads || isLoadingAutomationLeads) && (
                  <button
                    type="button"
                    onClick={() => setAutomationLeadsOffset((prev) => prev + AUTOMATION_LEADS_PAGE_SIZE)}
                    disabled={isLoadingAutomationLeads}
                    className={`w-full h-10 rounded-xl border border-gray-200 bg-white text-xs text-gray-600 ${focusRingClass} ${isLoadingAutomationLeads ? 'opacity-50' : ''}`}
                  >
                    {isLoadingAutomationLeads ? t('Loading…', 'Chargement…') : t('Load more', 'Charger plus')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface SchemaGuardStatus {
  ok: boolean | null;
  expected: string[];
  actual: string[];
  missing: string[];
  extra: string[];
  reason?: string;
}

export default AdminQueue;
