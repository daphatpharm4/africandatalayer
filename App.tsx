import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Screen, DataPoint, ContributionMode } from './types';
import { getSession, signOut } from './lib/client/auth';
import {
  flushOfflineQueue,
  getQueueSnapshot,
  subscribeQueueSnapshot,
  type QueueItem,
  type QueueSnapshot,
} from './lib/client/offlineQueue';
import { sendSubmissionPayload } from './lib/client/submissionSync';
import type { CollectionAssignment, UserRole } from './shared/types';
import Splash from './components/Screens/Splash';
import Home from './components/Screens/Home';
import Navigation from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import SyncStatusBar from './components/SyncStatusBar';

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
const SubmissionQueue = lazy(() => import('./components/Screens/SubmissionQueue'));

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
    const saved = localStorage.getItem('adl_language');
    return saved === 'en' ? 'en' : 'fr';
  });
  const [history, setHistory] = useState<Screen[]>([]);
  const [authReturnScreen, setAuthReturnScreen] = useState<Screen>(Screen.SPLASH);
  const [contributionMode, setContributionMode] = useState<ContributionMode>('CREATE');
  const [contributionPoint, setContributionPoint] = useState<DataPoint | null>(null);
  const [contributionDraft, setContributionDraft] = useState<QueueItem | null>(null);
  const [contributionAssignment, setContributionAssignment] = useState<CollectionAssignment | null>(null);
  const [batchCaptureMode, setBatchCaptureMode] = useState(false);
  const [queueSnapshot, setQueueSnapshot] = useState<QueueSnapshot>(defaultQueueSnapshot);

  const isClient = userRole === 'client';

  const navigateTo = (screen: Screen, point: DataPoint | null = null) => {
    if (currentScreen === Screen.SPLASH && screen !== Screen.SPLASH) {
      localStorage.setItem('adl_splash_seen', 'true');
    }
    if (screen === Screen.AUTH) {
      setAuthReturnScreen(currentScreen);
    }
    setHistory((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
    if (point) setSelectedPoint(point);
  };

  const clearContributionContext = () => {
    setContributionMode('CREATE');
    setContributionPoint(null);
    setContributionDraft(null);
    setContributionAssignment(null);
    setBatchCaptureMode(false);
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((prevHistory) => prevHistory.slice(0, -1));
      setCurrentScreen(prev);
      return;
    }
    if (currentScreen === Screen.AUTH) {
      setCurrentScreen(authReturnScreen);
      return;
    }
    setHistory([]);
    setCurrentScreen(isClient ? Screen.DELTA_DASHBOARD : Screen.HOME);
  };

  const switchTab = (screen: Screen) => {
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
  };

  const openContribution = (mode: ContributionMode, options: ContributionLaunchOptions = {}) => {
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
  };

  const runQueueSync = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      await flushOfflineQueue(sendSubmissionPayload);
    } catch (error) {
      console.error('[App] Offline queue sync failed:', error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('adl_language', language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    void getQueueSnapshot().then(setQueueSnapshot).catch(() => undefined);
    const unsubscribe = subscribeQueueSnapshot(setQueueSnapshot);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleStatus = async () => {
      const online = navigator.onLine;
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

    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    void handleStatus();
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const refreshSession = async () => {
    const session = await getSession();
    const hasUser = !!session?.user;
    setIsAuthenticated(hasUser);
    setIsAdmin(Boolean(session?.user?.isAdmin));
    setUserRole((session?.user?.role as UserRole) ?? 'agent');
    return hasUser;
  };

  useEffect(() => {
    const bootstrap = async () => {
      const hasUser = await refreshSession();
      const hasSeenSplash = localStorage.getItem('adl_splash_seen') === 'true';
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
    const hasSeenSplash = localStorage.getItem('adl_splash_seen') === 'true';
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
      case Screen.AUTH:
        return (
          <Auth
            language={language}
            onBack={goBack}
            onComplete={async () => {
              await refreshSession();
              const session = await getSession();
              const role = (session?.user?.role as UserRole) ?? 'agent';
              switchTab(role === 'client' ? Screen.DELTA_DASHBOARD : Screen.HOME);
            }}
          />
        );
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
            onRedeem={() => navigateTo(Screen.REWARDS)}
            onSubmissionQueue={() => navigateTo(Screen.SUBMISSION_QUEUE)}
          />
        );
      case Screen.ANALYTICS:
        return (
          <Analytics
            onBack={goBack}
            isAdmin={isAdmin}
            onAdmin={isAdmin ? () => navigateTo(Screen.ADMIN) : undefined}
            onAgentPerformance={isAdmin ? () => navigateTo(Screen.AGENT_PERFORMANCE) : undefined}
            onDeltaDashboard={isAdmin || isClient ? () => navigateTo(Screen.DELTA_DASHBOARD) : undefined}
            language={language}
          />
        );
      case Screen.SETTINGS:
        return (
          <Settings
            onBack={goBack}
            language={language}
            onLanguageChange={setLanguage}
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
    || (currentScreen === Screen.DELTA_DASHBOARD && (isAdmin || isClient));

  return (
    <ErrorBoundary>
      <div
        className={`app-shell flex flex-col w-full ${wideShell ? 'max-w-7xl' : 'max-w-md'} mx-auto bg-white shadow-2xl relative overflow-hidden border-x border-gray-100 min-h-screen`}
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

        <main className="flex-1 overflow-hidden relative">
          <Suspense
            fallback={
              <div className="h-full w-full bg-[#f9fafb] p-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-xs text-gray-500">
                  {language === 'fr' ? 'Chargement de l ecran...' : 'Loading screen...'}
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
    </ErrorBoundary>
  );
};

export default App;
