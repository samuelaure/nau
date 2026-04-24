import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { QueryProvider } from './context/QueryProvider.tsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </QueryProvider>
    </ErrorBoundary>
  </StrictMode>
);
