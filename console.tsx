import React from 'react';
import { createRoot } from 'react-dom/client';
import ConsoleApp from './components/Console/ConsoleApp';
import ErrorBoundary from './components/ErrorBoundary';
import { initClientSentry } from './lib/client/sentry';
import './index.css';

initClientSentry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConsoleApp />
    </ErrorBoundary>
  </React.StrictMode>
);
