import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronRight,
  Contrast,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import BrandLogo from '../BrandLogo';
import ScreenHeader from '../shared/ScreenHeader';
import { Screen } from '../../types';
import { apiJson } from '../../lib/client/api';
import DeleteAccountPanel from '../shared/DeleteAccountPanel';

interface Props {
  onBack: () => void;
  onLogout: () => void;
  language: 'en' | 'fr';
  onLanguageChange: (language: 'en' | 'fr') => void;
  navigateTo: (screen: Screen) => void;
  userRole?: 'agent' | 'admin' | 'client' | 'point_operator';
}

const Settings: React.FC<Props> = ({ onBack, onLogout, language, onLanguageChange, navigateTo, userRole }) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const [highContrast, setHighContrast] = useState(() => {
    try { return localStorage.getItem('adl_high_contrast') === '1'; } catch { return false; }
  });

  const [smsConsent, setSmsConsent] = useState<{
    optedIn: boolean;
    lastChangedAt: string | null;
    lastSource: string | null;
  } | null>(null);
  const [smsConsentSaving, setSmsConsentSaving] = useState(false);
  const [smsConsentError, setSmsConsentError] = useState('');

  useEffect(() => {
    if (userRole === 'client') return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiJson<{ optedIn: boolean; lastChangedAt: string | null; lastSource: string | null }>(
          '/api/user?view=sms-consent',
        );
        if (!cancelled) setSmsConsent(data);
      } catch (error) {
        if (!cancelled) {
          setSmsConsentError(error instanceof Error ? error.message : 'load_failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userRole]);

  const toggleSmsConsent = async (next: boolean) => {
    setSmsConsentSaving(true);
    setSmsConsentError('');
    try {
      await apiJson('/api/user?view=sms-consent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consented: next }),
      });
      setSmsConsent({
        optedIn: next,
        lastChangedAt: new Date().toISOString(),
        lastSource: 'settings',
      });
    } catch (error) {
      setSmsConsentError(error instanceof Error ? error.message : 'save_failed');
    } finally {
      setSmsConsentSaving(false);
    }
  };

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
        {userRole === 'client' && (
          <>
            <section className="route-grid relative mx-4 my-4 flex items-center gap-3.5 overflow-hidden rounded-[20px] bg-navy p-5">
              <div
                className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#c86b4a,#0f2b46)', border: '2px solid rgba(255,255,255,0.2)' }}
              >
                C
              </div>
              <div className="relative">
                <div className="text-base font-bold text-white">{t('Your Organization', 'Votre organisation')}</div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  {t('Data client · Bonamoussadi', 'Client data · Bonamoussadi')}
                </div>
                <span className="micro-label mt-1.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/70">
                  {t('Client', 'Client')}
                </span>
              </div>
            </section>

            {[
              {
                id: 'data-access',
                title: t('Data Access', 'Accès aux données'),
                items: [
                  { id: 'subscription', label: t('Active subscription', 'Abonnement actif'), onSelect: () => {} },
                  { id: 'api-key', label: t('API key management', 'Gestion clé API'), onSelect: () => {} },
                  { id: 'webhooks', label: t('Webhook endpoints', 'Points Webhook'), onSelect: () => {} },
                ],
              },
              {
                id: 'export',
                title: t('Export', 'Export'),
                items: [
                  { id: 'csv', label: t('Download CSV', 'Télécharger CSV'), onSelect: () => {} },
                  { id: 'geojson', label: t('Download GeoJSON', 'Télécharger GeoJSON'), onSelect: () => {} },
                  { id: 'scheduled', label: t('Scheduled exports', 'Exports planifiés'), onSelect: () => {} },
                ],
              },
              {
                id: 'account',
                title: t('Account', 'Compte'),
                items: [
                  { id: 'profile', label: t('Profile settings', 'Paramètres profil'), onSelect: () => {} },
                  { id: 'billing', label: t('Billing', 'Facturation'), onSelect: () => {} },
                  { id: 'signout', label: t('Sign out', 'Se déconnecter'), onSelect: onLogout },
                ],
              },
            ].map((section) => (
              <section key={section.id} className="px-4 pb-3.5">
                <div className="micro-label mb-2 text-[10px] text-gray-400">{section.title}</div>
                <div className="card-soft overflow-hidden">
                  {section.items.map((item, i, arr) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onSelect}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left motion-pressable ${
                        i < arr.length - 1 ? 'border-b border-gray-50' : ''
                      }`}
                    >
                      <span className="text-[13px] font-medium text-gray-700">{item.label}</span>
                      <ChevronRight size={14} className="text-gray-400" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

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

        {userRole !== 'client' && (
          <div className="space-y-2">
            <h4 className="micro-label px-1 text-gray-400">{t('Notifications', 'Notifications')}</h4>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex flex-1 items-start gap-3">
                  <MessageSquare size={18} className="mt-0.5 text-gray-500 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {t('SMS notifications', 'Notifications SMS')}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                      {t(
                        'Receive operational SMS (assignments, payouts, system notices). Reply STOP anytime to opt out.',
                        "Recevoir des SMS (missions, paiements, avis système). Répondez STOP à tout moment.",
                      )}
                    </div>
                    {smsConsent?.lastChangedAt && (
                      <div className="mt-1 text-[10px] text-gray-400">
                        {t('Last changed', 'Dernière modification')}:{' '}
                        {new Date(smsConsent.lastChangedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}
                      </div>
                    )}
                    {smsConsentError && (
                      <div className="mt-1 text-[11px] text-red-600">{smsConsentError}</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={smsConsent?.optedIn ?? false}
                  aria-label={t('SMS notifications', 'Notifications SMS')}
                  disabled={smsConsentSaving || smsConsent === null}
                  onClick={() => void toggleSmsConsent(!smsConsent?.optedIn)}
                  className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                    smsConsent?.optedIn ? 'bg-navy' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                      smsConsent?.optedIn ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="micro-label px-1 text-gray-400">{t('Legal', 'Légal')}</h4>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50">
            {[
              { label: t('Privacy Policy', 'Politique de confidentialité'), screen: Screen.PRIVACY_POLICY, testId: 'settings-legal-privacy' },
              { label: t('Terms of Use', "Conditions d'utilisation"), screen: Screen.TERMS_OF_USE, testId: 'settings-legal-terms' },
              { label: t('Data & Compliance', 'Données et conformité'), screen: Screen.DATA_COMPLIANCE, testId: 'settings-legal-compliance' },
              { label: t('Report IP Infringement', 'Signaler une atteinte PI'), screen: Screen.IP_REPORT, testId: 'settings-legal-ip' },
            ].map((item) => (
              <button
                key={item.screen}
                type="button"
                onClick={() => navigateTo(item.screen)}
                data-testid={item.testId}
                className="flex w-full items-center justify-between px-4 min-h-[52px] active:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-900">{item.label}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
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

        <DeleteAccountPanel language={language} />

        <div className="flex flex-col items-center pt-4">
          <BrandLogo size={18} className="mb-2" />
          <p className="text-[11px] font-medium leading-4 text-gray-400">African Data Layer v2.4.0</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
