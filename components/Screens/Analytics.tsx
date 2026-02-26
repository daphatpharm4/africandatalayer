import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Medal,
  Share2,
  ShieldCheck,
  ThermometerSun
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
import type { LeaderboardEntry, MapScope, PointEvent, ProjectedPoint, SubmissionCategory, UserProfile } from '../../shared/types';

interface Props {
  onBack: () => void;
  onAdmin?: () => void;
  isAdmin?: boolean;
  language: 'en' | 'fr';
}

type HeatLevel = 'High' | 'Medium' | 'Low';

const HEATMAP_COLORS: Record<HeatLevel, string> = {
  High: 'bg-[#4c7c59]',
  Medium: 'bg-[#c86b4a]',
  Low: 'bg-gray-200'
};

const normalizeMapScope = (scope: unknown, isAdminMode: boolean): MapScope => {
  if (scope === 'global') return 'global';
  if (scope === 'cameroon') return isAdminMode ? 'global' : 'cameroon';
  return 'bonamoussadi';
};

const Analytics: React.FC<Props> = ({ onBack, onAdmin, isAdmin, language }) => {
  const adminMode = Boolean(isAdmin);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
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

  const categoryLabel = (category: SubmissionCategory): string => {
    if (category === 'pharmacy') return t('Pharmacies', 'Pharmacies');
    if (category === 'fuel_station') return t('Fuel Stations', 'Stations-service');
    return t('Mobile Money Kiosks', 'Kiosques mobile money');
  };

  useEffect(() => {
    if (!adminMode) return;
    const loadSession = async () => {
      const session = await getSession();
      setAdminName(session?.user?.name ?? null);
      setAdminEmail(session?.user?.email ?? null);
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

        const profile = await apiJson<UserProfile>('/api/user');
        const scope = normalizeMapScope(profile?.mapScope, true);

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

        const categoryCounts: Record<SubmissionCategory, number> = {
          pharmacy: 0,
          fuel_station: 0,
          mobile_money: 0
        };
        for (const event of safeEvents) {
          if (event.category in categoryCounts) categoryCounts[event.category] += 1;
        }
        setCategoryData([
          { name: categoryLabel('pharmacy'), value: categoryCounts.pharmacy, color: '#2f855a' },
          { name: categoryLabel('fuel_station'), value: categoryCounts.fuel_station, color: '#0f2b46' },
          { name: categoryLabel('mobile_money'), value: categoryCounts.mobile_money, color: '#c86b4a' }
        ]);

        const categories: SubmissionCategory[] = ['pharmacy', 'fuel_station', 'mobile_money'];
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
        setCategoryData([
          { name: categoryLabel('pharmacy'), value: 0, color: '#2f855a' },
          { name: categoryLabel('fuel_station'), value: 0, color: '#0f2b46' },
          { name: categoryLabel('mobile_money'), value: 0, color: '#c86b4a' }
        ]);
        setHeatmap([
          ['Low', 'Low', 'Low', 'Low'],
          ['Low', 'Low', 'Low', 'Low'],
          ['Low', 'Low', 'Low', 'Low']
        ]);
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

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:text-[#0f2b46] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">{adminMode ? t('Investor Analytics', 'Analytique investisseur') : t('Leaderboard', 'Classement')}</h3>
        <button className="p-2 text-gray-400 absolute right-2">
          <Share2 size={20} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {adminMode ? (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full border-2 border-white shadow bg-[#e7eef4] overflow-hidden">
                <img src="https://picsum.photos/seed/kofi/300/300" alt={t('avatar', 'avatar')} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <h4 className="font-bold text-gray-900 text-sm">
                  {adminName || adminEmail || t('Admin', 'Admin')}
                </h4>
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck size={12} className="text-[#4c7c59]" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Senior Contributor', 'Contributeur senior')}</span>
                </div>
              </div>
            </div>
            {onAdmin && (
              <button
                onClick={onAdmin}
                className="px-3 py-1.5 bg-[#1f2933] text-white text-[10px] font-bold uppercase rounded-xl tracking-wider hover:bg-black transition-colors shadow-sm"
              >
                {t('Admin', 'Admin')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between py-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Leaderboard', 'Classement')}</span>
              <span className="text-sm font-semibold text-gray-900">{t('Top contributors near you', 'Top contributeurs pres de vous')}</span>
            </div>
          </div>
        )}

        {adminMode && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Data Complete', 'Donnees completes')}</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-bold text-gray-900">{completionRate}%</span>
                <span className="text-[10px] text-[#4c7c59] font-bold">{isLoadingAdminData ? '...' : t('live', 'live')}</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Active Contributors', 'Contributeurs actifs')}</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-bold text-gray-900">{activeContributors}</span>
                <span className="text-[10px] text-[#0f2b46] font-bold">{t('30d', '30j')}</span>
              </div>
            </div>
          </div>
        )}

        {adminMode && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 size={16} className="text-[#0f2b46]" />
                <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">{t('Contributions by Category', 'Contributions par categorie')}</span>
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">{t('Live', 'Live')}</span>
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
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Medal size={16} className="text-[#4c7c59]" />
                <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">{t('XP Distribution', 'Distribution XP')}</span>
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">{t('All Users', 'Tous les utilisateurs')}</span>
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
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ThermometerSun size={16} className="text-[#c86b4a]" />
                <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">{t('Data Freshness Heatmap', 'Heatmap fraicheur des donnees')}</span>
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">{t('Last 24h', 'Dernieres 24h')}</span>
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

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Medal size={16} className="text-[#0f2b46]" />
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">
                {adminMode ? t('Top Contributor Leaderboard', 'Classement des top contributeurs') : t('Top Contributors Near You', 'Top contributeurs pres de vous')}
              </span>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">{adminMode ? t('Monthly', 'Mensuel') : t('Local', 'Local')}</span>
          </div>
          <div className="space-y-3">
            {isLoadingLeaderboard && (
              <div className="bg-[#f9fafb] border border-gray-100 rounded-2xl p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {t('Loading contributors...', 'Chargement des contributeurs...')}
              </div>
            )}
            {!isLoadingLeaderboard && leaderboard.length === 0 && (
              <div className="bg-[#f9fafb] border border-gray-100 rounded-2xl p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {t('No contributor data yet.', 'Pas encore de donnees contributeur.')}
              </div>
            )}
            {!isLoadingLeaderboard &&
              leaderboard.map((entry) => (
                <div key={entry.userId} className="flex items-center justify-between bg-[#f9fafb] border border-gray-100 rounded-2xl p-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">#{entry.rank} {entry.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                      {entry.contributions} {t('submissions', 'soumissions')} • {formatLastSeen(entry.lastContributionAt)}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate max-w-[180px]">{entry.lastLocation}</p>
                  </div>
                  <span className="text-xs font-bold text-[#4c7c59]">{entry.xp.toLocaleString()} XP</span>
                </div>
              ))}
          </div>
        </div>

        {adminMode && (
          <div className="bg-[#f9fafb] p-6 rounded-2xl border-2 border-dashed border-gray-200 text-center space-y-3">
            <p className="text-[10px] font-bold text-[#0f2b46] uppercase tracking-widest">{t('API Monetization Ready', 'API prete a monetiser')}</p>
            <p className="text-xs text-gray-500">
              {t('Tiered access for municipalities, NGOs, and logistics providers with real-time SLAs.', 'Acces par paliers pour municipalites, ONG et logisticiens avec SLA temps reel.')}
            </p>
          </div>
        )}

        <div className="h-24"></div>
      </div>
    </div>
  );
};

export default Analytics;
