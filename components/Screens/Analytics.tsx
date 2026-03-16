import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Medal,
  Share2,
  ShieldCheck,
  ThermometerSun,
  Users
} from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie
} from 'recharts';
import { getSession } from '../../lib/client/auth';
import { apiJson } from '../../lib/client/api';
import type { LeaderboardEntry, MapScope, PointEvent, ProjectedPoint, SubmissionCategory } from '../../shared/types';
import { categoryPluralLabel, VERTICAL_IDS, VERTICALS } from '../../shared/verticals';
import ProfileAvatar from '../shared/ProfileAvatar';
import ScreenHeader from '../shared/ScreenHeader';
import { coerceAvatarPreset, type AvatarPreset } from '../../shared/avatarPresets';

interface Props {
  onBack: () => void;
  onAdmin?: () => void;
  onAgentPerformance?: () => void;
  onDeltaDashboard?: () => void;
  isAdmin?: boolean;
  language: 'en' | 'fr';
}

type HeatLevel = 'High' | 'Medium' | 'Low';

const HEATMAP_COLORS: Record<HeatLevel, string> = {
  High: 'bg-forest',
  Medium: 'bg-terra',
  Low: 'bg-gray-200'
};

const normalizeMapScope = (scope: unknown, isAdminMode: boolean): MapScope => {
  if (isAdminMode) return 'global';
  if (scope === 'cameroon' || scope === 'global') return scope;
  return 'bonamoussadi';
};

const Analytics: React.FC<Props> = ({ onBack, onAdmin, onAgentPerformance, onDeltaDashboard, isAdmin, language }) => {
  const adminMode = Boolean(isAdmin);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminAvatar, setAdminAvatar] = useState<AvatarPreset>('baobab');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [isLoadingAdminData, setIsLoadingAdminData] = useState(false);
  const [completionRate, setCompletionRate] = useState(0);
  const [activeContributors, setActiveContributors] = useState(0);
  const [categoryData, setCategoryData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [heatmap, setHeatmap] = useState<HeatLevel[][]>([
    ['Low', 'Low', 'Low', 'Low'],
    ['Low', 'Low', 'Low', 'Low'],
    ['Low', 'Low', 'Low', 'Low']
  ]);
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const categorylabel = (category: SubmissionCategory): string => {
    return categoryPluralLabel(category, language);
  };

  useEffect(() => {
    if (!adminMode) return;
    const loadSession = async () => {
      const session = await getSession();
      setAdminName(session?.user?.name ?? null);
      setAdminEmail(session?.user?.email ?? null);
      setAdminAvatar(coerceAvatarPreset(session?.user?.image));
    };
    void loadSession();
  }, [adminMode]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setIsLoadingLeaderboard(true);
        const data = await apiJson<LeaderboardEntry[]>('/api/leaderboard');
        setLeaderboard(Array.isArray(data) ? data : []);
      } catch {
        setLeaderboard([]);
      } finally {
        setIsLoadingLeaderboard(false);
      }
    };

    void loadLeaderboard();
  }, []);

  useEffect(() => {
    if (!adminMode) return;
    const loadAdminAnalytics = async () => {
      try {
        setIsLoadingAdminData(true);
        const scope = normalizeMapScope('global', true);

        const pointParams = new URLSearchParams();
        if (scope !== 'bonamoussadi') pointParams.set('scope', scope);
        const pointsPath = pointParams.size > 0 ? `/api/submissions?${pointParams.toString()}` : '/api/submissions';

        const eventParams = new URLSearchParams({ view: 'events' });
        if (scope !== 'bonamoussadi') eventParams.set('scope', scope);
        const eventsPath = `/api/submissions?${eventParams.toString()}`;

        const [points, events] = await Promise.all([
          apiJson<ProjectedPoint[]>(pointsPath),
          apiJson<PointEvent[]>(eventsPath)
        ]);

        const safePoints = Array.isArray(points) ? points : [];
        const safeEvents = Array.isArray(events) ? events : [];

        const completed = safePoints.filter((point) => Array.isArray(point.gaps) && point.gaps.length === 0).length;
        const completion = safePoints.length > 0 ? Math.round((completed / safePoints.length) * 100) : 0;
        setCompletionRate(completion);

        const now = Date.now();
        const activeWindowMs = 30 * 24 * 60 * 60 * 1000;
        const activeUsers = new Set(
          safeEvents
            .filter((event) => {
              const createdAt = new Date(event.createdAt).getTime();
              return Number.isFinite(createdAt) && now - createdAt <= activeWindowMs;
            })
            .map((event) => event.userId)
            .filter((userId) => typeof userId === 'string' && userId.trim().length > 0)
        );
        setActiveContributors(activeUsers.size);

        const categoryCounts: Record<string, number> = {};
        for (const id of VERTICAL_IDS) categoryCounts[id] = 0;
        for (const event of safeEvents) {
          if (event.category in categoryCounts) categoryCounts[event.category] += 1;
        }
        setCategoryData(
          VERTICAL_IDS
            .filter((id) => (categoryCounts[id] ?? 0) > 0)
            .map((id) => ({ name: categorylabel(id as SubmissionCategory), value: categoryCounts[id], color: VERTICALS[id].color }))
        );

        const categories = VERTICAL_IDS;
        const bucketsPerCategory = categories.map(() => [0, 0, 0, 0]);
        const heatWindowMs = 24 * 60 * 60 * 1000;
        for (const event of safeEvents) {
          const timestamp = new Date(event.createdAt).getTime();
          if (!Number.isFinite(timestamp) || now - timestamp > heatWindowMs || timestamp > now) continue;
          const categoryIndex = categories.indexOf(event.category);
          if (categoryIndex === -1) continue;
          const bucketIndex = Math.max(0, Math.min(3, Math.floor(new Date(timestamp).getHours() / 6)));
          bucketsPerCategory[categoryIndex][bucketIndex] += 1;
        }

        const maxValue = Math.max(...bucketsPerCategory.flat(), 0);
        const toHeatLevel = (value: number): HeatLevel => {
          if (maxValue <= 0 || value <= 0) return 'Low';
          const ratio = value / maxValue;
          if (ratio >= 0.67) return 'High';
          if (ratio >= 0.34) return 'Medium';
          return 'Low';
        };

        setHeatmap(
          bucketsPerCategory.map((row) => row.map((value) => toHeatLevel(value)))
        );
      } catch {
        setCompletionRate(0);
        setActiveContributors(0);
        setCategoryData([]);
        setHeatmap(VERTICAL_IDS.map(() => ['Low', 'Low', 'Low', 'Low'] as HeatLevel[]));
      } finally {
        setIsLoadingAdminData(false);
      }
    };

    void loadAdminAnalytics();
  }, [adminMode, language]);

  const formatLastSeen = (iso: string | null) => {
    if (!iso) return t('No date', 'Pas de date');
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return t('No date', 'Pas de date');
    const now = Date.now();
    const diffMs = now - date.getTime();
    const minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes < 60) return language === 'fr' ? `il y a ${minutes} min` : `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return language === 'fr' ? `il y a ${hours}h` : `${hours}h ago`;
    const days = Math.round(hours / 24);
    return language === 'fr' ? `il y a ${days}j` : `${days}d ago`;
  };

  const xpDistribution = useMemo(() => {
    const buckets = [
      { name: '0-100', value: 0, color: '#d5e1eb' },
      { name: '100-500', value: 0, color: '#0f2b46' },
      { name: '500-1k', value: 0, color: '#4c7c59' },
      { name: '1k+', value: 0, color: '#c86b4a' }
    ];
    for (const entry of leaderboard) {
      if (entry.xp < 100) {
        buckets[0].value += 1;
      } else if (entry.xp < 500) {
        buckets[1].value += 1;
      } else if (entry.xp < 1000) {
        buckets[2].value += 1;
      } else {
        buckets[3].value += 1;
      }
    }
    return buckets;
  }, [leaderboard]);

  const topVerticalChampion = useMemo(() => {
    if (leaderboard.length === 0) return null;
    const totals = new Map<string, number>();
    for (const entry of leaderboard) {
      Object.entries(entry.verticalBreakdown ?? {}).forEach(([vertical, count]) => {
        totals.set(vertical, (totals.get(vertical) ?? 0) + (typeof count === 'number' ? count : 0));
      });
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0] ?? null;
  }, [leaderboard]);

  return (
    <div className="screen-shell">
      <ScreenHeader
        title={adminMode ? t('Investor Analytics', 'Analytique investisseur') : t('Leaderboard', 'Classement')}
        onBack={onBack}
        language={language}
        trailing={
          <button className="p-2 text-gray-400" aria-label={t('Share', 'Partager')}>
            <Share2 size={20} />
          </button>
        }
      />

      <div className="p-4 pb-24 space-y-6">
        {adminMode ? (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full border-2 border-white shadow bg-navy-light overflow-hidden">
                <ProfileAvatar preset={adminAvatar} alt={t('avatar', 'avatar')} className="w-full h-full" />
              </div>
              <div className="flex flex-col">
                <h4 className="font-bold text-gray-900 text-sm">
                  {adminName || adminEmail || t('Admin', 'Admin')}
                </h4>
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck size={12} className="text-forest" />
                  <span className="micro-label text-gray-400">{t('Senior Contributor', 'Contributeur senior')}</span>
                </div>
              </div>
            </div>
            {onAdmin && (
              <button
                onClick={onAdmin}
                className="px-3 py-1.5 bg-ink text-white micro-label rounded-xl hover:bg-black transition-colors shadow-sm"
              >
                {t('Admin', 'Admin')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between py-2">
            <div className="flex flex-col">
              <span className="micro-label text-gray-400">{t('Leaderboard', 'Classement')}</span>
              <span className="text-sm font-semibold text-gray-900">{t('Top contributors near you', 'Top contributeurs près de vous')}</span>
            </div>
          </div>
        )}

        {adminMode && onDeltaDashboard && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <button
              onClick={onDeltaDashboard}
              className="w-full flex items-center justify-between bg-navy text-white p-4 rounded-2xl shadow-sm hover:bg-navy-mid transition-colors"
            >
              <div className="flex items-center space-x-3">
                <BarChart3 size={18} />
                <div className="text-left">
                  <span className="text-xs font-bold block">{t('Delta Intelligence', 'Intelligence Delta')}</span>
                  <span className="text-[11px] text-gray-300">{t('Snapshots, trends & anomalies', 'Snapshots, tendances & anomalies')}</span>
                </div>
              </div>
              <ArrowLeft size={16} className="rotate-180" />
            </button>
            {onAgentPerformance && (
              <button
                onClick={onAgentPerformance}
                className="w-full flex items-center justify-between bg-white border border-gray-100 text-navy p-4 rounded-2xl shadow-sm hover:border-navy transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Users size={18} />
                  <div className="text-left">
                    <span className="text-xs font-bold block">{t('Agent Performance', 'Performance agents')}</span>
                    <span className="text-[11px] text-gray-500">{t('Quality, fraud & assignment pace', 'Qualite, fraude et rythme des affectations')}</span>
                  </div>
                </div>
                <ArrowLeft size={16} className="rotate-180" />
              </button>
            )}
          </div>
        )}

        {adminMode && (
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5 space-y-2">
              <span className="micro-label text-gray-400">{t('Data Complete', 'Données complètes')}</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-bold text-gray-900">{completionRate}%</span>
                <span className="text-[11px] text-forest font-bold">{isLoadingAdminData ? '...' : t('live', 'live')}</span>
              </div>
            </div>
            <div className="card p-5 space-y-2">
              <span className="micro-label text-gray-400">{t('Active Contributors', 'Contributeurs actifs')}</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-bold text-gray-900">{activeContributors}</span>
                <span className="text-[11px] text-navy font-bold">{t('30d', '30j')}</span>
              </div>
            </div>
          </div>
        )}

        {adminMode && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 size={16} className="text-navy" />
                <span className="micro-label text-gray-900">{t('Contributions by Category', 'Contributions par catégorie')}</span>
              </div>
              <span className="micro-label text-gray-400">{t('Live', 'Live')}</span>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`category-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {adminMode && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Medal size={16} className="text-forest" />
                <span className="micro-label text-gray-900">{t('XP Distribution', 'Distribution XP')}</span>
              </div>
              <span className="micro-label text-gray-400">{t('All Users', 'Tous les utilisateurs')}</span>
            </div>
            <div className="h-44 w-full flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={xpDistribution} dataKey="value" outerRadius={70} innerRadius={40}>
                    {xpDistribution.map((entry, index) => (
                      <Cell key={`xp-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {adminMode && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ThermometerSun size={16} className="text-terra" />
                <span className="micro-label text-gray-900">{t('Data Freshness Heatmap', 'Heatmap fraîcheur des données')}</span>
              </div>
              <span className="micro-label text-gray-400">{t('Last 24h', 'Dernieres 24h')}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {heatmap.flatMap((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`h-8 rounded-xl ${HEATMAP_COLORS[cell]}`}
                  />
                ))
              )}
            </div>
          </div>
        )}

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Medal size={16} className="text-navy" />
              <span className="micro-label text-gray-900">
                {adminMode ? t('Top Contributor Leaderboard', 'Classement des top contributeurs') : t('Top Contributors Near You', 'Top contributeurs près de vous')}
              </span>
            </div>
            <span className="micro-label text-gray-400">{adminMode ? t('Monthly', 'Mensuel') : t('Local', 'Local')}</span>
          </div>
          <div className="rounded-2xl bg-page p-4">
            <div className="micro-label text-gray-400">
              {t('How rankings work', 'Comment fonctionne le classement')}
            </div>
            <div className="mt-2 text-sm font-semibold text-gray-900">
              {t('Ranking score = submissions x average quality', 'Score = soumissions x qualité moyenne')}
            </div>
            {topVerticalChampion && (
              <div className="mt-2 text-xs text-gray-500">
                {t('Busiest category:', 'Catégorie la plus active :')} {categorylabel(topVerticalChampion[0] as SubmissionCategory)} ({topVerticalChampion[1]})
              </div>
            )}
          </div>
          <div className="space-y-3">
            {isLoadingLeaderboard && (
              <div className="bg-page border border-gray-100 rounded-2xl p-3 micro-label text-gray-400">
                {t('Loading contributors...', 'Chargement des contributeurs...')}
              </div>
            )}
            {!isLoadingLeaderboard && leaderboard.length === 0 && (
              <div className="bg-page border border-gray-100 rounded-2xl p-3 micro-label text-gray-400">
                {t('No contributor data yet.', 'Pas encore de données contributeur.')}
              </div>
            )}
            {!isLoadingLeaderboard &&
              leaderboard.map((entry) => (
                <div key={entry.userId} className="flex items-center justify-between bg-page border border-gray-100 rounded-2xl p-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">#{entry.rank} {entry.name}</p>
                    <p className="micro-label text-gray-400">
                      {entry.contributions} {t('submissions', 'soumissions')} • {formatLastSeen(entry.lastContributionAt)}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate max-w-[220px]">{entry.lastLocation}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {t('Ranking score', 'Score de classement')}: {entry.contributions} x {entry.averageQualityScore}% = {entry.rankingScore.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs font-bold text-navy">{t('Score', 'Score')}: {entry.rankingScore.toLocaleString()}</span>
                    <span className="block text-xs font-bold text-forest">{entry.xp.toLocaleString()} XP</span>
                    <span className="block micro-label text-gray-400">
                      {entry.averageQualityScore}% {t('quality', 'qualité')}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {adminMode && (
          <div className="bg-page p-6 rounded-2xl border-2 border-dashed border-gray-200 text-center space-y-3">
            <p className="micro-label text-navy">{t('API Monetization Ready', 'API prête à monétiser')}</p>
            <p className="text-xs text-gray-500">
              {t('Tiered access for municipalities, NGOs, and logistics providers with real-time SLAs.', 'Acces par paliers pour municipalites, ONG et logisticiens avec SLA temps reel.')}
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default Analytics;
