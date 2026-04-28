import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  LogOut,
  Mail,
  Settings as SettingsIcon,
  ShieldCheck,
} from 'lucide-react';
import { apiJson } from '../../lib/client/api';
import type { UserProfile } from '../../shared/types';
import ScreenHeader from '../shared/ScreenHeader';
import { Screen } from '../../types';

interface Props {
  onBack: () => void;
  onSettings: () => void;
  onOpenDocs: () => void;
  onLogout: () => void;
  navigateTo: (screen: Screen) => void;
  language: 'en' | 'fr';
}

const ClientAccount: React.FC<Props> = ({
  onBack,
  onSettings,
  onOpenDocs,
  onLogout,
  navigateTo,
  language,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setLoadError('');
        const data = await apiJson<UserProfile>('/api/user');
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) {
          setLoadError(t('Unable to load account.', 'Impossible de charger le compte.'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = profile?.name || t('Client', 'Client');
  const initial = (displayName || 'C').trim().charAt(0).toUpperCase() || 'C';
  const email = profile?.email || '';

  const legalItems: Array<{ label: string; screen: Screen; testId: string }> = [
    {
      label: t('Privacy Policy', 'Politique de confidentialité'),
      screen: Screen.PRIVACY_POLICY,
      testId: 'client-account-legal-privacy',
    },
    {
      label: t('Terms of Use', "Conditions d'utilisation"),
      screen: Screen.TERMS_OF_USE,
      testId: 'client-account-legal-terms',
    },
    {
      label: t('Data & Compliance', 'Données et conformité'),
      screen: Screen.DATA_COMPLIANCE,
      testId: 'client-account-legal-compliance',
    },
    {
      label: t('Report IP Infringement', 'Signaler une atteinte PI'),
      screen: Screen.IP_REPORT,
      testId: 'client-account-legal-ip',
    },
  ];

  return (
    <div data-testid="screen-client-account" className="screen-shell bg-page">
      <ScreenHeader
        title={t('Account', 'Compte')}
        onBack={onBack}
        language={language}
        trailing={
          <button
            type="button"
            onClick={onSettings}
            className="flex h-11 w-11 items-center justify-center text-navy"
            aria-label={t('Open settings', 'Ouvrir les paramètres')}
          >
            <SettingsIcon size={20} />
          </button>
        }
      />

      <div className="space-y-5 p-4 pb-24">
        <section className="route-grid relative overflow-hidden rounded-[20px] bg-navy p-5 text-white">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border-[3px] border-white/20 bg-gradient-to-br from-terra to-navy text-lg font-bold text-white shadow-lg shadow-navy/30"
              aria-hidden="true"
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold leading-tight">
                  {isLoading ? t('Loading account', 'Chargement du compte') : displayName}
                </h2>
                <span className="micro-label rounded-full bg-white/15 px-2 py-0.5 text-white/80">
                  {t('Client', 'Client')}
                </span>
              </div>
              {email && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                  <Mail size={12} />
                  <span className="truncate">{email}</span>
                </div>
              )}
            </div>
          </div>
          {loadError && (
            <div className="mt-3 micro-label text-white/70">{loadError}</div>
          )}
        </section>

        <section>
          <h3 className="micro-label mb-2 px-1 text-gray-500">
            {t('Resources', 'Ressources')}
          </h3>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50">
            <button
              type="button"
              onClick={onOpenDocs}
              data-testid="client-account-help-center"
              className="flex w-full items-center justify-between gap-3 px-4 min-h-[52px] active:bg-gray-50"
            >
              <span className="flex items-center gap-3">
                <BookOpen size={18} className="text-navy" />
                <span className="text-sm font-medium text-gray-900">
                  {t('Help Center', "Centre d'aide")}
                </span>
              </span>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
            <button
              type="button"
              onClick={onSettings}
              data-testid="client-account-open-settings"
              className="flex w-full items-center justify-between gap-3 px-4 min-h-[52px] active:bg-gray-50"
            >
              <span className="flex items-center gap-3">
                <SettingsIcon size={18} className="text-navy" />
                <span className="text-sm font-medium text-gray-900">
                  {t('Account & data preferences', 'Compte et préférences de données')}
                </span>
              </span>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          </div>
        </section>

        <section>
          <h3 className="micro-label mb-2 px-1 text-gray-500">{t('Legal', 'Légal')}</h3>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50">
            {legalItems.map((item) => (
              <button
                key={item.screen}
                type="button"
                onClick={() => navigateTo(item.screen)}
                data-testid={item.testId}
                className="flex w-full items-center justify-between gap-3 px-4 min-h-[52px] active:bg-gray-50"
              >
                <span className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-navy" />
                  <span className="text-sm font-medium text-gray-900">{item.label}</span>
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <button
              type="button"
              onClick={onLogout}
              data-testid="client-account-sign-out"
              className="flex w-full items-center justify-center gap-2 px-4 min-h-[52px] transition-colors active:bg-red-50"
            >
              <LogOut size={16} className="text-red-600" />
              <span className="text-sm font-semibold text-red-600">
                {t('Sign Out', 'Déconnexion')}
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ClientAccount;
