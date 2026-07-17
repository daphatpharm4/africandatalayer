import React, { useCallback, useEffect, useState } from 'react';
import { getSession } from '../../lib/client/auth';
import { listMyOrganizations, PlatformApiError } from '../../lib/client/platformApi';
import type { PlatformOrganization, PlatformRole } from '../../shared/platformTypes';
import {
  consoleRouteToHash,
  parseConsoleHash,
  type ConsoleRoute,
} from '../../lib/client/consoleState';
import ConsoleShell from './ConsoleShell';

const LANGUAGE_STORAGE_KEY = 'adl_language';
const ORG_STORAGE_KEY = 'adl_console_org';

type OrgWithRole = PlatformOrganization & { role: PlatformRole };

type SessionState = 'loading' | 'authenticated' | 'unauthenticated';

function readStoredLanguage(): 'en' | 'fr' {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

function readStoredOrgId(): string | null {
  try {
    return localStorage.getItem(ORG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readInitialRoute(): ConsoleRoute {
  if (typeof window === 'undefined') return { screen: 'PROJECTS' };
  return parseConsoleHash(window.location.hash);
}

const ConsoleApp: React.FC = () => {
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const [organizations, setOrganizations] = useState<OrgWithRole[] | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => readStoredOrgId());
  const [route, setRoute] = useState<ConsoleRoute>(() => readInitialRoute());
  const [language, setLanguage] = useState<'en' | 'fr'>(() => readStoredLanguage());

  const t = useCallback(
    (en: string, fr: string) => (language === 'fr' ? fr : en),
    [language],
  );

  // Session check on mount.
  useEffect(() => {
    let cancelled = false;
    void getSession().then((session) => {
      if (cancelled) return;
      setSessionState(session?.user ? 'authenticated' : 'unauthenticated');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load organizations once authenticated.
  useEffect(() => {
    if (sessionState !== 'authenticated') return;
    let cancelled = false;
    void listMyOrganizations()
      .then((orgs) => {
        if (cancelled) return;
        setOrganizations(orgs);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof PlatformApiError && (error.status === 401 || error.status === 403)) {
          setSessionState('unauthenticated');
          return;
        }
        // Non-auth failure: surface an empty org list rather than getting stuck loading.
        setOrganizations([]);
        console.error('[ConsoleApp] Failed to load organizations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionState]);

  // Sync route with the location hash.
  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseConsoleHash(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Persist language and reflect it on <html lang>.
  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* private browsing */
    }
    document.documentElement.lang = language;
  }, [language]);

  const handleNavigate = useCallback((next: ConsoleRoute) => {
    setRoute(next);
    const hash = consoleRouteToHash(next);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  }, []);

  const handleSelectOrganization = useCallback((organizationId: string) => {
    setSelectedOrgId(organizationId);
    try {
      localStorage.setItem(ORG_STORAGE_KEY, organizationId);
    } catch {
      /* private browsing */
    }
  }, []);

  const handleToggleLanguage = useCallback(() => {
    setLanguage((current) => (current === 'fr' ? 'en' : 'fr'));
  }, []);

  if (sessionState === 'loading' || (sessionState === 'authenticated' && organizations === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-ink-muted">
        <p className="micro-label">{t('Loading console', 'Chargement de la console')}</p>
      </div>
    );
  }

  if (sessionState === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-6">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">
            {t('Sign in required', 'Connexion requise')}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t(
              'Sign in to the African Data Layer app to access the console.',
              "Connectez-vous à l'application African Data Layer pour accéder à la console.",
            )}
          </p>
          <a href="/" className="btn-primary mt-5 flex items-center justify-center">
            {t('Go to sign in', 'Aller à la connexion')}
          </a>
        </div>
      </div>
    );
  }

  const orgs = organizations ?? [];
  const hasOrgs = orgs.length > 0;
  // A brand-new invitee with zero organizations still needs to reach the JOIN
  // screen to accept an invite; every other screen requires an org, so force
  // ONBOARDING until one exists.
  const effectiveRoute: ConsoleRoute =
    !hasOrgs && route.screen !== 'JOIN' ? { screen: 'ONBOARDING' } : route;

  const selectedOrganization =
    orgs.find((org) => org.id === selectedOrgId) ?? orgs[0] ?? null;

  let screenContent: React.ReactNode;
  switch (effectiveRoute.screen) {
    case 'ONBOARDING':
      screenContent = <div>{t('Onboarding coming soon.', "Intégration à venir.")}</div>;
      break;
    case 'PROJECTS':
      screenContent = <div>{t('Projects coming soon.', 'Projets à venir.')}</div>;
      break;
    case 'SCHEMA_BUILDER':
      screenContent = <div>{t('Schema builder coming soon.', 'Générateur de schéma à venir.')}</div>;
      break;
    case 'MEMBERS':
      screenContent = <div>{t('Members coming soon.', 'Membres à venir.')}</div>;
      break;
    case 'SETTINGS':
      screenContent = <div>{t('Settings coming soon.', 'Paramètres à venir.')}</div>;
      break;
    case 'JOIN':
      screenContent = <div>{t('Join organization coming soon.', "Rejoindre l'organisation à venir.")}</div>;
      break;
    default:
      screenContent = <div>{t('Projects coming soon.', 'Projets à venir.')}</div>;
  }

  return (
    <ConsoleShell
      organization={selectedOrganization}
      organizations={orgs}
      onSelectOrganization={handleSelectOrganization}
      route={effectiveRoute}
      onNavigate={handleNavigate}
      language={language}
      onToggleLanguage={handleToggleLanguage}
    >
      {screenContent}
    </ConsoleShell>
  );
};

export default ConsoleApp;
