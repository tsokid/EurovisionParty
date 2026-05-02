import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import ErrorBoundary from './components/ErrorBoundary';
import PasswordGate from './components/onboarding/PasswordGate';
import './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PasswordGate>
        <RouterProvider router={router} />
      </PasswordGate>
    </ErrorBoundary>
  </StrictMode>,
);
