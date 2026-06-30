
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const Analytics = lazy(() => import('@vercel/analytics/react').then((module) => ({ default: module.Analytics })));
const SpeedInsights = lazy(() => import('@vercel/speed-insights/react').then((module) => ({ default: module.SpeedInsights })));

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleAfterFirstPaint(callback: () => void): () => void {
  let idleHandle: number | null = null;
  const timeoutHandle = window.setTimeout(() => {
    const idleWindow = window as WindowWithIdleCallback;
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleHandle = idleWindow.requestIdleCallback(callback, { timeout: 2500 });
      return;
    }
    callback();
  }, 0);

  return () => {
    window.clearTimeout(timeoutHandle);
    if (idleHandle !== null) {
      const idleWindow = window as WindowWithIdleCallback;
      idleWindow.cancelIdleCallback?.(idleHandle);
    }
  };
}

const DeferredTelemetry: React.FC = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return scheduleAfterFirstPaint(() => {
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <Analytics />
      <SpeedInsights />
    </Suspense>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
    <DeferredTelemetry />
  </React.StrictMode>
);
