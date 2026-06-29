import React from 'react';
import { ToggleRight, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Screen } from '../types';

interface Props {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  language?: 'en' | 'fr';
}

const tabs: Array<{ id: Screen; en: string; fr: string; icon: LucideIcon }> = [
  { id: Screen.POINT_OPERATOR_STATUS, en: "Status", fr: "Statut", icon: ToggleRight },
  { id: Screen.POINT_OPERATOR_PROFILE, en: "Profile", fr: "Profil", icon: User },
];

const PointOperatorNavigation: React.FC<Props> = ({
  currentScreen,
  onNavigate,
  language = 'en',
}) => {
  const t = (tab: (typeof tabs)[number]) => (language === 'fr' ? tab.fr : tab.en);

  return (
    <nav
      data-testid="point-operator-navigation"
      className="relative z-40 grid min-h-[calc(var(--bottom-nav-height)+var(--safe-bottom))] grid-cols-2 gap-2 border-t border-gray-200/90 bg-white px-4 pt-2 shadow-[0_-12px_32px_rgba(15,43,70,0.10)] pb-[var(--safe-bottom)]"
      aria-label={language === 'fr' ? 'Navigation operateur' : 'Operator navigation'}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const label = t(tab);
        const isActive = currentScreen === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onNavigate(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
            className={`flex min-h-[56px] items-center justify-center gap-2 rounded-[1.1rem] px-3 text-sm font-bold transition-colors ${
              isActive
                ? 'bg-navy text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                : 'bg-gray-50 text-gray-700 hover:bg-navy-wash hover:text-navy'
            }`}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default React.memo(PointOperatorNavigation);
