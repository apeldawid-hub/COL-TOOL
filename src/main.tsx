import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TutorialProvider } from './context/TutorialContext';
import { StoreProvider } from './context/StoreContext';
import { logger } from './services/logger';
import './index.css';

// Inicjalizacja globalnej Czarnej Skrzynki i loggera zdarzeń
logger.init();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary moduleName="Aplikacja Główna" fallbackTitle="Awaria Aplikacji Starbucks Operations Suite">
      <TutorialProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </TutorialProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
