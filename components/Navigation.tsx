import React from 'react';
import { Screen } from '../types';
import { Map, PlusCircle, BarChart2, Medal, User } from 'lucide-react';

interface Props {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  language?: 'en' | 'fr';
}

const Navigation: React.FC<Props> = ({ currentScreen, onNavigate, isAuthenticated, isAdmin, language = 'en' }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const navItems = [
    { id: Screen.HOME, label: t('Explore', 'Explorer'), icon: Map },
    { id: Screen.CONTRIBUTE, label: t('Contribute', 'Contribuer'), icon: PlusCircle },
    {
      id: Screen.ANALYTICS,
      label: isAdmin ? t('Impact', 'Impact') : t('Leaderboard', 'Classement'),
      icon: isAdmin ? BarChart2 : Medal
    },
    { id: isAuthenticated ? Screen.PROFILE : Screen.AUTH, label: isAuthenticated ? t('Profile', 'Profil') : t('Sign In', 'Connexion'), icon: User }
  ];

  return (
    <nav className="h-16 bg-white border-t border-gray-200 flex items-center justify-around px-2 z-40">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center space-y-1 w-full transition-colors ${
              isActive ? 'text-[#0f2b46]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium tracking-tight uppercase">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default Navigation;
