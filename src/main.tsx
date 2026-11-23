import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router, routerReady } from './routes';
import ErrorBoundary from './components/ErrorBoundary';
import i18n from './i18n';
import { localeFromPath } from './lib/seo/locale';
import { startApp } from './lib/bootMode';
import { seedContentFromDom } from './lib/seo/contentCache';
import './index.css';

const root = document.getElementById('root')!;
// reducedMotion="user": with the OS "reduce motion" setting, every
// framer-motion transform / layout animation becomes opacity-only, also in
// screens that do not call useReducedMotion themselves.
const app = (
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </MotionConfig>
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
    // Lazy routes (the game) load their chunk first: hydrating before that
    // would render nothing where the server rendered the page.
    await routerReady(router);
  },
  (mode) => {
    if (mode === 'hydrate') hydrateRoot(root, app);
    else createRoot(root).render(app);
  },
);
