import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Category, Screen } from './types';
import type { ContributionMode, DataPoint } from './types';
import { getSession, signOut } from './lib/client/auth';
import { apiJson } from './lib/client/api';
import {
  fetchOutstandingPolicies,
  recordPolicyAcceptance,
} from './lib/client/legal';
import type { PolicyKind } from './shared/legalPolicies';
import {
  flushOfflineQueue,
  getQueueSnapshot,
  subscribeQueueSnapshot,
  type QueueItem,
  type QueueSnapshot,
} from './lib/client/offlineQueue';
import { executeAppWipe } from './lib/client/remoteWipe';
import { sendSubmissionPayload } from './lib/client/submissionSync';
import type { CollectionAssignment, UserRole } from './shared/types';
import { isNative, getPlatform } from './lib/client/native';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import Splash from './components/Screens/Splash';
import Home from './components/Screens/Home';
import Navigation from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import SyncStatusBar from './components/SyncStatusBar';
import HelpCenter from './components/docs/HelpCenter';
import { docsPathForAudience } from './lib/docs/helpCenter';

const Details = lazy(() => import('./components/Screens/Details'));
const Auth = lazy(() => import('./components/Screens/Auth'));
const ContributionFlow = lazy(() => import('./components/Screens/ContributionFlow'));
const Profile = lazy(() => import('./components/Screens/Profile'));
const Analytics = lazy(() => import('./components/Screens/Analytics'));
const Settings = lazy(() => import('./components/Screens/Settings'));
const QualityInfo = lazy(() => import('./components/Screens/QualityInfo'));
const RewardsCatalog = lazy(() => import('./components/Screens/RewardsCatalog'));
const AdminQueue = lazy(() => import('./components/Screens/AdminQueue'));
const AgentPerformance = lazy(() => import('./components/Screens/AgentPerformance'));
const DeltaDashboard = lazy(() => import('./components/Screens/DeltaDashboard'));
const InvestorDashboard = lazy(() => import('./components/Screens/InvestorDashboard'));
const ClientInsights = lazy(() => import('./components/Screens/ClientInsights'));
const SubmissionQueue = lazy(() => import('./components/Screens/SubmissionQueue'));
const PrivacyPolicy = lazy(() => import('./components/Screens/PrivacyPolicy'));
const TermsOfUse = lazy(() => import('./components/Screens/TermsOfUse'));
const DataCompliance = lazy(() => import('./components/Screens/DataCompliance'));
const IpReport = lazy(() => import('./components/Screens/IpReport'));

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

type ContributionLaunchOptions = {
  batch?: boolean;
  draft?: QueueItem | null;
  point?: DataPoint | null;
  assignment?: CollectionAssignment | null;
};

const defaultQueueSnapshot: QueueSnapshot = {
  pending: 0,
  failed: 0,
  total: 0,
  synced: 0,
  queuedFailed: 0,
  rejected: 0,
  storageBytes: 0,
};

const App: React.FC = () => {
  const isSyncingRef = useRef(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SPLASH);
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('agent');
  const [language, setLanguage] = useState<'en' | 'fr'>(() => {
    try { const saved = localStorage.getItem('adl_language'); return saved === 'en' ? 'en' : 'fr'; } catch { return 'fr'; }
  });
  const [history, setHistory] = useState<Screen[]>([]);
  const [authReturnScreen, setAuthReturnScreen] = useState<Screen>(Screen.SPLASH);
  const [contributionMode, setContributionMode] = useState<ContributionMode>('CREATE');
  const [contributionPoint, setContributionPoint] = useState<DataPoint | null>(null);
  const [contributionDraft, setContributionDraft] = useState<QueueItem | null>(null);
  const [contributionAssignment, setContributionAssignment] = useState<CollectionAssignment | null>(null);
  const [batchCaptureMode, setBatchCaptureMode] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>(Category.PHARMACY);
  const [queueSnapshot, setQueueSnapshot] = useState<QueueSnapshot>(defaultQueueSnapshot);
  const [pathname, setPathname] = useState(() => (typeof window === 'undefined' ? '/' : window.location.pathname));
  const [outstandingPolicies, setOutstandingPolicies] = useState<PolicyKind[]>([]);
  const [policyAcceptPending, setPolicyAcceptPending] = useState(false);

  const isClient = userRole === 'client';
  const isDocsMode = pathname.startsWith('/docs');
  const docsAudience = isAdmin ? 'admin' : isClient ? 'client' : 'agent';

  const navigatePath = (path: string) => {
    if (typeof window === 'undefined') {
      setPathname(path);
      return;
    }
    if (window.location.pathname === path) return;
    window.history.pushState({}, '', path);
    setPathname(path);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigateTo = useCallback((screen: Screen, point: DataPoint | null = null) => {
    setCurrentScreen((prev) => {
      if (prev === Screen.SPLASH && screen !== Screen.SPLASH) {
        try { localStorage.setItem('adl_splash_seen', 'true'); } catch { /* private browsing */ }
      }
      if (screen === Screen.AUTH) {
        setAuthReturnScreen(prev);
      }
      setHistory((h) => [...h, prev]);
      return screen;
    });
    if (point) setSelectedPoint(point);
  }, []);

  const clearContributionContext = () => {
    setContributionMode('CREATE');
    setContributionPoint(null);
    setContributionDraft(null);
    setContributionAssignment(null);
    setBatchCaptureMode(false);
  };

  const goBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setCurrentScreen(prev);
      return;
    }
    if (currentScreen === Screen.AUTH) {
      setCurrentScreen(authReturnScreen);
      return;
    }
    setHistory([]);
    setCurrentScreen(isClient ? Screen.DELTA_DASHBOARD : Screen.HOME);
  }, [history, currentScreen, authReturnScreen, isClient]);

  const switchTab = useCallback((screen: Screen) => {
    setHistory([]);
    if (screen === Screen.CONTRIBUTE && isClient) {
      return;
    }
    if (screen !== Screen.CONTRIBUTE) {
      clearContributionContext();
    }
    if (screen === Screen.CONTRIBUTE && !isAuthenticated) {
      setAuthReturnScreen(currentScreen);
      setCurrentScreen(Screen.AUTH);
      return;
    }
    if (screen === Screen.AUTH) {
      setAuthReturnScreen(currentScreen);
    }
    setCurrentScreen(screen);
  }, [isClient, isAuthenticated, currentScreen]);

  const openContribution = useCallback((mode: ContributionMode, options: ContributionLaunchOptions = {}) => {
    setContributionMode(mode);
    setContributionPoint(options.point ?? null);
    setContributionDraft(options.draft ?? null);
    setContributionAssignment(options.assignment ?? null);
    setBatchCaptureMode(Boolean(options.batch));
    if (isAuthenticated) {
      navigateTo(Screen.CONTRIBUTE);
      return;
    }
    navigateTo(Screen.AUTH);
  }, [isAuthenticated, navigateTo]);

  const checkSecurityStatus = async (): Promise<{
    wipeRequested: boolean;
    suspendedUntil: string | null;
  } | null> => {
    if (!isAuthenticated) return null;
    try {
      return await apiJson<{ wipeRequested: boolean; suspendedUntil: string | null }>('/api/user?view=status');
    } catch {
      return null;
    }
  };

  const runQueueSync = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const status = await checkSecurityStatus();
      if (status?.wipeRequested) {
        await executeAppWipe();
        return;
      }
      if (status?.suspendedUntil && new Date(status.suspendedUntil).getTime() > Date.now()) {
        return;
      }
      await flushOfflineQueue(sendSubmissionPayload);
    } catch (error) {
      console.error('[App] Offline queue sync failed:', error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    try { localStorage.setItem('adl_language', language); } catch { /* private browsing */ }
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (isDocsMode) return undefined;
    void getQueueSnapshot().then(setQueueSnapshot).catch(() => undefined);
    const unsubscribe = subscribeQueueSnapshot(setQueueSnapshot);
    return unsubscribe;
  }, [isDocsMode]);

  useEffect(() => {
    if (isDocsMode) return undefined;
    const handleOnlineChange = (online: boolean) => {
      setIsOffline(!online);
      if (!online) return;
      const windowWithIdle = window as WindowWithIdleCallback;
      if (typeof windowWithIdle.requestIdleCallback === 'function') {
        windowWithIdle.requestIdleCallback(() => {
          void runQueueSync();
        }, { timeout: 2000 });
        return;
      }
      window.setTimeout(() => {
        void runQueueSync();
      }, 0);
    };

    if (isNative()) {
      let cleanup: (() => void) | undefined;
      const setup = async () => {
        const status = await Network.getStatus();
        handleOnlineChange(status.connected);
        const listener = await Network.addListener('networkStatusChange', (s) => {
          handleOnlineChange(s.connected);
        });
        cleanup = () => { void listener.remove(); };
      };
      void setup();
      return () => { cleanup?.(); };
    }

    const onOnline = () => handleOnlineChange(true);
    const onOffline = () => handleOnlineChange(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    handleOnlineChange(navigator.onLine);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [isDocsMode]);

  const refreshSession = async () => {
    const session = await getSession();
    const hasUser = !!session?.user;
    setIsAuthenticated(hasUser);
    setIsAdmin(Boolean(session?.user?.isAdmin));
    setUserRole((session?.user?.role as UserRole) ?? 'agent');
    if (hasUser) {
      try {
        const result = await fetchOutstandingPolicies();
        setOutstandingPolicies(result?.outstanding ?? []);
      } catch {
        setOutstandingPolicies([]);
      }
    } else {
      setOutstandingPolicies([]);
    }
    return hasUser;
  };

  const handleAcceptOutstandingPolicies = async () => {
    if (outstandingPolicies.length === 0) return;
    setPolicyAcceptPending(true);
    try {
      const result = await recordPolicyAcceptance(outstandingPolicies);
      if (result?.ok) {
        setOutstandingPolicies([]);
      }
    } finally {
      setPolicyAcceptPending(false);
    }
  };

  const handleDeclineOutstandingPolicies = async () => {
    try {
      await signOut();
    } catch {
      /* best effort */
    } finally {
      await refreshSession();
      setIsAuthenticated(false);
      setOutstandingPolicies([]);
      setHistory([]);
      setCurrentScreen(Screen.SPLASH);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const hasUser = await refreshSession();
      const hasSeenSplash = (() => { try { return localStorage.getItem('adl_splash_seen') === 'true'; } catch { return false; } })();
      if (currentScreen === Screen.SPLASH && (hasUser || hasSeenSplash)) {
        setHistory([]);
        const session = await getSession();
        const role = (session?.user?.role as UserRole) ?? 'agent';
        setCurrentScreen(role === 'client' ? Screen.DELTA_DASHBOARD : Screen.HOME);
      }
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!isNative()) return;

    void SplashScreen.hide();

    void StatusBar.setStyle({ style: Style.Dark });
    if (getPlatform() === 'android') {
      void StatusBar.setBackgroundColor({ color: '#0f2b46' });
    }

    // Lock to portrait — field agents use the app one-handed
    try {
      const lockOrientation = (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock;
      if (lockOrientation) {
        void lockOrientation.call(screen.orientation, 'portrait-primary').catch(() => {});
      }
    } catch { /* orientation lock unsupported */ }

    const listener = CapApp.addListener('backButton', () => {
      if (history.length > 0) {
        goBack();
      } else {
        void CapApp.exitApp();
      }
    });

    return () => { void listener.then((l) => l.remove()); };
  }, []);

  useEffect(() => {
    const hasSeenSplash = (() => { try { return localStorage.getItem('adl_splash_seen') === 'true'; } catch { return false; } })();
    if (currentScreen === Screen.SPLASH && hasSeenSplash) {
      setHistory([]);
      setCurrentScreen(isClient ? Screen.DELTA_DASHBOARD : Screen.HOME);
    }
  }, [currentScreen, isClient]);

  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.SPLASH:
        return <Splash onStart={(scr) => navigateTo(scr)} language={language} />;
      case Screen.HOME:
        return (
          <Home
            onSelectPoint={(point) => navigateTo(Screen.DETAILS, point)}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            userRole={userRole}
            onAuth={() => navigateTo(Screen.AUTH)}
            onContribute={
              isClient
                ? undefined
                : (options) => openContribution('CREATE', {
                    batch: options?.batch,
                    assignment: options?.assignment ?? null,
                  })
            }
            onProfile={() => switchTab(Screen.PROFILE)}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            language={language}
          />
        );
      case Screen.DETAILS:
        return (
          <Details
            point={selectedPoint}
            onBack={goBack}
            onEnrich={() => openContribution('ENRICH', { point: selectedPoint })}
            onAddNew={() => openContribution('CREATE')}
            isAuthenticated={isAuthenticated}
            onAuth={() => navigateTo(Screen.AUTH)}
            language={language}
          />
        );
      case Screen.AUTH: {
        const hasAuthenticated = (() => { try { return localStorage.getItem('adl_has_authenticated') === 'true'; } catch { return false; } })();
        const splashAuthHint = (() => {
          try {
            const v = sessionStorage.getItem('adl_auth_initial_mode');
            return v === 'signin' || v === 'signup' ? v : null;
          } catch { return null; }
        })();
        return (
          <Auth
            language={language}
            onBack={goBack}
            initialMode={splashAuthHint ?? (hasAuthenticated ? 'signin' : 'signup')}
            navigateTo={(screen) => navigateTo(screen)}
            onComplete={async () => {
              await refreshSession();
              const session = await getSession();
              const role = (session?.user?.role as UserRole) ?? 'agent';
              switchTab(role === 'client' ? Screen.DELTA_DASHBOARD : Screen.HOME);
            }}
          />
        );
      }
      case Screen.CONTRIBUTE:
        return (
          <ContributionFlow
            language={language}
            onBack={goBack}
            onComplete={() => {
              clearContributionContext();
              switchTab(Screen.HOME);
            }}
            mode={contributionMode}
            seedPoint={contributionPoint}
            queuedDraft={contributionDraft}
            assignment={contributionAssignment}
            isBatchMode={batchCaptureMode}
            onQueueOpen={() => navigateTo(Screen.SUBMISSION_QUEUE)}
            onDraftConsumed={() => setContributionDraft(null)}
            onBatchExit={() => setBatchCaptureMode(false)}
          />
        );
      case Screen.SUBMISSION_QUEUE:
        return (
          <SubmissionQueue
            language={language}
            onBack={goBack}
            onEditDraft={(item) => {
              const mode = item.payload.eventType === 'ENRICH_EVENT' ? 'ENRICH' : 'CREATE';
              openContribution(mode, { draft: item });
            }}
          />
        );
      case Screen.PROFILE:
        return (
          <Profile
            language={language}
            onBack={goBack}
            onSettings={() => navigateTo(Screen.SETTINGS)}
            onOpenDocs={() => navigatePath(docsPathForAudience(docsAudience))}
            onRedeem={() => navigateTo(Screen.REWARDS)}
            onSubmissionQueue={() => navigateTo(Screen.SUBMISSION_QUEUE)}
          />
        );
      case Screen.ANALYTICS:
        return (
          <Analytics
            onBack={goBack}
            isAdmin={isAdmin}
            isClient={isClient}
            onAdmin={isAdmin ? () => navigateTo(Screen.ADMIN) : undefined}
            onAgentPerformance={isAdmin ? () => navigateTo(Screen.AGENT_PERFORMANCE) : undefined}
            onDeltaDashboard={isAdmin || isClient ? () => navigateTo(Screen.DELTA_DASHBOARD) : undefined}
            onInvestorDashboard={isAdmin || isClient ? () => navigateTo(Screen.INVESTOR_DASHBOARD) : undefined}
            language={language}
          />
        );
      case Screen.SETTINGS:
        return (
          <Settings
            onBack={goBack}
            language={language}
            onLanguageChange={setLanguage}
            navigateTo={(screen) => navigateTo(screen)}
            userRole={userRole}
            onLogout={async () => {
              try {
                await signOut();
              } catch {
                // Fallback to local logout even if server sign-out fails.
              } finally {
                await refreshSession();
                setIsAuthenticated(false);
                clearContributionContext();
                switchTab(Screen.SPLASH);
              }
            }}
          />
        );
      case Screen.QUALITY:
        return <QualityInfo language={language} onBack={goBack} />;
      case Screen.REWARDS:
        return <RewardsCatalog language={language} onBack={goBack} />;
      case Screen.ADMIN:
        return <AdminQueue language={language} onBack={goBack} />;
      case Screen.AGENT_PERFORMANCE:
        return <AgentPerformance language={language} onBack={goBack} />;
      case Screen.DELTA_DASHBOARD:
        return <DeltaDashboard language={language} onBack={goBack} />;
      case Screen.INVESTOR_DASHBOARD:
        return <InvestorDashboard language={language} onBack={goBack} />;
      case Screen.CLIENT_INSIGHTS:
        return (
          <ClientInsights
            language={language}
            onBack={goBack}
            monthLabel={new Date().toLocaleDateString(
              language === 'fr' ? 'fr-FR' : 'en-US',
              { month: 'long', year: 'numeric' },
            )}
            totalPoints={0}
            weeklyDelta={0}
            headline={language === 'fr' ? 'Analyses clients' : 'Client Insights'}
            body={language === 'fr'
              ? 'Les analyses détaillées arrivent bientôt.'
              : 'Detailed insights coming soon.'}
            insights={[]}
            onExport={() => {}}
          />
        );
      case Screen.PRIVACY_POLICY:
        return <PrivacyPolicy language={language} onBack={goBack} />;
      case Screen.TERMS_OF_USE:
        return <TermsOfUse language={language} onBack={goBack} />;
      case Screen.DATA_COMPLIANCE:
        return <DataCompliance language={language} onBack={goBack} />;
      case Screen.IP_REPORT:
        return (
          <IpReport
            language={language}
            onBack={goBack}
            onSubmitted={() => {
              /* Stay on confirmation; user taps Back. */
            }}
          />
        );
      default:
        return <Splash onStart={(scr) => navigateTo(scr)} language={language} />;
    }
  };

  const showSyncBar = ![Screen.SPLASH, Screen.AUTH].includes(currentScreen);
  const showNavigation = ![Screen.SPLASH, Screen.AUTH, Screen.CONTRIBUTE].includes(currentScreen);
  const wideShell =
    currentScreen === Screen.ADMIN
    || currentScreen === Screen.AGENT_PERFORMANCE
    || (currentScreen === Screen.ANALYTICS && isAdmin)
    || (currentScreen === Screen.DELTA_DASHBOARD && (isAdmin || isClient))
    || currentScreen === Screen.INVESTOR_DASHBOARD;

  if (isDocsMode) {
    return (
      <ErrorBoundary>
        <HelpCenter
          pathname={pathname}
          onNavigate={navigatePath}
          viewerRole={userRole}
          isAuthenticated={isAuthenticated}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className={`app-shell relative mx-auto flex w-full flex-col overflow-hidden bg-white ${
          wideShell ? 'max-w-none xl:max-w-7xl' : 'max-w-none sm:max-w-md md:max-w-lg'
        } border-x-0 border-gray-100 shadow-none sm:border-x sm:shadow-2xl ${
          !showSyncBar ? 'pt-[var(--safe-top)]' : ''
        }`}
      >
        {showSyncBar && (
          <SyncStatusBar
            pending={queueSnapshot.pending}
            failed={queueSnapshot.failed}
            synced={queueSnapshot.synced}
            isOffline={isOffline}
            isSyncing={isSyncing}
            onTap={() => navigateTo(Screen.SUBMISSION_QUEUE)}
            onRefresh={() => void runQueueSync()}
            language={language}
          />
        )}

        <main className="relative flex-1 min-h-0 overflow-hidden">
          <Suspense
            fallback={
              <div className="h-full w-full bg-page p-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
                  {language === 'fr' ? 'Préparation de l\'écran...' : 'Preparing the next screen...'}
                </div>
              </div>
            }
          >
            {renderScreen()}
          </Suspense>
        </main>

        {showNavigation && (
          <Navigation
            currentScreen={currentScreen}
            onNavigate={(screen) => switchTab(screen)}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            userRole={userRole}
            language={language}
          />
        )}
      </div>
      {outstandingPolicies.length > 0 && isAuthenticated && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          role="dialog"
          aria-modal="true"
          data-testid="policy-gate"
        >
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-2xl">
            <h2 className="text-base font-bold text-ink">
              {language === 'fr' ? 'Mise à jour des conditions' : 'Policy update required'}
            </h2>
            <p className="mt-2 text-sm text-gray-700 leading-relaxed">
              {language === 'fr'
                ? 'Nos conditions ont été mises à jour. Veuillez les accepter pour continuer.'
                : 'Our policies have been updated. Please review and accept to continue.'}
            </p>
            <ul className="mt-3 text-xs text-gray-600 space-y-1 list-disc pl-5">
              {outstandingPolicies.map((kind) => (
                <li key={kind}>
                  <button
                    type="button"
                    className="underline font-medium text-navy"
                    onClick={() =>
                      navigateTo(
                        kind === 'privacy' ? Screen.PRIVACY_POLICY : Screen.TERMS_OF_USE,
                      )
                    }
                  >
                    {kind === 'privacy'
                      ? language === 'fr'
                        ? 'Politique de confidentialité'
                        : 'Privacy Policy'
                      : language === 'fr'
                      ? "Conditions d'utilisation"
                      : 'Terms of Use'}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void handleDeclineOutstandingPolicies()}
                className="btn-ghost"
                data-testid="policy-gate-decline"
              >
                {language === 'fr' ? 'Se déconnecter' : 'Sign out'}
              </button>
              <button
                type="button"
                onClick={() => void handleAcceptOutstandingPolicies()}
                disabled={policyAcceptPending}
                className="btn-primary disabled:opacity-60"
                data-testid="policy-gate-accept"
              >
                {policyAcceptPending
                  ? language === 'fr'
                    ? 'Enregistrement…'
                    : 'Saving…'
                  : language === 'fr'
                  ? 'Tout accepter'
                  : 'Accept all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

export default App;
