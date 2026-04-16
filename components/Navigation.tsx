import React from 'react';
import { Screen } from '../types';
import {
  Map,
  PlusCircle,
  BarChart2,
  Medal,
  User,
  TrendingUp,
  LayoutDashboard,
} from 'lucide-react';

type UserRole = 'agent' | 'admin' | 'client';

interface Props {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  userRole?: UserRole;
  language?: 'en' | 'fr';
}

const Navigation: React.FC<Props> = ({
  currentScreen,
  onNavigate,
  isAuthenticated,
  isAdmin,
  userRole = 'agent',
  language = 'en',
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const agentNav = [
    { id: Screen.HOME, label: t('Explore', 'Explorer'), icon: Map },
    {
      id: Screen.CONTRIBUTE,
      label: t('Contribute', 'Contribuer'),
      icon: PlusCircle,
    },
    {
      id: Screen.ANALYTICS,
      label: isAdmin ? t('Impact', 'Impact') : t('Leaderboard', 'Classement'),
      icon: isAdmin ? BarChart2 : Medal,
    },
    {
      id: isAuthenticated ? Screen.PROFILE : Screen.AUTH,
      label: isAuthenticated
        ? t('Profile', 'Profil')
        : t('Sign In', 'Connexion'),
      icon: User,
    },
  ];

  const clientNav = [
    {
      id: Screen.DELTA_DASHBOARD,
      label: t('Dashboard', 'Tableau'),
      icon: LayoutDashboard,
    },
    { id: Screen.HOME, label: t('Map', 'Carte'), icon: Map },
    {
      id: Screen.ANALYTICS,
      label: t('Insights', 'Analyses'),
      icon: TrendingUp,
    },
    {
      id: isAuthenticated ? Screen.PROFILE : Screen.AUTH,
      label: isAuthenticated
        ? t('Account', 'Compte')
        : t('Sign In', 'Connexion'),
      icon: User,
    },
  ];

  const navItems = userRole === 'client' ? clientNav : agentNav;

  return (
    <nav
      data-testid="main-navigation"
      className="z-40 flex min-h-[calc(var(--bottom-nav-height)+var(--safe-bottom))] items-start justify-around gap-1 border-t border-gray-200/90 bg-white/98 px-3 pt-2 shadow-[0_-12px_32px_rgba(15,43,70,0.08)] backdrop-blur-xl pb-[var(--safe-bottom)]"
      aria-label={t('Main navigation', 'Navigation principale')}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        const isContribute = item.id === Screen.CONTRIBUTE;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            className={`flex min-h-[54px] w-full flex-1 flex-col items-center justify-center gap-1 rounded-[1.35rem] px-2 transition-all ${
              isActive
                ? 'bg-navy-wash text-navy shadow-[inset_0_0_0_1px_rgba(15,43,70,0.06)]'
                : isContribute
                  ? 'text-terra hover:bg-terra-wash hover:text-terra-dark'
                  : 'text-gray-500 hover:bg-white hover:text-gray-700'
            }`}
          >
            <Icon size={19} aria-hidden="true" />
            <span className="max-w-full truncate px-1 text-[0.6875rem] font-semibold leading-none tracking-[0.01em]">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default React.memo(Navigation);
