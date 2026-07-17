import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { getSession, signOut } from '../../lib/client/auth';
import { listMyOrganizations, PlatformApiError } from '../../lib/client/platformApi';
import type { PlatformOrganization, PlatformRole } from '../../shared/platformTypes';
import {
  consoleRouteToHash,
  parseConsoleHash,
  type ConsoleRoute,
} from '../../lib/client/consoleState';
import ConsoleShell from './ConsoleShell';

const JoinScreen = lazy(() => import('./JoinScreen'));
const MembersScreen = lazy(() => import('./MembersScreen'));
const OnboardingWizard = lazy(() => import('./OnboardingWizard'));
const ProjectsScreen = lazy(() => import('./ProjectsScreen'));
const SchemaBuilder = lazy(() => import('./SchemaBuilder'));
const SettingsScreen = lazy(() => import('./SettingsScreen'));

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
  const [userId, setUserId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrgWithRole[] | null>(null);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [orgsReloadKey, setOrgsReloadKey] = useState(0);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => readStoredOrgId());
  const [route, setRoute] = useState<ConsoleRoute>(() => readInitialRoute());
  const [language, setLanguage] = useState<'en' | 'fr'>(() => readStoredLanguage());
  const [joinBanner, setJoinBanner] = useState<string | null>(null);
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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
      setUserId(session?.user?.id ?? null);
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
        setOrgsError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof PlatformApiError && (error.status === 401 || error.status === 403)) {
          setSessionState('unauthenticated');
          return;
        }
        // Non-auth failure: capture error state instead of treating as zero orgs.
        setOrgsError(error instanceof Error ? error.message : 'Failed to load organizations');
        console.error('[ConsoleApp] Failed to load organizations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionState, orgsReloadKey]);

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

  const handleSignOut = useCallback(async () => {
    if (signOutPending) return;
    setSignOutPending(true);
    setSignOutError(null);
    try {
      await signOut();
      try {
        localStorage.removeItem(ORG_STORAGE_KEY);
      } catch {
        /* private browsing */
      }
      window.location.assign('/');
    } catch {
      setSignOutError(t('Could not sign out. Please try again.', 'Impossible de vous déconnecter. Veuillez réessayer.'));
      setSignOutPending(false);
    }
  }, [signOutPending, t]);

  // Event handler, not an effect — the wizard's own step-4 busy state covers
  // the fetch window, so a simple try/catch (no cancelled-flag) is enough.
  // Organizations must be set in state BEFORE navigating to PROJECTS, or
  // effectiveRoute (which forces ONBOARDING while hasOrgs is false) would
  // render a blank pane until a separate async reload resolved.
  const handleOnboardingDone = useCallback(
    async (organizationId: string) => {
      try {
        const orgs = await listMyOrganizations();
        setOrganizations(orgs);
        setOrgsError(null);
        handleSelectOrganization(organizationId);
        handleNavigate({ screen: 'PROJECTS' });
      } catch (error) {
        if (error instanceof PlatformApiError && (error.status === 401 || error.status === 403)) {
          setSessionState('unauthenticated');
          return;
        }
        setOrgsError(error instanceof Error ? error.message : 'Failed to load organizations');
        console.error('[ConsoleApp] Failed to load organizations after onboarding:', error);
      }
    },
    [handleSelectOrganization, handleNavigate],
  );

  // Invite acceptance reuses the exact same race-free sequence as onboarding
  // completion (fetch orgs -> select -> navigate), then layers a dismissible
  // success banner on top — JoinScreen unmounts as soon as this resolves, so
  // the banner has to live here rather than in JoinScreen itself.
  const handleJoined = useCallback(
    (organizationId: string) => {
      setJoinBanner(t('You have joined the organization.', "Vous avez rejoint l'organisation."));
      void handleOnboardingDone(organizationId);
    },
    [handleOnboardingDone, t],
  );

  // SettingsScreen saves land here with the server's updated organization
  // record — merge it into the org already in state (preserving the viewer's
  // role, which updateOrganizationRequest's response doesn't carry) so the
  // sidebar name/logo/accent reflect the save immediately without a refetch.
  const handleOrganizationUpdated = useCallback((updated: PlatformOrganization) => {
    setOrganizations((current) =>
      current ? current.map((org) => (org.id === updated.id ? { ...org, ...updated } : org)) : current,
    );
  }, []);

  if (sessionState === 'loading' || (sessionState === 'authenticated' && organizations === null && !orgsError)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page text-ink-muted">
        <p className="micro-label">{t('Loading console', 'Chargement de la console')}</p>
      </main>
    );
  }

  if (sessionState === 'authenticated' && orgsError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-6">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">
            {t('Could not load your workspaces', 'Impossible de charger vos espaces de travail')}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {orgsError}
          </p>
          <button
            onClick={() => setOrgsReloadKey((k) => k + 1)}
            className="btn-primary mt-5 flex w-full items-center justify-center"
          >
            {t('Try again', 'Réessayer')}
          </button>
        </div>
      </main>
    );
  }

  // JOIN is reachable without a session — JoinScreen itself renders the
  // sign-in prompt (with copy specific to invite links) so we don't lose the
  // joinToken by bouncing through this generic gate first.
  if (sessionState === 'unauthenticated' && route.screen !== 'JOIN') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-6">
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
      </main>
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
      screenContent = <OnboardingWizard language={language} onDone={handleOnboardingDone} />;
      break;
    case 'PROJECTS':
      screenContent = selectedOrganization ? (
        <ProjectsScreen organizationId={selectedOrganization.id} language={language} onNavigate={handleNavigate} />
      ) : (
        <div>{t('Select an organization to see its projects.', 'Sélectionnez une organisation pour voir ses projets.')}</div>
      );
      break;
    case 'SCHEMA_BUILDER':
      screenContent = effectiveRoute.projectId ? (
        <SchemaBuilder projectId={effectiveRoute.projectId} language={language} onNavigate={handleNavigate} />
      ) : (
        <div>{t('No project selected.', 'Aucun projet sélectionné.')}</div>
      );
      break;
    case 'MEMBERS':
      screenContent = selectedOrganization ? (
        <MembersScreen
          organizationId={selectedOrganization.id}
          viewerRole={selectedOrganization.role}
          viewerUserId={userId}
          language={language}
        />
      ) : (
        <div>{t('Select an organization to see its members.', 'Sélectionnez une organisation pour voir ses membres.')}</div>
      );
      break;
    case 'SETTINGS':
      screenContent = selectedOrganization ? (
        <SettingsScreen
          organizationId={selectedOrganization.id}
          organization={selectedOrganization}
          language={language}
          onOrganizationUpdated={handleOrganizationUpdated}
        />
      ) : (
        <div>{t('Select an organization to see its settings.', 'Sélectionnez une organisation pour voir ses paramètres.')}</div>
      );
      break;
    case 'JOIN':
      screenContent = (
        <JoinScreen
          token={effectiveRoute.joinToken}
          hasSession={sessionState === 'authenticated'}
          language={language}
          onJoined={handleJoined}
          onSignOut={handleSignOut}
          signOutPending={signOutPending}
          signOutError={signOutError}
        />
      );
      break;
    default:
      screenContent = <div>{t('Projects coming soon.', 'Projets à venir.')}</div>;
  }

  return (
    <>
      {joinBanner && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-forest px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            <span>{joinBanner}</span>
            <button
              type="button"
              onClick={() => setJoinBanner(null)}
              aria-label={t('Dismiss', 'Fermer')}
              className="text-white/80 transition-colors hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <ConsoleShell
        organization={selectedOrganization}
        organizations={orgs}
        onSelectOrganization={handleSelectOrganization}
        route={effectiveRoute}
        onNavigate={handleNavigate}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        onSignOut={handleSignOut}
        signOutPending={signOutPending}
        signOutError={signOutError}
      >
        <Suspense fallback={<p className="micro-label text-ink-muted" role="status">{t('Loading view…', 'Chargement de la vue…')}</p>}>
          {screenContent}
        </Suspense>
      </ConsoleShell>
    </>
  );
};

export default ConsoleApp;
