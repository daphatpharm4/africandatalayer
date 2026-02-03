
import React, { useState, useEffect } from 'react';
import { Screen, DataPoint } from './types';
import { getSession, signOut } from './lib/client/auth';
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
  const [history, setHistory] = useState<Screen[]>([]);
  const [authReturnScreen, setAuthReturnScreen] = useState<Screen>(Screen.SPLASH);

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
    if (screen === Screen.CONTRIBUTE && !isAuthenticated) {
      setAuthReturnScreen(currentScreen);
      setCurrentScreen(Screen.AUTH);
    } else {
      if (screen === Screen.AUTH) {
        setAuthReturnScreen(currentScreen);
      }
      setCurrentScreen(screen);
    }
  };

  useEffect(() => {
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
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
        return <Splash onStart={(scr) => navigateTo(scr)} />;
      case Screen.HOME:
        return (
          <Home
            onSelectPoint={(p) => navigateTo(Screen.DETAILS, p)}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            onAuth={() => navigateTo(Screen.AUTH)}
            onContribute={() => (isAuthenticated ? navigateTo(Screen.CONTRIBUTE) : navigateTo(Screen.AUTH))}
            onProfile={() => switchTab(Screen.PROFILE)}
          />
        );
      case Screen.DETAILS:
        return (
          <Details
            point={selectedPoint}
            onBack={goBack}
            onContribute={() => (isAuthenticated ? navigateTo(Screen.CONTRIBUTE) : navigateTo(Screen.AUTH))}
            isAuthenticated={isAuthenticated}
            onAuth={() => navigateTo(Screen.AUTH)}
          />
        );
      case Screen.AUTH:
        return <Auth onBack={goBack} onComplete={async () => { await refreshSession(); switchTab(Screen.HOME); }} />;
      case Screen.CONTRIBUTE:
        return <ContributionFlow onBack={goBack} onComplete={() => switchTab(Screen.HOME)} />;
      case Screen.PROFILE:
        return <Profile onBack={goBack} onSettings={() => navigateTo(Screen.SETTINGS)} onRedeem={() => navigateTo(Screen.REWARDS)} />;
      case Screen.ANALYTICS:
        return (
          <Analytics
            onBack={goBack}
            isAdmin={isAdmin}
            onAdmin={isAdmin ? () => navigateTo(Screen.ADMIN) : undefined}
          />
        );
      case Screen.SETTINGS:
        return (
          <Settings
            onBack={goBack}
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
        return <QualityInfo onBack={goBack} />;
      case Screen.REWARDS:
        return <RewardsCatalog onBack={goBack} />;
      case Screen.ADMIN:
        return <AdminQueue onBack={goBack} />;
      default:
        return <Splash onStart={(scr) => navigateTo(scr)} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden border-x border-gray-100">
      {isOffline && (
        <div className="bg-amber-600 text-white text-[10px] font-bold py-1.5 px-4 text-center z-50 tracking-widest uppercase">
          Offline Mode • Local Sync Active
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
        />
      )}
    </div>
  );
};

export default App;
