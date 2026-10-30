import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import ErrorBoundary from './components/ErrorBoundary';
import i18n from './i18n';
import { localeFromPath } from './lib/seo/locale';
import { bootMode } from './lib/bootMode';
import './index.css';

async function boot() {
  // Match the server render: set language from the URL before hydrating.
  const lang = localeFromPath(location.pathname);
  if (lang) await i18n.changeLanguage(lang);

  const root = document.getElementById('root')!;
  const app = (
    <StrictMode>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </StrictMode>
  );

  if (bootMode(root) === 'hydrate') hydrateRoot(root, app);
  else createRoot(root).render(app);
}

void boot();
