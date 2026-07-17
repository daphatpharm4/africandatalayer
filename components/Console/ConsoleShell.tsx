import React from 'react';
import type { PlatformOrganization, PlatformRole } from '../../shared/platformTypes';
import type { ConsoleRoute, ConsoleScreen } from '../../lib/client/consoleState';

export interface ConsoleShellProps {
  organization: (PlatformOrganization & { role: PlatformRole }) | null;
  organizations: Array<PlatformOrganization & { role: PlatformRole }>;
  onSelectOrganization: (organizationId: string) => void;
  route: ConsoleRoute;
  onNavigate: (route: ConsoleRoute) => void;
  language: 'en' | 'fr';
  onToggleLanguage: () => void;
  onSignOut: () => void;
  signOutPending: boolean;
  signOutError: string | null;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ screen: ConsoleScreen; en: string; fr: string }> = [
  { screen: 'PROJECTS', en: 'Projects', fr: 'Projets' },
  { screen: 'MEMBERS', en: 'Members', fr: 'Membres' },
  { screen: 'SETTINGS', en: 'Settings', fr: 'Paramètres' },
];

const ConsoleShell: React.FC<ConsoleShellProps> = ({
  organization,
  organizations,
  onSelectOrganization,
  route,
  onNavigate,
  language,
  onToggleLanguage,
  onSignOut,
  signOutPending,
  signOutError,
  children,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const accentColor = organization?.accentColor ?? '#c86b4a';
  const initial = (organization?.name ?? 'A').trim().charAt(0).toUpperCase() || 'A';

  return (
    <div
      className="flex min-h-screen flex-col bg-page text-ink lg:flex-row"
      style={{ ['--org-accent' as string]: accentColor }}
    >
      <aside className="flex w-full shrink-0 flex-col border-b border-navy-border bg-white px-4 py-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r lg:py-6">
        <div className="flex items-center gap-3 px-1">
          {organization?.logoUrl ? (
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-terra text-sm font-bold text-white">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {organization?.name ?? t('No organization', 'Aucune organisation')}
            </p>
            <p className="micro-label truncate text-ink-muted">
              {organization ? organization.role : t('Data Ops Console', 'Console Data Ops')}
            </p>
          </div>
        </div>

        {organizations.length > 1 && (
          <label className="mt-5 block">
            <span className="micro-label mb-1 block text-ink-muted">
              {t('Organization', 'Organisation')}
            </span>
            <select
              className="h-12 w-full rounded-xl border border-navy-border bg-white px-3 text-base text-ink lg:text-sm"
              value={organization?.id ?? ''}
              onChange={(event) => onSelectOrganization(event.target.value)}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav
          className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:mt-6 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label={t('Console sections', 'Sections de la console')}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = route.screen === item.screen;
            return (
              <button
                key={item.screen}
                type="button"
                onClick={() => onNavigate({ screen: item.screen })}
                className={`micro-label min-h-12 shrink-0 whitespace-nowrap rounded-xl px-4 py-3 text-left transition-colors ${
                  isActive ? 'bg-navy-wash text-navy' : 'text-ink-muted hover:bg-navy-wash/60 hover:text-navy'
                }`}
              >
                {t(item.en, item.fr)}
              </button>
            );
          })}
        </nav>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:mt-auto lg:grid-cols-1 lg:pt-6">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="micro-label min-h-12 w-full rounded-xl border border-navy-border px-3 py-3 text-center text-ink-muted hover:text-navy"
          >
            {language === 'fr' ? 'FR' : 'EN'} · {t('Switch to French', 'Passer en anglais')}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signOutPending}
            className="micro-label min-h-12 w-full rounded-xl border border-red-200 px-3 py-3 text-center text-red-700 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
          >
            {signOutPending ? t('Signing out…', 'Déconnexion…') : t('Sign out', 'Se déconnecter')}
          </button>
          {signOutError && (
            <p role="alert" className="col-span-2 text-sm leading-5 text-red-700 lg:col-span-1">
              {signOutError}
            </p>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
};

export default ConsoleShell;
