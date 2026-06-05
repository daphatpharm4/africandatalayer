import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  Gift,
  Settings as SettingsIcon,
  Trash2,
  Wallet
} from 'lucide-react';
import { apiJson } from '../../lib/client/api';
import { clearSyncErrorRecords, listQueueItems, listSyncErrorRecords, subscribeQueueSnapshot, type QueueItem, type SyncErrorRecord } from '../../lib/client/offlineQueue';
import type { CollectionAssignment, MapScope, PointEvent, UserProfile, UserRole } from '../../shared/types';
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

interface Props {
  onBack: () => void;
  onSettings: () => void;
  onOpenDocs: () => void;
  onRedeem: () => void;
  onSubmissionQueue: () => void;
  language: 'en' | 'fr';
}

const Profile: React.FC<Props> = ({ onBack, onSettings, onOpenDocs, onRedeem, onSubmissionQueue, language }) => {
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
  const [accountLookupInput, setAccountLookupInput] = useState('');
  const [managedAccount, setManagedAccount] = useState<UserProfile | null>(null);
  const [managedRole, setManagedRole] = useState<UserRole>('agent');
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
  const activeMapScope = normalizeMapScope(profile?.mapScope, Boolean(profile?.isAdmin));
  const isMapUnlocked = activeMapScope !== 'bonamoussadi';
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
  const earnedBadgeCount = useMemo(() => badges.filter((badge) => badge.earned).length, [badges]);

  useEffect(() => {
    let cancelled = false;
    const loadQueuedItems = async () => {
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
  }, []);

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

  const handleLookupAccount = async () => {
    if (isLookingUpAccount) return;
    const identifier = accountLookupInput.trim();
    if (!identifier) {
      setLookupError(t('Enter an exact email or phone number.', 'Saisissez un email ou un numero exact.'));
      setManagedAccount(null);
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
    } catch (error) {
      setManagedAccount(null);
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>

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
                <dt className="text-[13px] text-gray-500">{row.label}</dt>
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
