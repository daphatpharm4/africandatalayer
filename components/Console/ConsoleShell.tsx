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
  children,
}) => {
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);
  const accentColor = organization?.accentColor ?? '#c86b4a';
  const initial = (organization?.name ?? 'A').trim().charAt(0).toUpperCase() || 'A';

  return (
    <div
      className="flex min-h-screen bg-page text-ink"
      style={{ ['--org-accent' as string]: accentColor }}
    >
      <aside className="flex w-64 shrink-0 flex-col border-r border-navy-border bg-white px-4 py-6">
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
              className="h-10 w-full rounded-xl border border-navy-border bg-white px-3 text-sm text-ink"
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

        <nav className="mt-6 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = route.screen === item.screen;
            return (
              <button
                key={item.screen}
                type="button"
                onClick={() => onNavigate({ screen: item.screen })}
                className={`micro-label rounded-xl px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-navy-wash text-navy' : 'text-ink-muted hover:bg-navy-wash/60 hover:text-navy'
                }`}
              >
                {t(item.en, item.fr)}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="micro-label w-full rounded-xl border border-navy-border px-3 py-2.5 text-center text-ink-muted hover:text-navy"
          >
            {language === 'fr' ? 'FR' : 'EN'} · {t('Switch to French', 'Passer en anglais')}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6">{children}</div>
      </main>
    </div>
  );
};

export default ConsoleShell;
