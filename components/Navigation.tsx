import React from 'react';
import { Screen } from '../types';
import { Map, PlusCircle, BarChart2, Medal, User, TrendingUp, LayoutDashboard } from 'lucide-react';

type UserRole = 'agent' | 'admin' | 'client';

interface Props {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  userRole?: UserRole;
  language?: 'en' | 'fr';
}

const Navigation: React.FC<Props> = ({ currentScreen, onNavigate, isAuthenticated, isAdmin, userRole = 'agent', language = 'en' }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const agentNav = [
    { id: Screen.HOME, label: t('Explore', 'Explorer'), icon: Map },
    { id: Screen.CONTRIBUTE, label: t('Contribute', 'Contribuer'), icon: PlusCircle },
    {
      id: Screen.ANALYTICS,
      label: isAdmin ? t('Impact', 'Impact') : t('Leaderboard', 'Classement'),
      icon: isAdmin ? BarChart2 : Medal
    },
    { id: isAuthenticated ? Screen.PROFILE : Screen.AUTH, label: isAuthenticated ? t('Profile', 'Profil') : t('Sign In', 'Connexion'), icon: User }
  ];

  const clientNav = [
    { id: Screen.DELTA_DASHBOARD, label: t('Dashboard', 'Tableau'), icon: LayoutDashboard },
    { id: Screen.HOME, label: t('Map', 'Carte'), icon: Map },
    { id: Screen.ANALYTICS, label: t('Insights', 'Analyses'), icon: TrendingUp },
    { id: isAuthenticated ? Screen.PROFILE : Screen.AUTH, label: isAuthenticated ? t('Account', 'Compte') : t('Sign In', 'Connexion'), icon: User }
  ];

  const navItems = userRole === 'client' ? clientNav : agentNav;

  return (
    <nav
      data-testid="main-navigation"
      className="z-40 flex min-h-[76px] items-end justify-around border-t border-gray-200 bg-white/98 px-1 pt-1 backdrop-blur-sm pb-[calc(0.5rem+var(--safe-bottom))]"
      aria-label={t('Main navigation', 'Navigation principale')}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            className={`flex min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-colors ${
              isActive ? 'bg-navy-wash text-navy' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={20} aria-hidden="true" />
            <span className="max-w-full truncate px-1 text-[0.72rem] font-semibold leading-none tracking-[0.01em]">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default React.memo(Navigation);
