import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import ErrorBoundary from './components/ErrorBoundary';
import i18n from './i18n';
import { localeFromPath } from './lib/seo/locale';
import { startApp } from './lib/bootMode';
import { seedContentFromDom } from './lib/seo/contentCache';
import './index.css';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>
);

void startApp(
  root,
  async () => {
    // Match the server render: set language from the URL before hydrating.
    const lang = localeFromPath(location.pathname);
    if (lang) await i18n.changeLanguage(lang);
    // Content the prerendered page was built from, so hydration renders the same data.
    seedContentFromDom(document);
  },
  (mode) => {
    if (mode === 'hydrate') hydrateRoot(root, app);
    else createRoot(root).render(app);
  },
);
