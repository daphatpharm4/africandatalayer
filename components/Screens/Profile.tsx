import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  Building2,
  Gift,
  Search,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  UserPlus,
  Wallet
} from 'lucide-react';
import { apiJson } from '../../lib/client/api';
import { broadcastAdminMapScope, readStoredAdminMapScope } from '../../lib/client/adminMapScope';
import { clearSyncErrorRecords, listQueueItems, listSyncErrorRecords, subscribeQueueSnapshot, type QueueItem, type SyncErrorRecord } from '../../lib/client/offlineQueue';
import type { CollectionAssignment, MapScope, PointEvent, PointOperatorAssignment, ProjectedPoint, UserProfile, UserRole } from '../../shared/types';
import { categoryLabel as getCategoryLabelFromRegistry } from '../../shared/verticals';
import { getEffectiveEventXp } from '../../shared/xp';
import {
  computeAverageQualityForToday,
  computeContributionSummary,
  countActivitiesInCurrentWeek,
  formatContributionHistoryDate,
  getStartOfCurrentWeek,
  mapQueuedItemsToContributionActivities,
} from '../../lib/shared/contributionMetrics';
import { computeBadges } from '../BadgeSystem';
import DailyProgressWidget from '../DailyProgressWidget';
import StreakTracker from '../StreakTracker';
import KpiTile from '../shared/KpiTile';
import ScreenHeader from '../shared/ScreenHeader';
import { collectablePlatformProjects, type PlatformFieldContext } from '../../lib/client/platformFieldContext';
import { getMyPlatformRecordSummaryRequest } from '../../lib/client/platformApi';
import type { PlatformRecordSummary } from '../../shared/platformTypes';

interface Props {
  onBack: () => void;
  onSettings: () => void;
  onOpenDocs: () => void;
  onRedeem: () => void;
  rewardsEnabled: boolean;
  onSubmissionQueue: () => void;
  language: 'en' | 'fr';
  platformFieldContext: PlatformFieldContext | null;
  isLoadingPlatformFieldContext: boolean;
  platformFieldContextError: string;
  onRefreshPlatformFieldContext: () => void;
}

type AdminPointOperatorAssignmentResponse = {
  assignment: PointOperatorAssignment | null;
  events?: Array<{ id: string; label: string; at: string; detail?: string }>;
};

function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `po-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pointDisplayNameForLanguage(point: ProjectedPoint, language: 'en' | 'fr'): string {
  const namedValue = readPointPrimaryDetail(point);
  if (namedValue) return namedValue;

  return `${getCategoryLabelFromRegistry(point.category, language)} · ${pointCoordinateLabel(point)}`;
}

function pointSecondaryLabel(point: ProjectedPoint): string {
  const details = (point.details ?? {}) as Record<string, unknown>;
  const provider = readPointProviderDetail(details);
  const merchantId = readPointDetail(details, 'merchantId');
  return [provider, merchantId, pointCoordinateLabel(point), point.pointId].filter(Boolean).join(' · ');
}

function readPointDetail(details: Record<string, unknown>, key: string): string {
  const value = details[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readPointPrimaryDetail(point: ProjectedPoint): string {
  const details = (point.details ?? {}) as Record<string, unknown>;
  return (
    readPointDetail(details, 'name') ||
    readPointDetail(details, 'siteName') ||
    readPointDetail(details, 'brand') ||
    readPointDetail(details, 'operator') ||
    readPointDetail(details, 'provider') ||
    readPointProviderDetail(details) ||
    readPointDetail(details, 'roadName')
  );
}

function readPointProviderDetail(details: Record<string, unknown>): string {
  const provider = readPointDetail(details, 'provider');
  if (provider) return provider;
  const providers = details.providers;
  if (!Array.isArray(providers)) return '';
  return providers.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join(', ');
}

function pointCoordinateLabel(point: ProjectedPoint): string {
  const { latitude, longitude } = point.location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return point.pointId;
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatDateTime(value: string | null | undefined, language: 'en' | 'fr'): string {
  if (!value) return language === 'fr' ? 'Inconnu' : 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === 'fr' ? 'Inconnu' : 'Unknown';
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const PointOperatorAccessCard: React.FC<{ language: 'en' | 'fr' }> = ({ language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [isExpanded, setIsExpanded] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [pointQuery, setPointQuery] = useState('');
  const [pointResults, setPointResults] = useState<ProjectedPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<ProjectedPoint | null>(null);
  const [assignment, setAssignment] = useState<PointOperatorAssignment | null>(null);
  const [recentEvents, setRecentEvents] = useState<Array<{ id: string; label: string; at: string; detail?: string }>>([]);
  const [revokeReason, setRevokeReason] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const normalizedIdentifier = identifier.trim().toLowerCase();
  const isActiveAssignment = assignment?.status === 'active';
  const canCreateAndLink =
    normalizedIdentifier.length > 0 &&
    displayName.trim().length > 0 &&
    temporaryPassword.trim().length >= 10 &&
    Boolean(selectedPoint) &&
    !isCreating;
  const canLoadAssignment = normalizedIdentifier.length > 0 && !isLoadingAssignment;
  const canRevoke = Boolean(assignment?.operatorUserId) && isActiveAssignment && revokeReason.trim().length >= 3 && !isRevoking;

  useEffect(() => {
    if (!isExpanded) return undefined;
    const query = pointQuery.trim();
    if (query.length < 2) {
      setPointResults([]);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        const params = new URLSearchParams({ view: 'po_admin_search_points', q: query });
        const response = await apiJson<{ points: ProjectedPoint[] }>(`/api/user?${params.toString()}`);
        if (!cancelled) setPointResults(Array.isArray(response.points) ? response.points : []);
      } catch {
        if (!cancelled) setPointResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isExpanded, pointQuery]);

  const assignmentEvents = useMemo(() => {
    if (recentEvents.length > 0) return recentEvents;
    if (!assignment) return [];
    const events = [
      {
        id: `${assignment.id}-grant`,
        label: t('Operator granted', 'Opérateur autorisé'),
        at: assignment.grantedAt,
        detail: assignment.pointId,
      },
    ];
    if (assignment.revokedAt) {
      events.unshift({
        id: `${assignment.id}-revoke`,
        label: t('Operator revoked', 'Opérateur révoqué'),
        at: assignment.revokedAt,
        detail: assignment.revokeReason ?? undefined,
      });
    }
    return events;
  }, [assignment, recentEvents, t]);

  const lastUpdate = assignment?.revokedAt ?? assignment?.grantedAt;

  const handleCreateAndLink = async () => {
    if (!canCreateAndLink || !selectedPoint) {
      setErrorMessage(t('Enter operator details and select a verified point.', 'Saisissez les détails opérateur et sélectionnez un point vérifié.'));
      return;
    }

    setErrorMessage('');
    setStatusMessage('');
    try {
      setIsCreating(true);
      const response = await apiJson<AdminPointOperatorAssignmentResponse>('/api/user?view=po_admin_create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({
          identifier: normalizedIdentifier,
          name: displayName.trim(),
          password: temporaryPassword,
          pointId: selectedPoint.pointId,
        }),
      });
      setAssignment(response.assignment);
      setRecentEvents(response.events ?? []);
      setRevokeReason('');
      setStatusMessage(t('Operator linked.', 'Opérateur lié.'));
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message.trim()
        ? error.message
        : t('Unable to create and link operator.', 'Impossible de créer et lier l’opérateur.'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoadAssignment = async () => {
    if (!canLoadAssignment) return;
    setErrorMessage('');
    setStatusMessage('');
    try {
      setIsLoadingAssignment(true);
      const params = new URLSearchParams({ view: 'po_admin_assignment', operatorUserId: normalizedIdentifier });
      const response = await apiJson<AdminPointOperatorAssignmentResponse>(`/api/user?${params.toString()}`);
      setAssignment(response.assignment);
      setRecentEvents(response.events ?? []);
      setStatusMessage(response.assignment
        ? t('Active assignment loaded.', 'Affectation active chargée.')
        : t('No active assignment for this operator.', 'Aucune affectation active pour cet opérateur.'));
    } catch (error) {
      setAssignment(null);
      setRecentEvents([]);
      setErrorMessage(error instanceof Error && error.message.trim()
        ? error.message
        : t('Unable to load assignment.', 'Impossible de charger l’affectation.'));
    } finally {
      setIsLoadingAssignment(false);
    }
  };

  const handleRevoke = async () => {
    if (!canRevoke || !assignment) return;
    setErrorMessage('');
    setStatusMessage('');
    try {
      setIsRevoking(true);
      const response = await apiJson<AdminPointOperatorAssignmentResponse>('/api/user?view=po_admin_revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({
          operatorUserId: assignment.operatorUserId,
          reason: revokeReason.trim(),
        }),
      });
      setAssignment(response.assignment);
      setRecentEvents(response.events ?? []);
      setStatusMessage(t('Operator access revoked. You can assign a replacement now.', 'Accès opérateur révoqué. Vous pouvez affecter un remplaçant.'));
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message.trim()
        ? error.message
        : t('Unable to revoke operator access.', 'Impossible de révoquer l’accès opérateur.'));
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <section data-testid="profile-point-operator-access" className="card p-4 space-y-4">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="micro-label text-gray-400">
            {t('Point operator access', 'Accès opérateur du point')}
          </span>
          <span className="mt-1 block text-sm font-bold text-gray-900">
            {t('Create and link a point operator', 'Créer et lier un opérateur du point')}
          </span>
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-forest-wash text-forest">
          <UserPlus size={18} aria-hidden="true" />
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-4">
          <p className="text-xs leading-5 text-gray-500">
            {t(
              'Point operators are tied to one verified point. Create them here, load the current assignment, and revoke access with a reason when staff changes.',
              'Les opérateurs du point sont liés à un point vérifié. Créez-les ici, chargez l’affectation active et révoquez l’accès avec un motif lors d’un changement d’équipe.',
            )}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="micro-label text-gray-400">
                {t('Email or phone', 'Email ou téléphone')}
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
                placeholder={t('operator@example.com', 'operateur@exemple.com')}
              />
            </label>
            <label className="block space-y-2">
              <span className="micro-label text-gray-400">
                {t('Display name', 'Nom affiché')}
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
                placeholder={t('Market Operator', 'Opérateur du marché')}
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="micro-label text-gray-400">
              {t('Temporary password', 'Mot de passe temporaire')}
            </span>
            <input
              type="password"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
              placeholder={t('Minimum 10 characters', 'Minimum 10 caractères')}
            />
          </label>

          <div className="space-y-2">
            <label className="block space-y-2">
              <span className="micro-label text-gray-400">
                {t('Search verified point', 'Rechercher un point vérifié')}
              </span>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  value={pointQuery}
                  onChange={(event) => {
                    setPointQuery(event.target.value);
                    setSelectedPoint(null);
                  }}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
                  placeholder={t('Pharmacie du Marché', 'Pharmacie du Marché')}
                  role="combobox"
                  aria-expanded={pointResults.length > 0}
                  aria-controls="point-operator-point-results"
                />
              </div>
            </label>
            {isSearching && (
              <div className="text-xs text-gray-400">{t('Searching...', 'Recherche...')}</div>
            )}
            {pointResults.length > 0 && (
              <div id="point-operator-point-results" role="listbox" className="space-y-2 rounded-2xl border border-gray-100 bg-white p-2">
                {pointResults.map((point) => (
                  <button
                    key={point.pointId}
                    type="button"
                    role="option"
                    aria-selected={selectedPoint?.pointId === point.pointId}
                    onClick={() => {
                      setSelectedPoint(point);
                      setPointQuery(pointDisplayNameForLanguage(point, language));
                      setPointResults([]);
                    }}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-forest-wash"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{pointDisplayNameForLanguage(point, language)}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-gray-500">
                        {pointSecondaryLabel(point)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold uppercase text-forest">
                      {t('Verified', 'Vérifié')}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedPoint && (
              <div className="rounded-xl border border-forest/20 bg-forest-wash p-3 text-xs text-forest-dark">
                <div className="font-bold">
                  {t('Selected point', 'Point sélectionné')}: {pointDisplayNameForLanguage(selectedPoint, language)}
                </div>
                <div className="mt-1 break-words font-medium text-forest">
                  {pointSecondaryLabel(selectedPoint)}
                </div>
              </div>
            )}
          </div>

          {statusMessage && (
            <div className="rounded-xl border border-forest/20 bg-forest-wash p-3 text-[11px] font-semibold text-forest-dark">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] font-semibold text-red-600">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleCreateAndLink}
              disabled={!canCreateAndLink}
              className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${
                canCreateAndLink ? 'bg-navy text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isCreating ? t('Creating...', 'Création...') : t('Create and link', 'Créer et lier')}
            </button>
            <button
              type="button"
              onClick={handleLoadAssignment}
              disabled={!canLoadAssignment}
              className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold ${
                canLoadAssignment ? 'border-navy text-navy' : 'border-gray-100 text-gray-400'
              }`}
            >
              {isLoadingAssignment ? t('Loading...', 'Chargement...') : t('Load active assignment', 'Charger l’affectation active')}
            </button>
          </div>

          {assignment && (
            <div className="space-y-3 rounded-2xl border border-navy-border bg-page p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className={isActiveAssignment ? 'text-forest' : 'text-gray-400'} aria-hidden="true" />
                    <h4 className="text-sm font-bold text-gray-900">
                      {t('Active operator', 'Opérateur actif')}: {assignment.operatorUserId}
                    </h4>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('Point', 'Point')}: {selectedPoint ? pointDisplayNameForLanguage(selectedPoint, language) : assignment.pointId}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                  isActiveAssignment ? 'bg-forest-wash text-forest' : 'bg-gray-100 text-gray-500'
                }`}>
                  {isActiveAssignment ? t('Active', 'Actif') : t('Revoked', 'Révoqué')}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3">
                  <dt className="font-bold uppercase text-gray-400">{t('Grant date', 'Date d’octroi')}</dt>
                  <dd className="mt-1 font-semibold text-gray-900">{formatDateTime(assignment.grantedAt, language)}</dd>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <dt className="font-bold uppercase text-gray-400">{t('Last update', 'Dernière mise à jour')}</dt>
                  <dd className="mt-1 font-semibold text-gray-900">{formatDateTime(lastUpdate, language)}</dd>
                </div>
              </dl>

              {isActiveAssignment && (
                <div className="space-y-2">
                  <label className="block space-y-2">
                    <span className="micro-label text-gray-400">
                      {t('Revocation reason', 'Motif de révocation')}
                    </span>
                    <textarea
                      value={revokeReason}
                      onChange={(event) => setRevokeReason(event.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-terra"
                      placeholder={t('Staff changed, access no longer valid', 'Changement d’équipe, accès non valide')}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={!canRevoke}
                    className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${
                      canRevoke ? 'bg-terra text-white' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isRevoking ? t('Revoking...', 'Révocation...') : t('Revoke operator', 'Révoquer l’opérateur')}
                  </button>
                </div>
              )}

              <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-3">
                <div className="micro-label text-gray-400">
                  {t('Recent events', 'Événements récents')}
                </div>
                {assignmentEvents.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    {t('No events yet.', 'Aucun événement pour le moment.')}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {assignmentEvents.slice(0, 5).map((event) => (
                      <li key={event.id} className="text-xs">
                        <div className="font-semibold text-gray-900">{event.label}</div>
                        <div className="text-gray-400">
                          {formatDateTime(event.at, language)}
                          {event.detail ? ` · ${event.detail}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const Profile: React.FC<Props> = ({
  onBack,
  onSettings,
  onOpenDocs,
  onRedeem,
  rewardsEnabled,
  onSubmissionQueue,
  language,
  platformFieldContext,
  isLoadingPlatformFieldContext,
  platformFieldContextError,
  onRefreshPlatformFieldContext,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const companyMode = Boolean(platformFieldContext?.organizations.length);
  const companyProjects = collectablePlatformProjects(platformFieldContext);
  const historyPreviewLimit = 5;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [companySummary, setCompanySummary] = useState<PlatformRecordSummary | null>(null);
  const [companySummaryError, setCompanySummaryError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [userLocation, setUserLocation] = useState('');
  const [history, setHistory] = useState<Array<{ id: string; date: string; location: string; type: string; xp: number }>>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [ownEvents, setOwnEvents] = useState<PointEvent[]>([]);
  const [syncErrors, setSyncErrors] = useState<SyncErrorRecord[]>([]);
  const [isLoadingSyncErrors, setIsLoadingSyncErrors] = useState(true);
  const [isClearingSyncErrors, setIsClearingSyncErrors] = useState(false);
  const [syncErrorActionError, setSyncErrorActionError] = useState('');
  const [assignments, setAssignments] = useState<CollectionAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [assignmentError, setAssignmentError] = useState('');
  const [isUpdatingAssignmentId, setIsUpdatingAssignmentId] = useState<string | null>(null);
  const [accountLookupInput, setAccountLookupInput] = useState('');
  const [managedAccount, setManagedAccount] = useState<UserProfile | null>(null);
  const [managedRole, setManagedRole] = useState<UserRole>('agent');
  const [managedHistory, setManagedHistory] = useState<Array<{ id: string; date: string; location: string; type: string; xp: number }>>([]);
  const [isLoadingManagedHistory, setIsLoadingManagedHistory] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [accessActionError, setAccessActionError] = useState('');
  const [accessActionSuccess, setAccessActionSuccess] = useState('');
  const [isLookingUpAccount, setIsLookingUpAccount] = useState(false);
  const [isSavingAccountAccess, setIsSavingAccountAccess] = useState(false);
  const [createIdentifier, setCreateIdentifier] = useState('');
  const [createName, setCreateName] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('client');
  const [createPassword, setCreatePassword] = useState('');
  const [createAccountError, setCreateAccountError] = useState('');
  const [createAccountSuccess, setCreateAccountSuccess] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [queuedItems, setQueuedItems] = useState<QueueItem[]>([]);
  const [adminMapScope, setAdminMapScope] = useState<MapScope>(() => readStoredAdminMapScope());
  const [isSavingMapScope, setIsSavingMapScope] = useState(false);
  const normalizeMapScope = (value: unknown, isAdminMode: boolean): MapScope => {
    if (isAdminMode) return 'global';
    if (value === 'cameroon' || value === 'global') return value;
    return 'bonamoussadi';
  };
  const resolveRole = (user: Pick<UserProfile, 'role' | 'isAdmin'> | null): UserRole => {
    if (user?.isAdmin) return 'admin';
    if (user?.role === 'admin' || user?.role === 'agent' || user?.role === 'client') return user.role;
    return 'agent';
  };
  const roleLabel = (role: UserRole) => {
    if (role === 'admin') return t('Admin', 'Admin');
    if (role === 'client') return t('Client', 'Client');
    return t('Agent', 'Agent');
  };
  const mapScopeLabel = (scope: MapScope) => {
    if (scope === 'global') return t('Worldwide', 'Monde entier');
    if (scope === 'cameroon') return t('Cameroon', 'Cameroun');
    return t('Bonamoussadi only', 'Bonamoussadi uniquement');
  };
  const activeMapScope: MapScope = profile?.isAdmin
    ? adminMapScope
    : normalizeMapScope(profile?.mapScope, false);
  const isMapUnlocked = adminMapScope !== 'bonamoussadi';

  const handleSetAdminMapScope = async (scope: MapScope) => {
    if (scope === adminMapScope || isSavingMapScope) return;
    setAdminMapScope(scope);
    broadcastAdminMapScope(scope); // drives the live Home map (and the next time it mounts)
    setIsSavingMapScope(true);
    try {
      await apiJson<UserProfile>('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapScope: scope }),
      });
    } catch {
      // Non-fatal: the map already updated locally; server persistence is best-effort.
    } finally {
      setIsSavingMapScope(false);
    }
  };
  const managedAccountRole = resolveRole(managedAccount);
  const hasManagedAccessChanges = Boolean(managedAccount) && managedRole !== managedAccountRole;
  const canCreateAccount =
    createIdentifier.trim().length > 0 &&
    createPassword.trim().length >= 10 &&
    !isCreatingAccount;

  const submissionToHistory = (submission: PointEvent) => {
    const details = (submission.details ?? {}) as Record<string, unknown>;
    const siteName = typeof details.siteName === 'string' ? details.siteName : typeof details.name === 'string' ? details.name : null;
    const locationLabel = siteName || `GPS: ${submission.location.latitude.toFixed(4)}°, ${submission.location.longitude.toFixed(4)}°`;
    const typeLabel = getCategoryLabelFromRegistry(submission.category, language);
    const xpAwarded = getEffectiveEventXp(submission);

    return {
      id: submission.id,
      date: formatContributionHistoryDate(submission.createdAt, language),
      location: locationLabel,
      type: typeLabel,
      xp: xpAwarded
    };
  };

  const categoryLabel = (category: SyncErrorRecord['payloadSummary']['category']) => {
    return getCategoryLabelFromRegistry(category, language);
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        setLoadError('');
        const data = await apiJson<UserProfile>('/api/user');
        setProfile(data);
        setShowAllHistory(false);

        if (companyMode) {
          setOwnEvents([]);
          setHistory([]);
          setUserLocation('');
          return;
        }

        try {
          const userId = typeof data?.id === 'string' ? data.id.toLowerCase().trim() : '';
          const scope = normalizeMapScope(data?.mapScope, Boolean(data?.isAdmin));
          const params = new URLSearchParams({ view: 'events', userId });
          if (scope !== 'bonamoussadi') params.set('scope', scope);
          const submissions = await apiJson<PointEvent[]>(`/api/submissions?${params.toString()}`);
          if (!userId) {
            setHistory([]);
            setUserLocation(t('Location not set', 'Position non définie'));
            return;
          }

          const ownSubmissions = (Array.isArray(submissions) ? submissions : [])
            .filter((submission) => (typeof submission.userId === 'string' ? submission.userId.toLowerCase().trim() : '') === userId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          setOwnEvents(ownSubmissions);
          const historyItems = ownSubmissions.map(submissionToHistory);
          setHistory(historyItems);

          const latest = ownSubmissions[0];
          if (latest) {
            const details = (latest.details ?? {}) as Record<string, unknown>;
            const siteName = typeof details.siteName === 'string' ? details.siteName : typeof details.name === 'string' ? details.name : null;
            setUserLocation(siteName || `GPS ${latest.location.latitude.toFixed(4)}°, ${latest.location.longitude.toFixed(4)}°`);
          } else {
            setUserLocation('');
          }
        } catch {
          setHistory([]);
          setUserLocation('');
        }
      } catch {
        setProfile(null);
        setLoadError('LOAD_FAILED');
        setHistory([]);
        setUserLocation('');
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [companyMode, language]);

  const badges = useMemo(() => computeBadges(ownEvents), [ownEvents]);
  const earnedBadgeCount = useMemo(() => badges.filter((badge) => badge.earned).length, [badges]);

  useEffect(() => {
    let cancelled = false;
    const loadQueuedItems = async () => {
      if (companyMode) {
        setQueuedItems([]);
        return;
      }
      try {
        const items = await listQueueItems();
        if (!cancelled) setQueuedItems(items);
      } catch {
        if (!cancelled) setQueuedItems([]);
      }
    };

    void loadQueuedItems();
    const unsubscribe = subscribeQueueSnapshot(() => {
      void loadQueuedItems();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [companyMode]);

  const syncedActivities = useMemo(
    () => ownEvents.map((event) => ({
      createdAt: event.createdAt,
      eventType: event.eventType,
      details: event.details,
    })),
    [ownEvents],
  );
  const queuedActivities = useMemo(() => mapQueuedItemsToContributionActivities(queuedItems), [queuedItems]);
  const contributionSummary = useMemo(
    () => computeContributionSummary([...syncedActivities, ...queuedActivities]),
    [queuedActivities, syncedActivities],
  );
  const averageQuality = useMemo(() => computeAverageQualityForToday(syncedActivities), [syncedActivities]);
  const activeAssignment = useMemo(() => {
    const active = assignments
      .filter((a) => a.status === 'in_progress' || a.status === 'pending')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return active[0] ?? null;
  }, [assignments]);
  const dailyTarget = activeAssignment?.pointsExpected && activeAssignment.pointsExpected > 0 ? activeAssignment.pointsExpected : 10;

  const pointsThisWeek = useMemo(() => {
    return countActivitiesInCurrentWeek(ownEvents);
  }, [ownEvents]);

  const weekRows = useMemo(() => {
    const weekStart = getStartOfCurrentWeek();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weeklyEvents = ownEvents.filter((event) => {
      const createdAt = new Date(event.createdAt);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= weekStart && createdAt < weekEnd;
    });
    const verifiedCount = weeklyEvents.filter((event) => {
      const details = (event.details ?? {}) as Record<string, unknown>;
      const reviewStatus = typeof details.reviewStatus === 'string' ? details.reviewStatus.trim().toLowerCase() : '';
      const reviewDecision = typeof details.reviewDecision === 'string' ? details.reviewDecision.trim().toLowerCase() : '';
      return (
        details.reviewerApproved === true ||
        reviewStatus === 'auto_approved' ||
        reviewStatus === 'verified' ||
        reviewDecision === 'approved'
      );
    }).length;
    const xpEarned = weeklyEvents.reduce((total, event) => total + getEffectiveEventXp(event), 0);
    const weekdayLabels = [
      t('Monday', 'Lundi'),
      t('Tuesday', 'Mardi'),
      t('Wednesday', 'Mercredi'),
      t('Thursday', 'Jeudi'),
      t('Friday', 'Vendredi'),
      t('Saturday', 'Samedi'),
      t('Sunday', 'Dimanche'),
    ];
    const bestDayFallback = t('No activity yet', 'Aucune activité pour le moment');
    let bestDay = bestDayFallback;
    if (weeklyEvents.length > 0) {
      const dayCounts = new Map<number, number>();
      for (const event of weeklyEvents) {
        const createdAt = new Date(event.createdAt);
        if (Number.isNaN(createdAt.getTime())) continue;
        const dayIndex = (createdAt.getDay() + 6) % 7;
        dayCounts.set(dayIndex, (dayCounts.get(dayIndex) ?? 0) + 1);
      }
      const bestEntry = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      if (bestEntry) {
        bestDay = weekdayLabels[bestEntry[0]] ?? bestDayFallback;
      }
    }

    return [
      {
        label: t('Submissions', 'Soumissions'),
        value: `${weeklyEvents.length}`,
      },
      {
        label: t('Verified', 'Vérifiées'),
        value: `${verifiedCount}`,
      },
      {
        label: t('XP earned', 'XP gagnées'),
        value: `${xpEarned} XP`,
      },
      {
        label: t('Best day', 'Meilleur jour'),
        value: bestDay,
      },
    ];
  }, [language, ownEvents]);

  const badgeChipClassName = (badgeId: string, earned: boolean) => {
    if (!earned) {
      return 'border border-gray-200 bg-gray-50 text-gray-500';
    }

    switch (badgeId) {
      case 'first_steps':
      case 'trust_elite':
        return 'border border-forest/10 bg-forest-wash text-forest';
      case 'explorer':
      case 'urban_validator':
        return 'border border-navy/10 bg-navy-wash text-navy';
      case 'specialist':
      case 'data_champion':
        return 'border border-terra/10 bg-terra-wash text-terra-dark';
      case 'quality_star':
        return 'border border-gold/20 bg-gold-wash text-amber-900';
      case 'night_owl':
        return 'border border-streak/10 bg-streak-wash text-streak';
      case 'rain_walker':
        return 'border border-forest/10 bg-forest-wash text-forest';
      case 'streak_master':
        return 'border border-terra/10 bg-terra-wash text-terra-dark';
      default:
        return 'border border-gray-200 bg-gray-50 text-gray-600';
    }
  };

  const visibleHistory = showAllHistory ? history : history.slice(0, historyPreviewLimit);
  const canToggleHistory = history.length > historyPreviewLimit;
  type ProfileHeroProfile = UserProfile & {
    displayName?: string;
    xp?: number;
    xpTarget?: number;
    level?: number;
    tier?: string;
    rank?: number;
    initial?: string;
  };
  const profileHero = profile as ProfileHeroProfile | null;
  const displayName =
    profileHero?.displayName ??
    profileHero?.name ??
    profileHero?.phone ??
    profileHero?.email ??
    t('Contributor', 'Contributeur');
  const initial = (profileHero?.initial ?? displayName.trim().charAt(0).toUpperCase() ?? 'A') || 'A';
  const xpCurrent = profileHero?.xp ?? profileHero?.XP ?? 0;
  const level = profileHero?.level ?? Math.max(1, Math.floor(xpCurrent / 250) + 1);
  const xpTarget = profileHero?.xpTarget ?? Math.max(level * 250, 250);
  const trustTier = profileHero?.trustTier;
  const tierLabel = profileHero?.tier
    ?? (trustTier
      ? ({
          new: t('New', 'Nouveau'),
          standard: t('Silver', 'Argent'),
          trusted: t('Trusted', 'Fiable'),
          elite: t('Elite', 'Élite'),
          restricted: t('Restricted', 'Restreint'),
        } as const)[trustTier]
      : t('Unrated', 'Non évalué'));
  const rank = profileHero?.rank;
  const pointsTotal = ownEvents.length;
  const rankDisplay = typeof rank === 'number' ? `#${rank}` : t('N/A', 'N/D');
  const streakDisplay = `${contributionSummary.streakDays}${language === 'fr' ? ' j' : 'd'}`;
  const xpProgress = xpTarget > 0 ? Math.min(100, (xpCurrent / xpTarget) * 100) : 0;
  const heroLocation = userLocation || mapScopeLabel(activeMapScope);
  const heroSubtitle = isLoading
    ? t('Loading profile', 'Chargement du profil')
    : profileHero
      ? `${roleLabel(resolveRole(profileHero))} · ${heroLocation}`
      : t('Profile unavailable', 'Profil indisponible');
  useEffect(() => {
    let cancelled = false;

    const loadAssignments = async () => {
      if (companyMode) {
        setAssignments([]);
        setAssignmentError('');
        setIsLoadingAssignments(false);
        return;
      }
      try {
        setIsLoadingAssignments(true);
        setAssignmentError('');
        const data = await apiJson<CollectionAssignment[]>('/api/user?view=assignments');
        if (cancelled) return;
        setAssignments(Array.isArray(data) ? data : []);
      } catch (error) {
        if (cancelled) return;
        setAssignmentError(error instanceof Error ? error.message : 'LOAD_FAILED');
        setAssignments([]);
      } finally {
        if (!cancelled) setIsLoadingAssignments(false);
      }
    };

    void loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [companyMode]);

  useEffect(() => {
    let cancelled = false;

    const loadSyncErrors = async () => {
      if (companyMode) {
        setSyncErrors([]);
        setIsLoadingSyncErrors(false);
        return;
      }
      try {
        setIsLoadingSyncErrors(true);
        const records = await listSyncErrorRecords();
        if (!cancelled) setSyncErrors(records);
      } catch {
        if (!cancelled) setSyncErrors([]);
      } finally {
        if (!cancelled) setIsLoadingSyncErrors(false);
      }
    };

    void loadSyncErrors();
    return () => {
      cancelled = true;
    };
  }, [companyMode]);

  useEffect(() => {
    let cancelled = false;
    if (!companyMode) {
      setCompanySummary(null);
      setCompanySummaryError('');
      return () => { cancelled = true; };
    }
    setCompanySummaryError('');
    void getMyPlatformRecordSummaryRequest()
      .then((summary) => { if (!cancelled) setCompanySummary(summary); })
      .catch(() => {
        if (!cancelled) setCompanySummaryError(t('Capture totals could not be loaded.', 'Impossible de charger les totaux de capture.'));
      });
    return () => { cancelled = true; };
  }, [companyMode, platformFieldContext, language]);

  const handleClearSyncErrors = async () => {
    if (isClearingSyncErrors) return;
    setSyncErrorActionError('');
    try {
      setIsClearingSyncErrors(true);
      await clearSyncErrorRecords();
      setSyncErrors([]);
    } catch {
      setSyncErrorActionError(t('Unable to clear sync errors.', 'Impossible d\'effacer les erreurs de synchronisation.'));
    } finally {
      setIsClearingSyncErrors(false);
    }
  };

  const handleAssignmentStatus = async (assignmentId: string, status: CollectionAssignment['status']) => {
    if (isUpdatingAssignmentId) return;
    setAssignmentError('');
    try {
      setIsUpdatingAssignmentId(assignmentId);
      const updated = await apiJson<CollectionAssignment>('/api/user?view=assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assignmentId, status }),
      });
      setAssignments((prev) => prev.map((assignment) => (assignment.id === assignmentId ? updated : assignment)));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('Unable to update assignment.', 'Impossible de mettre a jour l\'affectation.');
      setAssignmentError(message);
    } finally {
      setIsUpdatingAssignmentId(null);
    }
  };

  const handleCreateAccount = async () => {
    if (!canCreateAccount) {
      setCreateAccountError(t('Enter an email or phone and a temporary password.', 'Saisissez un email ou numéro et un mot de passe temporaire.'));
      return;
    }

    setCreateAccountError('');
    setCreateAccountSuccess('');
    setLookupError('');
    setAccessActionError('');
    setAccessActionSuccess('');

    try {
      setIsCreatingAccount(true);
      const created = await apiJson<UserProfile>('/api/user?view=account_create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: createIdentifier.trim(),
          name: createName.trim() || undefined,
          role: createRole,
          password: createPassword,
        }),
      });

      setManagedAccount(created);
      setManagedRole(resolveRole(created));
      setAccountLookupInput(created.email || created.phone || created.id);
      setCreateIdentifier('');
      setCreateName('');
      setCreateRole('client');
      setCreatePassword('');
      setCreateAccountSuccess(t('Account created. Share the temporary password through a trusted channel.', 'Compte créé. Partagez le mot de passe temporaire via un canal de confiance.'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : t('Unable to create account.', 'Impossible de créer le compte.');
      setCreateAccountError(message);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const loadManagedAccountHistory = async (account: UserProfile) => {
    const accountId = typeof account.id === 'string' ? account.id.toLowerCase().trim() : '';
    if (!accountId) {
      setManagedHistory([]);
      return;
    }
    setIsLoadingManagedHistory(true);
    try {
      // Admins receive every account's events from this endpoint; filter to the looked-up account.
      const params = new URLSearchParams({ view: 'events', scope: 'global', userId: accountId });
      const submissions = await apiJson<PointEvent[]>(`/api/submissions?${params.toString()}`);
      const accountSubmissions = (Array.isArray(submissions) ? submissions : [])
        .filter((submission) => (typeof submission.userId === 'string' ? submission.userId.toLowerCase().trim() : '') === accountId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setManagedHistory(accountSubmissions.map(submissionToHistory));
    } catch {
      setManagedHistory([]);
    } finally {
      setIsLoadingManagedHistory(false);
    }
  };

  const handleLookupAccount = async () => {
    if (isLookingUpAccount) return;
    const identifier = accountLookupInput.trim();
    if (!identifier) {
      setLookupError(t('Enter an exact email or phone number.', 'Saisissez un email ou un numero exact.'));
      setManagedAccount(null);
      setManagedHistory([]);
      setAccessActionError('');
      setAccessActionSuccess('');
      return;
    }

    setLookupError('');
    setAccessActionError('');
    setAccessActionSuccess('');

    try {
      setIsLookingUpAccount(true);
      const params = new URLSearchParams({ view: 'lookup', identifier });
      const account = await apiJson<UserProfile>(`/api/user?${params.toString()}`);
      setManagedAccount(account);
      setManagedRole(resolveRole(account));
      void loadManagedAccountHistory(account);
    } catch (error) {
      setManagedAccount(null);
      setManagedHistory([]);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : t('Unable to load account.', 'Impossible de charger le compte.');
      setLookupError(message);
    } finally {
      setIsLookingUpAccount(false);
    }
  };

  const handleSaveAccountAccess = async () => {
    if (!managedAccount || isSavingAccountAccess || !hasManagedAccessChanges) return;

    setAccessActionError('');
    setAccessActionSuccess('');

    try {
      setIsSavingAccountAccess(true);
      const updated = await apiJson<UserProfile>('/api/user?view=account_access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: managedAccount.id,
          role: managedRole,
        }),
      });
      setManagedAccount(updated);
      setManagedRole(resolveRole(updated));
      setAccessActionSuccess(t('Account access updated.', 'Accès du compte mis à jour.'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : t('Unable to update account access.', 'Impossible de mettre à jour l\'accès du compte.');
      setAccessActionError(message);
    } finally {
      setIsSavingAccountAccess(false);
    }
  };

  if (companyMode) {
    const primaryCompany = platformFieldContext?.organizations[0];
    return (
      <div data-testid="profile-company-workspace" className="screen-shell">
        <ScreenHeader
          title={t('Company profile', 'Profil entreprise')}
          onBack={onBack}
          language={language}
          trailing={
            <button type="button" onClick={onSettings} className="flex h-11 w-11 items-center justify-center rounded-xl text-navy"
              aria-label={t('Open account settings', 'Ouvrir les paramètres du compte')}>
              <SettingsIcon size={20} />
            </button>
          }
        />
        <div className="space-y-5 p-4 pb-[max(6rem,env(safe-area-inset-bottom))]">
          <section className="card overflow-hidden">
            <div className="flex items-center gap-4 bg-navy p-5 text-white">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                {primaryCompany?.organization.logoUrl
                  ? <img src={primaryCompany.organization.logoUrl} alt={primaryCompany.organization.name} className="h-full w-full object-contain" />
                  : <Building2 size={28} aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <p className="micro-label text-gold">{t('Active company', 'Entreprise active')}</p>
                <h1 className="mt-1 truncate text-xl font-bold">{primaryCompany?.organization.name}</h1>
                <p className="mt-1 text-sm capitalize text-white/70">{t('Access', 'Accès')}: {primaryCompany?.role}</p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm leading-6 text-ink-muted">
                {t('Your profile and capture totals are scoped to the companies that invited you.', 'Votre profil et vos totaux de capture sont limités aux entreprises qui vous ont invité.')}
              </p>
            </div>
          </section>

          {companySummaryError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{companySummaryError}</p>}
          <section className="grid grid-cols-2 gap-2" aria-label={t('Company capture totals', 'Totaux des captures entreprise')}>
            <KpiTile label={t('My captures', 'Mes captures')} value={companySummary?.total ?? '—'} tone="navy" />
            <KpiTile label={t('Today', 'Aujourd’hui')} value={companySummary?.submittedToday ?? '—'} tone="terra" />
            <KpiTile label={t('Approved', 'Approuvées')} value={companySummary?.approved ?? '—'} tone="forest" />
            <KpiTile label={t('Pending review', 'En attente')} value={companySummary?.pendingReview ?? '—'} tone="amber" />
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="micro-label text-ink-muted">{t('Assigned work', 'Travail attribué')}</p>
                <h2 className="mt-1 text-base font-bold text-ink">{t('Company projects and forms', 'Projets et formulaires entreprise')}</h2>
              </div>
              <button type="button" onClick={onRefreshPlatformFieldContext} disabled={isLoadingPlatformFieldContext}
                aria-label={t('Refresh company projects', 'Actualiser les projets entreprise')}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-navy-border text-navy disabled:opacity-50">
                <RefreshCw size={17} className={isLoadingPlatformFieldContext ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {platformFieldContext?.organizations.map((entry) => (
                <div key={entry.organization.id} className="rounded-2xl bg-page p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-sm font-bold text-ink">{entry.organization.name}</h3>
                    <span className="micro-label shrink-0 rounded-full bg-navy-wash px-2.5 py-1 capitalize text-navy">{entry.role}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">
                    {entry.projects.length} {t('projects', 'projets')} · {entry.projects.reduce((total, project) => total + (project.publishedSchema?.definition.recordTypes.length ?? 0), 0)} {t('published forms', 'formulaires publiés')}
                  </p>
                  {entry.organization.accessStatus === 'suspended' && (
                    <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                      {t('Company access is suspended. Contact your company administrator.', 'L’accès entreprise est suspendu. Contactez l’administrateur de votre entreprise.')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="screen-profile" className="screen-shell">
      <ScreenHeader
        title={t('Dashboard', 'Tableau de bord')}
        onBack={onBack}
        language={language}
        trailing={
          <button
            type="button"
            onClick={onSettings}
            className="p-2 text-navy"
            aria-label={t('Open settings', 'Ouvrir les paramètres')}
          >
            <SettingsIcon size={20} />
          </button>
        }
      />

      <div className="p-4 pb-24 space-y-6">
        <section className="route-grid relative -mx-4 -mt-4 overflow-hidden bg-navy px-5 pb-8 pt-5 text-white">
          <div className="relative flex items-start gap-3.5">
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-[3px] border-white/20 bg-gradient-to-br from-terra to-navy text-lg font-bold text-white shadow-lg shadow-navy/30">
              {initial}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold leading-tight">{isLoading ? t('Loading profile', 'Chargement du profil') : displayName}</h2>
                <span className="micro-label rounded-full bg-gold/20 px-2 py-0.5 text-gold">{tierLabel}</span>
                <span className="micro-label rounded-full bg-white/10 px-2 py-0.5 text-white/70">
                  {t('Level', 'Niveau')} {level}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2 text-sm text-white/70">
                <span>{heroSubtitle}</span>
              </div>
            </div>
            {typeof rank === 'number' && (
              <div className="text-[22px] font-extrabold text-gold">#{rank}</div>
            )}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wide text-white/70">
              <span>{t('Level', 'Niveau')}</span>
              <span>{xpCurrent} / {xpTarget} XP</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-amber transition-[width] duration-300"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>

          {loadError && (
            <div className="mt-3 micro-label text-white/70">
              {loadError === 'LOAD_FAILED' ? t('Couldn\'t load your profile. Go back and try again.', 'Impossible de charger votre profil. Revenez et réessayez.') : loadError}
            </div>
          )}
        </section>

        {(isLoadingPlatformFieldContext || platformFieldContextError || Boolean(platformFieldContext?.organizations.length)) && (
          <section data-testid="profile-company-workspace" className="card overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-navy-wash text-navy">
                {platformFieldContext?.organizations[0]?.organization.logoUrl ? (
                  <img src={platformFieldContext.organizations[0].organization.logoUrl} alt="" className="h-full w-full object-contain" />
                ) : <Building2 size={22} aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="micro-label text-forest">{t('Company workspace', 'Espace entreprise')}</div>
                <h3 className="mt-1 truncate text-base font-bold text-gray-900">
                  {isLoadingPlatformFieldContext
                    ? t('Loading company…', 'Chargement de l’entreprise…')
                    : platformFieldContext?.organizations[0]?.organization.name ?? t('Company access unavailable', 'Accès entreprise indisponible')}
                </h3>
                {platformFieldContext?.organizations[0] && (
                  <p className="mt-1 text-xs text-gray-500">
                    {t('Role', 'Rôle')}: {platformFieldContext.organizations[0].role} · {companyProjects.length} {t('published form(s)', 'formulaire(s) publié(s)')}
                  </p>
                )}
                {platformFieldContext?.organizations[0]?.organization.accessStatus === 'suspended' && (
                  <p role="alert" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                    {t('Company access suspended', 'Accès entreprise suspendu')}: {platformFieldContext.organizations[0].organization.suspensionReason ?? t('Contact ADL support.', 'Contactez le support ADL.')}
                  </p>
                )}
                {platformFieldContext && platformFieldContext.organizations.length > 1 && (
                  <p className="mt-1 text-xs text-gray-500">+{platformFieldContext.organizations.length - 1} {t('other organization(s)', 'autre(s) organisation(s)')}</p>
                )}
                {platformFieldContextError && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{t('Company data could not be loaded.', 'Les données entreprise n’ont pas pu être chargées.')}</p>
                )}
              </div>
              <button type="button" onClick={onRefreshPlatformFieldContext} disabled={isLoadingPlatformFieldContext}
                aria-label={t('Refresh company data', 'Actualiser les données entreprise')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-navy disabled:opacity-50">
                <RefreshCw size={17} className={isLoadingPlatformFieldContext ? 'animate-spin' : ''} />
              </button>
            </div>
            {platformFieldContext?.organizations.map((entry) => (
              <div key={entry.organization.id} className="border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
                <span className="font-bold text-gray-900">{entry.organization.name}</span>
                <span> · {entry.projects.length} {t('project(s)', 'projet(s)')}</span>
              </div>
            ))}
          </section>
        )}

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiTile label={t('Points', 'Points')} value={pointsTotal} tone="navy" />
          <KpiTile label={t('XP', 'XP')} value={xpCurrent} tone="terra" />
          <KpiTile label={t('Streak', 'Série')} value={streakDisplay} tone="streak" />
          <KpiTile label={t('Rank', 'Rang')} value={rankDisplay} tone="amber" />
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onSubmissionQueue}
            className="w-full rounded-2xl border border-navy-border bg-white p-4 text-left shadow-sm"
          >
            <div className="text-sm font-bold text-navy">
              {t('Pending Uploads', 'Envois en attente')}
            </div>
          </button>
          <button
            type="button"
            onClick={onOpenDocs}
            data-testid="profile-open-help-center"
            aria-label={t('Open help center', "Ouvrir le centre d'aide")}
            className="w-full rounded-2xl border border-gold/40 bg-gold-wash p-4 text-left shadow-sm transition-colors hover:bg-gold/20"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-navy shadow-sm">
                <BookOpen size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-navy">
                  {t('Help Center', "Centre d'aide")}
                </div>
                <div className="text-xs text-gray-600">
                  {t('Guides for your current role and workflow.', 'Guides pour votre rôle et votre workflow.')}
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="bg-navy rounded-2xl p-6 text-white shadow-xl flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <span className="micro-label opacity-80">{t('XP Balance', 'Solde XP')}</span>
            <div className="flex items-baseline space-x-1">
              {isLoading ? (
                <div className="h-8 w-24 rounded-lg bg-white/20 animate-pulse"></div>
              ) : (
                <>
                  <h3 className="text-3xl font-extrabold tracking-tight">{(profile?.XP ?? 0).toLocaleString()}</h3>
                  <span className="text-lg font-bold opacity-60">XP</span>
                </>
              )}
            </div>
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/25 rounded-2xl flex items-center justify-center border border-white/30">
              <Award size={24} />
            </div>
          </div>
        </div>

        <DailyProgressWidget
          language={language}
          submissionsToday={contributionSummary.submissionsToday}
          enrichmentsToday={contributionSummary.enrichmentsToday}
          averageQuality={averageQuality}
          streakDays={contributionSummary.streakDays}
          dailyTarget={dailyTarget}
        />
        <StreakTracker
          language={language}
          streakDays={contributionSummary.streakDays}
          activeDays={contributionSummary.activeWeekdays}
        />

        {profile?.isAdmin && (
          <div className="card p-4 space-y-3">
            <div className="flex flex-col">
              <span className="micro-label text-gray-400">
                {t('Admin Map Access', 'Accès carte admin')}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {t('Explorer map scope', 'Portée de la carte Explorer')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('Map scope', 'Portée de la carte')}>
              {(['bonamoussadi', 'cameroon', 'global'] as MapScope[]).map((scope) => {
                const isActive = adminMapScope === scope;
                return (
                  <button
                    key={scope}
                    type="button"
                    data-testid={`profile-map-scope-${scope}`}
                    aria-pressed={isActive}
                    disabled={isSavingMapScope}
                    onClick={() => void handleSetAdminMapScope(scope)}
                    className={`motion-pressable min-h-[44px] rounded-xl border px-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      isActive ? 'border-navy bg-navy text-white' : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {mapScopeLabel(scope)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">
              {isMapUnlocked
                ? t('Explorer map is unlocked worldwide.', 'La carte Explorer est debloquee dans le monde entier.')
                : t('Explorer map is locked to Bonamoussadi.', 'La carte Explorer est limitee a Bonamoussadi.')}
            </p>
          </div>
        )}

        {profile?.isAdmin && (
          <div data-testid="profile-admin-access" className="card p-4 space-y-4">
            <div className="space-y-1">
              <span className="micro-label text-gray-400">
                {t('Account Access', 'Acces aux comptes')}
              </span>
              <h3 className="text-sm font-bold text-gray-900">
                {t('Create or manage account access', 'Créer ou gérer les accès aux comptes')}
              </h3>
              <p className="text-xs leading-5 text-gray-500">
                {t(
                  'Create client accounts, then look up any account by exact email or phone to adjust Agent, Client, or Admin access. Admin accounts automatically unlock worldwide map views.',
                  'Créez des comptes client, puis recherchez un compte par email ou numéro exact pour régler les accès Agent, Client ou Admin. Les comptes admin débloquent automatiquement la vue mondiale.',
                )}
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-navy-border bg-page p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    {t('Create account', 'Créer un compte')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {t('Default role is Client. The user accepts policies on first login.', 'Le rôle par défaut est Client. L’utilisateur accepte les politiques à la première connexion.')}
                  </div>
                </div>
                <span className="rounded-full bg-gold-wash px-3 py-1 micro-label text-amber-900">
                  {roleLabel(createRole)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="micro-label text-gray-400">
                    {t('Email or phone', 'Email ou téléphone')}
                  </span>
                  <input
                    type="text"
                    value={createIdentifier}
                    onChange={(event) => setCreateIdentifier(event.target.value)}
                    placeholder={t('client@example.com or +237...', 'client@exemple.com ou +237...')}
                    data-testid="admin-account-create-identifier"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="micro-label text-gray-400">
                    {t('Display name', 'Nom affiché')}
                  </span>
                  <input
                    type="text"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder={t('Client team name', 'Nom de l’équipe client')}
                    data-testid="admin-account-create-name"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="micro-label text-gray-400">
                    {t('Role', 'Rôle')}
                  </span>
                  <select
                    value={createRole}
                    onChange={(event) => setCreateRole(event.target.value as UserRole)}
                    data-testid="admin-account-create-role"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-navy"
                  >
                    <option value="client">{t('Client', 'Client')}</option>
                    <option value="agent">{t('Agent', 'Agent')}</option>
                    <option value="admin">{t('Admin', 'Admin')}</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="micro-label text-gray-400">
                    {t('Temporary password', 'Mot de passe temporaire')}
                  </span>
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(event) => setCreatePassword(event.target.value)}
                    placeholder={t('Minimum 10 chars, mixed case, number', '10 caractères min., majuscule, minuscule, chiffre')}
                    data-testid="admin-account-create-password"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
                  />
                </label>
              </div>

              {createAccountError && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600">
                  {createAccountError}
                </div>
              )}

              {createAccountSuccess && (
                <div data-testid="admin-account-create-success" className="rounded-xl border border-forest/20 bg-forest-wash p-3 text-[11px] text-forest-dark">
                  {createAccountSuccess}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateAccount}
                disabled={!canCreateAccount}
                data-testid="admin-account-create-submit"
                className={`h-11 rounded-xl px-4 text-sm font-semibold ${
                  !canCreateAccount ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
                }`}
              >
                {isCreatingAccount ? t('Creating...', 'Création...') : t('Create account', 'Créer le compte')}
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={accountLookupInput}
                onChange={(event) => setAccountLookupInput(event.target.value)}
                placeholder={t('name@example.com or +237...', 'nom@exemple.com ou +237...')}
                data-testid="admin-account-lookup-input"
                className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
              />
              <button
                type="button"
                onClick={handleLookupAccount}
                disabled={isLookingUpAccount}
                data-testid="admin-account-lookup-submit"
                className={`h-11 rounded-xl px-4 text-sm font-semibold ${
                  isLookingUpAccount ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
                }`}
              >
                {isLookingUpAccount ? t('Loading...', 'Chargement...') : t('Load account', 'Charger le compte')}
              </button>
            </div>

            {lookupError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600">
                {lookupError}
              </div>
            )}

            {managedAccount && (
              <div className="space-y-4 rounded-2xl border border-navy-border bg-page p-4">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-gray-900">
                    {managedAccount.name || managedAccount.id}
                  </div>
                  <div className="text-xs text-gray-500">
                    {managedAccount.email || managedAccount.phone || managedAccount.id}
                  </div>
                  <div className="micro-label text-gray-500">
                    {t('Current access', 'Acces actuel')}: {roleLabel(managedAccountRole)} · {mapScopeLabel(normalizeMapScope(managedAccount.mapScope, Boolean(managedAccount.isAdmin)))}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-3">
                  <div className="micro-label text-gray-400">
                    {t('Contribution history', 'Historique des contributions')}
                  </div>
                  {isLoadingManagedHistory ? (
                    <div className="text-xs text-gray-400">{t('Loading...', 'Chargement...')}</div>
                  ) : managedHistory.length === 0 ? (
                    <div className="text-xs text-gray-400">
                      {t('No contributions for this account.', 'Aucune contribution pour ce compte.')}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {managedHistory.slice(0, 10).map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-gray-800">{item.type}</div>
                            <div className="truncate text-gray-400">{item.location} · {item.date}</div>
                          </div>
                          <span className="shrink-0 rounded-full bg-forest-wash px-2 py-0.5 font-semibold text-forest">
                            +{item.xp} XP
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <label className="block space-y-2">
                  <span className="micro-label text-gray-400">
                    {t('Role', 'Rôle')}
                  </span>
                  <select
                    value={managedRole}
                    onChange={(event) => setManagedRole(event.target.value as UserRole)}
                    data-testid="admin-account-role"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-navy"
                  >
                    <option value="agent">{t('Agent', 'Agent')}</option>
                    <option value="client">{t('Client', 'Client')}</option>
                    <option value="admin">{t('Admin', 'Admin')}</option>
                  </select>
                </label>

                {accessActionError && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600">
                    {accessActionError}
                  </div>
                )}

                {accessActionSuccess && (
                  <div className="rounded-xl border border-forest/20 bg-forest-wash p-3 text-[11px] text-forest-dark">
                    {accessActionSuccess}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveAccountAccess}
                  disabled={isSavingAccountAccess || !hasManagedAccessChanges}
                  data-testid="admin-account-save"
                  className={`h-11 rounded-xl px-4 text-sm font-semibold ${
                    isSavingAccountAccess || !hasManagedAccessChanges ? 'bg-gray-100 text-gray-400' : 'bg-terra text-white'
                  }`}
                >
                  {isSavingAccountAccess ? t('Saving...', 'Enregistrement...') : t('Save access', 'Enregistrer l\'accès')}
                </button>
              </div>
            )}
          </div>
        )}

        {profile?.isAdmin && <PointOperatorAccessCard language={language} />}

        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="micro-label text-gray-400">
                {t('Assignments', 'Affectations')}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {t('My Weekly Assignments', 'Mes affectations hebdomadaires')}
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-navy-light px-3 py-1 micro-label text-navy">
              {assignments.length}
            </span>
          </div>

          {assignmentError && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600">
              {assignmentError === 'LOAD_FAILED' ? t('Unable to load assignments.', 'Impossible de charger les affectations.') : assignmentError}
            </div>
          )}

          {isLoadingAssignments ? (
            <div className="text-xs text-gray-500">{t('Loading assignments...', 'Chargement des affectations...')}</div>
          ) : assignments.length === 0 ? (
            <div className="text-xs text-gray-500">
              {t('No active assignments yet.', 'Aucune affectation active pour le moment.')}
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => {
                const canStart = assignment.status === 'pending';
                const canComplete = assignment.status === 'in_progress';
                const isUpdating = isUpdatingAssignmentId === assignment.id;
                const statusLabel =
                  assignment.status === 'pending'
                    ? t('Pending', 'En attente')
                    : assignment.status === 'in_progress'
                      ? t('In progress', 'En cours')
                      : assignment.status === 'completed'
                        ? t('Completed', 'Terminé')
                        : t('Expired', 'Expiré');
                return (
                  <div key={assignment.id} className="rounded-xl border border-gray-100 p-3 bg-page space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-gray-900">{assignment.zoneLabel}</div>
                      <span className="micro-label text-gray-500">{statusLabel}</span>
                    </div>
                    <div className="text-[11px] text-gray-600">
                      {t('Due', 'Échéance')}: {assignment.dueDate}
                    </div>
                    <div className="text-[11px] text-gray-600">
                      {assignment.pointsSubmitted}/{assignment.pointsExpected} {t('points', 'points')} · {assignment.completionRate}%
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {assignment.assignedVerticals
                        .map((vertical) => getCategoryLabelFromRegistry(vertical, language))
                        .join(', ')}
                    </div>
                    {(canStart || canComplete) && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleAssignmentStatus(assignment.id, canStart ? 'in_progress' : 'completed')}
                        className={`min-h-[44px] rounded-2xl px-3 micro-label ${
                          isUpdating ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
                        }`}
                      >
                        {isUpdating
                          ? t('Updating...', 'Mise à jour...')
                          : canStart
                            ? t('Start Assignment', 'Démarrer affectation')
                            : t('Mark Completed', 'Marquer terminé')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {rewardsEnabled && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={onRedeem}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-navy-border bg-white px-4 text-sm font-semibold text-navy shadow-sm transition-all hover:bg-gray-100"
          >
            <Gift size={16} />
            <span>{t('Redeem XP', 'Échanger XP')}</span>
          </button>
          <button className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-terra px-4 text-sm font-semibold text-white shadow-lg transition-all hover:bg-terra-dark">
            <Wallet size={16} />
            <span>{t('Convert to Rewards', 'Convertir en recompenses')}</span>
          </button>
        </div>}

        {(() => {
          const WEEKLY_TARGET = 50;
          const progress = Math.min(100, Math.round((pointsThisWeek / WEEKLY_TARGET) * 100));
          return (
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="micro-label text-gray-400">
                  {t('Weekly Target', 'Objectif hebdomadaire')}
                </span>
                <span className="text-xs font-bold text-gray-900">
                  {pointsThisWeek}/{WEEKLY_TARGET}
                </span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-navy transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500">
                {pointsThisWeek >= WEEKLY_TARGET
                  ? t('Target reached! +20 XP bonus earned.', 'Objectif atteint ! +20 XP bonus gagnes.')
                  : t('Complete 50 this week for a 20 XP bonus!', 'Completez 50 cette semaine pour un bonus de 20 XP !')}
              </p>
            </div>
          );
        })()}

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="micro-label-wide text-gray-400">{t('Badges', 'Badges')}</div>
            <div className="text-[11px] font-semibold text-gray-500">
              {earnedBadgeCount}/{badges.length} {t('earned', 'obtenus')}
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {badges.map((badge) => {
              const Icon = badge.icon;
              const label = language === 'fr' ? badge.labelFr : badge.labelEn;
              const description = language === 'fr' ? badge.descriptionFr : badge.descriptionEn;
              const stateLabel = badge.earned ? t('earned', 'obtenu') : t('locked', 'verrouillé');
              return (
                <li
                  key={badge.id}
                  title={description}
                  aria-label={`${label}: ${stateLabel}. ${description}`}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold ${badgeChipClassName(badge.id, badge.earned)}`}
                >
                  <Icon size={12} className="shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">{label}</span>
                  <span className="sr-only">, {stateLabel}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="micro-label-wide text-gray-400">{t('This week', 'Cette semaine')}</div>
          <dl className="card-soft p-4">
            {weekRows.map((row, index) => (
              <div
                key={row.label}
                className={`flex items-center justify-between py-2 ${index < weekRows.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <dt className="text-[13px] font-medium text-ink-muted">{row.label}</dt>
                <dd className="text-[13px] font-bold text-gray-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="micro-label text-gray-400">{t('Contribution History', 'Historique des contributions')}</h4>
            {canToggleHistory && (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="text-[11px] font-bold text-navy uppercase"
              >
                {showAllHistory ? t('Show Less', 'Voir moins') : t('View All', 'Voir tout')}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {history.length === 0 && (
              <div className="card p-4 text-xs text-gray-500">
                {t('No contributions yet. Add your first report to build your history.', 'Aucune contribution pour le moment. Ajoutez votre premier signalement pour construire votre historique.')}
              </div>
            )}
            {visibleHistory.map((act) => (
              <div key={act.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-navy-wash flex items-center justify-center text-navy">
                    <Calendar size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900">{act.type}</span>
                    <span className="text-[11px] text-navy/50 font-bold uppercase">{act.date}</span>
                    <span className="text-[11px] text-gray-500 font-medium">{act.location}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-forest">+{act.xp} XP</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="micro-label text-gray-400">{t('Upload Issues', 'Problèmes d\'envoi')}</h4>
            {syncErrors.length > 0 && (
              <button
                type="button"
                onClick={handleClearSyncErrors}
                disabled={isClearingSyncErrors}
                className={`text-[11px] font-bold uppercase flex items-center space-x-1 ${isClearingSyncErrors ? 'text-gray-300' : 'text-terra'}`}
              >
                <Trash2 size={12} />
                <span>{isClearingSyncErrors ? t('Clearing...', 'Suppression...') : t('Clear', 'Effacer')}</span>
              </button>
            )}
          </div>

          {syncErrorActionError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600">
              {syncErrorActionError}
            </div>
          )}

          {isLoadingSyncErrors && (
            <div className="card p-4 text-xs text-gray-500">
              {t('Checking for upload issues...', 'Vérification des problèmes d\'envoi...')}
            </div>
          )}

          {!isLoadingSyncErrors && syncErrors.length === 0 && (
            <div className="card p-4 text-xs text-gray-500">
              {t('All clear! No upload issues.', 'Tout est bon ! Aucun problème d\'envoi.')}
            </div>
          )}

          {!isLoadingSyncErrors && syncErrors.length > 0 && (
            <div className="space-y-3">
              {syncErrors.map((record) => (
                <div key={record.id} className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm space-y-2">
                  <div className="flex items-start space-x-2 text-red-600">
                    <AlertTriangle size={14} className="mt-[1px]" />
                    <span className="text-xs font-semibold">{record.message}</span>
                  </div>
                  <div className="micro-label text-gray-500">
                    {formatContributionHistoryDate(record.createdAt, language)} • {categoryLabel(record.payloadSummary.category)}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {record.payloadSummary.location
                      ? `GPS: ${record.payloadSummary.location.latitude.toFixed(4)}°, ${record.payloadSummary.location.longitude.toFixed(4)}°`
                      : t('GPS unavailable', 'GPS indisponible')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
