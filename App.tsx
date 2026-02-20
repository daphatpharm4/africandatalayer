
import React, { useState, useEffect } from 'react';
import { Screen, DataPoint, ContributionMode } from './types';
import { getSession, signOut } from './lib/client/auth';
import { flushOfflineQueue } from './lib/client/offlineQueue';
import { sendSubmissionPayload } from './lib/client/submissionSync';
import Splash from './components/Screens/Splash';
import Home from './components/Screens/Home';
import Details from './components/Screens/Details';
import Auth from './components/Screens/Auth';
import ContributionFlow from './components/Screens/ContributionFlow';
import Profile from './components/Screens/Profile';
import Analytics from './components/Screens/Analytics';
import Settings from './components/Screens/Settings';
import QualityInfo from './components/Screens/QualityInfo';
import RewardsCatalog from './components/Screens/RewardsCatalog';
import AdminQueue from './components/Screens/AdminQueue';
import Navigation from './components/Navigation';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SPLASH);
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [language, setLanguage] = useState<'en' | 'fr'>(() => {
    const saved = localStorage.getItem('adl_language');
    return saved === 'en' ? 'en' : 'fr';
  });
  const [history, setHistory] = useState<Screen[]>([]);
  const [authReturnScreen, setAuthReturnScreen] = useState<Screen>(Screen.SPLASH);
  const [contributionMode, setContributionMode] = useState<ContributionMode>('CREATE');
  const [contributionPoint, setContributionPoint] = useState<DataPoint | null>(null);
  const t = (en: string, fr: string) => (language === 'fr' ? fr : en);

  const navigateTo = (screen: Screen, point: DataPoint | null = null) => {
    if (currentScreen === Screen.SPLASH && screen !== Screen.SPLASH) {
      localStorage.setItem("adl_splash_seen", "true");
    }
    if (screen === Screen.AUTH) {
      setAuthReturnScreen(currentScreen);
    }
    setHistory(prev => [...prev, currentScreen]);
    setCurrentScreen(screen);
    if (point) setSelectedPoint(point);
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(prevHistory => prevHistory.slice(0, -1));
      setCurrentScreen(prev);
      return;
    }
    if (currentScreen === Screen.AUTH) {
      setCurrentScreen(authReturnScreen);
      return;
    }
    // Fallback for screens opened via tab navigation (no history).
    setHistory([]);
    setCurrentScreen(Screen.HOME);
  };

  const switchTab = (screen: Screen) => {
    setHistory([]);
    if (screen === Screen.CONTRIBUTE && isAdmin) {
      setCurrentScreen(Screen.ADMIN);
      return;
    }
    if (screen === Screen.CONTRIBUTE && !isAuthenticated) {
      setAuthReturnScreen(currentScreen);
      setCurrentScreen(Screen.AUTH);
    } else {
      if (screen === Screen.AUTH) {
        setAuthReturnScreen(currentScreen);
      }
      if (screen === Screen.CONTRIBUTE) {
        setContributionMode('CREATE');
        setContributionPoint(null);
      }
      setCurrentScreen(screen);
    }
  };

  const openContribution = (mode: ContributionMode, point: DataPoint | null = null) => {
    if (isAdmin) {
      switchTab(Screen.ADMIN);
      return;
    }
    setContributionMode(mode);
    setContributionPoint(point);
    if (isAuthenticated) {
      navigateTo(Screen.CONTRIBUTE);
      return;
    }
    navigateTo(Screen.AUTH);
  };

  useEffect(() => {
    localStorage.setItem('adl_language', language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const handleStatus = async () => {
      const online = navigator.onLine;
      setIsOffline(!online);
      if (online) {
        try {
          await flushOfflineQueue(sendSubmissionPayload);
        } catch {
          // Queue remains in IndexedDB and will retry on next online cycle.
        }
      }
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
    return hasUser;
  };

  useEffect(() => {
    const bootstrap = async () => {
      const hasUser = await refreshSession();
      const hasSeenSplash = localStorage.getItem("adl_splash_seen") === "true";
      if (currentScreen === Screen.SPLASH && (hasUser || hasSeenSplash)) {
        setHistory([]);
        setCurrentScreen(Screen.HOME);
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    const hasSeenSplash = localStorage.getItem("adl_splash_seen") === "true";
    if (currentScreen === Screen.SPLASH && hasSeenSplash) {
      setHistory([]);
      setCurrentScreen(Screen.HOME);
    }
  }, [currentScreen]);

  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.SPLASH:
        return <Splash onStart={(scr) => navigateTo(scr)} language={language} />;
      case Screen.HOME:
        return (
          <Home
            onSelectPoint={(p) => navigateTo(Screen.DETAILS, p)}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            onAuth={() => navigateTo(Screen.AUTH)}
            onContribute={() => openContribution('CREATE')}
            onProfile={() => switchTab(Screen.PROFILE)}
            language={language}
          />
        );
      case Screen.DETAILS:
        return (
          <Details
            point={selectedPoint}
            onBack={goBack}
            onEnrich={() => openContribution('ENRICH', selectedPoint)}
            onAddNew={() => openContribution('CREATE')}
            isAuthenticated={isAuthenticated}
            onAuth={() => navigateTo(Screen.AUTH)}
            language={language}
          />
        );
      case Screen.AUTH:
        return <Auth language={language} onBack={goBack} onComplete={async () => { await refreshSession(); switchTab(Screen.HOME); }} />;
      case Screen.CONTRIBUTE:
        return (
          <ContributionFlow
            language={language}
            onBack={goBack}
            onComplete={() => switchTab(Screen.HOME)}
            mode={contributionMode}
            seedPoint={contributionPoint}
          />
        );
      case Screen.PROFILE:
        return <Profile language={language} onBack={goBack} onSettings={() => navigateTo(Screen.SETTINGS)} onRedeem={() => navigateTo(Screen.REWARDS)} />;
      case Screen.ANALYTICS:
        return (
          <Analytics
            onBack={goBack}
            isAdmin={isAdmin}
            onAdmin={isAdmin ? () => navigateTo(Screen.ADMIN) : undefined}
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
      default:
        return <Splash onStart={(scr) => navigateTo(scr)} language={language} />;
    }
  };

  return (
    <div className="app-shell flex flex-col w-full max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden border-x border-gray-100">
      {isOffline && (
        <div className="bg-amber-600 text-white text-[10px] font-bold py-1.5 px-4 text-center z-50 tracking-widest uppercase">
          {t('Offline Mode • Local Sync Active', 'Mode hors ligne • Sync locale active')}
        </div>
      )}

      <main className="flex-1 overflow-hidden relative">
        {renderScreen()}
      </main>

      {!([Screen.SPLASH, Screen.AUTH, Screen.CONTRIBUTE].includes(currentScreen)) && (
        <Navigation 
          currentScreen={currentScreen} 
          onNavigate={(scr) => switchTab(scr)} 
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          language={language}
        />
      )}
    </div>
  );
};

export default App;
