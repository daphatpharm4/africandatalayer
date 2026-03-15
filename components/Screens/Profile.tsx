import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Calendar,
  Gift,
  MapPin,
  Settings as SettingsIcon,
  TrendingUp,
  Trash2,
  Wallet
} from 'lucide-react';
import { apiJson } from '../../lib/client/api';
import { clearSyncErrorRecords, listSyncErrorRecords, type SyncErrorRecord } from '../../lib/client/offlineQueue';
import { AVATAR_PRESETS, coerceAvatarPreset, encodeAvatarPresetImage, type AvatarPreset } from '../../shared/avatarPresets';
import type { CollectionAssignment, MapScope, PointEvent, UserProfile } from '../../shared/types';
import { categoryLabel as getCategoryLabelFromRegistry } from '../../shared/verticals';
import { getEffectiveEventXp } from '../../shared/xp';
import { countActivitiesInCurrentWeek, formatContributionHistoryDate } from '../../lib/shared/contributionMetrics';
import BadgeGrid, { computeBadges } from '../BadgeSystem';
import ProfileAvatar from '../shared/ProfileAvatar';
import ScreenHeader from '../shared/ScreenHeader';

interface Props {
  onBack: () => void;
  onSettings: () => void;
  onRedeem: () => void;
  onSubmissionQueue: () => void;
  language: 'en' | 'fr';
}

const Profile: React.FC<Props> = ({ onBack, onSettings, onRedeem, onSubmissionQueue, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const historyPreviewLimit = 5;
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarSaveError, setAvatarSaveError] = useState('');
  const normalizeMapScope = (value: unknown, isAdminMode: boolean): MapScope => {
    if (isAdminMode) return 'global';
    if (value === 'cameroon' || value === 'global') return value;
    return 'bonamoussadi';
  };
  const activeMapScope = normalizeMapScope(profile?.mapScope, Boolean(profile?.isAdmin));
  const isMapUnlocked = activeMapScope !== 'bonamoussadi';
  const activeAvatarPreset = coerceAvatarPreset(profile?.avatarPreset ?? profile?.image);

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

        try {
          const userId = typeof data?.id === 'string' ? data.id.toLowerCase().trim() : '';
          const scope = normalizeMapScope(data?.mapScope, Boolean(data?.isAdmin));
          const params = new URLSearchParams({ view: 'events' });
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
  }, []); // language removed: API data is language-independent; translations handled in render

  const badges = useMemo(() => computeBadges(ownEvents), [ownEvents]);

  const avatarOptions = useMemo(
    () =>
      AVATAR_PRESETS.map((preset) => ({
        preset,
        label:
          preset === 'baobab'
            ? t('Baobab', 'Baobab')
            : preset === 'sunrise'
              ? t('Sunrise', 'Aurore')
              : t('Lagoon', 'Lagon'),
      })),
    [language]
  );

  const pointsThisWeek = useMemo(() => {
    return countActivitiesInCurrentWeek(ownEvents);
  }, [ownEvents]);

  const visibleHistory = showAllHistory ? history : history.slice(0, historyPreviewLimit);
  const canToggleHistory = history.length > historyPreviewLimit;

  useEffect(() => {
    let cancelled = false;

    const loadAssignments = async () => {
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
  }, []); // language removed: API data is language-independent

  useEffect(() => {
    let cancelled = false;

    const loadSyncErrors = async () => {
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
  }, []);

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

  const handleAvatarSelect = async (preset: AvatarPreset) => {
    if (!profile || isSavingAvatar) return;
    if (activeAvatarPreset === preset) return;

    const previousProfile = profile;
    setAvatarSaveError('');
    setProfile({ ...profile, avatarPreset: preset, image: encodeAvatarPresetImage(preset) });

    try {
      setIsSavingAvatar(true);
      const updated = await apiJson<UserProfile>('/api/user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarPreset: preset }),
      });
      setProfile(updated);
    } catch (error) {
      setProfile(previousProfile);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : t('Unable to update avatar.', 'Impossible de mettre a jour l\'avatar.');
      setAvatarSaveError(message);
    } finally {
      setIsSavingAvatar(false);
    }
  };

  return (
    <div className="screen-shell">
      <ScreenHeader
        title={t('Dashboard', 'Tableau de bord')}
        onBack={onBack}
        language={language}
        trailing={
          <button onClick={onSettings} className="p-2 text-navy">
            <SettingsIcon size={20} />
          </button>
        }
      />

      <div className="p-4 pb-24 space-y-6">
        <div className="flex flex-col items-center py-4 text-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl bg-navy-light overflow-hidden">
              <ProfileAvatar preset={activeAvatarPreset} alt={t('Profile avatar', 'Avatar du profil')} className="w-full h-full" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-forest rounded-full border-2 border-white">
              <BadgeCheck size={14} className="text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {isLoading ? (
              <span className="inline-block h-4 w-40 rounded-full bg-gray-200 animate-pulse"></span>
            ) : (
              profile?.name || profile?.phone || profile?.email || t('Contributor', 'Contributeur')
            )}
          </h2>
          {!isLoading && (
            <div className="flex items-center justify-center micro-label text-gray-400 mt-1 space-x-2">
              <MapPin size={12} />
              <span>{userLocation || t('Location not set', 'Position non définie')}</span>
            </div>
          )}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-3">
              {avatarOptions.map((option) => {
                const isSelected = option.preset === activeAvatarPreset;
                return (
                  <button
                    key={option.preset}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={!profile || isSavingAvatar}
                    onClick={() => handleAvatarSelect(option.preset)}
                    className={`rounded-2xl border p-1.5 transition-all ${
                      isSelected
                        ? 'border-navy bg-white shadow-md'
                        : 'border-navy-border bg-white/80 hover:border-navy-border'
                    } ${!profile || isSavingAvatar ? 'cursor-not-allowed opacity-70' : ''}`}
                    title={option.label}
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-xl">
                      <ProfileAvatar preset={option.preset} alt={option.label} className="h-full w-full" />
                    </div>
                    <span className="sr-only">{option.label}</span>
                  </button>
                );
              })}
            </div>
            {isSavingAvatar && <div className="micro-label text-gray-400">{t('Saving...', 'Enregistrement...')}</div>}
            {avatarSaveError && <div className="micro-label text-red-500">{avatarSaveError}</div>}
          </div>
          {loadError && (
            <div className="mt-2 micro-label text-red-500">
              {loadError === 'LOAD_FAILED' ? t('Unable to load profile.', 'Impossible de charger le profil.') : loadError}
            </div>
          )}
          <div className="mt-4">
            <span className="px-4 py-1.5 bg-navy-light text-navy micro-label rounded-full border border-navy-border shadow-sm">
              {t('Senior Contributor', 'Contributeur senior')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmissionQueue}
          className="w-full rounded-2xl border border-navy-border bg-white p-4 text-left shadow-sm"
        >
          <div className="text-sm font-bold text-navy">
            {t('Pending Uploads', 'Envois en attente')}
          </div>
        </button>

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
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
              <Award size={24} />
            </div>
          </div>
        </div>

        {profile?.isAdmin && (
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="micro-label text-gray-400">
                  {t('Admin Map Access', 'Accès carte admin')}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {t('Unlock worldwide map', 'Debloquer la carte mondiale')}
                </span>
              </div>
              <span className="inline-flex items-center rounded-full bg-forest-wash px-3 py-1 micro-label text-forest">
                {t('Enabled', 'Active')}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {isMapUnlocked
                ? t('Explorer map is unlocked worldwide.', 'La carte Explorer est debloquee dans le monde entier.')
                : t('Explorer map is locked to Bonamoussadi.', 'La carte Explorer est limitee a Bonamoussadi.')}
            </p>
          </div>
        )}

        <div className="card p-5 space-y-3">
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
                    <div className="text-[10px] text-gray-500">
                      {assignment.assignedVerticals
                        .map((vertical) => getCategoryLabelFromRegistry(vertical, language))
                        .join(', ')}
                    </div>
                    {(canStart || canComplete) && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleAssignmentStatus(assignment.id, canStart ? 'in_progress' : 'completed')}
                        className={`h-9 rounded-xl px-3 micro-label ${
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

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onRedeem}
            className="h-14 bg-white text-navy border border-navy-border rounded-xl micro-label shadow-sm hover:bg-gray-100 transition-all flex items-center justify-center space-x-2"
          >
            <Gift size={16} />
            <span>{t('Redeem XP', 'Échanger XP')}</span>
          </button>
          <button className="h-14 bg-terra text-white rounded-xl micro-label shadow-lg hover:bg-terra-dark transition-all flex items-center justify-center space-x-2">
            <Wallet size={16} />
            <span>{t('Convert to Rewards', 'Convertir en recompenses')}</span>
          </button>
        </div>

        {(() => {
          const WEEKLY_TARGET = 50;
          const progress = Math.min(100, Math.round((pointsThisWeek / WEEKLY_TARGET) * 100));
          return (
            <div className="card p-5 space-y-3">
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
                  className="h-full rounded-full bg-gradient-to-r from-navy to-forest transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500">
                {pointsThisWeek >= WEEKLY_TARGET
                  ? t('Target reached! +20 XP bonus earned.', 'Objectif atteint ! +20 XP bonus gagnes.')
                  : t('Complete 50 this week for a 20 XP bonus!', 'Completez 50 cette semaine pour un bonus de 20 XP !')}
              </p>
            </div>
          );
        })()}

        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <div className="flex items-center space-x-2 text-forest">
              <BadgeCheck size={16} />
              <span className="micro-label">{t('Trust Score', 'Score de confiance')}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">98%</span>
              <div className="mt-2 h-1 w-full bg-gray-50 rounded-full overflow-hidden">
                <div className="h-full bg-forest rounded-full transition-all duration-1000" style={{ width: '98%' }} />
              </div>
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <div className="flex items-center space-x-2 text-navy">
              <TrendingUp size={16} />
              <span className="micro-label">{t('This Week', 'Cette semaine')}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{pointsThisWeek}</span>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('submissions', 'soumissions')}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <BadgeGrid badges={badges} language={language} />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="micro-label text-gray-400">{t('Contribution History', 'Historique des contributions')}</h4>
            {canToggleHistory && (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="text-[10px] font-bold text-navy uppercase"
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
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <Calendar size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900">{act.type}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{act.date}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{act.location}</span>
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
                className={`text-[10px] font-bold uppercase flex items-center space-x-1 ${isClearingSyncErrors ? 'text-gray-300' : 'text-terra'}`}
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
