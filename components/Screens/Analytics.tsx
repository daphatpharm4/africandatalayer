import React, { useEffect, useState } from 'react';
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
import type { LeaderboardEntry } from '../../shared/types';

interface Props {
  onBack: () => void;
  onAdmin?: () => void;
  isAdmin?: boolean;
  language: 'en' | 'fr';
}

const CITY_DATA = [
  { name: 'Douala', value: 1248 },
  { name: 'Lagos', value: 980 },
  { name: 'Accra', value: 640 },
  { name: 'Nairobi', value: 520 }
];

const XP_DISTRIBUTION = [
  { name: '0-100', value: 240 },
  { name: '100-500', value: 420 },
  { name: '500-1k', value: 260 },
  { name: '1k+', value: 110 }
];

const HEATMAP = [
  ['High', 'High', 'Medium', 'Low'],
  ['Medium', 'High', 'Medium', 'Low'],
  ['Low', 'Medium', 'High', 'Medium']
];

const Analytics: React.FC<Props> = ({ onBack, onAdmin, isAdmin, language }) => {
  const adminMode = Boolean(isAdmin);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  useEffect(() => {
    if (!adminMode) return;
    const loadSession = async () => {
      const session = await getSession();
      setAdminName(session?.user?.name ?? null);
      setAdminEmail(session?.user?.email ?? null);
    };
    loadSession();
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

    loadLeaderboard();
  }, []);

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
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('% Approved', '% Approuves')}</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-bold text-gray-900">92%</span>
              <span className="text-[10px] text-[#4c7c59] font-bold">+4%</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Active Cities', 'Villes actives')}</span>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-bold text-gray-900">18</span>
              <span className="text-[10px] text-[#0f2b46] font-bold">+3</span>
            </div>
          </div>
        </div>
        )}

        {adminMode && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 size={16} className="text-[#0f2b46]" />
              <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">{t('Contributions per City', 'Contributions par ville')}</span>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">{t('Weekly', 'Hebdo')}</span>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CITY_DATA} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                  {CITY_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#0f2b46' : '#d5e1eb'} />
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
                <Pie data={XP_DISTRIBUTION} dataKey="value" outerRadius={70} innerRadius={40}>
                  {XP_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#0f2b46', '#4c7c59', '#c86b4a', '#d5e1eb'][index]} />
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
            {HEATMAP.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`h-8 rounded-xl ${
                    cell === 'High'
                      ? 'bg-[#4c7c59]'
                      : cell === 'Medium'
                      ? 'bg-[#c86b4a]'
                      : 'bg-gray-200'
                  }`}
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
