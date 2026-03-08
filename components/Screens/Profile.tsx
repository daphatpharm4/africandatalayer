import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
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
import type { CollectionAssignment, MapScope, PointEvent, UserProfile } from '../../shared/types';
import { categoryLabel as getCategoryLabelFromRegistry } from '../../shared/verticals';
import { getEffectiveEventXp } from '../../shared/xp';
import BadgeGrid, { computeBadges } from '../BadgeSystem';

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
  const [userLocation, setUserLocation] = useState(t('Location not set', 'Position non definie'));
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
  const normalizeMapScope = (value: unknown, isAdminMode: boolean): MapScope => {
    if (isAdminMode) return 'global';
    if (value === 'cameroon' || value === 'global') return value;
    return 'bonamoussadi';
  };
  const activeMapScope = normalizeMapScope(profile?.mapScope, Boolean(profile?.isAdmin));
  const isMapUnlocked = activeMapScope !== 'bonamoussadi';

  const formatHistoryDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return t('Unknown', 'Inconnu');

    const now = new Date();
    const sameDay = now.toDateString() === date.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = yesterday.toDateString() === date.toDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (sameDay) return language === 'fr' ? `Aujourd'hui • ${time}` : `Today • ${time}`;
    if (isYesterday) return language === 'fr' ? `Hier • ${time}` : `Yesterday • ${time}`;
    return `${date.toLocaleDateString([], { month: 'short', day: '2-digit' })} • ${time}`;
  };

  const submissionToHistory = (submission: PointEvent) => {
    const details = (submission.details ?? {}) as Record<string, unknown>;
    const siteName = typeof details.siteName === 'string' ? details.siteName : typeof details.name === 'string' ? details.name : null;
    const locationLabel = siteName || `GPS: ${submission.location.latitude.toFixed(4)}°, ${submission.location.longitude.toFixed(4)}°`;
    const typeLabel = getCategoryLabelFromRegistry(submission.category, language);
    const xpAwarded = getEffectiveEventXp(submission);

    return {
      id: submission.id,
      date: formatHistoryDate(submission.createdAt),
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
            setUserLocation(t('Location not set', 'Position non definie'));
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
            setUserLocation(t('No contributions yet', 'Pas encore de contributions'));
          }
        } catch {
          setHistory([]);
          setUserLocation(t('Location not set', 'Position non definie'));
        }
      } catch {
        setProfile(null);
        setLoadError(t('Unable to load profile.', 'Impossible de charger le profil.'));
        setHistory([]);
        setUserLocation(t('Location not set', 'Position non definie'));
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [language]);

  const badges = useMemo(() => computeBadges(ownEvents, language), [ownEvents, language]);
  const earnedBadgeCount = badges.filter((b) => b.earned).length;
  const nextBadge = badges.find((b) => !b.earned);

  const pointsThisWeek = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    const mondayKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    return ownEvents.filter((e) => e.createdAt.slice(0, 10) >= mondayKey).length;
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
        const message =
          error instanceof Error
            ? error.message
            : t('Unable to load assignments.', 'Impossible de charger les affectations.');
        setAssignmentError(message);
        setAssignments([]);
      } finally {
        if (!cancelled) setIsLoadingAssignments(false);
      }
    };

    void loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [language]);

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

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-[#0f2b46] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">{t('Dashboard', 'Tableau de bord')}</h3>
        <button onClick={onSettings} className="p-2 text-[#0f2b46] absolute right-2">
          <SettingsIcon size={20} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex flex-col items-center py-4 text-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl bg-[#e7eef4] overflow-hidden">
              <img src="https://picsum.photos/seed/jeanpaul/300/300" alt={t('avatar', 'avatar')} className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-[#4c7c59] rounded-full border-2 border-white">
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
            <div className="flex items-center justify-center text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-widest space-x-2">
              <MapPin size={12} />
              <span>{userLocation}</span>
            </div>
          )}
          {loadError && (
            <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-500">
              {loadError}
            </div>
          )}
          <div className="mt-4">
            <span className="px-4 py-1.5 bg-[#e7eef4] text-[#0f2b46] text-[10px] font-bold rounded-full uppercase tracking-widest border border-[#d5e1eb] shadow-sm">
              {t('Senior Contributor', 'Contributeur senior')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmissionQueue}
          className="w-full rounded-2xl border border-[#d5e1eb] bg-white p-4 text-left shadow-sm"
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
            {t('Submission Queue', 'File de soumission')}
          </div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {t('Manage pending sync, failed items, and queued drafts.', 'Gerer la sync en attente, les echecs et les brouillons en file.')}
          </div>
        </button>

        <div className="bg-[#0f2b46] rounded-2xl p-6 text-white shadow-xl flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{t('XP Balance', 'Solde XP')}</span>
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
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {t('Admin Map Access', 'Acces carte admin')}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {t('Unlock worldwide map', 'Debloquer la carte mondiale')}
                </span>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#eaf3ee] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#4c7c59]">
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

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {t('Collection Workflow', 'Workflow de collecte')}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {t('My Weekly Assignments', 'Mes affectations hebdomadaires')}
              </span>
            </div>
            <span className="inline-flex items-center rounded-full bg-[#e7eef4] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0f2b46]">
              {assignments.length}
            </span>
          </div>

          {assignmentError && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600">
              {assignmentError}
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
                        ? t('Completed', 'Termine')
                        : t('Expired', 'Expire');
                return (
                  <div key={assignment.id} className="rounded-xl border border-gray-100 p-3 bg-[#f9fafb] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-gray-900">{assignment.zoneLabel}</div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{statusLabel}</span>
                    </div>
                    <div className="text-[11px] text-gray-600">
                      {t('Due', 'Echeance')}: {assignment.dueDate}
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
                        className={`h-9 rounded-xl px-3 text-[10px] font-bold uppercase tracking-widest ${
                          isUpdating ? 'bg-gray-100 text-gray-400' : 'bg-[#0f2b46] text-white'
                        }`}
                      >
                        {isUpdating
                          ? t('Updating...', 'Mise a jour...')
                          : canStart
                            ? t('Start Assignment', 'Demarrer affectation')
                            : t('Mark Completed', 'Marquer termine')}
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
            className="h-14 bg-white text-[#0f2b46] border border-[#d5e1eb] rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-[#f2f4f7] transition-all flex items-center justify-center space-x-2"
          >
            <Gift size={16} />
            <span>{t('Redeem XP', 'Echanger XP')}</span>
          </button>
          <button className="h-14 bg-[#c86b4a] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg hover:bg-[#b85f3f] transition-all flex items-center justify-center space-x-2">
            <Wallet size={16} />
            <span>{t('Convert to Rewards', 'Convertir en recompenses')}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-[#4c7c59]">
              <BadgeCheck size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t('Trust Score', 'Score de confiance')}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">98%</span>
              <div className="mt-2 h-1 w-full bg-gray-50 rounded-full overflow-hidden">
                <div className="h-full bg-[#4c7c59] rounded-full transition-all duration-1000" style={{ width: '98%' }} />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-[#0f2b46]">
              <TrendingUp size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t('This Week', 'Cette semaine')}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">{pointsThisWeek}</span>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('submissions', 'soumissions')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <BadgeGrid badges={badges} language={language} />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Contribution History', 'Historique des contributions')}</h4>
            {canToggleHistory && (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="text-[10px] font-bold text-[#0f2b46] uppercase"
              >
                {showAllHistory ? t('Show Less', 'Voir moins') : t('View All', 'Voir tout')}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {history.length === 0 && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
                {t('No contributions yet. Add your first report to build your history.', 'Aucune contribution pour le moment. Ajoutez votre premier signalement pour construire votre historique.')}
              </div>
            )}
            {visibleHistory.map((act) => (
              <div key={act.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
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
                  <p className="text-xs font-bold text-[#4c7c59]">+{act.xp} XP</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Sync Errors', 'Erreurs de synchronisation')}</h4>
            {syncErrors.length > 0 && (
              <button
                type="button"
                onClick={handleClearSyncErrors}
                disabled={isClearingSyncErrors}
                className={`text-[10px] font-bold uppercase flex items-center space-x-1 ${isClearingSyncErrors ? 'text-gray-300' : 'text-[#c86b4a]'}`}
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
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
              {t('Loading sync errors...', 'Chargement des erreurs de synchronisation...')}
            </div>
          )}

          {!isLoadingSyncErrors && syncErrors.length === 0 && (
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
              {t('No sync errors on this device.', 'Aucune erreur de synchronisation sur cet appareil.')}
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
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                    {formatHistoryDate(record.createdAt)} • {categoryLabel(record.payloadSummary.category)}
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
        <div className="h-24"></div>
      </div>
    </div>
  );
};

export default Profile;
