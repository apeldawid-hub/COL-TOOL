import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logger } from './services/logger';
import './index.css';

// Inicjalizacja globalnej Czarnej Skrzynki i loggera zdarzeń
logger.init();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary moduleName="Aplikacja Główna" fallbackTitle="Awaria Aplikacji Starbucks Operations Suite">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
