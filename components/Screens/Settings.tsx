import React, { useEffect, useState } from 'react';
import {
  User,
  WifiOff,
  Bell,
  Contrast,
  Globe,
  LogOut,
  ChevronRight,
  FileText
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
    <div className="screen-shell">
      <ScreenHeader title={t('Settings & Profile', 'Param\u00e8tres et profil')} onBack={onBack} language={language} />

      <div className="space-y-8 p-4 pb-24 sm:p-6 sm:pb-24">
        <div className="space-y-4">
          <h4 className="micro-label-wide px-1 text-gray-500">{t('Available now', 'Disponible maintenant')}</h4>
          <div className="card divide-y divide-gray-50">
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors">
              <div className="flex items-center space-x-4">
                <div className="rounded-xl bg-navy-light p-2 text-navy"><User size={20} /></div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-gray-900">{t('Profile editing', 'Modification du profil')}</span>
                  <span className="text-xs text-gray-500">{t('Available soon. For now, use your account as it is.', 'Bientôt disponible. Pour l\'instant, utilisez votre compte tel quel.')}</span>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-gray-300" />
            </button>
            <div className="w-full flex items-center justify-between gap-4 p-4">
              <div className="flex items-center space-x-4">
                <div className="rounded-xl bg-navy-light p-2 text-navy"><Globe size={20} /></div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-gray-900">{t('Language', 'Langue')}</span>
                  <span className="text-xs text-gray-500">{t('Choose the language you want to read in the field.', 'Choisissez la langue à utiliser sur le terrain.')}</span>
                </div>
              </div>
              <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => onLanguageChange('en')}
                  className={`rounded-lg px-3 py-1 micro-label ${
                    language === 'en' ? 'bg-white text-navy shadow-sm' : 'text-gray-400'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('fr')}
                  className={`rounded-lg px-3 py-1 micro-label ${
                    language === 'fr' ? 'bg-white text-navy shadow-sm' : 'text-gray-400'
                  }`}
                >
                  FR
                </button>
              </div>
            </div>
            <div className="w-full flex items-center justify-between gap-4 p-4">
              <div className="flex items-center space-x-4">
                <div className="rounded-xl bg-navy-light p-2 text-navy"><Contrast size={20} /></div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-gray-900">{t('High contrast', 'Contraste élevé')}</span>
                  <span className="text-xs text-gray-500">{t('Boost legibility for bright daylight and low-battery screens.', 'Améliorez la lisibilité en plein jour et sur les écrans à faible batterie.')}</span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                aria-label={t('High Contrast', 'Contraste élevé')}
                onClick={() => setHighContrast((prev) => !prev)}
                className={`relative h-7 w-12 rounded-full transition-colors ${highContrast ? 'bg-navy' : 'bg-gray-200'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${highContrast ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="micro-label-wide px-1 text-gray-500">{t('Planned tools', 'Outils prévus')}</h4>
          <div className="card divide-y divide-gray-50">
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors text-left">
              <div className="flex items-center space-x-4">
                <div className="rounded-xl bg-navy-light p-2 text-navy"><WifiOff size={20} /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">{t('Offline uploads', 'Envois hors ligne')}</span>
                  <span className="text-xs text-gray-500">{t('A dedicated queue manager will appear here soon.', 'Un gestionnaire de file dédié apparaîtra bientôt ici.')}</span>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-gray-300" />
            </button>
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors text-left">
              <div className="flex items-center space-x-4">
                <div className="rounded-xl bg-navy-light p-2 text-navy"><Bell size={20} /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">{t('Notifications and data usage', 'Notifications et usage des données')}</span>
                  <span className="text-xs text-gray-500">{t('These controls are planned after the mobile review flow is stable.', 'Ces réglages arrivent après la stabilisation du flux mobile de revue.')}</span>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-gray-300" />
            </button>
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors text-left">
              <div className="flex items-center space-x-4">
                <div className="rounded-xl bg-navy-light p-2 text-navy"><FileText size={20} /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">{t('Privacy and security center', 'Centre confidentialité et sécurité')}</span>
                  <span className="text-xs text-gray-500">{t('Policies and account protection tools will live here soon.', 'Les politiques et outils de protection du compte seront bientôt ici.')}</span>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-gray-300" />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center space-y-6 pt-4">
          <button
            onClick={onLogout}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white text-sm font-semibold text-red-600 shadow-sm transition-all hover:bg-red-50"
          >
            <LogOut size={16} />
            <span>{t('Log Out', 'Déconnexion')}</span>
          </button>
          <div className="text-center">
            <BrandLogo size={18} className="mx-auto mb-2" />
            <p className="text-[11px] font-medium leading-4 text-gray-400">{t('African Data Layer v2.4.0 - Build 892', 'African Data Layer v2.4.0 - Build 892')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
