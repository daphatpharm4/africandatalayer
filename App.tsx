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
import Navigation from './components/Navigation';
import PointOperatorNavigation from './components/PointOperatorNavigation';
import ErrorBoundary from './components/ErrorBoundary';
import SyncStatusBar from './components/SyncStatusBar';
import HelpCenter from './components/docs/HelpCenter';
import { docsPathForAudience } from './lib/docs/helpCenter';
import { defaultScreenForRole, routesForRole } from './lib/client/pointOperatorUi';
import { readConsoleInviteReturn } from './lib/client/inviteReturn';
import {
  flushPointOperatorQueue,
  type PointOperatorMutation,
} from './lib/client/pointOperatorQueue';
import {
  submitPointOperatorPhoto,
  submitPointOperatorSignal,
} from './lib/client/pointOperatorApi';
import {
  loadPlatformFieldContext,
  type PlatformFieldContext,
} from './lib/client/platformFieldContext';
import type { PlatformNearbyPoint } from './shared/platformTypes';

const importDetails = () => import('./components/Screens/Details');
const Details = lazy(importDetails);
const Home = lazy(() => import('./components/Screens/Home'));
const Auth = lazy(() => import('./components/Screens/Auth'));
const ContributionFlow = lazy(() => import('./components/Screens/ContributionFlow'));
const PlatformCollectionFlow = lazy(() => import('./components/Screens/PlatformCollectionFlow'));
const Profile = lazy(() => import('./components/Screens/Profile'));
const Analytics = lazy(() => import('./components/Screens/Analytics'));
const Settings = lazy(() => import('./components/Screens/Settings'));
const QualityInfo = lazy(() => import('./components/Screens/QualityInfo'));
const RewardsCatalog = lazy(() => import('./components/Screens/RewardsCatalog'));
const AdminQueue = lazy(() => import('./components/Screens/AdminQueue'));
const AgentPerformance = lazy(() => import('./components/Screens/AgentPerformance'));
const DeltaDashboard = lazy(() => import('./components/Screens/DeltaDashboard'));
const InvestorDashboard = lazy(() => import('./components/Screens/InvestorDashboard'));
const ClientAccount = lazy(() => import('./components/Screens/ClientAccount'));
const SubmissionQueue = lazy(() => import('./components/Screens/SubmissionQueue'));
const PrivacyPolicy = lazy(() => import('./components/Screens/PrivacyPolicy'));
const TermsOfUse = lazy(() => import('./components/Screens/TermsOfUse'));
const DataCompliance = lazy(() => import('./components/Screens/DataCompliance'));
const IpReport = lazy(() => import('./components/Screens/IpReport'));
const ForgotPassword = lazy(() => import('./components/Screens/ForgotPassword'));
const PointOperatorStatus = lazy(() => import('./components/Screens/PointOperatorStatus'));
const PointOperatorProfile = lazy(() => import('./components/Screens/PointOperatorProfile'));
const PointOperatorPasswordChange = lazy(() => import('./components/Screens/PointOperatorPasswordChange'));

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

type ContributionLaunchOptions = {
  batch?: boolean;
  draft?: QueueItem | null;
  point?: DataPoint | null;
  assignment?: CollectionAssignment | null;
};

type PlatformContributionTarget = {
  choiceKey: string;
  point: PlatformNearbyPoint;
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

const POINT_OPERATOR_SCREENS = routesForRole('point_operator');

const App: React.FC = () => {
  const isSyncingRef = useRef(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/reset')) {
      return Screen.FORGOT_PASSWORD;
    }
    if (typeof window !== 'undefined' && readConsoleInviteReturn()) {
      return Screen.AUTH;
    }
    return Screen.SPLASH;
  });
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('agent');
  const [mustChangePassword, setMustChangePassword] = useState(false);
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
  const [platformFieldContext, setPlatformFieldContext] = useState<PlatformFieldContext | null>(null);
  const [isLoadingPlatformFieldContext, setIsLoadingPlatformFieldContext] = useState(false);
  const [platformFieldContextError, setPlatformFieldContextError] = useState('');
  const [useGenericContribution, setUseGenericContribution] = useState(false);
  const [platformContributionTarget, setPlatformContributionTarget] = useState<PlatformContributionTarget | null>(null);

  const isClient = userRole === 'client';
  const isPointOperator = userRole === 'point_operator';
  const isDocsMode = pathname.startsWith('/docs');
  const docsAudience = isAdmin ? 'admin' : isClient ? 'client' : isPointOperator ? 'point_operator' : 'agent';

  const normalizeScreenForRole = useCallback((screen: Screen, role: UserRole = userRole): Screen => {
    if (role !== 'point_operator') return screen;
    if (mustChangePassword && ![Screen.SPLASH, Screen.AUTH].includes(screen)) {
      return Screen.POINT_OPERATOR_PASSWORD;
    }
    if (POINT_OPERATOR_SCREENS.includes(screen)) return screen;
    if (screen === Screen.POINT_OPERATOR_PASSWORD) return screen;
    if ([Screen.SPLASH, Screen.AUTH, Screen.PRIVACY_POLICY, Screen.TERMS_OF_USE].includes(screen)) return screen;
    if (screen === Screen.PROFILE) return Screen.POINT_OPERATOR_PROFILE;
    return Screen.POINT_OPERATOR_STATUS;
  }, [mustChangePassword, userRole]);

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
    const nextScreen = normalizeScreenForRole(screen);
    setCurrentScreen((prev) => {
      if (prev === Screen.SPLASH && nextScreen !== Screen.SPLASH) {
        try { localStorage.setItem('adl_splash_seen', 'true'); } catch { /* private browsing */ }
      }
      if (nextScreen === Screen.AUTH) {
        setAuthReturnScreen(prev);
      }
      setHistory((h) => [...h, prev]);
      return nextScreen;
    });
    if (point) setSelectedPoint(point);
  }, [normalizeScreenForRole]);

  const clearContributionContext = () => {
    setContributionMode('CREATE');
    setContributionPoint(null);
    setContributionDraft(null);
    setContributionAssignment(null);
    setBatchCaptureMode(false);
    setUseGenericContribution(false);
    setPlatformContributionTarget(null);
  };

  const refreshPlatformFieldContext = useCallback(async () => {
    if (!isAuthenticated || isClient || isPointOperator) {
      setPlatformFieldContext(null);
      setPlatformFieldContextError('');
      setIsLoadingPlatformFieldContext(false);
      return;
    }
    setIsLoadingPlatformFieldContext(true);
    setPlatformFieldContextError('');
    try {
      setPlatformFieldContext(await loadPlatformFieldContext());
    } catch (error) {
      setPlatformFieldContextError(error instanceof Error ? error.message : 'LOAD_FAILED');
    } finally {
      setIsLoadingPlatformFieldContext(false);
    }
  }, [isAuthenticated, isClient, isPointOperator]);

  const companyMode = Boolean(platformFieldContext?.organizations.length);
  const rewardsEnabled = !isLoadingPlatformFieldContext && !companyMode;

  useEffect(() => {
    if (companyMode && currentScreen === Screen.REWARDS) {
      setHistory((current) => current.filter((screen) => screen !== Screen.REWARDS));
      setCurrentScreen(Screen.PROFILE);
    }
  }, [companyMode, currentScreen]);

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
    setCurrentScreen(isPointOperator ? Screen.POINT_OPERATOR_STATUS : isClient ? Screen.DELTA_DASHBOARD : Screen.HOME);
  }, [history, currentScreen, authReturnScreen, isClient, isPointOperator]);

  const switchTab = useCallback((screen: Screen) => {
    const nextScreen = normalizeScreenForRole(screen);
    setHistory([]);
    if (nextScreen === Screen.POINT_OPERATOR_PASSWORD) {
      setCurrentScreen(nextScreen);
      return;
    }
    if (isPointOperator && !POINT_OPERATOR_SCREENS.includes(nextScreen)) {
      setCurrentScreen(Screen.POINT_OPERATOR_STATUS);
      return;
    }
    if (nextScreen === Screen.CONTRIBUTE && isClient) {
      return;
    }
    // Bottom-navigation launches always start a fresh capture. Targeted update
    // context is only created by openContribution from a selected point.
    clearContributionContext();
    if (nextScreen === Screen.CONTRIBUTE && !isAuthenticated) {
      setAuthReturnScreen(currentScreen);
      setCurrentScreen(Screen.AUTH);
      return;
    }
    if (nextScreen === Screen.AUTH) {
      setAuthReturnScreen(currentScreen);
    }
    setCurrentScreen(nextScreen);
  }, [normalizeScreenForRole, isPointOperator, isClient, isAuthenticated, currentScreen]);

  const openContribution = useCallback((mode: ContributionMode, options: ContributionLaunchOptions = {}) => {
    const nearbyPointTarget = companyMode && mode === 'ENRICH'
      ? options.point?.platformEnrichmentTarget
      : undefined;
    const platformRecord = companyMode && mode === 'ENRICH'
      ? options.point?.platformRecord
      : undefined;
    const pointCoordinates = options.point?.coordinates;
    // A record with no pointId is a chain ROOT — it is itself the point to update.
    const linkedRecordTarget = platformRecord && pointCoordinates
      ? {
          choiceKey: `${platformRecord.projectId}:${platformRecord.recordTypeKey}`,
          point: {
            pointId: platformRecord.pointId ?? platformRecord.id,
            category: platformRecord.recordTypeKey,
            name: options.point?.name ?? null,
            location: pointCoordinates,
            details: { name: options.point?.name },
            createdAt: platformRecord.createdAt,
            updatedAt: options.point?.updatedAtIso ?? platformRecord.reviewedAt ?? platformRecord.createdAt,
            gaps: options.point?.gaps ?? [],
            eventsCount: 1,
            distanceMeters: 0,
          },
        }
      : null;
    const platformTarget = nearbyPointTarget ?? linkedRecordTarget;
    setContributionMode(mode);
    setContributionPoint(options.point ?? null);
    setContributionDraft(options.draft ?? null);
    setContributionAssignment(options.assignment ?? null);
    setBatchCaptureMode(Boolean(options.batch));
    setPlatformContributionTarget(platformTarget);
    setUseGenericContribution(!platformTarget && (mode !== 'CREATE' || Boolean(options.draft) || Boolean(options.point) || Boolean(options.assignment)));
    if (isAuthenticated) {
      navigateTo(Screen.CONTRIBUTE);
      return;
    }
    navigateTo(Screen.AUTH);
  }, [companyMode, isAuthenticated, navigateTo]);

  useEffect(() => {
    void refreshPlatformFieldContext();
  }, [refreshPlatformFieldContext]);

  const checkSecurityStatus = useCallback(async (): Promise<{
    wipeRequested: boolean;
    suspendedUntil: string | null;
  } | null> => {
    if (!isAuthenticated) return null;
    try {
      return await apiJson<{ wipeRequested: boolean; suspendedUntil: string | null }>('/api/user?view=status');
    } catch {
      return null;
    }
  }, [isAuthenticated]);

  const runQueueSync = useCallback(async () => {
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
      if (isPointOperator) {
        await flushPointOperatorQueue(async (mutation: PointOperatorMutation, options) => {
          if (mutation.kind === 'signal') {
            await submitPointOperatorSignal(
              {
                field: mutation.field,
                value: mutation.value,
                capturedAt: mutation.capturedAt,
              },
              options,
            );
            return;
          }
          await submitPointOperatorPhoto(
            {
              imageData: mutation.imageData,
              capturedAt: mutation.capturedAt,
            },
            options,
          );
        });
      }
    } catch (error) {
      console.error('[App] Offline queue sync failed:', error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [checkSecurityStatus, isPointOperator]);

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
  }, [isDocsMode, runQueueSync]);

  const refreshSession = async () => {
    const session = await getSession();
    const hasUser = !!session?.user;
    setIsAuthenticated(hasUser);
    setIsAdmin(Boolean(session?.user?.isAdmin));
    setUserRole((session?.user?.role as UserRole) ?? 'agent');
    setMustChangePassword(Boolean(session?.user?.mustChangePassword));
    if (hasUser) {
      try {
        const result = await fetchOutstandingPolicies();
        setOutstandingPolicies(result?.outstanding ?? []);
      } catch {
        setOutstandingPolicies([]);
      }
    } else {
      setOutstandingPolicies([]);
      setPlatformFieldContext(null);
      setPlatformFieldContextError('');
    }
    return session;
  };

  const completeSignOut = async (nextScreen: Screen = Screen.SPLASH) => {
    try {
      await signOut();
    } catch {
      // Fallback to local logout even if server sign-out fails.
    } finally {
      await refreshSession();
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUserRole('agent');
      setMustChangePassword(false);
      setOutstandingPolicies([]);
      setHistory([]);
      clearContributionContext();
      setCurrentScreen(nextScreen);
    }
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
    await completeSignOut();
  };

  useEffect(() => {
    const bootstrap = async () => {
      const session = await refreshSession();
      const hasUser = !!session?.user;
      const inviteReturn = readConsoleInviteReturn();
      if (hasUser && inviteReturn) {
        window.location.replace(inviteReturn);
        return;
      }
      const hasSeenSplash = (() => { try { return localStorage.getItem('adl_splash_seen') === 'true'; } catch { return false; } })();
      if (currentScreen === Screen.SPLASH && (hasUser || hasSeenSplash)) {
        setHistory([]);
        const role = (session?.user?.role as UserRole) ?? 'agent';
        if (session?.user?.mustChangePassword && role === 'point_operator') {
          setCurrentScreen(Screen.POINT_OPERATOR_PASSWORD);
        } else {
          setCurrentScreen(defaultScreenForRole(role));
        }
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
      setCurrentScreen(isPointOperator ? Screen.POINT_OPERATOR_STATUS : isClient ? Screen.DELTA_DASHBOARD : Screen.HOME);
    }
  }, [currentScreen, isClient, isPointOperator]);

  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.SPLASH:
        return <Splash onStart={(scr) => navigateTo(scr)} language={language} />;
      case Screen.HOME:
        return (
          <Home
            onSelectPoint={(point) => navigateTo(Screen.DETAILS, point)}
            onPrefetchDetails={importDetails}
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
            platformFieldContext={platformFieldContext}
            platformFieldContextError={platformFieldContextError}
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
              const session = await refreshSession();
              const inviteReturn = readConsoleInviteReturn();
              if (session?.user && inviteReturn) {
                window.location.replace(inviteReturn);
                return;
              }
              const role = (session?.user?.role as UserRole) ?? 'agent';
              if (session?.user?.mustChangePassword && role === 'point_operator') {
                setHistory([]);
                setCurrentScreen(Screen.POINT_OPERATOR_PASSWORD);
                return;
              }
              switchTab(defaultScreenForRole(role));
            }}
          />
        );
      }
      case Screen.POINT_OPERATOR_STATUS:
        return <PointOperatorStatus language={language} />;
      case Screen.POINT_OPERATOR_PROFILE:
        return (
          <PointOperatorProfile
            language={language}
            onLanguageChange={setLanguage}
            navigateTo={(screen) => navigateTo(screen)}
            onOpenDocs={() => navigatePath(docsPathForAudience(docsAudience))}
            onLogout={() => void completeSignOut()}
          />
        );
      case Screen.POINT_OPERATOR_PASSWORD:
        return (
          <PointOperatorPasswordChange
            language={language}
            onCancel={mustChangePassword ? undefined : () => setCurrentScreen(Screen.POINT_OPERATOR_PROFILE)}
            onSignedOut={() => void completeSignOut(Screen.AUTH)}
          />
        );
      case Screen.CONTRIBUTE:
        if (!useGenericContribution && (
          isLoadingPlatformFieldContext
          || platformFieldContextError
          || Boolean(platformFieldContext?.organizations.length)
        )) {
          return (
            <PlatformCollectionFlow
              context={platformFieldContext}
              isLoading={isLoadingPlatformFieldContext}
              loadError={platformFieldContextError}
              language={language}
              initialTarget={platformContributionTarget}
              onBack={goBack}
              onComplete={() => {
                clearContributionContext();
                switchTab(Screen.HOME);
              }}
              onRetry={() => void refreshPlatformFieldContext()}
            />
          );
        }
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
        if (isClient) {
          return (
            <ClientAccount
              language={language}
              onBack={goBack}
              onSettings={() => navigateTo(Screen.SETTINGS)}
              onOpenDocs={() => navigatePath(docsPathForAudience(docsAudience))}
              navigateTo={(screen) => navigateTo(screen)}
              onLogout={async () => {
                await completeSignOut();
              }}
            />
          );
        }
        return (
          <Profile
            language={language}
            onBack={goBack}
            onSettings={() => navigateTo(Screen.SETTINGS)}
            onOpenDocs={() => navigatePath(docsPathForAudience(docsAudience))}
            onRedeem={() => navigateTo(Screen.REWARDS)}
            rewardsEnabled={rewardsEnabled}
            onSubmissionQueue={() => navigateTo(Screen.SUBMISSION_QUEUE)}
            platformFieldContext={platformFieldContext}
            isLoadingPlatformFieldContext={isLoadingPlatformFieldContext}
            platformFieldContextError={platformFieldContextError}
            onRefreshPlatformFieldContext={() => void refreshPlatformFieldContext()}
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
              await completeSignOut();
            }}
          />
        );
      case Screen.QUALITY:
        return <QualityInfo language={language} onBack={goBack} />;
      case Screen.REWARDS:
        if (!rewardsEnabled) return null;
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
          <Analytics
            onBack={goBack}
            isClient={true}
            onDeltaDashboard={() => navigateTo(Screen.DELTA_DASHBOARD)}
            onInvestorDashboard={() => navigateTo(Screen.INVESTOR_DASHBOARD)}
            language={language}
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
      case Screen.FORGOT_PASSWORD:
        return <ForgotPassword language={language} onBack={() => navigateTo(Screen.AUTH)} />;
      default:
        return <Splash onStart={(scr) => navigateTo(scr)} language={language} />;
    }
  };

  const showSyncBar = !isPointOperator && ![Screen.SPLASH, Screen.AUTH].includes(currentScreen);
  const showNavigation = ![Screen.SPLASH, Screen.AUTH, Screen.CONTRIBUTE, Screen.POINT_OPERATOR_PASSWORD].includes(currentScreen);
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

        {showNavigation && isPointOperator && (
          <PointOperatorNavigation
            currentScreen={currentScreen}
            onNavigate={(screen) => switchTab(screen)}
            language={language}
          />
        )}

        {showNavigation && !isPointOperator && (
          <Navigation
            currentScreen={currentScreen}
            onNavigate={(screen) => switchTab(screen)}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            userRole={userRole}
            language={language}
            companyMode={companyMode}
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
