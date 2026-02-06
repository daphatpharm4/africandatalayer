import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Calendar,
  Gift,
  MapPin,
  Settings as SettingsIcon,
  Wallet
} from 'lucide-react';
import { apiJson } from '../../lib/client/api';
import { getSession } from '../../lib/client/auth';
import type { Submission, UserProfile } from '../../shared/types';

interface Props {
  onBack: () => void;
  onSettings: () => void;
  onRedeem: () => void;
  language: 'en' | 'fr';
}

const Profile: React.FC<Props> = ({ onBack, onSettings, onRedeem, language }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [userLocation, setUserLocation] = useState(t('Location not set', 'Position non definie'));
  const [history, setHistory] = useState<Array<{ id: string; date: string; location: string; type: string; xp: number }>>([]);

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

  const submissionToHistory = (submission: Submission) => {
    const details = (submission.details ?? {}) as Record<string, unknown>;
    const siteName = typeof details.siteName === 'string' ? details.siteName : null;
    const locationLabel = siteName || `GPS: ${submission.location.latitude.toFixed(4)}°, ${submission.location.longitude.toFixed(4)}°`;
    const typeLabel = submission.category === 'fuel_station' ? t('Fuel Price', 'Prix carburant') : t('Kiosk Availability', 'Disponibilite kiosque');
    const rawXp = details.xpAwarded;
    const xpAwarded = typeof rawXp === 'number' && Number.isFinite(rawXp) ? rawXp : 5;

    return {
      id: submission.id,
      date: formatHistoryDate(submission.createdAt),
      location: locationLabel,
      type: typeLabel,
      xp: xpAwarded
    };
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        setLoadError('');
        const data = await apiJson<UserProfile>('/api/user');
        setProfile(data);

        try {
          const [session, submissions] = await Promise.all([
            getSession(),
            apiJson<Submission[]>('/api/submissions')
          ]);
          const userId = session?.user?.id?.toLowerCase().trim();
          if (!userId) {
            setHistory([]);
            setUserLocation(t('Location not set', 'Position non definie'));
            return;
          }

          const ownSubmissions = submissions
            .filter((submission) => (typeof submission.userId === 'string' ? submission.userId.toLowerCase().trim() : '') === userId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          setHistory(ownSubmissions.map(submissionToHistory));

          const latest = ownSubmissions[0];
          if (latest) {
            const details = (latest.details ?? {}) as Record<string, unknown>;
            const siteName = typeof details.siteName === 'string' ? details.siteName : null;
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
              profile?.name || profile?.email || t('Contributor', 'Contributeur')
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

        <div className="bg-[#0f2b46] rounded-2xl p-6 text-white shadow-xl flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{t('XP Balance', 'Solde XP')}</span>
            <div className="flex items-baseline space-x-1">
              {isLoading ? (
                <div className="h-8 w-24 rounded-lg bg-white/20 animate-pulse"></div>
              ) : (
                <>
                  <h3 className="text-3xl font-extrabold tracking-tight">{profile?.XP?.toLocaleString?.() ?? '0'}</h3>
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
              <Calendar size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t('Badges', 'Badges')}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gray-900">7</span>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('Next: Urban Validator', 'Suivant : Validateur urbain')}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('Contribution History', 'Historique des contributions')}</h4>
            <button className="text-[10px] font-bold text-[#0f2b46] uppercase">{t('View All', 'Voir tout')}</button>
          </div>

          <div className="space-y-3">
            {history.length === 0 && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
                {t('No contributions yet. Add your first report to build your history.', 'Aucune contribution pour le moment. Ajoutez votre premier signalement pour construire votre historique.')}
              </div>
            )}
            {history.map((act) => (
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
        <div className="h-24"></div>
      </div>
    </div>
  );
};

export default Profile;
