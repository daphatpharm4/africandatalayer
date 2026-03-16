import React, { useEffect, useState } from 'react';
import {
  User,
  Shield,
  WifiOff,
  BarChart,
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

      <div className="p-6 space-y-8">
        <div className="space-y-4">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">{t('Account', 'Compte')}</h4>
          <div className="card divide-y divide-gray-50">
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-navy-light text-navy rounded-xl"><User size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Edit Profile Info (Coming soon)', 'Modifier le profil (Bientôt)')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-navy-light text-navy rounded-xl"><Shield size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Security & Password (Coming soon)', 'Sécurité et mot de passe (Bientôt)')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">{t('Data & Connectivity', 'Données et connectivité')}</h4>
          <div className="card divide-y divide-gray-50">
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors text-left">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-navy-light text-navy rounded-xl"><WifiOff size={20} /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">{t('Offline & Uploads (Coming soon)', 'Hors ligne et envois (Bientôt)')}</span>
                  <span className="text-[11px] text-gray-400 font-medium">{t('Last upload: 2m ago', 'Dernier envoi : il y a 2 min')}</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-navy-light text-navy rounded-xl"><BarChart size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Data Usage & Limits (Coming soon)', 'Utilisation des données (Bientôt)')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">{t('Preferences', 'Préférences')}</h4>
          <div className="card divide-y divide-gray-50">
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-navy-light text-navy rounded-xl"><Bell size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Notifications (Coming soon)', 'Notifications (Bientôt)')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <div className="w-full flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-navy-light text-navy rounded-xl"><Globe size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Language', 'Langue')}</span>
              </div>
              <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => onLanguageChange('en')}
                  className={`px-3 py-1 micro-label rounded-lg ${
                    language === 'en' ? 'bg-white text-navy shadow-sm' : 'text-gray-400'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('fr')}
                  className={`px-3 py-1 micro-label rounded-lg ${
                    language === 'fr' ? 'bg-white text-navy shadow-sm' : 'text-gray-400'
                  }`}
                >
                  FR
                </button>
              </div>
            </div>
            <div className="w-full flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-navy-light text-navy rounded-xl"><Contrast size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('High Contrast', 'Contraste élevé')}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                aria-label={t('High Contrast', 'Contraste \u00e9lev\u00e9')}
                onClick={() => setHighContrast((prev) => !prev)}
                className={`relative w-12 h-7 rounded-full transition-colors ${highContrast ? 'bg-navy' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${highContrast ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">{t('Privacy & Terms', 'Confidentialité et conditions')}</h4>
          <div className="card divide-y divide-gray-50">
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-navy-light text-navy rounded-xl"><FileText size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Privacy Terms (Coming soon)', 'Conditions de confidentialité (Bientôt)')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <button disabled className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-navy-light text-navy rounded-xl"><Shield size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Data Usage (Coming soon)', 'Utilisation des données (Bientôt)')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          </div>
        </div>

        <div className="pt-4 flex flex-col items-center space-y-6">
          <button
            onClick={onLogout}
            className="w-full h-14 bg-white text-red-600 border border-red-100 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-sm hover:bg-red-50 transition-all flex items-center justify-center space-x-2"
          >
            <LogOut size={16} />
            <span>{t('Log Out', 'Déconnexion')}</span>
          </button>
          <div className="text-center">
            <BrandLogo size={18} className="mx-auto mb-2" />
            <p className="micro-label-wide text-gray-300">{t('African Data Layer v2.4.0 (Build 892)', 'African Data Layer v2.4.0 (Compilation 892)')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
