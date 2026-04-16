import React, { useEffect, useState } from 'react';
import {
  Check,
  Contrast,
  LogOut,
} from 'lucide-react';
import BrandLogo from '../BrandLogo';
import ScreenHeader from '../shared/ScreenHeader';

interface Props {
  onBack: () => void;
  onLogout: () => void;
  language: 'en' | 'fr';
  onLanguageChange: (language: 'en' | 'fr') => void;
}

const Settings: React.FC<Props> = ({ onBack, onLogout, language, onLanguageChange }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [highContrast, setHighContrast] = useState(() => {
    try { return localStorage.getItem('adl_high_contrast') === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
      try { localStorage.setItem('adl_high_contrast', '1'); } catch { /* private browsing */ }
    } else {
      document.documentElement.classList.remove('high-contrast');
      try { localStorage.removeItem('adl_high_contrast'); } catch { /* private browsing */ }
    }
  }, [highContrast]);

  return (
    <div data-testid="screen-settings" className="screen-shell bg-page">
      <ScreenHeader title={t('Settings', 'Paramètres')} onBack={onBack} language={language} />

      <div className="space-y-6 p-4 pb-24 sm:p-6 sm:pb-24">
        <div className="space-y-2">
          <h4 className="micro-label px-1 text-gray-400">{t('Language', 'Langue')}</h4>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50">
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className="flex w-full items-center justify-between px-4 min-h-[52px] transition-colors active:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-900">English</span>
              {language === 'en' && <Check size={18} className="text-navy shrink-0" />}
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('fr')}
              className="flex w-full items-center justify-between px-4 min-h-[52px] transition-colors active:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-900">Français</span>
              {language === 'fr' && <Check size={18} className="text-navy shrink-0" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="micro-label px-1 text-gray-400">{t('Display', 'Affichage')}</h4>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex w-full items-center justify-between px-4 min-h-[52px]">
              <div className="flex items-center gap-3">
                <Contrast size={18} className="text-gray-500 shrink-0" />
                <span className="text-sm font-medium text-gray-900">{t('High Contrast', 'Contraste élevé')}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                aria-label={t('High Contrast', 'Contraste élevé')}
                onClick={() => setHighContrast((prev) => !prev)}
                className={`relative h-8 w-14 rounded-full transition-colors ${highContrast ? 'bg-navy' : 'bg-gray-200'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-white shadow transition-transform ${highContrast ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="micro-label px-1 text-gray-400">{t('Account', 'Compte')}</h4>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 px-4 min-h-[52px] transition-colors active:bg-red-50"
            >
              <LogOut size={16} className="text-red-600" />
              <span className="text-sm font-semibold text-red-600">{t('Sign Out', 'Déconnexion')}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center pt-4">
          <BrandLogo size={18} className="mb-2" />
          <p className="text-[11px] font-medium leading-4 text-gray-400">African Data Layer v2.4.0</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
