import React from 'react';
import {
  ArrowLeft,
  User,
  Shield,
  WifiOff,
  BarChart,
  Bell,
  Globe,
  LogOut,
  ChevronRight,
  FileText
} from 'lucide-react';

interface Props {
  onBack: () => void;
  onLogout: () => void;
  language: 'en' | 'fr';
  onLanguageChange: (language: 'en' | 'fr') => void;
}

const Settings: React.FC<Props> = ({ onBack, onLogout, language, onLanguageChange }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-bold mx-auto">{t('Settings & Profile', 'Parametres et profil')}</h3>
        <div className="w-8"></div>
      </div>

      <div className="p-6 space-y-8">
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">{t('Account', 'Compte')}</h4>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-[#e7eef4] text-[#0f2b46] rounded-xl"><User size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Edit Profile Info', 'Modifier le profil')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-[#e7eef4] text-[#0f2b46] rounded-xl"><Shield size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Security & Password', 'Securite et mot de passe')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">{t('Data & Connectivity', 'Donnees et connectivite')}</h4>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-[#e7eef4] text-[#0f2b46] rounded-xl"><WifiOff size={20} /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">{t('Offline Sync Settings', 'Synchronisation hors ligne')}</span>
                  <span className="text-[10px] text-gray-400 font-medium">{t('Last synced: 2m ago', 'Derniere sync: il y a 2 min')}</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-[#e7eef4] text-[#0f2b46] rounded-xl"><BarChart size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Data Usage & Limits', 'Usage et limites')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">{t('Preferences', 'Preferences')}</h4>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-[#e7eef4] text-[#0f2b46] rounded-xl"><Bell size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Notifications', 'Notifications')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <div className="w-full flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-[#e7eef4] text-[#0f2b46] rounded-xl"><Globe size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Language', 'Langue')}</span>
              </div>
              <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => onLanguageChange('en')}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg ${
                    language === 'en' ? 'bg-white text-[#0f2b46] shadow-sm' : 'text-gray-400'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('fr')}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg ${
                    language === 'fr' ? 'bg-white text-[#0f2b46] shadow-sm' : 'text-gray-400'
                  }`}
                >
                  FR
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">{t('Privacy & Terms', 'Confidentialite et conditions')}</h4>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-[#e7eef4] text-[#0f2b46] rounded-xl"><FileText size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Privacy Terms', 'Conditions de confidentialite')}</span>
              </div>
              <ChevronRight size={18} className="text-gray-300" />
            </button>
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-[#e7eef4] text-[#0f2b46] rounded-xl"><Shield size={20} /></div>
                <span className="text-sm font-bold text-gray-900">{t('Data Usage', 'Utilisation des donnees')}</span>
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
            <span>{t('Log Out', 'Deconnexion')}</span>
          </button>
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">African Data Layer v2.4.0 (Build 892)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
